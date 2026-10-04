/* Genera /tienda-oscuro.css (modo oscuro de la tienda de comida).
   Uso:  node generar.js      (desde esta carpeta; solo necesita Node)
   Toma reglas.json (todas las reglas de color de la tienda, las saca volcar.js), les cambia los colores
   claros por las variables --o-* y agrega cabecera.css (variables) y manual.css (retoques a mano). */
const fs = require("fs"), path = require("path");
const S = __dirname; const R = JSON.parse(fs.readFileSync(path.join(S, "reglas.json"), "utf8"));
const partir = (txt, sep) => { const out = []; let d = 0, q = null, cur = ""; for (const ch of txt){ if (q){ cur += ch; if (ch === q) q = null; continue; } if (ch === '"' || ch === "'"){ q = ch; cur += ch; continue; } if (ch === "(") d++; if (ch === ")") d--; if (ch === sep && d === 0){ out.push(cur); cur = ""; } else cur += ch; } if (cur.trim()) out.push(cur); return out; };
const decls = css => partir(css, ";").map(d => { const i = d.indexOf(":"); if (i < 0) return null; let prop = d.slice(0, i).trim().toLowerCase(), val = d.slice(i + 1).trim(), imp = false; if (/!important$/.test(val)){ imp = true; val = val.replace(/\s*!important$/, ""); } return { prop, val, imp }; }).filter(Boolean);
const tipo = prop => {
  if (prop.startsWith("--")) return null;
  if (/^(color|-webkit-text-fill-color|caret-color|fill|stroke|text-decoration|text-decoration-color)$/.test(prop)) return "txt";
  if (prop.startsWith("background")) return "bg";
  if ((prop.startsWith("border") && !/radius|collapse|spacing/.test(prop)) || prop.startsWith("outline") && prop !== "outline-offset" || prop.startsWith("column-rule")) return "bor";
  return null;
};
const RE_COLOR = /var\(--(?:rojo|rojo-h|verde)(?:,[^()]*)?\)|#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)|\b(?:white|black|gray|grey|silver|whitesmoke|gainsboro|lightgray|lightgrey|red|green|blue|orange|yellow)\b|var\(--(?:rojo|rojo-h|verde)(?:,[^()]*)?\)/g;
/* aplica f a cada color del valor, saltándose url(...) */
const sustituir = (val, f) => { let out = "", i = 0; const re = /url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g; let m; while ((m = re.exec(val))){ out += val.slice(i, m.index).replace(RE_COLOR, f) + m[0]; i = m.index + m[0].length; } return out + val.slice(i).replace(RE_COLOR, f); };
const NOMBRES = { white: [255,255,255,1], black: [0,0,0,1], gray: [128,128,128,1], grey: [128,128,128,1], silver: [192,192,192,1], whitesmoke: [245,245,245,1], gainsboro: [220,220,220,1], lightgray: [211,211,211,1], lightgrey: [211,211,211,1], red: [255,0,0,1], green: [0,128,0,1], blue: [0,0,255,1], orange: [255,165,0,1], yellow: [255,255,0,1] };
const rgba = t => { t = t.toLowerCase(); if (NOMBRES[t]) return NOMBRES[t].slice(); if (t[0] === "#"){ let h = t.slice(1); if (h.length <= 4) h = h.split("").map(c => c + c).join(""); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16), h.length === 8 ? parseInt(h.slice(6,8),16)/255 : 1]; }
  const m = /rgba?\(([^)]*)\)/.exec(t); if (!m) return null; const a = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); if (a.length < 3 || a.some(isNaN)) return null; return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const hsl = c => { const r = c[0]/255, g = c[1]/255, b = c[2]/255, mx = Math.max(r,g,b), mn = Math.min(r,g,b), l = (mx+mn)/2; let h = 0, s = 0; if (mx !== mn){ const d = mx - mn; s = l > .5 ? d/(2-mx-mn) : d/(mx+mn); h = mx === r ? (g-b)/d + (g<b?6:0) : mx === g ? (b-r)/d + 2 : (r-g)/d + 4; h *= 60; } return { h, s: s*100, l: l*100, croma: (mx-mn)*255 }; };
const hslRgb = (h, s, l) => { h /= 360; s /= 100; l /= 100; if (!s){ const v = Math.round(l*255); return [v,v,v,1]; } const q = l < .5 ? l*(1+s) : l+s-l*s, p = 2*l-q; const f = t => { if (t<0) t+=1; if (t>1) t-=1; return t<1/6 ? p+(q-p)*6*t : t<1/2 ? q : t<2/3 ? p+(q-p)*(2/3-t)*6 : p; }; return [Math.round(f(h+1/3)*255), Math.round(f(h)*255), Math.round(f(h-1/3)*255), 1]; };
const hex = c => "#" + c.slice(0,3).map(v => Math.round(v).toString(16).padStart(2,"0")).join("").toUpperCase();
const contraste = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); };
const L = { partir, decls, tipo, sustituir, rgba, lum, hsl, hslRgb, hex, contraste, RE_COLOR };

