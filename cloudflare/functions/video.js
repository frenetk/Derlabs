/* cloudflare/functions/video.js
   VIDEO DE LA TIENDA (sección "Nuestra historia" del inicio, P52).

   El dueño sube un video desde su panel y la tienda lo muestra bajo el texto
   de su historia. El archivo se guarda tal cual, sin recomprimir: se ve con
   la calidad con que se subió.

   Dónde queda: en el mismo almacén de las fotos (R2 si el Worker tiene el
   binding IMG; si no, el KV LANDING). Como el KV no acepta archivos de más
   de 25 MB, el video se guarda en partes de 2 MB:

       vid/<tienda>/<id>/p0, p1, p2…

   y se entrega como un solo archivo en

       /vid/<tienda>/<id>-<peso>.<mp4|webm>

   respetando los pedidos por tramos (Range) que hacen los reproductores: sin
   eso el iPhone no reproduce y no se puede adelantar el video. El peso va en
   la dirección: con eso se sabe cuántas partes son sin leer nada más (el KV
   tarda hasta un minuto en mostrar lo recién escrito en otras ciudades, así
   que aquí nada depende de volver a leer lo que se acaba de guardar).

   /api/video (POST):
     { accion: "iniciar", storeId, tamano, tipo }                 → { ok, id, ext, parte, partes }
     ?accion=parte&storeId=&id=&n=&tam=&ext=  (cuerpo = los bytes) → { ok }
     { accion: "terminar", storeId, id, tamano, ext }             → { ok, url }
     { accion: "limpiar", storeId, conservar }           → { ok, borrados }
         borra los videos de la tienda que no son el publicado ni `conservar`
         y que llevan más de dos días subidos
   `conservar` (también en "iniciar") es el video que la página tiene puesto en
   ese momento: puede ser uno que el dueño subió y todavía no publica.
   Sube videos quien tiene rol en la tienda (no repartidores) o DerLabs con su
   clave. Una tienda tiene un solo video: al terminar de subir uno nuevo se
   borran los demás, menos el publicado. */
import { getDb, corsHeaders, uidDesdeToken } from "./_firebase.js";

export const PARTE = 2 * 1024 * 1024;
const MAX_KV = 40 * 1024 * 1024;       /* el KV gratuito tiene 1 GB para todo */
const MAX_R2 = 150 * 1024 * 1024;
const EXT = { "video/mp4": "mp4", "video/quicktime": "mp4", "video/webm": "webm" };
const TIPO_EXT = { mp4: "video/mp4", webm: "video/webm" };
const RUTA = /^\/vid\/([A-Za-z0-9_-]{1,60})\/([a-f0-9]{20})-(\d{1,10})\.(mp4|webm)$/;

const hdr = () => Object.assign({}, corsHeaders(), { "Cache-Control": "no-store", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret" });
const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: hdr() });
const idOk = s => String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
const falla = (m, st) => Object.assign(new Error(m), { st: st || 400 });
export const pesoMax = env => (env.IMG ? MAX_R2 : MAX_KV);

/* ───────────── Almacén (igual que las fotos: R2 si está, si no el KV) ───────────── */
async function poner(env, clave, bytes){
  if (env.IMG) return env.IMG.put(clave, bytes);
  if (!env.LANDING) throw falla("No hay almacén configurado", 500);
  return env.LANDING.put(clave, bytes, { metadata: { t: Date.now() } });
}
async function traer(env, clave){
  if (env.IMG){ const o = await env.IMG.get(clave); if (o) return o.arrayBuffer(); }
  if (env.LANDING){ const v = await env.LANDING.get(clave, "arrayBuffer"); if (v) return v; }
  return null;
}
async function listar(env, prefijo){
  const out = [];
  if (env.IMG){
    let cur;
    do { const r = await env.IMG.list({ prefix: prefijo, cursor: cur }); (r.objects || []).forEach(o => out.push({ clave: o.key, r2: true, t: o.uploaded ? new Date(o.uploaded).getTime() : 0 })); cur = r.truncated ? r.cursor : null; } while (cur);
  }
  if (env.LANDING){
    let cur;
    do { const r = await env.LANDING.list({ prefix: prefijo, cursor: cur }); (r.keys || []).forEach(k => out.push({ clave: k.name, r2: false, t: (k.metadata && Number(k.metadata.t)) || 0 })); cur = r.list_complete ? null : r.cursor; } while (cur);
  }
  return out;
}
const quitar = (env, x) => (x.r2 ? env.IMG.delete(x.clave) : env.LANDING.delete(x.clave));
/* peso y tipo que declara quien sube: se revisan en cada pedido */
function medidas(env, tamano, ext){
  const tam = Math.round(Number(tamano));
  if (!TIPO_EXT[ext]) throw falla("El video tiene que ser MP4, MOV o WebM");
  if (!(tam > 1000)) throw falla("El video está vacío");
  const max = pesoMax(env);
  if (tam > max) throw falla("El video pesa " + Math.ceil(tam / 1048576) + " MB y el máximo es " + Math.round(max / 1048576) + " MB", 413);
  return { tam, ext, partes: Math.ceil(tam / PARTE) };
}

