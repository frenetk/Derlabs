/* cloudflare/functions/dominios.js — "Conectar mi dominio" automático.

   Flujo (dominio propio del cliente, ej. pizzeriajuan.cl):
   1. conectar: agrega el dominio como zona en la cuenta Cloudflare de DerLabs
      (importando sus registros actuales, así su correo no se corta) y devuelve
      los 2 servidores DNS que el cliente pega en NIC Chile.
   2. El cron (cada 5 min) y el botón "revisar ahora" consultan si la zona ya
      está activa. Cuando lo está: borra registros web viejos del dominio y de
      www, conecta ambos al Worker (HTTPS automático), registra dominios/{host},
      autoriza el login con Google, marca el dominio principal de la tienda y
      avisa por correo.
   3. asegurarDominios (cron): cada push hace que wrangler deje de administrar
      dominios (wrangler.toml ya no tiene [[routes]]). Esta función revisa que
      los dominios base de DerLabs y todos los de clientes sigan conectados al
      Worker y los reconecta si faltan.

   Subdominios base: *.derlabs.store (comida) y *.derlabs.online (retail/Tienda Pro).
   Secretos del Worker: CF_API_TOKEN, CF_ACCOUNT_ID.
   Firestore: dominios_conexion/{dominio} (solo servidor). */

import { getDb, uidDesdeToken, autorizarDominio } from "./_firebase.js";

const H = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });
const SERVICIO_DEF = "derlabs-worker";
/* Nombre real del Worker en Cloudflare: se detecta solo (no siempre coincide con wrangler.toml) */
let SERVICIO = null, SERVICIO_ORIGEN = "";
const CF = "https://api.cloudflare.com/client/v4";

/* Dominios propios de DerLabs que siempre deben apuntar al Worker */
const BASE_DOMINIOS = ["derlabs.cl", "www.derlabs.cl", "derlabs.store", "derlabs.online"];
const BASE_RUTAS = [{ zona: "derlabs.store", patron: "*.derlabs.store/*" }, { zona: "derlabs.online", patron: "*.derlabs.online/*" }];

export function limpiarDominio(d){
  let s = String(d || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (s.startsWith("www.")) s = s.slice(4);
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(s)) return null;
  if (s.endsWith(".derlabs.store") || s === "derlabs.store" || s.endsWith("derlabs.cl") || s.endsWith("derlabs.online")) return null;
  return s;
}

