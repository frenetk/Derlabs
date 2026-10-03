/* cloudflare/functions/flow.js
   SEGUNDA PASARELA: Flow (Webpay, tarjetas y transferencia). Cada tienda
   pega su API Key y Secret Key en el panel (config/privado: flowApiKey,
   flowSecretKey, flowSandbox) y el checkout muestra la opción cuando
   config/general.flowActivo es true.

   Flujo (igual de estricto que con Mercado Pago: el pedido nace solo cuando
   la pasarela confirma el pago, nunca por lo que diga el navegador):
     1. crearPago.js valida el carrito y llama a iniciarPagoFlow(): crea la
        orden en Flow (payment/create), guarda el intento y devuelve la URL.
     2. El cliente paga en Flow.
     3. Flow llama a /api/webhookFlow (urlConfirmation) con un token →
        se consulta payment/getStatus → si está pagada (status 2) se crea
        el pedido.
     4. Flow devuelve al cliente por POST a /api/retornoFlow (urlReturn) →
        se consulta el estado y se le redirige a la tienda, que muestra
        "verificando" hasta que el pedido aparece.

   La API de Flow se firma: parámetros ordenados por nombre, concatenados
   nombre+valor, HMAC-SHA256 con la Secret Key, en el parámetro "s". */
import { admin, getDb, corsHeaders, getStoreConfig } from "./_firebase.js";
import { enviarCorreosPedido } from "./enviarEmails.js";
import { notificar } from "./notificar.js";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const baseFlow = sandbox => (sandbox ? "https://sandbox.flow.cl/api" : "https://www.flow.cl/api");

/* Llaves de Flow de una tienda, o null si no las tiene */
export function flowCfg(config){
  const apiKey = String((config && config.flowApiKey) || "").trim(), secretKey = String((config && config.flowSecretKey) || "").trim();
  return apiKey && secretKey ? { apiKey, secretKey, sandbox: config.flowSandbox === true } : null;
}

export async function flowFirma(params, secretKey){
  const cadena = Object.keys(params).filter(k => k !== "s").sort().map(k => k + params[k]).join("");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", key, enc.encode(cadena));
  return Array.from(new Uint8Array(firma), b => ("0" + b.toString(16)).slice(-2)).join("");
}

/* Llamada firmada a la API de Flow. Lanza Error con el mensaje de Flow si falla. */
export async function flowLlamar(fc, metodo, ruta, params){
  const p = {};
  Object.keys(params).forEach(k => { if (params[k] != null && params[k] !== "") p[k] = String(params[k]); });
  p.apiKey = fc.apiKey;
  p.s = await flowFirma(p, fc.secretKey);
  const cuerpo = new URLSearchParams(p).toString();
  const url = baseFlow(fc.sandbox) + "/" + ruta;
  const r = metodo === "GET"
    ? await fetch(url + "?" + cuerpo, { method: "GET" })
    : await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: cuerpo });
  const texto = await r.text();
  let j = null; try { j = JSON.parse(texto); } catch (e) {}
  if (!r.ok || !j){
    const msj = (j && j.message) || ("respuesta " + r.status);
    throw Object.assign(new Error("Flow: " + msj), { flow: true, st: r.status });
  }
  return j;
}

/* Paso 1 — lo llama crearPago.js con el pedido ya validado contra Firestore */
export async function iniciarPagoFlow(d){
  const { db, storeId, config, id, urlTienda, cliente, tipo, val, seguimiento } = d;
  const fc = flowCfg(config);
  if (!fc) return { st: 400, error: "El pago con Webpay (Flow) no está configurado en esta tienda" };
  const email = String((cliente && cliente.email) || "").trim().toLowerCase();
  if (!EMAIL_OK.test(email)) return { st: 400, error: "Para pagar con Webpay escribe tu correo: ahí te llega el comprobante" };

  /* Flow exige un número de orden único por comercio; el del pedido se repite con el tiempo */
  const azar = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => ("0" + b.toString(16)).slice(-2)).join("");
  const orden = id + "-" + azar;
  const enc = encodeURIComponent;
  const r = await flowLlamar(fc, "POST", "payment/create", {
    commerceOrder: orden,
    subject: ("Pedido " + id + (config.nombre ? " · " + config.nombre : "")).slice(0, 90),
    currency: "CLP",
    amount: val.total,
    email,
    urlConfirmation: urlTienda + "/api/webhookFlow?storeId=" + enc(storeId),
    urlReturn: urlTienda + "/api/retornoFlow?storeId=" + enc(storeId) + "&pid=" + enc(id),
    optional: JSON.stringify({ pedidoId: id, storeId }),
    timeout: 1500     /* la orden vence a los 25 min, antes de que limpiarPendientes borre el intento (30 min) */
  });
  if (!r.url || !r.token) return { st: 502, error: "Flow no devolvió la dirección de pago" };

  await db.doc("tiendas/" + storeId + "/intentos_pago/" + id).set({
    id, storeId, tipo, cliente,
    items: val.itemsValidados, subtotal: val.subtotal, descuento: val.descuento, cuponAplicado: val.cuponFinal,
    costoDelivery: val.costoDelivery, total: val.total,
    pasarela: "flow", flowToken: r.token, flowOrder: r.flowOrder || null, flowOrden: orden,
    seguimiento, estado: "iniciado", creadoEn: new Date().toISOString()
  });
  return { st: 200, init_point: r.url + "?token=" + r.token, pedidoId: id };
}

