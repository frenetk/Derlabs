/* cloudflare/functions/ping.js — equivalente a netlify/functions/ping.js.
   Health check simple, sin dependencias de npm.

   Formato Worker: función exportada con nombre, recibe (request, env)
   y devuelve un Response real. Es la misma convención que usan todas
   las demás funciones en cloudflare/functions/ — así worker.js puede
   importarla como `import { ping } from "./functions/ping.js"`. */

export async function ping(request, env) {
  return new Response(
    JSON.stringify({ ok: true, ts: new Date().toISOString() }),
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    }
  );
}
