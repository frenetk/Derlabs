/* cloudflare/functions/_waAviso.js — P67 · Aviso por WhatsApp cuando se confirma un pago online.
   P68 · revisarPagosWA: recordatorio a los 7 minutos sin pago y vencimiento a los 15.
   Lo llaman webhookPago (MercadoPago) y flow.js (Webpay) después de crear el pedido.
   Solo actúa si el pedido vino del asistente (cliente.origen === "whatsapp"). Nunca hace
   fallar el pedido: cualquier error queda en el registro y sigue. */
const GRAPH = "https://graph.facebook.com/v21.0/";
const plata = n => "$" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const AVISO_MIN = 7, VENCE_MIN = 15;   /* P68: igual que PAGO_AVISO_MIN / PAGO_VENCE_MIN de _waBot.js */
const horaCL = ms => new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
const limpiar = t => String(t || "").replace(/^\s*["']?\s*(Bearer\s+)?/i, "").replace(/["']?\s*$/, "").replace(/\s+/g, "");

async function numeroActivo(db, storeId){
  const q = await db.collection("waNumeros").where("storeId", "==", storeId).get();
  return q.docs.find(d => (d.data().estado || "activo") === "activo") || null;
}
async function mandar(env, phoneId, cuerpo){
  const token = limpiar(env.WA_TOKEN);
  if (!token) throw new Error("sin WA_TOKEN");
  const r = await fetch(GRAPH + phoneId + "/messages", { method: "POST", headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ messaging_product: "whatsapp" }, cuerpo)) });
  if (!r.ok) throw new Error("Meta " + r.status);
}
async function contarEnvio(db, num, extra){
  const d = num.data(), mes = new Date().toISOString().slice(0, 7);
  const uso = d.uso && d.uso.mes === mes ? Object.assign({}, d.uso) : { mes, recibidos: 0, enviados: 0, bloqueados: 0 };
  uso.enviados = (Number(uso.enviados) || 0) + 1;
  if (extra) uso.pedidos = (Number(uso.pedidos) || 0) + 1;
  await db.doc("waNumeros/" + num.id).set({ uso }, { merge: true });
}

/* P68 · cada minuto (cron "* * * * *"): a los 7 min sin pago, recordatorio con el link;
   a los 15, el link vence: se avisa al cliente y la conversación vuelve a empezar. */
export async function revisarPagosWA(env, db, ahoraMs){
  const ahora = ahoraMs || Date.now(), res = { recordados: 0, vencidos: 0 };
  try {
    const q = await db.collection("waPagos").where("estado", "==", "esperando").get();
    for (const doc of q.docs){
      const p = doc.data(), edad = (ahora - Date.parse(p.creadoEn)) / 60000;
      try {
        if (edad >= VENCE_MIN){
          await db.doc("waPagos/" + doc.id).set({ estado: "vencido", vencidoEn: new Date(ahora).toISOString() }, { merge: true });
          const ped = await db.doc("tiendas/" + p.storeId + "/pedidos/" + p.pedidoId).get();
          if (ped.exists) continue;   /* se pagó justo: el aviso de pago ya salió */
          const num = await numeroActivo(db, p.storeId); if (!num) continue;
          await mandar(env, num.id, { to: p.waId, type: "interactive", interactive: { type: "button",
            body: { text: "⌛ El link de pago del pedido *#" + p.pedidoId + "* venció y el pedido no se procesó.\n\nSi todavía lo quieres, empecemos otra vez 🙂" },
            action: { buttons: [{ type: "reply", reply: { id: "menu", title: "📋 Ver menú" } }] } } });
          await contarEnvio(db, num);
          const chat = db.doc("tiendas/" + p.storeId + "/waChats/" + p.waId), c = await chat.get();
          if (c.exists && String(c.data().conv || "").includes(p.pedidoId)) await chat.set({ conv: null }, { merge: true });
          res.vencidos++;
        } else if (edad >= AVISO_MIN && !p.recordado){
          await db.doc("waPagos/" + doc.id).set({ recordado: true, recordadoEn: new Date(ahora).toISOString() }, { merge: true });
          const num = await numeroActivo(db, p.storeId); if (!num) continue;
          await mandar(env, num.id, { to: p.waId, type: "interactive", interactive: { type: "cta_url",
            body: { text: "⏳ Estamos esperando tu pago para procesar el pedido *#" + p.pedidoId + "*.\n\nTienes hasta las " + horaCL(Date.parse(p.creadoEn) + VENCE_MIN * 60000) + "; si no, deberás comenzar otra vez." },
            action: { name: "cta_url", parameters: { display_text: ("💳 Pagar " + plata(p.total)).slice(0, 20), url: p.url } } } });
          await contarEnvio(db, num);
          res.recordados++;
        }
      } catch(e){ console.warn("pago WA " + doc.id + ":", e.message); }
    }
  } catch(e){ console.warn("revisarPagosWA:", e.message); }
  return res;
}

export async function avisarPagoWA(db, env, storeId, ped){
  try {
    const cl = (ped && ped.cliente) || {};
    const waId = String(cl.waId || "").replace(/\D/g, "");
    if (cl.origen !== "whatsapp" || !waId) return { ok: false, motivo: "no es de WhatsApp" };
    if (!limpiar(env.WA_TOKEN)) return { ok: false, motivo: "sin WA_TOKEN" };
    try { const wp = db.doc("waPagos/" + ped.id); if ((await wp.get()).exists) await wp.set({ estado: "pagado", pagadoEn: new Date().toISOString() }, { merge: true }); } catch(e){}
    const num = await numeroActivo(db, storeId);
    if (!num) return { ok: false, motivo: "la tienda no tiene número activo" };
    const g = await db.doc("tiendas/" + storeId + "/config/general").get();
    const cfg = g.exists ? g.data() : {};
    const quien = String(cl.nombre || "").trim().split(/\s+/)[0];
    const body = "✅ ¡Pago recibido" + (quien && quien !== "Cliente" ? ", " + quien : "") + "! Tu pedido *#" + ped.id + "* está confirmado y *" + (cfg.nombre || "la tienda") + "* ya lo está preparando.\n\n" +
      "Total pagado: *" + plata(ped.total) + "*" + (ped.tipo === "delivery" ? "\n🛵 Va a " + (cl.direccion || "tu dirección") : "\n🏪 Retiro en " + (cl.local || "el local")) +
      (cfg.tiempoEntrega && ped.tipo === "delivery" ? "\n⏱️ Tiempo estimado: " + cfg.tiempoEntrega : "") + "\n\n¡Gracias por tu compra! 🙌";
    await mandar(env, num.id, { to: waId, type: "text", text: { preview_url: false, body } });
    await contarEnvio(db, num, true);
    const chat = db.doc("tiendas/" + storeId + "/waChats/" + waId), c = await chat.get();
    await chat.set({ conv: null, ultimoPedido: { id: ped.id, en: new Date().toISOString(), pagado: true }, pedidos: ((c.exists && Number(c.data().pedidos)) || 0) + 1 }, { merge: true });
    return { ok: true };
  } catch(e){ console.warn("aviso WhatsApp:", e.message); return { ok: false, motivo: e.message }; }
}