async function cf(env, metodo, ruta, cuerpo){
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) throw new Error("Faltan los secretos CF_API_TOKEN / CF_ACCOUNT_ID en el Worker");
  const r = await fetch(CF + ruta, {
    method: metodo,
    headers: { "Authorization": "Bearer " + env.CF_API_TOKEN, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.success !== false, status: r.status, j };
}
const errCF = (res) => ((res.j && res.j.errors && res.j.errors[0]) || {});

async function zonaPorNombre(env, nombre){
  const r = await cf(env, "GET", "/zones?name=" + encodeURIComponent(nombre) + "&account.id=" + env.CF_ACCOUNT_ID);
  return r.ok && r.j.result && r.j.result[0] ? r.j.result[0] : null;
}

/* Crea (o recupera) la zona del dominio en la cuenta de DerLabs */
async function crearZona(env, dominio){
  const r = await cf(env, "POST", "/zones", { name: dominio, account: { id: env.CF_ACCOUNT_ID }, type: "full", jump_start: true });
  if (r.ok) return r.j.result;
  const e = errCF(r);
  if (e.code === 1061 || /already exists/i.test(e.message || "")){
    const z = await zonaPorNombre(env, dominio);
    if (z) return z;
    throw new Error("Ese dominio ya está registrado en otra cuenta de Cloudflare. El cliente debe quitarlo de esa cuenta primero.");
  }
  throw new Error("Cloudflare: " + (e.message || ("HTTP " + r.status)));
}

/* Borra registros web (A/AAAA/CNAME) del dominio y www para que el Worker pueda tomarlos. MX/TXT se conservan. */
async function limpiarRegistrosWeb(env, zoneId, dominio){
  for (const nombre of [dominio, "www." + dominio]){
    const r = await cf(env, "GET", "/zones/" + zoneId + "/dns_records?name=" + encodeURIComponent(nombre));
    const lista = (r.ok && r.j.result) || [];
    for (const rec of lista){
      if (["A", "AAAA", "CNAME"].includes(rec.type)) await cf(env, "DELETE", "/zones/" + zoneId + "/dns_records/" + rec.id);
    }
  }
}

/* Lista todos los dominios personalizados de la cuenta y filtra los de este Worker
   (el filtro ?service= de la API no es confiable en Workers sin "environments"). */
async function detectarServicio(env, todos){
  if (SERVICIO) return SERVICIO;
  if (env.WORKER_NAME){ SERVICIO = env.WORKER_NAME; SERVICIO_ORIGEN = "variable WORKER_NAME"; return SERVICIO; }
  const base = (todos || []).find(d => BASE_DOMINIOS.includes(d.hostname) && d.service);
  if (base){ SERVICIO = base.service; SERVICIO_ORIGEN = "dominio " + base.hostname; return SERVICIO; }
  /* Rutas existentes en las zonas base (ej. *.derlabs.store/* creada por el deploy anterior) */
  for (const zn of ["derlabs.store", "derlabs.online", "derlabs.cl"]){
    const rz = await cf(env, "GET", "/zones?name=" + zn + "&account.id=" + env.CF_ACCOUNT_ID);
    const zid = rz.ok && rz.j.result && rz.j.result[0] && rz.j.result[0].id;
    if (!zid) continue;
    const rr = await cf(env, "GET", "/zones/" + zid + "/workers/routes");
    const conScript = ((rr.ok && rr.j.result) || []).find(x => x.script);
    if (conScript){ SERVICIO = conScript.script; SERVICIO_ORIGEN = "ruta " + conScript.pattern; return SERVICIO; }
  }
  const rs = await cf(env, "GET", "/accounts/" + env.CF_ACCOUNT_ID + "/workers/scripts");
  const scripts = ((rs.ok && rs.j.result) || []).map(x => x.id).filter(Boolean);
  const candidatos = scripts.filter(n => /derlabs/i.test(n));
  if (candidatos.length === 1){ SERVICIO = candidatos[0]; SERVICIO_ORIGEN = "único Worker con 'derlabs'"; return SERVICIO; }
  if (scripts.length === 1){ SERVICIO = scripts[0]; SERVICIO_ORIGEN = "único Worker de la cuenta"; return SERVICIO; }
  if (scripts.includes(SERVICIO_DEF)){ SERVICIO = SERVICIO_DEF; SERVICIO_ORIGEN = "wrangler.toml"; return SERVICIO; }
  SERVICIO_ORIGEN = "no se pudo detectar (Workers en la cuenta: " + (scripts.join(", ") || "ninguno visible") + ")";
  return null;
}
async function listarDominiosWorker(env){
  const r = await cf(env, "GET", "/accounts/" + env.CF_ACCOUNT_ID + "/workers/domains");
  const todos = (r.ok && r.j.result) || [];
  const srv = await detectarServicio(env, todos);
  return { ok: r.ok, r, todos, servicio: srv, lista: todos.filter(d => d.service === srv) };
}
async function dominiosDelWorker(env){
  const x = await listarDominiosWorker(env);
  return new Set(x.lista.map(d => d.hostname));
}

async function conectarAlWorker(env, zoneId, hostname){
  if (!SERVICIO) await detectarServicio(env, null);
  if (!SERVICIO) throw new Error("No se pudo detectar el nombre del Worker: " + SERVICIO_ORIGEN);
  let r = await cf(env, "PUT", "/accounts/" + env.CF_ACCOUNT_ID + "/workers/domains", { hostname, service: SERVICIO, zone_id: zoneId });
  if (!r.ok && /environment/i.test(errCF(r).message || ""))
    r = await cf(env, "PUT", "/accounts/" + env.CF_ACCOUNT_ID + "/workers/domains", { hostname, service: SERVICIO, zone_id: zoneId, environment: "production" });
  if (!r.ok) throw new Error("No se pudo conectar " + hostname + ": " + (errCF(r).message || r.status));
}

async function avisarActivo(env, doc){
  try {
    if (!env.RESEND_API_KEY || !doc.email) return;
    const url = "https://" + doc.dominio;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "DerLabs <pedidos@derlabs.cl>", to: [doc.email],
        subject: "✅ Tu tienda ya funciona en " + doc.dominio,
        html: '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1A1A1A">' +
          '<h2 style="margin:0 0 10px">Tu dominio ya está conectado</h2>' +
          '<p>Tu tienda ahora abre en <a href="' + url + '" style="color:#9B1B30;font-weight:bold">' + doc.dominio + '</a>, con candado de seguridad (HTTPS).</p>' +
          '<p>Tu dirección anterior sigue funcionando y lleva a la nueva automáticamente.</p>' +
          '<p style="color:#6B6B6B;font-size:13px">— Equipo DerLabs</p></div>'
      })
    });
  } catch(e){ console.warn("aviso dominio:", e.message); }
}

