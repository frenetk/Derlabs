/* cloudflare/functions/repartidores.js
   Delivery propio de cada tienda.

   gestionRepartidores → lo usa el DUEÑO desde pedidos.html (sesión Firebase
   con rol en la tienda). Crea, cambia clave, pausa y elimina cuentas de
   repartidor.

   delivery → lo usa el REPARTIDOR desde /delivery (su cuenta). Ve solo sus
   pedidos asignados, marca "Salí" / "Entregado" y envía su ubicación GPS.

   Los repartidores NO reciben rol en usuarios/{uid}.roles: así las reglas de
   Firestore no les abren nada (ni pedidos, ni config, ni caja). Todo lo que
   hacen pasa por estas funciones, que verifican su sesión y sus permisos. */
import { getDb, corsHeaders, admin, authRest, uidDesdeToken } from "./_firebase.js";
import { notificar } from "./notificar.js";

/* Aviso push al dueño (mismos dispositivos que los pedidos nuevos) */
async function avisarDueno(env, storeId, titulo, texto){
  try { await notificar({ method: "POST" }, env, { storeId, titulo, texto, url: "/pedidos.html" }); }
  catch(e){ console.warn("avisarDueno:", e.message); }
}

const hdr = () => Object.assign({}, corsHeaders(), { "Cache-Control": "no-store" });
const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: hdr() });
const limpio = (s, n) => String(s || "").trim().slice(0, n || 80);
const idOk = s => String(s || "").replace(/[^A-Za-z0-9_-]/g, "");

/* Email interno de la cuenta: el repartidor nunca lo ve, entra con usuario + clave */
export function emailRepartidor(usuario, storeId){ return usuario + "--" + storeId + "@repartidor.derlabs.cl"; }
function claveNueva(){
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(8));
  let s = ""; for (let i = 0; i < 8; i++) s += abc[b[i] % abc.length];
  return s.slice(0, 4) + "-" + s.slice(4);
}

/* Día calendario en Chile (YYYY-MM-DD) para agrupar la caja */
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
export function diaChile(iso){ try { return fmtDia.format(iso ? new Date(iso) : new Date()); } catch(e){ return String(iso || "").slice(0, 10); } }

/* Entregas de un repartidor (todas) a partir de sus pedidos */
function entregasDe(docs){
  const out = [];
  docs.forEach(function(d){
    const p = d.data(), e = p.envio || {};
    if (p.estado !== "listo" || !e.entregadoEn) return;
    out.push({ pedidoId: p.id || d.id, dia: e.entregadoDia || diaChile(e.entregadoEn), hora: e.entregadoEn,
               total: Number(p.total) || 0, efectivo: p.metodoPago === "efectivo" ? (Number(e.cobrado) || 0) : 0, metodoPago: p.metodoPago || "" });
  });
  return out;
}
async function movimientosDe(db, storeId, rid){
  const s = await db.collection("tiendas/" + storeId + "/caja_repartidores").where("repartidorUid", "==", rid).get();
  return s.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); })
    .sort(function(a, c){ return String(a.fecha).localeCompare(String(c.fecha)); });
}
/* Deuda = efectivo cobrado + ajustes − lo ya rendido (cuadres) */
function deudaDe(entregas, movs){
  let d = 0;
  entregas.forEach(function(x){ d += x.efectivo; });
  movs.forEach(function(m){ d += m.tipo === "cuadre" ? -(Number(m.monto) || 0) : (Number(m.monto) || 0); });
  return Math.round(d);
}

async function leerBody(request){ try { return JSON.parse(await request.text() || "{}"); } catch(e){ return {}; } }

