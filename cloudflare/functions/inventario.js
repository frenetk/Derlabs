/* cloudflare/functions/inventario.js
   INVENTARIO CON RECETAS (plan Pro, tiendas de comida).

   · Insumos: los ingredientes, con su stock, mínimo y costo.
   · Recetas: qué insumos lleva cada producto y cuánto. Los agregados
     (opciones de los grupos de extras) también pueden descontar.
   · Cada venta descuenta sola los insumos (tienda online y caja); si se
     anula un producto en la caja, se devuelven.
   · Compras, mermas y conteos se anotan a mano. Todo queda en el historial.
   · Cuando un insumo llega a 0 NADA se agota solo: queda un aviso y el
     dueño (o el cajero) decide: marcar agotados los productos que lo usan,
     anotar cuánto queda de verdad, o seguir vendiendo.

   Datos (solo se leen y escriben desde aquí, con la cuenta de servicio: no
   hay que tocar las reglas de Firestore):
     tiendas/{s}/inventario/datos
       insumos:  { [id]: { nombre, unidad: "kg"|"l"|"un", etiqueta, stock, minimo, costo } }
                 stock y minimo van en la unidad chica (g, ml o unidades);
                 costo es por unidad grande (el kilo, el litro, cada una).
       recetas:  [ { p: productoId, activa, items: [ { i: insumoId, c: cantidad chica } ] } ]
       extras:   [ { g: grupoId, o: opcionId, items: [ { i, c } ] } ]
       avisos:   { [insumoId]: { desde } }      llegó a 0 y nadie ha decidido
       agotados: { [insumoId]: [productoId] }   productos que se marcaron agotados por ese insumo
     tiendas/{s}/inv_movs/{auto}   historial: { fecha, tipo, items: [{ i, n, c }], lugar, nota, por, total, pedidoId }

   Los ids de insumo empiezan con letra y solo llevan letras, dígitos y _:
   se usan como clave de mapa, y la librería de Firestore no escapa las rutas
   de campo (por eso recetas y extras son listas y no mapas por producto).
   El stock se mueve con FieldValue.increment en una clave con puntos
   ("insumos.<id>.stock"): dos ventas al mismo tiempo no se pisan.

   /api/inventario (POST, sesión del dueño o del cajero):
     ver · insumo (guardar | borrar) · receta · extra · movimiento · movimientos · aviso · reactivar */
import { getDb, corsHeaders, admin, uidDesdeToken } from "./_firebase.js";
import { planDe } from "./planTienda.js";

export const UNIDADES = { kg: { chica: "g", f: 1000 }, l: { chica: "ml", f: 1000 }, un: { chica: "un", f: 1 } };
const MAX_INSUMOS = 300, MAX_LINEAS = 30;
const ruta = s => "tiendas/" + s + "/inventario/datos";
const hdr = () => Object.assign({}, corsHeaders(), { "Cache-Control": "no-store" });
const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: hdr() });
const idOk = s => String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
const esIdInsumo = s => /^i[a-f0-9]{8}$/.test(String(s || ""));
const limpio = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n || 40);
const numero = (v, max) => { const n = Math.round(Number(v) * 1000) / 1000; return isFinite(n) ? Math.min(max || 1e9, n) : NaN; };
const inc = n => admin.firestore.FieldValue.increment(n);
const borrar = () => admin.firestore.FieldValue.delete();
const nuevoId = () => { const b = crypto.getRandomValues(new Uint8Array(4)); return "i" + Array.from(b, x => ("0" + x.toString(16)).slice(-2)).join(""); };
const err = (m, st) => Object.assign(new Error(m), { st: st || 400 });

async function leer(db, storeId){
  const d = await db.doc(ruta(storeId)).get();
  const x = d.exists ? d.data() : {};
  return { existe: d.exists, insumos: x.insumos || {}, recetas: Array.isArray(x.recetas) ? x.recetas : [], extras: Array.isArray(x.extras) ? x.extras : [],
           avisos: x.avisos || {}, agotados: x.agotados || {} };
}
/* Líneas de receta válidas: insumo existente, cantidad mayor que cero, sin repetir */
function lineasOk(items, insumos){
  const out = [], vistos = {};
  (Array.isArray(items) ? items : []).slice(0, MAX_LINEAS).forEach(x => {
    const i = String((x && x.i) || ""), c = numero(x && x.c, 1000000);
    if (!insumos[i] || !(c > 0) || vistos[i]) return;
    vistos[i] = 1; out.push({ i, c });
  });
  return out;
}

