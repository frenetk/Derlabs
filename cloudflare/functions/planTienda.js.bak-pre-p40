/* cloudflare/functions/planTienda.js
   PLANES de DerLabs:
     basico → tienda online, gestor de pedidos, GPS y repartidores.
     pro    → todo lo anterior + caja local, mesas, cocina e impresión.

   La verdad del plan vive en planes/{storeId} (colección que las reglas de
   Firestore no abren a nadie: solo se lee y escribe desde aquí, con la
   cuenta de servicio). En config/general se guarda una copia (plan y
   cajaLocal) solo para que el panel y la caja sepan qué mostrar; si el
   dueño de una tienda la cambia a mano, el servidor igual revisa planes/.

   /api/planTienda (clave de administrador, igual que crearTienda):
     { accion:"listar" }                    → tiendas con su plan
     { accion:"cambiar", storeId, plan }    → cambia el plan de una tienda */
import { getDb, corsHeaders } from "./_firebase.js";

export const PLANES = ["basico", "pro"];
const _cache = new Map();          /* storeId → { plan, t } (por instancia del Worker) */
const CACHE_MS = 60000;

/* Plan vigente de una tienda. cfg = config/general ya leída (para las
   tiendas antiguas que aún no tienen documento en planes/). */
export async function planDe(db, storeId, cfg){
  const c = _cache.get(storeId);
  if (c && Date.now() - c.t < CACHE_MS) return c.plan;
  let plan = null;
  try {
    const d = await db.doc("planes/" + storeId).get();
    if (d.exists && PLANES.indexOf(d.data().plan) >= 0) plan = d.data().plan;
  } catch (e) { console.warn("planDe:", e.message); }
  if (!plan) plan = cfg && cfg.cajaLocal === true ? "pro" : "basico";
  _cache.set(storeId, { plan, t: Date.now() });
  return plan;
}

/* Lo usa crearTienda al dar de alta una tienda nueva */
export async function fijarPlan(db, storeId, plan){
  const p = PLANES.indexOf(plan) >= 0 ? plan : "basico";
  await db.doc("planes/" + storeId).set({ plan: p, cambiadoEn: new Date().toISOString() }, { merge: true });
  _cache.delete(storeId);
  return p;
}

/* Misma regla que enviarEmails.js: lo que no es retail ni boutique es comida
   (las tiendas más antiguas guardan el subrubro en "rubro"). */
const esComida = cfg => cfg.plantilla !== "boutique" && cfg.rubro !== "retail";

export async function planTienda(request, env){
  const headers = Object.assign({}, corsHeaders(), { "Cache-Control": "no-store" });
  const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers });
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers });
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);
  const secreto = env.ADMIN_SECRET;
  if (!secreto) return json({ ok: false, error: "ADMIN_SECRET no está configurado en Cloudflare" }, 500);
  if (request.headers.get("x-admin-secret") !== secreto) return json({ ok: false, error: "No autorizado" }, 401);

  let b = {}; try { b = JSON.parse(await request.text() || "{}"); } catch (e) {}
  try {
    const db = getDb(env);

    if (b.accion === "listar"){
      const doms = await db.collection("dominios").get();
      const porTienda = {};
      doms.docs.forEach(function(d){
        const s = d.data().storeId; if (!s) return;
        (porTienda[s] = porTienda[s] || []).push(d.id);
      });
      const ids = Object.keys(porTienda).sort();
      const tiendas = [];
      for (const storeId of ids){
        const [cfgD, planD] = await Promise.all([
          db.doc("tiendas/" + storeId + "/config/general").get(),
          db.doc("planes/" + storeId).get()
        ]);
        if (!cfgD.exists) continue;
        const cfg = cfgD.data();
        let plan = planD.exists && PLANES.indexOf(planD.data().plan) >= 0 ? planD.data().plan : null;
        if (!plan){
          /* tienda anterior a los planes: se deja registrada con lo que ya tenía */
          plan = await fijarPlan(db, storeId, cfg.cajaLocal === true ? "pro" : "basico");
        }
        tiendas.push({ storeId, nombre: cfg.nombre || storeId, comida: esComida(cfg), plan,
                       dominios: porTienda[storeId].sort(function(a, z){ return a.length - z.length; }) });
      }
      return json({ ok: true, tiendas });
    }

    if (b.accion === "cambiar"){
      const storeId = String(b.storeId || "").replace(/[^A-Za-z0-9_-]/g, "");
      const plan = String(b.plan || "");
      if (!storeId || PLANES.indexOf(plan) < 0) return json({ ok: false, error: "Faltan la tienda o el plan" }, 400);
      const ref = db.doc("tiendas/" + storeId + "/config/general");
      const cfgD = await ref.get();
      if (!cfgD.exists) return json({ ok: false, error: "Esa tienda no existe" }, 404);
      if (plan === "pro" && !esComida(cfgD.data())) return json({ ok: false, error: "El plan Pro (caja local) es solo para tiendas de comida" }, 400);
      await fijarPlan(db, storeId, plan);
      await ref.set({ plan, cajaLocal: plan === "pro" }, { merge: true });
      return json({ ok: true, storeId, plan });
    }

    return json({ ok: false, error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error("planTienda:", e.message);
    return json({ ok: false, error: e.message || "Error" }, 500);
  }
}
