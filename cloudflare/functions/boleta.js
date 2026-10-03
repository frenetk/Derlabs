/* cloudflare/functions/boleta.js
   BOLETA ELECTRÓNICA de la caja local, con OpenFactura (Haulmer).

   Cómo funciona:
   · El dueño pega la llave (API Key) de su OpenFactura en la caja. Con esa
     llave se leen solos sus datos tributarios (RUT, razón social, giro,
     dirección). Todo queda en tiendas/{s}/config/privado.boleta, que solo
     lee el dueño. La llave nunca vuelve al navegador.
   · Al registrar un pago en la caja se emite una boleta (tipo 39) por lo
     vendido en ese pago, sin la propina. Si OpenFactura no responde, la
     venta NO se detiene: la boleta queda pendiente y se reintenta sola
     (cron cada 5 minutos) con la misma llave de idempotencia, así nunca se
     emite dos veces.
   · Cada boleta vive en tiendas/{s}/boletas/{id}; el pedido guarda un
     resumen en pedido.boletas[pagoId]. Las pendientes se anotan además en
     boletas_pendientes/{tienda__boleta} para que el cron las encuentre sin
     recorrer todas las tiendas.

   Para cambiar de proveedor (por ejemplo a SimpleAPI) solo se reemplaza la
   sección "Proveedor": conectar(), enviar(), buscarPorToken() y pdfDe().
   El resto del archivo no sabe con quién habla. */

/* ───────────── Proveedor: OpenFactura ───────────── */
const BASES = { produccion: "https://api.haulmer.com/v2/dte", pruebas: "https://dev-api.haulmer.com/v2/dte" };
/* Llave pública de la empresa de prueba de OpenFactura (está en su documentación).
   Sus boletas usan folios simulados y no tienen validez. */
const LLAVE_DEMO = "928e15a2d14d4a6292345f04960f4bd3";
const TASA_IVA = 0.19;
const HORAS_REINTENTO = 20;      /* la idempotencia de OpenFactura dura 24 horas */
const LARGOS = { RznSocEmisor: 100, GiroEmisor: 80, DirOrigen: 70, CmnaOrigen: 20, NmbItem: 80 };

export class ErrorBoleta extends Error {
  /* definitivo: OpenFactura rechazó el documento (reintentar igual no sirve)
     llave: la llave no vale · token: ya se había emitido (idempotencia) */
  constructor(mensaje, o){ super(mensaje); Object.assign(this, { definitivo: false, llave: false, token: null, codigo: "" }, o || {}); }
}

const corto = (v, n) => String(v == null ? "" : v).replace(/\s{2,}/g, " ").trim().slice(0, n).trim();

