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
import { recuperarClave } from "./functions/recuperarClave.js";
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
import { guardarLead } from "./functions/guardarLead.js";
import { gestionLeads } from "./functions/gestionLeads.js";
import { seguimientoPedido } from "./functions/seguimientoPedido.js";
import { gestionRepartidores, delivery } from "./functions/repartidores.js";
import { cajaLocal } from "./functions/cajaLocal.js";
import { landingEditor, servirImagenLanding } from "./functions/landingEditor.js";
import { dominios, revisarDominios } from "./functions/dominios.js";

const DOMINIOS_LANDING = ["derlabs.cl", "www.derlabs.cl"];

/* Mapa nombre de función → handler. Un solo lugar para agregar una
   función nueva en el futuro, en vez de tener que tocar el switch de
   enrutamiento en dos lugares distintos (ruta vieja y ruta nueva). */
const FUNCIONES = {
  ping,
  recuperarClave,
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
  ultimoPedido,
  guardarLead,
  gestionLeads,
  seguimientoPedido,
  gestionRepartidores,
  delivery,
  cajaLocal,
  landingEditor,
  dominios
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
async function leerConfigTenant(hostname, env, ctx) {
  try {
    const cacheKey = new Request("https://cache.local/tenant/" + hostname);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return await cached.json();

    const db = getDb(env);
    const domSnap = await db.collection("dominios").doc(hostname).get();
    if (!domSnap.exists) return null;
    const storeId = domSnap.data().storeId;
    if (!storeId) return null;

    const cfgSnap = await db.collection("tiendas").doc(storeId)
      .collection("config").doc("general").get();
    if (!cfgSnap.exists) return null;
    const data = cfgSnap.data();

    const config = {
      nombre: data.nombre || "",
      logoBase64: data.logoBase64 || "",
      rubro: data.rubro || "comida",
      plantilla: data.plantilla || "",
      dominioPrincipal: data.dominioPrincipal || ""
    };

    const respCache = new Response(JSON.stringify(config), {
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" }
    });
    ctx.waitUntil(cache.put(cacheKey, respCache));
    return config;
  } catch(e) {
    console.error("leerConfigTenant:", e.message);
    return null;
  }
}

/* Plantilla de la tienda: config.plantilla manda ("boutique"); si no, el rubro */
function archivoPlantilla(cfg){
  if (cfg && cfg.plantilla === "boutique") return "/index-boutique.html";
  return (cfg && cfg.rubro === "retail") ? "/index-retail.html" : "/index.html";
}

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
        logoBase64: data.logoBase64 || "",
        rubro: data.rubro || "comida",
        plantilla: data.plantilla || "",
      dominioPrincipal: data.dominioPrincipal || ""
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

/* ════════════════════════════════════════════════════════════════
   LANDING EDITABLE (derlabs.cl)
   El editor visual (derlabs.cl/editar) guarda el HTML final en el KV
   "LANDING". El público recibe esa versión tal cual: sin Firebase en el
   navegador, sin parpadeo de textos viejos. Si todavía no hay versión
   publicada (o el KV no está conectado), se sirve landing.html.
   ════════════════════════════════════════════════════════════════ */
async function leerLandingPublicada(env){
  try { return env.LANDING ? await env.LANDING.get("publicada", { cacheTtl: 60 }) : null; }
  catch(e){ console.error("KV publicada:", e.message); return null; }
}
async function servirEditorLanding(request, env){
  let html = null, origen = "base";
  try {
    if (env.LANDING){
      html = await env.LANDING.get("borrador");
      if (html) origen = "borrador";
      else { html = await env.LANDING.get("publicada"); if (html) origen = "publicada"; }
    }
  } catch(e){ html = null; }
  if (!html){
    const u = new URL(request.url); u.pathname = "/landing.html";
    html = await (await env.ASSETS.fetch(new Request(u, request))).text();
    origen = "base";
  }
  const cabeza = '<meta name="robots" content="noindex, nofollow" data-ed-ui>';
  const pie = '<script data-ed-ui>window.__ED_ORIGEN=' + JSON.stringify(origen) + ';window.__ED_KV=' + (env.LANDING ? "true" : "false") + ';</script>'
            + '<script src="/landing-editor.js?v=1" data-ed-ui></script>';
  const iH = html.indexOf("</head>");
  if (iH > -1) html = html.slice(0, iH) + cabeza + html.slice(iH);
  const iB = html.lastIndexOf("</body>");
  html = iB > -1 ? html.slice(0, iB) + pie + html.slice(iB) : html + pie;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function tiendaNoEncontrada(){
  const html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Tienda no encontrada</title>'
    + '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#F6F5FB;color:#1B1B21;text-align:center;padding:24px}a{color:#6C5CE7;font-weight:700}</style></head>'
    + '<body><div><h1 style="font-size:24px">Esta tienda no existe</h1><p>Revisa que la dirección esté bien escrita.</p><p><a href="https://derlabs.cl">¿Quieres tu propia tienda? Conoce DerLabs →</a></p></div></body></html>';
  return new Response(html, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* ── Ruta especial: /manifest.json ── */
    if (url.pathname === "/manifest.json") {
      return manifestTienda(request, env);
    }

    /* ── www.dominio-del-cliente → dominio sin www (los de DerLabs se manejan aparte) ── */
    if (url.hostname.startsWith("www.") && !DOMINIOS_LANDING.includes(url.hostname)) {
      return Response.redirect("https://" + url.hostname.slice(4) + url.pathname + url.search, 301);
    }
    /* ── Conectar mi dominio: tienda.cl/dominio ── */
    if (url.pathname === "/dominio" || url.pathname === "/dominio/") {
      const urlDom = new URL(request.url); urlDom.pathname = "/dominio.html";
      return env.ASSETS.fetch(new Request(urlDom, request));
    }
    /* ── Pantalla de cocina (comandas): tienda.cl/cocina ── */
    if (url.pathname === "/cocina" || url.pathname === "/cocina/") {
      const urlCo = new URL(request.url); urlCo.pathname = "/cocina.html";
      return env.ASSETS.fetch(new Request(urlCo, request));
    }
    /* ── Caja local (restaurante): tienda.cl/caja ── */
    if (url.pathname === "/caja" || url.pathname === "/caja/") {
      const urlCaja = new URL(request.url); urlCaja.pathname = "/caja.html";
      return env.ASSETS.fetch(new Request(urlCaja, request));
    }
    /* ── Gestor del repartidor: tienda.cl/delivery ── */
    if (url.pathname === "/delivery" || url.pathname === "/delivery/") {
      const urlDel = new URL(request.url); urlDel.pathname = "/delivery.html";
      return env.ASSETS.fetch(new Request(urlDel, request));
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

    /* ── Landing editable: imágenes del editor, /editar y versión publicada ── */
    if (url.pathname.startsWith("/limg/")) return servirImagenLanding(url.pathname.slice(6), env);
    if (DOMINIOS_LANDING.includes(url.hostname)){
      if (url.pathname === "/editar" || url.pathname === "/editar/") return servirEditorLanding(request, env);
      if (url.pathname === "/" || url.pathname === "" || url.pathname === "/landing.html"){
        const pub = await leerLandingPublicada(env);
        if (pub) return new Response(pub, { headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=0, must-revalidate"
        }});
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
    /* Solo aplica a tiendas (no al landing de DerLabs) */
    const esLanding = DOMINIOS_LANDING.includes(url.hostname);
    const esHTML = !esLanding && (url.pathname === "/" || url.pathname === "" || url.pathname === "/index.html");
    if (esHTML) {
      try {
        /* Forzar rewrite a /index.html antes de pedirle a Assets.
           Con html_handling:none, Cloudflare NO mapea "/" -> "/index.html"
           automáticamente, así que hay que reescribir la URL acá. */
        /* Elegir template segun rubro */
        const cfgTpl = await leerConfigTenant(url.hostname, env, ctx);
        /* Subdominio *.derlabs.store que no corresponde a ninguna tienda */
        if (!cfgTpl && url.hostname.endsWith(".derlabs.store")) return tiendaNoEncontrada();
        /* Subdominio de una tienda que ya conectó su dominio propio → lleva al dominio propio */
        if (cfgTpl && cfgTpl.dominioPrincipal && url.hostname.endsWith(".derlabs.store") && cfgTpl.dominioPrincipal !== url.hostname) {
          return Response.redirect("https://" + cfgTpl.dominioPrincipal + url.pathname + url.search, 301);
        }
        const archivoTpl = archivoPlantilla(cfgTpl);

        const urlIndex = new URL(request.url);
        urlIndex.pathname = archivoTpl;
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
        const cfgFb = await leerConfigTenant(url.hostname, env, ctx);
        const urlIndex = new URL(request.url);
        urlIndex.pathname = archivoPlantilla(cfgFb);
        return env.ASSETS.fetch(new Request(urlIndex, request));
    }

    // Cualquier otra ruta: archivo estático normal (index.html, pedidos.html, etc.)
    return env.ASSETS.fetch(request);
  },

  /* ── Cron Trigger. ── */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(limpiarPendientes(env));
    ctx.waitUntil(revisarDominios(env));
  }
};
