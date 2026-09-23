/* cloudflare/worker.js — punto de entrada único del sitio completo en
   Cloudflare. Reemplaza tres cosas que en Netlify vivían separadas:
   (1) netlify.toml (redirects declarativos), (2) la carpeta
   netlify/functions/ (cada archivo se desplegaba solo, como su propia
   ruta), y (3) el schedule() de limpiarPendientes.js.

   DECISIÓN DE COMPATIBILIDAD: el frontend (index.html, landing.html,
   generar-tienda.html, suscripciones.html) llama a las funciones por
   la ruta vieja "/.netlify/functions/{nombre}" — en vez de reescribir
   esas ~6 llamadas repartidas en 4 archivos HTML (arriesgado, ya
   funcionan bien tal como están), este Worker reconoce AMBAS rutas:
   la vieja (compatibilidad, sin tocar el frontend) y una nueva más
   corta "/api/{nombre}" (la que ya usan crearPago.js/webhookPago.js
   internamente, para las notification_url que arma MercadoPago). */

import { ping } from "./functions/ping.js";
import { manifestTienda } from "./functions/manifestTienda.js";
import { crearTienda } from "./functions/crearTienda.js";
import { listarSuscripciones } from "./functions/listarSuscripciones.js";
import { crearPedidoEfectivo } from "./functions/crearPedidoEfectivo.js";
import { crearPago } from "./functions/crearPago.js";
import { webhookPago } from "./functions/webhookPago.js";
import { enviarEmails } from "./functions/enviarEmails.js";
import { crearSuscripcionPlataforma } from "./functions/crearSuscripcionPlataforma.js";
import { webhookSuscripcion } from "./functions/webhookSuscripcion.js";
import { notificar } from "./functions/notificar.js";
import { ultimoPedido } from "./functions/ultimoPedido.js";
import { limpiarPendientes } from "./functions/limpiarPendientes.js";
import { getDb } from "./functions/_firebase.js";

const DOMINIOS_LANDING = ["derlabs.cl", "www.derlabs.cl"];

/* Mapa nombre de función → handler. Un solo lugar para agregar una
   función nueva en el futuro, en vez de tener que tocar el switch de
   enrutamiento en dos lugares distintos (ruta vieja y ruta nueva). */
const FUNCIONES = {
  ping,
  manifestTienda,
  crearTienda,
  listarSuscripciones,
  crearPedidoEfectivo,
  crearPago,
  webhookPago,
  enviarEmails,
  crearSuscripcionPlataforma,
  webhookSuscripcion,
  notificar,
  ultimoPedido
};


/* ════════════════════════════════════════════════════════════════
   INYECCIÓN DE NOMBRE REAL EN EL HTML
   Antes de servir el HTML, consulta Firestore para obtener el
   nombre real de la tienda según el hostname, y lo reemplaza en el
   HTML antes de enviarlo al navegador. Así el usuario nunca ve
   "TEST BURGERS" momentáneamente — ve directamente el nombre real.

   Cachea el resultado 5 minutos en el edge de Cloudflare para no
   golpear Firestore en cada request.
   ════════════════════════════════════════════════════════════════ */