/* Crea el pedido a partir del intento, una sola vez. Devuelve "creado", "ya" o "sin". */
async function confirmarPedidoFlow(db, env, storeId, pedidoId, estadoFlow, origen){
  const pedRef = db.doc("tiendas/" + storeId + "/pedidos/" + pedidoId);
  const intentoRef = db.doc("tiendas/" + storeId + "/intentos_pago/" + pedidoId);
  if ((await pedRef.get()).exists) return "ya";
  const intentoDoc = await intentoRef.get();
  if (!intentoDoc.exists){
    console.error("flow: orden " + estadoFlow.flowOrder + " pagada (pedido " + pedidoId + ", tienda " + storeId + ") pero no hay intento de pago — revisar a mano en Flow.");
    return "sin";
  }
  const intento = intentoDoc.data();
  const ahora = new Date().toISOString();
  /* otro aviso de Flow (confirmación y retorno llegan casi juntos) ya lo está creando */
  if (intento.estado === "confirmado") return "ya";
  if (intento.estado === "confirmando" && intento.confirmandoEn && Date.now() - Date.parse(intento.confirmandoEn) < 60000) return "ya";
  if (Number(estadoFlow.amount) !== Number(intento.total)){
    console.error("flow: el monto pagado (" + estadoFlow.amount + ") no coincide con el pedido " + pedidoId + " (" + intento.total + ") en " + storeId);
    await intentoRef.set({ estado: "error", errorDetalle: "Monto pagado distinto al del pedido", pagoId: estadoFlow.flowOrder || null, erroreEn: ahora }, { merge: true }).catch(function(){});
    return "sin";
  }
  await intentoRef.set({ estado: "confirmando", confirmandoEn: ahora }, { merge: true });

  const ped = {
    id: pedidoId, storeId,
    tipo: intento.tipo,
    cliente: intento.cliente,
    items: intento.items,
    subtotal: intento.subtotal,
    descuento: intento.descuento || 0,
    cuponAplicado: intento.cuponAplicado || null,
    costoDelivery: intento.costoDelivery || 0,
    total: intento.total,
    metodoPago: "flow",
    estado: "nuevo",
    pagoId: estadoFlow.flowOrder || null,
    seguimiento: intento.seguimiento || null,
    uid: (intento.cliente && intento.cliente.uid) || null,
    fecha: intento.creadoEn || ahora,
    estadoTimeline: { nuevo: ahora, preparacion: null, camino: null, listo: null }
  };
  try { await pedRef.set(ped); }
  catch (e) {
    console.error("flow: FALLO CRÍTICO creando el pedido " + pedidoId + " tras pago " + estadoFlow.flowOrder + ":", e.message);
    await intentoRef.set({ estado: "error", errorDetalle: e.message, pagoId: estadoFlow.flowOrder || null, erroreEn: ahora }, { merge: true }).catch(function(){});
    return "sin";
  }
  await intentoRef.set({ estado: "confirmado", pagoId: estadoFlow.flowOrder || null, confirmadoEn: ahora }, { merge: true }).catch(function(){});

  if (ped.uid) await db.doc("usuarios/" + ped.uid + "/pedidos/" + pedidoId).set(ped).catch(function(e){ console.warn("Copia usuario:", e.message); });

  if (Array.isArray(ped.items)) await Promise.all(ped.items.map(async function(it){
    try {
      const prodRef = db.doc("tiendas/" + storeId + "/productos/" + it.id);
      const prodDoc = await prodRef.get();
      if (!prodDoc.exists) return;
      const prod = prodDoc.data();
      if (prod.stock === null || prod.stock === undefined || prod.stock === "") return;
      await prodRef.set({ stock: Math.max(0, (Number(prod.stock) || 0) - (Number(it.cantidad) || 1)) }, { merge: true });
    } catch (e) { console.warn("No se pudo descontar stock de", it.id, ":", e.message); }
  }));

  if (ped.cuponAplicado){
    try {
      const codigo = String(ped.cuponAplicado).toUpperCase();
      const s = await db.collection("tiendas/" + storeId + "/cupones").where("codigo", "==", codigo).limit(1).get();
      if (!s.empty) await s.docs[0].ref.set({ usosTotales: admin.firestore.FieldValue.increment(1) }, { merge: true });
      if (ped.uid) await db.doc("usuarios/" + ped.uid + "/cupones_usados/" + codigo).set({ fecha: ahora, pedidoId }, { merge: true });
    } catch (e) { console.warn("No se pudo registrar el cupón usado:", e.message); }
  }

  try { await enviarCorreosPedido(db, env, storeId, ped, origen); } catch (e) { console.warn("Correos:", e.message); }
  try {
    await notificar(new Request(origen + "/api/notificar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, pedidoId, cliente: ped.cliente || {}, total: ped.total, items: ped.items || [] })
    }), env);
  } catch (e) { console.warn("No se pudo disparar la notificación push:", e.message); }
  return "creado";
}

