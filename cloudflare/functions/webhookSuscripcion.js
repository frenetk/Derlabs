/* cloudflare/functions/webhookSuscripcion.js
   Equivalente a netlify/functions/webhookSuscripcion.js. Conversión
   directa, sin cambios reales más allá del formato. */

import { MercadoPagoConfig, PreApproval } from "mercadopago";
import { getDb, corsHeaders } from "./_firebase.js";

export async function webhookSuscripcion(request, env){
  const headers = corsHeaders();

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  try {
    const body = JSON.parse(await request.text() || "{}");
    const tipo = body.type || body.topic || "";
    const preapprovalId = (body.data && body.data.id) || body.id || null;

    if (!preapprovalId || (tipo !== "subscription_preapproval" && tipo !== "subscription_authorized_payment" && tipo !== "preapproval")){
      return new Response("ok", { status: 200, headers });
    }

    const token = env.PLATAFORMA_MP_TOKEN;
    if (!token) {
      console.warn("webhookSuscripcion: PLATAFORMA_MP_TOKEN no configurado, no se puede procesar");
      return new Response("ok", { status: 200, headers });
    }

    const mp = new MercadoPagoConfig({ accessToken: token });
    const sus = await new PreApproval(mp).get({ id: preapprovalId });

    console.log("webhookSuscripcion: preapproval " + preapprovalId + " status=" + sus.status +
      " external_reference=" + sus.external_reference);

    const storeId = sus.external_reference;
    if (!storeId) {
      console.warn("webhookSuscripcion: preapproval sin external_reference, no se puede asociar a ninguna tienda");
      return new Response("ok", { status: 200, headers });
    }

    const db = getDb(env);
    const mapaEstado = { authorized: "activa", paused: "pausada", cancelled: "cancelada", pending: "pendiente" };
    const estado = mapaEstado[sus.status] || sus.status;

    await db.doc("suscripciones_plataforma/" + storeId).set({
      estado,
      proximoCobro: sus.next_payment_date || null,
      montoMensual: sus.auto_recurring ? Number(sus.auto_recurring.transaction_amount) : undefined,
      ultimaActualizacion: new Date().toISOString()
    }, { merge: true });

    return new Response("ok", { status: 200, headers });
  } catch (e) {
    console.error("webhookSuscripcion error:", e.message);
    return new Response("ok", { status: 200, headers });
  }
}