/* ───────────── Consumo de una venta ───────────── */
/* items: los del pedido ({ id, cantidad, extras: { grupoId: { opcionId: veces } }, anulado }) → Map insumoId → cantidad chica */
export function consumoDe(datos, items){
  const uso = new Map();
  const suma = (i, c) => { if (datos.insumos[i] && c > 0) uso.set(i, Math.round(((uso.get(i) || 0) + c) * 1000) / 1000); };
  (Array.isArray(items) ? items : []).forEach(it => {
    if (!it || it.anulado) return;
    const cant = Math.max(1, Math.round(Number(it.cantidad) || 1));
    const r = datos.recetas.find(x => x && x.p === it.id && x.activa !== false);
    if (r) (r.items || []).forEach(l => suma(l.i, l.c * cant));
    const ex = it.extras && typeof it.extras === "object" ? it.extras : {};
    Object.keys(ex).forEach(g => { const ops = ex[g] && typeof ex[g] === "object" ? ex[g] : {};
      Object.keys(ops).forEach(o => { const veces = Math.max(0, Math.round(Number(ops[o]) || 0)); if (!veces) return;
        const e = datos.extras.find(x => x && x.g === g && x.o === o);
        if (e) (e.items || []).forEach(l => suma(l.i, l.c * veces * cant)); }); });
  });
  return uso;
}
/* Descuenta (signo -1) o devuelve (signo +1) los insumos de unos productos vendidos.
   Nunca lanza: una venta no puede fallar por el inventario. Devuelve los insumos que llegaron a 0. */
export async function moverInsumos(db, storeId, items, signo, info){
  try {
    const ref = db.doc(ruta(storeId));
    const d = await ref.get();
    if (!d.exists) return [];                       /* la tienda no usa inventario con recetas */
    if (await planDe(db, storeId, null) !== "pro") return [];
    const x = d.data(), datos = { insumos: x.insumos || {}, recetas: Array.isArray(x.recetas) ? x.recetas : [], extras: Array.isArray(x.extras) ? x.extras : [] };
    const uso = consumoDe(datos, items);
    if (!uso.size) return [];
    const ahora = new Date().toISOString(), cambios = {}, lineas = [], enCero = [];
    uso.forEach((c, i) => {
      const antes = Number(datos.insumos[i].stock) || 0, despues = antes + signo * c;
      cambios["insumos." + i + ".stock"] = inc(signo * c);
      lineas.push({ i, n: datos.insumos[i].nombre || "", c: signo * c });
      if (signo < 0 && antes > 0 && despues <= 0){ cambios["avisos." + i] = { desde: ahora }; enCero.push(i); }
    });
    await ref.set(cambios, { merge: true });
    const o = info || {};
    await db.collection("tiendas/" + storeId + "/inv_movs").add({ fecha: ahora, tipo: signo < 0 ? "venta" : "devolucion", items: lineas.slice(0, 60),
      lugar: limpio(o.lugar, 40), nota: limpio(o.nota, 80), por: limpio(o.por, 40), total: 0, pedidoId: limpio(o.pedidoId, 40) });
    return enCero;
  } catch(e){
    console.warn("inventario:", e.message);
    return [];
  }
}
/* Para la caja: avisos sin decidir, con los productos que usan cada insumo */
export async function avisosDe(db, storeId){
  try {
    const d = await leer(db, storeId);
    return Object.keys(d.avisos).filter(i => d.insumos[i]).map(i => vistaAviso(d, i));
  } catch(e){ return []; }
}
function usosDe(d, i){
  return d.recetas.filter(r => r && r.activa !== false && (r.items || []).some(l => l.i === i)).map(r => ({ p: r.p, c: (r.items.find(l => l.i === i) || {}).c || 0 }));
}
function vistaAviso(d, i){
  const x = d.insumos[i];
  return { id: i, nombre: x.nombre, unidad: x.unidad, etiqueta: x.etiqueta || "", stock: Number(x.stock) || 0, desde: (d.avisos[i] || {}).desde || "", usos: usosDe(d, i) };
}

/* ───────────── /api/inventario ───────────── */
/* cajero: lo del día a día de la caja; todo lo demás, solo quien tiene rol en la tienda */
const CAJERO = ["ver", "aviso", "movimiento", "reactivar"];

