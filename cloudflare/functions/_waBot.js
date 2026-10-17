import { validarItemsCatalogo, validarPedidoCompleto, estadoHorario } from "./_firebase.js";
import { moverInsumos } from "./inventario.js";
import { enviarCorreosPedido } from "./enviarEmails.js";
import { notificar } from "./notificar.js";
import { crearPago } from "./crearPago.js";
/* cloudflare/functions/_waBot.js — P66 · P67 · El asistente de WhatsApp toma pedidos.

   Conversación por pasos. La IA (Gemini) ENTIENDE lo que escribe el cliente ("2 clásicas y
   una coca" → ids del catálogo) y CONTESTA preguntas con los datos de la tienda (horario,
   envío, pagos, locales, productos y lo que el dueño escribió para el asistente). Todo lo
   que cuesta plata (precios, envío, total, pago) lo calcula el servidor igual que la web.
   Sin GEMINI_API_KEY funciona con un buscador por nombre y respuestas básicas.

   P67: pago online con las pasarelas de la tienda (MercadoPago / Webpay por Flow): el bot
   manda un botón con el link; el pedido se crea cuando la pasarela confirma el pago
   (webhookPago / webhookFlow) y _waAviso.js le avisa al cliente por WhatsApp.

   El dueño elige el tono (config.waTono), una frase corta (config.waFrase) y datos para el
   asistente (config.waInfo). Los textos del sistema no se pueden editar.

   Estado de la conversación: tiendas/{storeId}/waChats/{numero}.conv (vence a las 2 h). */

export const CONV_VENCE_MS = 2 * 3600 * 1000;
const HUMANO_MS = 2 * 3600 * 1000;
const MAX_PROD_IA = 300;

