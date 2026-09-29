/* cloudflare/functions/cajaLocal.js
   CAJA LOCAL (plantilla de comida): mesas, para llevar, cobro y turnos de caja.
   Solo funciona en tiendas con config/general.cajaLocal === true (lo activa
   DerLabs al generar la tienda). Lo usa /caja con la sesión del dueño o de
   quien tenga rol en la tienda.

   Los pedidos del local se guardan en tiendas/{s}/pedidos como cualquier
   pedido (canal:"local"), así aparecen en el gestor, finanzas y stock.
   Los turnos de caja viven en tiendas/{s}/caja_turnos. Todo pasa por aquí
   (cuenta de servicio): no hace falta tocar las reglas de Firestore. */
import { getDb, corsHeaders, admin, uidDesdeToken } from "./_firebase.js";

const hdr = () => Object.assign({}, corsHeaders(), { "Cache-Control": "no-store" });
const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: hdr() });
const limpio = (s, n) => String(s == null ? "" : s).trim().slice(0, n || 80);
const idOk = s => String(s || "").replace(/[^A-Za-z0-9_-]/g, "");
const num = v => { const n = Math.round(Number(v)); return isFinite(n) ? n : 0; };
const METODOS = ["efectivo", "tarjeta", "transferencia"];
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
const diaChile = iso => fmtDia.format(iso ? new Date(iso) : new Date());

function token(){ const b = crypto.getRandomValues(new Uint8Array(18)); return Array.from(b, x => ("0" + x.toString(16)).slice(-2)).join(""); }
function idPedido(){ const b = crypto.getRandomValues(new Uint8Array(2)); return "L" + Date.now().toString().slice(-6) + (b[0] % 10); }

/* Precios SIEMPRE desde Firestore, nunca desde el navegador */
async function validarItems(db, storeId, items, ronda, ahora){
  if (!Array.isArray(items) || !items.length) throw new Error("Agrega al menos un producto");
  if (items.length > 60) throw new Error("Demasiados productos en un solo envío");
  const out = [];
  for (const it of items){
    const pid = idOk(it.id);
    const cant = Math.min(99, Math.max(1, num(it.cantidad) || 1));
    const d = await db.doc("tiendas/" + storeId + "/productos/" + pid).get();
    if (!d.exists) throw new Error("Un producto ya no existe, recarga la caja");
    const p = d.data();
    if (p.disponible === false || p.activo === false) throw new Error("«" + (p.nombre || pid) + "» no está disponible");
    let variantes = null;
    if (it.variantes && typeof it.variantes === "object" && p.variantesActivas && Array.isArray(p.variantes)){
      variantes = {};
      p.variantes.forEach(function(g){
        const v = it.variantes[g.nombre];
        if (v != null && (g.opciones || []).indexOf(v) >= 0) variantes[g.nombre] = v;
      });
      if (!Object.keys(variantes).length) variantes = null;
    }
    out.push({ id: pid, nombre: p.nombre || "Producto", precio: Math.max(0, num(p.precio)), cantidad: cant,
               variantes, notaPersonal: limpio(it.nota || it.notaPersonal, 140) || null, ronda, enviadoEn: ahora });
  }
  return out;
}
async function moverStock(db, storeId, items, signo){
  for (const it of items){
    try {
      const ref = db.doc("tiendas/" + storeId + "/productos/" + it.id);
      const d = await ref.get(); if (!d.exists) continue;
      const st = d.data().stock;
      if (st === null || st === undefined || st === "") continue;
      await ref.set({ stock: Math.max(0, (Number(st) || 0) + signo * (Number(it.cantidad) || 1)) }, { merge: true });
    } catch(e){ console.warn("stock", it.id, e.message); }
  }
}
const subtotalDe = items => items.filter(i => !i.anulado).reduce((t, i) => t + i.precio * i.cantidad, 0);
const pagadoDe = p => (p.pagos || []).reduce((t, x) => t + (Number(x.monto) || 0), 0);
function totalAPagar(p){ return Math.max(0, (p.subtotal || 0) - (p.descuentoLocal || 0) + (p.propina || 0)); }

