/* cloudflare/functions/crearTienda.js
   Equivalente a netlify/functions/crearTienda.js. Toda la lógica de
   negocio (slugify, RUBROS, validación de dominio duplicado, límite
   de peso de imágenes) es JS puro, copiada sin cambios. Lo que cambia
   de forma real: event.httpMethod → request.method, event.body →
   await request.text(), event.headers["x-admin-secret"] →
   request.headers.get("x-admin-secret") (los headers de Request en
   Workers son case-insensitive por diseño del estándar Headers, así
   que no hace falta comprobar las dos variantes de mayúscula/minúscula
   como sí hacía el original de Netlify). */

import { admin, getDb, corsHeaders } from "./_firebase.js";

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
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "tienda";
}

export async function crearTienda(request, env){
  const headers = corsHeaders();

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers });
  }

  const secretEsperado = env.ADMIN_SECRET;
  const secretRecibido = request.headers.get("x-admin-secret");
  if (!secretEsperado) {
    return new Response(JSON.stringify({ ok: false, error: "ADMIN_SECRET no está configurado en Cloudflare" }), { status: 500, headers });
  }
  if (secretRecibido !== secretEsperado) {
    return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), { status: 401, headers });
  }

  try {
    const body = JSON.parse(await request.text() || "{}");
    const { nombreNegocio, rubro, hostname, colorPrimario, logoBase64, splashBase64, emailPropietario, passwordPropietario } = body;

    if (!nombreNegocio || !hostname) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan nombreNegocio o hostname" }), { status: 400, headers });
    }
    const LIMITE_IMAGENES_COMBINADO = 700 * 1024;
    const pesoImagenes = (logoBase64 ? logoBase64.length : 0) + (splashBase64 ? splashBase64.length : 0);
    if (pesoImagenes > LIMITE_IMAGENES_COMBINADO) {
      return new Response(JSON.stringify({ ok: false, error: "Las imágenes combinadas son demasiado grandes — probá con archivos más livianos o de menor resolución." }), { status: 400, headers });
    }

    const rubroValido = RUBROS[rubro] ? rubro : "otro";
    const color = colorPrimario || RUBROS[rubroValido].colorPrimario;
    const hostnameLimpio = String(hostname).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");

    const db = getDb(env);

    let storeId = slugify(nombreNegocio);
    let intento = storeId;
    let sufijo = 1;
    while ((await db.doc("tiendas/" + intento + "/config/general").get()).exists) {
      sufijo++;
      intento = storeId + "-" + sufijo;
    }
    storeId = intento;

    const domExistente = await db.doc("dominios/" + hostnameLimpio).get();
    if (domExistente.exists && domExistente.data().storeId !== storeId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Ese hostname ya está registrado para la tienda \"" + domExistente.data().storeId + "\"" }),
        { status: 409, headers }
      );
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
        return new Response(JSON.stringify({
          ok: true, storeId, hostname: hostnameLimpio,
          propietario: null,
          avisoPropietario: "La tienda se creó bien, pero la cuenta de propietario falló: " + e.message
        }), { status: 200, headers });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, storeId, hostname: hostnameLimpio, propietario }),
      { status: 200, headers }
    );
  } catch (e) {
    console.error("crearTienda error:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message || "Error desconocido" }), { status: 500, headers });
  }
}