/* Token que manda Flow: en el cuerpo (formulario) o, por si acaso, en la dirección */
async function leerToken(request){
  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";
  if (!token && request.method === "POST"){
    const texto = await request.text().catch(function(){ return ""; });
    token = new URLSearchParams(texto).get("token") || "";
    if (!token){ try { token = JSON.parse(texto).token || ""; } catch (e) {} }
  }
  return String(token).trim();
}
/* A qué pedido corresponde un estado de Flow */
function pedidoDeEstado(st){
  let op = st.optional;
  if (typeof op === "string"){ try { op = JSON.parse(op); } catch (e) { op = null; } }
  if (op && op.pedidoId) return String(op.pedidoId);
  const co = String(st.commerceOrder || ""), i = co.lastIndexOf("-");
  return i > 0 ? co.slice(0, i) : co;
}
/* Consulta el estado y confirma que el token es el del intento de ESTA tienda */
async function estadoVerificado(db, storeId, token){
  const config = await getStoreConfig(db, storeId);
  const fc = flowCfg(config);
  if (!fc) return { error: "sin llaves" };
  const st = await flowLlamar(fc, "GET", "payment/getStatus", { token });
  const pedidoId = pedidoDeEstado(st);
  if (!pedidoId) return { error: "sin pedido" };
  const intento = await db.doc("tiendas/" + storeId + "/intentos_pago/" + pedidoId).get();
  if (intento.exists && intento.data().flowToken && intento.data().flowToken !== token) return { error: "token ajeno" };
  return { st, pedidoId, config };
}

/* Paso 3 — urlConfirmation: Flow avisa (servidor a servidor) que la orden cambió */
export async function webhookFlow(request, env){
  const headers = corsHeaders();
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers });
  try {
    const url = new URL(request.url);
    const storeId = String(url.searchParams.get("storeId") || "").replace(/[^A-Za-z0-9_-]/g, "");
    const token = await leerToken(request);
    if (!storeId || !token) return new Response("ok", { status: 200, headers });
    const db = getDb(env);
    const v = await estadoVerificado(db, storeId, token);
    if (v.error){ console.warn("webhookFlow: " + v.error + " (tienda " + storeId + ")"); return new Response("ok", { status: 200, headers }); }
    console.log("webhookFlow: orden " + v.st.flowOrder + " status=" + v.st.status + " pedido=" + v.pedidoId);
    if (Number(v.st.status) === 2)
      await confirmarPedidoFlow(db, env, storeId, v.pedidoId, v.st, v.config.url || url.origin);
    return new Response("ok", { status: 200, headers });
  } catch (e) {
    console.error("webhookFlow error:", e.message);
    /* si Flow no pudo ser consultado, que reintente el aviso */
    return new Response("error", { status: e && e.flow ? 502 : 200, headers });
  }
}

/* Paso 4 — urlReturn: Flow devuelve al cliente (su navegador hace POST aquí) */
export async function retornoFlow(request, env){
  const url = new URL(request.url);
  const storeId = String(url.searchParams.get("storeId") || "").replace(/[^A-Za-z0-9_-]/g, "");
  let pid = String(url.searchParams.get("pid") || "").replace(/[^A-Za-z0-9_-]/g, "");
  let estado = "failure";
  try {
    const token = await leerToken(request);
    if (storeId && token){
      const db = getDb(env);
      const v = await estadoVerificado(db, storeId, token);
      if (!v.error){
        pid = v.pedidoId;
        const s = Number(v.st.status);
        if (s === 2){
          estado = "approved";
          /* normalmente la confirmación ya creó el pedido; si no llegó, se le da un momento y se crea aquí */
          const pedRef = db.doc("tiendas/" + storeId + "/pedidos/" + pid);
          if (!(await pedRef.get()).exists){
            await new Promise(function(ok){ setTimeout(ok, 2500); });
            if (!(await pedRef.get()).exists) await confirmarPedidoFlow(db, env, storeId, pid, v.st, v.config.url || url.origin);
          }
        } else if (s === 1) estado = "pending";
      }
    }
  } catch (e) {
    console.error("retornoFlow error:", e.message);
    estado = "approved";   /* no se pudo consultar: la tienda muestra "verificando" y espera la confirmación */
  }
  const destino = url.origin + "/?status=" + estado + (pid ? "&pedido_id=" + encodeURIComponent(pid) : "");
  return new Response(null, { status: 303, headers: { Location: destino, "Cache-Control": "no-store" } });
}
