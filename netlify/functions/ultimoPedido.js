/* netlify/functions/ultimoPedido.js
   GET /.netlify/functions/ultimoPedido?storeId=xxx
   GET /.netlify/functions/ultimoPedido?hostname=xxx  (multi-dominio)

   Respaldo de emergencia para sw.js: cuando el push llega sin payload
   (el navegador no pudo entregar el contenido cifrado, o el registro de
   la suscripción no tenía las llaves p256dh/auth), el service worker
   necesita ALGO que mostrar en la notificación — antes intentaba leer
   la colección `pedidos` directo de Firestore vía REST sin ningún
   token, lo cual funcionaba mientras esa colección era de lectura
   pública.

   Ya no lo es (ver README-FIRESTORE-RULES.md — `pedidos` ahora exige
   auth para lectura, precisamente para que un comprador anónimo no
   pueda leer direcciones y teléfonos de otros clientes). Un service
   worker no tiene forma simple de mantener un token de Firebase Auth
   vigente, así que en vez de eso pide este resumen a una función que sí
   corre con credenciales de servidor (Admin SDK, ignora las reglas de
   Firestore) y le devuelve solo lo mínimo necesario para el texto de la
   notificación — nunca el pedido completo. Ni dirección, ni teléfono,
   ni email viajan por acá.

   MULTI-DOMINIO: sw.js no resuelve el storeId por su cuenta (a
   diferencia de index.html/pedidos.html/formulario.html, que sí
   consultan "dominios" directo desde el navegador) — en vez de repetir
   esa lógica dentro del service worker con una segunda fuente de
   verdad, sw.js manda su self.location.hostname acá, y es este backend
   quien resuelve el storeId contra la MISMA colección "dominios" que ya
   usa el resto del sitio. Si algún llamador sigue mandando storeId
   directo (compatibilidad), ese tiene prioridad y no se consulta
   "dominios" en absoluto. */

const { getDb, corsHeaders, resumenItems } = require("./_firebase");

exports.handler = async function(event){
  const headers = corsHeaders();
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const params = event.queryStringParameters || {};
  let storeId = params.storeId || "";

  try {
    const db = getDb();

    if (!storeId && params.hostname) {
      const domDoc = await db.collection("dominios").doc(params.hostname).get();
      if (domDoc.exists && domDoc.data().storeId) {
        storeId = domDoc.data().storeId;
      }
    }
    if (!storeId) storeId = "test-burgers"; // mismo valor por defecto que el resto del sitio

    const snap = await db.collection("tiendas/" + storeId + "/pedidos")
      .orderBy("fecha", "desc").limit(1).get();

    if (snap.empty) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, pedido: null }) };
    }

    const d = snap.docs[0].data();
    const resumen = resumenItems(d.items);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true,
        pedido: {
          title: "🍔 ¡Nuevo pedido! $" + Number(d.total || 0).toLocaleString("es-CL"),
          body: ((d.cliente && d.cliente.nombre) || "Cliente") + (resumen ? " — " + resumen : ""),
          url: "/pedidos.html"
        }
      })
    };
  } catch (e) {
    console.error("ultimoPedido error:", e.message);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, pedido: null }) };
  }
};