const neutro = c => { const h = L.hsl(c); return h.croma <= 6 || (h.h >= 15 && h.h <= 33 && h.croma <= 19) || (L.lum(c) < 0.03 && h.croma <= 16); };
const familia = c => { const h = L.hsl(c).h; return h >= 320 || h < 15 ? "rojo" : h < 68 ? "ambar" : h < 180 ? "verde" : h < 252 ? "azul" : "morado"; };
const V = (n, orig) => "var(--o-" + n + "," + orig + ")";
const alfaVelo = a => a <= .05 ? "a1" : a <= .08 ? "a2" : a <= .14 ? "a3" : "a4";
function mapear(tok, kind, sel, par){
  if (/^var\(/.test(tok)){
    if (kind === "bg") return tok;
    if (/^var\(--verde/.test(tok)) return V("c-verde", tok);
    return V("marca", tok);                                   /* var(--rojo) / var(--rojo-h) como texto o borde */
  }
  const c = L.rgba(tok); if (!c) return tok;
  const a = c[3], lu = L.lum(c), ne = neutro(c);
  if (a === 0) return tok;
  if (kind === "bg"){
    if (/vt-segs|vt-dots span\.on/.test(sel)) return tok;
    if (ne && lu < 0.02 && a < 1) return a <= .2 ? V(alfaVelo(a), tok) : tok;
    if (ne && lu > 0.9 && a < 1) return a >= .9 ? V("vidrio", tok) : tok;
    if (a < 1) return tok;
    if (ne){
      if (lu >= 0.93) return V("sup", tok);
      if (lu >= 0.75) return V("sup2", tok);
      if (lu >= 0.45) return V("sup3", tok);
      if (lu < 0.03 && par) return V("txt", tok);
      return tok;
    }
    if (lu >= 0.75) return V("t-" + familia(c), tok);
    return tok;
  }
  if (kind === "txt"){
    if (lu > 0.6) return par && lu > 0.95 && a === 1 ? V("fondo", tok) : tok;
    if (a < 1) return tok;
    if (ne) return lu < 0.09 ? V("txt", tok) : lu < 0.3 ? V("txt2", tok) : V("txt3", tok);
    if (lu < 0.45) return V("c-" + familia(c), tok);
    return tok;
  }
  /* bordes */
  if (ne && lu < 0.02 && a < 1) return a <= .3 ? V(alfaVelo(a), tok) : tok;
  if (a < 1) return tok;
  if (ne){
    if (lu >= 0.97) return /outline-white/.test(sel) ? tok : V("sup", tok);
    if (lu >= 0.66) return V("linea", tok);
    if (lu >= 0.45) return V("linea2", tok);
    if (lu < 0.1) return V("txt", tok);
    return tok;
  }
  if (lu >= 0.5) return V("b-" + familia(c), tok);
  return tok;
}
/* Todas las reglas suben exactamente lo mismo de prioridad (un atributo), para que entre ellas gane la misma de siempre. */
const prefijo = sel => L.partir(sel, ",").map(s => { s = s.trim(); if (/^(html|:root)(?![\w-])/.test(s)) return s.replace(/^(html|:root)/, m => m + '[data-tema="oscuro"]'); return '[data-tema="oscuro"] ' + s; }).join(",");
const grupos = []; let cambios = 0, total = 0;
R.forEach(r => {
  if (/data-tema/.test(r.sel) || r.ctx.some(c => /print/.test(c))) return;
  /* el inventario con recetas (Pro) carga sus estilos solo al abrirse y reutiliza el nombre .inv-num del stock simple */
  if (r.hoja === "style#invCss" && /\.inv-num/.test(r.sel)) return;
  const ds = L.decls(r.css).filter(d => L.tipo(d.prop)); if (!ds.length) return;
  /* botón "de tinta": fondo negro + letra blanca en la misma regla → se invierte */
  const par = ds.some(d => L.tipo(d.prop) === "bg" && (d.val.match(L.RE_COLOR) || []).some(t => { const c = L.rgba(t); return c && c[3] === 1 && neutro(c) && L.lum(c) < 0.03; }))
           && ds.some(d => d.prop === "color" && (() => { const c = L.rgba(d.val); return c && L.lum(c) > 0.95; })());
  /* letra blanca escrita a mano sobre el color de la tienda → usa el color de letra calculado para ese fondo */
  const sobreMarca = ds.some(d => L.tipo(d.prop) === "bg" && /var\(--rojo(-h)?\)/.test(d.val));
  const out = ds.map(d => {
    if (sobreMarca && d.prop === "color"){ const c = L.rgba(d.val); if (c && c[3] === 1 && L.lum(c) > 0.95){ cambios++; total++; return "color:var(--o-sobre," + d.val + ")" + (d.imp ? "!important" : ""); } } const k = L.tipo(d.prop); const v = L.sustituir(d.val, t => mapear(t, k, r.sel, par)); if (v !== d.val) cambios++; total++; return d.prop + ":" + v + (d.imp ? "!important" : ""); });
  const key = r.ctx.join(" && "); let g = grupos[grupos.length - 1]; if (!g || g.key !== key){ g = { key, ctx: r.ctx, lineas: [] }; grupos.push(g); }
  g.lineas.push(prefijo(r.sel) + "{" + out.join(";") + "}");
});
let css = "";
grupos.forEach(g => { const ab = g.ctx.map(c => c + "{").join(""), ce = g.ctx.map(() => "}").join(""); css += ab + (ab ? "\n" : "") + g.lineas.join("\n") + "\n" + ce + (ce ? "\n" : ""); });
const cab = fs.readFileSync(path.join(S, "cabecera.css"), "utf8"), manual = fs.readFileSync(path.join(S, "manual.css"), "utf8");
const final = cab + "\n/* ═══ 1. Reglas de la tienda, con los colores del modo oscuro (generadas) ═══ */\n" + css + "\n/* ═══ 2. Ajustes a mano ═══ */\n" + manual + "\n}\n";
fs.writeFileSync(path.join(S, "..", "..", "tienda-oscuro.css"), final);
console.log("reglas:", grupos.reduce((a, g) => a + g.lineas.length, 0), "declaraciones:", total, "cambiadas:", cambios, "bytes:", final.length);
