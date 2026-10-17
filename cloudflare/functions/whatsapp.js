import { getDb, estadoHorario } from "./_firebase.js";
/* cloudflare/functions/whatsapp.js — P62 · WhatsApp (Fase 1)
   Recibe los mensajes de WhatsApp Business (Cloud API de Meta) en /api/whatsapp.

   · GET  /api/whatsapp  → Meta comprueba la dirección (hub.verify_token = WA_VERIFY_TOKEN).
   · POST /api/whatsapp  → llegan los mensajes. Se acepta solo si viene firmado por Meta
     (cabecera X-Hub-Signature-256 = HMAC-SHA256 del cuerpo con WA_APP_SECRET).

   A qué tienda pertenece cada número: waNumeros/{phoneNumberId}.storeId en Firestore;
   para el piloto basta la variable WA_DOMINIO (por ejemplo "derlabs.store"): se busca
   dominios/{WA_DOMINIO}.storeId, igual que hace la web.

   Fase 1: a quien escribe se le contesta con un saludo, el link de la tienda y si está
   abierta (una vez cada 12 horas por persona, para no repetir). Cada conversación queda
   anotada en tiendas/{storeId}/waChats/{numero}. La toma de pedidos por chat llega en la Fase 2.

   Secretos y variables en Cloudflare (Settings → Variables and secrets):
     WA_TOKEN          secreto · token permanente del usuario del sistema de Meta
     WA_APP_SECRET     secreto · "Clave secreta de la app" (App settings → Basic)
     WA_VERIFY_TOKEN   secreto · una frase cualquiera, la misma que se pone en Meta
     WA_DOMINIO        texto   · dominio de la tienda piloto (opcional si existe waNumeros) */

const GRAPH = "https://graph.facebook.com/v21.0/";
/* P63 · Diagnóstico: los últimos 15 avisos que llegaron (sin textos ni números completos) quedan en el KV
   LANDING, clave "wa_diag". Se ven en /api/whatsapp?diag=<WA_VERIFY_TOKEN>. */
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
const CADA_SALUDO_MS = 12 * 3600 * 1000;

function texto(cuerpo, status){
  return new Response(cuerpo, { status: status || 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
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

async function tiendaDeNumero(db, env, phoneId){
  if (phoneId){
    const n = await db.doc("waNumeros/" + phoneId).get();
    if (n.exists && n.data().storeId) return String(n.data().storeId);
  }
  const dom = String(env.WA_DOMINIO || "").trim().toLowerCase();
  if (dom){
    const d = await db.doc("dominios/" + dom).get();
    if (d.exists && d.data().storeId) return String(d.data().storeId);
  }
  return null;
}

export function textoSaludo(cfg, nombreCliente, dominio, fecha){
  const tienda = String(cfg.nombre || "nuestra tienda").trim();
  const quien = String(nombreCliente || "").trim().split(/\s+/)[0];
  const url = dominio ? "https://" + String(dominio).replace(/^https?:\/\//, "").replace(/\/+$/, "") : "";
  const e = estadoHorario(cfg, fecha);
  let estado;
  if (e.abierta) estado = "🟢 Estamos abiertos y recibiendo pedidos.";
  else if (e.manual) estado = "🔴 En este momento estamos cerrados.";
  else estado = "🔴 Ahora estamos cerrados" + (e.abre ? "; abrimos " + e.abre + "." : ".");
  return "¡Hola" + (quien ? " " + quien : "") + "! 👋 Gracias por escribir a *" + tienda + "*.\n\n" +
    (url ? "🛒 Haz tu pedido aquí: " + url + "\n" : "") + estado;
}

async function enviar(env, phoneId, cuerpo){
  if (!env.WA_TOKEN) throw new Error("Falta el secreto WA_TOKEN en Cloudflare");
  const r = await fetch(GRAPH + phoneId + "/messages", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.WA_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ messaging_product: "whatsapp" }, cuerpo))
  });
  if (!r.ok){
    let det = ""; try { det = JSON.stringify((await r.json()).error || {}); } catch(e){}
    throw new Error("Meta respondió " + r.status + " " + det.slice(0, 300));
  }
  return r.json();
}

