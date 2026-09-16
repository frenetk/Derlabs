/* netlify/functions/ping.js
   Health check simple — usado por el botón "Verificar conexión" en devmode. */
exports.handler = async function(event){
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, ts: new Date().toISOString() })
  };
};
