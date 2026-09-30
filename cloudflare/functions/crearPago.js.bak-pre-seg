/* cloudflare/functions/crearPago.js
   Equivalente a netlify/functions/crearPago.js. El SDK de mercadopago
   ya usa "import { MercadoPagoConfig, Preference } from 'mercadopago'"
   como su forma estándar en la propia documentación oficial del
   paquete — a diferencia de firebase-admin, no depende de un interop
   CJS/ESM indirecto para este patrón de uso. Riesgo real menor, pero
   igual sin poder confirmarlo con un deploy real desde este entorno.

   CAMBIO REAL, no solo de formato: notification_url apuntaba a
   "/.netlify/functions/webhookPago" — se actualiza a la ruta nueva
   bajo Cloudflare ("/api/webhookPago", ver worker.js) porque esa ruta
   vieja ya no existe en el sitio migrado; si esto no se actualizara,
   MercadoPago llamaría a una URL muerta y el webhook nunca llegaría. */

import { MercadoPagoConfig, Preference } from "mercadopago";
import { getDb, corsHeaders, getStoreConfig, validarPedidoCompleto } from "./_firebase.js";

export async function crearPago(request, env){
  const headers = corsHeaders();

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const body = JSON.parse(await request.text() || "{}");
    const { storeId, items, cliente, pedidoId, tipo, costoDelivery, cuponAplicado } = body;

    if (!storeId || !items || !items.length) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan datos del pedido" }), { status: 400, headers });
    }

    const db = getDb(env);
    const config = await getStoreConfig(db, storeId);
    if (!config.mpToken) {
      return new Response(JSON.stringify({ ok: false, error: "MercadoPago no está configurado en esta tienda" }), { status: 400, headers });
    }

    const clienteUid = cliente && cliente.uid ? cliente.uid : null;
    const val = await validarPedidoCompleto(db, storeId, items, costoDelivery, cuponAplicado, clienteUid);
    if (!val.ok) {
      return new Response(JSON.stringify({ ok: false, error: val.error }), { status: 400, headers });
    }
    const { itemsValidados, subtotal: subtotalReal, costoDelivery: costoDeliveryReal,
            descuento: descuentoReal, cuponFinal, total: totalReal } = val;

    const mp = new MercadoPagoConfig({ accessToken: config.mpToken });
    const id = pedidoId || ("TB" + Date.now().toString().slice(-6));
    const url = new URL(request.url);
    const urlTienda = (url.origin || config.url || "").replace(/\/+$/, "");
    if (!urlTienda) {
      return new Response(JSON.stringify({ ok: false, error: "No se pudo determinar la URL del sitio" }), { status: 500, headers });
    }

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
        notification_url: urlTienda + "/api/webhookPago?storeId=" + encodeURIComponent(storeId),
        metadata: { pedidoId: id, storeId }
      }
    });

    const intento = {
      id, storeId, tipo, cliente,
      items: itemsValidados, subtotal: subtotalReal, descuento: descuentoReal, cuponAplicado: cuponFinal,
      costoDelivery: costoDeliveryReal, total: totalReal,
      preferenceId: preference.id,
      estado: "iniciado",
      creadoEn: new Date().toISOString()
    };
    await db.doc("tiendas/" + storeId + "/intentos_pago/" + id).set(intento);

    const paymentLink = "https://www.mercadopago.cl/payment-link/v1/redirect?preference-id=" + preference.id;

    return new Response(JSON.stringify({
      ok: true,
      init_point: preference.init_point,
      payment_link: paymentLink,
      pedidoId: id
    }), { status: 200, headers });
  } catch (e) {
    let detalle = e.message || "Error desconocido";
    if (e.cause) {
      try {
        const causaArr = Array.isArray(e.cause) ? e.cause : [e.cause];
        const partes = causaArr.map(function(c){ return c.description || c.message || JSON.stringify(c); });
        if (partes.length) detalle = partes.join(" | ");
      } catch (parseErr) { /* si no se puede parsear, usar e.message tal cual */ }
    }
    console.error("crearPago error:", detalle);
    return new Response(JSON.stringify({ ok: false, error: detalle }), { status: 500, headers });
  }
}
