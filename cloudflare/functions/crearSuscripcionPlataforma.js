/* cloudflare/functions/crearSuscripcionPlataforma.js
   Equivalente a netlify/functions/crearSuscripcionPlataforma.js.
   Mismo patrón de conversión que crearPago.js. La notification_url
   apuntaba a "/.netlify/functions/webhookSuscripcion" — se actualiza
   a "/api/webhookSuscripcion" (ver worker.js), misma razón que en
   crearPago.js: la ruta vieja ya no existe en el sitio migrado. */

import { MercadoPagoConfig, PreApproval } from "mercadopago";
import { getDb, corsHeaders } from "./_firebase.js";

export async function crearSuscripcionPlataforma(request, env){
  const headers = corsHeaders();

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers });
  }

  const secretEsperado = env.ADMIN_SECRET;
  const secretRecibido = request.headers.get("x-admin-secret");
  if (!secretEsperado || secretRecibido !== secretEsperado) {
    return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 401, headers });
  }

  try {
    const body = JSON.parse(await request.text() || "{}");
    const { storeId, email, montoMensual, nombreNegocio } = body;

    if (!storeId || !email || !montoMensual) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan storeId, email o montoMensual" }), { status: 400, headers });
    }

    const token = env.PLATAFORMA_MP_TOKEN;
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "PLATAFORMA_MP_TOKEN no está configurado en Cloudflare" }), { status: 500, headers });
    }

    const db = getDb(env);
    const url = new URL(request.url);
    const urlBase = url.origin;

    const mp = new MercadoPagoConfig({ accessToken: token });

    const suscripcion = await new PreApproval(mp).create({
      body: {
        reason: "Mensualidad plataforma" + (nombreNegocio ? " — " + nombreNegocio : ""),
        external_reference: storeId,
        payer_email: email,
        back_url: urlBase,
        notification_url: urlBase + "/api/webhookSuscripcion",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: Number(montoMensual),
          currency_id: "CLP"
        },
        status: "pending"
      }
    });

    const ahora = new Date().toISOString();
    await db.doc("suscripciones_plataforma/" + storeId).set({
      storeId, email, nombreNegocio: nombreNegocio || null,
      montoMensual: Number(montoMensual),
      preapprovalId: suscripcion.id,
      estado: "pendiente",
      creadoEn: ahora,
      proximoCobro: null
    }, { merge: true });

    return new Response(
      JSON.stringify({ ok: true, initPoint: suscripcion.init_point, preapprovalId: suscripcion.id }),
      { status: 200, headers }
    );
  } catch (e) {
    let detalle = e.message || "Error desconocido";
    if (e.cause) {
      try {
        const causaArr = Array.isArray(e.cause) ? e.cause : [e.cause];
        const partes = causaArr.map(function(c){ return c.description || c.message || JSON.stringify(c); });
        if (partes.length) detalle = partes.join(" | ");
      } catch (parseErr) { /* usar e.message tal cual si no se puede parsear */ }
    }
    console.error("crearSuscripcionPlataforma error:", detalle);
    return new Response(JSON.stringify({ ok: false, error: detalle }), { status: 500, headers });
  }
}
