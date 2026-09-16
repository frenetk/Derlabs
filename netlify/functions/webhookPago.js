/* netlify/functions/webhookPago.js
   MercadoPago llama acá (POST) cuando un pago cambia de estado.

   Si el pago está aprobado: CREA el pedido (nunca existió antes de
   este momento), descuenta stock, registra el cupón, envía emails y
   notifica al vendedor. Los datos completos del pedido (items,
   cliente, total, cupón) se leen de
   tiendas/{storeId}/intentos_pago/{pedidoId}, que es donde
   crearPago.js los dejó guardados al iniciar el checkout.

   Manejo de errores: si algo falla DESPUÉS de confirmar que el pago
   está aprobado, se marca el registro de intentos_pago con
   estado="error" y el detalle del fallo, en vez de terminar en
   silencio. Así, aunque la creación del pedido falle por algún motivo
   imprevisto, queda un rastro claro y accionable en vez de que el pago
   desaparezca sin dejar ninguna pista — que es justo lo que pasó la
   primera vez que se probó este diseño sin esta red de seguridad.

   TOKEN DE MERCADOPAGO — por tienda, no global:
   Cada tienda que corre sobre este Firebase compartido (modelo
   DerLabs: un mismo Firebase hospeda las tiendas de varios clientes
   distintos) tiene su PROPIO Access Token de MercadoPago, guardado en
   tiendas/{storeId}/config/privado.mpToken (documento solo accesible al
   dueño autenticado — ver README-FIRESTORE-RULES.md) vía devmode. El
   storeId viaja en la query string de notification_url (ver
   crearPago.js) para que este webhook sepa qué tienda es ANTES de
   necesitar ningún token — así puede pedirle a Firestore el token
   correcto de esa tienda específica, en vez de depender de un único
   token compartido por todo el sistema.
   Respaldo: si por algún motivo el storeId no viene en la query
   string (webhooks viejos, o algo cambia en MercadoPago), cae a la
   variable de entorno MP_ACCESS_TOKEN de Netlify — útil solo mientras
   haya una única tienda en el sistema; deja de ser correcto apenas
   haya una segunda tienda con su propio MercadoPago. */

const { MercadoPagoConfig, Payment } = require("mercadopago");
const { admin, getDb, corsHeaders, getStoreConfig, fmtPrecio, resumenItems } = require("./_firebase");
const { plantillaCliente, plantillaVendedor } = require("./enviarEmails");