/* Revisa un dominio pendiente y, si la zona ya está activa, termina la conexión */
async function revisarUno(env, db, doc, forzarCheck){
  const ref = db.doc("dominios_conexion/" + doc.dominio);
  const z = await cf(env, "GET", "/zones/" + doc.zoneId);
  if (!z.ok){ await ref.set({ ultimoError: "No se pudo consultar la zona", revisadoEn: new Date().toISOString() }, { merge: true }); return doc; }
  const zona = z.j.result;
  if (zona.status !== "active"){
    if (forzarCheck) await cf(env, "PUT", "/zones/" + doc.zoneId + "/activation_check");
    await ref.set({ revisadoEn: new Date().toISOString(), estadoCF: zona.status }, { merge: true });
    return Object.assign({}, doc, { estadoCF: zona.status });
  }
  /* Zona activa: conectar */
  try {
    await limpiarRegistrosWeb(env, doc.zoneId, doc.dominio);
    await conectarAlWorker(env, doc.zoneId, doc.dominio);
    await conectarAlWorker(env, doc.zoneId, "www." + doc.dominio);
    await cf(env, "PATCH", "/zones/" + doc.zoneId + "/settings/always_use_https", { value: "on" });
    const ahora = new Date().toISOString();
    await db.doc("dominios/" + doc.dominio).set({ storeId: doc.storeId, creadoEn: ahora, via: "conexion" });
    await db.doc("dominios/www." + doc.dominio).set({ storeId: doc.storeId, creadoEn: ahora, via: "conexion", redirigeA: doc.dominio });
    await db.doc("tiendas/" + doc.storeId + "/config/general").set({ dominioPrincipal: doc.dominio }, { merge: true });
    try { await autorizarDominio(doc.dominio); await autorizarDominio("www." + doc.dominio); } catch(e){ console.warn("autorizarDominio:", e.message); }
    const fin = Object.assign({}, doc, { estado: "activo", activadoEn: ahora, ultimoError: null });
    await ref.set(fin, { merge: true });
    await avisarActivo(env, fin);
    return fin;
  } catch(e){
    await ref.set({ ultimoError: e.message, revisadoEn: new Date().toISOString() }, { merge: true });
    return Object.assign({}, doc, { ultimoError: e.message });
  }
}

/* CRON y visitas: repara dominios base primero (no depende de Firestore),
   luego termina conexiones pendientes. Devuelve un informe paso a paso. */
export async function revisarDominios(env){
  const inf = [];
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID){ inf.push({ paso: "secretos CF_API_TOKEN / CF_ACCOUNT_ID", ok: false, detalle: "faltan en el Worker" }); return inf; }
  let db = null;
  try { db = getDb(env); } catch(e){ inf.push({ paso: "Firestore", ok: false, detalle: e.message }); }
  try { await asegurarDominios(env, db, inf); }
  catch(e){ inf.push({ paso: "asegurar dominios", ok: false, detalle: e.message }); }
  if (db){
    try {
      const snap = await db.collection("dominios_conexion").where("estado", "==", "pendiente").get();
      for (const d of snap.docs) await revisarUno(env, db, d.data(), false);
      inf.push({ paso: "conexiones pendientes", ok: true, detalle: snap.docs.length + " revisadas" });
    } catch(e){ inf.push({ paso: "conexiones pendientes", ok: false, detalle: e.message }); }
  }
  inf.filter(x => !x.ok).forEach(x => console.error("dominios ✗", x.paso, "→", x.detalle));
  return inf;
}

