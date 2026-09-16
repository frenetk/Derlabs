/* cloudflare/functions/ultimoPedido.js
   Equivalente a netlify/functions/ultimoPedido.js. Sin dependencias
   externas — conversión de bajo riesgo real. */

import { getDb, corsHeaders, resumenItems } from "./_firebase.js";

export async function ultimoPedido(request, env){
  const headers = corsHeaders();
  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  const url = new URL(request.url);
  let storeId = url.searchParams.get("storeId") || "";
  const hostname = url.searchParams.get("hostname") || "";

  try {
    const db = getDb(env);

    if (!storeId && hostname) {
      const domDoc = await db.collection("dominios").doc(hostname).get();
      if (domDoc.exists && domDoc.data().storeId) {
        storeId = domDoc.data().storeId;
      }
    }
    if (!storeId) storeId = "test-burgers";

    const snap = await db.collection("tiendas/" + storeId + "/pedidos")
      .orderBy("fecha", "desc").limit(1).get();

    if (snap.empty) {
      return new Response(JSON.stringify({ ok: true, pedido: null }), { status: 200, headers });
    }

    const d = snap.docs[0].data();
    const resumen = resumenItems(d.items);

    return new Response(JSON.stringify({
      ok: true,
      pedido: {
        title: "🍔 ¡Nuevo pedido! $" + Number(d.total || 0).toLocaleString("es-CL"),
        body: ((d.cliente && d.cliente.nombre) || "Cliente") + (resumen ? " — " + resumen : ""),
        url: "/pedidos.html"
      }
    }), { status: 200, headers });
  } catch (e) {
    console.error("ultimoPedido error:", e.message);
    return new Response(JSON.stringify({ ok: false, pedido: null }), { status: 200, headers });
  }
}
