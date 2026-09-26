/* cloudflare/functions/guardarLead.js
   Recibe POST del formulario del landing (nombre, whatsapp, rubro, mensaje).
   Guarda en Firestore en la colección "leads" y dispara un push al celular
   del dueño reusando notificar() — sin duplicar la lógica de cifrado. */
import { getDb } from "./_firebase.js";
import { notificar } from "./notificar.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function guardarLead(request, env){
  if (request.method === "OPTIONS"){
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method === "GET"){
    return new Response(JSON.stringify({ ok:true, msg:"Función activa. Usa POST." }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
  }
  if (request.method !== "POST"){
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  let body = {};
  try { body = JSON.parse(await request.text() || "{}"); } catch(e){ body = {}; }

  const nombre   = String(body.nombre   || "").trim().slice(0, 100);
  const whatsapp = String(body.whatsapp || "").trim().slice(0, 30);
  const rubro    = String(body.rubro    || "").trim().slice(0, 50);
  const mensaje  = String(body.mensaje  || "").trim().slice(0, 500);

  if (!nombre || !whatsapp){
    return new Response(JSON.stringify({ ok:false, error:"Nombre y WhatsApp son obligatorios" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
  }

  const lead = {
    nombre, whatsapp, rubro, mensaje,
    origen: "landing.derlabs.cl",
    fecha: new Date().toISOString(),
    userAgent: request.headers.get("user-agent") || "",
    ip: request.headers.get("cf-connecting-ip") || ""
  };

  // 1) Guardar en Firestore (no bloquea el push si falla)
  try {
    const db = getDb(env);
    await db.collection("leads").add(lead);
  } catch(e){
    console.error("guardarLead firestore:", e.message);
  }

  // 2) Push al celular — reusa notificar() con título custom
  try {
    const resumenLead = nombre + " · " + (rubro || "sin rubro") + " · WA " + whatsapp
                      + (mensaje ? " · " + mensaje.slice(0, 80) : "");
    const notifBody = {
      storeId: "test-burgers",
      titulo: "📩 Nuevo lead desde el landing",
      texto: resumenLead,
      url: "/",
      cliente: { nombre: nombre },
      total: 0,
      items: []
    };
    /* Llamada directa con el body ya armado — evitamos el Request
       sintetico que rompia el .text() en Workers. */
    await notificar({ method: "POST" }, env, notifBody);
  } catch(e){
    console.error("guardarLead push:", e.message);
  }

  return new Response(JSON.stringify({ ok:true, guardado:true }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
}