export async function asegurarDominios(env, db, inf){
  inf = inf || [];
  const ld = await listarDominiosWorker(env);
  const lista = { ok: ld.ok };
  inf.push({ paso: "Worker detectado", ok: !!ld.servicio, detalle: (ld.servicio || "—") + " (" + SERVICIO_ORIGEN + ")" });
  if (!ld.servicio) return inf;
  inf.push({ paso: "leer dominios del Worker", ok: ld.ok, detalle: ld.ok ? (ld.lista.length + " conectados: " + ld.lista.map(d => d.hostname).join(", ") + (ld.todos.length > ld.lista.length ? " · otros en la cuenta: " + ld.todos.filter(d => d.service !== ld.servicio).map(d => d.hostname + "→" + d.service).join(", ") : "")) : (errCF(ld.r).message || ("HTTP " + ld.r.status)) });
  const conectados = new Set(ld.lista.map(d => d.hostname));
  const zonas = {};
  const zonaId = async (nombre) => {
    if (!(nombre in zonas)){
      const r = await cf(env, "GET", "/zones?name=" + encodeURIComponent(nombre) + "&account.id=" + env.CF_ACCOUNT_ID);
      const z = r.ok && r.j.result && r.j.result[0];
      zonas[nombre] = z ? z.id : null;
      if (!z) inf.push({ paso: "zona " + nombre, ok: false, detalle: r.ok ? "no está en esta cuenta" : (errCF(r).message || ("HTTP " + r.status)) });
    }
    return zonas[nombre];
  };
  for (const h of BASE_DOMINIOS){
    if (lista.ok && conectados.has(h)){ inf.push({ paso: h, ok: true, detalle: "conectado" }); continue; }
    const id = await zonaId(h.split(".").slice(-2).join("."));
    if (!id) continue;
    try { await conectarAlWorker(env, id, h); inf.push({ paso: h, ok: true, detalle: "reconectado" }); }
    catch(e){ inf.push({ paso: h, ok: false, detalle: e.message }); }
  }
  for (const r of BASE_RUTAS){
    const id = await zonaId(r.zona); if (!id) continue;
    const lr = await cf(env, "GET", "/zones/" + id + "/workers/routes");
    if (!lr.ok){ const m = errCF(lr).message || ("HTTP " + lr.status); inf.push({ paso: "ruta " + r.patron, ok: false, detalle: m + (/access|auth/i.test(m) ? " → al token le falta Zone · Workers Routes · Edit (en todas las zonas de la cuenta)" : "") }); continue; }
    const ex = (lr.j.result || []).find(x => x.pattern === r.patron);
    if (ex && ex.script === SERVICIO){ inf.push({ paso: "ruta " + r.patron, ok: true, detalle: "existe" }); continue; }
    const cr = ex
      ? await cf(env, "PUT", "/zones/" + id + "/workers/routes/" + ex.id, { pattern: r.patron, script: SERVICIO })
      : await cf(env, "POST", "/zones/" + id + "/workers/routes", { pattern: r.patron, script: SERVICIO });
    inf.push({ paso: "ruta " + r.patron, ok: cr.ok, detalle: cr.ok ? "creada" : (errCF(cr).message || ("HTTP " + cr.status)) });
  }
  if (db){
    const act = await db.collection("dominios_conexion").where("estado", "==", "activo").get();
    for (const d of act.docs){
      const x = d.data();
      for (const h of [x.dominio, "www." + x.dominio]){
        if (lista.ok && conectados.has(h)) continue;
        try { await conectarAlWorker(env, x.zoneId, h); inf.push({ paso: h, ok: true, detalle: "reconectado" }); }
        catch(e){ inf.push({ paso: h, ok: false, detalle: e.message }); }
      }
    }
  }
  return inf;
}

