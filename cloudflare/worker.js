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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* ── Ruta especial: /manifest.json — el navegador la pide sola al
       ver <link rel="manifest"> en pedidos.html, nunca la arma
       ningún JS del frontend, así que no puede pasar por el patrón
       genérico de abajo. ── */
    if (url.pathname === "/manifest.json") {
      return manifestTienda(request, env);
    }

    /* ── Rutas de función: ambos patrones, viejo y nuevo (ver nota de
       compatibilidad arriba). ── */
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

    /* ── Landing de marca por dominio (ver comentario original de
       este archivo, antes de la integración) — se evalúa DESPUÉS de
       las rutas de función/manifest, para que esas nunca queden
       atrapadas por esta regla incluso si alguna vez se sirven desde
       el mismo hostname que el landing. ── */
    if (DOMINIOS_LANDING.includes(url.hostname)) {
      const urlLanding = new URL(request.url);
      urlLanding.pathname = "/landing.html";
      return env.ASSETS.fetch(new Request(urlLanding, request));
    }

    // Cualquier otra ruta: archivo estático normal (index.html, pedidos.html, etc.)
    return env.ASSETS.fetch(request);
  },

  /* ── Cron Trigger — reemplaza schedule() de @netlify/functions.
     El cron en sí (cada 5 minutos) se declara en wrangler.toml, acá
     solo vive la lógica que corre cuando dispara. ── */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(limpiarPendientes(env));
  }
};
