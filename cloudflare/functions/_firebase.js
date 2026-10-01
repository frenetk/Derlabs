/* cloudflare/functions/_firebase.js
   Usa @ljoukov/firebase-admin-cloudflare (REST) en lugar de firebase-admin
   (gRPC), porque el runtime de Workers no soporta gRPC ni __dirname.
   createUser() se implementa vía REST API de Firebase Auth porque el
   paquete no expone Auth. */

import { initializeApp } from "@ljoukov/firebase-admin-cloudflare/app";
import { getFirestore, FieldValue } from "@ljoukov/firebase-admin-cloudflare/firestore";

let dbInstancia = null;
let _serviceAccount = null;

export function getDb(env){
  if (!dbInstancia) {
    const raw = env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT en Cloudflare");
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch (e) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido: " + e.message);
    }

    if (serviceAccount && typeof serviceAccount.private_key === "string") {
      let key = serviceAccount.private_key.trim();
      if (key.indexOf("\\n") !== -1) {
        key = key.replace(/\\n/g, "\n");
      }
      serviceAccount.private_key = key;
    }

    _serviceAccount = serviceAccount;

    try {
      initializeApp({ serviceAccountJson: JSON.stringify(serviceAccount) });
    } catch (e) {
      throw new Error("No se pudo inicializar Firebase Admin: " + e.message);
    }

    dbInstancia = getFirestore();
  }
  return dbInstancia;
}

