/* cloudflare/functions/imagenes.js
   FOTOS DE LAS TIENDAS FUERA DE FIRESTORE.

   Antes cada foto (producto, local, portada) se guardaba como texto dentro
   de su documento de Firestore: documentos pesados, tienda lenta al
   sincronizar y un tope de 1 MB por producto. Ahora la foto va a un
   almacén de archivos y en Firestore queda solo su dirección:

       /img/<tienda>/<huella>.<jpg|png|webp>

   La huella sale del contenido de la foto: la misma foto siempre tiene la
   misma dirección, así que se puede guardar en caché para siempre y subirla
   dos veces no ocupa el doble.

   Almacén: R2 si el Worker tiene el binding IMG; si no, el KV que ya usa el
   proyecto (LANDING). Al leer se busca en los dos, así que activar R2 más
   adelante no obliga a mover nada.

   /api/imagen (POST, JSON):
     { storeId, imagen: "data:image/...;base64,..." }   sesión del dueño → { ok, url }
     { accion: "migrar", storeId, max }                  dueño o clave de administrador
         pasa al almacén las fotos que siguen dentro de Firestore, de a pocas
         por llamada → { ok, hechas, pendientes }
   El logo (logoBase64 / faviconBase64) NO se mueve: el servidor lo usa para
   el ícono, el manifest y la pantalla de carga. */
import { getDb, corsHeaders, uidDesdeToken } from "./_firebase.js";

const TIPOS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const POR_EXT = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const PESO_MAX = 1500000;            /* bytes; el panel ya las achica a 800 px (100–200 KB) */
const RUTA = /^\/img\/([A-Za-z0-9_-]{1,60})\/([a-f0-9]{20})\.(jpg|png|webp)$/;
/* campos con foto, por documento */
const CAMPOS_CFG = ["heroImagen", "portadaImagen"];

const hdr = () => Object.assign({}, corsHeaders(), { "Cache-Control": "no-store", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret" });
const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: hdr() });
const idOk = s => String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
export const esFotoEnTexto = v => typeof v === "string" && v.length > 200 && v.indexOf("data:image/") === 0;

/* ───────────── Almacén ───────────── */
async function poner(env, clave, bytes, tipo){
  if (env.IMG) return env.IMG.put(clave, bytes, { httpMetadata: { contentType: tipo } });
  if (!env.LANDING) throw new Error("No hay almacén de imágenes configurado");
  return env.LANDING.put(clave, bytes, { metadata: { ct: tipo } });
}
async function traer(env, clave){
  if (env.IMG){
    const o = await env.IMG.get(clave);
    if (o) return { cuerpo: o.body, tipo: (o.httpMetadata && o.httpMetadata.contentType) || "" };
  }
  if (env.LANDING){
    const r = await env.LANDING.getWithMetadata(clave, "arrayBuffer");
    if (r && r.value) return { cuerpo: r.value, tipo: (r.metadata && r.metadata.ct) || "" };
  }
  return null;
}

/* ───────────── Guardar ───────────── */
function bytesDe(dataURL){
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataURL || ""));
  if (!m) throw Object.assign(new Error("La imagen tiene que ser JPG, PNG o WebP"), { st: 400 });
  let bin; try { bin = atob(m[2].replace(/\s+/g, "")); } catch(e){ throw Object.assign(new Error("La imagen llegó dañada"), { st: 400 }); }
  if (bin.length > PESO_MAX) throw Object.assign(new Error("La imagen pesa demasiado"), { st: 413 });
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  /* que el contenido sea de verdad lo que dice ser */
  const jpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  const real = jpg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
  if (!real || b.length < 100) throw Object.assign(new Error("Ese archivo no es una imagen válida"), { st: 400 });
  return { bytes: b, tipo: real };
}
/* Guarda una foto (data URL) y devuelve su dirección. Lo usan /api/imagen, la migración y las altas. */
export async function guardarImagen(env, storeId, dataURL){
  const s = idOk(storeId);
  if (!s) throw Object.assign(new Error("Falta la tienda"), { st: 400 });
  const f = bytesDe(dataURL);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", f.bytes));
  const huella = Array.from(h.slice(0, 10), x => ("0" + x.toString(16)).slice(-2)).join("");
  const clave = "img/" + s + "/" + huella + "." + TIPOS[f.tipo];
  await poner(env, clave, f.bytes, f.tipo);
  return "/" + clave;
}

