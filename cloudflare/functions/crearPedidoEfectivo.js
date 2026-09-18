/* cloudflare/functions/crearPedidoEfectivo.js
   Equivalente a netlify/functions/crearPedidoEfectivo.js. Sin
   dependencias de proveedor externo — solo _firebase.js. Conversión
   de bajo riesgo real, mismo patrón que las anteriores. */

import { getDb, corsHeaders, validarPedidoCompleto, admin } from "./_firebase.js";

export async function crearPedidoEfectivo(request, env){
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
    const clienteUid = cliente && cliente.uid ? cliente.uid : null;
    const val = await validarPedidoCompleto(db, storeId, items, costoDelivery, cuponAplicado, clienteUid);
    if (!val.ok) {
      return new Response(JSON.stringify({ ok: false, error: val.error }), { status: 400, headers });
    }
    const { itemsValidados, subtotal, costoDelivery: costoDeliveryReal, descuento, cuponFinal, total } = val;

    const itemsConVariantes = itemsValidados.map(function(it){
      const itemOriginal = (items || []).find(function(i){ return i.id === it.id; }) || {};
      return Object.assign({}, it, {
        variantes: itemOriginal.variantes || null,
        notaPersonal: itemOriginal.notaPersonal || null
      });
    });

    const id = pedidoId || ("TB" + Date.now().toString().slice(-5));
    const ahora = new Date().toISOString();

    const pedidoObj = {
      id, storeId, tipo, cliente,
      items: itemsConVariantes, subtotal, descuento, cuponAplicado: cuponFinal,
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

    if (Array.isArray(itemsConVariantes)) {
      await Promise.all(itemsConVariantes.map(async function(it){
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

    return new Response(
      JSON.stringify({ ok: true, pedidoId: id, pedido: pedidoObj }),
      { status: 200, headers }
    );
  } catch (e) {
    console.error("crearPedidoEfectivo error:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message || "Error desconocido" }), { status: 500, headers });
  }
}