async function llamar(ambiente, llave, metodo, ruta, cuerpo, idem, esperaMs){
  const control = new AbortController();
  let vencido = false;
  const reloj = setTimeout(() => { vencido = true; control.abort(); }, esperaMs || 12000);
  const cab = { apikey: llave, Accept: "application/json" };
  if (cuerpo !== undefined) cab["Content-Type"] = "application/json";
  if (idem) cab["Idempotency-Key"] = idem;
  let r, texto;
  try {
    r = await fetch((BASES[ambiente] || BASES.produccion) + ruta, { method: metodo, headers: cab, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo), signal: control.signal });
    texto = await r.text();
  } catch(e){
    throw new ErrorBoleta(vencido ? "OpenFactura no respondió a tiempo" : "No se pudo conectar con OpenFactura", { codigo: vencido ? "TIEMPO" : "RED" });
  } finally { clearTimeout(reloj); }
  let d = null; try { d = texto ? JSON.parse(texto) : null; } catch(e){ d = null; }
  if (r.ok) return d;
  const er = d && d.error && typeof d.error === "object" ? d.error : (d || {});
  const codigo = typeof er.code === "string" ? er.code : "HTTP_" + r.status;
  let msj = typeof er.message === "string" ? er.message : (d && typeof d.error === "string" ? d.error : "Error " + r.status);
  const det = Array.isArray(er.details) ? er.details : [];
  if (det.length) msj += ": " + det.slice(0, 4).map(x => (x && x.field ? x.field + " " : "") + (x && x.issue ? x.issue : "")).join("; ");
  if (llave) msj = msj.split(llave).join("***");
  if (r.status === 401 || r.status === 403) throw new ErrorBoleta("OpenFactura no aceptó la llave. Revisa que sea la de tu empresa.", { definitivo: true, llave: true, codigo: "LLAVE" });
  if (codigo === "OF-06"){
    const t = er.token || (det.find(x => x && x.field === "token") || {}).issue || null;
    throw new ErrorBoleta("Esta boleta ya se había enviado", { definitivo: true, token: t ? String(t) : null, codigo });
  }
  if (r.status === 429) throw new ErrorBoleta("OpenFactura está recibiendo muchas solicitudes", { codigo: "LIMITE" });
  if (r.status >= 500 && !/^OF-/.test(codigo)) throw new ErrorBoleta("OpenFactura no está disponible en este momento", { codigo });
  /* Rechazos del documento o de la cuenta: repetir lo mismo no cambia nada */
  const fijo = r.status >= 400 && r.status < 500 && r.status !== 429 && r.status !== 408 && ["OF-13", "OF-21", "OF-22"].indexOf(codigo) < 0;
  throw new ErrorBoleta(corto(msj, 300), { definitivo: fijo, codigo });
}

/* Datos del emisor tal como los pide una boleta, desde la ficha de la empresa */
function emisorDe(org){
  const acts = Array.isArray(org.actividades) ? org.actividades.filter(a => a && a.giro) : [];
  const giro = corto(org.glosaDescriptiva, LARGOS.GiroEmisor) || corto((acts.find(a => a.actividadPrincipal) || acts[0] || {}).giro, LARGOS.GiroEmisor);
  /* siempre las seis claves (la sucursal puede ir vacía): así guardar mezclando no deja restos de otra empresa */
  const e = { RUTEmisor: corto(org.rut, 12), RznSocEmisor: corto(org.razonSocial, LARGOS.RznSocEmisor), GiroEmisor: giro, CdgSIISucur: corto(org.cdgSIISucur, 12),
              DirOrigen: corto(org.direccion, LARGOS.DirOrigen), CmnaOrigen: corto(org.comuna, LARGOS.CmnaOrigen) };
  const faltan = [["RUTEmisor", "RUT"], ["RznSocEmisor", "razón social"], ["GiroEmisor", "giro"], ["DirOrigen", "dirección"], ["CmnaOrigen", "comuna"]].filter(x => !e[x[0]]).map(x => x[1]);
  if (faltan.length) throw new ErrorBoleta("A tu empresa en OpenFactura le falta: " + faltan.join(", ") + ". Complétalo allá y vuelve a conectar.", { definitivo: true, codigo: "FICHA" });
  return e;
}

/* Prueba la llave (primero en producción, después en el ambiente de pruebas) y trae los datos de la empresa */
export async function conectar(llave){
  llave = String(llave || "").trim();
  if (!/^[A-Za-z0-9]{16,80}$/.test(llave)) throw new ErrorBoleta("Esa no parece una llave de OpenFactura. Cópiala completa, sin espacios.", { definitivo: true, llave: true, codigo: "LLAVE" });
  let ambiente = null, org = null, ultimo = null;
  for (const amb of ["produccion", "pruebas"]){
    try { org = await llamar(amb, llave, "GET", "/organization", undefined, null, 10000); ambiente = amb; break; }
    catch(e){ ultimo = e; if (!e.llave) throw e; }
  }
  if (!org || typeof org !== "object") throw ultimo || new ErrorBoleta("OpenFactura no devolvió los datos de la empresa");
  const emisor = emisorDe(org);
  let folios = null, vence = null;
  try {
    const d = await llamar(ambiente, llave, "GET", "/organization/document", undefined, null, 8000);
    const b = ((d && d.documentos) || []).find(x => Number(x.dte) === 39);
    if (b){ folios = Number(b.disponibles != null ? b.disponibles : b.disponible); if (!isFinite(folios)) folios = null; vence = b.vencimiento || null; }
    else if (d && Array.isArray(d.documentos)) folios = 0;
  } catch(e){ /* no impide conectar */ }
  const ro = org.resolucion && typeof org.resolucion === "object" ? org.resolucion : {};
  const res = { fecha: String(ro.fecha || ""), numero: String(ro.numero == null ? "" : ro.numero) };
  return { ambiente, emisor, resolucion: res, folios, vence };
}

