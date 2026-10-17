import { getDb, estadoHorario, uidDesdeToken } from "./_firebase.js";
import { atender, limpiarTextoDueno, tonoDe } from "./_waBot.js";
import { notificar } from "./notificar.js";
/* cloudflare/functions/whatsapp.js — WhatsApp de DerLabs (P62 · P63 · P64 · P65 · P66)
   P66: con la tienda abierta y "tomar pedidos" encendido (config.waPedidos, por defecto sí),
   el asistente conversa y arma el pedido (ver _waBot.js); cerrada o apagado, solo saluda.

   Una sola dirección, /api/whatsapp, para todo:
   · GET  ?hub.mode=subscribe…   Meta comprueba la dirección (hub.verify_token = WA_VERIFY_TOKEN).
   · GET  ?diag=<WA_VERIFY_TOKEN> diagnóstico: secretos presentes, prueba del token y últimos avisos.
   · POST (firmado por Meta)      llegan los mensajes (cabecera X-Hub-Signature-256, HMAC con WA_APP_SECRET).
   · POST ?op=tienda              el dueño desde su panel (sesión de Firebase): ver su estado, pedir conexión.
   · POST ?op=admin               DerLabs (cabecera X-Admin-Secret = ADMIN_SECRET): conectar, pausar,
                                  dar de baja, cambiar límites y ver el uso de todos los números.

   Datos (Firestore, solo los lee y escribe el servidor):
   · waNumeros/{phoneNumberId}   { storeId, numero, estado: activo|pausado|baja, limiteMes,
                                   uso: { mes, recibidos, enviados, bloqueados, pedidos }, calidad, ultimoError }
   · waSolicitudes/{storeId}     el dueño pidió conectar su número (desde el panel)
   · tiendas/{storeId}/waChats/{numero}   cada conversación
   · tiendas/{storeId}/config/general     waActivo, waPedidos (interruptores), waTono, waFrase, waInfo (P67)

   Protecciones para que un cliente no afecte a los demás ni genere costos:
   · tope de respuestas automáticas al mes por número (limiteMes, 2.000 por defecto; DerLabs lo cambia)
   · tope por persona: 12 respuestas por hora (corta conversaciones en bucle con otros bots)
   · si Meta bloquea un número por política, ese número se pausa solo y queda el aviso
   · la calidad del número que informa Meta (verde / amarilla / roja) queda a la vista de DerLabs

   Secretos en Cloudflare: WA_TOKEN, WA_APP_SECRET, WA_VERIFY_TOKEN, ADMIN_SECRET; WA_DOMINIO (piloto). */

const GRAPH = "https://graph.facebook.com/v21.0/";
const CADA_SALUDO_MS = 12 * 3600 * 1000;
export const LIMITE_MES_DEF = 2000;
const MAX_POR_CLIENTE_HORA = 12;
const MAX_CONV_HORA = 40;   /* P66: tomando pedidos, una conversación tiene más idas y vueltas */
const ERR_BLOQUEO = [368, 131031];                    /* Meta bloqueó el número o la cuenta: se pausa solo */
const ERR_LIMITE = [130429, 131048, 131056, 80007];   /* Meta frenó por volumen o spam */

/* ── Diagnóstico: últimos 15 avisos en el KV LANDING (clave wa_diag), sin textos ni números completos ── */
const DIAG_MAX = 15;
async function anotar(env, item){
  try {
    if (!env.LANDING) return;
    let lista = []; try { lista = JSON.parse((await env.LANDING.get("wa_diag")) || "[]"); } catch(e){ lista = []; }
    lista.unshift(Object.assign({ en: new Date().toISOString() }, item));
    await env.LANDING.put("wa_diag", JSON.stringify(lista.slice(0, DIAG_MAX)));
  } catch(e){ console.error("wa diag:", e.message); }
}
const tapar = n => { n = String(n || ""); return n.length > 4 ? n.slice(0, 4) + "•••" + n.slice(-2) : n; };
const digitos = s => String(s || "").replace(/\D/g, "");
const idOk = s => { s = String(s || "").trim(); return /^[A-Za-z0-9_-]{1,80}$/.test(s) ? s : ""; };
const mesDe = t => new Date(t).toISOString().slice(0, 7);

