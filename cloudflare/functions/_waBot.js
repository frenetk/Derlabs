import { validarItemsCatalogo, validarPedidoCompleto, estadoHorario } from "./_firebase.js";
import { moverInsumos } from "./inventario.js";
import { enviarCorreosPedido } from "./enviarEmails.js";
import { notificar } from "./notificar.js";
/* cloudflare/functions/_waBot.js — P66 · El asistente de WhatsApp toma pedidos.

   Conversación por pasos. La IA (Gemini) solo ENTIENDE lo que escribe el cliente
   ("2 clásicas y una coca") y devuelve ids del catálogo; todo lo demás (preguntas de
   variantes, extras obligatorios, entrega, comuna, precios, total) lo hace el servidor
   con los datos de la tienda, igual que la web. Sin GEMINI_API_KEY funciona con un
   buscador simple por nombre.

   Estado de la conversación: tiendas/{storeId}/waChats/{numero}.conv (vence a las 2 h).
   El pedido se valida con validarPedidoCompleto (horario, stock, precios) y queda en
   tiendas/{storeId}/pedidos con origen "whatsapp" y pago en efectivo. */

export const CONV_VENCE_MS = 2 * 3600 * 1000;
const HUMANO_MS = 2 * 3600 * 1000;
const MAX_PROD_IA = 400;

/* ── utilidades ── */
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ]+/g, " ").trim();
export const plata = n => "$" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const corto = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; };
const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, par: 2 };
const VACIAS = new Set("de del la las el los un una uno unos unas y con sin para por al a en mi me quiero quisiera pedir dame porfa por favor gracias hola buenas tardes noches dias mas tambien otra otro".split(" "));

/* ── mensajes para Meta ── */
const txt = body => ({ type: "text", text: { preview_url: true, body: String(body).slice(0, 4096) } });
function botones(body, lista){
  return { type: "interactive", interactive: { type: "button", body: { text: String(body).slice(0, 1024) },
    action: { buttons: lista.slice(0, 3).map(b => ({ type: "reply", reply: { id: String(b[0]).slice(0, 256), title: corto(b[1], 20) } })) } } };
}
function listado(body, boton, filas, titulo){
  return { type: "interactive", interactive: { type: "list", body: { text: String(body).slice(0, 1024) },
    action: { button: corto(boton, 20), sections: [{ title: corto(titulo || "Opciones", 24), rows: filas.slice(0, 10).map(f => Object.assign({ id: String(f[0]).slice(0, 200), title: corto(f[1], 24) }, f[2] ? { description: corto(f[2], 72) } : {})) }] } } };
}

/* ── catálogo (se guarda 2 minutos en el KV para no leer Firestore en cada mensaje) ── */
export async function catalogo(db, env, storeId){
  const k = "wa_cat_" + storeId;
  try { if (env.LANDING){ const c = await env.LANDING.get(k); if (c) return JSON.parse(c); } } catch(e){}
  const q = await db.collection("tiendas/" + storeId + "/productos").get();
  const prods = q.docs.map(d => {
    const p = d.data() || {};
    return { id: d.id, nombre: String(p.nombre || "").trim(), precio: Number(p.precio) || 0, cat: String(p.categoria || "").trim(), desc: corto(p.descripcion || "", 70),
      orden: Number(p.orden) || 0, activo: p.activo !== false && p.disponible !== false, agotado: p.stock !== null && p.stock !== undefined && p.stock !== "" && Number(p.stock) <= 0,
      variantes: p.variantesActivas && Array.isArray(p.variantes) ? p.variantes.filter(g => g && g.nombre && Array.isArray(g.opciones) && g.opciones.length).map(g => ({ nombre: String(g.nombre), opciones: g.opciones.map(String).slice(0, 10) })) : [],
      grupos: Array.isArray(p.gruposExtras) ? p.gruposExtras.slice(0, 10) : [] };
  }).filter(p => p.nombre && p.activo && !p.agotado).sort((a, b) => a.orden - b.orden);
  try { if (env.LANDING) await env.LANDING.put(k, JSON.stringify(prods), { expirationTtl: 120 }); } catch(e){}
  return prods;
}
const categorias = prods => { const v = []; prods.forEach(p => { const c = p.cat || "Otros"; if (!v.includes(c)) v.push(c); }); return v; };

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
export function intencionLocal(texto){
  const t = norm(texto);
  if (!t) return "otro";
  if (/\b(cancelar|cancela|anular|anula)\b/.test(t)) return "cancelar";
  if (/(hablar con|persona|humano|ejecutivo|atencion|alguien real)/.test(t)) return "humano";
  if (/^(ver )?(el )?(menu|carta|catalogo)\b|que (tienen|hay|venden)|precios?\b/.test(t)) return "menu";
  if (/^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|alo|hey|ola)\b/.test(t) && t.split(" ").length <= 4) return "saludo";
  return "otro";
}

