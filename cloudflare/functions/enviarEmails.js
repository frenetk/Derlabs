/* cloudflare/functions/enviarEmails.js
   Correos de pedidos CENTRALIZADOS: todas las tiendas envían con la cuenta
   Resend de DerLabs (secreto RESEND_API_KEY en Cloudflare). La tienda solo
   configura "Correo donde recibes los pedidos" (config/privado.emailVendedor).

   - Remitente: "<Nombre de la tienda> <pedidos@derlabs.cl>"; responder-a: la tienda.
   - El correo se arma SIEMPRE desde el pedido guardado en Firestore: nadie
     puede elegir destinatario ni contenido (no sirve para mandar spam).
   - Un pedido se notifica una sola vez (email_logs/{pedidoId}).
   - Límite por tienda: EMAIL_LIMITE_DIA correos al día.
   - Si la tienda configuró su propia key de Resend + emisor (sistema antiguo),
     se sigue respetando. */

import { Resend } from "resend";
import { getDb, corsHeaders, fmtPrecio, resumenItems, esc, getStoreConfig, uidDesdeToken } from "./_firebase.js";

const EMAIL_LIMITE_DIA = 300;
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
const nombreLimpio = s => String(s || "Tu tienda").replace(/[<>"\r\n]/g, "").trim().slice(0, 60) || "Tu tienda";
const emailOk = s => /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(String(s || "").trim());

/* Envía los correos de UN pedido (cliente + vendedor). Nunca lanza error. */
export async function enviarCorreosPedido(db, env, storeId, ped, origin, opts){
  opts = opts || {};
  const res = { cliente: null, vendedor: null };
  try {
    if (!ped || !ped.id) return { ok: false, motivo: "sin pedido" };
    const logRef = db.doc("tiendas/" + storeId + "/email_logs/" + String(ped.id).replace(/[^A-Za-z0-9_-]/g, ""));
    if (!opts.prueba){
      const ya = await logRef.get();
      if (ya.exists && ya.data().enviado) return { ok: true, repetido: true };
    }
    const config = await getStoreConfig(db, storeId);
    const propia = config.resendApiKey && config.emailEmisor;
    const key = propia ? config.resendApiKey : env.RESEND_API_KEY;
    if (!key) return { ok: false, motivo: "sin RESEND_API_KEY" };

    /* Cupo diario por tienda (solo aplica a la cuenta central) */
    if (!propia){
      const dia = fmtDia.format(new Date());
      const cupoRef = db.doc("tiendas/" + storeId + "/email_cuota/" + dia);
      const c = await cupoRef.get();
      const usados = c.exists ? Number(c.data().enviados) || 0 : 0;
      if (usados >= EMAIL_LIMITE_DIA){ console.warn("enviarCorreos: tienda " + storeId + " llegó al límite diario"); return { ok: false, motivo: "límite diario" }; }
      await cupoRef.set({ enviados: usados + 2, actualizado: new Date().toISOString() }, { merge: true });
    }

    const nombreTienda = nombreLimpio(config.nombreTienda || config.nombre);
    const color = /^#[0-9a-f]{6}$/i.test(config.colorPrimario || "") ? config.colorPrimario : "#111111";
    const from = propia ? config.emailEmisor : (nombreTienda + " <" + (env.EMAIL_PEDIDOS || "pedidos@derlabs.cl") + ">");
    const emailVendedor = String(config.emailVendedor || config.emailNotif || "").trim();
    const cl = ped.cliente || {};
    const resend = new Resend(key);
    const urlTienda = (config.url || origin || "").replace(/\/+$/, "");

    if (emailOk(cl.email) && !opts.soloVendedor){
      try {
        const r = await resend.emails.send({
          from, to: String(cl.email).trim(),
          replyTo: emailOk(emailVendedor) ? emailVendedor : undefined, reply_to: emailOk(emailVendedor) ? emailVendedor : undefined,
          subject: (opts.prueba ? "[Prueba] " : "") + "✅ Pedido #" + ped.id + " recibido — " + nombreTienda,
          html: plantillaCliente(ped, nombreTienda, color)
        });
        res.cliente = r && r.error ? { ok: false, error: String(r.error.message || r.error) } : { ok: true };
      } catch(e){ res.cliente = { ok: false, error: e.message }; }
    }
    if (emailOk(emailVendedor)){
      try {
        const r = await resend.emails.send({
          from, to: emailVendedor,
          replyTo: emailOk(cl.email) ? String(cl.email).trim() : undefined, reply_to: emailOk(cl.email) ? String(cl.email).trim() : undefined,
          subject: (opts.prueba ? "[Prueba] " : "") + "🛍️ Nuevo pedido #" + ped.id + " — " + fmtPrecio(ped.total) + (ped.metodoPago === "mercadopago" ? " (pagado)" : ""),
          html: plantillaVendedor(ped, nombreTienda, color, urlTienda)
        });
        res.vendedor = r && r.error ? { ok: false, error: String(r.error.message || r.error) } : { ok: true };
      } catch(e){ res.vendedor = { ok: false, error: e.message }; }
    }
    if (!opts.prueba){
      await logRef.set({ pedidoId: ped.id, fecha: new Date().toISOString(), enviado: true, central: !propia,
        destinatarioCliente: cl.email || null, destinatarioVendedor: emailVendedor || null, resultados: res }).catch(function(){});
    }
    return { ok: true, resultados: res };
  } catch(e){
    console.warn("enviarCorreosPedido:", e.message);
    return { ok: false, error: e.message, resultados: res };
  }
}

/* Endpoint:
   - { storeId, pedidoId, t }         → reenvía (una sola vez) los correos de ese pedido; t = código de seguimiento
   - { storeId, pedido:{id,seguimiento} } → formato antiguo del navegador, igual se valida contra Firestore
   - { accion:"prueba", storeId }     → correo de prueba al vendedor (requiere sesión con rol en la tienda) */
export async function enviarEmails(request, env){
  const headers = corsHeaders();
  const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers });
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const body = JSON.parse(await request.text() || "{}");
    const storeId = String(body.storeId || "").replace(/[^A-Za-z0-9_-]/g, "");
    if (!storeId) return json({ ok: false, error: "Falta storeId" }, 400);
    const db = getDb(env);
    const origin = new URL(request.url).origin;

    if (body.accion === "prueba"){
      const uid = await uidDesdeToken(request, env);
      if (!uid) return json({ ok: false, error: "Sesión vencida — vuelve a entrar" }, 401);
      const u = await db.doc("usuarios/" + uid).get();
      const rol = u.exists && u.data().roles ? u.data().roles[storeId] : null;
      if (!rol || rol === "repartidor") return json({ ok: false, error: "Sin permiso en esta tienda" }, 403);
      const cfg = await getStoreConfig(db, storeId);
      if (!emailOk(cfg.emailVendedor || cfg.emailNotif)) return json({ ok: false, error: "Guarda primero el correo donde recibes los pedidos" }, 400);
      const demo = {
        id: "PRUEBA", total: 12980, subtotal: 10990, descuento: 0, costoDelivery: 1990, tipo: "delivery", metodoPago: "efectivo",
        items: [{ nombre: "Producto de prueba", cantidad: 1, precio: 10990 }],
        cliente: { nombre: "Cliente de prueba", telefono: "+56912345678", email: "", direccion: "Av. Ejemplo 123, Depto 45", comuna: "Santiago", notas: "Correo de prueba enviado desde tu panel" }
      };
      const r = await enviarCorreosPedido(db, env, storeId, demo, origin, { prueba: true, soloVendedor: true });
      return json(r.resultados && r.resultados.vendedor && r.resultados.vendedor.ok ? { ok: true } : { ok: false, error: (r.resultados && r.resultados.vendedor && r.resultados.vendedor.error) || r.motivo || r.error || "No se pudo enviar" }, 200);
    }

    const pedidoId = String(body.pedidoId || (body.pedido && body.pedido.id) || "").replace(/[^A-Za-z0-9_-]/g, "");
    const t = String(body.t || (body.pedido && body.pedido.seguimiento) || "");
    if (!pedidoId) return json({ ok: false, error: "Falta el pedido" }, 400);
    const d = await db.doc("tiendas/" + storeId + "/pedidos/" + pedidoId).get();
    if (!d.exists) return json({ ok: false, error: "Pedido no encontrado" }, 404);
    const ped = d.data();
    if (!ped.seguimiento || ped.seguimiento !== t) return json({ ok: false, error: "No autorizado" }, 403);
    const r = await enviarCorreosPedido(db, env, storeId, ped, origin);
    return json({ ok: !!r.ok, repetido: !!r.repetido });
  } catch(e){
    console.error("enviarEmails error:", e.message);
    return json({ ok: false, error: e.message }, 500);
  }
}

