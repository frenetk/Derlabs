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
  return (items || []).map(function(i){ return i.cantidad + "x " + i.nombre; }).join(", ");
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

export async function validarItemsCatalogo(db, storeId, items){
  const idsUnicos = Array.from(new Set((items || []).map(function(i){ return i.id; })));
  const prodDocs = await Promise.all(idsUnicos.map(function(pid){
    return db.doc("tiendas/" + storeId + "/productos/" + pid).get();
  }));
  const catalogo = {};
  prodDocs.forEach(function(doc){ if (doc.exists) catalogo[doc.id] = doc.data(); });

  const itemsValidados = [];
  for (const it of (items || [])) {
    const prod = catalogo[it.id];
    if (!prod) return { ok: false, error: "Uno de los productos ya no existe en el catálogo" };
    if (prod.activo === false) return { ok: false, error: "\"" + prod.nombre + "\" ya no está disponible" };

    const cantidad = Math.max(1, Math.floor(Number(it.cantidad) || 1));
    if (prod.stock !== null && prod.stock !== undefined && prod.stock !== "" && Number(prod.stock) < cantidad) {
      return { ok: false, error: "No hay stock suficiente de \"" + prod.nombre + "\"" };
    }
    itemsValidados.push({
      id: it.id,
      nombre: prod.nombre,
      precio: Number(prod.precio) || 0,
      cantidad
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
