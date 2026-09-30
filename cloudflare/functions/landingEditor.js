/* cloudflare/functions/landingEditor.js — API del editor visual del landing
   (derlabs.cl/editar). Guarda el borrador y la versión publicada en el KV
   "LANDING" de Cloudflare. El Worker entrega "publicada" tal cual, sin
   Firebase en el navegador: la página nunca muestra datos anteriores.

   Solo la cuenta con usuarios/{uid}.roles.plataforma = "propietario".

   Claves del KV:
     publicada        HTML que ve el público
     borrador         HTML en edición (no público)
     v:<id>           copias de las últimas publicaciones (máx. 10)
     img:<hash>       imágenes subidas desde el editor (se sirven en /limg/<hash>)
     meta             { borrador:{fecha}, publicada:{fecha,id}, versiones:[{id,fecha,bytes}] } */

import { getDb, uidDesdeToken } from "./_firebase.js";

const H = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const MAX_VERSIONES = 10;
const MAX_HTML = 8 * 1024 * 1024;
const MAX_IMG = 3 * 1024 * 1024;
const TIPOS_IMG = { "image/png": 1, "image/jpeg": 1, "image/webp": 1, "image/gif": 1, "image/svg+xml": 1 };

async function leerMeta(kv){
  try { return JSON.parse((await kv.get("meta")) || "{}"); } catch(e){ return {}; }
}
function htmlValido(h){
  return typeof h === "string" && h.length > 1000 && h.length < MAX_HTML && /<html[\s>]/i.test(h) && /<\/html>\s*$/i.test(h);
}
function b64aBytes(b64){
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export async function landingEditor(request, env){
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);
  const kv = env.LANDING;
  if (!kv) return json({ ok: false, error: "Falta conectar el KV LANDING al Worker (wrangler.toml)" }, 500);
  let b = {}; try { b = JSON.parse(await request.text() || "{}"); } catch(e){}
  try {
    const db = getDb(env);
    const uid = await uidDesdeToken(request, env);
    if (!uid) return json({ ok: false, error: "Sesión vencida — vuelve a entrar" }, 401);
    const u = await db.doc("usuarios/" + uid).get();
    const roles = u.exists ? (u.data().roles || {}) : {};
    if (roles.plataforma !== "propietario") return json({ ok: false, error: "Esta cuenta no puede editar el landing" }, 403);
    const ahora = new Date().toISOString();
    const meta = await leerMeta(kv);
    meta.versiones = Array.isArray(meta.versiones) ? meta.versiones : [];

    switch (b.accion){
      case "estado":
        return json({ ok: true, borrador: meta.borrador || null, publicada: meta.publicada || null, versiones: meta.versiones });

      case "guardar": {
        if (!htmlValido(b.html)) return json({ ok: false, error: "Contenido inválido" }, 400);
        await kv.put("borrador", b.html);
        meta.borrador = { fecha: ahora };
        await kv.put("meta", JSON.stringify(meta));
        return json({ ok: true, borrador: meta.borrador });
      }

      case "publicar": {
        if (!htmlValido(b.html)) return json({ ok: false, error: "Contenido inválido" }, 400);
        const id = Date.now().toString(36);
        await kv.put("publicada", b.html);
        await kv.put("v:" + id, b.html);
        meta.publicada = { fecha: ahora, id };
        meta.versiones.unshift({ id, fecha: ahora, bytes: b.html.length });
        const sobran = meta.versiones.splice(MAX_VERSIONES);
        for (const v of sobran) await kv.delete("v:" + v.id);
        await kv.delete("borrador");
        meta.borrador = null;
        await kv.put("meta", JSON.stringify(meta));
        return json({ ok: true, publicada: meta.publicada, versiones: meta.versiones });
      }

      case "restaurar": {
        const id = String(b.id || "").replace(/[^a-z0-9]/g, "");
        const html = id ? await kv.get("v:" + id) : null;
        if (!html) return json({ ok: false, error: "Esa versión ya no existe" }, 404);
        await kv.put("publicada", html);
        await kv.delete("borrador");
        meta.publicada = { fecha: ahora, id };
        meta.borrador = null;
        await kv.put("meta", JSON.stringify(meta));
        return json({ ok: true, publicada: meta.publicada });
      }

      case "descartar":
        await kv.delete("borrador");
        meta.borrador = null;
        await kv.put("meta", JSON.stringify(meta));
        return json({ ok: true });

      case "subirImagen": {
        const m = /^data:([a-z+\/]+);base64,([A-Za-z0-9+\/=]+)$/.exec(String(b.dataUrl || ""));
        if (!m || !TIPOS_IMG[m[1]]) return json({ ok: false, error: "Formato de imagen no soportado" }, 400);
        const bytes = b64aBytes(m[2]);
        if (bytes.length > MAX_IMG) return json({ ok: false, error: "La imagen pesa más de 3 MB" }, 400);
        const dig = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
        const id = Array.from(dig.slice(0, 12)).map(x => x.toString(16).padStart(2, "0")).join("");
        await kv.put("img:" + id, bytes, { metadata: { tipo: m[1] } });
        return json({ ok: true, url: "/limg/" + id });
      }

      default:
        return json({ ok: false, error: "Acción desconocida" }, 400);
    }
  } catch(e){
    console.error("landingEditor:", e.message);
    return json({ ok: false, error: e.message || "Error" }, 500);
  }
}

/* GET /limg/<id> — imágenes subidas desde el editor */
export async function servirImagenLanding(id, env){
  if (!env.LANDING || !/^[a-f0-9]{24}$/.test(id)) return new Response("No encontrado", { status: 404 });
  const r = await env.LANDING.getWithMetadata("img:" + id, { type: "arrayBuffer", cacheTtl: 86400 });
  if (!r || !r.value) return new Response("No encontrado", { status: 404 });
  return new Response(r.value, { headers: {
    "Content-Type": (r.metadata && r.metadata.tipo) || "image/png",
    "Cache-Control": "public, max-age=31536000, immutable"
  }});
}