/* ── entender el texto con Gemini (solo nombres y categorías, nunca el catálogo completo) ── */
export async function interpretarIA(env, tienda, texto, prods){
  const key = String(env.GEMINI_API_KEY || "").trim();
  if (!key) return null;
  const modelo = String(env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const lineas = prods.slice(0, MAX_PROD_IA).map(p => p.id + "|" + p.nombre + "|" + (p.cat || "") + "|" + p.precio).join("\n");
  const prompt = "Eres el asistente de pedidos por WhatsApp de \"" + tienda + "\". Solo tomas pedidos de este catálogo.\n" +
    "CATÁLOGO (id|nombre|categoría|precio):\n" + lineas + "\n\nMENSAJE DEL CLIENTE: «" + String(texto).slice(0, 500) + "»\n\n" +
    "Responde SOLO con JSON: {\"intencion\":\"pedir|menu|humano|cancelar|saludo|otro\",\"items\":[{\"id\":\"id exacto del catálogo\",\"cantidad\":1,\"nota\":\"detalle que pidió, corto\"}],\"noEncontrado\":[\"lo que pidió y no está en el catálogo\"]}. " +
    "Usa solo ids del catálogo. No inventes productos ni precios. Si el mensaje no pide productos, items va vacío.";
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelo) + ":generateContent", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 600 } })
    });
    if (!r.ok) throw new Error("Gemini " + r.status);
    const j = await r.json();
    const t = (((j.candidates || [])[0] || {}).content || {}).parts;
    const out = JSON.parse(String(t && t[0] && t[0].text || "{}").replace(/^```(json)?|```$/g, ""));
    const ids = new Set(prods.map(p => p.id));
    return {
      intencion: ["pedir", "menu", "humano", "cancelar", "saludo", "otro"].includes(out.intencion) ? out.intencion : "otro",
      items: (Array.isArray(out.items) ? out.items : []).filter(i => i && ids.has(String(i.id))).slice(0, 15)
        .map(i => ({ id: String(i.id), cantidad: Math.min(Math.max(Math.floor(Number(i.cantidad) || 1), 1), 20), nota: corto(i.nota || "", 100) })),
      noEncontrado: (Array.isArray(out.noEncontrado) ? out.noEncontrado : []).map(s => corto(s, 60)).slice(0, 5),
      tokens: (j.usageMetadata && j.usageMetadata.totalTokenCount) || 0
    };
  } catch(e){ console.warn("gemini:", e.message); return null; }
  finally { clearTimeout(timer); }
}
async function entender(env, tienda, texto, prods){
  const ia = await interpretarIA(env, tienda, texto, prods);
  if (ia) return Object.assign({ fuente: "ia" }, ia);
  const b = buscarLocal(texto, prods), i = intencionLocal(texto);
  return { fuente: "local", intencion: b.items.length ? "pedir" : i, items: b.items, noEncontrado: b.items.length ? b.sinEncontrar : [] };
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

/* ── textos ── */
function lineaItem(it){
  const det = [].concat(Object.values(it.variantes || {}), it.detalle || []).filter(Boolean);
  return "• " + it.cantidad + "x " + it.nombre + (det.length ? " (" + det.join(", ") + ")" : "") + (it.nota ? " — " + it.nota : "");
}
const subtotalAprox = conv => conv.carrito.reduce((s, it) => s + (it.precio + (it.precioExtra || 0)) * it.cantidad, 0);
function menuCategorias(prods, body){
  const cats = categorias(prods);
  if (cats.length <= 1) return menuProductos(prods, cats[0] || "", 0, body);
  return listado(body || "¿Qué se te antoja? Elige una categoría 👇", "Ver menú", cats.slice(0, 10).map(c => ["cat:" + c.slice(0, 60), c, prods.filter(p => (p.cat || "Otros") === c).length + " productos"]), "Menú");
}
function menuProductos(prods, cat, pag, body){
  const lista = prods.filter(p => !cat || (p.cat || "Otros") === cat);
  const desde = pag * 9, filas = lista.slice(desde, desde + 9).map(p => ["p:" + p.id, p.nombre, plata(p.precio) + (p.desc ? " · " + p.desc : "")]);
  if (lista.length > desde + 9) filas.push(["catp:" + (pag + 1) + ":" + cat.slice(0, 60), "Ver más ▸", "Más productos de " + (cat || "la tienda")]);
  return listado(body || (cat ? cat + ": toca lo que quieras agregar" : "Toca lo que quieras agregar"), "Ver productos", filas, cat || "Productos");
}
function pedirMas(conv, prods){
  const sub = subtotalAprox(conv);
  const body = "🛒 *Tu pedido:*\n" + conv.carrito.map(lineaItem).join("\n") + "\n\nSubtotal: " + plata(sub) + "\n\n¿Agregas algo más?";
  const bebidas = prods.filter(p => /bebida|refresco|jugo|bebestible/i.test(p.cat));
  const tieneBebida = conv.carrito.some(it => /bebida|refresco|jugo|bebestible/i.test(it.cat || ""));
  const bts = [["mas", "➕ Agregar más"]];
  if (bebidas.length && !tieneBebida) bts.push(["beb", "🥤 Ver bebidas"]);
  bts.push(["listo", "✅ Eso es todo"]);
  return botones(body, bts);
}

/* agrega lo que entendió y sigue: preguntas pendientes o "¿algo más?" */
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
function siguiente(conv, prods, prefijo){
  const out = [];
  if (prefijo) out.push(txt(prefijo));
  if (conv.preguntas && conv.preguntas.length){ conv.paso = "preguntas"; out.push(preguntar(conv)); }
  else { conv.paso = "mas"; out.push(pedirMas(conv, prods)); }
  return out;
}
function pedirEntrega(conv, cfg){
  const del = cfg.deliveryActivo !== false, ret = cfg.retiroActivo !== false;
  if (del && ret){ conv.paso = "entrega"; return [botones("¿Cómo lo quieres recibir?", [["delivery", "🛵 Delivery"], ["retiro", "🏪 Retiro en local"]])]; }
  conv.tipo = del ? "delivery" : "retiro";
  return conv.tipo === "delivery" ? pedirDireccion(conv) : null;
}
function pedirDireccion(conv){ conv.paso = "direccion"; return [txt("📍 ¿A qué dirección te lo llevamos? Escribe calle, número y comuna.")]; }

async function armarResumen(db, storeId, cfg, conv, nombre){
  const v = await validarItemsCatalogo(db, storeId, itemsParaValidar(conv));
  if (!v.ok){ conv.paso = "mas"; return { error: v.error }; }
  conv.subtotal = v.subtotal;
  let envio = 0;
  if (conv.tipo === "delivery"){
    const c = costoEnvio(cfg, conv.comuna, v.subtotal);
    if (!c.cobertura) return { sinCobertura: true };
    envio = c.costo;
  }
  conv.envio = envio; conv.total = v.subtotal + envio; conv.paso = "resumen";
  const lineas = v.itemsValidados.map(it => "• " + it.cantidad + "x " + it.nombre + (it.variantes ? " (" + Object.values(it.variantes).join(", ") + ")" : "") + " — " + plata(it.precio * it.cantidad)).join("\n");
  const entrega = conv.tipo === "delivery" ? "🛵 Delivery a " + conv.direccion + (conv.comuna && !norm(conv.direccion).includes(norm(conv.comuna)) ? ", " + conv.comuna : "") : "🏪 Retiro en " + (conv.local || "el local");
  const body = "📝 *Revisa tu pedido*\n\n" + lineas + "\n\nSubtotal: " + plata(v.subtotal) + (conv.tipo === "delivery" ? "\nEnvío: " + (envio ? plata(envio) : "gratis") : "") +
    "\n*Total: " + plata(conv.total) + "*\n\n" + entrega + "\n💵 Pago en efectivo al " + (conv.tipo === "delivery" ? "recibir" : "retirar") + "\n👤 " + (nombre || "Cliente") +
    (cfg.tiempoEntrega && conv.tipo === "delivery" ? "\n⏱️ Tiempo estimado: " + cfg.tiempoEntrega : "");
  return { msg: botones(body, [["ok", "✅ Confirmar"], ["cambiar", "✏️ Empezar de nuevo"], ["cancelar", "❌ Cancelar"]]) };
}
function itemsParaValidar(conv){
  return conv.carrito.map(it => ({ id: it.id, cantidad: it.cantidad, variantes: Object.keys(it.variantes || {}).length ? it.variantes : null, extras: Object.keys(it.extras || {}).length ? it.extras : null, notaPersonal: it.nota || null }));
}

/* ── crea el pedido en la tienda (mismo formato que un pedido en efectivo de la web) ── */
export async function crearPedidoWA(db, env, storeId, cfg, conv, nombre, waId, origin){
  const val = await validarPedidoCompleto(db, storeId, itemsParaValidar(conv), conv.envio || 0, null, null);
  if (!val.ok) return { ok: false, error: val.error };
  const id = "WA" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10);
  const ahora = new Date().toISOString();
  const cliente = { nombre: nombre || "Cliente WhatsApp", telefono: "+" + waId, email: "", direccion: conv.tipo === "delivery" ? conv.direccion : "", comuna: conv.tipo === "delivery" ? (conv.comuna || "") : "",
    local: conv.tipo === "retiro" ? (conv.local || "") : "", referencias: "", notas: "Pedido por WhatsApp", tipo: conv.tipo, metodoPago: "efectivo", efectivo: "", uid: null, lat: null, lng: null };
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
  try { if (env.LANDING) await env.LANDING.delete("wa_cat_" + storeId); } catch(e){}
  return { ok: true, pedido: ped };
}