async function enviar(cfgB, dte, idem, esperaMs){
  const r = await llamar(cfgB.ambiente, cfgB.llave, "POST", "/document", { response: ["FOLIO", "TIMBRE", "RESOLUCION", "80MM"], dte }, idem, esperaMs);
  if (!r || typeof r !== "object" || typeof r.TOKEN !== "string") throw new ErrorBoleta("OpenFactura respondió algo inesperado", { codigo: "RESPUESTA" });
  const res = r.RESOLUCION && typeof r.RESOLUCION === "object" ? { fecha: String(r.RESOLUCION.fecha || ""), numero: String(r.RESOLUCION.numero == null ? "" : r.RESOLUCION.numero) } : null;
  return { token: r.TOKEN, folio: Number(r.FOLIO) || null, timbre: typeof r.TIMBRE === "string" && r.TIMBRE.length < 400000 ? r.TIMBRE : null, resolucion: res, aviso: r.WARNING ? corto(typeof r.WARNING === "string" ? r.WARNING : JSON.stringify(r.WARNING), 200) : "" };
}
/* Una boleta que ya estaba emitida (idempotencia): se recupera su folio */
async function buscarPorToken(cfgB, token){
  const r = await llamar(cfgB.ambiente, cfgB.llave, "GET", "/document/" + encodeURIComponent(token) + "/json", undefined, null, 10000);
  const id = r && r.json && r.json.Encabezado && r.json.Encabezado.IdDoc;
  return { token, folio: id ? Number(id.Folio) || null : null, timbre: null, resolucion: null, aviso: "" };
}
export async function pdfDe(cfgB, token){
  const r = await llamar(cfgB.ambiente, cfgB.llave, "GET", "/document/" + encodeURIComponent(token) + "/pdf", undefined, null, 20000);
  if (!r || typeof r.pdf !== "string") throw new ErrorBoleta("OpenFactura no entregó el PDF");
  return r.pdf;
}

/* ───────────── Documento ───────────── */
/* Boleta afecta: los precios ya incluyen IVA; el neto se calcula hacia atrás */
export function totalesDe(total){
  const neto = Math.round(total / (1 + TASA_IVA));
  return { MntNeto: neto, IVA: total - neto, MntTotal: total, TotalPeriodo: total, VlrPagar: total };
}
/* lineas: [{ nombre, cantidad, precio }] — deben sumar exactamente `total` */
export function armarDte(emisor, dia, total, lineas){
  const em = {};
  ["RUTEmisor", "RznSocEmisor", "GiroEmisor", "CdgSIISucur", "DirOrigen", "CmnaOrigen"].forEach(k => { if (emisor[k]) em[k] = emisor[k]; });
  return {
    Encabezado: { IdDoc: { TipoDTE: 39, Folio: 0, FchEmis: dia, IndServicio: 3 }, Emisor: em, Receptor: { RUTRecep: "66666666-6" }, Totales: totalesDe(total) },
    Detalle: lineas.map((l, i) => ({ NroLinDet: i + 1, NmbItem: corto(String(l.nombre).replace(/[‒–—―−]/g, "-"), LARGOS.NmbItem) || "Consumo", QtyItem: l.cantidad, PrcItem: l.precio, MontoItem: l.cantidad * l.precio }))
  };
}
/* Qué se vende en este pago. Si el pago cubre la cuenta entera y no hay descuento,
   la boleta lista los productos; si es una parte (cuenta dividida) o hay descuento,
   lleva una sola línea de consumo por el monto pagado. */