export async function inventario(request, env){
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
    let rol = u.exists && u.data().roles ? u.data().roles[storeId] : null;
    let quien = u.exists ? (u.data().nombre || "") : "";
    let dueno = !!rol && rol !== "repartidor";
    if (!dueno){
      const pe = await db.doc("tiendas/" + storeId + "/personal/" + uid).get();
      if (!pe.exists || pe.data().activo === false || pe.data().rol !== "cajero" || CAJERO.indexOf(b.accion) < 0)
        return json({ ok: false, error: "Sin permiso para el inventario de esta tienda" }, 403);
      quien = pe.data().nombre || pe.data().usuario || "";
    }
    const cfgD = await db.doc("tiendas/" + storeId + "/config/general").get();
    if (!cfgD.exists) return json({ ok: false, error: "Esa tienda no existe" }, 404);
    if (await planDe(db, storeId, cfgD.data()) !== "pro") return json({ ok: false, error: "El inventario con recetas es parte del plan Pro.", plan: "basico" }, 403);

    const ref = db.doc(ruta(storeId)), ahora = new Date().toISOString();
    const d = await leer(db, storeId);
    const anotar = m => db.collection("tiendas/" + storeId + "/inv_movs").add(Object.assign({ fecha: ahora, lugar: "", nota: "", por: limpio(quien, 40), total: 0, pedidoId: "" }, m));
    /* lo que ve cada uno: el cajero no ve costos */
    const vista = x => ({
      insumos: Object.keys(x.insumos).map(i => { const s = x.insumos[i]; const o = { id: i, nombre: s.nombre || "", unidad: UNIDADES[s.unidad] ? s.unidad : "un", etiqueta: s.etiqueta || "", stock: Number(s.stock) || 0, minimo: Number(s.minimo) || 0 };
        if (dueno) o.costo = Number(s.costo) || 0; return o; }).sort((p, q) => p.nombre.localeCompare(q.nombre, "es")),
      recetas: x.recetas, extras: x.extras,
      avisos: Object.keys(x.avisos).filter(i => x.insumos[i]).map(i => vistaAviso(x, i)),
      agotados: x.agotados
    });
    const listo = async extra => json(Object.assign({ ok: true, dueno }, vista(await leer(db, storeId)), extra || {}));

    switch (b.accion){
      case "ver": return json(Object.assign({ ok: true, dueno }, vista(d)));

      case "insumo": {
        if (b.op === "borrar"){
          const i = String(b.id || "");
          if (!d.insumos[i]) return json({ ok: false, error: "Ese insumo ya no existe" }, 404);
          const sin = l => (l || []).filter(x => x.i !== i);
          await ref.set({ ["insumos." + i]: borrar(), ["avisos." + i]: borrar(), ["agotados." + i]: borrar(),
            recetas: d.recetas.map(r => Object.assign({}, r, { items: sin(r.items) })).filter(r => r.items.length),
            extras: d.extras.map(e => Object.assign({}, e, { items: sin(e.items) })).filter(e => e.items.length) }, { merge: true });
          return listo();
        }
        const nombre = limpio(b.nombre, 40);
        if (!nombre) throw err("Escribe el nombre del insumo");
        const minimo = numero(b.minimo || 0), costo = numero(b.costo || 0);
        if (!(minimo >= 0) || !(costo >= 0)) throw err("Mínimo y costo tienen que ser números, cero o más");
        const etiqueta = limpio(b.etiqueta, 16);
        const repetido = Object.keys(d.insumos).some(i => i !== b.id && String(d.insumos[i].nombre || "").toLowerCase() === nombre.toLowerCase());
        if (repetido) throw err("Ya hay un insumo con ese nombre");
        if (b.id){
          const i = String(b.id);
          if (!d.insumos[i]) return json({ ok: false, error: "Ese insumo ya no existe" }, 404);
          /* la unidad y el stock no se cambian aquí: el stock se mueve con compras, mermas y conteos */
          await ref.set({ insumos: { [i]: { nombre, etiqueta: d.insumos[i].unidad === "un" ? etiqueta : "", minimo, costo: Math.round(costo) } } }, { merge: true });
          return listo();
        }
        if (Object.keys(d.insumos).length >= MAX_INSUMOS) throw err("Llegaste al máximo de " + MAX_INSUMOS + " insumos");
        const unidad = UNIDADES[b.unidad] ? b.unidad : null;
        if (!unidad) throw err("Elige cómo se mide: kilos, litros o unidades");
        const stock = numero(b.stock || 0);
        if (!(stock >= 0)) throw err("El stock inicial tiene que ser cero o más");
        let i = nuevoId(); while (d.insumos[i] || !esIdInsumo(i)) i = nuevoId();
        await ref.set({ insumos: { [i]: { nombre, unidad, etiqueta: unidad === "un" ? etiqueta : "", stock, minimo, costo: Math.round(costo), creado: ahora } } }, { merge: true });
        if (stock > 0) await anotar({ tipo: "conteo", items: [{ i, n: nombre, c: stock }], nota: "Stock inicial" });
        return listo({ id: i });
      }

      case "receta": {
        const p = idOk(b.productoId);
        if (!p) throw err("Falta el producto");
        const items = lineasOk(b.items, d.insumos), activa = b.activa !== false && items.length > 0;
        const otras = d.recetas.filter(r => r && r.p !== p);
        const recetas = items.length ? otras.concat([{ p, activa, items }]) : otras;
        if (recetas.length > 500) throw err("Demasiadas recetas");
        await ref.set({ recetas }, { mergeFields: ["recetas"] });
        /* con receta, el producto deja de usar su stock propio (una cosa o la otra) */
        if (activa){
          const pr = db.doc("tiendas/" + storeId + "/productos/" + p), pd = await pr.get();
          if (pd.exists && !pd.data().agotadoInv && pd.data().stock != null && pd.data().stock !== "") await pr.set({ stock: null }, { merge: true });
        }
        return listo();
      }

      case "extra": {
        const g = idOk(b.grupoId), o = idOk(b.opcionId);
        if (!g || !o) throw err("Falta el agregado");
        const items = lineasOk(b.items, d.insumos);
        const otros = d.extras.filter(e => e && !(e.g === g && e.o === o));
        const extras = items.length ? otros.concat([{ g, o, items }]) : otros;
        if (extras.length > 500) throw err("Demasiados agregados con insumo");
        await ref.set({ extras }, { mergeFields: ["extras"] });
        return listo();
      }

      case "movimiento": {
        const i = String(b.insumo || ""), x = d.insumos[i];
        if (!x) return json({ ok: false, error: "Ese insumo ya no existe" }, 404);
        const tipo = ["compra", "merma", "conteo"].indexOf(b.tipo) >= 0 ? b.tipo : null;
        if (!tipo) throw err("Elige compra, merma o conteo");
        const cant = numero(b.cantidad);
        if (tipo === "conteo" ? !(cant >= 0) : !(cant > 0)) throw err("Escribe la cantidad");
        const antes = Number(x.stock) || 0;
        const despues = tipo === "compra" ? antes + cant : tipo === "merma" ? antes - cant : cant;
        const cambios = { ["insumos." + i + ".stock"]: tipo === "conteo" ? cant : inc(tipo === "compra" ? cant : -cant) };
        const total = tipo === "compra" && dueno ? Math.max(0, Math.round(Number(b.total) || 0)) : 0;
        /* el costo queda en lo que salió la última compra */
        if (total > 0) cambios["insumos." + i + ".costo"] = Math.round(total / (cant / UNIDADES[x.unidad].f));
        if (despues > 0) cambios["avisos." + i] = borrar();
        else if (antes > 0) cambios["avisos." + i] = { desde: ahora };
        await ref.set(cambios, { merge: true });
        await anotar({ tipo, items: [{ i, n: x.nombre || "", c: despues - antes }], nota: limpio(b.nota, 80), total, antes, despues });
        /* si volvió a haber y hay productos que se agotaron por este insumo, la pantalla pregunta si reactivarlos */
        const reactivar = despues > 0 && Array.isArray(d.agotados[i]) && d.agotados[i].length ? { insumo: i, productos: d.agotados[i] } : null;
        return listo({ reactivar });
      }

      case "movimientos": {
        if (!dueno) return json({ ok: false, error: "Sin permiso" }, 403);
        const s = await db.collection("tiendas/" + storeId + "/inv_movs").orderBy("fecha", "desc").limit(60).get();
        return json({ ok: true, movimientos: s.docs.map(x => x.data()) });
      }

      case "aviso": {   /* decisión sobre un insumo que llegó a 0 */
        const i = String(b.insumo || "");
        if (!d.insumos[i]) return json({ ok: false, error: "Ese insumo ya no existe" }, 404);
        if (b.op === "agotar"){
          const prods = usosDe(d, i).map(x => x.p).slice(0, 35);   /* el plan gratuito de Workers permite 50 llamadas por solicitud */
          for (const p of prods){
            const pr = db.doc("tiendas/" + storeId + "/productos/" + p);
            if ((await pr.get()).exists) await pr.set({ stock: 0, agotadoInv: true }, { merge: true });
          }
          await ref.set({ ["avisos." + i]: borrar(), agotados: { [i]: prods } }, { merge: true });
          return listo({ agotados_ahora: prods.length });
        }
        await ref.set({ ["avisos." + i]: borrar() }, { merge: true });
        return listo();
      }

      case "reactivar": {   /* volvió el insumo: los productos que se agotaron por él vuelven a venderse */
        const i = String(b.insumo || ""), prods = Array.isArray(d.agotados[i]) ? d.agotados[i].slice(0, 40) : [];
        if (b.op !== "dejar"){
          for (const p of prods){
            const pr = db.doc("tiendas/" + storeId + "/productos/" + idOk(p)), pd = await pr.get();
            if (pd.exists && pd.data().agotadoInv) await pr.set({ stock: null, agotadoInv: false }, { merge: true });
          }
        }
        await ref.set({ ["agotados." + i]: borrar() }, { merge: true });
        return listo({ reactivados: b.op === "dejar" ? 0 : prods.length });
      }

      default:
        return json({ ok: false, error: "Acción desconocida" }, 400);
    }
  } catch(e){
    if (!e.st) console.error("inventario:", e.message);
    return json({ ok: false, error: e.message || "Error" }, e.st || 500);
  }
}
