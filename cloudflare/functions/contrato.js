/* cloudflare/functions/contrato.js
   Registra que una cuenta con rol en la tienda aceptó los términos del
   servicio. Se hace desde el servidor porque las reglas de Firestore dejan
   crear tiendas/{s}/contratos/{uid} pero no modificarlo: cuando cambia la
   versión de los términos, quien ya había aceptado una anterior no podía
   guardar la nueva y el aviso le aparecía cada vez que entraba al panel.

   Se conserva la evidencia: cada aceptación queda en "historial" con su
   versión, fecha y navegador, y nunca se borra lo anterior.

   POST /api/aceptarContrato  (Authorization: Bearer <token de Firebase>)
     { storeId, version, userAgent } */
import { getDb, corsHeaders, uidDesdeToken } from "./_firebase.js";

export async function aceptarContrato(request, env){
  const headers = Object.assign({}, corsHeaders(), { "Access-Control-Allow-Headers": "Content-Type, Authorization", "Cache-Control": "no-store" });
  const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers });
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers });
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);
  let b = {}; try { b = JSON.parse(await request.text() || "{}"); } catch (e) {}
  const storeId = String(b.storeId || "").replace(/[^A-Za-z0-9_-]/g, "");
  const version = Math.round(Number(b.version));
  if (!storeId || !(version >= 1 && version <= 999)) return json({ ok: false, error: "Faltan la tienda o la versión" }, 400);
  try {
    const uid = await uidDesdeToken(request, env);
    if (!uid) return json({ ok: false, error: "Sesión vencida — vuelve a entrar" }, 401);
    const db = getDb(env);
    const u = await db.doc("usuarios/" + uid).get();
    const rol = u.exists && u.data().roles ? u.data().roles[storeId] : null;
    if (!rol) return json({ ok: false, error: "Sin permiso en esta tienda" }, 403);

    const ref = db.doc("tiendas/" + storeId + "/contratos/" + uid);
    const d = await ref.get();
    const antes = d.exists ? d.data() : null;
    if (antes && Number(antes.version) >= version) return json({ ok: true, version: antes.version, ya: true });
    const ahora = new Date().toISOString();
    const esta = { version, aceptadoEn: ahora, userAgent: String(b.userAgent || "").slice(0, 300) || null };
    let historial = antes && Array.isArray(antes.historial) ? antes.historial.slice(-20) : [];
    /* la aceptación anterior (hecha antes de que existiera el historial) también se conserva */
    if (antes && !historial.length && antes.version) historial.push({ version: antes.version, aceptadoEn: antes.aceptadoEn || null, userAgent: antes.userAgent || null });
    historial.push(esta);
    const email = String(b.email || "").trim().slice(0, 120) || u.data().email || (antes && antes.email) || null;
    await ref.set({ version, email, aceptadoEn: ahora, userAgent: esta.userAgent, historial }, { merge: true });
    return json({ ok: true, version });
  } catch (e) {
    console.error("aceptarContrato:", e.message);
    return json({ ok: false, error: e.message || "Error" }, 500);
  }
}