export function lineasDe(p, monto, unico){
  const its = (p.items || []).filter(i => !i.anulado && i.precio > 0);
  const suma = its.reduce((t, i) => t + i.precio * i.cantidad, 0);
  if (unico && !(p.descuentoLocal > 0) && its.length && its.length <= 200 && suma === monto)
    return its.map(i => ({ nombre: i.nombre || "Producto", cantidad: i.cantidad, precio: i.precio }));
  return [{ nombre: "Consumo en el local", cantidad: 1, precio: monto }];
}
/* Cuánto de un pago es venta (sin propina). El último pago cuadra la cuenta al peso.
   La propina puede venir en el propio pago (cobro por comensal) o estar puesta en la cuenta
   sin dueño: esa se reparte en proporción entre los pagos que no traen la suya. */
export function ventaDelPago(p, pago, pagosPrevios, completo, propinaCuenta){
  const venta = Math.max(0, (p.subtotal || 0) - (p.descuentoLocal || 0));
  const ya = pagosPrevios.reduce((t, x) => t + (x.venta != null ? Number(x.venta) || 0 : Math.max(0, (Number(x.monto) || 0) - (Number(x.propina) || 0))), 0);
  const queda = Math.max(0, venta - ya);
  if (completo) return queda;
  const propPagada = pagosPrevios.reduce((t, x) => t + Math.max(0, (Number(x.monto) || 0) - (x.venta != null ? Number(x.venta) || 0 : (Number(x.monto) || 0) - (Number(x.propina) || 0))), 0);
  const libre = Math.max(0, (propinaCuenta || 0) - propPagada - (pago.propina || 0));
  let v;
  if (pago.propina) v = pago.monto - pago.propina;
  else v = libre > 0 && queda + libre > 0 ? Math.round(pago.monto * queda / (queda + libre)) : pago.monto;
  return Math.max(0, Math.min(queda, v));
}

/* ───────────── Configuración de la tienda ───────────── */
export async function cfgBoleta(db, storeId){
  const d = await db.doc("tiendas/" + storeId + "/config/privado").get();
  const b = d.exists && d.data().boleta && typeof d.data().boleta === "object" ? d.data().boleta : null;
  return b && b.llave && b.emisor ? b : null;
}
/* Lo que puede ver la caja (sin la llave) */
export function vistaCfg(b){
  if (!b) return { conectado: false, activo: false };
  const e = b.emisor || {};
  return { conectado: true, activo: b.activo === true, ambiente: b.ambiente || "produccion", tarjeta: b.tarjeta === true,
           rut: e.RUTEmisor || "", razonSocial: e.RznSocEmisor || "", giro: e.GiroEmisor || "", direccion: [e.DirOrigen, e.CmnaOrigen].filter(Boolean).join(", "),
           folios: b.folios == null ? null : b.folios, vence: b.vence || null, llave: "····" + String(b.llave).slice(-4), conectadoEn: b.conectadoEn || "" };
}
/* Se guarda mezclando, para no pisar las otras llaves del documento (Mercado Pago, Flow, correo).
   Firestore mezcla los mapas por dentro: por eso `b` trae siempre todas sus claves. null = desconectar. */
export async function guardarCfg(db, storeId, b){
  await db.doc("tiendas/" + storeId + "/config/privado").set({ boleta: b || null }, { merge: true });
}
export async function conectarTienda(db, storeId, llave, demo, ahora){
  const c = await conectar(demo ? LLAVE_DEMO : llave);
  if (demo) c.ambiente = "pruebas";
  const previo = await cfgBoleta(db, storeId);
  const b = { llave: demo ? LLAVE_DEMO : String(llave).trim(), ambiente: c.ambiente, emisor: c.emisor, resolucion: c.resolucion, folios: c.folios, vence: c.vence,
              activo: true, tarjeta: previo ? previo.tarjeta === true : false, conectadoEn: ahora };
  if (b.folios === undefined) b.folios = null; if (b.vence === undefined) b.vence = null;
  await guardarCfg(db, storeId, b);
  return b;
}
/* ¿Este medio de pago lleva boleta? Con tarjeta, por defecto no: el comprobante de la máquina ya vale como boleta */
export const llevaBoleta = (b, metodo) => !!b && b.activo === true && (metodo !== "tarjeta" || b.tarjeta === true);

