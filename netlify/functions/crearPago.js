/* netlify/functions/crearPago.js
   POST /.netlify/functions/crearPago
   body: { storeId, items, cliente, pedidoId, tipo, costoDelivery,
           cuponAplicado }

   El pedido NO se crea acá — se crea en webhookPago.js, y solo si
   MercadoPago confirma el pago como aprobado. Esto es intencional:
   el pedido debe nacer cuando el pago se confirma, no antes.

   Lo que SÍ se crea acá es un registro de auditoría en
   tiendas/{storeId}/intentos_pago/{id} — nunca aparece en
   pedidos.html, no dispara notificación, no descuenta stock. Es solo
   un rastro de "esta preferencia se generó, con estos datos, a esta
   hora". Existe por una razón concreta: la primera vez que probamos
   este diseño (crear el pedido solo desde el webhook, sin ningún
   registro intermedio), un pago real se acreditó en MercadoPago pero
   el webhook falló en silencio y el pedido nunca apareció en ningún
   lado — ni rastro de qué había pasado. Con este registro, si eso
   vuelve a pasar, el dueño puede verlo en devmode (pestaña Pagos →
   "Intentos de pago sin confirmar") y recrear el pedido a mano con
   los datos exactos, en vez de perder el rastro del pago por completo.

   SEGURIDAD: precio, subtotal, descuento y total NUNCA se toman del
   body. El cliente solo indica QUÉ productos y QUÉ cupón quiere — el
   PRECIO de cada producto y la validez/valor del cupón se recalculan
   acá leyendo Firestore (ver validarPedidoCompleto en _firebase.js).
   Esto aplica igual con el registro de auditoría: si no se validara acá,
   el intento_pago (y por lo tanto el pedido que arma el webhook a partir
   de él) quedaría con los montos falsos que mandó el navegador — el
   registro de auditoría no sirve de nada si audita datos ya
   manipulados. */

const { MercadoPagoConfig, Preference } = require("mercadopago");
const { getDb, corsHeaders, getStoreConfig, validarPedidoCompleto } = require("./_firebase");

