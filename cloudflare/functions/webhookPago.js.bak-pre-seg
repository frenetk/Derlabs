/* cloudflare/functions/webhookPago.js
   Equivalente a netlify/functions/webhookPago.js.

   CAMBIO REAL, no solo de formato: el original hacía
   require("resend") DINÁMICO, dentro del try, justo antes de
   usarlo — un patrón válido en CommonJS. En ESM, import es siempre
   estático y va al principio del archivo (no se puede reproducir el
   mismo require() condicional de la misma forma) — se movió arriba,
   sin cambiar el comportamiento real: sigue sin instanciar Resend si
   config.resendApiKey/emailEmisor no están, exactamente igual que
   antes.

   También cambia cómo se llama a notificar.js al final: el original
   usaba fetch() a una URL absoluta de Netlify Functions — acá se
   llama directo a la función importada (ver worker.js), evitando un
   salto de red innecesario entre dos funciones del mismo Worker. */

import { MercadoPagoConfig, Payment } from "mercadopago";
import { Resend } from "resend";
import { admin, getDb, corsHeaders, getStoreConfig } from "./_firebase.js";
import { plantillaCliente, plantillaVendedor } from "./enviarEmails.js";
import { notificar } from "./notificar.js";

export async function webhookPago(request, env){
  const headers = corsHeaders();

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  try {
    const body = JSON.parse(await request.text() || "{}");
    const { type, data } = body;
    if (type !== "payment" || !data || !data.id) {
      return new Response("ok", { status: 200, headers });
    }

    const db = getDb(env);
    const url = new URL(request.url);
    const storeIdDeQuery = url.searchParams.get("storeId") || "";

    let MP_TOKEN = "";
    if (storeIdDeQuery) {
      try {
        const config = await getStoreConfig(db, storeIdDeQuery);
        MP_TOKEN = config.mpToken && config.mpToken !== "CONFIGURAR_TOKEN" ? config.mpToken : "";
      } catch (e) {
        console.warn("webhookPago: no se pudo leer mpToken de la tienda " + storeIdDeQuery + ":", e.message);
      }
    }
    if (!MP_TOKEN) {
      MP_TOKEN = env.MP_ACCESS_TOKEN || "";
    }
    if (!MP_TOKEN) {
      console.warn("webhookPago: no se encontró ningún token de MercadoPago, no se puede procesar");
      return new Response("ok", { status: 200, headers });
    }

    const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
    const pago = await new Payment(mp).get({ id: data.id });

    console.log("webhookPago: pago " + data.id + " status=" + pago.status +
      " metadata=" + JSON.stringify(pago.metadata || {}));

    if (pago.status !== "approved" || !pago.metadata) {
      return new Response("ok", { status: 200, headers });
    }

    const { pedidoId, storeId } = pago.metadata;
    if (!pedidoId || !storeId) {
      console.warn("webhookPago: pago approved pero sin pedidoId/storeId en metadata, se ignora");
      return new Response("ok", { status: 200, headers });
    }
    if (storeIdDeQuery && storeIdDeQuery !== storeId) {
      console.warn("webhookPago: storeId de la URL (" + storeIdDeQuery + ") no coincide con el de metadata (" + storeId + ") — se usa el de metadata");
    }

    const pedRef = db.doc("tiendas/" + storeId + "/pedidos/" + pedidoId);
    const intentoRef = db.doc("tiendas/" + storeId + "/intentos_pago/" + pedidoId);

    const pedDocExistente = await pedRef.get();
    if (pedDocExistente.exists) {
      console.log("webhookPago: pedido " + pedidoId + " ya existe, no se reprocesa (probablemente webhook duplicado de MercadoPago)");
      return new Response("ok", { status: 200, headers });
    }

    let intentoDoc;
    try {
      intentoDoc = await intentoRef.get();
    } catch (e) {
      console.error("webhookPago: fallo crítico leyendo intento " + pedidoId + " en " + storeId + " — pago " + data.id + " quedó aprobado sin pedido creado:", e.message);
      return new Response("ok", { status: 200, headers });
    }

    if (!intentoDoc.exists) {
      console.error("webhookPago: pago " + data.id + " aprobado (pedido " + pedidoId + ", tienda " + storeId + ") pero no se encontró el intento_pago correspondiente — revisar manualmente en MercadoPago.");
      return new Response("ok", { status: 200, headers });
    }

    const intento = intentoDoc.data();
    const ahora = new Date().toISOString();

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
      metodoPago: "mercadopago",
      estado: "nuevo",
      pagoId: data.id,
      fecha: intento.creadoEn || ahora,
      estadoTimeline: { nuevo: ahora, preparacion: null, camino: null, listo: null }
    };

    try {
      await pedRef.set(ped);
    } catch (e) {
      console.error("webhookPago: FALLO CRÍTICO creando el pedido " + pedidoId + " tras pago aprobado " + data.id + ":", e.message);
      await intentoRef.set({ estado: "error", errorDetalle: e.message, pagoId: data.id, erroreEn: ahora }, { merge: true }).catch(function(){});
      return new Response("ok", { status: 200, headers });
    }

    await intentoRef.set({ estado: "confirmado", pagoId: data.id, confirmadoEn: ahora }, { merge: true }).catch(function(){});

    if (ped.cliente && ped.cliente.uid) {
      await db.doc("usuarios/" + ped.cliente.uid + "/pedidos/" + pedidoId)
        .set(ped)
        .catch(function(e){ console.warn("Copia usuario:", e.message); });
    }

    if (Array.isArray(ped.items)) {
      await Promise.all(ped.items.map(async function(it){
        try {
          const prodRef = db.doc("tiendas/" + storeId + "/productos/" + it.id);
          const prodDoc = await prodRef.get();
          if (!prodDoc.exists) return;
          const prod = prodDoc.data();
          if (prod.stock === null || prod.stock === undefined || prod.stock === "") return;
          const nuevo = Math.max(0, (Number(prod.stock) || 0) - (Number(it.cantidad) || 1));
          await prodRef.set({ stock: nuevo }, { merge: true });
        } catch (e) {
          console.warn("No se pudo descontar stock de", it.id, ":", e.message);
        }
      }));
    }

    if (ped.cuponAplicado) {
      try {
        const codigo = String(ped.cuponAplicado).toUpperCase();
        const cuponesSnap = await db.collection("tiendas/" + storeId + "/cupones")
          .where("codigo", "==", codigo).limit(1).get();
        if (!cuponesSnap.empty) {
          await cuponesSnap.docs[0].ref.set(
            { usosTotales: admin.firestore.FieldValue.increment(1) }, { merge: true }
          );
        }
        if (ped.cliente && ped.cliente.uid) {
          await db.doc("usuarios/" + ped.cliente.uid + "/cupones_usados/" + codigo)
            .set({ fecha: ahora, pedidoId }, { merge: true });
        }
      } catch (e) {
        console.warn("No se pudo registrar el cupón usado:", e.message);
      }
    }

    const config = await getStoreConfig(db, storeId);
    const origin = config.url || url.origin;

    if (config.resendApiKey && config.emailEmisor) {
      try {
        const resend = new Resend(config.resendApiKey);
        if (ped.cliente && ped.cliente.email) {
          await resend.emails.send({
            from: config.emailEmisor,
            to: ped.cliente.email,
            subject: "✅ Pedido #" + pedidoId + " confirmado — " + (config.nombreTienda || config.nombre || ""),
            html: plantillaCliente(ped, config.nombreTienda || config.nombre || "Tu tienda", config.colorPrimario || config.colorHex || "#E53935")
          });
        }
        if (config.emailVendedor) {
          await resend.emails.send({
            from: config.emailEmisor,
            to: config.emailVendedor,
            subject: "🛍️ Pedido pagado #" + pedidoId,
            html: plantillaVendedor(ped, config.nombreTienda || config.nombre || "Tu tienda", config.colorPrimario || config.colorHex || "#E53935", origin)
          });
        }
      } catch (e) {
        console.warn("Error enviando emails desde webhook:", e.message);
      }
    }

    try {
      await notificar(new Request(origin + "/api/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId, pedidoId,
          cliente: ped.cliente || {},
          total: ped.total,
          items: ped.items || []
        })
      }), env);
    } catch (e) {
      console.warn("No se pudo disparar la notificación push:", e.message);
    }

    return new Response("ok", { status: 200, headers });
  } catch (e) {
    console.error("webhookPago error:", e);
    return new Response("ok", { status: 200, headers });
  }
}
