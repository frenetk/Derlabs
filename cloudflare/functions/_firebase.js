/* cloudflare/functions/_firebase.js
   Equivalente a netlify/functions/_firebase.js, en formato Worker (ESM).
   Usa @ljoukov/firebase-admin-cloudflare (REST + WebChannel) en lugar de
   firebase-admin oficial (gRPC), porque el runtime de Workers no soporta
   gRPC ni la generación de código en runtime de protobufjs. */

import { initializeApp } from "@ljoukov/firebase-admin-cloudflare/app";
import { getFirestore } from "@ljoukov/firebase-admin-cloudflare/firestore";

let dbInstancia = null;

export function getDb(env){
  if (!dbInstancia) {
    const raw = env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT en Cloudflare (Workers → Settings → Variables)");
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch (e) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido: " + e.message);
    }

    // Normalizar private_key (el JSON puede tener \n escapados)
    if (serviceAccount && typeof serviceAccount.private_key === "string") {
      let key = serviceAccount.private_key.trim();
      if (key.indexOf("\\n") !== -1) {
        key = key.replace(/\\n/g, "\n");
      }
      serviceAccount.private_key = key;
    }

    try {
      initializeApp({ serviceAccountJson: JSON.stringify(serviceAccount) });
    } catch (e) {
      throw new Error("No se pudo inicializar Firebase Admin — revisa el formato de FIREBASE_SERVICE_ACCOUNT: " + e.message);
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

  return {
    ok: true,
    codigo,
    descuento: Math.max(0, Math.min(descuento, subtotal))
  };
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
    if (!prod) {
      return { ok: false, error: "Uno de los productos ya no existe en el catálogo" };
    }
    if (prod.activo === false) {
      return { ok: false, error: "\"" + prod.nombre + "\" ya no está disponible" };
    }
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