async function turnoAbierto(db, storeId){
  const s = await db.collection("tiendas/" + storeId + "/caja_turnos").where("estado", "==", "abierto").limit(1).get();
  return s.empty ? null : { ref: s.docs[0].ref, id: s.docs[0].id, t: s.docs[0].data() };
}

/* Resumen de un turno a partir de sus pedidos cobrados */
async function resumenTurno(db, storeId, turnoId, t){
  const s = await db.collection("tiendas/" + storeId + "/pedidos").where("turnoId", "==", turnoId).get();
  const r = { pedidos: 0, ventas: 0, propinas: 0, descuentos: 0, porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0 },
              porCanal: { mesa: 0, llevar: 0 }, anulados: 0, top: {} };
  s.docs.forEach(function(d){
    const p = d.data();
    if (p.estado === "cancelado"){ r.anulados++; return; }
    if (!p.pagado) return;
    r.pedidos++;
    r.ventas += (p.subtotal || 0) - (p.descuentoLocal || 0);
    r.propinas += p.propina || 0;
    r.descuentos += p.descuentoLocal || 0;
    (p.pagos || []).forEach(function(x){ if (r.porMetodo[x.metodo] != null) r.porMetodo[x.metodo] += Number(x.monto) || 0; });
    r.porCanal[p.mesa ? "mesa" : "llevar"]++;
    (p.items || []).forEach(function(i){ if (!i.anulado){ r.top[i.nombre] = (r.top[i.nombre] || 0) + (i.cantidad || 1); } });
  });
  /* El efectivo cobrado incluye el vuelto entregado: se guarda solo lo que quedó en caja */
  const movs = (t.movimientos || []);
  const ingresos = movs.filter(m => m.tipo === "ingreso").reduce((a, m) => a + (m.monto || 0), 0);
  const retiros = movs.filter(m => m.tipo === "retiro").reduce((a, m) => a + (m.monto || 0), 0);
  r.ticketPromedio = r.pedidos ? Math.round(r.ventas / r.pedidos) : 0;
  r.top = Object.keys(r.top).map(k => ({ nombre: k, cantidad: r.top[k] })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
  r.esperado = { efectivo: (t.montoInicial || 0) + r.porMetodo.efectivo + ingresos - retiros, tarjeta: r.porMetodo.tarjeta, transferencia: r.porMetodo.transferencia };
  r.ingresos = ingresos; r.retiros = retiros;
  return r;
}