function texto(cuerpo, status){
  return new Response(cuerpo, { status: status || 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
function json(obj, status){
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

/* comparación en tiempo constante (no revela cuántas letras coinciden) */
function igualSeguro(a, b){
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function firmaValida(cuerpo, cabecera, secreto){
  if (!secreto || !cabecera || !/^sha256=[0-9a-f]{64}$/i.test(cabecera)) return false;
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(cuerpo)));
  const hex = Array.from(firma).map(b => b.toString(16).padStart(2, "0")).join("");
  return igualSeguro(hex, cabecera.slice(7).toLowerCase());
}

/* el token tal como se pegó en Cloudflare puede traer espacios, saltos de línea, comillas o "Bearer " delante */
export function limpiarToken(t){
  return String(t || "").replace(/^\s*["']?\s*(Bearer\s+)?/i, "").replace(/["']?\s*$/, "").replace(/\s+/g, "");
}

/* ── Mensaje de bienvenida (P67): lo arma el sistema; el dueño solo elige el tono
   (config.waTono: cercano | formal | alegre) y una frase corta (config.waFrase, sin links ni
   teléfonos). El link, el horario y el formato los pone siempre el sistema. ── */
export const SALUDOS = {
  cercano: { hola: "¡Hola {cliente}! 👋 Gracias por escribir a *{tienda}*.", pedir: "🛒 Haz tu pedido aquí: {link}" },
  formal:  { hola: "Hola {cliente}, gracias por comunicarse con *{tienda}*.", pedir: "Puede hacer su pedido aquí: {link}" },
  alegre:  { hola: "¡Holaa {cliente}! 🙌 Qué bueno que escribes a *{tienda}*.", pedir: "🍽️ Pide aquí en un toque: {link}" }
};
export function textoSaludo(cfg, nombreCliente, dominio, fecha){
  cfg = cfg || {};
  const tienda = String(cfg.nombre || "nuestra tienda").trim();
  const quien = String(nombreCliente || "").trim().split(/\s+/)[0] || "";
  const url = dominio ? "https://" + String(dominio).replace(/^https?:\/\//, "").replace(/\/+$/, "") : "";
  const e = estadoHorario(cfg, fecha);
  let estado;
  if (e.abierta) estado = "🟢 Estamos abiertos y recibiendo pedidos.";
  else if (e.manual) estado = "🔴 En este momento estamos cerrados.";
  else estado = "🔴 Ahora estamos cerrados" + (e.abre ? "; abrimos " + e.abre + "." : ".");
  const t = SALUDOS[tonoDe(cfg)];
  const frase = limpiarTextoDueno(cfg.waFrase, 120, true);
  return (t.hola + (frase ? "\n" + frase : "") + (url ? "\n\n" + t.pedir : "") + "\n" + estado)
    .replace(/\{cliente\}/g, quien).replace(/\{tienda\}/g, tienda).replace(/\{link\}/g, url)
    .replace(/[ \t]+([!?,.])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
}
/* para la vista previa del panel */
export const SALUDO_DEF = SALUDOS.cercano.hola + "\n\n" + SALUDOS.cercano.pedir + "\n{estado}";

async function enviar(env, phoneId, cuerpo){
  const token = limpiarToken(env.WA_TOKEN);
  if (!token){ const e = new Error("Falta el secreto WA_TOKEN en Cloudflare"); e.codigo = 0; throw e; }
  const r = await fetch(GRAPH + phoneId + "/messages", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ messaging_product: "whatsapp" }, cuerpo))
  });
  if (!r.ok){
    let er = {}; try { er = (await r.json()).error || {}; } catch(e){}
    const e = new Error("Meta respondió " + r.status + " " + JSON.stringify(er).slice(0, 300));
    e.codigo = Number(er.code) || 0; e.status = r.status;
    throw e;
  }
  return r.json();
}

/* A qué tienda pertenece un número. Si no está en waNumeros y existe WA_DOMINIO (piloto), se anota solo. */
async function numeroDe(db, env, phoneId, display){
  const ref = db.doc("waNumeros/" + phoneId);
  const n = await ref.get();
  if (n.exists && n.data().storeId) return { ref, d: n.data() };
  const dom = String(env.WA_DOMINIO || "").trim().toLowerCase();
  if (!dom) return null;
  const dd = await db.doc("dominios/" + dom).get();
  if (!dd.exists || !dd.data().storeId) return null;
  const d = { storeId: String(dd.data().storeId), numero: display ? "+" + digitos(display) : "", numeroDigitos: digitos(display), estado: "activo", limiteMes: LIMITE_MES_DEF, origen: "piloto (WA_DOMINIO)", vinculadoEn: new Date().toISOString() };
  await ref.set(d, { merge: true });
  return { ref, d };
}

async function procesarMensaje(db, env, phoneId, display, msg, contacto, ahora){
  const num = await numeroDe(db, env, phoneId, display);
  if (!num){ console.warn("whatsapp: número sin tienda", phoneId); return { ok: false, motivo: "número sin tienda" }; }
  const storeId = num.d.storeId, estadoNum = num.d.estado || "activo";
  if (estadoNum === "baja") return { ok: true, storeId, motivo: "número dado de baja" };
  const waId = digitos(msg.from);
  if (!waId) return { ok: false, motivo: "sin remitente" };
  const ref = db.doc("tiendas/" + storeId + "/waChats/" + waId);
  const prev = await ref.get(), chat = prev.exists ? prev.data() : {};
  /* Meta reintenta si no contestamos rápido: el mismo mensaje no se procesa dos veces */
  if (msg.id && chat.ultimoId === msg.id) return { ok: true, repetido: true };

  const mes = mesDe(ahora);
  const uso = num.d.uso && num.d.uso.mes === mes ? Object.assign({}, num.d.uso) : { mes, recibidos: 0, enviados: 0, bloqueados: 0 };
  uso.recibidos = (Number(uso.recibidos) || 0) + 1;
  const cambiosNum = { uso, ultimoMensajeEn: new Date(ahora).toISOString() };
  if (display && !num.d.numero){ cambiosNum.numero = "+" + digitos(display); cambiosNum.numeroDigitos = digitos(display); }

  const nombre = contacto && contacto.profile && contacto.profile.name ? String(contacto.profile.name).slice(0, 80) : (chat.nombre || "");
  /* lo que escribió o tocó el cliente */
  const entrada = { tipo: msg.type || "" };
  if (msg.type === "text" && msg.text) entrada.texto = String(msg.text.body || "").slice(0, 1000);
  else if (msg.type === "interactive" && msg.interactive){ const rp = msg.interactive.button_reply || msg.interactive.list_reply || {}; entrada.id = String(rp.id || "").slice(0, 256); entrada.texto = String(rp.title || "").slice(0, 100); }
  else if (msg.type === "button" && msg.button) entrada.texto = String(msg.button.text || "").slice(0, 200);
  const txt = entrada.texto || "[" + String(msg.type || "mensaje") + "]";
  const datos = { nombre, ultimoId: msg.id || "", ultimoTexto: txt, ultimoEn: new Date(ahora).toISOString(), mensajes: (Number(chat.mensajes) || 0) + 1 };

  let motivo = "", saludo = false, error = "", respuestas = 0, pedidoId = "";
  const g = await db.doc("tiendas/" + storeId + "/config/general").get();
  const cfg = g.exists ? g.data() : {};
  const hora = chat.hora && ahora - Date.parse(chat.hora.inicio) < 3600e3 ? Object.assign({}, chat.hora) : { inicio: new Date(ahora).toISOString(), n: 0 };
  const toca = !chat.saludoEn || ahora - Date.parse(chat.saludoEn) > CADA_SALUDO_MS;
  const limite = Number(num.d.limiteMes) > 0 ? Number(num.d.limiteMes) : LIMITE_MES_DEF;
  /* P66: con "tomar pedidos" encendido (por defecto) y la tienda abierta, el bot conversa */
  const pedidos = cfg.waPedidos !== false && estadoHorario(cfg, new Date(ahora)).abierta;
  const humano = chat.humanoHasta && ahora < Date.parse(chat.humanoHasta);

  if (estadoNum === "pausado") motivo = "pausado por DerLabs";
  else if (cfg.waActivo === false) motivo = "bot apagado por la tienda";
  else if (humano) motivo = "lo atiende una persona";
  else if (!pedidos && !toca) motivo = "ya saludado (menos de 12 h)";
  else if ((Number(uso.enviados) || 0) >= limite){ motivo = "límite mensual alcanzado"; uso.bloqueados = (Number(uso.bloqueados) || 0) + 1; }
  else if (hora.n >= (pedidos ? MAX_CONV_HORA : MAX_POR_CLIENTE_HORA)) motivo = "límite por cliente (" + (pedidos ? MAX_CONV_HORA : MAX_POR_CLIENTE_HORA) + " por hora)";
  else {
    const dominio = cfg.dominioPrincipal || String(env.WA_DOMINIO || "");
    const textoBienvenida = textoSaludo(cfg, nombre, dominio, new Date(ahora));
    try {
      try { await enviar(env, phoneId, { status: "read", message_id: msg.id }); } catch(e){ /* el visto es opcional */ }
      let salida;
      if (pedidos){
        const origin = "https://" + String(dominio || "derlabs.cl").replace(/^https?:\/\//, "").replace(/\/+$/, "");
        let conv0 = null; try { conv0 = chat.conv ? JSON.parse(chat.conv) : null; } catch(e){}
        const r = await atender({ db, env, storeId, cfg: Object.assign({ dominioPrincipal: dominio }, cfg), chat: { conv: conv0 }, entrada, nombre, waId, ahora, saludo: textoBienvenida, origin });
        salida = r.salida;
        /* se guarda como texto para reemplazarla entera (con merge, Firestore mezclaría los campos viejos) */
        datos.conv = r.conv ? JSON.stringify(r.conv) : null;
        if (r.pedidoId){ pedidoId = r.pedidoId; datos.ultimoPedido = { id: r.pedidoId, en: new Date(ahora).toISOString() }; datos.pedidos = (Number(chat.pedidos) || 0) + 1; }
        if (r.humanoHasta){
          datos.humanoHasta = r.humanoHasta; datos.conv = null;
          try { await notificar(new Request(origin + "/api/notificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }), env,
            { storeId, titulo: "🙋 Un cliente quiere hablar por WhatsApp", texto: (nombre || "Cliente") + " (+" + waId + ") pidió hablar con alguien. Respóndele desde tu WhatsApp Business.", url: "/pedidos.html" }); } catch(e){ console.warn("push humano:", e.message); }
        }
      } else salida = [{ type: "text", text: { preview_url: true, body: textoBienvenida } }];
      for (const m of salida){
        if ((Number(uso.enviados) || 0) >= limite) break;
        await enviar(env, phoneId, Object.assign({ to: waId }, m));
        uso.enviados = (Number(uso.enviados) || 0) + 1; respuestas++;
        if (uso.enviados === Math.ceil(limite * 0.8)) cambiosNum.alerta = { tipo: "80% del límite mensual", en: new Date(ahora).toISOString() };
      }
      if (!pedidos || !chat.saludoEn || toca) datos.saludoEn = new Date(ahora).toISOString();
      hora.n += 1; saludo = respuestas > 0;
    } catch(e){
      error = e.message;
      cambiosNum.ultimoError = { en: new Date(ahora).toISOString(), codigo: e.codigo || 0, texto: String(e.message).slice(0, 300) };
      if (ERR_BLOQUEO.includes(e.codigo)){ cambiosNum.estado = "pausado"; cambiosNum.motivoPausa = "Meta bloqueó el número (código " + e.codigo + ")"; }
      else if (ERR_LIMITE.includes(e.codigo)) cambiosNum.alerta = { tipo: "Meta frenó los envíos (código " + e.codigo + ")", en: new Date(ahora).toISOString() };
    }
  }
  if (pedidoId){ uso.pedidos = (Number(uso.pedidos) || 0) + 1; }
  datos.hora = hora;
  await ref.set(datos, { merge: true });
  await num.ref.set(cambiosNum, { merge: true });
  if (error) return { ok: false, storeId, error };
  return { ok: true, storeId, saludo, respuestas, motivo, pedidoId };
}

/* Meta avisa cuando cambia la calidad de un número (verde, amarilla, roja) o su límite de envíos */
async function calidadNumero(db, v, ahora){
  const dig = digitos(v.display_phone_number);
  if (!dig) return;
  const q = await db.collection("waNumeros").where("numeroDigitos", "==", dig).get();
  for (const d of q.docs) await d.ref.set({ calidad: { evento: String(v.event || ""), limite: String(v.current_limit || ""), en: new Date(ahora).toISOString() } }, { merge: true });
}

/* ── Panel del dueño ── */
async function apiTienda(request, env, b){
  const storeId = idOk(b.storeId);
  if (!storeId) return json({ ok: false, error: "Falta la tienda" }, 400);
  const db = getDb(env);
  const uid = await uidDesdeToken(request, env);
  if (!uid) return json({ ok: false, error: "Sesión vencida — vuelve a entrar" }, 401);
  const u = await db.doc("usuarios/" + uid).get();
  const rol = u.exists && u.data().roles ? u.data().roles[storeId] : null;
  if (!rol || rol === "repartidor") return json({ ok: false, error: "Sin permiso para esta tienda" }, 403);
  if (b.accion === "solicitar"){
    const numero = digitos(b.numero);
    if (numero.length < 8 || numero.length > 15) return json({ ok: false, error: "Escribe el número con código de país, por ejemplo +56 9 1234 5678" }, 400);
    const g = await db.doc("tiendas/" + storeId + "/config/general").get();
    await db.doc("waSolicitudes/" + storeId).set({ storeId, numero: "+" + numero, tienda: g.exists ? String(g.data().nombre || "") : "", en: new Date().toISOString(), uid });
    return json({ ok: true });
  }
  if (b.accion === "cancelarSolicitud"){ await db.doc("waSolicitudes/" + storeId).delete(); return json({ ok: true }); }
  /* estado */
  const q = await db.collection("waNumeros").where("storeId", "==", storeId).get();
  const nums = q.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(d => d.estado !== "baja");
  const n = nums[0] || null, s = await db.doc("waSolicitudes/" + storeId).get();
  const mes = mesDe(Date.now());
  return json({ ok: true,
    conectado: !!n, numero: n ? n.numero || "" : "", estado: n ? n.estado || "activo" : "", motivoPausa: n ? n.motivoPausa || "" : "",
    uso: n && n.uso && n.uso.mes === mes ? { enviados: n.uso.enviados || 0, recibidos: n.uso.recibidos || 0, pedidos: n.uso.pedidos || 0 } : { enviados: 0, recibidos: 0, pedidos: 0 },
    limite: n ? (Number(n.limiteMes) || LIMITE_MES_DEF) : LIMITE_MES_DEF,
    solicitud: s.exists ? { numero: s.data().numero, en: s.data().en } : null,
    saludoBase: SALUDO_DEF });
}

/* ── Administración de DerLabs ── */
async function apiAdmin(request, env, b){
  if (!env.ADMIN_SECRET || !igualSeguro(request.headers.get("x-admin-secret"), env.ADMIN_SECRET)) return json({ ok: false, error: "Clave incorrecta" }, 401);
  const db = getDb(env), ahora = new Date().toISOString(), mes = mesDe(Date.now());
  const phoneId = digitos(b.phoneId);
  if (b.accion === "listar"){
    const [qn, qs] = await Promise.all([db.collection("waNumeros").get(), db.collection("waSolicitudes").get()]);
    const nombres = {};
    const nombreDe = async id => { if (!(id in nombres)){ const g = await db.doc("tiendas/" + id + "/config/general").get(); nombres[id] = g.exists ? String(g.data().nombre || id) : "(tienda borrada)"; } return nombres[id]; };
    const numeros = [];
    for (const d of qn.docs){
      const x = d.data(), uso = x.uso && x.uso.mes === mes ? x.uso : { enviados: 0, recibidos: 0, bloqueados: 0 };
      numeros.push({ phoneId: d.id, storeId: x.storeId || "", tienda: x.storeId ? await nombreDe(x.storeId) : "", numero: x.numero || "", estado: x.estado || "activo", motivoPausa: x.motivoPausa || "",
        limiteMes: Number(x.limiteMes) || LIMITE_MES_DEF, uso, calidad: x.calidad || null, alerta: x.alerta || null, ultimoError: x.ultimoError || null, ultimoMensajeEn: x.ultimoMensajeEn || "", origen: x.origen || "" });
    }
    numeros.sort((a, b2) => (b2.uso.enviados || 0) - (a.uso.enviados || 0));
    return json({ ok: true, mes, numeros, solicitudes: qs.docs.map(d => d.data()) });
  }
  if (b.accion === "vincular"){
    const storeId = idOk(b.storeId), numero = digitos(b.numero);
    if (!phoneId || !storeId) return json({ ok: false, error: "Faltan el ID del número y la tienda" }, 400);
    const g = await db.doc("tiendas/" + storeId + "/config/general").get();
    if (!g.exists) return json({ ok: false, error: "No existe la tienda «" + storeId + "»" }, 404);
    const prev = await db.doc("waNumeros/" + phoneId).get();
    if (prev.exists && prev.data().storeId && prev.data().storeId !== storeId && prev.data().estado !== "baja" && !b.forzar)
      return json({ ok: false, error: "Ese número ya está conectado a otra tienda (" + prev.data().storeId + "). Dalo de baja primero." }, 409);
    await db.doc("waNumeros/" + phoneId).set({ storeId, numero: numero ? "+" + numero : (prev.exists ? prev.data().numero || "" : ""), numeroDigitos: numero || (prev.exists ? prev.data().numeroDigitos || "" : ""),
      estado: "activo", motivoPausa: "", limiteMes: Number(b.limiteMes) > 0 ? Math.min(Number(b.limiteMes), 100000) : LIMITE_MES_DEF, vinculadoEn: ahora, origen: "admin" }, { merge: true });
    await db.doc("waSolicitudes/" + storeId).delete();
    return json({ ok: true });
  }
  if (!phoneId && b.accion !== "bajaTienda" && b.accion !== "borrarSolicitud") return json({ ok: false, error: "Falta el ID del número" }, 400);
  if (b.accion === "estado"){
    const est = ["activo", "pausado", "baja"].includes(b.estado) ? b.estado : "";
    if (!est) return json({ ok: false, error: "Estado no válido" }, 400);
    const ref = db.doc("waNumeros/" + phoneId); if (!(await ref.get()).exists) return json({ ok: false, error: "No existe ese número" }, 404);
    await ref.set({ estado: est, motivoPausa: est === "pausado" ? String(b.motivo || "Pausado por DerLabs").slice(0, 120) : "", cambioEstadoEn: ahora }, { merge: true });
    return json({ ok: true });
  }
  if (b.accion === "limite"){
    const lim = Math.round(Number(b.limiteMes));
    if (!(lim > 0 && lim <= 100000)) return json({ ok: false, error: "Límite entre 1 y 100.000" }, 400);
    const ref = db.doc("waNumeros/" + phoneId); if (!(await ref.get()).exists) return json({ ok: false, error: "No existe ese número" }, 404);
    await ref.set({ limiteMes: lim, alerta: null }, { merge: true });
    return json({ ok: true });
  }
  if (b.accion === "bajaTienda"){
    const storeId = idOk(b.storeId); if (!storeId) return json({ ok: false, error: "Falta la tienda" }, 400);
    const q = await db.collection("waNumeros").where("storeId", "==", storeId).get();
    for (const d of q.docs) await d.ref.set({ estado: "baja", cambioEstadoEn: ahora }, { merge: true });
    await db.doc("waSolicitudes/" + storeId).delete();
    return json({ ok: true, numeros: q.docs.length });
  }
  if (b.accion === "borrarSolicitud"){ const storeId = idOk(b.storeId); if (storeId) await db.doc("waSolicitudes/" + storeId).delete(); return json({ ok: true }); }
  return json({ ok: false, error: "Acción desconocida" }, 400);
}

export async function whatsapp(request, env, ahora){
  const url = new URL(request.url);
  const op = url.searchParams.get("op");
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" } });

  if (request.method === "GET" && url.searchParams.has("diag")){
    if (!env.WA_VERIFY_TOKEN || !igualSeguro(url.searchParams.get("diag"), env.WA_VERIFY_TOKEN)) return texto("Prohibido", 403);
    let lista = []; try { lista = JSON.parse((env.LANDING && await env.LANDING.get("wa_diag")) || "[]"); } catch(e){}
    const crudo = String(env.WA_TOKEN || ""), tk = limpiarToken(crudo);
    let prueba = "sin token";
    if (tk){
      try {
        const r = await fetch(GRAPH + "me?fields=id,name", { headers: { "Authorization": "Bearer " + tk } });
        const jj = await r.json().catch(() => ({}));
        prueba = r.ok ? "token válido (" + (jj.name || jj.id || "ok") + ")" : "Meta rechaza el token: " + ((jj.error && jj.error.message) || r.status);
      } catch(e){ prueba = "no se pudo probar: " + e.message; }
    }
    /* P67: prueba la clave de Gemini con una pregunta mínima */
    let gemini = "sin GEMINI_API_KEY (el bot usa el buscador simple)";
    if (String(env.GEMINI_API_KEY || "").trim()){
      try {
        const mo = String(env.GEMINI_MODEL || "gemini-2.5-flash").trim();
        const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(mo) + ":generateContent", { method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": String(env.GEMINI_API_KEY).trim() },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Responde solo: ok" }] }], generationConfig: { maxOutputTokens: 5, thinkingConfig: { thinkingBudget: 0 } } }) });
        const jj = await r.json().catch(() => ({}));
        gemini = r.ok ? "Gemini responde (" + mo + ")" : "Gemini rechaza la clave: " + ((jj.error && jj.error.message) || r.status);
      } catch(e){ gemini = "no se pudo probar Gemini: " + e.message; }
    }
    const conf = { pruebaGemini: gemini, WA_TOKEN: !!env.WA_TOKEN, tokenLargo: tk.length, tokenEmpieza: tk.slice(0, 4), tokenTraiaEspacios: crudo !== tk, pruebaToken: prueba,
      WA_APP_SECRET: !!env.WA_APP_SECRET, WA_VERIFY_TOKEN: !!env.WA_VERIFY_TOKEN, ADMIN_SECRET: !!env.ADMIN_SECRET, WA_DOMINIO: String(env.WA_DOMINIO || ""), FIREBASE: !!env.FIREBASE_SERVICE_ACCOUNT, KV: !!env.LANDING };
    return new Response(JSON.stringify({ configuracion: conf, ultimosAvisos: lista.length ? lista : "Todavía no llega ningún aviso de Meta" }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  if (request.method === "GET"){
    const modo = url.searchParams.get("hub.mode"), tk = url.searchParams.get("hub.verify_token"), reto = url.searchParams.get("hub.challenge");
    if (modo === "subscribe" && env.WA_VERIFY_TOKEN && igualSeguro(tk, env.WA_VERIFY_TOKEN) && reto) return texto(reto);
    return texto("Prohibido", 403);
  }
  if (request.method !== "POST") return texto("Método no permitido", 405);

  if (op === "tienda" || op === "admin"){
    let b = {}; try { b = JSON.parse(await request.text() || "{}"); } catch(e){ return json({ ok: false, error: "Datos inválidos" }, 400); }
    try { return op === "tienda" ? await apiTienda(request, env, b) : await apiAdmin(request, env, b); }
    catch(e){ console.error("whatsapp " + op + ":", e.message); return json({ ok: false, error: "Error del servidor: " + e.message }, 500); }
  }

  const cuerpo = await request.text();
  if (!(await firmaValida(cuerpo, request.headers.get("x-hub-signature-256"), env.WA_APP_SECRET))){
    await anotar(env, { resultado: "firma inválida (revisa WA_APP_SECRET)", conFirma: !!request.headers.get("x-hub-signature-256") });
    return texto("Firma inválida", 401);
  }
  let j; try { j = JSON.parse(cuerpo); } catch(e){ return texto("JSON inválido", 400); }
  const db = getDb(env), res = [], t = ahora || Date.now();
  for (const entrada of (j.entry || [])){
    for (const cambio of (entrada.changes || [])){
      const v = cambio.value || {};
      if (cambio.field === "phone_number_quality_update"){ try { await calidadNumero(db, v, t); res.push({ ok: true, motivo: "calidad " + (v.event || "") }); } catch(e){ res.push({ ok: false, error: e.message }); } continue; }
      const phoneId = v.metadata && v.metadata.phone_number_id, display = v.metadata && v.metadata.display_phone_number;
      const contactos = v.contacts || [];
      for (const m of (v.messages || [])){
        try { res.push(await procesarMensaje(db, env, phoneId, display, m, contactos.find(c => c.wa_id === m.from) || contactos[0], t)); }
        catch(e){ console.error("whatsapp:", e.message); res.push({ ok: false, error: e.message }); }
      }
    }
  }
  const tipos = [].concat.apply([], (j.entry || []).map(e => (e.changes || []).map(c => c.field + (c.value && c.value.statuses ? ":estado" : "") + (c.value && c.value.messages ? ":mensaje" : ""))));
  await anotar(env, { resultado: res.length ? res.map(x => x.error ? "error: " + x.error : x.pedidoId ? "pedido " + x.pedidoId : x.respuestas > 1 ? x.respuestas + " respuestas" : x.saludo ? "saludo enviado" : x.repetido ? "repetido" : (x.motivo || "anotado")).join(" | ") : "aviso sin mensajes", campos: tipos.join(","),
    de: [].concat.apply([], (j.entry || []).map(e => (e.changes || []).map(c => ((c.value && c.value.messages) || []).map(m => tapar(m.from)).join(",")))).filter(Boolean).join(",") });
  /* a Meta siempre se le contesta 200: si no, reintenta el mismo aviso por horas */
  return json({ ok: true, n: res.length, res });
}
