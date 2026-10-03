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

import { admin, getDb, corsHeaders, autorizarDominio, authRest } from "./_firebase.js";
import { fijarPlan } from "./planTienda.js";

const RUBROS = {
  "comida": {
    subrubros: {
      "hamburguesas":  { colorPrimario: "#9B1B30" },
      "comida-rapida": { colorPrimario: "#C83D09" },
      "cafeteria":     { colorPrimario: "#5C3D2E" },
      "pasteleria":    { colorPrimario: "#C2185B" },
      "servicios":     { colorPrimario: "#1565C0" },
    }
  },
  "retail": {
    subrubros: {
      "tecnologia": { colorPrimario: "#0066FF" },
      "ropa":       { colorPrimario: "#1A1A1A" },
      "belleza":    { colorPrimario: "#D46A9F" },
      "limpieza":   { colorPrimario: "#00A88A" },
      "hogar":      { colorPrimario: "#8B6914" },
    }
  }
};

function slugify(texto){
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
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
    const { nombreNegocio, rubro, subrubro, hostname, colorPrimario, logoBase64, emailPropietario, passwordPropietario, plantilla, cajaLocal } = body;

    if (!nombreNegocio || !hostname) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan nombreNegocio o hostname" }), { status: 400, headers });
    }
    const LIMITE_IMAGENES_COMBINADO = 700 * 1024;
    const pesoImagenes = logoBase64 ? logoBase64.length : 0;
    if (pesoImagenes > LIMITE_IMAGENES_COMBINADO) {
      return new Response(JSON.stringify({ ok: false, error: "Las imágenes combinadas son demasiado grandes — probá con archivos más livianos o de menor resolución." }), { status: 400, headers });
    }

    const rubroValido = RUBROS[rubro] ? rubro : "comida";
    const subrubrosValidos = RUBROS[rubroValido].subrubros;
    const subrubroValido = subrubrosValidos[subrubro] ? subrubro : Object.keys(subrubrosValidos)[0];
    const color = colorPrimario || subrubrosValidos[subrubroValido].colorPrimario;
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
      subrubro: subrubroValido,
      colorPrimario: color,
      logoBase64: logoBase64 || "",
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
    /* Boutique: plantilla index-boutique.html + gestor de pedidos simple (sin GPS) */
    if (plantilla === "boutique" && rubroValido === "retail"){
      configGeneral.plantilla = "boutique";
      configGeneral.mostrarGPS = false;
    }
    /* Caja local (mesas, para llevar y turnos): solo comida y solo si DerLabs lo activa */
    const planTienda = (cajaLocal === true && rubroValido === "comida") ? "pro" : "basico";
    configGeneral.plan = planTienda;
    if (planTienda === "pro") configGeneral.cajaLocal = true;
    const configPrivado = {
      mpToken: "CONFIGURAR_TOKEN",
      resendApiKey: "",
      emailEmisor: "",
      emailVendedor: ""
    };

    await db.doc("tiendas/" + storeId + "/config/general").set(configGeneral);
    await db.doc("tiendas/" + storeId + "/config/privado").set(configPrivado);
    await fijarPlan(db, storeId, planTienda);
    await db.doc("dominios/" + hostnameLimpio).set({ storeId, creadoEn: ahora });
    let avisoDominio = null;
    try { await autorizarDominio(hostnameLimpio); }
    catch (e) { avisoDominio = "Tienda creada, pero no se pudo autorizar el dominio para el login con Google (" + e.message + "). Agrégalo a mano en Firebase → Authentication → Dominios autorizados."; }

    let propietario = null;
    if (emailPropietario) {
      const claveTemporal = !passwordPropietario;
      try {
        const userRecord = await admin.auth().createUser({
          email: emailPropietario,
          password: passwordPropietario || claveTemporalPropietario()
        });
        await db.doc("usuarios/" + userRecord.uid).set({
          roles: { [storeId]: "propietario" }
        }, { merge: true });
        propietario = { uid: userRecord.uid, email: emailPropietario };
        if (claveTemporal){ propietario.claveTemporal = true; propietario.correoClave = await enviarBienvenida(emailPropietario, nombreNegocio, hostnameLimpio, env); }
      } catch (e) {
        return new Response(JSON.stringify({
          ok: true, storeId, hostname: hostnameLimpio,
          propietario: null,
          avisoPropietario: "La tienda se creó bien, pero la cuenta de propietario falló: " + e.message
        }), { status: 200, headers });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, storeId, hostname: hostnameLimpio, propietario, avisoDominio }),
      { status: 200, headers }
    );
  } catch (e) {
    console.error("crearTienda error:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message || "Error desconocido" }), { status: 500, headers });
  }
}


