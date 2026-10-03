/* cloudflare/functions/manifestTienda.js
   Equivalente a netlify/functions/manifestTienda.js. Sin dependencias
   más allá de _firebase.js — conversión de bajo riesgo, la única
   diferencia real es cómo se lee el hostname (request.headers.get en
   vez de event.headers) y que getDb ahora recibe env. */

import { getDb, corsHeaders } from "./_firebase.js";

export async function manifestTienda(request, env){
  const headers = Object.assign({}, corsHeaders(), {
    "Content-Type": "application/manifest+json",
    "Cache-Control": "public, max-age=300"
  });

  try {
    const db = getDb(env);
    const hostname = new URL(request.url).hostname;

    let storeId = "test-burgers";
    if (hostname) {
      const domDoc = await db.collection("dominios").doc(hostname).get();
      if (domDoc.exists && domDoc.data().storeId) {
        storeId = domDoc.data().storeId;
      }
    }

    const cfgDoc = await db.doc("tiendas/" + storeId + "/config/general").get();
    const cfg = cfgDoc.exists ? cfgDoc.data() : {};
    const nombre = cfg.nombre || "Gestor de pedidos";
    const color = cfg.colorPrimario || "#9B1B30";
    const icono = cfg.logoBase64 || null;

    const manifest = {
      name: nombre,
      short_name: nombre.length > 12 ? nombre.slice(0, 12) : nombre,
      start_url: "/pedidos.html",
      scope: "/",
      display: "standalone",
      background_color: "#0E0E0E",
      theme_color: color,
      icons: icono
        ? [{ src: icono, sizes: "192x192 512x512", type: "image/png", purpose: "any" }]
        : []
    };

    return new Response(JSON.stringify(manifest), { headers });
  } catch (e) {
    console.error("manifestTienda error:", e.message);
    return new Response(
      JSON.stringify({ name: "Gestor de pedidos", start_url: "/pedidos.html", display: "standalone" }),
      { headers }
    );
  }
}
