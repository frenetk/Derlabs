/* cloudflare/functions/_waAviso.js — P67 · Aviso por WhatsApp cuando se confirma un pago online.
   Lo llaman webhookPago (MercadoPago) y flow.js (Webpay) después de crear el pedido.
   Solo actúa si el pedido vino del asistente (cliente.origen === "whatsapp"). Nunca hace
   fallar el pedido: cualquier error queda en el registro y sigue. */
const GRAPH = "https://graph.facebook.com/v21.0/";
const plata = n => "$" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const limpiar = t => String(t || "").replace(/^\s*["']?\s*(Bearer\s+)?/i, "").replace(/["']?\s*$/, "").replace(/\s+/g, "");

export async function avisarPagoWA(db, env, storeId, ped){
  try {
    const cl = (ped && ped.cliente) || {};
    const waId = String(cl.waId || "").replace(/\D/g, "");
    if (cl.origen !== "whatsapp" || !waId) return { ok: false, motivo: "no es de WhatsApp" };
    const token = limpiar(env.WA_TOKEN);
    if (!token) return { ok: false, motivo: "sin WA_TOKEN" };
    const q = await db.collection("waNumeros").where("storeId", "==", storeId).get();
    const num = q.docs.find(d => (d.data().estado || "activo") === "activo");
    if (!num) return { ok: false, motivo: "la tienda no tiene número activo" };
    const g = await db.doc("tiendas/" + storeId + "/config/general").get();
    const cfg = g.exists ? g.data() : {};
    const quien = String(cl.nombre || "").trim().split(/\s+/)[0];
    const body = "✅ ¡Pago recibido" + (quien && quien !== "Cliente" ? ", " + quien : "") + "! Tu pedido *#" + ped.id + "* está confirmado y *" + (cfg.nombre || "la tienda") + "* ya lo está preparando.\n\n" +
      "Total pagado: *" + plata(ped.total) + "*" + (ped.tipo === "delivery" ? "\n🛵 Va a " + (cl.direccion || "tu dirección") : "\n🏪 Retiro en " + (cl.local || "el local")) +
      (cfg.tiempoEntrega && ped.tipo === "delivery" ? "\n⏱️ Tiempo estimado: " + cfg.tiempoEntrega : "") + "\n\n¡Gracias por tu compra! 🙌";
    const r = await fetch(GRAPH + num.id + "/messages", { method: "POST", headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: waId, type: "text", text: { preview_url: false, body } }) });
    if (!r.ok) throw new Error("Meta " + r.status);
    const d = num.data(), mes = new Date().toISOString().slice(0, 7);
    const uso = d.uso && d.uso.mes === mes ? Object.assign({}, d.uso) : { mes, recibidos: 0, enviados: 0, bloqueados: 0 };
    uso.enviados = (Number(uso.enviados) || 0) + 1; uso.pedidos = (Number(uso.pedidos) || 0) + 1;
    await db.doc("waNumeros/" + num.id).set({ uso }, { merge: true });
    const chat = db.doc("tiendas/" + storeId + "/waChats/" + waId), c = await chat.get();
    await chat.set({ conv: null, ultimoPedido: { id: ped.id, en: new Date().toISOString(), pagado: true }, pedidos: ((c.exists && Number(c.data().pedidos)) || 0) + 1 }, { merge: true });
    return { ok: true };
  } catch(e){ console.warn("aviso WhatsApp:", e.message); return { ok: false, motivo: e.message }; }
}
