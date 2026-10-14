/* cloudflare/functions/recuperarClave.js
   "¿Olvidaste tu contraseña?" con correo propio de DerLabs (hola@derlabs.cl,
   vía Resend). Firebase genera el link seguro (service account) y nosotros
   mandamos el correo. Responde SIEMPRE lo mismo, exista o no la cuenta, para
   no revelar qué correos están registrados. Máx. 1 correo por email cada 60 s. */
import { getDb, corsHeaders, authRest } from "./_firebase.js";

const esc = t => String(t || "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

async function hashEmail(email){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  return Array.from(new Uint8Array(b), x => ("0" + x.toString(16)).slice(-2)).join("").slice(0, 40);
}

export async function recuperarClave(request, env){
  const headers = Object.assign({}, corsHeaders(), { "Cache-Control": "no-store" });
  const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers });
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers });
  if (request.method !== "POST") return json({ ok:false, error:"Usa POST" }, 405);
  let b = {}; try { b = JSON.parse(await request.text() || "{}"); } catch(e){}
  const email = String(b.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok:false, error:"Correo inválido" }, 400);
  const tienda = String(b.tienda || "").trim().slice(0, 60);
  const dominio = String(b.dominio || "").trim().toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 80);
  try {
    const db = getDb(env);
    const ref = db.doc("recuperaciones_clave/" + await hashEmail(email));
    const prev = await ref.get();
    if (prev.exists && Date.now() - Date.parse(prev.data().en || 0) < 60000) return json({ ok:true });
    await ref.set({ en: new Date().toISOString() });
    let link = "";
    try { link = (await authRest(":sendOobCode", { requestType: "PASSWORD_RESET", email, returnOobLink: true })).oobLink || ""; }
    catch(e){ console.log("recuperarClave: sin cuenta o error:", e.message); }
    if (!link) return json({ ok:true });
    if (!env.RESEND_API_KEY) throw new Error("sin RESEND_API_KEY");
    const html = '<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;padding:28px 12px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden">' +
      '<div style="background:#111;color:#fff;padding:22px 26px;font-size:22px;font-weight:800;letter-spacing:.5px">DerLabs</div>' +
      '<div style="padding:26px;color:#222;font-size:15px;line-height:1.6">' +
      '<h1 style="font-size:20px;margin:0 0 12px">Crea o recupera tu contraseña</h1>' +
      '<p>Recibimos una solicitud para crear o cambiar la contraseña de <b>' + esc(email) + '</b>' + (tienda ? ' en <b>' + esc(tienda) + '</b>' : '') + '.</p>' +
      '<p style="text-align:center;margin:26px 0"><a href="' + esc(link) + '" style="display:inline-block;background:#111;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold">Crear nueva contraseña</a></p>' +
      '<p style="font-size:13px;color:#666">El enlace vence en 1 hora. Si no fuiste tú, ignora este correo: tu cuenta sigue segura.</p>' +
      (dominio ? '<p style="font-size:13px;color:#666">Tu tienda: <a href="https://' + esc(dominio) + '" style="color:#111">' + esc(dominio) + '</a></p>' : '') +
      '</div><div style="padding:16px 26px;border-top:1px solid #eee;font-size:12px;color:#888">DerLabs · derlabs.cl</div></div></div>';
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "DerLabs <hola@derlabs.cl>", to: [email], subject: "Crea o recupera tu contraseña de DerLabs", html })
    });
    if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 150));
    return json({ ok:true });
  } catch(e){
    console.error("recuperarClave:", e.message);
    return json({ ok:false, error:"No se pudo enviar el correo, intenta de nuevo en unos minutos" }, 500);
  }
}
