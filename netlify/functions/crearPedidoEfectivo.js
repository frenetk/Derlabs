/* netlify/functions/crearPedidoEfectivo.js
   POST /.netlify/functions/crearPedidoEfectivo
   body: { storeId, items, cliente, pedidoId, tipo, costoDelivery,
           cuponAplicado }

   Mismo propósito que crearPago.js pero sin MercadoPago de por medio: el
   vendedor cobra en persona al entregar, así que acá no hay preferencia
   de pago que crear ni webhook externo que esperar — la confirmación es
   síncrona (esta misma llamada). Por eso, a diferencia de crearPago.js,
   acá el pedido se escribe DIRECTO en tiendas/{storeId}/pedidos/{id} con
   estado "nuevo", sin pasar por intentos_pago: ese registro intermedio
   existe en el flujo de MercadoPago para el caso específico de que un
   pago se confirme de forma asíncrona (vía webhook) y algo falle entre
   medio — un problema que no existe acá, porque no hay ningún aviso
   externo que pueda no llegar.

   Antes de esta función, el pedido en efectivo se escribía directo desde
   el navegador del comprador a Firestore (ver guardarPedidoFirestore en
   index.html), confiando en los precios que el propio cliente calculó.
   Aunque acá no hay cobro automático que manipular, el vendedor sí ve y
   confía en ese total al preparar y entregar el pedido — el mismo tipo
   de hueco que en MercadoPago, solo que el "cobro" ocurre en persona en
   vez de en la pasarela. */

const { getDb, corsHeaders, validarPedidoCompleto, admin } = require("./_firebase");

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
    const clienteUid = cliente && cliente.uid ? cliente.uid : null;
    const val = await validarPedidoCompleto(db, storeId, items, costoDelivery, cuponAplicado, clienteUid);
    if (!val.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: val.error }) };
    }
    const { itemsValidados, subtotal, costoDelivery: costoDeliveryReal, descuento, cuponFinal, total } = val;

    const id = pedidoId || ("TB" + Date.now().toString().slice(-5));
    const ahora = new Date().toISOString();

    const pedidoObj = {
      id, storeId, tipo, cliente,
      items: itemsValidados, subtotal, descuento, cuponAplicado: cuponFinal,
      costoDelivery: costoDeliveryReal, total,
      metodoPago: "efectivo",
      estado: "nuevo",
      fecha: ahora,
      estadoTimeline: { nuevo: ahora, preparacion: null, camino: null, listo: null }
    };

    await db.doc("tiendas/" + storeId + "/pedidos/" + id).set(pedidoObj);
    if (clienteUid) {
      await db.doc("usuarios/" + clienteUid + "/pedidos/" + id).set(pedidoObj).catch(function(e){
        console.warn("No se pudo copiar pedido al usuario:", e.message);
      });
    }

    // Descontar stock de cada producto (solo ahora que el pedido quedó confirmado)
    if (Array.isArray(itemsValidados)) {
      await Promise.all(itemsValidados.map(async function(it){
        try {
          const prodRef = db.doc("tiendas/" + storeId + "/productos/" + it.id);
          const prodDoc = await prodRef.get();
          if (!prodDoc.exists) return;
          const prod = prodDoc.data();
          if (prod.stock === null || prod.stock === undefined || prod.stock === "") return;
          const nuevo = Math.max(0, (Number(prod.stock) || 0) - (Number(it.cantidad) || 1));
          await prodRef.set({ stock: nuevo }, { merge: true });
        } catch (e) {
          console.warn("No se pudo descontar stock de", it.id, ":", e.message);
        }
      }));
    }

    // Registrar el cupón como usado (solo ahora que el pedido quedó confirmado)
    if (cuponFinal) {
      try {
        const cuponesSnap = await db.collection("tiendas/" + storeId + "/cupones")
          .where("codigo", "==", cuponFinal).limit(1).get();
        if (!cuponesSnap.empty) {
          await cuponesSnap.docs[0].ref.set(
            { usosTotales: admin.firestore.FieldValue.increment(1) }, { merge: true }
          );
        }
        if (clienteUid) {
          await db.doc("usuarios/" + clienteUid + "/cupones_usados/" + cuponFinal)
            .set({ fecha: ahora, pedidoId: id }, { merge: true });
        }
      } catch (e) {
        console.warn("No se pudo registrar el cupón usado:", e.message);
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: true, pedidoId: id, pedido: pedidoObj })
    };
  } catch (e) {
    console.error("crearPedidoEfectivo error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message || "Error desconocido" }) };
  }
};