export function plantillaCliente(pedido, nombreTienda, color){
  const cl = pedido.cliente || {};
  const items = (pedido.items || []).map(function(it){
    return '<tr>' +
      '<td style="padding:8px 0;font-size:14px;color:#333">' + (it.cantidad || 1) + '× ' + esc(it.nombre) +
        (it.variantes && typeof it.variantes === "object" ? Object.keys(it.variantes).map(function(k){ return '<br><span style="font-size:12px;color:#777">' + esc(k) + ': ' + esc(it.variantes[k]) + '</span>'; }).join("") : "") +
        (it.notaPersonal ? '<br><span style="font-size:12px;color:#777">“' + esc(it.notaPersonal) + '”</span>' : "") + '</td>' +
      '<td style="padding:8px 0;font-size:14px;color:#333;text-align:right">' + fmtPrecio((it.precio || 0) * (it.cantidad || 1)) + '</td>' +
    '</tr>';
  }).join("");
  const descuentoRow = pedido.descuento > 0
    ? '<tr><td style="padding:4px 0;font-size:13px;color:#2E7D32">Descuento (' + esc(pedido.cuponAplicado || "") + ')</td><td style="padding:4px 0;font-size:13px;color:#2E7D32;text-align:right">-' + fmtPrecio(pedido.descuento) + '</td></tr>'
    : '';
  const deliveryRow = pedido.tipo === "delivery"
    ? '<tr><td style="padding:4px 0;font-size:13px;color:#666">Delivery</td><td style="padding:4px 0;font-size:13px;color:#666;text-align:right">' + fmtPrecio(pedido.costoDelivery) + '</td></tr>'
    : '';
  const direccion = pedido.tipo === "delivery"
    ? (cl.direccion || "") + (cl.comuna && String(cl.direccion || "").toLowerCase().indexOf(String(cl.comuna).toLowerCase()) === -1 ? ", " + cl.comuna : "")
    : "Retiro en " + (cl.local || "el local");
  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff">' +
      '<tr><td style="background:' + color + ';padding:28px 24px;text-align:center">' +
        '<h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:.5px">' + esc(nombreTienda) + '</h1>' +
      '</td></tr>' +
      '<tr><td style="padding:24px">' +
        '<p style="font-size:14px;color:#333;margin:0 0 4px">¡Gracias por tu pedido, ' + esc(cl.nombre || "") + '!</p>' +
        '<h2 style="font-size:26px;margin:4px 0 20px;color:#111">#' + esc(pedido.id) + '</h2>' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:8px 0">' + items + '</table>' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">' +
          '<tr><td style="padding:4px 0;font-size:13px;color:#666">Subtotal</td><td style="padding:4px 0;font-size:13px;color:#666;text-align:right">' + fmtPrecio(pedido.subtotal || pedido.total) + '</td></tr>' +
          descuentoRow + deliveryRow +
          '<tr><td style="padding:10px 0 0;font-size:17px;font-weight:bold;color:#111;border-top:1px solid #eee">Total</td><td style="padding:10px 0 0;font-size:17px;font-weight:bold;color:#111;text-align:right;border-top:1px solid #eee">' + fmtPrecio(pedido.total) + '</td></tr>' +
        '</table>' +
        '<p style="font-size:13px;color:#666;margin-top:20px"><strong>Entrega:</strong> ' + esc(direccion) + '</p>' +
        '<p style="font-size:13px;color:#666"><strong>Pago:</strong> ' + (pedido.metodoPago === "mercadopago" ? "Mercado Pago (pagado)" : "Efectivo al recibir") + '</p>' +
        '<p style="font-size:13px;color:#999;margin-top:24px;text-align:center">Te avisaremos cuando tu pedido esté en camino. Si tienes dudas, responde este correo y le llegará directo a ' + esc(nombreTienda) + '.</p>' +
      '</td></tr>' +
      '<tr><td style="padding:16px 24px;background:#fafafa;text-align:center">' +
        '<p style="font-size:11px;color:#aaa;margin:0">' + esc(nombreTienda) + ' · Tienda online creada con DerLabs</p>' +
      '</td></tr>' +
    '</table></body></html>';
}