/* ═══════════════ DUEÑO ═══════════════ */
export async function gestionRepartidores(request, env){
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: hdr() });
  if (request.method !== "POST") return json({ ok:false, error:"Usa POST" }, 405);
  const b = await leerBody(request);
  const storeId = idOk(b.storeId);
  if (!storeId) return json({ ok:false, error:"Falta la tienda" }, 400);
  try {
    const db = getDb(env);
    const uid = await uidDesdeToken(request, env);
    if (!uid) return json({ ok:false, error:"Sesión vencida — vuelve a entrar" }, 401);
    const u = await db.doc("usuarios/" + uid).get();
    const rol = u.exists && u.data().roles ? u.data().roles[storeId] : null;
    if (!rol || rol === "repartidor") return json({ ok:false, error:"Sin permiso en esta tienda" }, 403);

    const col = "tiendas/" + storeId + "/repartidores";
    const rid = idOk(b.id);
    switch (b.accion){
      case "listar": {
        const s = await db.collection(col).get();
        const lista = s.docs.map(function(d){ const x = d.data(); return {
          id: d.id, nombre: x.nombre || "", usuario: x.usuario || "", telefono: x.telefono || "",
          activo: x.activo !== false, enRuta: x.enRuta === true, ubicacion: x.ubicacion || null, ultimaVez: x.ultimaVez || ""
        }; }).sort(function(a, c){ return a.nombre.localeCompare(c.nombre, "es"); });
        return json({ ok:true, repartidores: lista });
      }
      case "crear": {
        const nombre = limpio(b.nombre, 40);
        const usuario = String(b.usuario || "").trim().toLowerCase();
        const telefono = limpio(b.telefono, 20);
        if (!nombre) return json({ ok:false, error:"Escribe el nombre del repartidor" }, 400);
        if (!/^[a-z0-9._-]{3,20}$/.test(usuario)) return json({ ok:false, error:"El usuario debe tener 3 a 20 letras o números, sin espacios" }, 400);
        const ya = await db.collection(col).where("usuario", "==", usuario).limit(1).get();
        if (!ya.empty) return json({ ok:false, error:"Ese usuario ya existe en tu tienda" }, 409);
        const clave = claveNueva();
        const cuenta = await admin.auth().createUser({ email: emailRepartidor(usuario, storeId), password: clave, displayName: nombre });
        await db.doc(col + "/" + cuenta.uid).set({ nombre, usuario, telefono, activo: true, enRuta: false, ubicacion: null, creadoEn: new Date().toISOString(), creadoPor: uid });
        return json({ ok:true, id: cuenta.uid, usuario, clave });
      }
      case "clave": {
        if (!rid) return json({ ok:false, error:"Falta el repartidor" }, 400);
        if (!(await db.doc(col + "/" + rid).get()).exists) return json({ ok:false, error:"No existe" }, 404);
        const clave = claveNueva();
        await authRest(":update", { localId: rid, password: clave });
        return json({ ok:true, clave });
      }
      case "activo": {
        if (!rid) return json({ ok:false, error:"Falta el repartidor" }, 400);
        if (!(await db.doc(col + "/" + rid).get()).exists) return json({ ok:false, error:"No existe" }, 404);
        const activo = b.activo !== false;
        await authRest(":update", { localId: rid, disableUser: !activo });
        await db.doc(col + "/" + rid).set(activo ? { activo } : { activo, enRuta: false, ubicacion: null }, { merge: true });
        return json({ ok:true, activo });
      }
      case "eliminar": {
        if (!rid) return json({ ok:false, error:"Falta el repartidor" }, 400);
        if (!(await db.doc(col + "/" + rid).get()).exists) return json({ ok:false, error:"No existe" }, 404);
        await authRest(":delete", { localId: rid }).catch(function(e){ if (!/USER_NOT_FOUND/.test(e.message)) throw e; });
        await db.doc(col + "/" + rid).delete();
        return json({ ok:true });
      }
      case "caja": {
        const desde = /^\d{4}-\d{2}-\d{2}$/.test(b.desde || "") ? b.desde : diaChile();
        const hasta = /^\d{4}-\d{2}-\d{2}$/.test(b.hasta || "") ? b.hasta : desde;
        const reps = (await db.collection(col).get()).docs;
        const salida = [];
        for (const r of reps){
          const x = r.data();
          const ped = await db.collection("tiendas/" + storeId + "/pedidos").where("envio.repartidorUid", "==", r.id).get();
          const ent = entregasDe(ped.docs);
          const movs = await movimientosDe(db, storeId, r.id);
          const dias = {};
          ent.filter(function(e){ return e.dia >= desde && e.dia <= hasta; }).forEach(function(e){
            const k = dias[e.dia] = dias[e.dia] || { entregas: 0, ventas: 0, efectivo: 0 };
            k.entregas++; k.ventas += e.total; k.efectivo += e.efectivo;
          });
          const deuda = deudaDe(ent, movs);
          const movsRango = movs.filter(function(m){ return m.dia >= desde && m.dia <= hasta; });
          if (!ent.length && !movs.length && x.activo === false) continue;
          salida.push({ id: r.id, nombre: x.nombre || "", activo: x.activo !== false, deuda, dias, movimientos: movsRango,
                        entregas: ent.filter(function(e){ return e.dia >= desde && e.dia <= hasta; }).sort(function(a, c){ return String(c.hora).localeCompare(String(a.hora)); }) });
        }
        salida.sort(function(a, c){ return a.nombre.localeCompare(c.nombre, "es"); });
        return json({ ok:true, desde, hasta, hoy: diaChile(), repartidores: salida, esPropietario: rol === "propietario" });
      }
      case "cuadrar":
      case "ajuste": {
        if (rol !== "propietario") return json({ ok:false, error:"Solo el propietario puede cuadrar o ajustar la caja" }, 403);
        if (!rid) return json({ ok:false, error:"Falta el repartidor" }, 400);
        const r = await db.doc(col + "/" + rid).get();
        if (!r.exists) return json({ ok:false, error:"No existe" }, 404);
        const monto = Math.round(Number(b.monto) || 0);
        if (b.accion === "cuadrar" && monto <= 0) return json({ ok:false, error:"Escribe el monto que recibiste" }, 400);
        if (b.accion === "ajuste" && !monto) return json({ ok:false, error:"El ajuste no puede ser 0" }, 400);
        const ped = await db.collection("tiendas/" + storeId + "/pedidos").where("envio.repartidorUid", "==", rid).get();
        const antes = deudaDe(entregasDe(ped.docs), await movimientosDe(db, storeId, rid));
        const ahoraM = new Date().toISOString();
        const mov = { tipo: b.accion === "cuadrar" ? "cuadre" : "ajuste", repartidorUid: rid, nombre: r.data().nombre || "", monto, deudaAntes: antes,
                      deudaDespues: b.accion === "cuadrar" ? antes - monto : antes + monto,
                      nota: limpio(b.nota, 120), fecha: ahoraM, dia: diaChile(ahoraM), por: uid };
        const ref = await db.collection("tiendas/" + storeId + "/caja_repartidores").add(mov);
        return json({ ok:true, id: ref.id, deuda: mov.deudaDespues });
      }
      default:
        return json({ ok:false, error:"Acción desconocida" }, 400);
    }
  } catch(e){
    console.error("gestionRepartidores:", e.message);
    const msg = /EMAIL_EXISTS/.test(e.message) ? "Ese usuario ya existe" : e.message;
    return json({ ok:false, error: msg }, 500);
  }
}