/* ── la conversación ──
   entrada: { texto, id (respuesta de botón o lista), tipo }
   devuelve { salida: [mensajes], conv, humanoHasta?, pedidoId? } */
export async function atender(ctx){
  const { db, env, storeId, cfg, chat, entrada, nombre, waId, ahora, saludo, origin } = ctx;
  const prods = await catalogo(db, env, storeId);
  const lib = Array.isArray(cfg.gruposExtras) ? cfg.gruposExtras : [];
  const tienda = String(cfg.nombre || "la tienda");
  const link = cfg.dominioPrincipal ? "https://" + String(cfg.dominioPrincipal).replace(/^https?:\/\//, "").replace(/\/+$/, "") : "";
  let conv = chat.conv && chat.conv.en && ahora - Date.parse(chat.conv.en) < CONV_VENCE_MS ? JSON.parse(JSON.stringify(chat.conv)) : null;
  const id = entrada.id || "", texto = String(entrada.texto || "").trim();
  const fin = (salida, c) => ({ salida, conv: c ? Object.assign(c, { en: new Date(ahora).toISOString() }) : null });

  /* tienda cerrada: no se toman pedidos */
  const eh = estadoHorario(cfg, new Date(ahora));
  if (!eh.abierta) return fin([txt(saludo)], null);

  if (entrada.tipo && entrada.tipo !== "text" && entrada.tipo !== "interactive" && entrada.tipo !== "button")
    return fin([botones("Por ahora solo leo mensajes de texto 🙂 Escríbeme lo que quieres pedir o mira el menú.", [["menu", "📋 Ver menú"], ["humano", "🙋 Hablar con alguien"]])], conv);

  /* órdenes que valen en cualquier momento */
  const intLocal = texto ? intencionLocal(texto) : "";
  if (id === "humano" || intLocal === "humano")
    return Object.assign(fin([txt("🙋 Listo, le aviso al equipo de *" + tienda + "*. Te responderán por aquí mismo en cuanto puedan.")], conv), { humanoHasta: new Date(ahora + HUMANO_MS).toISOString(), avisarHumano: true });
  if (id === "cancelar" || intLocal === "cancelar")
    return fin([txt("Pedido cancelado 👍 Cuando quieras, escríbeme de nuevo." + (link ? "\nTambién puedes pedir en " + link : ""))], null);
  if (id === "menu" || (intLocal === "menu" && (!conv || ["pedido", "mas"].includes(conv.paso)))){
    conv = conv || { paso: "pedido", carrito: [], preguntas: [] };
    if (conv.paso !== "mas") conv.paso = "pedido";
    return fin([menuCategorias(prods)], conv);
  }
  if (id.startsWith("cat:")){ conv = conv || { paso: "pedido", carrito: [], preguntas: [] }; return fin([menuProductos(prods, id.slice(4), 0)], conv); }
  if (id.startsWith("catp:")){ conv = conv || { paso: "pedido", carrito: [], preguntas: [] }; const m = /^catp:(\d+):(.*)$/.exec(id); return fin([menuProductos(prods, m ? m[2] : "", m ? Number(m[1]) : 0)], conv); }
  if (id === "beb"){ const cat = categorias(prods).find(c => /bebida|refresco|jugo|bebestible/i.test(c)); return fin([menuProductos(prods, cat || "", 0)], conv); }
  if (id.startsWith("p:")){
    conv = conv || { paso: "pedido", carrito: [], preguntas: [] };
    if (["preguntas", "resumen", "direccion", "comuna", "entrega", "local"].includes(conv.paso)) conv.paso = "pedido";
    const n = agregar(conv, [{ id: id.slice(2), cantidad: 1 }], prods, lib);
    return fin(n.length ? siguiente(conv, prods) : [txt("Ese producto ya no está disponible 😕"), menuCategorias(prods)], conv);
  }

  /* conversación nueva */
  if (!conv){
    if (!texto && !id) return fin([botones(saludo, [["menu", "📋 Ver menú"], ["humano", "🙋 Hablar con alguien"]])], { paso: "pedido", carrito: [], preguntas: [] });
    const e = texto ? await entender(env, tienda, texto, prods) : { items: [], intencion: "otro" };
    conv = { paso: "pedido", carrito: [], preguntas: [], ia: e.fuente };
    if (e.items.length){
      agregar(conv, e.items, prods, lib);
      return fin(siguiente(conv, prods, e.noEncontrado && e.noEncontrado.length ? "No encontré: " + e.noEncontrado.join(", ") + ". Te anoto lo demás 👇" : ""), conv);
    }
    if (e.intencion === "menu") return fin([menuCategorias(prods)], conv);
    return fin([botones(saludo + "\n\nEscríbeme lo que quieres (por ejemplo «2 " + (prods[0] ? prods[0].nombre.toLowerCase() : "hamburguesas") + "») o toca *Ver menú*.", [["menu", "📋 Ver menú"], ["humano", "🙋 Hablar con alguien"]])], conv);
  }

  switch (conv.paso){
    case "preguntas": {
      if (!responderPregunta(conv, { id, texto })){
        conv.fallos = (conv.fallos || 0) + 1;
        return fin([txt("No te entendí 😅 Elige una de las opciones:"), preguntar(conv)], conv);
      }
      conv.fallos = 0;
      return fin(siguiente(conv, prods), conv);
    }
    case "mas": {
      if (id === "listo" || /^(eso es todo|nada mas|nada|listo|no|no gracias|eso)$/.test(norm(texto))){
        const p = pedirEntrega(conv, cfg);
        if (p) return fin(p, conv);
        const r = await armarResumen(db, storeId, cfg, conv, nombre);
        return fin(r.error ? [txt("⚠️ " + r.error + ". Revisemos tu pedido."), pedirMas(conv, prods)] : [r.msg], conv);
      }
      if (id === "mas"){ conv.paso = "pedido"; return fin([botones("¿Qué más quieres? Escríbelo o mira el menú.", [["menu", "📋 Ver menú"], ["listo", "✅ Eso es todo"]])], conv); }
      if (texto){
        const e = await entender(env, tienda, texto, prods);
        if (e.items.length){ agregar(conv, e.items, prods, lib); return fin(siguiente(conv, prods), conv); }
      }
      return fin([txt("No encontré eso en el menú 😕"), pedirMas(conv, prods)], conv);
    }
    case "pedido": {
      if (id === "listo" && conv.carrito.length){ conv.paso = "mas"; return atender(Object.assign({}, ctx, { chat: { conv }, entrada: { id: "listo" } })); }
      if (texto){
        const e = await entender(env, tienda, texto, prods);
        if (e.items.length){ agregar(conv, e.items, prods, lib); return fin(siguiente(conv, prods, e.noEncontrado && e.noEncontrado.length ? "No encontré: " + e.noEncontrado.join(", ") + "." : ""), conv); }
        if (e.intencion === "saludo") return fin([botones(saludo, [["menu", "📋 Ver menú"], ["humano", "🙋 Hablar con alguien"]])], conv);
      }
      conv.fallos = (conv.fallos || 0) + 1;
      return fin([botones("No encontré eso en el menú 😕 Toca *Ver menú* para ver lo que tenemos" + (conv.fallos >= 2 && link ? ", o pide directo en " + link : "") + ".", [["menu", "📋 Ver menú"], ["humano", "🙋 Hablar con alguien"]])], conv);
    }
    case "entrega": {
      const t = norm(texto);
      if (id === "delivery" || /delivery|despacho|domicilio|envio|enviar|llevar/.test(t)){ conv.tipo = "delivery"; return fin(pedirDireccion(conv), conv); }
      if (id === "retiro" || /retir|buscar|paso a buscar|local/.test(t)){
        conv.tipo = "retiro";
        const locs = await localesDe(db, storeId);
        if (locs.length > 1){ conv.paso = "local"; return fin([listado("¿En qué local lo retiras?", "Elegir local", locs.slice(0, 10).map(l => ["loc:" + l.id, l.nombre, l.direccion]), "Locales")], conv); }
        conv.local = locs[0] ? locs[0].nombre + (locs[0].direccion ? " (" + locs[0].direccion + ")" : "") : (cfg.direccion || "");
        const r = await armarResumen(db, storeId, cfg, conv, nombre);
        return fin(r.error ? [txt("⚠️ " + r.error + ". Revisemos tu pedido."), pedirMas(conv, prods)] : [r.msg], conv);
      }
      return fin([botones("Elige cómo lo quieres recibir:", [["delivery", "🛵 Delivery"], ["retiro", "🏪 Retiro en local"]])], conv);
    }
    case "direccion": {
      if (texto.length < 5) return fin([txt("📍 Escribe la dirección completa: calle, número y comuna.")], conv);
      conv.direccion = corto(texto, 160);
      if (Array.isArray(cfg.zonas) && cfg.zonas.length){
        conv.comuna = comunaEnTexto(cfg, texto);
        if (!conv.comuna){
          conv.paso = "comuna";
          const cs = comunasDe(cfg);
          return fin([listado("¿En qué comuna queda?", "Elegir comuna", cs.slice(0, 9).map(c => ["com:" + c.slice(0, 60), c]).concat([["com:__otra", "Otra comuna"]]), "Comunas")], conv);
        }
      }
      return fin(await resumenOSinCobertura(db, storeId, cfg, conv, nombre), conv);
    }
    case "comuna": {
      let c = id.startsWith("com:") ? id.slice(4) : comunaEnTexto(cfg, texto);
      if (c === "__otra" || (!c && texto)){
        conv.paso = "entrega";
        return fin([botones("😕 Por ahora no llegamos a esa comuna. ¿Prefieres retirarlo en el local?", [["retiro", "🏪 Retiro en local"], ["cancelar", "❌ Cancelar"]])], conv);
      }
      if (!c) return fin([txt("Elige tu comuna de la lista 👆")], conv);
      conv.comuna = c;
      return fin(await resumenOSinCobertura(db, storeId, cfg, conv, nombre), conv);
    }
    case "local": {
      const locs = await localesDe(db, storeId);
      const l = id.startsWith("loc:") ? locs.find(x => x.id === id.slice(4)) : locs.find(x => texto && norm(x.nombre).includes(norm(texto)));
      if (!l) return fin([listado("Elige el local de la lista 👇", "Elegir local", locs.slice(0, 10).map(x => ["loc:" + x.id, x.nombre, x.direccion]), "Locales")], conv);
      conv.local = l.nombre + (l.direccion ? " (" + l.direccion + ")" : "");
      const r = await armarResumen(db, storeId, cfg, conv, nombre);
      return fin(r.error ? [txt("⚠️ " + r.error + ". Revisemos tu pedido."), pedirMas(conv, prods)] : [r.msg], conv);
    }
    case "resumen": {
      if (id === "ok" || /^(si|confirmo|confirmar|ok|dale|listo)$/.test(norm(texto))){
        const r = await crearPedidoWA(db, env, storeId, cfg, conv, nombre, waId, origin);
        if (!r.ok) return fin([txt("⚠️ No pude registrar el pedido: " + r.error + (link ? "\nPuedes intentarlo en " + link : ""))], null);
        const p = r.pedido;
        return Object.assign(fin([txt("✅ ¡Listo" + (nombre ? ", " + String(nombre).split(" ")[0] : "") + "! Tu pedido *#" + p.id + "* quedó registrado y *" + tienda + "* ya lo está viendo.\n\nTotal: *" + plata(p.total) + "* — pagas en efectivo al " + (p.tipo === "delivery" ? "recibir" : "retirar") + "." +
          (cfg.tiempoEntrega && p.tipo === "delivery" ? "\n⏱️ Tiempo estimado: " + cfg.tiempoEntrega : "") + "\n\n¡Gracias por tu compra! 🙌")], null), { pedidoId: p.id });
      }
      if (id === "cambiar"){ return fin([botones("Ok, empecemos de nuevo 🙂 ¿Qué quieres pedir?", [["menu", "📋 Ver menú"], ["humano", "🙋 Hablar con alguien"]])], { paso: "pedido", carrito: [], preguntas: [] }); }
      const r = await armarResumen(db, storeId, cfg, conv, nombre);
      return fin([txt("Toca *Confirmar* para enviar tu pedido, o *Empezar de nuevo* para cambiarlo."), r.msg || txt("⚠️ " + (r.error || ""))], conv);
    }
  }
  return fin([botones(saludo, [["menu", "📋 Ver menú"], ["humano", "🙋 Hablar con alguien"]])], { paso: "pedido", carrito: [], preguntas: [] });
}
async function localesDe(db, storeId){
  try {
    const q = await db.collection("tiendas/" + storeId + "/locales").get();
    return q.docs.map(d => Object.assign({ id: d.id }, d.data() || {})).filter(l => l.nombre && l.abierto !== false)
      .map(l => ({ id: l.id, nombre: String(l.nombre), direccion: String(l.direccion || "") }));
  } catch(e){ return []; }
}
async function resumenOSinCobertura(db, storeId, cfg, conv, nombre){
  const r = await armarResumen(db, storeId, cfg, conv, nombre);
  if (r.sinCobertura){ conv.paso = "entrega"; return [botones("😕 Por ahora no llegamos a " + (conv.comuna || "esa dirección") + ". ¿Prefieres retirarlo en el local?", [["retiro", "🏪 Retiro en local"], ["cancelar", "❌ Cancelar"]])]; }
  if (r.error) return [txt("⚠️ " + r.error)];
  return [r.msg];
}