/* Clave aleatoria que nadie conoce: el dueño crea la suya con el correo de Firebase */
function claveTemporalPropietario(){
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b, function(x){ return ("0" + x.toString(16)).slice(-2); }).join("") + "Aa1!";
}
/* Bienvenida DerLabs (Resend, hola@derlabs.cl) con link seguro de Firebase
   para crear la clave. Si Resend falla, cae al correo estándar de Firebase. */
async function enviarBienvenida(email, nombre, dominio, env){
  try {
    if (!env.RESEND_API_KEY) throw new Error("sin RESEND_API_KEY");
    const r0 = await authRest(":sendOobCode", { requestType: "PASSWORD_RESET", email, returnOobLink: true });
    const link = r0.oobLink; if (!link) throw new Error("sin link");
    const e = function(t){ return String(t || "").replace(/[&<>"']/g, function(c){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); };
    const url = "https://" + dominio;
    const html = '<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;padding:28px 12px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden">' +
      '<div style="background:#111;color:#fff;padding:22px 26px;font-size:22px;font-weight:800;letter-spacing:.5px">DerLabs</div>' +
      '<div style="padding:26px;color:#222;font-size:15px;line-height:1.6">' +
      '<h1 style="font-size:21px;margin:0 0 12px">🎉 Tu tienda "' + e(nombre) + '" ya está lista</h1>' +
      '<p>Hola, bienvenido a DerLabs. Tu tienda ya está en línea en <a href="' + e(url) + '" style="color:#111;font-weight:bold">' + e(dominio) + '</a>.</p>' +
      '<p>Para entrar a tu panel de administración, crea tu contraseña:</p>' +
      '<p style="text-align:center;margin:26px 0"><a href="' + e(link) + '" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold">Crear mi contraseña</a></p>' +
      '<p style="background:#f4f4f5;border-radius:10px;padding:14px 16px;font-size:14px">👤 Usuario: <b>' + e(email) + '</b><br>🛠️ Panel: toca 7 veces seguidas el logo de tu tienda<br>📦 Pedidos: <a href="' + e(url) + '/pedidos.html" style="color:#111">' + e(dominio) + '/pedidos.html</a></p>' +
      '<p style="font-size:13px;color:#666">El enlace vence en 1 hora. Si vence, usa "¿Olvidaste tu contraseña?" en el acceso de administrador.</p>' +
      '</div><div style="padding:16px 26px;border-top:1px solid #eee;font-size:12px;color:#888">DerLabs · derlabs.cl · Este correo se envió porque se creó una tienda con tu dirección.</div></div></div>';
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "DerLabs <hola@derlabs.cl>", to: [email], subject: "🎉 Tu tienda «" + nombre + "» ya está lista", html })
    });
    if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 150));
    return true;
  } catch(err){
    console.warn("bienvenida:", err.message);
    return enviarCorreoClave(email, env);
  }
}
/* Correo de Firebase "crear/restablecer contraseña" (en español) */
async function enviarCorreoClave(email, env){
  try {
    const key = env.FIREBASE_API_KEY || "AIzaSyBuzHcQezxE36F6nDJWqYsE5rOKUvQbMBM";
    const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=" + key, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Firebase-Locale": "es" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email })
    });
    return r.ok;
  } catch(e){ return false; }
}
