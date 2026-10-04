/* Vuelca a reglas.json todas las reglas CSS que usa la tienda de comida: la hoja de index.html,
   tienda-escritorio.css y las que app.js y panel-inventario.js agregan al vuelo.
   Uso:  node volcar.js http://localhost:8787     (necesita Playwright; la carpeta del proyecto servida
   en modo demo, es decir con apiKey "PEGAR_AQUÍ" en app.js). Después: node generar.js */
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const fs = require("fs");
const path = require("path");
const BASE = process.argv[2] || "http://localhost:8787";
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  pg.on("pageerror", e => console.log("ERR", e.message.slice(0, 150)));
  await pg.goto(BASE + "/index.html"); await pg.waitForTimeout(2300);
  await pg.evaluate(() => { const s = document.querySelector("#splashScreen"); if (s) s.remove(); renderAll(); });
  await pg.waitForTimeout(400);
  const ev = f => pg.evaluate(f).catch(e => console.log("!!", e.message.slice(0, 120)));
  await ev(() => { const p = state.productos.find(x => x.gruposExtras && x.gruposExtras.length) || state.productos[0]; abrirDetProducto(p.id); }); await pg.waitForTimeout(600);
  await ev(() => { irPagina("inicio"); agregarAlCarrito(state.productos[0].id); abrirCarrito(); }); await pg.waitForTimeout(400);
  await ev(() => { cerrarCarrito(); irPagina("checkout"); }); await pg.waitForTimeout(400);
  await ev(() => { try { gxCss(); } catch(e){} activarDevmode(); document.querySelector("#adminPanel").classList.add("open"); if (typeof v26PanelHome === "function") v26PanelHome(); }); await pg.waitForTimeout(600);
  for (const t of ["pedidos", "productos", "promos", "cupones", "zonas", "finanzas", "inventario", "emails", "notif", "config"]){ await pg.evaluate(t => { try { v26PanelIr(t); } catch(e){} }, t).catch(() => {}); await pg.waitForTimeout(500); }
  await ev(() => { try { v28AvisoPro("Plan Pro"); } catch(e){} });
  await pg.addScriptTag({ url: "/panel-inventario.js" }).catch(e => console.log("inv:", e.message));
  await ev(() => { const d = document.createElement("div"); document.body.appendChild(d); try { window.DLInv.montar({ raiz: d, clasico: null, api: async () => { throw new Error("x"); }, toast: () => {}, productos: () => [], grupos: () => [] }); } catch(e){ console.log(e); } });
  await pg.waitForTimeout(500);
  const out = await pg.evaluate(() => {
    const res = [];
    const walk = (rules, ctx, hoja) => { for (const r of rules){
      if (r instanceof CSSStyleRule) res.push({ hoja, ctx: ctx.slice(), sel: r.selectorText, css: r.style.cssText });
      else if (r instanceof CSSMediaRule) walk(r.cssRules, ctx.concat("@media " + r.conditionText), hoja);
      else if (typeof CSSSupportsRule !== "undefined" && r instanceof CSSSupportsRule) walk(r.cssRules, ctx.concat("@supports " + r.conditionText), hoja);
    } };
    [...document.styleSheets].forEach((s, i) => { const o = s.ownerNode; const nombre = o.tagName === "LINK" ? o.getAttribute("href") : "style#" + (o.id || i);
      if (/oscuro|fonts\.googleapis/.test(nombre)) return;
      let rules; try { rules = s.cssRules; } catch(e){ return; }
      const media = o.tagName === "LINK" && o.media && o.media !== "all" ? ["@media " + o.media] : [];
      walk(rules, media, nombre); });
    return res;
  });
  fs.writeFileSync(path.join(__dirname, "reglas.json"), JSON.stringify(out));
  const hojas = {}; out.forEach(r => hojas[r.hoja] = (hojas[r.hoja] || 0) + 1); console.log(hojas, out.length);
  await b.close();
})();
