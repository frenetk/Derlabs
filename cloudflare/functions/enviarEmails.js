/* cloudflare/functions/enviarEmails.js
   Equivalente a netlify/functions/enviarEmails.js. resend, igual que
   mercadopago, ya usa "import { Resend } from 'resend'" como su forma
   documentada estándar — riesgo de interop bajo, no verificado con
   deploy real. plantillaCliente/plantillaVendedor son texto HTML
   puro, sin dependencias — se exportan también, porque webhookPago.js
   las importa directo (mismo patrón que el original). */

import { Resend } from "resend";
import { getDb, corsHeaders, fmtPrecio, resumenItems, esc, getStoreConfig } from "./_firebase.js";

export async function enviarEmails(request, env){
  const headers = corsHeaders();

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const body = JSON.parse(await request.text() || "{}");
    const { pedido, storeId, nombreTienda: nombreEnviado, urlTienda: urlEnviada } = body;

    if (!pedido || !storeId) {
      return new Response(JSON.stringify({ ok: false, error: "Falta pedido o storeId" }), { status: 400, headers });
    }

    const db = getDb(env);
    const config = await getStoreConfig(db, storeId);
    const resendApiKey  = config.resendApiKey;
    const emailEmisor   = config.emailEmisor;
    const emailVendedor = config.emailVendedor || config.emailNotif || "";

    if (!resendApiKey || !emailEmisor) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: "Resend no configurado" }), { status: 200, headers });
    }

    const resend = new Resend(resendApiKey);
    const nombreTienda = nombreEnviado || config.nombreTienda || config.nombre || "Tu tienda";
    const colorPrimario = config.colorPrimario || config.colorHex || "#E53935";
    const url = new URL(request.url);
    const urlTienda = urlEnviada || config.url || url.origin;

    const resultados = { cliente: null, vendedor: null };

    if (pedido.cliente && pedido.cliente.email) {
      try {
        const r = await resend.emails.send({
          from: emailEmisor,
          to: pedido.cliente.email,
          subject: "✅ Pedido #" + pedido.id + " recibido — " + nombreTienda,
          html: plantillaCliente(pedido, nombreTienda, colorPrimario)
        });
        resultados.cliente = { ok: true, id: r.data ? r.data.id : null };
      } catch (e) {
        console.warn("Error enviando email al cliente:", e.message);
        resultados.cliente = { ok: false, error: e.message };
      }
    }

    if (emailVendedor) {
      try {
        const r = await resend.emails.send({
          from: emailEmisor,
          to: emailVendedor,
          subject: "🛍️ Nuevo pedido #" + pedido.id + " — " + fmtPrecio(pedido.total),
          html: plantillaVendedor(pedido, nombreTienda, colorPrimario, urlTienda)
        });
        resultados.vendedor = { ok: true, id: r.data ? r.data.id : null };
      } catch (e) {
        console.warn("Error enviando email al vendedor:", e.message);
        resultados.vendedor = { ok: false, error: e.message };
      }
    }

    db.collection("tiendas/" + storeId + "/email_logs").add({
      pedidoId: pedido.id,
      fecha: new Date().toISOString(),
      destinatarioCliente: pedido.cliente ? pedido.cliente.email : null,
      destinatarioVendedor: emailVendedor || null,
      resultados
    }).catch(function(e){ console.warn("No se pudo guardar email_log:", e.message); });

    return new Response(JSON.stringify({ ok: true, resultados }), { status: 200, headers });
  } catch (e) {
    console.error("enviarEmails error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers });
  }
}

