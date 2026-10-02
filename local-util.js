/* local-util.js — compartido por /caja y /cocina.
   · DL.extras: grupos de extras/armado de un producto y su precio (misma
     lógica que gxCalcular en app.js y calcularExtras en _firebase.js: el
     servidor recalcula y manda; esto es solo para mostrar el precio).
   · DL.est: estación de un producto (cocina / barra) según su categoría.
   · DL.print: impresión de comandas, precuentas y comprobantes en
     impresoras térmicas. Dos métodos, se elige por equipo:
       - "rawbt": directo, sin diálogo, con la app RawBT en Android
         (Bluetooth, USB o red). Se envían bytes ESC/POS.
       - "sistema": el diálogo de impresión del navegador, con formato de
         58 u 80 mm. Sirve en cualquier computador con la impresora instalada.
     La configuración es de cada equipo (localStorage), no de la tienda. */
(function(){
  "use strict";
  var DL = window.DL = window.DL || {};

  /* ───────────── Extras ───────────── */
  function calcular(prod, lib, sel){
    var ids = Array.isArray(prod && prod.gruposExtras) ? prod.gruposExtras : [];
    var mapa = {};
    (Array.isArray(lib) ? lib : []).forEach(function(g){ if (g && g.id) mapa[g.id] = g; });
    sel = (sel && typeof sel === "object") ? sel : {};
    var r = { ok: true, error: "", falta: null, faltaId: null, unit: 0, variantes: {}, detalle: [], sel: {}, nombres: [] };
    ids.forEach(function(gid){
      var g = mapa[gid];
      if (!g) return;
      var ops = (Array.isArray(g.opciones) ? g.opciones : []).filter(function(o){ return o && o.id && String(o.nombre || "").trim(); });
      if (!ops.length) return;
      var nombreG = String(g.nombre || "Extras").trim();
      r.nombres.push(nombreG);
      var tipo = ["uno", "varios", "cantidad", "quitar"].indexOf(g.tipo) >= 0 ? g.tipo : "uno";
      var req = tipo !== "quitar" && g.obligatorio === true;
      var max = Math.max(0, Math.floor(Number(g.max) || 0));
      var s = (sel[gid] && typeof sel[gid] === "object") ? sel[gid] : {};
      var elegidas = [], total = 0;
      ops.forEach(function(o){
        var c = Math.floor(Number(s[o.id]) || 0);
        if (c <= 0) return;
        if (o.activo === false){ if (r.ok){ r.ok = false; r.error = "\"" + o.nombre + "\" no está disponible ahora"; } return; }
        if (tipo === "cantidad"){ var lim = max || 10; if (c > lim) c = lim; } else c = 1;
        elegidas.push({ o: o, c: c }); total += c;
      });
      if (tipo === "uno" && elegidas.length > 1){ elegidas = elegidas.slice(0, 1); total = 1; }
      if (tipo === "varios" && max && elegidas.length > max){ elegidas = elegidas.slice(0, max); total = max; }
      if (req && total < 1 && r.ok){ r.ok = false; r.falta = nombreG; r.faltaId = gid; r.error = "falta completar «" + nombreG + "»"; }
      if (!elegidas.length) return;
      var textos = [];
      r.sel[gid] = {};
      elegidas.forEach(function(e){
        var precio = tipo === "quitar" ? 0 : Math.max(0, Math.round(Number(e.o.precio) || 0));
        r.unit += precio * e.c;
        r.sel[gid][e.o.id] = e.c;
        r.detalle.push({ grupo: nombreG, opcion: String(e.o.nombre).trim(), cantidad: e.c, precio: precio });
        var n = String(e.o.nombre).trim();
        textos.push(tipo === "quitar" ? "sin " + n.toLowerCase() : (e.c > 1 ? n + " x" + e.c : n));
      });
      r.variantes[nombreG] = textos.join(", ");
    });
    return r;
  }
  function gruposDe(prod, lib){
    var mapa = {};
    (Array.isArray(lib) ? lib : []).forEach(function(g){ if (g && g.id) mapa[g.id] = g; });
    return (Array.isArray(prod && prod.gruposExtras) ? prod.gruposExtras : []).map(function(id){ return mapa[id]; })
      .filter(function(g){ return g && (g.opciones || []).some(function(o){ return o && o.id && String(o.nombre || "").trim(); }); });
  }
  DL.extras = { calcular: calcular, gruposDe: gruposDe };

  /* ───────────── Estaciones ───────────── */
  DL.est = {
    /* barra = lista de categorías que van a la barra; todo lo demás es cocina */
    de: function(categoria, barra){
      var c = String(categoria || "").trim().toLowerCase();
      return (Array.isArray(barra) ? barra : []).some(function(b){ return String(b || "").trim().toLowerCase() === c; }) && c ? "barra" : "cocina";
    },
    nombre: function(e){ return e === "barra" ? "BARRA" : "COCINA"; }
  };

  /* ───────────── Impresión ───────────── */
  var CLAVE = "dl_impresion_v1";
  var DEF = { metodo: "no", ancho: 80, tildes: true, corte: true, autoComanda: true, autoPago: false, estacion: "todo" };
  function cfg(){
    var c = {};
    try { c = JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch(e){ c = {}; }
    var o = {}; Object.keys(DEF).forEach(function(k){ o[k] = (k in c) ? c[k] : DEF[k]; });
    return o;
  }
  function guardar(c){ try { localStorage.setItem(CLAVE, JSON.stringify(c)); } catch(e){} }
  function cols(c){ return Number((c || cfg()).ancho) === 58 ? 32 : 48; }

  /* Texto apto para la impresora: sin emojis ni símbolos raros */
  var CP850 = { "á":0xA0,"é":0x82,"í":0xA1,"ó":0xA2,"ú":0xA3,"ñ":0xA4,"Ñ":0xA5,"ü":0x81,"Ü":0x9A,"Á":0xB5,"É":0x90,"Í":0xD6,"Ó":0xE0,"Ú":0xE9,"¿":0xA8,"¡":0xAD,"°":0xF8,"«":0xAE,"»":0xAF };
  function limpiar(t){
    return String(t == null ? "" : t).replace(/×/g, "x").replace(/[–—·•]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, "...")
      .replace(/[^\x20-\x7EáéíóúñÑüÜÁÉÍÓÚ¿¡°«»]/g, "").replace(/\s+/g, " ").trim();
  }
  function sinTildes(t){ return t.normalize ? t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿¡«»°]/g, "") : t; }
  function partir(t, n){
    var out = [], pal = String(t).split(" "), lin = "";
    pal.forEach(function(p){
      while (p.length > n){ if (lin){ out.push(lin); lin = ""; } out.push(p.slice(0, n)); p = p.slice(n); }
      if (!lin) lin = p; else if ((lin + " " + p).length <= n) lin += " " + p; else { out.push(lin); lin = p; }
    });
    if (lin || !out.length) out.push(lin);
    return out;
  }
  var plata = function(n){ return "$" + Math.round(Number(n) || 0).toLocaleString("es-CL"); };
  var hora = function(iso){
    var d = new Date(iso || Date.now()); if (isNaN(d)) d = new Date();
    var z = function(n){ return (n < 10 ? "0" : "") + n; };
    return z(d.getDate()) + "/" + z(d.getMonth() + 1) + " " + z(d.getHours()) + ":" + z(d.getMinutes());
  };

  /* Un documento es una lista de líneas:
       { t, a:"l|c|r", b:negrita, g:grande, ind:sangría }  ·  { izq, der, b, g }  ·  { sep:true }  ·  { v:n líneas en blanco } */
  function aBytes(doc, c){
    var W = cols(c), out = [];
    var push = function(){ for (var i = 0; i < arguments.length; i++) out.push(arguments[i]); };
    /* txt escribe tal cual (los espacios alinean columnas); el texto ya viene limpio */
    var txt = function(s){
      if (!c.tildes) s = sinTildes(s);
      for (var i = 0; i < s.length; i++){ var ch = s[i], k = s.charCodeAt(i); push(k < 0x80 ? k : (CP850[ch] || 0x3F)); }
    };
    var esp = function(n){ return new Array(Math.max(0, n) + 1).join(" "); };
    push(0x1B, 0x40);                       /* iniciar */
    if (c.tildes) push(0x1B, 0x74, 0x02);   /* página de códigos 850 */
    doc.forEach(function(l){
      if (l.v){ for (var i = 0; i < l.v; i++) push(0x0A); return; }
      if (l.sep){ push(0x1B, 0x61, 0x00); txt(new Array(W + 1).join("-")); push(0x0A); return; }
      var w = l.g ? Math.floor(W / 2) : W;
      push(0x1B, 0x45, l.b ? 1 : 0, 0x1D, 0x21, l.g ? 0x11 : 0x00);
      if (l.izq != null){
        var der = limpiar(l.der), filas = partir(limpiar(l.izq), Math.max(6, w - der.length - 1));
        push(0x1B, 0x61, 0x00);
        filas.forEach(function(f, i){
          txt(i === 0 ? f + esp(Math.max(1, w - f.length - der.length)) + der : f);
          push(0x0A);
        });
      } else {
        push(0x1B, 0x61, l.a === "c" ? 1 : l.a === "r" ? 2 : 0);
        var ind = Math.max(0, Number(l.ind) || 0);
        partir(limpiar(l.t), w - ind).forEach(function(f){ txt(esp(ind) + f); push(0x0A); });
      }
      push(0x1B, 0x45, 0, 0x1D, 0x21, 0x00);
    });
    push(0x0A, 0x0A, 0x0A);
    if (c.corte) push(0x1D, 0x56, 0x42, 0x03);
    return out;
  }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(ch){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]; }); }
  function aHTML(doc){
    return doc.map(function(l){
      if (l.v) return '<div style="height:' + (l.v * 10) + 'px"></div>';
      if (l.sep) return '<div style="border-top:1px dashed #000;margin:4px 0"></div>';
      var st = "font-weight:" + (l.b ? 800 : 500) + ";font-size:" + (l.g ? 19 : 12.5) + "px;line-height:1.3;";
      if (l.izq != null) return '<div style="display:flex;gap:8px;' + st + '"><span style="flex:1">' + esc(limpiar(l.izq)) + '</span><span>' + esc(limpiar(l.der)) + '</span></div>';
      return '<div style="text-align:' + (l.a === "c" ? "center" : l.a === "r" ? "right" : "left") + ";" + (l.ind ? "padding-left:" + (l.ind * 6) + "px;" : "") + st + '">' + esc(limpiar(l.t)) + '</div>';
    }).join("");
  }
  function b64(bytes){ var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }

  /* Imprime uno o varios documentos. Devuelve true si se mandó a imprimir. */
  function imprimir(docs){
    var c = cfg();
    docs = (Array.isArray(docs[0]) ? docs : [docs]).filter(function(d){ return d && d.length; });
    if (!docs.length) return false;
    if (c.metodo === "rawbt"){
      var todo = []; docs.forEach(function(d){ todo = todo.concat(aBytes(d, c)); });
      var a = document.createElement("a"); a.href = "rawbt:base64," + b64(todo); a.style.display = "none";
      document.body.appendChild(a); a.click(); setTimeout(function(){ a.remove(); }, 500);
      return true;
    }
    if (c.metodo === "sistema"){
      var area = document.getElementById("dlPrintArea");
      if (!area){
        area = document.createElement("div"); area.id = "dlPrintArea"; document.body.appendChild(area);
        var st = document.createElement("style");
        st.textContent = "#dlPrintArea{display:none}@media print{body>*:not(#dlPrintArea){display:none!important}#dlPrintArea{display:block!important;color:#000;background:#fff;font-family:Arial,Helvetica,sans-serif}" +
          ".dl-tk{page-break-after:always;padding:2mm 2mm 6mm}.dl-tk:last-child{page-break-after:auto}}";
        document.head.appendChild(st);
      }
      var mm = Number(c.ancho) === 58 ? 58 : 80;
      var pg = document.getElementById("dlPrintPage"); if (pg) pg.remove();
      pg = document.createElement("style"); pg.id = "dlPrintPage"; pg.textContent = "@page{size:" + mm + "mm auto;margin:0}@media print{#dlPrintArea{width:" + (mm - 4) + "mm}}";
      document.head.appendChild(pg);
      area.innerHTML = docs.map(function(d){ return '<div class="dl-tk">' + aHTML(d) + '</div>'; }).join("");
      setTimeout(function(){ window.print(); }, 60);
      return true;
    }
    return false;
  }

  /* ── Documentos ── */
  function lineasItem(it, conPrecio){
    var out = [];
    var nombre = (it.cantidad || 1) + " x " + (it.nombre || "");
    if (conPrecio) out.push({ izq: nombre, der: plata((it.precio || 0) * (it.cantidad || 1)) });
    else out.push({ t: nombre, b: true, g: true });
    var v = it.variantes && typeof it.variantes === "object" ? it.variantes : null;
    if (v) Object.keys(v).forEach(function(k){ if (v[k]) out.push({ t: (conPrecio ? "" : k + ": ") + v[k], ind: 3 }); });
    var nota = it.nota || it.notaPersonal;
    if (nota && !conPrecio) out.push({ t: "NOTA: " + nota, b: true, ind: 3 });
    return out;
  }
  /* comanda: { estacion, titulo, sub, items, nota, quien, fecha } */
  function docComanda(c){
    var d = [{ t: DL.est.nombre(c.estacion), a: "c", b: true }, { t: c.titulo || "", a: "c", b: true, g: true }];
    if (c.sub) d.push({ t: c.sub, a: "c" });
    d.push({ t: hora(c.fecha) + (c.quien ? " · " + c.quien : ""), a: "c" }, { sep: true });
    (c.items || []).forEach(function(it){ d = d.concat(lineasItem(it, false)); d.push({ v: 1 }); });
    if (c.nota){ d.push({ sep: true }, { t: "NOTA DEL PEDIDO: " + c.nota, b: true }); }
    return d;
  }
  /* Separa los productos de una comanda por estación y arma un documento por cada una */
  function comandas(c, barra, soloEstacion){
    var grupos = { cocina: [], barra: [] };
    (c.items || []).forEach(function(it){ grupos[DL.est.de(it.cat, barra)].push(it); });
    return ["cocina", "barra"].filter(function(e){ return grupos[e].length && (!soloEstacion || soloEstacion === "todo" || soloEstacion === e); })
      .map(function(e){ return docComanda(Object.assign({}, c, { estacion: e, items: grupos[e] })); });
  }
  function cabecera(tienda, titulo, p, lugar){
    return [{ t: tienda || "", a: "c", b: true, g: true }, { t: titulo, a: "c", b: true }, { t: (lugar ? lugar + " · " : "") + "#" + (p.id || "") , a: "c" }, { t: hora(), a: "c" }, { sep: true }];
  }
  function docPrecuenta(p, tienda, lugar){
    var its = (p.items || []).filter(function(i){ return !i.anulado; });
    var base = Math.max(0, (p.subtotal || 0) - (p.descuentoLocal || 0)), sug = Math.round((p.subtotal || 0) * 0.1 / 10) * 10;
    var d = cabecera(tienda, "PRE-CUENTA", p, lugar);
    its.forEach(function(it){ d = d.concat(lineasItem(it, true)); });
    d.push({ sep: true });
    if (p.descuentoLocal) d.push({ izq: "Consumo", der: plata(p.subtotal) }, { izq: "Descuento", der: "-" + plata(p.descuentoLocal) });
    d.push({ izq: "TOTAL", der: plata(base), b: true }, { izq: "Propina sugerida 10%", der: plata(sug) }, { izq: "TOTAL CON PROPINA", der: plata(base + sug), b: true },
      { v: 1 }, { t: "La propina es voluntaria.", a: "c" }, { t: "Documento interno. No es boleta.", a: "c" });
    return d;
  }
  function docComprobante(p, tienda, lugar){
    var its = (p.items || []).filter(function(i){ return !i.anulado; });
    var d = cabecera(tienda, "COMPROBANTE DE PAGO", p, lugar);
    its.forEach(function(it){ d = d.concat(lineasItem(it, true)); });
    d.push({ sep: true }, { izq: "Consumo", der: plata(p.subtotal) });
    if (p.descuentoLocal) d.push({ izq: "Descuento", der: "-" + plata(p.descuentoLocal) });
    if (p.propina) d.push({ izq: "Propina", der: plata(p.propina) });
    d.push({ izq: "TOTAL", der: plata(Math.max(0, (p.subtotal || 0) - (p.descuentoLocal || 0) + (p.propina || 0))), b: true }, { sep: true });
    (p.pagos || []).forEach(function(x){
      d.push({ izq: String(x.metodo || "").charAt(0).toUpperCase() + String(x.metodo || "").slice(1), der: plata(x.monto) });
      if (x.vuelto) d.push({ izq: "Recibido " + plata(x.recibido) + ", vuelto", der: plata(x.vuelto) });
    });
    d.push({ v: 1 }, { t: "Gracias por tu visita", a: "c", b: true }, { t: "Documento interno. No es boleta.", a: "c" });
    return d;
  }
  function docPrueba(tienda){
    return [{ t: tienda || "Prueba", a: "c", b: true, g: true }, { t: "PRUEBA DE IMPRESORA", a: "c", b: true }, { sep: true },
      { izq: "1 x Hamburguesa clásica", der: "$7.990" }, { t: "Extras: Tocino x2, sin cebolla", ind: 3 }, { izq: "TOTAL", der: "$7.990", b: true }, { sep: true },
      { t: "Tildes y eñe: áéíóú ñ Ñ ¿? ¡!", a: "c" }, { t: "Si esa línea sale con símbolos raros, desmarca la opción de tildes.", a: "c" }, { t: hora(), a: "c" }];
  }

  /* ── Ajustes del equipo (y, para el dueño, qué categorías van a la barra) ── */
  function abrirAjustes(o){
    o = o || {};
    var c = cfg(), barra = (o.barra || []).slice();
    var v = document.createElement("div");
    v.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center";
    var box = document.createElement("div");
    box.style.cssText = "background:#fff;color:#1a1a1a;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px;font:500 14px system-ui,sans-serif;box-sizing:border-box";
    v.appendChild(box); document.body.appendChild(v);
    var chk = function(k, t){ return '<label style="display:flex;gap:10px;align-items:center;padding:8px 0"><input type="checkbox" data-k="' + k + '"' + (c[k] ? " checked" : "") + ' style="width:20px;height:20px">' + t + '</label>'; };
    var op = function(k, val, t, sub){ var on = String(c[k]) === String(val); return '<button type="button" data-op="' + k + '" data-val="' + val + '" style="flex:1;min-width:0;padding:10px 8px;border-radius:12px;border:2px solid ' + (on ? "#1a1a1a" : "#ddd") + ";background:" + (on ? "#1a1a1a" : "#fff") + ";color:" + (on ? "#fff" : "#1a1a1a") + ';font:inherit;font-weight:800;cursor:pointer">' + t + (sub ? '<small style="display:block;font-weight:500;opacity:.8">' + sub + '</small>' : "") + '</button>'; };
    var pintar = function(){
      var cats = o.categorias || [];
      box.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:10px"><b style="flex:1;font-size:18px">🖨 Impresión de este equipo</b><button type="button" data-x style="border:0;background:#eee;border-radius:50%;width:38px;height:38px;font-size:16px;cursor:pointer">✕</button></div>' +
        '<div style="font-weight:800;margin:6px 0">Cómo imprime</div><div style="display:flex;gap:6px">' +
          op("metodo", "no", "Sin impresora", "solo pantallas") + op("metodo", "rawbt", "Directa", "Android + RawBT") + op("metodo", "sistema", "Del sistema", "computador") + '</div>' +
        (c.metodo === "rawbt" ? '<p style="margin:8px 0 0;font-size:12.5px;color:#555">Instala la app <b>RawBT</b> en este teléfono o tablet y elige ahí tu impresora (Bluetooth, USB o red). <a href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank" rel="noopener">Abrir en Google Play</a></p>' : "") +
        (c.metodo === "sistema" ? '<p style="margin:8px 0 0;font-size:12.5px;color:#555">Se abre el diálogo de impresión con el ticket ya formateado. Elige ahí tu impresora térmica.</p>' : "") +
        (c.metodo !== "no" ? '<div style="font-weight:800;margin:14px 0 6px">Ancho del papel</div><div style="display:flex;gap:6px">' + op("ancho", 58, "58 mm") + op("ancho", 80, "80 mm") + '</div>' +
          (c.metodo === "rawbt" ? chk("tildes", "Mi impresora imprime tildes y eñe") + chk("corte", "Cortar el papel al terminar") : "") +
          chk("autoComanda", o.pantalla === "cocina" ? "Imprimir cada comanda nueva al llegar" : "Imprimir la comanda al enviar a cocina") +
          (o.pantalla === "cocina" ? "" : chk("autoPago", "Imprimir el comprobante al cobrar")) : "") +
        ((o.barra || []).length || o.puedeEditarBarra ? '<div style="font-weight:800;margin:14px 0 6px">Este equipo ' + (c.metodo === "no" ? "muestra" : "imprime") + ' comandas de</div><div style="display:flex;gap:6px">' + op("estacion", "todo", "Todo") + op("estacion", "cocina", "Cocina") + op("estacion", "barra", "Barra") + '</div>' : "") +
        (o.puedeEditarBarra ? '<div style="font-weight:800;margin:16px 0 4px">Categorías que van a la barra</div><p style="margin:0 0 6px;font-size:12.5px;color:#555">Lo marcado sale en la comanda de BARRA; el resto, en COCINA. Vale para toda la tienda.</p><div style="display:flex;flex-wrap:wrap;gap:6px">' +
          (cats.length ? cats.map(function(k){ var on = barra.some(function(b){ return String(b).toLowerCase() === String(k).toLowerCase(); }); return '<button type="button" data-cat="' + esc(k) + '" style="padding:8px 12px;border-radius:999px;border:2px solid ' + (on ? "#1a1a1a" : "#ddd") + ";background:" + (on ? "#1a1a1a" : "#fff") + ";color:" + (on ? "#fff" : "#1a1a1a") + ';font:inherit;font-weight:700;cursor:pointer">' + esc(k) + '</button>'; }).join("") : '<span style="color:#777">Sin categorías todavía.</span>') + '</div>' : "") +
        '<div style="display:flex;gap:8px;margin-top:18px">' + (c.metodo !== "no" ? '<button type="button" data-prueba style="flex:1;height:48px;border-radius:999px;border:2px solid #1a1a1a;background:#fff;font:inherit;font-weight:800;cursor:pointer">Imprimir prueba</button>' : "") +
        '<button type="button" data-ok style="flex:1;height:48px;border-radius:999px;border:0;background:#1a1a1a;color:#fff;font:inherit;font-weight:800;cursor:pointer">Listo</button></div>';
    };
    var cerrar = function(){ v.remove(); if (o.alCerrar) o.alCerrar(cfg()); };
    pintar();
    v.addEventListener("click", function(e){
      var b;
      if (e.target === v || e.target.closest("[data-x]") || e.target.closest("[data-ok]")){ cerrar(); return; }
      if ((b = e.target.closest("[data-op]"))){ c[b.dataset.op] = b.dataset.op === "ancho" ? Number(b.dataset.val) : b.dataset.val; guardar(c); pintar(); return; }
      if (e.target.closest("[data-prueba]")){ imprimir(docPrueba(o.tienda)); return; }
      if ((b = e.target.closest("[data-cat]"))){
        var k = b.dataset.cat, i = barra.findIndex(function(x){ return String(x).toLowerCase() === k.toLowerCase(); });
        if (i >= 0) barra.splice(i, 1); else barra.push(k);
        o.barra = barra.slice(); pintar();
        if (o.guardarBarra) o.guardarBarra(barra.slice());
      }
    });
    v.addEventListener("change", function(e){ var k = e.target.dataset && e.target.dataset.k; if (k){ c[k] = e.target.checked; guardar(c); } });
  }

  DL.print = { cfg: cfg, activa: function(){ return cfg().metodo !== "no"; }, imprimir: imprimir, comandas: comandas, docComanda: docComanda,
               docPrecuenta: docPrecuenta, docComprobante: docComprobante, docPrueba: docPrueba, abrirAjustes: abrirAjustes, _bytes: aBytes, _html: aHTML };
})();
