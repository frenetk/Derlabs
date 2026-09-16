/* netlify/functions/limpiarPendientes.js
   Scheduled function — Netlify la ejecuta automáticamente cada 5 minutos
   (definido acá mismo con schedule(), no en netlify.toml).

   Borra los intentos_pago que quedaron en estado "iniciado" por más de
   30 minutos — el cliente probablemente cerró el checkout sin
   completar el pago, caso normal y esperable. Nunca borra los que
   están en "error", esos quedan para revisión manual en devmode (tab
   Pagos → "Intentos de pago sin confirmar"), porque un "error" implica
   que el pago sí se confirmó con MercadoPago pero algo falló creando
   el pedido — información valiosa que no debe perderse. */

const { schedule } = require("@netlify/functions");
const { getDb } = require("./_firebase");

const MINUTOS_LIMITE = 30;

const handler = async function(event){
  try {
    const db = getDb();
    const limite = new Date(Date.now() - MINUTOS_LIMITE * 60 * 1000).toISOString();

    // Recorrer todas las tiendas registradas
    const tiendasSnap = await db.collection("tiendas").get();
    let totalBorrados = 0;

    for (const tiendaDoc of tiendasSnap.docs) {
      const storeId = tiendaDoc.id;
      const pendientesSnap = await db
        .collection("tiendas/" + storeId + "/intentos_pago")
        .where("estado", "==", "iniciado")
        .where("creadoEn", "<", limite)
        .get();

      if (pendientesSnap.empty) continue;

      const batch = db.batch();
      pendientesSnap.docs.forEach(function(doc){
        batch.delete(doc.ref);
      });
      await batch.commit();
      totalBorrados += pendientesSnap.size;
      console.log("Borrados " + pendientesSnap.size + " intentos de pago sin completar en " + storeId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, totalBorrados })
    };
  } catch (e) {
    console.error("limpiarPendientes error:", e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};

exports.handler = schedule("*/5 * * * *", handler);
