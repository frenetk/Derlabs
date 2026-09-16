/* netlify/functions/listarSuscripciones.js
   GET /.netlify/functions/listarSuscripciones
   header: X-Admin-Secret

   Devuelve todas las filas de suscripciones_plataforma, para el panel
   suscripciones.html — quién está al día, próximo a vencer, o
   vencido. La decisión de qué hacer con cada tienda (pausarla,
   contactar al cliente) sigue siendo manual — esto solo da la
   visibilidad, no actúa solo (ver ROADMAP.md para la automatización
   completa, pendiente para más adelante). */

const { getDb, corsHeaders } = require("./_firebase");

exports.handler = async function(event){
  const headers = corsHeaders();

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const secretEsperado = process.env.ADMIN_SECRET;
  const secretRecibido = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!secretEsperado || secretRecibido !== secretEsperado) {
    return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: "No autorizado" }) };
  }

  try {
    const db = getDb();
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
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, suscripciones: lista }) };
  } catch (e) {
    console.error("listarSuscripciones error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