export async function cajaLocal(request, env){
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: hdr() });
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405);
  let b = {}; try { b = JSON.parse(await request.text() || "{}"); } catch(e){}
  const storeId = idOk(b.storeId);
  if (!storeId) return json({ ok: false, error: "Falta la tienda" }, 400);
  try {
    const db = getDb(env);
    const uid = await uidDesdeToken(request, env);
    if (!uid) return json({ ok: false, error: "Sesión vencida — vuelve a entrar" }, 401);
    const u = await db.doc("usuarios/" + uid).get();
    const rol = u.exists && u.data().roles ? u.data().roles[storeId] : null;
    if (!rol || rol === "repartidor") return json({ ok: false, error: "Sin permiso en esta tienda" }, 403);
    const cfgD = await db.doc("tiendas/" + storeId + "/config/general").get();
    const cfg = cfgD.exists ? cfgD.data() : {};
    if (cfg.cajaLocal !== true) return json({ ok: false, error: "Esta tienda no tiene el sistema Caja local activado" }, 403);
    const quien = (u.data().nombre || u.data().email || "") || uid;
    const ahora = new Date().toISOString();
    const col = "tiendas/" + storeId + "/pedidos";
    const pedidoRef = id => db.doc(col + "/" + idOk(id));
    async function pedidoLocal(id){
      const d = await pedidoRef(id).get();
      if (!d.exists) throw Object.assign(new Error("Pedido no encontrado"), { st: 404 });
      return { ref: d.ref || pedidoRef(id), p: d.data() };
    }

    switch (b.accion){
      case "estado": {
        const t = await turnoAbierto(db, storeId);
        return json({ ok: true, rol, turno: t ? Object.assign({ id: t.id }, t.t) : null,
                      resumen: t ? await resumenTurno(db, storeId, t.id, t.t) : null, mesas: cfg.cajaMesas || null });
      }
      case "guardarMesas": {
        if (rol !== "propietario") return json({ ok: false, error: "Solo el propietario puede cambiar las mesas" }, 403);
        const mesas = (Array.isArray(b.mesas) ? b.mesas : []).slice(0, 150).map(function(m, i){
          return { id: idOk(m.id) || ("m" + (i + 1)), nombre: limpio(m.nombre, 24) || ("Mesa " + (i + 1)), zona: limpio(m.zona, 24) || "Salón" };
        });
        await db.doc("tiendas/" + storeId + "/config/general").set({ cajaMesas: mesas }, { merge: true });
        return json({ ok: true, mesas });
      }
      case "abrirTurno": {
        if (await turnoAbierto(db, storeId)) return json({ ok: false, error: "Ya hay un turno abierto" }, 409);
        const t = { estado: "abierto", abiertoEn: ahora, abiertoPor: quien, dia: diaChile(ahora), montoInicial: Math.max(0, num(b.montoInicial)), movimientos: [] };
        const ref = await db.collection("tiendas/" + storeId + "/caja_turnos").add(t);
        return json({ ok: true, turno: Object.assign({ id: ref.id }, t) });
      }
      case "movimiento": {
        const t = await turnoAbierto(db, storeId);
        if (!t) return json({ ok: false, error: "Abre un turno primero" }, 409);
        const monto = Math.abs(num(b.monto));
        if (!monto || (b.tipo !== "ingreso" && b.tipo !== "retiro")) return json({ ok: false, error: "Movimiento inválido" }, 400);
        const movs = (t.t.movimientos || []).concat([{ tipo: b.tipo, monto, nota: limpio(b.nota, 100), fecha: ahora, por: quien }]);
        await t.ref.set({ movimientos: movs }, { merge: true });
        return json({ ok: true });
      }
      case "crearPedido": {
        const esMesa = !!b.mesaId;
        if (esMesa){
          const abiertos = await db.collection(col).where("mesa.id", "==", idOk(b.mesaId)).get();
          if (abiertos.docs.some(d => { const x = d.data(); return x.canal === "local" && !x.cerrado && x.estado !== "cancelado"; }))
            return json({ ok: false, error: "Esa mesa ya tiene una cuenta abierta — recarga la caja" }, 409);
        }
        const items = await validarItems(db, storeId, b.items, 1, ahora);
        const id = idPedido();
        const mesaNombre = limpio(b.mesaNombre, 24) || "Mesa";
        const nombre = esMesa ? mesaNombre : (limpio(b.clienteNombre, 40) || "Para llevar");
        const t = await turnoAbierto(db, storeId);
        const sub = subtotalDe(items);
        const ped = {
          id, storeId, canal: "local", tipo: "retiro", metodoPago: "pendiente",
          mesa: esMesa ? { id: idOk(b.mesaId), nombre: mesaNombre, zona: limpio(b.zona, 24) } : null,
          cliente: { nombre: esMesa ? "🍽️ " + nombre : "🥡 " + nombre, telefono: limpio(b.telefono, 20), email: "", local: esMesa ? "En el local" : "Para llevar", tipo: "retiro", notas: limpio(b.nota, 140) },
          items, subtotal: sub, descuento: 0, descuentoLocal: 0, propina: 0, costoDelivery: 0, total: sub,
          pagos: [], pagado: false, cerrado: false, rondas: 1, seguimiento: token(), uid: null,
          estado: "preparacion", fecha: ahora, turnoId: t ? t.id : null, creadoPor: quien,
          estadoTimeline: { nuevo: ahora, preparacion: ahora, camino: null, listo: null }
        };
        await pedidoRef(id).set(ped);
        await moverStock(db, storeId, items, -1);
        return json({ ok: true, pedido: ped });
      }
      case "agregarItems": {
        const a = await pedidoLocal(b.pedidoId);
        if (a.p.canal !== "local" || a.p.cerrado) return json({ ok: false, error: "Esa cuenta ya está cerrada" }, 409);
        const ronda = (a.p.rondas || 1) + 1;
        const nuevos = await validarItems(db, storeId, b.items, ronda, ahora);
        const items = (a.p.items || []).concat(nuevos);
        const sub = subtotalDe(items);
        await a.ref.set({ items, rondas: ronda, subtotal: sub, total: Math.max(0, sub - (a.p.descuentoLocal || 0)),
                          estado: "preparacion", estadoTimeline: Object.assign({}, a.p.estadoTimeline || {}, { preparacion: ahora, listo: null }) }, { merge: true });
        await moverStock(db, storeId, nuevos, -1);
        return json({ ok: true, ronda });
      }
      case "anularItem": {
        const a = await pedidoLocal(b.pedidoId);
        if (a.p.canal !== "local" || a.p.cerrado) return json({ ok: false, error: "Esa cuenta ya está cerrada" }, 409);
        const items = (a.p.items || []).slice(); const i = num(b.idx);
        if (!items[i] || items[i].anulado) return json({ ok: false, error: "Producto no encontrado" }, 404);
        items[i] = Object.assign({}, items[i], { anulado: true, anuladoEn: ahora, anuladoPor: quien, motivo: limpio(b.motivo, 80) });
        const sub = subtotalDe(items);
        if (pagadoDe(a.p) > sub) return json({ ok: false, error: "Ya se pagó más que el nuevo total" }, 409);
        await a.ref.set({ items, subtotal: sub, total: Math.max(0, sub - (a.p.descuentoLocal || 0)) }, { merge: true });
        await moverStock(db, storeId, [items[i]], +1);
        return json({ ok: true });
      }
      case "ajustes": {  /* descuento y propina de la cuenta */
        const a = await pedidoLocal(b.pedidoId);
        if (a.p.canal !== "local" || a.p.cerrado) return json({ ok: false, error: "Esa cuenta ya está cerrada" }, 409);
        const sub = a.p.subtotal || 0;
        const desc = Math.min(sub, Math.max(0, num(b.descuento)));
        const prop = Math.max(0, Math.min(Math.round(sub * 0.5), num(b.propina)));
        await a.ref.set({ descuentoLocal: desc, propina: prop, total: Math.max(0, sub - desc) }, { merge: true });
        return json({ ok: true });
      }
      case "pagar": {  /* registra un pago (sirve para dividir la cuenta); al completar, cierra */
        const t = await turnoAbierto(db, storeId);
        if (!t) return json({ ok: false, error: "Abre el turno de caja para cobrar" }, 409);
        const a = await pedidoLocal(b.pedidoId);
        if (a.p.canal !== "local" || a.p.cerrado || a.p.pagado) return json({ ok: false, error: "Esa cuenta ya está pagada" }, 409);
        const metodo = METODOS.indexOf(b.metodo) >= 0 ? b.metodo : null;
        if (!metodo) return json({ ok: false, error: "Elige cómo paga" }, 400);
        const falta = totalAPagar(a.p) - pagadoDe(a.p);
        const monto = Math.min(Math.max(0, num(b.monto)), falta);
        if (!monto) return json({ ok: false, error: "Monto inválido" }, 400);
        const recibido = metodo === "efectivo" ? Math.max(monto, num(b.recibido) || monto) : monto;
        const pagos = (a.p.pagos || []).concat([{ metodo, monto, recibido, vuelto: recibido - monto, fecha: ahora, por: quien, nota: limpio(b.nota, 60) }]);
        const pagadoTotal = pagos.reduce((x, p) => x + p.monto, 0);
        const completo = pagadoTotal >= totalAPagar(a.p);
        const metodos = Array.from(new Set(pagos.map(p => p.metodo)));
        const cambios = { pagos, turnoId: t.id, metodoPago: metodos.length > 1 ? "mixto" : metodos[0] };
        if (completo){
          cambios.pagado = true; cambios.cobradoEn = ahora; cambios.cobradoPor = quien;
          cambios.total = Math.max(0, (a.p.subtotal || 0) - (a.p.descuentoLocal || 0));
          if (a.p.mesa){
            cambios.cerrado = true; cambios.estado = "listo";
            cambios.estadoTimeline = Object.assign({}, a.p.estadoTimeline || {}, { listo: ahora });
          } else if (a.p.estado === "listo" && a.p.entregado){ cambios.cerrado = true; }
        }
        await a.ref.set(cambios, { merge: true });
        return json({ ok: true, completo, falta: Math.max(0, totalAPagar(a.p) - pagadoTotal), vuelto: recibido - monto });
      }
      case "estadoLlevar": {  /* para llevar: listo / entregado */
        const a = await pedidoLocal(b.pedidoId);
        if (a.p.canal !== "local" || a.p.mesa) return json({ ok: false, error: "No corresponde" }, 400);
        const cambios = {};
        if (b.estado === "listo"){ cambios.estado = "listo"; cambios.estadoTimeline = Object.assign({}, a.p.estadoTimeline || {}, { listo: ahora }); }
        else if (b.estado === "entregado"){
          if (!a.p.pagado) return json({ ok: false, error: "Cobra el pedido antes de entregarlo" }, 409);
          cambios.estado = "listo"; cambios.entregado = true; cambios.entregadoEn = ahora; cambios.cerrado = true;
        } else return json({ ok: false, error: "Estado inválido" }, 400);
        await a.ref.set(cambios, { merge: true });
        return json({ ok: true });
      }
      case "anular": {
        if (rol !== "propietario") return json({ ok: false, error: "Solo el propietario puede anular una cuenta" }, 403);
        const a = await pedidoLocal(b.pedidoId);
        if (a.p.canal !== "local") return json({ ok: false, error: "Solo pedidos del local" }, 400);
        if (pagadoDe(a.p) > 0) return json({ ok: false, error: "Esta cuenta ya tiene pagos registrados" }, 409);
        await a.ref.set({ estado: "cancelado", cerrado: true, anuladoEn: ahora, anuladoPor: quien, motivoAnulacion: limpio(b.motivo, 100) }, { merge: true });
        await moverStock(db, storeId, (a.p.items || []).filter(i => !i.anulado), +1);
        return json({ ok: true });
      }
      case "moverMesa": {
        const a = await pedidoLocal(b.pedidoId);
        if (!a.p.mesa || a.p.cerrado) return json({ ok: false, error: "No corresponde" }, 400);
        const destino = idOk(b.mesaId);
        const ocup = await db.collection(col).where("mesa.id", "==", destino).get();
        if (ocup.docs.some(d => { const x = d.data(); return x.canal === "local" && !x.cerrado && x.estado !== "cancelado"; }))
          return json({ ok: false, error: "Esa mesa está ocupada" }, 409);
        const nombre = limpio(b.mesaNombre, 24) || "Mesa";
        await a.ref.set({ mesa: { id: destino, nombre, zona: limpio(b.zona, 24) }, cliente: Object.assign({}, a.p.cliente, { nombre: "🍽️ " + nombre }) }, { merge: true });
        return json({ ok: true });
      }
      case "cerrarTurno": {
        const t = await turnoAbierto(db, storeId);
        if (!t) return json({ ok: false, error: "No hay turno abierto" }, 409);
        const r = await resumenTurno(db, storeId, t.id, t.t);
        const c = b.contado || {};
        const contado = { efectivo: Math.max(0, num(c.efectivo)), tarjeta: Math.max(0, num(c.tarjeta)), transferencia: Math.max(0, num(c.transferencia)) };
        const diferencia = { efectivo: contado.efectivo - r.esperado.efectivo, tarjeta: contado.tarjeta - r.esperado.tarjeta, transferencia: contado.transferencia - r.esperado.transferencia };
        await t.ref.set({ estado: "cerrado", cerradoEn: ahora, cerradoPor: quien, contado, diferencia, resumen: r, nota: limpio(b.nota, 200) }, { merge: true });
        return json({ ok: true, resumen: r, contado, diferencia });
      }
      case "turnos": {
        const s = await db.collection("tiendas/" + storeId + "/caja_turnos").orderBy("abiertoEn", "desc").limit(30).get();
        return json({ ok: true, turnos: s.docs.map(d => Object.assign({ id: d.id }, d.data())) });
      }
      default:
        return json({ ok: false, error: "Acción desconocida" }, 400);
    }
  } catch(e){
    console.error("cajaLocal:", e.message);
    return json({ ok: false, error: e.message }, e.st || 500);
  }
}
