/* cloudflare/functions/ping.js — equivalente a netlify/functions/ping.js.
   Health check simple, sin dependencias de npm — la conversión de
   formato acá es 1:1, sin riesgo real: el formato de Netlify Functions
   (exports.handler recibiendo event/context, devolviendo
   {statusCode, headers, body}) se reemplaza por el formato de Worker
   (una función fetch(request) que devuelve un Response real), pero la
   lógica en sí no cambia nada. */
export default {
  async fetch(request) {
    return new Response(
      JSON.stringify({ ok: true, ts: new Date().toISOString() }),
      { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } }
    );
  }
};