export function plantillaVendedor(pedido, nombreTienda, color, urlTienda){
  const cl = pedido.cliente || {};
  const items = resumenItems(pedido.items);
  const urlGestion = (urlTienda || "") + "/pedidos.html";
  const mapsUrl = cl.direccion ? "https://maps.google.com/?q=" + encodeURIComponent((cl.direccion || "") + " " + (cl.comuna || "") + " Chile") : "";
  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff">' +
      '<tr><td style="background:' + color + ';padding:24px;text-align:center">' +
        '<h1 style="color:#fff;margin:0;font-size:18px">🛍️ Nuevo pedido #' + esc(pedido.id) + '</h1>' +
        '<p style="color:#fff;opacity:.85;margin:6px 0 0;font-size:13px">' + esc(nombreTienda) + '</p>' +
      '</td></tr>' +
      '<tr><td style="padding:24px">' +
        '<p style="font-size:22px;font-weight:bold;color:#111;margin:0 0 16px">' + fmtPrecio(pedido.total) + '</p>' +
        '<p style="font-size:14px;color:#333;margin:0 0 4px"><strong>' + esc(cl.nombre || "") + '</strong></p>' +
        (cl.telefono ? '<p style="font-size:13px;color:#666;margin:0 0 4px">📞 ' + esc(cl.telefono) + '</p>' : '') +
        (cl.email ? '<p style="font-size:13px;color:#666;margin:0 0 12px">✉️ ' + esc(cl.email) + '</p>' : '') +
        (cl.direccion ? '<p style="font-size:13px;color:#666;margin:0 0 12px">📍 <a href="' + mapsUrl + '" style="color:#1565C0">' + esc(cl.direccion) + (cl.comuna ? ", " + esc(cl.comuna) : "") + '</a></p>' : '<p style="font-size:13px;color:#666;margin:0 0 12px">🏠 Retiro en local</p>') +
        (cl.referencias ? '<p style="font-size:13px;color:#666;margin:0 0 12px">🧭 ' + esc(cl.referencias) + '</p>' : '') +
        '<p style="font-size:13px;color:#333;margin:16px 0 4px"><strong>Productos:</strong></p>' +
        '<p style="font-size:13px;color:#666;margin:0 0 16px">' + esc(items) + '</p>' +
        (cl.notas ? '<p style="font-size:13px;color:#333;margin:0 0 16px"><strong>Notas:</strong> ' + esc(cl.notas) + '</p>' : '') +
        '<p style="font-size:12px;color:#999;margin:0 0 20px">Pago: ' + (pedido.metodoPago === "mercadopago" ? "Mercado Pago (pagado)" : "Efectivo") + '</p>' +
        '<table cellpadding="0" cellspacing="0"><tr><td style="background:' + color + ';border-radius:10px">' +
          '<a href="' + esc(urlGestion) + '" style="display:block;padding:14px 24px;color:#fff;font-weight:bold;font-size:14px;text-decoration:none">Ver en gestión de pedidos →</a>' +
        '</td></tr></table>' +
        '<p style="font-size:12px;color:#999;margin:18px 0 0">Si respondes este correo, le llega al cliente.</p>' +
      '</td></tr>' +
    '</table></body></html>';
}