/* Borra los videos de la tienda, menos los que se indiquen. Con `antesDe`, solo lo subido antes de esa
   hora (lo reciente puede ser un video que el dueño todavía no publica). Devuelve cuántos videos borró. */
export async function limpiarVideos(env, storeId, conservar, antesDe){
  const todo = await listar(env, "vid/" + storeId + "/"), ids = new Set();
  for (const x of todo){
    const id = x.clave.split("/")[2];
    if ((conservar || []).indexOf(id) >= 0) continue;
    if (antesDe && !(x.t > 0 && x.t < antesDe)) continue;
    await quitar(env, x); ids.add(id);
  }
  return ids.size;
}
const GRACIA_MS = 48 * 3600 * 1000;
const idDe = v => { v = String(v || ""); const m = RUTA.exec(v); return m ? m[2] : (/^[a-f0-9]{20}$/.test(v) ? v : null); };
/* el id del video que la tienda tiene publicado */
async function idPublicado(db, storeId){
  const cf = await db.doc("tiendas/" + storeId + "/config/general").get();
  const u = cf.exists && cf.data().historiaVideo && cf.data().historiaVideo.url;
  const m = RUTA.exec(String(u || ""));
  return m && m[1] === storeId ? m[2] : null;
}

/* ¿Es de verdad un video? MP4 / MOV: "ftyp" en el byte 4. WebM: cabecera EBML. */
function tipoReal(b){
  if (b.length < 16) return null;
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "mp4";
  if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return "webm";
  return null;
}

