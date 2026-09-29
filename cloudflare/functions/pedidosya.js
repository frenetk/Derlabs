/* cloudflare/functions/pedidosya.js
   PedidosYa Envíos (Courier API v3) para cada tienda.

   El dueño pega su token de PedidosYa en el gestor (igual que el de Mercado
   Pago). Se guarda en tiendas/{storeId}/integraciones/pedidosya y NUNCA se
   devuelve al navegador (solo los últimos 4 caracteres).

   Lo llama gestionRepartidores (repartidores.js) con las acciones pya*, así
   que usa la misma verificación de sesión y rol del dueño.
   seguimientoPedido usa sincronizarPya() para que el cliente vea el estado
   real del envío aunque el gestor esté cerrado.

   API (la misma que usa el módulo oficial de Magento en modo "API"):
     POST /v3/shippings/estimates   → cotizar
     POST /v3/shippings             → crear el envío
     GET  /v3/shippings/{id}        → estado
     POST /v3/shippings/{id}/cancel → cancelar (solo si aún está CONFIRMED)
   Header: Authorization: <token> */

const API = "https://courier-api.pedidosya.com/v3/";
const limpio = (s, n) => String(s || "").trim().slice(0, n || 80);
const soloNum = s => String(s || "").replace(/\D/g, "");

function refConfig(db, storeId){ return db.doc("tiendas/" + storeId + "/integraciones/pedidosya"); }

async function leerConfig(db, storeId){
  const d = await refConfig(db, storeId).get();
  return d.exists ? d.data() : {};
}