/* ── utilidades ── */
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ]+/g, " ").trim();
export const plata = n => "$" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const corto = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; };
const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, par: 2 };
const VACIAS = new Set("de del la las el los un una uno unos unas y con sin para por al a en mi me quiero quisiera pedir dame porfa por favor gracias hola buenas tardes noches dias mas tambien otra otro".split(" "));
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/* Texto que escribe el dueño (frase, datos para el asistente): sin links, teléfonos, formato ni llaves */
export function limpiarTextoDueno(s, max, unaLinea){
  let t = String(s || "").replace(/\r/g, "");
  t = t.replace(/\{[^}]*\}/g, "").replace(/https?:\/\/\S+|www\.\S+|\b[\w-]+\.(cl|com|net|org|store|app|io|link|me)\b\S*/gi, "")
       .replace(/\+?\d[\d\s().-]{7,}\d/g, "")
       .replace(/[*_~`{}<>\[\]|\\]/g, "");
  t = unaLinea ? t.replace(/\s+/g, " ") : t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return t.trim().slice(0, max);
}
export function tonoDe(cfg){ return ["cercano", "formal", "alegre"].includes(cfg && cfg.waTono) ? cfg.waTono : "cercano"; }

/* ── mensajes para Meta ── */
const txt = body => ({ type: "text", text: { preview_url: false, body: String(body).slice(0, 4096) } });
function botones(body, lista){
  return { type: "interactive", interactive: { type: "button", body: { text: String(body).slice(0, 1024) },
    action: { buttons: lista.slice(0, 3).map(b => ({ type: "reply", reply: { id: String(b[0]).slice(0, 256), title: corto(b[1], 20) } })) } } };
}
function listado(body, boton, filas, titulo){
  return { type: "interactive", interactive: { type: "list", body: { text: String(body).slice(0, 1024) },
    action: { button: corto(boton, 20), sections: [{ title: corto(titulo || "Opciones", 24), rows: filas.slice(0, 10).map(f => Object.assign({ id: String(f[0]).slice(0, 200), title: corto(f[1], 24) }, f[2] ? { description: corto(f[2], 72) } : {})) }] } } };
}
function botonLink(body, texto, url){
  return { type: "interactive", interactive: { type: "cta_url", body: { text: String(body).slice(0, 1024) },
    action: { name: "cta_url", parameters: { display_text: corto(texto, 20), url } } } };
}
const BT_INICIO = [["menu", "📋 Ver menú"], ["humano", "🙋 Hablar con alguien"]];

/* ── catálogo (se guarda 2 minutos en el KV para no leer Firestore en cada mensaje) ── */
export async function catalogo(db, env, storeId){
  const k = "wa_cat2_" + storeId;
  try { if (env.LANDING){ const c = await env.LANDING.get(k); if (c) return JSON.parse(c); } } catch(e){}
  const q = await db.collection("tiendas/" + storeId + "/productos").get();
  const prods = q.docs.map(d => {
    const p = d.data() || {};
    return { id: d.id, nombre: String(p.nombre || "").trim(), precio: Number(p.precio) || 0, cat: String(p.categoria || "").trim(), desc: corto(p.descripcion || "", 160),
      orden: Number(p.orden) || 0, activo: p.activo !== false && p.disponible !== false, agotado: p.stock !== null && p.stock !== undefined && p.stock !== "" && Number(p.stock) <= 0,
      variantes: p.variantesActivas && Array.isArray(p.variantes) ? p.variantes.filter(g => g && g.nombre && Array.isArray(g.opciones) && g.opciones.length).map(g => ({ nombre: String(g.nombre), opciones: g.opciones.map(String).slice(0, 10) })) : [],
      grupos: Array.isArray(p.gruposExtras) ? p.gruposExtras.slice(0, 10) : [] };
  }).filter(p => p.nombre && p.activo && !p.agotado).sort((a, b) => a.orden - b.orden);
  try { if (env.LANDING) await env.LANDING.put(k, JSON.stringify(prods), { expirationTtl: 120 }); } catch(e){}
  return prods;
}
const categorias = prods => { const v = []; prods.forEach(p => { const c = p.cat || "Otros"; if (!v.includes(c)) v.push(c); }); return v; };
async function localesDe(db, storeId){
  try {
    const q = await db.collection("tiendas/" + storeId + "/locales").get();
    return q.docs.map(d => Object.assign({ id: d.id }, d.data() || {})).filter(l => l.nombre && l.abierto !== false)
      .map(l => ({ id: l.id, nombre: String(l.nombre), direccion: String(l.direccion || "") }));
  } catch(e){ return []; }
}
export const pagosDe = cfg => ({ mp: cfg.mpActivo === true, flow: cfg.flowActivo === true });

/* ── datos de la tienda para contestar preguntas ── */
function textoHorario(cfg){
  const h = cfg.horario;
  if (!h || h.activo !== true || !h.dias) return "";
  const v = [];
  for (let d = 1; d <= 7; d++){ const k = d % 7, t = Array.isArray(h.dias[k]) ? h.dias[k] : (Array.isArray(h.dias[String(k)]) ? h.dias[String(k)] : []);
    const tr = t.filter(x => x && x.a && x.c).map(x => x.a + " a " + x.c);
    v.push(DIAS[k] + ": " + (tr.length ? tr.join(" y ") : "cerrado")); }
  return v.join("; ");
}
function textoEnvio(cfg){
  if (cfg.deliveryActivo === false) return "No hacemos delivery, solo retiro en el local.";
  const z = Array.isArray(cfg.zonas) ? cfg.zonas : [];
  if (z.length) return "Delivery a estas comunas: " + z.map(x => String(x.comunas || "").split(",").map(s => s.trim()).filter(Boolean).join(", ") + " (" + (Number(x.costo) ? plata(x.costo) : "gratis") + (Number(x.minGratis) ? ", gratis desde " + plata(x.minGratis) : "") + ")").join("; ") + ". Otras comunas no tienen cobertura.";
  return "Delivery: " + (Number(cfg.deliveryCosto) ? plata(cfg.deliveryCosto) : "gratis") + (Number(cfg.deliveryMinimo) ? ", gratis desde " + plata(cfg.deliveryMinimo) : "") + ".";
}
function textoPagos(cfg){
  const p = pagosDe(cfg), v = ["efectivo"];
  if (p.mp) v.push("pago online con MercadoPago (tarjetas)"); if (p.flow) v.push("pago online con Webpay (tarjetas de débito y crédito)");
  return "Formas de pago por WhatsApp: " + v.join(", ") + ".";
}
export function infoTienda(cfg, locs){
  const eh = estadoHorario(cfg);
  return [
    "Tienda: " + (cfg.nombre || ""),
    "Ahora: " + (eh.abierta ? "abierta" : "cerrada" + (eh.abre ? ", abre " + eh.abre : "")),
    textoHorario(cfg) ? "Horario: " + textoHorario(cfg) : "",
    textoEnvio(cfg),
    cfg.retiroActivo === false ? "No hay retiro en local." : "Retiro en local: " + (locs.length ? locs.map(l => l.nombre + (l.direccion ? " (" + l.direccion + ")" : "")).join("; ") : (cfg.direccion || "sí")),
    textoPagos(cfg),
    cfg.tiempoEntrega ? "Tiempo de entrega estimado: " + cfg.tiempoEntrega : "",
    cfg.dominioPrincipal ? "Página para pedir: https://" + String(cfg.dominioPrincipal).replace(/^https?:\/\//, "").replace(/\/+$/, "") : "",
    cfg.waInfo ? "Lo que el dueño quiere que sepas: " + limpiarTextoDueno(cfg.waInfo, 500) : ""
  ].filter(Boolean).join("\n");
}

/* ── entender el texto: buscador local (siempre disponible) ── */
const _tokens = s => norm(s).split(" ").filter(Boolean);
function _pareja(a, b){ return a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) || (a.endsWith("s") && a.slice(0, -1) === b) || (b.endsWith("s") && b.slice(0, -1) === a); }
export function buscarLocal(texto, prods){
  const segs = String(texto || "").split(/[,;\n+]|\s(?:y|e|m[aá]s)\s/i).map(norm).filter(Boolean);
  const items = [], sinEncontrar = [];
  for (const seg of (segs.length ? segs : [norm(texto)])){
    const t = seg.split(" ").filter(Boolean);
    let cant = 1;
    for (const w of t){ if (/^\d{1,2}$/.test(w)){ cant = Number(w); break; } if (NUM[w]){ cant = NUM[w]; break; } }
    const sig = t.filter(w => !VACIAS.has(w) && !NUM[w] && !/^\d+$/.test(w) && w.length >= 3);
    if (!sig.length) continue;
    let mejor = null, mejorP = 0, mejorN = 0;
    for (const p of prods){
      const nt = _tokens(p.nombre).filter(w => !VACIAS.has(w) && w.length >= 3);
      if (!nt.length) continue;
      const n = nt.filter(w => sig.some(s => _pareja(s, w))).length;
      const pts = n / nt.length + n * 0.01;
      if (n && pts > mejorP){ mejor = p; mejorP = pts; mejorN = n; }
    }
    if (mejor && (mejorP >= 0.5 || mejorN >= 2)) items.push({ id: mejor.id, cantidad: Math.min(Math.max(cant, 1), 20) });
    else sinEncontrar.push(seg);
  }
  return { items, sinEncontrar };
}
export function esPregunta(texto){
  const t = String(texto || "").trim().toLowerCase();
  return /\?/.test(t) || /^(¿|puedo|pueden|podria|se puede|tienen|tiene|hay|hacen|cuanto|cuánto|cuanta|cuánta|a que hora|a qué hora|donde|dónde|como|cómo|cual|cuál|que tal|aceptan|reciben|llegan|despachan|trabajan|abren|cierran|incluye|viene|lleva)\b/.test(t);
}
export function intencionLocal(texto){
  const t = norm(texto);
  if (!t) return "otro";
  if (/\b(cancelar|cancela|anular|anula)\b/.test(t)) return "cancelar";
  if (/(hablar con (alguien|una persona|un humano|el dueno|la duena|un ejecutivo|el local)|persona real|atencion humana|\bhumano\b)/.test(t)) return "humano";
  if (/^(ver )?(el )?(menu|carta|catalogo)\b|^que (tienen|hay|venden)\b/.test(t)) return "menu";
  if (/^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|alo|hey|ola)\b/.test(t) && t.split(" ").length <= 4) return "saludo";
  return "otro";
}
/* respuestas básicas sin IA */
export function respuestaLocal(texto, cfg, locs){
  const t = norm(texto);
  if (/(pag|tarjeta|transfer|webpay|mercado ?pago|debito|credito|efectivo)/.test(t)) return textoPagos(cfg);
  if (/(horario|hora|abren|abre|cierran|cierra|atienden|abiertos)/.test(t)){ const h = textoHorario(cfg), eh = estadoHorario(cfg); return (eh.abierta ? "Estamos abiertos 🟢" : "Ahora estamos cerrados") + (h ? ". Horario: " + h : ""); }
  if (/(delivery|despacho|envio|despachan|llegan|comuna|reparto)/.test(t)) return textoEnvio(cfg);
  if (/(donde|direccion|ubicad|local|retir)/.test(t)) return cfg.retiroActivo === false ? "No tenemos retiro en local." : "Puedes retirar en: " + (locs.length ? locs.map(l => l.nombre + (l.direccion ? " (" + l.direccion + ")" : "")).join("; ") : (cfg.direccion || "nuestro local")) + ".";
  if (/(demora|tarda|tiempo|cuanto se)/.test(t) && cfg.tiempoEntrega) return "El tiempo estimado es " + cfg.tiempoEntrega + ".";
  return "";
}

/* ── Gemini: entiende el pedido y contesta preguntas (solo con los datos de la tienda) ── */
const TONO_IA = {
  cercano: "Tono cercano y amable, tutea al cliente, 0 a 1 emoji.",
  formal: "Tono formal y cordial, trata al cliente de usted, sin emojis.",
  alegre: "Tono alegre y entusiasta, tutea al cliente, 1 a 2 emojis."
};
const PASOS = { pedido: "eligiendo productos", mas: "decidiendo si agrega algo más", preguntas: "eligiendo una opción del producto", entrega: "eligiendo delivery o retiro",
  direccion: "escribiendo su dirección", comuna: "eligiendo su comuna", local: "eligiendo el local", resumen: "revisando el resumen antes de confirmar", pasarela: "eligiendo cómo pagar online",
  email: "escribiendo su correo para pagar", pagando: "pagando con el link", "": "recién empieza" };
export async function interpretarIA(env, cfg, info, texto, prods, paso){
  const key = String(env.GEMINI_API_KEY || "").trim();
  if (!key) return null;
  const modelo = String(env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const lineas = prods.slice(0, MAX_PROD_IA).map(p => p.id + "|" + p.nombre + "|" + (p.cat || "") + "|" + p.precio + (p.desc ? "|" + p.desc : "")).join("\n");
  const prompt = "Eres el asistente de WhatsApp de la tienda \"" + (cfg.nombre || "") + "\" (Chile). Ayudas a pedir y respondes dudas.\n" +
    "DATOS DE LA TIENDA:\n" + info + "\n\nCATÁLOGO (id|nombre|categoría|precio|descripción):\n" + lineas +
    "\n\nEl cliente está " + (PASOS[paso || ""] || "conversando") + ".\nMENSAJE DEL CLIENTE: «" + String(texto).slice(0, 500) + "»\n\n" +
    "Responde SOLO con JSON: {\"intencion\":\"pedir|menu|pregunta|humano|cancelar|saludo|otro\",\"items\":[{\"id\":\"id exacto del catálogo\",\"cantidad\":1,\"nota\":\"detalle que pidió, corto\"}],\"noEncontrado\":[\"lo que pidió y no está en el catálogo\"],\"respuesta\":\"\"}.\n" +
    "Reglas: items solo con ids del catálogo, nunca inventes productos. Si hace una pregunta, intencion=pregunta y en respuesta contéstale en 1 a 3 frases cortas en español de Chile (sin voseo), usando SOLO los DATOS DE LA TIENDA y el CATÁLOGO. " +
    "Si el dato no está, deja respuesta vacía. No inventes precios, descuentos, promociones, ingredientes ni horarios. No confirmes pedidos ni pagos: de eso se encarga el sistema. No escribas links salvo el de la página de la tienda. " +
    TONO_IA[tonoDe(cfg)] + " Si pide hablar con una persona, intencion=humano.";
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelo) + ":generateContent", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } } })
    });
    if (!r.ok) throw new Error("Gemini " + r.status);
    const j = await r.json();
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const out = JSON.parse(String(parts.map(p => p.text || "").join("") || "{}").replace(/^```(json)?|```$/g, ""));
    const ids = new Set(prods.map(p => p.id));
    const link = cfg.dominioPrincipal ? String(cfg.dominioPrincipal).replace(/^https?:\/\//, "").replace(/\/+$/, "") : "";
    let resp = corto(String(out.respuesta || ""), 700).replace(/https?:\/\/\S+/gi, u => link && u.includes(link) ? u : "");
    resp = resp.replace(/[ \t]{2,}/g, " ");
    return {
      intencion: ["pedir", "menu", "pregunta", "humano", "cancelar", "saludo", "otro"].includes(out.intencion) ? out.intencion : "otro",
      items: (Array.isArray(out.items) ? out.items : []).filter(i => i && ids.has(String(i.id))).slice(0, 15)
        .map(i => ({ id: String(i.id), cantidad: Math.min(Math.max(Math.floor(Number(i.cantidad) || 1), 1), 20), nota: corto(i.nota || "", 100) })),
      noEncontrado: (Array.isArray(out.noEncontrado) ? out.noEncontrado : []).map(s => corto(s, 60)).filter(Boolean).slice(0, 5),
      respuesta: resp.trim(),
      tokens: (j.usageMetadata && j.usageMetadata.totalTokenCount) || 0
    };
  } catch(e){ console.warn("gemini:", e.message); return null; }
  finally { clearTimeout(timer); }
}

/* ── textos ── */
function lineaItem(it){
  const det = [].concat(Object.values(it.variantes || {}), it.detalle || []).filter(Boolean);
  return "• " + it.cantidad + "x " + it.nombre + (det.length ? " (" + det.join(", ") + ")" : "") + (it.nota ? " — " + it.nota : "");
}
const subtotalAprox = conv => conv.carrito.reduce((s, it) => s + (it.precio + (it.precioExtra || 0)) * it.cantidad, 0);
function ejemplo(prods){
  const a = prods[0], b = prods.find(p => p.cat !== (a && a.cat)) || prods[1];
  if (!a) return "2 hamburguesas y 1 bebida";
  return "2 " + a.nombre.toLowerCase() + (b ? " y 1 " + b.nombre.toLowerCase() : "");
}
function menuCategorias(prods, body){
  const cats = categorias(prods);
  if (cats.length <= 1) return menuProductos(prods, cats[0] || "", 0, body);
  return listado(body || "¿Qué se te antoja? Elige una categoría 👇\n\n✍️ O escríbeme todo junto, por ejemplo: «" + ejemplo(prods) + "»", "Ver menú", cats.slice(0, 10).map(c => ["cat:" + c.slice(0, 60), c]), "Menú");
}
function menuProductos(prods, cat, pag){
  const lista = prods.filter(p => !cat || (p.cat || "Otros") === cat);
  const desde = pag * 9, pagina = lista.slice(desde, desde + 9);
  const filas = pagina.map(p => ["p:" + p.id, p.nombre, plata(p.precio)]);
  if (lista.length > desde + 9) filas.push(["catp:" + (pag + 1) + ":" + cat.slice(0, 60), "Ver más ▸"]);
  let carta = "";
  for (const p of pagina){ const l = "• " + p.nombre + " — " + plata(p.precio) + "\n"; if ((carta + l).length > 760) break; carta += l; }
  const body = (cat ? "*" + cat + "*\n" : "") + carta + "\nToca uno para agregarlo, o escríbeme todo junto, por ejemplo: «" + ejemplo(pagina.length ? pagina : prods) + "» ✍️";
  return listado(body, "Elegir producto", filas, cat || "Productos");
}
function pedirMas(conv, prods){
  const body = "🛒 *Tu pedido:*\n" + conv.carrito.map(lineaItem).join("\n") + "\n\nSubtotal: " + plata(subtotalAprox(conv)) + "\n\n¿Agregas algo más? Puedes escribirlo directo 🙂";
  const bebidas = prods.filter(p => /bebida|refresco|jugo|bebestible/i.test(p.cat));
  const tieneBebida = conv.carrito.some(it => /bebida|refresco|jugo|bebestible/i.test(it.cat || ""));
  const bts = [["mas", "➕ Agregar más"]];
  if (bebidas.length && !tieneBebida) bts.push(["beb", "🥤 Ver bebidas"]);
  bts.push(["listo", "✅ Eso es todo"]);
  return botones(body, bts);
}

/* ── preguntas de cada producto: variantes y extras obligatorios ── */
function preguntasDe(p, i, lib){
  const qs = [];
  (p.variantes || []).forEach(g => qs.push({ t: "v", i, g: g.nombre, ops: g.opciones.map(o => ({ k: o, n: o })) }));
  (p.grupos || []).forEach(gid => {
    const g = (Array.isArray(lib) ? lib : []).find(x => x && x.id === gid);
    if (!g || g.obligatorio !== true || g.tipo === "quitar") return;
    const ops = (Array.isArray(g.opciones) ? g.opciones : []).filter(o => o && o.id && String(o.nombre || "").trim() && o.activo !== false)
      .map(o => ({ k: o.id, n: String(o.nombre).trim(), precio: Math.max(0, Math.round(Number(o.precio) || 0)) }));
    if (ops.length) qs.push({ t: "x", i, g: String(g.nombre || "Extras"), gid, ops: ops.slice(0, 10) });
  });
  return qs;
}
function preguntar(conv){
  const q = conv.preguntas[0], it = conv.carrito[q.i];
  const body = "¿" + q.g + "? — para " + (it.cantidad > 1 ? it.cantidad + "x " : "") + it.nombre;
  const ops = q.ops.map((o, k) => ["q:" + k, o.n + (o.precio ? " +" + plata(o.precio) : ""), o.precio ? "Suma " + plata(o.precio) : ""]);
  return ops.length <= 3 && ops.every(o => o[1].length <= 20) ? botones(body, ops) : listado(body, "Elegir", ops, q.g);
}
function responderPregunta(conv, entrada){
  const q = conv.preguntas[0];
  let k = -1;
  if (entrada.id && /^q:\d+$/.test(entrada.id)) k = Number(entrada.id.slice(2));
  else if (entrada.texto){ const t = norm(entrada.texto); k = q.ops.findIndex(o => norm(o.n) === t); if (k < 0) k = q.ops.findIndex(o => t && (norm(o.n).includes(t) || t.includes(norm(o.n)))); }
  if (k < 0 || !q.ops[k]) return false;
  const it = conv.carrito[q.i], o = q.ops[k];
  if (q.t === "v"){ it.variantes = Object.assign({}, it.variantes || {}); it.variantes[q.g] = o.k; }
  else { it.extras = Object.assign({}, it.extras || {}); it.extras[q.gid] = { [o.k]: 1 }; it.precioExtra = (it.precioExtra || 0) + (o.precio || 0); it.detalle = (it.detalle || []).concat([o.n]); }
  conv.preguntas.shift();
  return true;
}
function agregar(conv, items, prods, lib){
  const nuevos = [];
  for (const x of items){
    const p = prods.find(pp => pp.id === x.id); if (!p) continue;
    const i = conv.carrito.length;
    conv.carrito.push({ id: p.id, nombre: p.nombre, precio: p.precio, cat: p.cat, cantidad: x.cantidad || 1, variantes: {}, extras: {}, nota: x.nota || "" });
    conv.preguntas = (conv.preguntas || []).concat(preguntasDe(p, i, lib));
    nuevos.push(p.nombre);
  }
  return nuevos;
}
function itemsParaValidar(conv){
  return conv.carrito.map(it => ({ id: it.id, cantidad: it.cantidad, variantes: Object.keys(it.variantes || {}).length ? it.variantes : null, extras: Object.keys(it.extras || {}).length ? it.extras : null, notaPersonal: it.nota || null }));
}
function datosCliente(conv, nombre, waId, metodo){
  return { nombre: nombre || "Cliente WhatsApp", telefono: "+" + waId, email: conv.email || "", direccion: conv.tipo === "delivery" ? (conv.direccion || "") : "", comuna: conv.tipo === "delivery" ? (conv.comuna || "") : "",
    local: conv.tipo === "retiro" ? (conv.local || "") : "", referencias: "", notas: "Pedido por WhatsApp", tipo: conv.tipo, metodoPago: metodo, efectivo: "", uid: null, lat: null, lng: null, origen: "whatsapp", waId };
}

/* ── crea el pedido en efectivo (mismo formato que la web) ── */
export async function crearPedidoWA(db, env, storeId, cfg, conv, nombre, waId, origin){
  const val = await validarPedidoCompleto(db, storeId, itemsParaValidar(conv), conv.envio || 0, null, null);
  if (!val.ok) return { ok: false, error: val.error };
  const id = "WA" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10);
  const ahora = new Date().toISOString();
  const cliente = datosCliente(conv, nombre, waId, "efectivo");
  const ped = { id, storeId, tipo: conv.tipo, cliente, seguimiento: crypto.randomUUID().replace(/-/g, ""), uid: null,
    items: val.itemsValidados, subtotal: val.subtotal, descuento: 0, cuponAplicado: null, costoDelivery: val.costoDelivery, total: val.total,
    metodoPago: "efectivo", estado: "nuevo", fecha: ahora, origen: "whatsapp", waId,
    estadoTimeline: { nuevo: ahora, preparacion: null, camino: null, listo: null } };
  await db.doc("tiendas/" + storeId + "/pedidos/" + id).set(ped);
  for (const it of val.itemsValidados){
    try {
      const ref = db.doc("tiendas/" + storeId + "/productos/" + it.id), d = await ref.get();
      if (d.exists && d.data().stock !== null && d.data().stock !== undefined && d.data().stock !== "") await ref.set({ stock: Math.max(0, (Number(d.data().stock) || 0) - (Number(it.cantidad) || 1)) }, { merge: true });
    } catch(e){ console.warn("stock wa:", e.message); }
  }
  try { await moverInsumos(db, storeId, val.itemsValidados, -1, { pedidoId: id, lugar: "Pedido WhatsApp" }); } catch(e){ console.warn("insumos wa:", e.message); }
  try { await enviarCorreosPedido(db, env, storeId, ped, origin); } catch(e){ console.warn("correo wa:", e.message); }
  try { await notificar(new Request(origin + "/api/notificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, pedidoId: id, cliente, total: ped.total, items: ped.items }) }), env); } catch(e){ console.warn("push wa:", e.message); }
  try { if (env.LANDING) await env.LANDING.delete("wa_cat2_" + storeId); } catch(e){}
  return { ok: true, pedido: ped };
}

/* ── pago online: link de MercadoPago o Webpay (Flow) con las mismas reglas de la web ── */
export async function linkPagoWA(env, storeId, conv, nombre, waId, origin, pasarela){
  const id = "WA" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10);
  const cuerpo = { storeId, items: itemsParaValidar(conv), cliente: datosCliente(conv, nombre, waId, pasarela === "flow" ? "flow" : "mercadopago"),
    pedidoId: id, tipo: conv.tipo, costoDelivery: conv.envio || 0, cuponAplicado: null };
  if (pasarela === "flow") cuerpo.pasarela = "flow";
  try {
    const r = await crearPago(new Request(origin + "/api/crearPago", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }), env);
    const j = await r.json().catch(() => ({}));
    if (!j.ok || !(j.init_point || j.payment_link)) return { ok: false, error: j.error || "la pasarela no respondió" };
    return { ok: true, id: j.pedidoId || id, url: j.init_point || j.payment_link };
  } catch(e){ return { ok: false, error: e.message }; }
}

/* ── la conversación ──
   entrada: { texto, id (respuesta de botón o lista), tipo }
   devuelve { salida: [mensajes], conv, humanoHasta?, pedidoId? } */
export async function atender(ctx){
  const { db, env, storeId, cfg, chat, entrada, nombre, waId, ahora, saludo, origin } = ctx;
  const prods = await catalogo(db, env, storeId);
  const lib = Array.isArray(cfg.gruposExtras) ? cfg.gruposExtras : [];
  const tienda = String(cfg.nombre || "la tienda");
  const formal = tonoDe(cfg) === "formal";
  const link = cfg.dominioPrincipal ? "https://" + String(cfg.dominioPrincipal).replace(/^https?:\/\//, "").replace(/\/+$/, "") : "";
  const pagos = pagosDe(cfg), online = pagos.mp || pagos.flow;
  let conv = chat.conv && chat.conv.en && ahora - Date.parse(chat.conv.en) < CONV_VENCE_MS ? JSON.parse(JSON.stringify(chat.conv)) : null;
  const id = entrada.id || "", texto = String(entrada.texto || "").trim();
  const fin = (salida, c) => ({ salida, conv: c ? Object.assign(c, { en: new Date(ahora).toISOString() }) : null });
  const nueva = () => ({ paso: "pedido", carrito: [], preguntas: [] });
  let _locs = null; const locales = async () => (_locs = _locs || await localesDe(db, storeId));

  /* entender: IA si hay clave, si no el buscador y respuestas básicas */
  const entender = async (paso) => {
    const locs = await locales();
    const ia = await interpretarIA(env, cfg, infoTienda(cfg, locs), texto, prods, paso);
    if (ia){ if (ia.intencion === "pregunta" && !ia.respuesta) ia.respuesta = respuestaLocal(texto, cfg, locs); return Object.assign({ fuente: "ia" }, ia); }
    const b = buscarLocal(texto, prods), pregunta = esPregunta(texto);
    const intencion = pregunta ? "pregunta" : b.items.length ? "pedir" : intencionLocal(texto);
    return { fuente: "local", intencion, items: pregunta ? [] : b.items, noEncontrado: b.items.length ? b.sinEncontrar : [], respuesta: pregunta ? respuestaLocal(texto, cfg, locs) : "" };
  };
  const contestar = e => e.respuesta ? [txt(e.respuesta)] : [botones((formal ? "Disculpe, no tengo ese dato 🙏 ¿Desea" : "Uy, no tengo ese dato 🙏 ¿Quieres") + " que te comunique con alguien del equipo?", [["humano", "🙋 Hablar con alguien"]])];

  /* vuelve a mostrar lo que el cliente tenía pendiente */
  const repetir = async () => {
    if (!conv) return [botones("¿Qué te gustaría pedir?", BT_INICIO)];
    switch (conv.paso){
      case "preguntas": return [preguntar(conv)];
      case "mas": return [pedirMas(conv, prods)];
      case "entrega": return [botones("¿Cómo lo quieres recibir?", [["delivery", "🛵 Delivery"], ["retiro", "🏪 Retiro en local"]])];
      case "direccion": return [txt("📍 Cuando quieras, escríbeme la dirección: calle, número y comuna.")];
      case "comuna": return [listaComunas()];
      case "local": return [listaLocales(await locales())];
      case "resumen": { const r = await armarResumen(); return r.msg ? [r.msg] : []; }
      case "pasarela": return [botonesPasarela()];
      case "email": return [txt("📧 Escríbeme tu correo para enviarte el link de Webpay.")];
      case "pagando": return conv.linkPago ? [botonLink("Tu link de pago sigue activo 👇 Cuando pagues te confirmo por aquí.", "💳 Pagar " + plata(conv.total), conv.linkPago)] : [];
      default: return conv.carrito.length ? [pedirMas(conv, prods)] : [botones("¿Qué te gustaría pedir?", BT_INICIO)];
    }
  };
  /* texto que no calza con el paso: si es pregunta la contesta y repite el paso */
  const siPregunta = async () => {
    if (!texto) return null;
    const e = await entender(conv && conv.paso);
    if (e.intencion === "humano") return "humano";
    if (e.intencion !== "pregunta" && !esPregunta(texto)) return null;
    return contestar(e).concat(await repetir());
  };

  const siguiente = (prefijo) => {
    const out = [];
    if (prefijo) out.push(txt(prefijo));
    if (conv.preguntas && conv.preguntas.length){ conv.paso = "preguntas"; out.push(preguntar(conv)); }
    else { conv.paso = "mas"; out.push(pedirMas(conv, prods)); }
    return out;
  };
  const pedirEntrega = async () => {
    const del = cfg.deliveryActivo !== false, ret = cfg.retiroActivo !== false;
    if (del && ret){ conv.paso = "entrega"; return [botones("¿Cómo lo quieres recibir?", [["delivery", "🛵 Delivery"], ["retiro", "🏪 Retiro en local"]])]; }
    if (del){ conv.tipo = "delivery"; return pedirDireccion(); }
    return elegirRetiro();
  };
  const pedirDireccion = () => { conv.tipo = "delivery"; conv.paso = "direccion"; return [txt("📍 ¿A qué dirección te lo llevamos? Escribe calle, número y comuna.")]; };
  const listaComunas = () => listado("¿En qué comuna queda?", "Elegir comuna", comunasDe(cfg).slice(0, 9).map(c => ["com:" + c.slice(0, 60), c]).concat([["com:__otra", "Otra comuna"]]), "Comunas");
  const listaLocales = locs => listado("¿En qué local lo retiras?", "Elegir local", locs.slice(0, 10).map(l => ["loc:" + l.id, l.nombre, l.direccion]), "Locales");
  const elegirRetiro = async () => {
    conv.tipo = "retiro";
    const locs = await locales();
    if (locs.length > 1){ conv.paso = "local"; return [listaLocales(locs)]; }
    conv.local = locs[0] ? locs[0].nombre + (locs[0].direccion ? " (" + locs[0].direccion + ")" : "") : (cfg.direccion || "");
    return resumenOError();
  };
  const sinCobertura = () => { conv.paso = "entrega"; return [botones("😕 Por ahora no llegamos a " + (conv.comuna || "esa dirección") + ". ¿Prefieres retirarlo en el local?", cfg.retiroActivo === false ? [["cancelar", "❌ Cancelar"]] : [["retiro", "🏪 Retiro en local"], ["cancelar", "❌ Cancelar"]])]; };
  const armarResumen = async () => {
    const v = await validarItemsCatalogo(db, storeId, itemsParaValidar(conv));
    if (!v.ok){ conv.paso = "mas"; return { error: v.error }; }
    let envio = 0;
    if (conv.tipo === "delivery"){ const c = costoEnvio(cfg, conv.comuna, v.subtotal); if (!c.cobertura) return { sinCobertura: true }; envio = c.costo; }
    conv.subtotal = v.subtotal; conv.envio = envio; conv.total = v.subtotal + envio; conv.paso = "resumen";
    const lineas = v.itemsValidados.map(it => "• " + it.cantidad + "x " + it.nombre + (it.variantes ? " (" + Object.values(it.variantes).join(", ") + ")" : "") + " — " + plata(it.precio * it.cantidad)).join("\n");
    const entrega = conv.tipo === "delivery" ? "🛵 Delivery a " + conv.direccion + (conv.comuna && !norm(conv.direccion).includes(norm(conv.comuna)) ? ", " + conv.comuna : "") : "🏪 Retiro en " + (conv.local || "el local");
    const body = "📝 *Revisa tu pedido*\n\n" + lineas + "\n\nSubtotal: " + plata(v.subtotal) + (conv.tipo === "delivery" ? "\nEnvío: " + (envio ? plata(envio) : "gratis") : "") +
      "\n*Total: " + plata(conv.total) + "*\n\n" + entrega + "\n👤 " + (nombre || "Cliente") + (cfg.tiempoEntrega && conv.tipo === "delivery" ? "\n⏱️ Tiempo estimado: " + cfg.tiempoEntrega : "") +
      (online ? "\n\n¿Cómo quieres pagar? (para cambiar algo escribe *cambiar*)" : "\n💵 Pago en efectivo al " + (conv.tipo === "delivery" ? "recibir" : "retirar"));
    return { msg: online ? botones(body, [["ef", "💵 Efectivo"], ["online", "💳 Pagar online"], ["cancelar", "❌ Cancelar"]])
                         : botones(body, [["ok", "✅ Confirmar"], ["cambiar", "✏️ Empezar de nuevo"], ["cancelar", "❌ Cancelar"]]) };
  };
  const resumenOError = async () => {
    const r = await armarResumen();
    if (r.sinCobertura) return sinCobertura();
    if (r.error) return [txt("⚠️ " + r.error + ". Revisemos tu pedido."), pedirMas(conv, prods)];
    return [r.msg];
  };
  const botonesPasarela = () => botones("¿Con qué quieres pagar?", [["mp", "MercadoPago"], ["flow", "Webpay"], ["ef", "💵 Mejor efectivo"]]);
  const confirmarEfectivo = async () => {
    const r = await crearPedidoWA(db, env, storeId, cfg, conv, nombre, waId, origin);
    if (!r.ok) return fin([txt("⚠️ No pude registrar el pedido: " + r.error + (link ? "\nPuedes intentarlo en " + link : ""))], null);
    const p = r.pedido;
    return Object.assign(fin([txt("✅ ¡Listo" + (nombre ? ", " + String(nombre).split(" ")[0] : "") + "! Tu pedido *#" + p.id + "* quedó registrado y *" + tienda + "* ya lo está viendo.\n\nTotal: *" + plata(p.total) + "* — pagas en efectivo al " + (p.tipo === "delivery" ? "recibir" : "retirar") + "." +
      (cfg.tiempoEntrega && p.tipo === "delivery" ? "\n⏱️ Tiempo estimado: " + cfg.tiempoEntrega : "") + "\n\n¡Gracias por tu compra! 🙌")], null), { pedidoId: p.id });
  };
  const pagarOnline = async (pasarela) => {
    if (pasarela === "flow" && !EMAIL_OK.test(conv.email || "")){ conv.paso = "email"; conv.pasarela = "flow"; return fin([txt("📧 Para pagar con Webpay necesito tu correo (ahí te llega el comprobante). Escríbelo aquí:")], conv); }
    const r = await linkPagoWA(env, storeId, conv, nombre, waId, origin, pasarela);
    if (!r.ok){ conv.paso = "resumen"; return fin([txt("⚠️ No pude generar el link de pago (" + r.error + ")."), botones("¿Lo dejamos en efectivo?", [["ef", "💵 Pagar en efectivo"], ["cancelar", "❌ Cancelar"]])], conv); }
    conv.paso = "pagando"; conv.pedidoId = r.id; conv.linkPago = r.url; conv.pasarela = pasarela;
    return Object.assign(fin([botonLink("💳 Paga tu pedido *#" + r.id + "* (" + plata(conv.total) + ") con " + (pasarela === "flow" ? "Webpay" : "MercadoPago") + " 👇\n\nApenas se confirme el pago, tu pedido entra a la cocina y te aviso por aquí ✅", "💳 Pagar " + plata(conv.total), r.url)], conv), { pagoPendiente: r.id });
  };

  /* tienda cerrada: no se toman pedidos */
  if (!estadoHorario(cfg, new Date(ahora)).abierta) return fin([txt(saludo)], null);

  if (entrada.tipo && entrada.tipo !== "text" && entrada.tipo !== "interactive" && entrada.tipo !== "button")
    return fin([botones("Por ahora solo leo mensajes de texto 🙂 Escríbeme lo que quieres pedir o mira el menú.", BT_INICIO)], conv);

  /* órdenes que valen en cualquier momento */
  const intLocal = texto ? intencionLocal(texto) : "";
  const humano = () => Object.assign(fin([txt("🙋 Listo, le aviso al equipo de *" + tienda + "*. Te responderán por aquí mismo en cuanto puedan.")], conv), { humanoHasta: new Date(ahora + HUMANO_MS).toISOString(), avisarHumano: true });
  if (id === "humano" || intLocal === "humano") return humano();
  if (id === "cancelar" || intLocal === "cancelar")
    return fin([txt((conv && conv.paso === "pagando" ? "Pedido cancelado 👍 No pagues el link que te envié." : "Pedido cancelado 👍") + " Cuando quieras, escríbeme de nuevo." + (link ? "\nTambién puedes pedir en " + link : ""))], null);
  if (conv && conv.paso === "pagando"){
    const q = await siPregunta();
    if (q === "humano") return humano();
    return fin((q && q.length ? q : await repetir()), conv);
  }
  if (id === "menu" || (intLocal === "menu" && (!conv || ["pedido", "mas"].includes(conv.paso)))){
    conv = conv || nueva();
    if (conv.paso !== "mas") conv.paso = "pedido";
    return fin([menuCategorias(prods)], conv);
  }
  if (id.startsWith("cat:")){ conv = conv || nueva(); return fin([menuProductos(prods, id.slice(4), 0)], conv); }
  if (id.startsWith("catp:")){ conv = conv || nueva(); const m = /^catp:(\d+):(.*)$/.exec(id); return fin([menuProductos(prods, m ? m[2] : "", m ? Number(m[1]) : 0)], conv); }
  if (id === "beb"){ const cat = categorias(prods).find(c => /bebida|refresco|jugo|bebestible/i.test(c)); return fin([menuProductos(prods, cat || "", 0)], conv); }
  if (id.startsWith("p:")){
    conv = conv || nueva();
    if (!["pedido", "mas"].includes(conv.paso)) conv.paso = "pedido";
    const n = agregar(conv, [{ id: id.slice(2), cantidad: 1 }], prods, lib);
    return fin(n.length ? siguiente() : [txt("Ese producto ya no está disponible 😕"), menuCategorias(prods)], conv);
  }

  /* conversación nueva */
  if (!conv){
    conv = nueva();
    if (!texto) return fin([botones(saludo, BT_INICIO)], conv);
    const e = await entender("");
    conv.ia = e.fuente;
    if (e.intencion === "humano") return humano();
    if (e.items.length){
      agregar(conv, e.items, prods, lib);
      return fin(siguiente(e.noEncontrado.length ? "No encontré: " + e.noEncontrado.join(", ") + ". Te anoto lo demás 👇" : ""), conv);
    }
    if (e.intencion === "pregunta") return fin(contestar(e).concat([botones("¿Te ayudo con tu pedido? Escríbeme lo que quieres o mira el menú.", BT_INICIO)]), conv);
    if (e.intencion === "menu") return fin([menuCategorias(prods)], conv);
    return fin([botones(saludo + "\n\nEscríbeme lo que quieres (por ejemplo «" + ejemplo(prods) + "») o toca *Ver menú*.", BT_INICIO)], conv);
  }

  switch (conv.paso){
    case "preguntas": {
      if (responderPregunta(conv, { id, texto })){ conv.fallos = 0; return fin(siguiente(), conv); }
      const q = await siPregunta(); if (q === "humano") return humano(); if (q) return fin(q, conv);
      return fin([txt("No te entendí 😅 Elige una de las opciones:"), preguntar(conv)], conv);
    }
    case "pedido":
    case "mas": {
      if (id === "listo" || (conv.paso === "mas" && /^(eso es todo|eso seria|eso seria todo|nada mas|nada|listo|no|no gracias|eso|es todo|solo eso)$/.test(norm(texto)))){
        if (!conv.carrito.length) return fin([menuCategorias(prods)], conv);
        return fin(await pedirEntrega(), conv);
      }
      if (id === "mas"){ conv.paso = "pedido"; return fin([botones("¿Qué más quieres? Escríbelo todo junto (por ejemplo «" + ejemplo(prods) + "») o mira el menú.", conv.carrito.length ? [["menu", "📋 Ver menú"], ["listo", "✅ Eso es todo"]] : BT_INICIO)], conv); }
      if (texto){
        const e = await entender(conv.paso);
        if (e.intencion === "humano") return humano();
        if (e.items.length){ agregar(conv, e.items, prods, lib); return fin(siguiente(e.noEncontrado.length ? "No encontré: " + e.noEncontrado.join(", ") + ". Te anoto lo demás 👇" : ""), conv); }
        if (e.intencion === "pregunta") return fin(contestar(e).concat(await repetir()), conv);
        if (e.intencion === "menu") return fin([menuCategorias(prods)], conv);
        if (e.intencion === "saludo" && !conv.carrito.length) return fin([botones(saludo, BT_INICIO)], conv);
      }
      conv.fallos = (conv.fallos || 0) + 1;
      if (conv.carrito.length) return fin([txt("No encontré eso en el menú 😕"), pedirMas(conv, prods)], conv);
      return fin([botones("No encontré eso en el menú 😕 Toca *Ver menú* para ver lo que tenemos" + (conv.fallos >= 2 && link ? ", o pide directo en " + link : "") + ".", BT_INICIO)], conv);
    }
    case "entrega": {
      const t = norm(texto);
      if (id === "delivery" || (!esPregunta(texto) && /delivery|despacho|domicilio|envio|enviar|llevar/.test(t))){
        if (cfg.deliveryActivo === false) return fin([txt("Por ahora no hacemos delivery 🙏"), ...(await elegirRetiro())], conv);
        return fin(pedirDireccion(), conv);
      }
      if (id === "retiro" || (!esPregunta(texto) && /retir|buscar|paso a buscar|local/.test(t))){
        if (cfg.retiroActivo === false) return fin([txt("Por ahora no tenemos retiro en local 🙏"), ...pedirDireccion()], conv);
        return fin(await elegirRetiro(), conv);
      }
      const q = await siPregunta(); if (q === "humano") return humano(); if (q) return fin(q, conv);
      return fin([botones("Elige cómo lo quieres recibir:", [["delivery", "🛵 Delivery"], ["retiro", "🏪 Retiro en local"]])], conv);
    }
    case "direccion": {
      if (esPregunta(texto)){ const q = await siPregunta(); if (q === "humano") return humano(); if (q) return fin(q, conv); }
      if (texto.length < 5) return fin([txt("📍 Escribe la dirección completa: calle, número y comuna.")], conv);
      conv.direccion = corto(texto, 160);
      if (Array.isArray(cfg.zonas) && cfg.zonas.length){
        conv.comuna = comunaEnTexto(cfg, texto);
        if (!conv.comuna){ conv.paso = "comuna"; return fin([listaComunas()], conv); }
      }
      return fin(await resumenOError(), conv);
    }
    case "comuna": {
      const c = id.startsWith("com:") ? id.slice(4) : comunaEnTexto(cfg, texto);
      if (!c && texto && esPregunta(texto)){ const q = await siPregunta(); if (q === "humano") return humano(); if (q) return fin(q, conv); }
      if (c === "__otra" || (!c && texto)){ conv.comuna = ""; return fin(sinCobertura(), conv); }
      if (!c) return fin([txt("Elige tu comuna de la lista 👆")], conv);
      conv.comuna = c;
      return fin(await resumenOError(), conv);
    }
    case "local": {
      const locs = await locales();
      const l = id.startsWith("loc:") ? locs.find(x => x.id === id.slice(4)) : locs.find(x => texto && norm(x.nombre).includes(norm(texto)));
      if (!l){ const q = await siPregunta(); if (q === "humano") return humano(); if (q) return fin(q, conv); return fin([listaLocales(locs)], conv); }
      conv.local = l.nombre + (l.direccion ? " (" + l.direccion + ")" : "");
      return fin(await resumenOError(), conv);
    }
    case "resumen": {
      const t = norm(texto);
      if (id === "ok" || id === "ef" || (!online && /^(si|confirmo|confirmar|ok|dale|listo)$/.test(t)) || /^(efectivo|en efectivo|pago en efectivo)$/.test(t)) return confirmarEfectivo();
      if (id === "online" || (online && /^(online|pagar online|tarjeta|con tarjeta|webpay|mercado ?pago)$/.test(t))){
        if (/webpay/.test(t) && pagos.flow) return pagarOnline("flow");
        if (/mercado/.test(t) && pagos.mp) return pagarOnline("mp");
        if (pagos.mp && pagos.flow){ conv.paso = "pasarela"; return fin([botonesPasarela()], conv); }
        return pagarOnline(pagos.flow ? "flow" : "mp");
      }
      if (id === "cambiar" || /^(cambiar|empezar de nuevo|modificar|cambio)$/.test(t)) return fin([botones("Ok, empecemos de nuevo 🙂 ¿Qué quieres pedir?", BT_INICIO)], nueva());
      const q = await siPregunta(); if (q === "humano") return humano(); if (q) return fin(q, conv);
      return fin([txt(online ? "Elige cómo pagar para enviar tu pedido, o escribe *cambiar* para modificarlo." : "Toca *Confirmar* para enviar tu pedido, o *Empezar de nuevo* para cambiarlo.")].concat(await repetir()), conv);
    }
    case "pasarela": {
      if (id === "ef") return confirmarEfectivo();
      if (id === "mp" || /mercado/.test(norm(texto))) return pagarOnline("mp");
      if (id === "flow" || /webpay|flow/.test(norm(texto))) return pagarOnline("flow");
      const q = await siPregunta(); if (q === "humano") return humano(); if (q) return fin(q, conv);
      return fin([botonesPasarela()], conv);
    }
    case "email": {
      const m = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}/.exec(texto);
      if (!m){ const q = await siPregunta(); if (q === "humano") return humano(); if (q) return fin(q, conv); return fin([txt("Ese correo no me parece válido 🤔 Escríbelo así: nombre@correo.cl")], conv); }
      conv.email = m[0].toLowerCase();
      return pagarOnline(conv.pasarela || "flow");
    }
  }
  return fin([botones(saludo, BT_INICIO)], nueva());
}

/* ── costo de envío: mismas reglas que la tienda (zonas por comuna o costo fijo) ── */
export function costoEnvio(cfg, comuna, subtotal){
  const zonas = Array.isArray(cfg.zonas) ? cfg.zonas : [];
  if (zonas.length){
    const c = norm(comuna);
    const z = zonas.find(z => String(z.comunas || "").split(",").map(norm).filter(Boolean).includes(c));
    if (!z) return { cobertura: false };
    const min = Number(z.minGratis) || 0;
    return { cobertura: true, zona: z.nombre || "", costo: min > 0 && subtotal >= min ? 0 : (Number(z.costo) || 0) };
  }
  const min = Number(cfg.deliveryMinimo) || 0;
  return { cobertura: true, costo: min > 0 && subtotal >= min ? 0 : (Number(cfg.deliveryCosto) || 0) };
}
function comunasDe(cfg){
  const v = [];
  (Array.isArray(cfg.zonas) ? cfg.zonas : []).forEach(z => String(z.comunas || "").split(",").map(s => s.trim()).filter(Boolean).forEach(c => { if (!v.includes(c)) v.push(c); }));
  return v;
}
function comunaEnTexto(cfg, texto){
  const t = " " + norm(texto) + " ";
  return comunasDe(cfg).find(c => t.includes(" " + norm(c) + " ")) || "";
}
