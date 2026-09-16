/* netlify/functions/webhookSuscripcion.js
   MercadoPago llama acá (POST) cuando cambia el estado de una
   suscripción o se cobra un mes — SOLO para el cobro de la propia
   plataforma (ver crearSuscripcionPlataforma.js), nunca para pedidos
   de una tienda (eso es webhookPago.js, un archivo aparte con su
   propio token por tienda).

   PASO MANUAL OBLIGATORIO, fuera de este código: en el panel de
   MercadoPago (la cuenta de la plataforma, no la de ningún cliente),
   hay que activar los tópicos "subscription_preapproval" (el cliente
   autoriza/cambia la suscripción) y "subscription_authorized_payment"
   (cada cobro mensual) para esta notification_url — MercadoPago no
   deja configurar esto desde la API, según su propia documentación.

   Mismo principio que webhookPago.js: nunca confiar en el status que
   viaja DENTRO del cuerpo del webhook (podría estar desactualizado) —
   se usa el webhook solo para saber QUÉ preapproval_id consultar, y
   se pide el estado real y actual a la API de MercadoPago antes de
   tocar Firestore. */

const { MercadoPagoConfig, PreApproval } = require("mercadopago");
const { getDb, corsHeaders } = require("./_firebase");

exports.handler = async function(event){
  const headers = corsHeaders();

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    /* MercadoPago manda "type" (formato viejo) o "topic"+"action"
       (formato nuevo) según el tópico — se acepta cualquiera de los
       dos, quedándose con el que traiga el id de la suscripción. */
    const tipo = body.type || body.topic || "";
    const preapprovalId = (body.data && body.data.id) || body.id || null;

    if (!preapprovalId || (tipo !== "subscription_preapproval" && tipo !== "subscription_authorized_payment" && tipo !== "preapproval")){
      // Cualquier otro tópico (ej. "payment" suelto) se ignora acá — no es este webhook el que lo maneja.
      return { statusCode: 200, headers, body: "ok" };
    }

    const token = process.env.PLATAFORMA_MP_TOKEN;
    if (!token) {
      console.warn("webhookSuscripcion: PLATAFORMA_MP_TOKEN no configurado, no se puede procesar");
      return { statusCode: 200, headers, body: "ok" };
    }

    const mp = new MercadoPagoConfig({ accessToken: token });
    const sus = await new PreApproval(mp).get({ id: preapprovalId });

    console.log("webhookSuscripcion: preapproval " + preapprovalId + " status=" + sus.status +
      " external_reference=" + sus.external_reference);

    const storeId = sus.external_reference; // se guardó acá al crear, ver crearSuscripcionPlataforma.js
    if (!storeId) {
      console.warn("webhookSuscripcion: preapproval sin external_reference, no se puede asociar a ninguna tienda");
      return { statusCode: 200, headers, body: "ok" };
    }

    const db = getDb();
    /* Mapear el status de MercadoPago al estado que usa el panel:
       authorized → activa (cobra normalmente, mes a mes)
       paused     → pausada (el cliente o la plataforma la pausó)
       cancelled  → cancelada
       pending    → pendiente (el cliente todavía no autorizó) */
    const mapaEstado = { authorized: "activa", paused: "pausada", cancelled: "cancelada", pending: "pendiente" };
    const estado = mapaEstado[sus.status] || sus.status;

    await db.doc("suscripciones_plataforma/" + storeId).set({
      estado,
      proximoCobro: sus.next_payment_date || null,
      montoMensual: sus.auto_recurring ? Number(sus.auto_recurring.transaction_amount) : undefined,
      ultimaActualizacion: new Date().toISOString()
    }, { merge: true });

    return { statusCode: 200, headers, body: "ok" };
  } catch (e) {
    /* Nunca devolver error a MercadoPago por algo que no sea culpa de
       MercadoPago — si esto tira 500, MercadoPago reintenta el mismo
       webhook varias veces, lo cual no arregla un bug del lado de acá
       y solo genera ruido. Se registra el error para diagnóstico, se
       responde 200 igual. */
    console.error("webhookSuscripcion error:", e.message);
    return { statusCode: 200, headers, body: "ok" };
  }
};
