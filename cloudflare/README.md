# Migración a Cloudflare Workers — estado y guía de deploy

## Estado real, sin adornarlo

Todo el código de esta carpeta está **verificado por lectura y por
pruebas aisladas**, no por un deploy real contra la infraestructura de
Cloudflare — este entorno de trabajo no tiene acceso de red para
instalar `wrangler` ni correr `wrangler dev`. Cada archivo tiene, en su
propio comentario, el nivel de certeza real:

- **Alto, con prueba matemática real**: `notificar.js` — el cifrado
  Web Push (RFC 8291) se verificó contra el vector de prueba oficial
  publicado en el Apéndice A del propio RFC, y coincide byte a byte.
  La firma VAPID (RFC 8292) se probó generando un par de claves real,
  firmando, y verificando la firma con `crypto.subtle.verify` — válida.
- **Medio-alto**: `crearPago.js`, `webhookPago.js`,
  `crearSuscripcionPlataforma.js`, `webhookSuscripcion.js`,
  `enviarEmails.js` — usan `mercadopago` y `resend`, dos paquetes que
  ya documentan `import` como su forma de uso estándar (menor riesgo
  de interop CJS/ESM que `firebase-admin`).
- **Medio**: todo lo que depende de `_firebase.js` para Firestore
  (`crearTienda.js`, `listarSuscripciones.js`, etc.) — hay evidencia de
  un proyecto real (Striae) usando `firebase-admin` v14 en producción
  sobre Workers, pero también evidencia de que no es un camino sin
  fricción (existe un paquete alternativo, `firebase-admin-rest`,
  creado específicamente por esa fricción).

**Antes de considerar esto "en producción", correr `wrangler dev`
localmente y probar cada función una por una** — en particular un
pedido completo de punta a punta (crear con MercadoPago, confirmar por
webhook, que llegue el email y la notificación push) es la prueba real
que ningún análisis por lectura reemplaza.

## Qué reemplaza a qué

| Netlify | Cloudflare | Nota |
|---|---|---|
| `netlify.toml` (redirects) | `cloudflare/worker.js` (lógica) + `cloudflare/wrangler.toml` (config) | El enrutamiento por `Host` no tiene equivalente declarativo en Cloudflare — es código |
| `netlify/functions/*.js` | `cloudflare/functions/*.js` | Mismo nombre de archivo, formato distinto (`export default { fetch }` en vez de `exports.handler`) |
| `@netlify/functions` `schedule()` | `[triggers]` en `wrangler.toml` + handler `scheduled()` | Mismo cron (`*/5 * * * *`), mecanismo distinto |
| Netlify → Domain management | `[[routes]]` en `wrangler.toml`, con `custom_domain = true` | Versionado junto al código, no un paso manual del dashboard |
| Variables de entorno (Site settings) | `wrangler secret put` o el dashboard | Ver abajo |

## Variables de entorno a configurar en Cloudflare

Ninguna se migra sola — hay que volver a cargarlas, una por una, en el
nuevo lugar. Con `wrangler` instalado y logueado (`wrangler login`):

```bash
wrangler secret put FIREBASE_SERVICE_ACCOUNT   # el JSON completo de la cuenta de servicio, en una línea
wrangler secret put ADMIN_SECRET
wrangler secret put MP_ACCESS_TOKEN
wrangler secret put PLATAFORMA_MP_TOKEN
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
```

O desde el dashboard: Workers & Pages → tu Worker → Settings →
Variables and Secrets → Add.

## Pasos de deploy, en orden

1. Instalar Wrangler (no incluido en este proyecto):
   `npm install -g wrangler`
2. `wrangler login` — autoriza contra tu cuenta de Cloudflare.
3. `cd cloudflare/`
4. Cargar las 7 variables de entorno (ver arriba).
5. **Probar local primero**: `wrangler dev` — abre `localhost:8787`,
   probar la tienda, el checkout, el devmode. Los Cron Triggers no se
   disparan solos en local — para probar `limpiarPendientes` a mano,
   en otra terminal (con `wrangler dev` corriendo):
   `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"`
   Si esa ruta da 404, es porque tu versión de Wrangler todavía exige
   el flag `--test-scheduled` al arrancar (documentado en versiones
   anteriores, no siempre necesario en las más recientes) — reintentar
   así:
   `wrangler dev --test-scheduled` y, en la otra terminal, el mismo
   `curl` de arriba. Confirmado además un issue real y abierto
   (`cloudflare/workers-sdk#9882`) con fricción específica cuando el
   proyecto usa `[assets]` como este — si ninguna de las dos formas
   dispara el log de `limpiarPendientes` en la consola de `wrangler
   dev`, no asumir que la función está mal: puede ser ese problema
   conocido de la herramienta, no del código.
6. `wrangler deploy` — publica de verdad, y con los 3 bloques
   `[[routes]]` ya en `wrangler.toml`, este mismo comando deja
   `derlabs.cl`, `www.derlabs.cl` y `derlabs.store` configurados como
   Custom Domains del Worker — no hace falta un paso aparte en el
   dashboard para eso, a diferencia de lo que decía una versión
   anterior de esta guía.
7. Apuntar el DNS de ambos dominios a Cloudflare (nameservers) — el
   propio `wrangler deploy` del paso anterior crea el registro DNS de
   cada Custom Domain automáticamente en la zona correspondiente,
   siempre que el dominio ya esté agregado a tu cuenta de Cloudflare
   como zona (Websites → Add a site, si todavía no lo está).
   **Si después del deploy el dominio sigue sin responder**
   (`ERR_NAME_NOT_RESOLVED` o similar): la documentación oficial de
   Cloudflare menciona que a veces hace falta un registro placeholder
   primero — agregar manualmente un registro `AAAA` proxied (nube
   naranja) apuntando a `100::` en esa zona, y reintentar.
8. En MercadoPago (ambas cuentas: la de cada cliente y la de la
   plataforma), verificar que los webhooks configurados apunten a las
   rutas nuevas:
   - `https://derlabs.store/api/webhookPago` (por tienda, se genera
     solo al crear cada `crearPago.js`, no hace falta tocar nada a
     mano ahí — la URL vieja de Netlify en cualquier preferencia ya
     creada seguirá apuntando a un sitio que puede dejar de existir).
   - `https://derlabs.cl/api/webhookSuscripcion` — este sí necesita
     reconfigurarse a mano en el panel de MercadoPago de la
     plataforma (ver LEEME.md, sección 14, paso 3 — la URL cambió).

## Lo que NO se tocó, a propósito

El proyecto de Netlify (`netlify.toml`, `netlify/functions/`) se deja
intacto — no se borra nada. Mientras no se apunten los dominios reales
a Cloudflare, el sitio en Netlify sigue siendo el que está en
producción. La migración es un cambio de DNS al final, no un
apagado-y-prendido — se puede probar Cloudflare completo en su propio
subdominio de prueba (`*.workers.dev`) sin ningún riesgo para lo que
ya funciona.
