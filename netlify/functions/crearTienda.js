/* netlify/functions/crearTienda.js
   POST /.netlify/functions/crearTienda
   header: X-Admin-Secret: <el valor de ADMIN_SECRET en Netlify>
   body: { nombreNegocio, rubro, hostname, colorPrimario?,
           logoBase64?, splashBase64?,
           emailPropietario?, passwordPropietario? }

   Automatiza de punta a punta lo que el LEEME (sección 9) y el
   ROADMAP.md (sección 5) describían como pasos manuales en Firebase
   Console: generar storeId, sembrar config/general + config/privado
   con la paleta del rubro ya aplicada, registrar el dominio, y crear
   la cuenta de propietario. Lo que sigue manual, por diseño (ver
   ROADMAP.md sección 5, con el motivo de cada uno): apuntar el DNS,
   agregar el dominio en Netlify, y el Access Token de MercadoPago del
   cliente (tiene que salir de SU cuenta, nunca generable acá).

   PROTECCIÓN: esta función puede crear cuentas de usuario y registrar
   dominios — sin control, cualquiera que descubra la URL podría
   generar tiendas arbitrarias o intentar registrar un dominio ajeno.
   Exige el header X-Admin-Secret, comparado contra la variable de
   entorno ADMIN_SECRET de Netlify. No es un sistema de login completo
   — es proporcional al alcance real (un panel de una sola persona, no
   un producto con múltiples administradores todavía). Si en el futuro
   más de una persona necesita dar de alta tiendas, esto debería
   evolucionar a cuentas individuales con su propio registro de quién
   hizo qué, no seguir siendo un secreto compartido. */

const { admin, getDb, corsHeaders } = require("./_firebase");

const RUBROS = {
  "hamburguesas":  { colorPrimario: "#9B1B30" },
  "comida-rapida": { colorPrimario: "#C83D09" },
  "cafeteria":     { colorPrimario: "#5C3D2E" },
  "pasteleria":    { colorPrimario: "#C2185B" },
  "ropa":          { colorPrimario: "#1A1A1A" },
  "belleza":       { colorPrimario: "#D46A9F" },
  "servicios":     { colorPrimario: "#1565C0" },
  "otro":          { colorPrimario: "#546E7A" }
};

function slugify(texto){
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // saca tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "tienda";
}

