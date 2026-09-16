/* ════════════════════════════════════════════════════════════════
   Netlify Function — /.netlify/functions/notificar
   Envía Web Push a todos los dispositivos registrados del vendedor.
   Sin dependencias externas — Node 18+ crypto nativo.

   Variables de entorno en Netlify:
     VAPID_PUBLIC_KEY   = BN0atA77lvF6LY8buvjl9RLsPXb8ZqESonUfWBDDewV2-_Mr70vcsPNrpvcuFLGJU_mHVRnp084azSSnjvB6ANs
     VAPID_PRIVATE_KEY  = DSuoNdBnIL4QugCrVM6XVeHfNL6ziJ8RLMvb3syw7Vo
     VAPID_SUBJECT      = mailto:tu@email.com
   ════════════════════════════════════════════════════════════════ */

const crypto = require("crypto");

const FIREBASE_PROJECT = "tienda-test-burgers";
const FIREBASE_API_KEY = "AIzaSyBuzHcQezxE36F6nDJWqYsE5rOKUvQbMBM";
const DEFAULT_STORE    = "test-burgers";

function b64u(buf){ return Buffer.from(buf).toString("base64url"); }

function vapidJWT(audience){
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  const raw = Buffer.from(pub, "base64url");
  const jwk = {
    kty:"EC", crv:"P-256",
    x: b64u(raw.subarray(1, 33)),
    y: b64u(raw.subarray(33, 65)),
    d: priv
  };
  const key = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const header  = b64u(JSON.stringify({ typ:"JWT", alg:"ES256" }));
  const payload = b64u(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subj
  }));
  const data = header + "." + payload;
  const sig = crypto.sign("sha256", Buffer.from(data), { key, dsaEncoding:"ieee-p1363" });
  return data + "." + b64u(sig);
}

/* Lee dispositivos desde Firestore REST */
async function listarDispositivos(storeId){
  const url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT +
    "/databases/(default)/documents/tiendas/" + storeId + "/dispositivos?pageSize=50&key=" + FIREBASE_API_KEY;
  const r = await fetch(url);
  if (!r.ok){ const t = await r.text(); throw new Error("Firestore " + r.status + ": " + t.slice(0,200)); }
  const j = await r.json();
  const out = [];
  (j.documents || []).forEach(function(doc){
    try {
      const fields = doc.fields || {};
      /* La suscripción se guarda como JSON.stringify() → stringValue en Firestore REST */
      const subStr = fields.subscription && fields.subscription.stringValue;
      if (!subStr) return;
      const sub = JSON.parse(subStr); /* { endpoint, keys: { p256dh, auth } } */
      if (!sub.endpoint) return;
      out.push({ sub, docName: doc.name });
    } catch(e){ console.warn("Doc inválido:", doc.name, e.message); }
  });
  return out;
}

async function borrarDoc(docName){
  try {
    await fetch("https://firestore.googleapis.com/v1/" + docName + "?key=" + FIREBASE_API_KEY,
      { method:"DELETE" });
  } catch(e){ /* silencioso */ }
}

/* Cifrado Web Push (RFC 8291 + RFC 8188) con llaves del cliente */
async function cifrarPayload(sub, payloadStr){
  const payloadBuf = Buffer.from(payloadStr, "utf-8");

  /* Extraer llaves del cliente */
  const p256dh = Buffer.from(sub.keys.p256dh, "base64url");
  const auth   = Buffer.from(sub.keys.auth,   "base64url");

  /* Par efímero ECDH */
  const efimero = crypto.generateKeyPairSync("ec", { namedCurve:"P-256" });
  const efPub   = efimero.publicKey.export({ type:"spki", format:"der" }).subarray(-65); /* 65 bytes sin compresión */

  /* Clave compartida ECDH */
  const clientePub = crypto.createPublicKey({
    key: Buffer.concat([Buffer.from([0x04]), p256dh.subarray(1)]),
    format:"der", type:"spki",
    // workaround: usar raw
  });

  /* Usar crypto.diffieHellman para obtener el secreto compartido */
  const clienteKey = crypto.createPublicKey({
    format:"jwk",
    key: {
      kty:"EC", crv:"P-256",
      x: b64u(p256dh.subarray(1, 33)),
      y: b64u(p256dh.subarray(33, 65))
    }
  });
  const secretoShared = crypto.diffieHellman({
    privateKey: efimero.privateKey,
    publicKey:  clienteKey
  });

  /* HKDF (RFC 5869) */
  function hkdf(salt, ikm, info, length){
    const prk = crypto.createHmac("sha256", salt).update(ikm).digest();
    const infoBuf = Buffer.isBuffer(info) ? info : Buffer.from(info);
    const t = Buffer.alloc(length + 32);
    let offset = 0, prev = Buffer.alloc(0), counter = 1;
    while (offset < length){
      const hmac = crypto.createHmac("sha256", prk);
      hmac.update(prev); hmac.update(infoBuf); hmac.update(Buffer.from([counter++]));
      prev = hmac.digest(); prev.copy(t, offset); offset += 32;
    }
    return t.subarray(0, length);
  }

  const salt = crypto.randomBytes(16);
  const keyInfo  = Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), efPub, p256dh]);
  const nceInfo  = Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), efPub, p256dh]);
  const prk = hkdf(auth, secretoShared, Buffer.concat([Buffer.from("WebPush: info\0"), p256dh, efPub]), 32);
  const cek = hkdf(salt, prk, keyInfo, 16);
  const nce = hkdf(salt, prk, nceInfo, 12);

  /* Padding + AES-128-GCM */
  const padded = Buffer.concat([payloadBuf, Buffer.from([0x02])]); /* delimiter 0x02 */
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nce);
  const enc = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);

  /* Encabezado aes128gcm */
  const efPubRaw = efimero.publicKey.export({ type:"spki", format:"der" }).subarray(-65);
  const header = Buffer.concat([
    salt,
    Buffer.from([0x00, 0x00, 0x10, 0x00]), /* rs = 4096 */
    Buffer.from([efPubRaw.length]),
    efPubRaw,
    enc
  ]);
  return header;
}