exports.handler = async function(event){
  const headers = corsHeaders();

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { storeId, items, cliente, pedidoId, tipo, costoDelivery, cuponAplicado } = body;

    if (!storeId || !items || !items.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Faltan datos del pedido" }) };
    }

    const db = getDb();
    const config = await getStoreConfig(db, storeId);
    if (!config.mpToken) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "MercadoPago no está configurado en esta tienda" }) };
    }

    const clienteUid = cliente && cliente.uid ? cliente.uid : null;
    const val = await validarPedidoCompleto(db, storeId, items, costoDelivery, cuponAplicado, clienteUid);
    if (!val.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: val.error }) };
    }
    const { itemsValidados, subtotal: subtotalReal, costoDelivery: costoDeliveryReal,
            descuento: descuentoReal, cuponFinal, total: totalReal } = val;

    const mp = new MercadoPagoConfig({ accessToken: config.mpToken });
    const id = pedidoId || ("TB" + Date.now().toString().slice(-6));
    /* No depender de config.url (nunca se configura desde ningún lado en
       devmode) — Netlify siempre provee el host real de la request, que
       es la fuente confiable para construir back_urls y notification_url. */
    const host = event.headers.host || event.headers["x-forwarded-host"] || "";
    const proto = (event.headers["x-forwarded-proto"] || "https");
    const urlTienda = (host ? (proto + "://" + host) : (config.url || "")).replace(/\/+$/, "");
    if (!urlTienda) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "No se pudo determinar la URL del sitio" }) };
    }

    /* MercadoPago no tiene un campo de "descuento" en items — se aplica
       restando el descuento del primer ítem (nunca por debajo de $1, que
       es el mínimo que acepta MercadoPago) para que la suma de unit_price
       × quantity siga cuadrando exactamente con totalReal. */
    const mpItems = itemsValidados.map(function(i){
      return { title: i.nombre, quantity: i.cantidad, unit_price: i.precio, currency_id: "CLP" };
    });
    if (descuentoReal > 0 && mpItems.length){
      const primero = mpItems[0];
      const totalPrimero = primero.unit_price * primero.quantity;
      const nuevoTotalPrimero = Math.max(1, totalPrimero - descuentoReal);
      if (primero.quantity === 1) {
        primero.unit_price = nuevoTotalPrimero;
      } else {
        /* Con cantidad > 1 no se puede prorratear un descuento fijo sin
           partir el ítem en dos líneas — se agrega como línea negativa,
           que MercadoPago sí admite. */
        mpItems.push({ title: "Descuento" + (cuponFinal ? " (" + cuponFinal + ")" : ""), quantity: 1, unit_price: -descuentoReal, currency_id: "CLP" });
      }
    }
    if (costoDeliveryReal > 0) {
      mpItems.push({ title: "Delivery", quantity: 1, unit_price: costoDeliveryReal, currency_id: "CLP" });
    }

    const preference = await new Preference(mp).create({
      body: {
        items: mpItems,
        back_urls: {
          success: urlTienda + "?status=approved&pedido_id=" + id,
          failure: urlTienda + "?status=failure&pedido_id=" + id,
          pending: urlTienda + "?status=pending&pedido_id=" + id
        },
        auto_return: "approved",
        /* storeId en la URL (no solo en metadata) es lo que permite que
           webhookPago.js sepa a qué tienda pertenece el pago ANTES de
           poder consultarlo con la API de MercadoPago — y así pedirle a
           Firestore el mpToken correcto de ESA tienda, en vez de
           depender de una única variable de entorno compartida por
           todas las tiendas del sistema (ver notas en webhookPago.js). */
        notification_url: urlTienda + "/.netlify/functions/webhookPago?storeId=" + encodeURIComponent(storeId),
        metadata: { pedidoId: id, storeId }
      }
    });

    /* Registro de auditoría — nunca un pedido real. Guarda los datos ya
       VALIDADOS que el webhook va a necesitar para reconstruir el pedido
       completo cuando confirme el pago — nunca lo que mandó el body. */
    const intento = {
      id, storeId, tipo, cliente,
      items: itemsValidados, subtotal: subtotalReal, descuento: descuentoReal, cuponAplicado: cuponFinal,
      costoDelivery: costoDeliveryReal, total: totalReal,
      preferenceId: preference.id,
      estado: "iniciado", // pasa a "confirmado" cuando el webhook crea el pedido real
      creadoEn: new Date().toISOString()
    };
    await db.doc("tiendas/" + storeId + "/intentos_pago/" + id).set(intento);

    /* payment_link: mismo checkout que init_point, pero con este formato de URL
       Android sí reconoce el App Link de MercadoPago y ofrece abrir la app
       instalada en vez de quedarse siempre en el navegador. */
    const paymentLink = "https://www.mercadopago.cl/payment-link/v1/redirect?preference-id=" + preference.id;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true,
        init_point: preference.init_point,
        payment_link: paymentLink,
        pedidoId: id
      })
    };
  } catch (e) {
    /* El SDK de MercadoPago suele envolver el error real de su API dentro
       de e.cause (un array) o e.message trae solo "request failed" sin
       detalle. Extraer lo más específico posible para que el frontend
       pueda mostrar la causa real en vez de un mensaje genérico. */
    let detalle = e.message || "Error desconocido";
    if (e.cause) {
      try {
        const causaArr = Array.isArray(e.cause) ? e.cause : [e.cause];
        const partes = causaArr.map(function(c){ return c.description || c.message || JSON.stringify(c); });
        if (partes.length) detalle = partes.join(" | ");
      } catch (parseErr) { /* si no se puede parsear, usar e.message tal cual */ }
    }
    console.error("crearPago error:", detalle, "| raw:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: detalle }) };
  }
};
