/* cloudflare/functions/gestionLeads.js
   Backend del gestor /leads.html. Protegido con la misma clave de
   administrador que generar-tienda.html (header X-Admin-Secret).
   POST { accion, ... }:
     listar                       → leads (más nuevos primero) + dispositivos
     revisar      { id, valor }   → marca/desmarca como revisado
     eliminar     { id }          → borra el lead
     registrar    { subscription, dispositivo } → activa push en este equipo
     quitar       { id }          → quita un dispositivo
     probar                       → envía un push de prueba */
import { getDb, corsHeaders } from "./_firebase.js";
import { enviarPushLista } from "./notificar.js";

export async function gestionLeads(request, env){
  const headers = corsHeaders();
  const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers });
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers });
  if (request.method !== "POST") return json({ ok:false, error:"Usa POST" }, 405);
  if (!env.ADMIN_SECRET || request.headers.get("x-admin-secret") !== env.ADMIN_SECRET){
    return json({ ok:false, error:"No autorizado" }, 401);
  }

  let b = {};
  try { b = JSON.parse(await request.text() || "{}"); } catch(e){ b = {}; }
  const id = String(b.id || "").replace(/[^A-Za-z0-9_-]/g, "");

  try {
    const db = getDb(env);
    switch (b.accion){
      case "listar": {
        const [ls, ds] = await Promise.all([db.collection("leads").get(), db.collection("leads_dispositivos").get()]);
        const leads = ls.docs.map(function(d){ const x = d.data(); return {
          id: d.id, nombre: x.nombre || "", whatsapp: x.whatsapp || "", rubro: x.rubro || "",
          mensaje: x.mensaje || "", fecha: x.fecha || "", origen: x.origen || "", revisado: x.revisado === true
        }; }).sort(function(a, c){ return String(c.fecha).localeCompare(String(a.fecha)); });
        const dispositivos = ds.docs.map(function(d){ const x = d.data(); return { id: d.id, dispositivo: x.dispositivo || "Dispositivo", activadoEn: x.activadoEn || "" }; });
        return json({ ok:true, leads, dispositivos });
      }
      case "revisar":
        if (!id) return json({ ok:false, error:"Falta id" }, 400);
        await db.doc("leads/" + id).set({ revisado: b.valor !== false }, { merge: true });
        return json({ ok:true });
      case "eliminar":
        if (!id) return json({ ok:false, error:"Falta id" }, 400);
        await db.doc("leads/" + id).delete();
        return json({ ok:true });
      case "registrar": {
        const sub = b.subscription || {};
        if (!sub.endpoint) return json({ ok:false, error:"Suscripción inválida" }, 400);
        const docId = (btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-60)) || ("d" + Date.now());
        await db.doc("leads_dispositivos/" + docId).set({
          subscription: JSON.stringify(sub),
          dispositivo: String(b.dispositivo || "Dispositivo").slice(0, 80),
          activadoEn: new Date().toISOString()
        });
        return json({ ok:true, id: docId });
      }
      case "quitar":
        if (!id) return json({ ok:false, error:"Falta id" }, 400);
        await db.doc("leads_dispositivos/" + id).delete();
        return json({ ok:true });
      case "probar": {
        const ds = await db.collection("leads_dispositivos").get();
        const subs = [];
        ds.docs.forEach(function(d){ try { const s = JSON.parse(d.data().subscription || "{}"); if (s.endpoint) subs.push({ id: d.id, sub: s }); } catch(e){} });
        if (!subs.length) return json({ ok:false, error:"No hay dispositivos activados" });
        const resultados = await enviarPushLista(subs, { title:"🔔 Prueba de DerLabs", body:"Así te va a llegar cada contacto nuevo del landing.", url:"/leads.html" }, env);
        return json({ ok:true, enviados: resultados.filter(function(r){ return r === "ok"; }).length, resultados });
      }
      default:
        return json({ ok:false, error:"Acción desconocida" }, 400);
    }
  } catch(e){
    console.error("gestionLeads:", e.message);
    return json({ ok:false, error: e.message }, 500);
  }
}