/* ═══════════════ REPARTIDOR ═══════════════ */
function pedidoParaRepartidor(id, p){
  const c = p.cliente || {};
  return {
    id: p.id || id, estado: p.estado || "nuevo", fecha: p.fecha || "", tipo: p.tipo || "",
    metodoPago: p.metodoPago || "", total: p.total || 0,
    items: (p.items || []).map(function(i){ return { nombre: i.nombre, cantidad: i.cantidad }; }),
    cliente: { nombre: c.nombre || "", telefono: c.telefono || "", direccion: c.direccion || "", comuna: c.comuna || "", referencias: c.referencias || "", notas: c.notas || "",
               lat: c.lat != null ? c.lat : null, lng: c.lng != null ? c.lng : null },
    envio: p.envio || {}
  };
}

export async function delivery(request, env){
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: hdr() });
  if (request.method !== "POST") return json({ ok:false, error:"Usa POST" }, 405);
  const b = await leerBody(request);
  const storeId = idOk(b.storeId);
  if (!storeId) return json({ ok:false, error:"Falta la tienda" }, 400);
  try {
    const db = getDb(env);
    const uid = await uidDesdeToken(request, env);
    if (!uid) return json({ ok:false, error:"Sesión vencida — vuelve a entrar" }, 401);
    const repRef = db.doc("tiendas/" + storeId + "/repartidores/" + uid);
    const rep = await repRef.get();
    if (!rep.exists || rep.data().activo === false) return json({ ok:false, error:"Tu cuenta no está activa en esta tienda" }, 403);
    const yo = rep.data();
    const ahora = new Date().toISOString();

    async function pedidoAsignado(pid){
      const ref = db.doc("tiendas/" + storeId + "/pedidos/" + idOk(pid));
      const d = await ref.get();
      if (!d.exists) return null;
      const p = d.data();
      if (!p.envio || p.envio.repartidorUid !== uid) return null;
      return { ref, p };
    }

    switch (b.accion){
      case "pedidos": {
        const s = await db.collection("tiendas/" + storeId + "/pedidos").where("envio.repartidorUid", "==", uid).get();
        const hace12h = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
        const pedidos = s.docs.map(function(d){ return pedidoParaRepartidor(d.id, d.data()); })
          .filter(function(p){ return p.estado !== "cancelado" && (p.estado !== "listo" || (p.envio.entregadoEn || "") >= hace12h); })
          .sort(function(a, c){ return String(a.fecha).localeCompare(String(c.fecha)); });
        const enCamino = pedidos.some(function(p){ return p.estado === "camino"; });
        await repRef.set(enCamino ? { ultimaVez: ahora } : { ultimaVez: ahora, enRuta: false, ubicacion: null }, { merge: true });
        /* Resumen del turno (hoy en Chile) y ranking simple: más entregas hoy = más rápido */
        const hoy = diaChile();
        const mias = entregasDe(s.docs);
        const hoyMias = mias.filter(function(e){ return e.dia === hoy; });
        const deuda = deudaDe(mias, await movimientosDe(db, storeId, uid));
        const todasHoy = await db.collection("tiendas/" + storeId + "/pedidos").where("envio.entregadoDia", "==", hoy).get();
        const conteo = {};
        todasHoy.docs.forEach(function(d){ const e = d.data().envio || {}; if (e.repartidorUid) conteo[e.repartidorUid] = (conteo[e.repartidorUid] || 0) + 1; });
        conteo[uid] = Math.max(conteo[uid] || 0, hoyMias.length);
        const orden = Object.keys(conteo).sort(function(a, c){ return conteo[c] - conteo[a]; });
        const lider = orden.length ? conteo[orden[0]] : 0;
        const puesto = hoyMias.length ? 1 + orden.filter(function(k){ return conteo[k] > hoyMias.length; }).length : 0;
        const turno = { entregas: hoyMias.length, efectivo: hoyMias.reduce(function(t, e){ return t + e.efectivo; }, 0),
                        deuda, puesto, repartidoresHoy: orden.length, faltanParaPrimero: Math.max(0, lider - hoyMias.length) };
        return json({ ok:true, yo: { nombre: yo.nombre || "", usuario: yo.usuario || "" }, pedidos, turno });
      }
      case "salir": {
        const a = await pedidoAsignado(b.id);
        if (!a) return json({ ok:false, error:"Ese pedido no está asignado a ti" }, 404);
        if (a.p.estado === "listo" || a.p.estado === "cancelado") return json({ ok:false, error:"Ese pedido ya está cerrado" }, 409);
        if (a.p.estado === "nuevo") return json({ ok:false, error:"El local todavía no empieza a preparar este pedido. Espera a que lo marque en preparación." }, 409);
        if (a.p.estado === "camino") return json({ ok:true });
        await a.ref.set({ estado: "camino", estadoTimeline: Object.assign({}, a.p.estadoTimeline || {}, { camino: ahora }),
                          envio: Object.assign({}, a.p.envio, { salioEn: ahora }) }, { merge: true });
        await repRef.set({ enRuta: true, ultimaVez: ahora }, { merge: true });
        await avisarDueno(env, storeId, "🛵 " + (yo.nombre || "Tu repartidor") + " salió con " + (a.p.id || b.id), ((a.p.cliente || {}).direccion || ""));
        return json({ ok:true });
      }
      case "entregar": {
        const a = await pedidoAsignado(b.id);
        if (!a) return json({ ok:false, error:"Ese pedido no está asignado a ti" }, 404);
        if (a.p.estado === "cancelado") return json({ ok:false, error:"Ese pedido fue cancelado" }, 409);
        const cobrado = a.p.metodoPago === "efectivo" ? Math.max(0, Math.round(Number(b.cobrado) || 0)) : 0;
        await a.ref.set({ estado: "listo", estadoTimeline: Object.assign({}, a.p.estadoTimeline || {}, { listo: ahora }),
                          envio: Object.assign({}, a.p.envio, { entregadoEn: ahora, entregadoDia: diaChile(ahora), cobrado }) }, { merge: true });
        const quedan = await db.collection("tiendas/" + storeId + "/pedidos").where("envio.repartidorUid", "==", uid).get();
        const enCamino = quedan.docs.some(function(d){ return d.id !== a.ref.id && d.data().estado === "camino"; });
        await repRef.set({ enRuta: enCamino, ubicacion: enCamino ? yo.ubicacion || null : null, ultimaVez: ahora }, { merge: true });
        await avisarDueno(env, storeId, "✅ " + (yo.nombre || "Tu repartidor") + " entregó " + (a.p.id || b.id),
          a.p.metodoPago === "efectivo" ? "Cobró " + "$" + cobrado.toLocaleString("es-CL") : "Pedido pagado online");
        return json({ ok:true, cobrado });
      }
      case "ubicacion": {
        const lat = Number(b.lat), lng = Number(b.lng);
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return json({ ok:false, error:"Ubicación inválida" }, 400);
        await repRef.set({ ubicacion: { lat, lng, prec: Math.round(Number(b.prec) || 0), ts: ahora }, ultimaVez: ahora }, { merge: true });
        return json({ ok:true });
      }
      default:
        return json({ ok:false, error:"Acción desconocida" }, 400);
    }
  } catch(e){
    console.error("delivery:", e.message);
    return json({ ok:false, error: e.message }, 500);
  }
}