/* ───────────── Emisión ───────────── */
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
const refBoleta = (db, storeId, id) => db.doc("tiendas/" + storeId + "/boletas/" + id);
const refCola = (db, storeId, id) => db.doc("boletas_pendientes/" + storeId + "__" + id);

/* Lo que ve la caja de una boleta. Con `completa` trae el timbre y el detalle para imprimirla. */
export function vistaBoleta(b, completa){
  const v = { id: b.id, pedidoId: b.pedidoId, pedidoNum: b.pedidoNum || "", pagoId: b.pagoId, lugar: b.lugar || "", metodo: b.metodo || "", total: b.total || 0,
              iva: b.iva || 0, fecha: b.fecha || "", estado: b.estado, folio: b.folio || null, ambiente: b.ambiente || "produccion", error: b.estado === "emitida" ? "" : (b.ultimoError || ""),
              tienePdf: !!b.token, turnoId: b.turnoId || "" };
  if (completa){
    v.timbre = b.timbre || null; v.resolucion = b.resolucion || null; v.emisor = (b.dte && b.dte.Encabezado && b.dte.Encabezado.Emisor) || {};
    v.lineas = ((b.dte && b.dte.Detalle) || []).map(l => ({ nombre: l.NmbItem, cantidad: l.QtyItem, precio: l.PrcItem, monto: l.MontoItem }));
  }
  return v;
}
async function anotarEnPedido(db, storeId, b){
  try {
    const ref = db.doc("tiendas/" + storeId + "/pedidos/" + b.pedidoId);
    const d = await ref.get(); if (!d.exists) return;
    const mapa = Object.assign({}, d.data().boletas || {});
    mapa[b.pagoId] = { id: b.id, estado: b.estado, folio: b.folio || null, total: b.total };
    await ref.set({ boletas: mapa }, { merge: true });
  } catch(e){ console.warn("boleta→pedido:", e.message); }
}

/* Crea la boleta de un pago y la intenta emitir de inmediato. Nunca lanza: si falla, queda pendiente. */
export async function boletaDelPago(db, storeId, cfgB, o){
  /* o: { pedidoId, p (el pedido con el pago ya aplicado), pago, monto, unico, lugar, turnoId, quien, ahora } */
  try {
    const id = (o.pedidoId + "_" + o.pago.id).replace(/[^A-Za-z0-9_-]/g, "");
    const dia = fmtDia.format(new Date(o.ahora));
    const dte = armarDte(cfgB.emisor, dia, o.monto, lineasDe(o.p, o.monto, o.unico));
    const t = dte.Encabezado.Totales;
    const b = { id, pedidoId: o.pedidoId, pedidoNum: o.p.id || o.pedidoId, pagoId: o.pago.id, lugar: o.lugar || "", metodo: o.pago.metodo, total: o.monto, neto: t.MntNeto, iva: t.IVA,
                fecha: o.ahora, dia, turnoId: o.turnoId || "", creadoPor: o.quien || "", ambiente: cfgB.ambiente || "produccion", estado: "pendiente", intentos: 0, ultimoError: "",
                folio: null, token: null, timbre: null, resolucion: cfgB.resolucion || null, idem: storeId + "-" + id, dte };
    await refBoleta(db, storeId, id).set(b);
    await refCola(db, storeId, id).set({ storeId, boletaId: id, creado: o.ahora });
    return await procesar(db, storeId, cfgB, b, 12000);
  } catch(e){
    console.error("boleta:", e.message);
    return { id: "", estado: "pendiente", error: e.message, total: o.monto };
  }
}

