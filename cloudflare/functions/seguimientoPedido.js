/* cloudflare/functions/seguimientoPedido.js
   Seguimiento público de UN pedido para el cliente (incluso invitado).
   GET ?storeId=...&id=TB12345&t=<código de seguimiento>
   El código es largo y aleatorio (se genera al crear el pedido y solo lo
   tiene el celular de quien compró), así que no se puede adivinar. Las
   reglas de Firestore siguen sin dejar leer pedidos a nadie sin rol: esta
   función los lee con la cuenta de servicio y devuelve solo lo que el
   cliente necesita ver (sin teléfono, email ni datos de pago). */
import { getDb, corsHeaders } from "./_firebase.js";

const TOKEN_OK = /^[A-Za-z0-9]{20,64}$/;

export async function seguimientoPedido(request, env){
  const headers = Object.assign({}, corsHeaders(), { "Cache-Control": "no-store" });
  const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers });
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers });

  const url = new URL(request.url);
  const storeId = String(url.searchParams.get("storeId") || "").replace(/[^A-Za-z0-9_-]/g, "");
  const id = String(url.searchParams.get("id") || "").replace(/[^A-Za-z0-9_-]/g, "");
  const t = String(url.searchParams.get("t") || "");
  if (!storeId || !id || !TOKEN_OK.test(t)) return json({ ok:false, error:"Datos incompletos" }, 400);

  try {
    const db = getDb(env);
    const doc = await db.doc("tiendas/" + storeId + "/pedidos/" + id).get();
    if (!doc.exists){
      /* Mercado Pago: el pedido nace recién cuando el webhook confirma el pago */
      const intento = await db.doc("tiendas/" + storeId + "/intentos_pago/" + id).get();
      if (intento.exists && intento.data().seguimiento === t){
        return json({ ok:true, pedido:{ id, estado: "esperando" } });
      }
      return json({ ok:false, error:"No encontrado" }, 404);
    }
    const p = doc.data();
    if (!p.seguimiento || p.seguimiento !== t) return json({ ok:false, error:"No encontrado" }, 404);
    const c = p.cliente || {};
    /* Delivery propio: nombre del repartidor y, mientras va en camino, su ubicación */
    let repartidor = null;
    if (p.envio && p.envio.repartidorUid){
      repartidor = { nombre: p.envio.repartidorNombre || "" };
      if (p.estado === "camino"){
        const r = await db.doc("tiendas/" + storeId + "/repartidores/" + p.envio.repartidorUid).get();
        const u = r.exists ? r.data().ubicacion : null;
        if (u && u.ts && Date.now() - Date.parse(u.ts) < 10 * 60 * 1000) repartidor.ubicacion = { lat: u.lat, lng: u.lng, ts: u.ts };
      }
    }
    return json({ ok:true, pedido:{
      id: p.id || id,
      estado: p.estado || "nuevo",
      estadoTimeline: p.estadoTimeline || {},
      fecha: p.fecha || "",
      tipo: p.tipo || "",
      metodoPago: p.metodoPago || "",
      items: (p.items || []).map(function(i){ return { id: i.id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, variantes: i.variantes || null, notaPersonal: i.notaPersonal || null }; }),
      subtotal: p.subtotal || 0, descuento: p.descuento || 0, costoDelivery: p.costoDelivery || 0, total: p.total || 0,
      cuponAplicado: p.cuponAplicado || null,
      cliente: { nombre: c.nombre || "", direccion: c.direccion || "", comuna: c.comuna || "", local: c.local || "", tipo: c.tipo || "", lat: c.lat != null ? c.lat : null, lng: c.lng != null ? c.lng : null },
      envio: p.envio ? { metodo: p.envio.metodo || "", salioEn: p.envio.salioEn || "", entregadoEn: p.envio.entregadoEn || "" } : null,
      repartidor
    }});
  } catch(e){
    console.error("seguimientoPedido:", e.message);
    return json({ ok:false, error:"Error" }, 500);
  }
}
