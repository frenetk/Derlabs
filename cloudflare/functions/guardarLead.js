/* cloudflare/functions/guardarLead.js
   Recibe POST del formulario del landing (nombre, whatsapp, rubro, mensaje).
   1) Lo guarda en Firestore, colección "leads" (Admin SDK, no depende de reglas).
   2) Avisa por push a los dispositivos activados desde el gestor /leads.html
      (colección "leads_dispositivos"), separados de los de las tiendas. */
import { getDb } from "./_firebase.js";
import { enviarPushLista } from "./notificar.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const json = (obj, status) => new Response(JSON.stringify(obj),
  { status: status || 200, headers: { "Content-Type": "application/json", ...CORS } });

const RUBROS = { comida:"Comida", retail:"Retail", tecnologia:"Tecnología", ropa:"Ropa", otro:"Otro" };

export async function avisarLead(db, env, lead){
  const snap = await db.collection("leads_dispositivos").get();
  const subs = [];
  snap.docs.forEach(function(d){
    try { const sub = JSON.parse(d.data().subscription || "{}"); if (sub.endpoint) subs.push({ id: d.id, sub }); } catch(e){}
  });
  if (!subs.length) return { enviados: 0, msg: "Sin dispositivos activados en /leads.html" };
  const resultados = await enviarPushLista(subs, {
    title: "📩 Nuevo contacto: " + lead.nombre,
    body: (RUBROS[lead.rubro] || lead.rubro || "Sin rubro") + " · WA " + lead.whatsapp + (lead.mensaje ? " · " + lead.mensaje.slice(0, 80) : ""),
    url: "/leads.html"
  }, env);
  /* Suscripciones vencidas: se borran para no reintentar siempre */
  await Promise.all(resultados.map(function(r, i){
    return String(r).indexOf("expirado") === 0 ? db.doc("leads_dispositivos/" + subs[i].id).delete().catch(function(){}) : null;
  }));
  return { enviados: resultados.filter(function(r){ return r === "ok"; }).length, resultados };
}

export async function guardarLead(request, env){
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method === "GET") return json({ ok:true, msg:"Función activa. Usa POST." });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  let body = {};
  try { body = JSON.parse(await request.text() || "{}"); } catch(e){ body = {}; }

  const nombre   = String(body.nombre   || "").trim().slice(0, 100);
  const whatsapp = String(body.whatsapp || "").trim().slice(0, 30);
  const rubro    = String(body.rubro    || "").trim().slice(0, 50);
  const mensaje  = String(body.mensaje  || "").trim().slice(0, 500);
  if (!nombre || !whatsapp) return json({ ok:false, error:"Nombre y WhatsApp son obligatorios" }, 400);

  const lead = {
    nombre, whatsapp, rubro, mensaje,
    origen: new URL(request.url).hostname || "landing",
    fecha: new Date().toISOString(),
    revisado: false,
    userAgent: (request.headers.get("user-agent") || "").slice(0, 200),
    ip: request.headers.get("cf-connecting-ip") || ""
  };

  let db;
  try {
    db = getDb(env);
    await db.collection("leads").add(lead);
  } catch(e){
    console.error("guardarLead firestore:", e.message);
    return json({ ok:false, error:"No se pudo guardar. Intenta de nuevo." }, 500);
  }

  try { console.log("guardarLead push:", JSON.stringify(await avisarLead(db, env, lead))); }
  catch(e){ console.error("guardarLead push:", e.message); }

  return json({ ok:true, guardado:true });
}
