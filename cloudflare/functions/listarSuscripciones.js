/* cloudflare/functions/listarSuscripciones.js
   Equivalente directo a netlify/functions/listarSuscripciones.js. */

import { getDb, corsHeaders } from "./_firebase.js";

export async function listarSuscripciones(request, env){
  const headers = corsHeaders();

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  const secretEsperado = env.ADMIN_SECRET;
  const secretRecibido = request.headers.get("x-admin-secret");
  if (!secretEsperado || secretRecibido !== secretEsperado) {
    return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 401, headers });
  }

  try {
    const db = getDb(env);
    const snap = await db.collection("suscripciones_plataforma").get();
    const lista = snap.docs.map(function(doc){
      const d = doc.data();
      return {
        storeId: doc.id,
        nombreNegocio: d.nombreNegocio || doc.id,
        email: d.email || null,
        estado: d.estado || "desconocido",
        montoMensual: d.montoMensual || null,
        proximoCobro: d.proximoCobro || null,
        creadoEn: d.creadoEn || null
      };
    });
    return new Response(JSON.stringify({ ok: true, suscripciones: lista }), { status: 200, headers });
  } catch (e) {
    console.error("listarSuscripciones error:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers });
  }
}