/* Un intento de emisión. Deja la boleta en emitida / pendiente / error y devuelve su vista completa. */
async function procesar(db, storeId, cfgB, b, esperaMs){
  const ahora = new Date().toISOString();
  b.intentos = (b.intentos || 0) + 1;
  try {
    let r;
    try { r = await enviar(cfgB, b.dte, b.idem, esperaMs); }
    catch(e){ if (e.token) r = await buscarPorToken(cfgB, e.token); else throw e; }
    Object.assign(b, { estado: "emitida", folio: r.folio, token: r.token, timbre: r.timbre, emitidaEn: ahora, ultimoError: r.aviso || "" });
    if (r.resolucion) b.resolucion = r.resolucion;
  } catch(e){
    const viejo = Date.now() - Date.parse(b.fecha) > HORAS_REINTENTO * 3600 * 1000;
    b.ultimoError = corto(e.message, 300) || "No se pudo emitir";
    /* rechazo: no se vuelve a intentar solo. Sin respuesta: se reintenta mientras la idempotencia siga vigente */
    b.estado = e.definitivo || viejo ? "error" : "pendiente";
    /* rechazada = nunca se emitió (se puede mandar de nuevo como documento nuevo). OF-06 sin token no cuenta: sí existe. */
    b.rechazada = !!e.definitivo && e.codigo !== "OF-06";
    if (viejo && !e.definitivo) b.ultimoError = "No se pudo emitir en " + HORAS_REINTENTO + " horas. Antes de reintentar, revisa en OpenFactura que no exista.";
  }
  await refBoleta(db, storeId, b.id).set(b);
  if (b.estado !== "pendiente") await refCola(db, storeId, b.id).delete().catch(() => {});
  await anotarEnPedido(db, storeId, b);
  return vistaBoleta(b, true);
}

/* Reintento a mano desde la caja */
export async function reintentar(db, storeId, cfgB, boletaId){
  const d = await refBoleta(db, storeId, boletaId).get();
  if (!d.exists) throw Object.assign(new Error("Boleta no encontrada"), { st: 404 });
  const b = d.data();
  if (b.estado === "emitida") return vistaBoleta(b, true);
  /* Si OpenFactura la rechazó, nunca se emitió: se manda como documento nuevo, con los datos del emisor de ahora */
  if (b.rechazada){
    b.vuelta = (b.vuelta || 1) + 1; b.idem = storeId + "-" + b.id + "-v" + b.vuelta;
    b.dte.Encabezado.Emisor = armarDte(cfgB.emisor, b.dia, b.total, []).Encabezado.Emisor;
    b.ambiente = cfgB.ambiente || "produccion";
  }
  b.estado = "pendiente";
  return await procesar(db, storeId, cfgB, b, 15000);
}

/* Cron: reintenta las boletas pendientes de todas las tiendas */
export async function reintentarBoletas(env, getDb){
  const db = getDb(env);
  let cola;
  try { cola = (await db.collection("boletas_pendientes").limit(30).get()).docs; } catch(e){ console.warn("boletas pendientes:", e.message); return { vistas: 0 }; }
  const cfgs = {};
  let emitidas = 0;
  for (const c of cola){
    const x = c.data() || {};
    try {
      const quitar = () => db.doc("boletas_pendientes/" + c.id).delete();
      if (!x.storeId || !x.boletaId){ await quitar(); continue; }
      if (!(x.storeId in cfgs)) cfgs[x.storeId] = await cfgBoleta(db, x.storeId);
      const d = await refBoleta(db, x.storeId, x.boletaId).get();
      if (!d.exists || d.data().estado !== "pendiente"){ await quitar(); continue; }
      if (!cfgs[x.storeId]) continue;   /* el negocio desconectó OpenFactura: quedan a la espera */
      const v = await procesar(db, x.storeId, cfgs[x.storeId], d.data(), 15000);
      if (v.estado === "emitida") emitidas++;
      await new Promise(ok => setTimeout(ok, 400));   /* OpenFactura acepta 3 llamadas por segundo */
    } catch(e){ console.warn("boleta pendiente", x.boletaId, e.message); }
  }
  return { vistas: cola.length, emitidas };
}