async function llamar(cfg, metodo, ruta, cuerpo){
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { "Authorization": cfg.token, "Content-Type": "application/json", "Accept": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const txt = await r.text();
  let j = {}; try { j = JSON.parse(txt || "{}"); } catch(e){ j = { message: txt.slice(0, 200) }; }
  if (!r.ok){
    const msg = j.message || (j.messages && j.messages[0]) || j.code || ("PedidosYa respondió " + r.status);
    const err = new Error(r.status === 401 || r.status === 403 ? "PedidosYa rechazó el token (revisa que esté bien copiado y activo)" : "PedidosYa: " + msg);
    err.status = r.status; err.respuesta = j;
    throw err;
  }
  return j;
}

/* Fecha/hora de retiro: ahora + minutos de preparación, en UTC sin milisegundos */
function horaRetiro(min){ return new Date(Date.now() + (Number(min) || 0) * 60000).toISOString().replace(/\.\d{3}Z$/, "Z"); }

function cuerpoEnvio(cfg, p, prueba){
  const c = p.cliente || {};
  const items = (p.items || []).map(function(i){
    const q = Math.max(1, Number(i.cantidad) || 1);
    return { value: Math.round(Number(i.precio) || 0) || 1, description: limpio(i.nombre, 60) || "Producto", quantity: q, volume: 1, weight: 0.5 * q };
  });
  if (!items.length) items.push({ value: Math.round(Number(p.total) || 1), description: "Pedido", quantity: 1, volume: 1, weight: 1 });
  const r = cfg.retiro || {};
  const retiro = {
    type: "PICK_UP", order: 1,
    addressStreet: limpio(r.direccion, 120), addressAdditional: limpio(r.adicional, 80), city: limpio(r.ciudad || "Santiago", 40),
    latitude: Number(r.lat), longitude: Number(r.lng),
    phone: soloNum(r.telefono), name: limpio(r.nombre || "Tienda", 60), instructions: limpio(r.instrucciones, 120)
  };
  const entrega = {
    type: "DROP_OFF", order: 2,
    addressStreet: limpio(c.direccion, 120), addressAdditional: limpio(c.referencias, 80), city: limpio(c.comuna || r.ciudad || "Santiago", 40),
    phone: soloNum(c.telefono), name: limpio(c.nombre || "Cliente", 60), instructions: limpio(c.notas, 120)
  };
  if (c.lat != null && c.lng != null && c.lat !== "" && c.lng !== ""){ entrega.latitude = Number(c.lat); entrega.longitude = Number(c.lng); }
  const b = {
    referenceId: "#" + limpio(p.id, 40),
    isTest: prueba,
    deliveryTime: horaRetiro(cfg.minutosPreparacion != null ? cfg.minutosPreparacion : 10),
    volume: items.reduce(function(t, i){ return t + i.volume; }, 0),
    weight: items.reduce(function(t, i){ return t + i.weight; }, 0),
    items, waypoints: [retiro, entrega]
  };
  if (c.email) b.notificationMail = limpio(c.email, 100);
  return b;
}

/* Precio de una cotización (v3: deliveryOffers[0].pricing.total; v1: price.total) */
function precioDe(j){
  const o = j && j.deliveryOffers && j.deliveryOffers[0];
  if (o && o.pricing && o.pricing.total != null) return { total: Number(o.pricing.total), moneda: o.pricing.currency || "CLP", oferta: o.deliveryOfferId || "", hora: o.confirmedDeliveryTime || (o.deliveryTime || "") };
  if (j && j.price && j.price.total != null) return { total: Number(j.price.total), moneda: j.price.currency || "CLP", oferta: "", hora: j.deliveryTime || "" };
  return null;
}

/* Estado de PedidosYa → estado del pedido en la tienda (solo avanza) */
const ORDEN = { nuevo: 0, preparacion: 1, camino: 2, listo: 3 };
function estadoTienda(st){
  const s = String(st || "").toUpperCase();
  if (/COMPLET|DELIVERED/.test(s)) return "listo";
  if (/IN_PROGRESS|PICKED|NEAR_DROP|ON_ROUTE|TRANSIT/.test(s)) return "camino";
  return null;
}
const LEGIBLE = {
  CONFIRMED: "Buscando repartidor", PREORDER: "Programado", IN_PROGRESS: "En curso", NEAR_PICKUP: "Llegando al local",
  PICKED_UP: "Retirado, va en camino", NEAR_DROPOFF: "Llegando al cliente", COMPLETED: "Entregado", CANCELLED: "Cancelado"
};
export function estadoLegiblePya(st){ return LEGIBLE[String(st || "").toUpperCase()] || String(st || "").replace(/_/g, " ").toLowerCase(); }

function envioDesdeRespuesta(prev, j, extra){
  const courier = j.driver || j.courier || j.rider || {};
  return Object.assign({}, prev || {}, extra || {}, {
    metodo: "pedidosya",
    pyaId: String(j.shippingId || j.id || (prev && prev.pyaId) || ""),
    estadoPya: String(j.status || (prev && prev.estadoPya) || ""),
    codigoPya: String(j.confirmationCode || (prev && prev.codigoPya) || ""),
    trackingUrl: String(j.shareLocationUrl || j.trackingUrl || (prev && prev.trackingUrl) || ""),
    repartidorNombre: String(courier.name || courier.firstName || (prev && prev.repartidorNombre) || ""),
    revisadoEn: new Date().toISOString()
  });
}

/* Trae el estado del envío y lo refleja en el pedido. Devuelve el pedido actualizado. */
export async function sincronizarPya(db, storeId, ref, p, env, forzar){
  const ev = p.envio || {};
  if (ev.metodo !== "pedidosya" || !ev.pyaId) return p;
  if (/COMPLET|CANCEL/i.test(ev.estadoPya || "")) return p;
  if (!forzar && ev.revisadoEn && Date.now() - Date.parse(ev.revisadoEn) < 45000) return p;
  const cfg = await leerConfig(db, storeId);
  if (!cfg.token) return p;
  const j = await llamar(cfg, "GET", "shippings/" + encodeURIComponent(ev.pyaId));
  const ahora = new Date().toISOString();
  const envio = envioDesdeRespuesta(ev, j);
  const cambios = { envio };
  const nuevo = estadoTienda(j.status);
  if (nuevo && p.estado !== "cancelado" && (ORDEN[nuevo] || 0) > (ORDEN[p.estado] || 0)){
    cambios.estado = nuevo;
    const tl = Object.assign({}, p.estadoTimeline || {}); tl[nuevo] = ahora; cambios.estadoTimeline = tl;
    if (nuevo === "camino" && !envio.salioEn) envio.salioEn = ahora;
    if (nuevo === "listo"){ envio.entregadoEn = ahora; if (!envio.salioEn) envio.salioEn = ahora; }
  }
  await ref.set(cambios, { merge: true });
  return Object.assign({}, p, cambios);
}

/* ═══ Acciones del gestor (las llama gestionRepartidores) ═══ */
export async function accionPedidosYa(db, storeId, rol, uid, b, env){
  const cfgRef = refConfig(db, storeId);
  const pedidoRef = function(){ return db.doc("tiendas/" + storeId + "/pedidos/" + String(b.docId || "").replace(/[^A-Za-z0-9_-]/g, "")); };
  switch (b.accion){
    case "pyaConfig": {
      const cfg = await leerConfig(db, storeId);
      return { ok:true, configurado: !!cfg.token, token4: cfg.token ? String(cfg.token).slice(-4) : "",
               retiro: cfg.retiro || {}, prueba: cfg.prueba !== false, minutosPreparacion: cfg.minutosPreparacion != null ? cfg.minutosPreparacion : 10,
               esPropietario: rol === "propietario" };
    }
    case "pyaGuardar": {
      if (rol !== "propietario") return { status: 403, ok:false, error:"Solo el propietario puede configurar PedidosYa" };
      const cfg = await leerConfig(db, storeId);
      const r = b.retiro || {};
      const nuevo = {
        retiro: { direccion: limpio(r.direccion, 120), adicional: limpio(r.adicional, 80), ciudad: limpio(r.ciudad || "Santiago", 40),
                  lat: Number(r.lat), lng: Number(r.lng), telefono: limpio(r.telefono, 20), nombre: limpio(r.nombre, 60), instrucciones: limpio(r.instrucciones, 120) },
        prueba: b.prueba !== false,
        minutosPreparacion: Math.min(120, Math.max(0, Math.round(Number(b.minutosPreparacion) || 0))),
        actualizadoEn: new Date().toISOString(), actualizadoPor: uid
      };
      const tok = String(b.token || "").trim();
      nuevo.token = tok ? tok.slice(0, 2000) : String(cfg.token || "");
      if (!nuevo.token) return { status: 400, ok:false, error:"Pega el token de PedidosYa" };
      if (!nuevo.retiro.direccion) return { status: 400, ok:false, error:"Escribe la dirección de retiro (tu local)" };
      if (!isFinite(nuevo.retiro.lat) || !isFinite(nuevo.retiro.lng) || !nuevo.retiro.lat) return { status: 400, ok:false, error:"Busca la dirección en el mapa para tener sus coordenadas" };
      if (soloNum(nuevo.retiro.telefono).length < 8) return { status: 400, ok:false, error:"Escribe el teléfono del local" };
      await cfgRef.set(nuevo, { merge: true });
      return { ok:true };
    }
    case "pyaCotizar":
    case "pyaEnviar": {
      const cfg = await leerConfig(db, storeId);
      if (!cfg.token) return { status: 400, ok:false, error:"Primero configura PedidosYa (botón 🛵 → PedidosYa Envíos)" };
      const ref = pedidoRef(); const d = await ref.get();
      if (!d.exists) return { status: 404, ok:false, error:"Pedido no encontrado" };
      const p = d.data();
      if (p.tipo !== "delivery") return { status: 400, ok:false, error:"Ese pedido es de retiro" };
      if (p.estado === "listo" || p.estado === "cancelado") return { status: 409, ok:false, error:"Ese pedido ya está cerrado" };
      if (p.envio && p.envio.metodo === "pedidosya" && p.envio.pyaId && !/CANCEL/i.test(p.envio.estadoPya || "")) return { status: 409, ok:false, error:"Ese pedido ya tiene un envío de PedidosYa" };
      if (!soloNum((p.cliente || {}).telefono)) return { status: 400, ok:false, error:"El pedido no tiene teléfono del cliente" };
      const cuerpo = cuerpoEnvio(cfg, p, cfg.prueba !== false);
      if (b.accion === "pyaCotizar"){
        const j = await llamar(cfg, "POST", "shippings/estimates", cuerpo);
        const precio = precioDe(j);
        if (!precio) return { status: 422, ok:false, error:"PedidosYa no tiene cobertura para esa dirección" };
        return { ok:true, precio, prueba: cfg.prueba !== false };
      }
      const j = await llamar(cfg, "POST", "shippings", cuerpo);
      if (!(j.shippingId || j.id)) return { status: 502, ok:false, error: "PedidosYa no confirmó el envío" + (j.message ? ": " + j.message : "") };
      const envio = envioDesdeRespuesta(null, j, { asignadoEn: new Date().toISOString(), prueba: cfg.prueba !== false,
        precioPya: Number(b.precio) || null });
      await ref.set({ envio }, { merge: true });
      return { ok:true, envio };
    }
    case "pyaEstado": {
      const ref = pedidoRef(); const d = await ref.get();
      if (!d.exists) return { status: 404, ok:false, error:"Pedido no encontrado" };
      const p = await sincronizarPya(db, storeId, ref, d.data(), env, b.forzar === true);
      return { ok:true, estado: p.estado, envio: p.envio || null };
    }
    case "pyaCancelar": {
      const cfg = await leerConfig(db, storeId);
      const ref = pedidoRef(); const d = await ref.get();
      if (!d.exists) return { status: 404, ok:false, error:"Pedido no encontrado" };
      const ev = d.data().envio || {};
      if (ev.metodo !== "pedidosya" || !ev.pyaId) return { status: 400, ok:false, error:"Ese pedido no va con PedidosYa" };
      if (!cfg.token) return { status: 400, ok:false, error:"Falta el token de PedidosYa" };
      try { await llamar(cfg, "POST", "shippings/" + encodeURIComponent(ev.pyaId) + "/cancel", { reasonText: limpio(b.motivo || "Cancelado por la tienda", 120) }); }
      catch(e){ return { status: 409, ok:false, error: e.message + " — si el repartidor ya lo retiró, hay que pedir la cancelación a PedidosYa." }; }
      await ref.set({ envio: Object.assign({}, ev, { estadoPya: "CANCELLED", canceladoEn: new Date().toISOString() }) }, { merge: true });
      return { ok:true };
    }
    default:
      return { status: 400, ok:false, error:"Acción desconocida" };
  }
}