exports.handler = async function(event){
  const headers = corsHeaders();

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { type, data } = body;
    if (type !== "payment" || !data || !data.id) {
      return { statusCode: 200, headers, body: "ok" };
    }

    const db = getDb();
    const storeIdDeQuery = (event.queryStringParameters || {}).storeId || "";

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
      // Respaldo — correcto solo mientras exista una única tienda en el sistema
      MP_TOKEN = process.env.MP_ACCESS_TOKEN || "";
    }
    if (!MP_TOKEN) {
      console.warn("webhookPago: no se encontró ningún token de MercadoPago (ni por tienda ni por variable de entorno), no se puede procesar");
      return { statusCode: 200, headers, body: "ok" };
    }

    const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
    const pago = await new Payment(mp).get({ id: data.id });

    console.log("webhookPago: pago " + data.id + " status=" + pago.status +
      " metadata=" + JSON.stringify(pago.metadata || {}));

    /* Única puerta de entrada a todo lo que sigue: el pago tiene que
       estar aprobado. Cualquier otro estado (pending, rejected, in_process,
       cancelled, etc) termina acá sin tocar Firestore ni disparar nada. */
    if (pago.status !== "approved" || !pago.metadata) {
      return { statusCode: 200, headers, body: "ok" };
    }

    const { pedidoId, storeId } = pago.metadata;
    if (!pedidoId || !storeId) {
      console.warn("webhookPago: pago approved pero sin pedidoId/storeId en metadata, se ignora");
      return { statusCode: 200, headers, body: "ok" };
    }
    if (storeIdDeQuery && storeIdDeQuery !== storeId) {
      // No debería pasar nunca en uso normal — señal de que algo raro
      // está mandando webhooks con datos inconsistentes. Se sigue
      // usando storeId de metadata (la fuente confiable, viene
      // directo de MercadoPago), solo se deja constancia en el log.
      console.warn("webhookPago: storeId de la URL (" + storeIdDeQuery + ") no coincide con el de metadata (" + storeId + ") — se usa el de metadata");
    }

    const pedRef = db.doc("tiendas/" + storeId + "/pedidos/" + pedidoId);
    const intentoRef = db.doc("tiendas/" + storeId + "/intentos_pago/" + pedidoId);

    const pedDocExistente = await pedRef.get();
    if (pedDocExistente.exists) {
      /* El pedido ya fue creado por una invocación anterior de este mismo
         webhook — MercadoPago reintenta notificaciones como mecanismo
         normal de entrega. No recrear ni reprocesar (evita duplicar
         emails, notificaciones push, y descuentos de stock). */
      console.log("webhookPago: pedido " + pedidoId + " ya existe, no se reprocesa (probablemente webhook duplicado de MercadoPago)");
      return { statusCode: 200, headers, body: "ok" };
    }

    let intentoDoc;
    try {
      intentoDoc = await intentoRef.get();
    } catch (e) {
      /* Si ni siquiera se puede LEER el intento, no hay forma de crear
         el pedido con los datos correctos. Este es exactamente el tipo
         de fallo que antes desaparecía sin dejar rastro — ahora al
         menos queda en los logs de Netlify con el pago ID real, que
         sirve para buscarlo manualmente en MercadoPago si hace falta. */
      console.error("webhookPago: fallo crítico leyendo intento " + pedidoId + " en " + storeId + " — pago " + data.id + " quedó aprobado sin pedido creado:", e.message);
      return { statusCode: 200, headers, body: "ok" };
    }

    if (!intentoDoc.exists) {
      /* Puede pasar si el intento nunca se guardó (fallo raro en
         crearPago.js) o si algo lo borró antes de tiempo. Sin los
         datos del pedido (items, cliente) no hay forma segura de
         reconstruirlo automáticamente — pero SÍ queda constancia del
         pago real en los logs para revisión manual. */
      console.error("webhookPago: pago " + data.id + " aprobado (pedido " + pedidoId + ", tienda " + storeId + ") pero no se encontró el intento_pago correspondiente — revisar manualmente en MercadoPago.");
      return { statusCode: 200, headers, body: "ok" };
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
      /* Este es el punto más crítico de toda la función: si esta
         escritura falla, el dinero está cobrado pero el pedido no
         existe. Marcar el intento como error explícito, con el motivo,
         para que sea visible y accionable desde devmode en vez de
         perderse en silencio. */
      console.error("webhookPago: FALLO CRÍTICO creando el pedido " + pedidoId + " tras pago aprobado " + data.id + ":", e.message);
      await intentoRef.set({ estado: "error", errorDetalle: e.message, pagoId: data.id, erroreEn: ahora }, { merge: true }).catch(function(){});
      return { statusCode: 200, headers, body: "ok" };
    }

    // El intento cumplió su propósito — se marca confirmado (no se borra, queda como historial)
    await intentoRef.set({ estado: "confirmado", pagoId: data.id, confirmadoEn: ahora }, { merge: true }).catch(function(){});

    if (ped.cliente && ped.cliente.uid) {
      await db.doc("usuarios/" + ped.cliente.uid + "/pedidos/" + pedidoId)
        .set(ped)
        .catch(function(e){ console.warn("Copia usuario:", e.message); });
    }

    // Descontar stock de cada producto (solo ahora que el pago está verificado)
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

    // Registrar el cupón como usado (solo ahora que el pago está verificado)
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
    /* config.url nunca se configura desde ningún lado en devmode —
       siempre usar el host real de la request como fuente confiable. */
    const origin = config.url || ("https://" + (event.headers.host || event.headers["x-forwarded-host"] || ""));

    // Emails de confirmación
    if (config.resendApiKey && config.emailEmisor) {
      try {
        const { Resend } = require("resend");
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

    /* Push notification al vendedor — vía netlify/functions/notificar.js,
       que ya sabe leer los dispositivos suscritos de Firestore y enviar
       el push cifrado (RFC 8291) sin depender de web-push. Se llama como
       una petición HTTP normal al mismo dominio. */
    try {
      await fetch(origin.replace(/\/+$/, "") + "/.netlify/functions/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId, pedidoId,
          cliente: ped.cliente || {},
          total: ped.total,
          items: ped.items || []
        })
      });
    } catch (e) {
      console.warn("No se pudo disparar la notificación push:", e.message);
    }

    return { statusCode: 200, headers, body: "ok" };
  } catch (e) {
    console.error("webhookPago error:", e);
    // Responder 200 igual para que MercadoPago no reintente indefinidamente
    return { statusCode: 200, headers, body: "ok" };
  }
};
