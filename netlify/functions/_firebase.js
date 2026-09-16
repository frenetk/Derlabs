/* netlify/functions/_firebase.js
   Helper compartido: inicializa Firebase Admin una sola vez por instancia
   de función (Netlify reutiliza el contenedor entre invocaciones "calientes").

   REQUIERE una variable de entorno en Netlify:
     FIREBASE_SERVICE_ACCOUNT  → el JSON completo de la cuenta de servicio,
     en una sola línea (Netlify → Site settings → Environment variables).

   Cómo conseguir ese JSON:
     Firebase Console → ⚙️ Configuración del proyecto → Cuentas de servicio
     → "Generar nueva clave privada" → descarga un .json
     → copia todo su contenido y pégalo como valor de la variable de entorno
       (Netlify acepta JSON multilínea sin problema al pegarlo tal cual). */

const admin = require("firebase-admin");

function getDb(){
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error("Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT en Netlify");
    }
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(raw);
    } catch (e) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT no es un JSON válido: " + e.message);
    }
    /* Al copiar el JSON desde un navegador móvil (tocar y arrastrar para
       seleccionar texto) es muy común que los saltos de línea reales
       dentro de private_key se corrompan o se colapsen. Esto normaliza
       el campo aceptando cualquiera de las dos formas: el escape literal
       "\n" (backslash + n como texto) o saltos de línea reales ya
       presentes, y reconstruye el formato PEM que espera la librería. */
    if (serviceAccount && typeof serviceAccount.private_key === "string") {
      let key = serviceAccount.private_key.trim();
      if (key.indexOf("\\n") !== -1) {
        key = key.replace(/\\n/g, "\n");
      }
      if (key.indexOf("\n") === -1 && key.indexOf("-----BEGIN") !== -1) {
        /* Todo quedó en una sola línea sin ningún separador — reconstruir
           el PEM insertando saltos de línea alrededor de los delimitadores
           y cada 64 caracteres del cuerpo, como exige el formato PEM. */
        const match = key.match(/-----BEGIN [^-]+-----(.*)-----END [^-]+-----/);
        if (match) {
          const header = key.slice(0, key.indexOf("-----", 5) + 5);
          const footer = key.slice(key.lastIndexOf("-----END"));
          const headerTag = key.match(/-----BEGIN [^-]+-----/)[0];
          const footerTag = key.match(/-----END [^-]+-----/)[0];
          const body = key.replace(headerTag, "").replace(footerTag, "").trim();
          const lines = body.match(/.{1,64}/g) || [body];
          key = headerTag + "\n" + lines.join("\n") + "\n" + footerTag + "\n";
        }
      }
      serviceAccount.private_key = key;
    }
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (e) {
      throw new Error("No se pudo inicializar Firebase Admin — revisa el formato de FIREBASE_SERVICE_ACCOUNT (posible problema con private_key): " + e.message);
    }
  }
  return admin.firestore();
}

function corsHeaders(){
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

function fmtPrecio(n){
  return "$" + Number(n || 0).toLocaleString("es-CL");
}

function resumenItems(items){
  return (items || []).map(function(i){ return i.cantidad + "× " + i.nombre; }).join(", ");
}

function esc(s){
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* La config de una tienda vive partida en dos documentos:
     config/general → público (nombre, color, delivery, mensajes, etc.)
     config/privado → solo lectura del dueño autenticado (mpToken,
                       resendApiKey, emailEmisor, emailVendedor)
   Ver netlify/functions/README-FIRESTORE-RULES.md para el porqué.
   El backend siempre corre con credenciales de servicio (Admin SDK), así
   que puede leer ambos sin que las reglas de seguridad se lo impidan —
   acá se combinan en un solo objeto para que el resto del código
   (crearPago, webhookPago, enviarEmails) siga leyendo config.mpToken,
   config.resendApiKey, etc. sin tener que saber que están separados. */
async function getStoreConfig(db, storeId){
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

/* ════════════════════════════════════════════════════════════════
   VALIDACIÓN COMPARTIDA DE PEDIDO — usada por crearPago.js (MercadoPago)
   y crearPedidoEfectivo.js (efectivo). Ningún flujo de creación de
   pedido debe confiar en items[].precio, subtotal, descuento o total
   que mande el cliente — ambos pasan por acá para recalcularlos contra
   Firestore. Mantener esta función como la única fuente de verdad evita
   que las reglas de negocio (cupones, stock) diverjan entre los dos
   flujos de pago con el tiempo.
   ════════════════════════════════════════════════════════════════ */

/* Misma lógica que index.html → validarCupon() del lado del cliente,
   reimplementada acá porque el backend no puede confiar en el resultado
   que ya calculó el navegador. Cualquier cambio a las reglas de cupones
   debe replicarse en ambos lados. Devuelve { ok, codigo?, descuento?, error? }. */
async function validarCuponServidor(db, storeId, codigoCrudo, clienteUid, subtotal){
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

/* Releer cada producto real desde Firestore — nunca confiar en
   items[].precio, que viene del navegador del comprador. Si algún id no
   existe o el producto está desactivado, se devuelve error en vez de
   descartar silenciosamente ese ítem, porque eso cambiaría el pedido a
   espaldas del comprador.
   Devuelve { ok, itemsValidados?, subtotal?, error? }. */
async function validarItemsCatalogo(db, storeId, items){
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

/* Combina las dos validaciones anteriores en el flujo completo que
   necesita cualquier función de creación de pedido: catálogo + stock,
   luego cupón contra el subtotal ya validado, luego el total final.
   Un cupón inválido no aborta el pedido — simplemente no se aplica
   descuento, igual que haría un checkout normal si el cupón vence entre
   que se muestra y que se confirma. Devuelve
   { ok, itemsValidados?, subtotal?, descuento?, cuponFinal?, total?, error? }. */
async function validarPedidoCompleto(db, storeId, items, costoDelivery, cuponAplicado, clienteUid){
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

module.exports = {
  admin, getDb, corsHeaders, fmtPrecio, resumenItems, esc, getStoreConfig,
  validarCuponServidor, validarItemsCatalogo, validarPedidoCompleto
};