/* ───────────── Servir: GET /vid/<tienda>/<id>-<peso>.<ext> ───────────── */
export async function servirVideo(request, url, env){
  const no = (st, extra) => new Response(st === 416 ? "Tramo fuera del archivo" : "No encontrado", { status: st, headers: Object.assign({ "Cache-Control": "no-store" }, extra || {}) });
  try {
    const m = RUTA.exec(url.pathname);
    if (!m || (request.method !== "GET" && request.method !== "HEAD")) return no(404);
    const base = "vid/" + m[1] + "/" + m[2] + "/p", tam = Number(m[3]);
    if (!(tam > 0)) return no(404);
    const comun = { "Content-Type": TIPO_EXT[m[4]], "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };
    /* tramo pedido */
    let a = 0, b = tam - 1, parcial = false;
    const r = /^bytes=(\d*)-(\d*)$/.exec(String(request.headers.get("range") || "").trim());
    if (r && (r[1] || r[2])){
      parcial = true;
      if (r[1] === ""){ a = Math.max(0, tam - Number(r[2])); }           /* los últimos N bytes */
      else { a = Number(r[1]); if (r[2] !== "") b = Math.min(tam - 1, Number(r[2])); }
      if (a > b || a >= tam) return no(416, { "Content-Range": "bytes */" + tam });
    }
    const cab = Object.assign({}, comun, { "Content-Length": String(b - a + 1) });
    if (parcial) cab["Content-Range"] = "bytes " + a + "-" + b + "/" + tam;
    /* la primera parte se lee antes de responder: si el video no existe, es un 404 de verdad */
    let n = Math.floor(a / PARTE);
    const primera = await traer(env, base + n);
    if (!primera) return no(404);
    if (request.method === "HEAD") return new Response(null, { status: parcial ? 206 : 200, headers: cab });
    const ultima = Math.floor(b / PARTE);
    const corte = (buf, i) => { const ini = i * PARTE, d = Math.max(a, ini) - ini, h = Math.min(b, ini + buf.byteLength - 1) - ini + 1; return new Uint8Array(buf, d, Math.max(0, h - d)); };
    if (n === ultima) return new Response(corte(primera, n), { status: parcial ? 206 : 200, headers: cab });
    /* varias partes: se van leyendo de a una, a medida que el reproductor las pide */
    let pendiente = primera;
    const flujo = new ReadableStream({
      async pull(c){
        try {
          const buf = pendiente || await traer(env, base + n);
          pendiente = null;
          if (!buf){ c.error(new Error("falta una parte del video")); return; }
          c.enqueue(corte(buf, n));
          if (n >= ultima) c.close(); else n++;
        } catch(e){ c.error(e); }
      }
    });
    /* en Cloudflare, con el largo fijo: así la respuesta lleva su Content-Length (el iPhone lo exige) */
    let cuerpo = flujo;
    if (typeof FixedLengthStream !== "undefined"){ const f = new FixedLengthStream(b - a + 1); flujo.pipeTo(f.writable).catch(function(){}); cuerpo = f.readable; }
    return new Response(cuerpo, { status: parcial ? 206 : 200, headers: cab });
  } catch(e){
    console.error("vid:", e.message);
    return no(404);
  }
}

/* ───────────── /api/video ───────────── */
export async function video(request, env){
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: hdr() });
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);
  const q = new URL(request.url).searchParams;
  const esParte = q.get("accion") === "parte";
  let b = {};
  if (!esParte){ try { b = JSON.parse(await request.text() || "{}"); } catch(e){ return json({ ok: false, error: "Solicitud inválida" }, 400); } }
  const storeId = idOk(esParte ? q.get("storeId") : b.storeId);
  if (!storeId) return json({ ok: false, error: "Falta la tienda" }, 400);
  try {
    const db = getDb(env);
    const esAdmin = !!env.ADMIN_SECRET && request.headers.get("x-admin-secret") === env.ADMIN_SECRET;
    if (!esAdmin){
      const uid = await uidDesdeToken(request, env);
      if (!uid) return json({ ok: false, error: "Sesión vencida — vuelve a entrar" }, 401);
      const u = await db.doc("usuarios/" + uid).get();
      const rol = u.exists && u.data().roles ? u.data().roles[storeId] : null;
      if (!rol || rol === "repartidor") return json({ ok: false, error: "Sin permiso en esta tienda" }, 403);
    }

    if (esParte){
      const id = String(q.get("id") || ""), n = Number(q.get("n"));
      const d = medidas(env, q.get("tam"), String(q.get("ext") || ""));
      if (!/^[a-f0-9]{20}$/.test(id) || !Number.isInteger(n) || n < 0 || n >= d.partes) throw falla("Parte inválida");
      const bytes = new Uint8Array(await request.arrayBuffer());
      const esperado = n === d.partes - 1 ? d.tam - PARTE * (d.partes - 1) : PARTE;
      if (bytes.length !== esperado) throw falla("La parte llegó incompleta: vuelve a intentarlo");
      if (n === 0 && tipoReal(bytes) !== d.ext) throw falla("Ese archivo no es un video MP4 o WebM válido");
      await poner(env, "vid/" + storeId + "/" + id + "/p" + n, bytes);
      return json({ ok: true });
    }

    if (b.accion === "iniciar"){
      const ext = EXT[String(b.tipo || "").toLowerCase().split(";")[0]];
      if (!ext) throw falla("El video tiene que ser MP4, MOV o WebM");
      const d = medidas(env, b.tamano, ext);
      /* una subida a la vez por tienda: se bota lo que haya quedado a medias (no el video publicado) */
      await limpiarVideos(env, storeId, [await idPublicado(db, storeId), idDe(b.conservar)].filter(Boolean));
      const a = crypto.getRandomValues(new Uint8Array(10));
      const id = Array.from(a, x => ("0" + x.toString(16)).slice(-2)).join("");
      return json({ ok: true, id, ext: d.ext, parte: PARTE, partes: d.partes });
    }

    if (b.accion === "terminar"){
      const id = String(b.id || "");
      if (!/^[a-f0-9]{20}$/.test(id)) throw falla("Falta el video");
      const d = medidas(env, b.tamano, String(b.ext || ""));
      /* queda este y el que esté publicado (hasta que la tienda guarde el nuevo) */
      const pub = await idPublicado(db, storeId);
      await limpiarVideos(env, storeId, pub ? [id, pub] : [id]);
      return json({ ok: true, url: "/vid/" + storeId + "/" + id + "-" + d.tam + "." + d.ext, peso: d.tam });
    }

    if (b.accion === "limpiar"){
      const quedan = [await idPublicado(db, storeId), idDe(b.conservar)].filter(Boolean);
      return json({ ok: true, borrados: await limpiarVideos(env, storeId, quedan, (Number(b._ahora) && env.PRUEBAS ? Number(b._ahora) : Date.now()) - GRACIA_MS) });
    }
    return json({ ok: false, error: "Acción desconocida" }, 400);
  } catch(e){
    console.error("video:", e.message);
    return json({ ok: false, error: e.message || "No se pudo guardar el video" }, e.st || 500);
  }
}