async function enviarPush(dispositivo, payloadStr, jwtCache){
  const { sub, docName } = dispositivo;
  const aud = new URL(sub.endpoint).origin;
  if (!jwtCache[aud]) jwtCache[aud] = vapidJWT(aud);

  let body, headers;

  if (sub.keys && sub.keys.p256dh && sub.keys.auth){
    /* Push cifrado con las llaves del cliente */
    try {
      const cifrado = await cifrarPayload(sub, payloadStr);
      body = cifrado;
      headers = {
        "Authorization":    "vapid t=" + jwtCache[aud] + ", k=" + process.env.VAPID_PUBLIC_KEY,
        "Content-Type":     "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL":              "120",
        "Urgency":          "high"
      };
    } catch(e){
      console.warn("Cifrado falló, enviando sin payload:", e.message);
      body = null;
      headers = {
        "Authorization": "vapid t=" + jwtCache[aud] + ", k=" + process.env.VAPID_PUBLIC_KEY,
        "TTL": "120", "Urgency": "high"
      };
    }
  } else {
    /* Sin llaves: push vacío (el SW consulta Firestore al recibir) */
    body = null;
    headers = {
      "Authorization": "vapid t=" + jwtCache[aud] + ", k=" + process.env.VAPID_PUBLIC_KEY,
      "TTL": "120", "Urgency": "high"
    };
  }

  const opts = { method:"POST", headers };
  if (body) opts.body = body;
  const r = await fetch(sub.endpoint, opts);

  if (r.status === 201 || r.status === 200 || r.status === 202) return "ok";
  if (r.status === 404 || r.status === 410 || r.status === 400 || r.status === 403){
    await borrarDoc(docName);
    return "expirado:" + r.status;
  }
  const txt = await r.text().catch(() => "");
  return "error:" + r.status + ":" + txt.slice(0, 100);
}

exports.handler = async function(event){
  if (event.httpMethod === "GET"){
    return { statusCode:200, headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ok:true, msg:"Función activa. Usa POST para disparar el push." }) };
  }
  if (event.httpMethod !== "POST"){
    return { statusCode:405, body:"Method Not Allowed" };
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY){
    return { statusCode:500, headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ok:false, error:"Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch(e){ body = {}; }
  const storeId  = body.storeId  || DEFAULT_STORE;
  const pedidoId = body.pedidoId || null;
  const cliente  = body.cliente  || {};
  const total    = body.total    || 0;
  const items    = body.items    || [];

  /* Payload que verá el SW → notificación */
  const resumen = items.map(function(i){ return i.cantidad + "x " + i.nombre; }).join(", ");
  const payloadStr = JSON.stringify({
    title: "🛍️ ¡Nuevo pedido! $" + Number(total).toLocaleString("es-CL"),
    body:  ((cliente.nombre) || "Cliente") + (resumen ? " — " + resumen : ""),
    url:   "/pedidos.html"
  });

  let dispositivos;
  try { dispositivos = await listarDispositivos(storeId); }
  catch(e){
    return { statusCode:502, headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ok:false, error:"No pude leer dispositivos: " + e.message }) };
  }

  if (!dispositivos.length){
    return { statusCode:200, headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ok:true, enviados:0, msg:"Sin dispositivos. Activa notificaciones en el devmode." }) };
  }

  const jwtCache = {};
  const resultados = await Promise.all(dispositivos.map(function(d){ return enviarPush(d, payloadStr, jwtCache); }));
  const enviados = resultados.filter(function(r){ return r === "ok"; }).length;
  const sinLlaves = dispositivos.filter(function(d){ return !(d.sub.keys && d.sub.keys.p256dh && d.sub.keys.auth); }).length;

  console.log("Push results:", resultados,
    "| dispositivos sin llaves de cifrado (payload vacío, el SW cae al respaldo):", sinLlaves);
  return { statusCode:200, headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ ok:true, enviados, resultados, dispositivosSinLlaves: sinLlaves }) };
};