export function corsHeaders(){
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

export function fmtPrecio(n){
  return "$" + Number(n || 0).toLocaleString("es-CL");
}

export function resumenItems(items){
  return (items || []).map(function(i){
    const v = i.variantes && typeof i.variantes === "object" ? Object.keys(i.variantes).map(function(k){ return i.variantes[k]; }).filter(Boolean).join(", ") : "";
    return i.cantidad + "x " + i.nombre + (v ? " (" + v + ")" : "");
  }).join(", ");
}

export function esc(s){
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function getStoreConfig(db, storeId){
  const [general, privado] = await Promise.all([
    db.doc("tiendas/" + storeId + "/config/general").get(),
    db.doc("tiendas/" + storeId + "/config/privado").get()
  ]);
  return Object.assign(
    {},
    general.exists ? general.data() : {},
    privado.exists ? privado.data() : {}
  );
}

export async function validarCuponServidor(db, storeId, codigoCrudo, clienteUid, subtotal){
  const codigo = String(codigoCrudo || "").trim().toUpperCase();
  if (!codigo) return { ok: false, error: "Código de cupón vacío" };

  const snap = await db.collection("tiendas/" + storeId + "/cupones")
    .where("codigo", "==", codigo).limit(1).get();
  if (snap.empty) return { ok: false, error: "El cupón no existe" };

  const cup = snap.docs[0].data();
  if (cup.activo === false) return { ok: false, error: "Este cupón ya no está disponible" };

  if (cup.vence) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (String(cup.vence) < hoy) return { ok: false, error: "Este cupón está expirado" };
  }

  const tipo = cup.tipo === "monto" ? "monto" : "porcentaje";
  const valor = Number(cup.valor);
  if (!valor || valor <= 0) return { ok: false, error: "Este cupón no es canjeable online" };

  const limTotal = Number(cup.limiteTotal) || 0;
  if (limTotal > 0 && (Number(cup.usosTotales) || 0) >= limTotal) {
    return { ok: false, error: "Este cupón agotó sus usos disponibles" };
  }

  const exigeCuenta = cup.soloRegistrados === true || cup.primeraCompra === true;
  if (exigeCuenta && !clienteUid) {
    return { ok: false, error: "Este cupón es solo para usuarios registrados" };
  }

  if (clienteUid) {
    const usado = await db.doc("usuarios/" + clienteUid + "/cupones_usados/" + codigo).get();
    if (usado.exists) return { ok: false, error: "Ya usaste este cupón" };
    if (cup.primeraCompra === true) {
      const prev = await db.collection("usuarios/" + clienteUid + "/pedidos").limit(1).get();
      if (!prev.empty) return { ok: false, error: "Este cupón es solo para tu primera compra" };
    }
  }

  const descuento = tipo === "porcentaje"
    ? Math.round(subtotal * valor / 100)
    : Math.round(valor);

  return { ok: true, codigo, descuento: Math.max(0, Math.min(descuento, subtotal)) };
}

/* P23 — cálculo de extras/armado. MISMA lógica en la tienda (app.js,
   gxCalcular) y en el servidor (_firebase.js, calcularExtras): la tienda
   la usa para mostrar el precio en vivo, el servidor para cobrar. Si se
   cambia una, cambiar la otra.
   prod.gruposExtras = [idGrupo, ...]  (orden en que se muestran)
   lib = config/general.gruposExtras = [{ id, nombre, tipo, obligatorio, max, opciones:[{id,nombre,precio,activo}] }]
     tipo: "uno" (elige 1) | "varios" (elige hasta max) | "cantidad" (hasta max de cada uno) | "quitar" (sin costo)
   sel = { idGrupo: { idOpcion: cantidad } } */
function calcularExtras(prod, lib, sel){
  var ids = Array.isArray(prod && prod.gruposExtras) ? prod.gruposExtras : [];
  var mapa = {};
  (Array.isArray(lib) ? lib : []).forEach(function(g){ if (g && g.id) mapa[g.id] = g; });
  sel = (sel && typeof sel === "object") ? sel : {};
  var r = { ok: true, error: "", falta: null, faltaId: null, unit: 0, variantes: {}, detalle: [], sel: {}, nombres: [] };
  ids.forEach(function(gid){
    var g = mapa[gid];
    if (!g) return;
    var ops = (Array.isArray(g.opciones) ? g.opciones : []).filter(function(o){ return o && o.id && String(o.nombre || "").trim(); });
    if (!ops.length) return;
    var nombreG = String(g.nombre || "Extras").trim();
    r.nombres.push(nombreG);
    var tipo = ["uno", "varios", "cantidad", "quitar"].indexOf(g.tipo) >= 0 ? g.tipo : "uno";
    var req = tipo !== "quitar" && g.obligatorio === true;
    var max = Math.max(0, Math.floor(Number(g.max) || 0));
    var s = (sel[gid] && typeof sel[gid] === "object") ? sel[gid] : {};
    var elegidas = [], total = 0;
    ops.forEach(function(o){
      var c = Math.floor(Number(s[o.id]) || 0);
      if (c <= 0) return;
      if (o.activo === false){ if (r.ok){ r.ok = false; r.error = "\"" + o.nombre + "\" no está disponible ahora"; } return; }
      if (tipo === "cantidad"){ var lim = max || 10; if (c > lim) c = lim; } else c = 1;
      elegidas.push({ o: o, c: c }); total += c;
    });
    if (tipo === "uno" && elegidas.length > 1){ elegidas = elegidas.slice(0, 1); total = 1; }
    if (tipo === "varios" && max && elegidas.length > max){ elegidas = elegidas.slice(0, max); total = max; }
    if (req && total < 1 && r.ok){ r.ok = false; r.falta = nombreG; r.faltaId = gid; r.error = "falta completar «" + nombreG + "»"; }
    if (!elegidas.length) return;
    var textos = [];
    r.sel[gid] = {};
    elegidas.forEach(function(e){
      var precio = tipo === "quitar" ? 0 : Math.max(0, Math.round(Number(e.o.precio) || 0));
      r.unit += precio * e.c;
      r.sel[gid][e.o.id] = e.c;
      r.detalle.push({ grupo: nombreG, opcion: String(e.o.nombre).trim(), cantidad: e.c, precio: precio });
      var n = String(e.o.nombre).trim();
      textos.push(tipo === "quitar" ? "sin " + n.toLowerCase() : (e.c > 1 ? n + " x" + e.c : n));
    });
    r.variantes[nombreG] = textos.join(", ");
  });
  return r;
}

/* Variantes que manda el navegador (texto libre de grupos sin precio):
   solo strings cortos, máximo 10 claves. */
function _limpiarVariantes(v){
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out = {};
  Object.keys(v).slice(0, 10).forEach(function(k){
    const val = v[k];
    if (typeof val === "string" && val.trim()) out[String(k).slice(0, 60)] = val.trim().slice(0, 160);
  });
  return Object.keys(out).length ? out : null;
}

export async function validarItemsCatalogo(db, storeId, items){
  const idsUnicos = Array.from(new Set((items || []).map(function(i){ return i.id; })));
  const prodDocs = await Promise.all(idsUnicos.map(function(pid){
    return db.doc("tiendas/" + storeId + "/productos/" + pid).get();
  }));
  const catalogo = {};
  prodDocs.forEach(function(doc){ if (doc.exists) catalogo[doc.id] = doc.data(); });

  /* P23: grupos de extras de la tienda — se leen solo si algún producto los usa */
  let _libExtras = null;
  async function libExtras(){
    if (_libExtras) return _libExtras;
    const d = await db.doc("tiendas/" + storeId + "/config/general").get();
    _libExtras = d.exists && Array.isArray(d.data().gruposExtras) ? d.data().gruposExtras : [];
    return _libExtras;
  }

  const itemsValidados = [];
  for (const it of (items || [])) {
    const prod = catalogo[it.id];
    if (!prod) return { ok: false, error: "Uno de los productos ya no existe en el catálogo" };
    if (prod.activo === false) return { ok: false, error: "\"" + prod.nombre + "\" ya no está disponible" };

    const cantidad = Math.max(1, Math.floor(Number(it.cantidad) || 1));
    if (prod.stock !== null && prod.stock !== undefined && prod.stock !== "" && Number(prod.stock) < cantidad) {
      return { ok: false, error: "No hay stock suficiente de \"" + prod.nombre + "\"" };
    }
    let precio = Number(prod.precio) || 0;
    let variantes = _limpiarVariantes(it.variantes);
    let extras = null, extrasDetalle = null;
    if (Array.isArray(prod.gruposExtras) && prod.gruposExtras.length) {
      const cx = calcularExtras(prod, await libExtras(), it.extras);
      if (!cx.ok) return { ok: false, error: "\"" + prod.nombre + "\": " + cx.error };
      precio += cx.unit;
      /* el texto de los grupos con precio lo escribe el servidor, no el navegador */
      if (variantes) cx.nombres.forEach(function(n){ delete variantes[n]; });
      variantes = Object.assign({}, variantes || {}, cx.variantes);
      if (!Object.keys(variantes).length) variantes = null;
      if (Object.keys(cx.sel).length) { extras = cx.sel; extrasDetalle = cx.detalle; }
    }
    itemsValidados.push({
      id: it.id,
      nombre: prod.nombre,
      precio,
      cantidad,
      variantes,
      notaPersonal: typeof it.notaPersonal === "string" && it.notaPersonal.trim() ? it.notaPersonal.trim().slice(0, 140) : null,
      extras,
      extrasDetalle
    });
  }

  const subtotal = itemsValidados.reduce(function(acc, i){ return acc + i.precio * i.cantidad; }, 0);
  return { ok: true, itemsValidados, subtotal };
}

export async function validarPedidoCompleto(db, storeId, items, costoDelivery, cuponAplicado, clienteUid){
  const resItems = await validarItemsCatalogo(db, storeId, items);
  if (!resItems.ok) return resItems;

  const costoDeliveryReal = Math.max(0, Number(costoDelivery) || 0);
  let descuentoReal = 0;
  let cuponFinal = null;
  if (cuponAplicado) {
    const resCupon = await validarCuponServidor(db, storeId, cuponAplicado, clienteUid, resItems.subtotal);
    if (resCupon.ok) {
      descuentoReal = resCupon.descuento;
      cuponFinal = resCupon.codigo;
    }
  }

  const total = Math.max(0, resItems.subtotal - descuentoReal + costoDeliveryReal);
  return {
    ok: true,
    itemsValidados: resItems.itemsValidados,
    subtotal: resItems.subtotal,
    costoDelivery: costoDeliveryReal,
    descuento: descuentoReal,
    cuponFinal,
    total
  };
}

/* ─── Auth.createUser vía REST API de Firebase Auth ───
   El paquete @ljoukov/firebase-admin-cloudflare no expone Auth (solo
   Firestore). Para createUser() firmamos un JWT con la service account,
   lo intercambiamos por access_token en oauth2.googleapis.com, y hacemos
   POST a identitytoolkit.googleapis.com. */

function _b64url(str){
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function _getAccessToken(sa){
  const now = Math.floor(Date.now() / 1000);
  const header = _b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = _b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + payload;

  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), function(c){ return c.charCodeAt(0); });
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const sig64 = btoa(String.fromCharCode.apply(null, new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = unsigned + "." + sig64;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt
  });
  const j = await res.json();
  if (!res.ok) throw new Error("OAuth2: " + (j.error_description || j.error || res.status));
  return j.access_token;
}

