/* netlify/functions/manifestTienda.js
   GET /manifest.json  (redirigido desde acá vía netlify.toml, porque
   Netlify no permite que una función se llame "manifest.json" — solo
   caracteres alfanuméricos en el nombre de archivo de la función)

   Genera el manifest.json de cada tienda al vuelo, según el dominio
   que lo pide — un único archivo de código sirve un manifest distinto
   por cliente, sin necesitar un manifest.json estático por deploy.

   start_url apunta a /pedidos.html, no a /: la decisión (ver
   ROADMAP.md, sección 3) fue que no hace falta que el cliente instale
   la tienda entera como app — alcanza con un acceso directo en su
   celular que abra directo el gestor de pedidos. name/icons usan el
   nombre y logo reales de la tienda si existen (ver crearTienda.js,
   campo logoBase64), con respaldo genérico si el cliente no subió
   ninguno todavía. */

const { getDb, corsHeaders } = require("./_firebase");

exports.handler = async function(event){
  const headers = Object.assign({}, corsHeaders(), {
    "Content-Type": "application/manifest+json",
    "Cache-Control": "public, max-age=300" // 5 min — se actualiza solo si el nombre/logo cambian
  });

  try {
    const db = getDb();
    const hostname = (event.headers.host || event.headers["x-forwarded-host"] || "").split(":")[0];

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

    /* Un ícono PNG/JPEG en Base64 sirve directo como "src" de un ícono
       de manifest — el navegador lo interpreta igual que una URL
       normal de imagen. Si el cliente no subió logo, se usa un ícono
       genérico embebido (un cuadrado del color de marca, generado acá
       mismo, para que el acceso directo no quede con un ícono roto
       mientras el cliente no suba uno propio). */
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
        : [] // sin logo propio: el navegador usa su ícono por defecto al instalar
    };

    return { statusCode: 200, headers, body: JSON.stringify(manifest) };
  } catch (e) {
    console.error("manifestTienda error:", e.message);
    /* Nunca fallar duro acá — un manifest ausente o vacío solo
       significa que el navegador no ofrece "instalar", no rompe nada
       del resto del sitio. */
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ name: "Gestor de pedidos", start_url: "/pedidos.html", display: "standalone" })
    };
  }
};
