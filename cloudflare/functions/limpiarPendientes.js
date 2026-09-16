/* cloudflare/functions/limpiarPendientes.js
   Equivalente a netlify/functions/limpiarPendientes.js, pero con un
   mecanismo estructuralmente distinto: Netlify usa @netlify/functions
   schedule() envolviendo un handler HTTP normal; Cloudflare no tiene
   ese paquete — usa Cron Triggers, declarados en [triggers] dentro de
   wrangler.toml (mismo cron cada 5 minutos, sin traducción de sintaxis
   necesaria), con un handler separado llamado scheduled(controller,
   env, ctx), no fetch(). El worker.js principal importa y llama a
   esta función desde su propio export scheduled. */

import { getDb } from "./_firebase.js";

const MINUTOS_LIMITE = 30;

export async function limpiarPendientes(env){
  try {
    const db = getDb(env);
    const limite = new Date(Date.now() - MINUTOS_LIMITE * 60 * 1000).toISOString();

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

    return { ok: true, totalBorrados };
  } catch (e) {
    console.error("limpiarPendientes error:", e);
    return { ok: false, error: e.message };
  }
}