async function _createUserViaRest(data){
  if (!_serviceAccount) throw new Error("Firebase no inicializado — llamá a getDb(env) primero");
  const token = await _getAccessToken(_serviceAccount);
  const res = await fetch(
    "https://identitytoolkit.googleapis.com/v1/projects/" + _serviceAccount.project_id + "/accounts",
    {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        emailVerified: data.emailVerified || false,
        displayName: data.displayName
      })
    }
  );
  const j = await res.json();
  if (!res.ok) throw new Error("createUser: " + (j.error && j.error.message ? j.error.message : res.status));
  return { uid: j.localId, email: j.email };
}

export const admin = {
  firestore: { FieldValue },
  auth: function(){
    return { createUser: _createUserViaRest };
  }
};


/* ─── Agrega un dominio a Firebase Auth → Dominios autorizados ───
   Así el login con Google funciona en cada tienda nueva sin tocar la consola. */
export async function autorizarDominio(hostname){
  if (!_serviceAccount) throw new Error("Firebase no inicializado — llamá a getDb(env) primero");
  const token = await _getAccessToken(_serviceAccount);
  const url = "https://identitytoolkit.googleapis.com/admin/v2/projects/" + _serviceAccount.project_id + "/config";
  const r1 = await fetch(url, { headers: { "Authorization": "Bearer " + token } });
  const cfg = await r1.json();
  if (!r1.ok) throw new Error("leer config Auth: " + (cfg.error && cfg.error.message ? cfg.error.message : r1.status));
  const lista = Array.isArray(cfg.authorizedDomains) ? cfg.authorizedDomains : [];
  if (lista.indexOf(hostname) !== -1) return { yaEstaba: true };
  const r2 = await fetch(url + "?updateMask=authorizedDomains", {
    method: "PATCH",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ authorizedDomains: lista.concat([hostname]) })
  });
  const j2 = await r2.json();
  if (!r2.ok) throw new Error("guardar dominio: " + (j2.error && j2.error.message ? j2.error.message : r2.status));
  return { agregado: true };
}


/* ─── Administración de cuentas (Auth REST con la service account) ───
   ruta: ":update" (clave, pausar) o ":delete". Lo usa repartidores.js. */
export async function authRest(ruta, body){
  if (!_serviceAccount) throw new Error("Firebase no inicializado — llamá a getDb(env) primero");
  const token = await _getAccessToken(_serviceAccount);
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/projects/" + _serviceAccount.project_id + "/accounts" + ruta, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(function(){ return {}; });
  if (!r.ok) throw new Error("auth" + ruta + ": " + (j.error && j.error.message ? j.error.message : r.status));
  return j;
}

/* ─── Quién llama: valida el ID token de Firebase (header Authorization:
   Bearer <token>) contra Firebase Auth y devuelve su uid, o null. ─── */
export async function uidDesdeToken(request, env){
  const t = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!t) return null;
  const key = env.FIREBASE_API_KEY || "AIzaSyBuzHcQezxE36F6nDJWqYsE5rOKUvQbMBM";
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + key, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: t })
  });
  if (!r.ok) return null;
  const j = await r.json().catch(function(){ return {}; });
  const u = j.users && j.users[0];
  return u && !u.disabled ? u.localId : null;
}