export function plantillaCliente(pedido, nombreTienda, color){
  const cl = pedido.cliente || {};
  const items = (pedido.items || []).map(function(it){
    return '<tr>' +
      '<td style="padding:8px 0;font-size:14px;color:#333">' + (it.cantidad || 1) + '× ' + esc(it.nombre) + '</td>' +
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
    ? (cl.direccion || "") + (cl.comuna ? ", " + cl.comuna : "")
    : "Retiro en local";

  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff">' +
      '<tr><td style="background:' + color + ';padding:28px 24px;text-align:center">' +
        '<h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:.5px">' + esc(nombreTienda) + '</h1>' +
      '</td></tr>' +
      '<tr><td style="padding:24px">' +
        '<p style="font-size:14px;color:#333;margin:0 0 4px">¡Gracias por tu pedido, ' + esc(cl.nombre || "") + '!</p>' +
        '<h2 style="font-size:26px;margin:4px 0 20px;color:#111">#' + esc(pedido.id) + '</h2>' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:8px 0">' +
          items +
        '</table>' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">' +
          '<tr><td style="padding:4px 0;font-size:13px;color:#666">Subtotal</td><td style="padding:4px 0;font-size:13px;color:#666;text-align:right">' + fmtPrecio(pedido.subtotal || pedido.total) + '</td></tr>' +
          descuentoRow +
          deliveryRow +
          '<tr><td style="padding:10px 0 0;font-size:17px;font-weight:bold;color:#111;border-top:1px solid #eee">Total</td><td style="padding:10px 0 0;font-size:17px;font-weight:bold;color:#111;text-align:right;border-top:1px solid #eee">' + fmtPrecio(pedido.total) + '</td></tr>' +
        '</table>' +
        '<p style="font-size:13px;color:#666;margin-top:20px"><strong>Entrega:</strong> ' + esc(direccion) + '</p>' +
        '<p style="font-size:13px;color:#666"><strong>Pago:</strong> ' + (pedido.metodoPago === "mercadopago" ? "MercadoPago" : "Efectivo al entregar") + '</p>' +
        '<p style="font-size:13px;color:#999;margin-top:24px;text-align:center">Te avisaremos cuando tu pedido esté en camino.</p>' +
      '</td></tr>' +
      '<tr><td style="padding:16px 24px;background:#fafafa;text-align:center">' +
        '<p style="font-size:11px;color:#aaa;margin:0">' + esc(nombreTienda) + '</p>' +
      '</td></tr>' +
    '</table>' +
  '</body></html>';
}

export function plantillaVendedor(pedido, nombreTienda, color, urlTienda){
  const cl = pedido.cliente || {};
  const items = resumenItems(pedido.items);
  const urlGestion = (urlTienda || "") + "/pedidos.html";
  const mapsUrl = cl.direccion
    ? "https://maps.google.com/?q=" + encodeURIComponent((cl.direccion || "") + " " + (cl.comuna || "") + " Chile")
    : "";

  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff">' +
      '<tr><td style="background:' + color + ';padding:24px;text-align:center">' +
        '<h1 style="color:#fff;margin:0;font-size:18px">🛍️ Nuevo pedido #' + esc(pedido.id) + '</h1>' +
      '</td></tr>' +
      '<tr><td style="padding:24px">' +
        '<p style="font-size:22px;font-weight:bold;color:#111;margin:0 0 16px">' + fmtPrecio(pedido.total) + '</p>' +
        '<p style="font-size:14px;color:#333;margin:0 0 4px"><strong>' + esc(cl.nombre || "") + '</strong></p>' +
        (cl.telefono ? '<p style="font-size:13px;color:#666;margin:0 0 4px">📞 ' + esc(cl.telefono) + '</p>' : '') +
        (cl.email ? '<p style="font-size:13px;color:#666;margin:0 0 12px">✉️ ' + esc(cl.email) + '</p>' : '') +
        (cl.direccion ? '<p style="font-size:13px;color:#666;margin:0 0 12px">📍 <a href="' + mapsUrl + '" style="color:#1565C0">' + esc(cl.direccion) + (cl.comuna ? ", " + esc(cl.comuna) : "") + '</a></p>' : '<p style="font-size:13px;color:#666;margin:0 0 12px">🏠 Retiro en local</p>') +
        '<p style="font-size:13px;color:#333;margin:16px 0 4px"><strong>Productos:</strong></p>' +
        '<p style="font-size:13px;color:#666;margin:0 0 16px">' + esc(items) + '</p>' +
        (cl.notas ? '<p style="font-size:13px;color:#333;margin:0 0 16px"><strong>Notas:</strong> ' + esc(cl.notas) + '</p>' : '') +
        '<p style="font-size:12px;color:#999;margin:0 0 20px">Pago: ' + (pedido.metodoPago === "mercadopago" ? "MercadoPago" : "Efectivo") + '</p>' +
        '<table cellpadding="0" cellspacing="0"><tr><td style="background:' + color + ';border-radius:10px">' +
          '<a href="' + esc(urlGestion) + '" style="display:block;padding:14px 24px;color:#fff;font-weight:bold;font-size:14px;text-decoration:none">Ver en gestión de pedidos →</a>' +
        '</td></tr></table>' +
      '</td></tr>' +
    '</table>' +
  '</body></html>';
}