exports.handler = async function(event){
  const headers = corsHeaders();

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  const secretEsperado = process.env.ADMIN_SECRET;
  const secretRecibido = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!secretEsperado) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "ADMIN_SECRET no está configurado en Netlify" }) };
  }
  if (secretRecibido !== secretEsperado) {
    return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: "No autorizado" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { nombreNegocio, rubro, hostname, colorPrimario, logoBase64, splashBase64, emailPropietario, passwordPropietario } = body;

    if (!nombreNegocio || !hostname) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Faltan nombreNegocio o hostname" }) };
    }
    /* El frontend ya comprime cada imagen por separado (ver
       comprimirImagen() en generar-tienda.html), pero el servidor
       nunca debe confiar en que el cliente respetó ese límite — mismo
       principio que la validación de precios en crearPago.js. Acá se
       vuelve a chequear el tamaño combinado de ambas imágenes contra
       el límite real de 1 MiB por documento de Firestore, dejando
       margen para el resto de los campos de config/general. */
    const LIMITE_IMAGENES_COMBINADO = 700 * 1024; // bytes, deja ~350KB de margen bajo 1 MiB
    const pesoImagenes = (logoBase64 ? logoBase64.length : 0) + (splashBase64 ? splashBase64.length : 0);
    if (pesoImagenes > LIMITE_IMAGENES_COMBINADO) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Las imágenes combinadas son demasiado grandes — probá con archivos más livianos o de menor resolución." }) };
    }

    const rubroValido = RUBROS[rubro] ? rubro : "otro";
    const color = colorPrimario || RUBROS[rubroValido].colorPrimario;
    const hostnameLimpio = String(hostname).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");

    const db = getDb();

    /* storeId único: si el slug base ya existe, se le agrega un sufijo
       numérico — dos negocios pueden llamarse parecido ("Pizzería
       Juan" y "Pizzería Juana") y no deben pisarse el storeId. */
    let storeId = slugify(nombreNegocio);
    let intento = storeId;
    let sufijo = 1;
    while ((await db.doc("tiendas/" + intento + "/config/general").get()).exists) {
      sufijo++;
      intento = storeId + "-" + sufijo;
    }
    storeId = intento;

    /* No pisar un dominio que ya apunta a otra tienda — un typo acá
       redirigiría el sitio de un cliente existente hacia datos de otro. */
    const domExistente = await db.doc("dominios/" + hostnameLimpio).get();
    if (domExistente.exists && domExistente.data().storeId !== storeId) {
      return {
        statusCode: 409, headers,
        body: JSON.stringify({ ok: false, error: "Ese hostname ya está registrado para la tienda \"" + domExistente.data().storeId + "\"" })
      };
    }

    const ahora = new Date().toISOString();
    const configGeneral = {
      nombre: nombreNegocio,
      tagline: "",
      whatsapp: "CONFIGURAR_WHATSAPP",
      deliveryMinimo: 15000,
      deliveryCosto: 1500,
      tiempoEntrega: "30-45 min",
      abierto: true,
      mpActivo: false,
      deliveryActivo: true,
      retiroActivo: true,
      rubro: rubroValido,
      colorPrimario: color,
      logoBase64: logoBase64 || "",
      splashImagenBase64: splashBase64 || "",
      confTitulo: "¡Pago confirmado!",
      confSub: "Tu pedido está siendo procesado",
      timeline1: "Pedido recibido",
      timeline2: "En preparación",
      timeline3: "En camino",
      timeline4: "Entregado",
      mostrarGPS: true,
      footerTexto: "Todos los derechos reservados.",
      footerAno: String(new Date().getFullYear()),
      creadaEn: ahora
    };
    const configPrivado = {
      mpToken: "CONFIGURAR_TOKEN",
      resendApiKey: "",
      emailEmisor: "",
      emailVendedor: ""
    };

    await db.doc("tiendas/" + storeId + "/config/general").set(configGeneral);
    await db.doc("tiendas/" + storeId + "/config/privado").set(configPrivado);
    await db.doc("dominios/" + hostnameLimpio).set({ storeId, creadoEn: ahora });

    /* Cuenta de propietario — opcional: si no se manda email/password,
       la tienda queda creada igual, y esta cuenta se puede armar
       después a mano (ver LEEME.md, Paso 5) sin perder nada de lo ya
       sembrado acá. */
    let propietario = null;
    if (emailPropietario && passwordPropietario) {
      try {
        const userRecord = await admin.auth().createUser({
          email: emailPropietario,
          password: passwordPropietario
        });
        await db.doc("usuarios/" + userRecord.uid).set({
          roles: { [storeId]: "propietario" }
        }, { merge: true });
        propietario = { uid: userRecord.uid, email: emailPropietario };
      } catch (e) {
        /* La tienda ya quedó creada aunque esto falle (ej. el email ya
           existe en Firebase Auth) — se informa el error puntual, pero
           no se revierte lo ya sembrado, y se puede reintentar solo la
           parte de la cuenta después. */
        return {
          statusCode: 200, headers,
          body: JSON.stringify({
            ok: true, storeId, hostname: hostnameLimpio,
            propietario: null,
            avisoPropietario: "La tienda se creó bien, pero la cuenta de propietario falló: " + e.message
          })
        };
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ok: true, storeId, hostname: hostnameLimpio, propietario })
    };
  } catch (e) {
    console.error("crearTienda error:", e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message || "Error desconocido" }) };
  }
};