async function procesarMensaje(db, env, phoneId, msg, contacto, ahora){
  const storeId = await tiendaDeNumero(db, env, phoneId);
  if (!storeId){ console.warn("whatsapp: número sin tienda", phoneId); return { ok: false, motivo: "sin-tienda" }; }
  const waId = String(msg.from || "").replace(/\D/g, "");
  if (!waId) return { ok: false, motivo: "sin-remitente" };
  const ref = db.doc("tiendas/" + storeId + "/waChats/" + waId);
  const prev = await ref.get(), chat = prev.exists ? prev.data() : {};
  /* Meta reintenta si no contestamos rápido: el mismo mensaje no se procesa dos veces */
  if (msg.id && chat.ultimoId === msg.id) return { ok: true, repetido: true };
  const nombre = contacto && contacto.profile && contacto.profile.name ? String(contacto.profile.name).slice(0, 80) : (chat.nombre || "");
  const txt = msg.type === "text" && msg.text ? String(msg.text.body || "").slice(0, 1000) : "[" + String(msg.type || "mensaje") + "]";
  const datos = { nombre, ultimoId: msg.id || "", ultimoTexto: txt, ultimoEn: new Date(ahora).toISOString(), mensajes: (Number(chat.mensajes) || 0) + 1 };
  let saludo = false;
  if (!chat.saludoEn || ahora - Date.parse(chat.saludoEn) > CADA_SALUDO_MS){
    const g = await db.doc("tiendas/" + storeId + "/config/general").get();
    const cfg = g.exists ? g.data() : {};
    const dominio = cfg.dominioPrincipal || String(env.WA_DOMINIO || "");
    try { await enviar(env, phoneId, { status: "read", message_id: msg.id }); } catch(e){ /* el visto es opcional */ }
    await enviar(env, phoneId, { to: waId, type: "text", text: { preview_url: true, body: textoSaludo(cfg, nombre, dominio, new Date(ahora)) } });
    datos.saludoEn = new Date(ahora).toISOString();
    saludo = true;
  }
  await ref.set(datos, { merge: true });
  return { ok: true, storeId, saludo };
}

export async function whatsapp(request, env, ahora){
  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.has("diag")){
    if (!env.WA_VERIFY_TOKEN || !igualSeguro(url.searchParams.get("diag"), env.WA_VERIFY_TOKEN)) return texto("Prohibido", 403);
    let lista = []; try { lista = JSON.parse((env.LANDING && await env.LANDING.get("wa_diag")) || "[]"); } catch(e){}
    const conf = { WA_TOKEN: !!env.WA_TOKEN, WA_APP_SECRET: !!env.WA_APP_SECRET, WA_VERIFY_TOKEN: !!env.WA_VERIFY_TOKEN, WA_DOMINIO: String(env.WA_DOMINIO || ""), FIREBASE: !!env.FIREBASE_SERVICE_ACCOUNT, KV: !!env.LANDING };
    return new Response(JSON.stringify({ configuracion: conf, ultimosAvisos: lista.length ? lista : "Todavía no llega ningún aviso de Meta" }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  if (request.method === "GET"){
    const modo = url.searchParams.get("hub.mode"), tk = url.searchParams.get("hub.verify_token"), reto = url.searchParams.get("hub.challenge");
    if (modo === "subscribe" && env.WA_VERIFY_TOKEN && igualSeguro(tk, env.WA_VERIFY_TOKEN) && reto) return texto(reto);
    return texto("Prohibido", 403);
  }
  if (request.method !== "POST") return texto("Método no permitido", 405);
  const cuerpo = await request.text();
  if (!(await firmaValida(cuerpo, request.headers.get("x-hub-signature-256"), env.WA_APP_SECRET))){
    await anotar(env, { resultado: "firma inválida (revisa WA_APP_SECRET)", conFirma: !!request.headers.get("x-hub-signature-256") });
    return texto("Firma inválida", 401);
  }
  let j; try { j = JSON.parse(cuerpo); } catch(e){ return texto("JSON inválido", 400); }
  const db = getDb(env), res = [];
  for (const entrada of (j.entry || [])){
    for (const cambio of (entrada.changes || [])){
      const v = cambio.value || {};
      const phoneId = v.metadata && v.metadata.phone_number_id;
      const contactos = v.contacts || [];
      for (const m of (v.messages || [])){
        try { res.push(await procesarMensaje(db, env, phoneId, m, contactos.find(c => c.wa_id === m.from) || contactos[0], ahora || Date.now())); }
        catch(e){ console.error("whatsapp:", e.message); res.push({ ok: false, error: e.message }); }
      }
    }
  }
  const cambios = (j.entry || []).reduce((n, e) => n + ((e.changes || []).length), 0);
  const tipos = [].concat.apply([], (j.entry || []).map(e => (e.changes || []).map(c => c.field + (c.value && c.value.statuses ? ":estado" : "") + (c.value && c.value.messages ? ":mensaje" : ""))));
  await anotar(env, { resultado: res.length ? res.map(x => x.error ? "error: " + x.error : x.motivo ? x.motivo : x.repetido ? "repetido" : x.saludo ? "saludo enviado" : "anotado (sin saludo)").join(" | ") : "aviso sin mensajes", campos: tipos.join(","), cambios,
    de: [].concat.apply([], (j.entry || []).map(e => (e.changes || []).map(c => ((c.value && c.value.messages) || []).map(m => tapar(m.from)).join(",")))).filter(Boolean).join(",") });
  /* a Meta siempre se le contesta 200: si no, reintenta el mismo aviso por horas */
  return new Response(JSON.stringify({ ok: true, n: res.length, res }), { headers: { "Content-Type": "application/json" } });
}