/* ───────────── Servir: GET /img/<tienda>/<huella>.<ext> ───────────── */
export async function servirImagen(request, url, env, ctx){
  const no = () => new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    if (!RUTA.test(url.pathname)) return no();
    /* la dirección no cambia nunca para un mismo contenido: una sola copia en caché para todos los dominios */
    const cacheKey = new Request("https://cache.local/img1" + url.pathname);
    const cache = typeof caches !== "undefined" && caches.default ? caches.default : null;
    if (cache){ const hit = await cache.match(cacheKey); if (hit) return hit; }
    const o = await traer(env, url.pathname.slice(1));
    if (!o) return no();
    const ext = url.pathname.split(".").pop();
    const resp = new Response(o.cuerpo, { headers: { "Content-Type": POR_EXT[ext], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
    if (cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch(e){
    console.error("img:", e.message);
    return no();
  }
}

/* ───────────── Migración: fotos que siguen dentro de Firestore ───────────── */
export async function migrarTienda(env, db, storeId, max){
  const base = "tiendas/" + storeId;
  const [cf, pr, lo] = await Promise.all([db.doc(base + "/config/general").get(), db.collection(base + "/productos").get(), db.collection(base + "/locales").get()]);
  const tareas = [];   /* { ruta, campo, valor } */
  if (cf.exists) CAMPOS_CFG.forEach(k => { if (esFotoEnTexto(cf.data()[k])) tareas.push({ ruta: base + "/config/general", campo: k, valor: cf.data()[k] }); });
  (pr.docs || []).forEach(d => { if (esFotoEnTexto(d.data().imagen)) tareas.push({ ruta: base + "/productos/" + d.id, campo: "imagen", valor: d.data().imagen }); });
  (lo.docs || []).forEach(d => { if (esFotoEnTexto(d.data().imagen)) tareas.push({ ruta: base + "/locales/" + d.id, campo: "imagen", valor: d.data().imagen }); });
  let hechas = 0, saltadas = 0, vistas = 0, error = "";
  for (const t of tareas){
    if (hechas >= max) break;
    vistas++;
    try {
      const u = await guardarImagen(env, storeId, t.valor);
      await db.doc(t.ruta).set({ [t.campo]: u }, { merge: true });
      hechas++;
    } catch(e){
      /* una foto en un formato que no se puede pasar (o demasiado grande) se queda como está y se sigue con la próxima */
      if (e.st === 400 || e.st === 413) saltadas++; else { error = e.message || "No se pudo guardar"; vistas--; break; }
    }
  }
  /* pendientes = las que faltan por revisar; las saltadas no cuentan (no se pueden pasar) */
  return { hechas, saltadas, pendientes: tareas.length - vistas, error };
}

/* ───────────── /api/imagen ───────────── */
export async function imagen(request, env){
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: hdr() });
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);
  let b = {}; try { b = JSON.parse(await request.text() || "{}"); } catch(e){ return json({ ok: false, error: "Solicitud inválida" }, 400); }
  const storeId = idOk(b.storeId);
  if (!storeId) return json({ ok: false, error: "Falta la tienda" }, 400);
  try {
    const db = getDb(env);
    /* quién puede: DerLabs con su clave, o alguien con rol en la tienda (no los repartidores) */
    const esAdmin = !!env.ADMIN_SECRET && request.headers.get("x-admin-secret") === env.ADMIN_SECRET;
    if (!esAdmin){
      const uid = await uidDesdeToken(request, env);
      if (!uid) return json({ ok: false, error: "Sesión vencida — vuelve a entrar" }, 401);
      const u = await db.doc("usuarios/" + uid).get();
      const rol = u.exists && u.data().roles ? u.data().roles[storeId] : null;
      if (!rol || rol === "repartidor") return json({ ok: false, error: "Sin permiso en esta tienda" }, 403);
    }
    if (b.accion === "migrar"){
      const cfg = await db.doc("tiendas/" + storeId + "/config/general").get();
      if (!cfg.exists) return json({ ok: false, error: "Esa tienda no existe" }, 404);
      const max = Math.min(20, Math.max(1, Math.round(Number(b.max)) || 12));
      return json(Object.assign({ ok: true }, await migrarTienda(env, db, storeId, max)));
    }
    return json({ ok: true, url: await guardarImagen(env, storeId, b.imagen) });
  } catch(e){
    console.error("imagen:", e.message);
    return json({ ok: false, error: e.message || "No se pudo guardar la imagen" }, e.st || 500);
  }
}