async function inyectarNombreReal(html, hostname, env, ctx) {
  try {
    /* Caché de 5 min para no golpear Firestore en cada visita */
    const cacheKey = new Request("https://cache.local/tenant/" + hostname);
    const cache = caches.default;
    let config = null;

    const cached = await cache.match(cacheKey);
    if (cached) {
      config = await cached.json();
    } else {
      /* Resolver storeId desde el hostname */
      const db = getDb(env);
      const domSnap = await db.collection("dominios").doc(hostname).get();
      if (!domSnap.exists) return html; /* dominio no registrado — devolver HTML original */
      const storeId = domSnap.data().storeId;
      if (!storeId) return html;

      /* Leer config/general de esa tienda */
      const cfgSnap = await db.collection("tiendas").doc(storeId).collection("config").doc("general").get();
      if (!cfgSnap.exists) return html;
      const data = cfgSnap.data();

      config = {
        nombre: data.nombre || "",
        logoBase64: data.logoBase64 || ""
      };

      /* Guardar en caché del edge 5 min */
      const respCache = new Response(JSON.stringify(config), {
        headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" }
      });
      ctx.waitUntil(cache.put(cacheKey, respCache));
    }

    if (!config || !config.nombre) return html;

    /* Escapar el nombre para que no rompa el HTML */
    const nombreSeguro = String(config.nombre)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    /* Reemplazos */
    /* 1. Título de la pestaña */
    html = html.replace(/<title>[^<]*<\/title>/, "<title>" + nombreSeguro + "</title>");

    /* 2. Logo (texto por defecto) — solo reemplazamos texto dentro del span #logoTexto */
    html = html.replace(
      /(<span[^>]*id="logoTexto"[^>]*>)[^<]*(<\/span>)/,
      "$1" + nombreSeguro + "$2"
    );

    /* 3. Todos los data-bind="nombre" que tengan contenido de texto */
    html = html.replace(
      /(<[^>]*data-bind="nombre"[^>]*>)[^<]*(<\/[^>]+>)/g,
      "$1" + nombreSeguro + "$2"
    );

    /* 4. og:title si existe */
    html = html.replace(
      /(<meta[^>]*property="og:title"[^>]*content=")[^"]*(")/,
      "$1" + nombreSeguro + "$2"
    );

    return html;
  } catch(e) {
    /* Si algo falla (Firestore, red, etc.), devolver el HTML sin tocar */
    console.error("inyectarNombreReal:", e.message);
    return html;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* ── Ruta especial: /manifest.json ── */
    if (url.pathname === "/manifest.json") {
      return manifestTienda(request, env);
    }

    /* ── Rutas de función: ambos patrones, viejo y nuevo. ── */
    let nombreFuncion = null;
    if (url.pathname.startsWith("/.netlify/functions/")) {
      nombreFuncion = url.pathname.slice("/.netlify/functions/".length);
    } else if (url.pathname.startsWith("/api/")) {
      nombreFuncion = url.pathname.slice("/api/".length);
    }
    if (nombreFuncion && FUNCIONES[nombreFuncion]) {
      try {
        return await FUNCIONES[nombreFuncion](request, env);
      } catch (e) {
        console.error("Error en función " + nombreFuncion + ":", e.message);
        return new Response(JSON.stringify({ ok: false, error: e.message || "Error desconocido" }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    /* ── Landing de marca por dominio, EXCEPTO generar-tienda.html
       y suscripciones.html, que el propio devmode del landing enlaza
       y necesitan responder acá mismo, no quedar atrapadas por esta
       regla. ── */
        /* ── Inyección de nombre real en el HTML ──
       Antes de servir / o /index.html, reemplaza "TEST BURGERS" por
       el nombre real de la tienda (leído de Firestore, cacheado 5 min).
       Esto elimina el flash donde el usuario ve el nombre por defecto. */
    const esHTML = (url.pathname === "/" || url.pathname === "" || url.pathname === "/index.html");
    if (esHTML) {
      try {
        /* Forzar rewrite a /index.html antes de pedirle a Assets.
           Con html_handling:none, Cloudflare NO mapea "/" -> "/index.html"
           automáticamente, así que hay que reescribir la URL acá. */
        const urlIndex = new URL(request.url);
        urlIndex.pathname = "/index.html";
        const respuesta = await env.ASSETS.fetch(new Request(urlIndex, request));
        const html = await respuesta.text();
        const htmlInyectado = await inyectarNombreReal(html, url.hostname, env, ctx);
        return new Response(htmlInyectado, {
          status: respuesta.status,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=0, must-revalidate"
          }
        });
      } catch(e) {
        console.error("Error inyectando nombre:", e.message);
        return env.ASSETS.fetch(request);
      }
    }

    if (DOMINIOS_LANDING.includes(url.hostname) && (url.pathname === "/" || url.pathname === "")) {
      const urlLanding = new URL(request.url);
      urlLanding.pathname = "/landing.html";
      return env.ASSETS.fetch(new Request(urlLanding, request));
    }
    /* ── Con html_handling="none", Cloudflare Assets ya NO mapea "/" a
       index.html automáticamente. Hay que reescribir explícitamente. ── */
    if (url.pathname === "/" || url.pathname === "") {
      const urlIndex = new URL(request.url);
      urlIndex.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(urlIndex, request));
    }

    // Cualquier otra ruta: archivo estático normal (index.html, pedidos.html, etc.)
    return env.ASSETS.fetch(request);
  },

  /* ── Cron Trigger. ── */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(limpiarPendientes(env));
  }
};