/* Endpoint /api/dominios */
export async function dominios(request, env){
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: H });
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);
  let b = {}; try { b = JSON.parse(await request.text() || "{}"); } catch(e){}
  try {
    const db = getDb(env);
    const uid = await uidDesdeToken(request, env);
    if (!uid) return json({ ok: false, error: "Sesión vencida — vuelve a entrar" }, 401);
    const host = String(b.hostname || "").toLowerCase();
    const dm = host ? await db.doc("dominios/" + host).get() : null;
    const storeId = dm && dm.exists ? dm.data().storeId : null;
    if (!storeId) return json({ ok: false, error: "No se reconoce esta tienda" }, 404);
    const u = await db.doc("usuarios/" + uid).get();
    const ud = u.exists ? u.data() : {};
    const roles = ud.roles || {};
    if (roles[storeId] !== "propietario" && roles.plataforma !== "propietario")
      return json({ ok: false, error: "Solo el dueño de la tienda puede conectar un dominio" }, 403);

    const deLaTienda = async () => {
      const s = await db.collection("dominios_conexion").where("storeId", "==", storeId).get();
      return s.docs.map(d => d.data());
    };

    switch (b.accion){
      case "estado": {
        const cfg = await db.doc("tiendas/" + storeId + "/config/general").get();
        return json({ ok: true, storeId, esPlataforma: roles.plataforma === "propietario", dominioPrincipal: (cfg.exists && cfg.data().dominioPrincipal) || null, conexiones: await deLaTienda() });
      }
      case "sistema": {
        if (roles.plataforma !== "propietario") return json({ ok: false, error: "Solo DerLabs" }, 403);
        return json({ ok: true, informe: await revisarDominios(env) });
      }
      case "conectar": {
        const dominio = limpiarDominio(b.dominio);
        if (!dominio) return json({ ok: false, error: "Escribe el dominio así: mitienda.cl (sin https ni www)" }, 400);
        const ya = await db.doc("dominios/" + dominio).get();
        if (ya.exists && ya.data().storeId !== storeId) return json({ ok: false, error: "Ese dominio ya está conectado a otra tienda" }, 409);
        const prev = await db.doc("dominios_conexion/" + dominio).get();
        if (prev.exists && prev.data().storeId !== storeId) return json({ ok: false, error: "Ese dominio está en proceso para otra tienda" }, 409);
        if (prev.exists && prev.data().estado === "activo") return json({ ok: true, conexion: prev.data() });
        const zona = await crearZona(env, dominio);
        const doc = {
          dominio, storeId, zoneId: zona.id, ns: zona.name_servers || [], estado: "pendiente",
          estadoCF: zona.status, creadoEn: new Date().toISOString(), uid, email: ud.email || null, ultimoError: null
        };
        await db.doc("dominios_conexion/" + dominio).set(doc);
        const fin = zona.status === "active" ? await revisarUno(env, db, doc, false) : doc;
        return json({ ok: true, conexion: fin });
      }
      case "verificar": {
        const dominio = limpiarDominio(b.dominio);
        const d = dominio ? await db.doc("dominios_conexion/" + dominio).get() : null;
        if (!d || !d.exists || d.data().storeId !== storeId) return json({ ok: false, error: "No hay una conexión en curso para ese dominio" }, 404);
        if (d.data().estado === "activo") return json({ ok: true, conexion: d.data() });
        return json({ ok: true, conexion: await revisarUno(env, db, d.data(), true) });
      }
      case "cancelar": {
        const dominio = limpiarDominio(b.dominio);
        const d = dominio ? await db.doc("dominios_conexion/" + dominio).get() : null;
        if (!d || !d.exists || d.data().storeId !== storeId) return json({ ok: false, error: "No existe" }, 404);
        if (d.data().estado === "activo") return json({ ok: false, error: "El dominio ya está activo; para quitarlo escribe a soporte" }, 400);
        await cf(env, "DELETE", "/zones/" + d.data().zoneId);
        await db.doc("dominios_conexion/" + dominio).delete();
        return json({ ok: true });
      }
      default:
        return json({ ok: false, error: "Acción desconocida" }, 400);
    }
  } catch(e){
    console.error("dominios:", e.message);
    return json({ ok: false, error: e.message || "Error" }, 500);
  }
}
