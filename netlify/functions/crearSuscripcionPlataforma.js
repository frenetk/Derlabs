/* netlify/functions/crearSuscripcionPlataforma.js
   POST /.netlify/functions/crearSuscripcionPlataforma
   body: { storeId, email, montoMensual, nombreNegocio }

   Cobro RECURRENTE MENSUAL de la propia plataforma a cada cliente —
   distinto por completo de crearPago.js/webhookPago.js, que cobran a
   los COMPRADORES de cada tienda con el MercadoPago de CADA CLIENTE.
   Acá el dinero va al MercadoPago del DUEÑO DE LA PLATAFORMA (vos),
   con un token separado (PLATAFORMA_MP_TOKEN en Netlify, nunca el
   mpToken de ninguna tienda ni el MP_ACCESS_TOKEN de respaldo que ya
   usa webhookPago.js — mezclar esos tres tokens bajo un mismo nombre
   sería confuso y arriesgado).

   Usa el endpoint /preapproval de MercadoPago (PreApproval en el SDK),
   NO /preference (eso es para un cobro único, ver crearPago.js) — un
   preapproval es una autorización de cobro recurrente: el cliente
   paga una vez para autorizar, y MercadoPago vuelve a cobrar solo,
   cada mes, sin que la plataforma tenga que volver a pedir nada.

   El resultado de esta función es un link de pago — el cliente lo abre
   y autoriza la suscripción desde ahí. El registro en Firestore
   (suscripciones_plataforma/{storeId}) queda en estado "pendiente"
   hasta que webhookSuscripcion.js confirme que el cliente autorizó. */

const { MercadoPagoConfig, PreApproval } = require("mercadopago");
const { getDb, corsHeaders } = require("./_firebase");

exports.handler = async function(event){
  const headers = corsHeaders();

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  const secretEsperado = process.env.ADMIN_SECRET;
  const secretRecibido = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!secretEsperado || secretRecibido !== secretEsperado) {
    return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: "No autorizado" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { storeId, email, montoMensual, nombreNegocio } = body;

    if (!storeId || !email || !montoMensual) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Faltan storeId, email o montoMensual" }) };
    }

    const token = process.env.PLATAFORMA_MP_TOKEN;
    if (!token) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "PLATAFORMA_MP_TOKEN no está configurado en Netlify" }) };
    }

    const db = getDb();
    const host = event.headers.host || event.headers["x-forwarded-host"] || "";
    const proto = (event.headers["x-forwarded-proto"] || "https");
    const urlBase = (host ? (proto + "://" + host) : "").replace(/\/+$/, "");
    if (!urlBase) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "No se pudo determinar la URL del sitio" }) };
    }

    const mp = new MercadoPagoConfig({ accessToken: token });

    /* auto_recurring sin end_date = se repite indefinidamente, hasta
       que se cancele explícitamente (a mano, desde MercadoPago o
       eventualmente desde un botón en el panel — no construido
       todavía). status "pending": el cliente todavía tiene que
       autorizar desde el link antes de que empiece a cobrar. */
    const suscripcion = await new PreApproval(mp).create({
      body: {
        reason: "Mensualidad plataforma" + (nombreNegocio ? " — " + nombreNegocio : ""),
        external_reference: storeId,
        payer_email: email,
        back_url: urlBase,
        /* Referencia adicional — el tópico real hay que activarlo a
           mano en el panel de MercadoPago (ver comentario al inicio
           de webhookSuscripcion.js), esto no lo reemplaza. */
        notification_url: urlBase + "/.netlify/functions/webhookSuscripcion",
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
      estado: "pendiente", // pasa a "activa" cuando el webhook confirme que el cliente autorizó
      creadoEn: ahora,
      proximoCobro: null // se completa cuando la suscripción queda activa
    }, { merge: true });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: true, initPoint: suscripcion.init_point, preapprovalId: suscripcion.id })
    };
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
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: detalle }) };
  }
};
