/* panel-inventario.js — Inventario con recetas (plan Pro) en el panel de la tienda de comida.
   Lo carga app.js (v44Inventario) la primera vez que se abre "Inventario" y lo monta con
   DLInv.montar({ raiz, clasico, api, productos, grupos, toast }).
     raiz     → dónde se dibuja (#invPro)
     clasico  → las tarjetas antiguas de stock por producto (#invClasico); van en la pestaña "Productos"
     api      → función que llama a /api/inventario con la sesión del dueño y devuelve la respuesta
     productos, grupos → funciones que devuelven los productos y los grupos de extras de la tienda
   Los datos viven en el servidor (cloudflare/functions/inventario.js). El stock y las cantidades de
   receta van siempre en la unidad chica (g, ml, unidades); aquí se muestran y se escriben en la que
   usa la gente: kilos o litros para el stock, gramos o ml para la receta. */
(function(){
  "use strict";
  var U = { kg: { chica: "g", grande: "kg", f: 1000, por: "el kg", pide: "kilos" }, l: { chica: "ml", grande: "L", f: 1000, por: "el litro", pide: "litros" }, un: { chica: "un", grande: "", f: 1, por: "c/u", pide: "unidades" } };
  var C = null, E = { tab: "insumos", d: null, movs: null };

  /* ── utilidades ── */
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function plata(n){ return "$" + Math.round(Number(n) || 0).toLocaleString("es-CL"); }
  function dec(n){ return (Math.round(n * 100) / 100).toLocaleString("es-CL", { maximumFractionDigits: 2 }); }
  function aNum(v){ var n = Number(String(v == null ? "" : v).replace(/\$/g, "").replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return isFinite(n) ? n : NaN; }
  function u(ins){ return U[ins && ins.unidad] || U.un; }
  function nombreUn(ins, n){ return ins.etiqueta || (n === 1 ? "unidad" : "unidades"); }
  /* stock y mínimo: en la unidad grande */
  function fStock(ins, chica){ return ins.unidad === "un" ? dec(chica) + " " + nombreUn(ins, chica) : dec(chica / u(ins).f) + " " + u(ins).grande; }
  /* cantidades de receta y movimientos: en la chica, o en la grande si es mucho */
  function fCant(ins, chica){
    if (!ins) return dec(chica);
    if (ins.unidad === "un") return dec(chica) + " " + (ins.etiqueta || "un");
    return Math.abs(chica) >= 1000 ? dec(chica / 1000) + " " + u(ins).grande : dec(chica) + " " + u(ins).chica;
  }
  function costoDe(ins, chica){ return ins ? (Number(ins.costo) || 0) * chica / u(ins).f : 0; }
  function ins(id){ return (E.d.insumos || []).filter(function(x){ return x.id === id; })[0] || null; }
  function prod(id){ return (C.productos() || []).filter(function(p){ return p.id === id; })[0] || null; }
  function receta(pid){ return (E.d.recetas || []).filter(function(r){ return r.p === pid; })[0] || null; }
  function extra(g, o){ return (E.d.extras || []).filter(function(e){ return e.g === g && e.o === o; })[0] || null; }
  function estado(x){ return x.stock <= 0 ? "cero" : x.stock < x.minimo ? "bajo" : "bien"; }
  function lista(nombres){ return nombres.length <= 1 ? nombres.join("") : nombres.slice(0, -1).join(", ") + " y " + nombres[nombres.length - 1]; }
  function qs(s, r){ return (r || document).querySelector(s); }

  async function llamar(cuerpo, boton){
    var txt = boton ? boton.textContent : "";
    if (boton){ boton.disabled = true; }
    try {
      var r = await C.api(cuerpo);
      if (r.insumos){ E.d = r; E.movs = null; }
      return r;
    } catch(e){ C.toast(e.message || "No se pudo guardar"); return null; }
    finally { if (boton){ boton.disabled = false; boton.textContent = txt; } }
  }

  /* ── estilos ── */
  function estilos(){
    if (qs("#invCss")) return;
    var st = document.createElement("style"); st.id = "invCss";
    st.textContent = [
      ".inv-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px;border-radius:14px;background:#F5F3F1;margin-bottom:12px}",
      ".inv-tabs button{min-height:44px;border:0;border-radius:10px;background:transparent;font:inherit;font-size:12.5px;font-weight:700;color:#5E5954;cursor:pointer;padding:0 2px}",
      ".inv-tabs button.on{background:#fff;color:inherit;font-weight:800;box-shadow:0 1px 2px rgba(0,0,0,.08)}",
      ".inv-aviso{border:1px solid #E6C9A0;border-radius:18px;padding:14px;background:#FFF8EC;margin-bottom:12px;text-align:left}",
      ".inv-aviso b{display:block;font-size:15px;font-weight:800}.inv-aviso p{margin:2px 0 10px;font-size:12.5px;font-weight:600;color:#5E4A2A;line-height:1.4}",
      ".inv-aviso.ok{border-color:#B9DCC4;background:#F1F9F3}.inv-aviso.ok p{color:#1F4D2E}",
      ".inv-fila2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}",
      ".inv-b{min-height:44px;border-radius:12px;border:1.5px solid #D9D4CF;background:#fff;font:inherit;font-size:13px;font-weight:800;cursor:pointer;color:inherit;padding:0 10px}",
      ".inv-b.osc{background:#1A1A1A;color:#fff;border-color:#1A1A1A}.inv-b.txt{border:0;background:none;color:#5E5954;width:100%;margin-top:4px}",
      ".inv-b:disabled{opacity:.5}",
      ".inv-res{display:flex;gap:8px;font-size:12.5px;font-weight:700;color:#5E5954;margin:0 2px 10px}.inv-res span:first-child{flex:1}",
      ".inv-ins{display:block;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;background:#fff}",
      ".inv-ins .l1{display:flex;align-items:center;gap:10px}.inv-ins .l1 b{flex:1;font-size:15px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".inv-ins .l2{display:flex;align-items:baseline;gap:8px;margin-top:4px}.inv-ins .l2 strong{font-size:22px;font-weight:800}.inv-ins .l2 em{font-style:normal;font-size:13px;font-weight:700;color:#5E5954}",
      ".inv-ins .l2 small{flex:1;text-align:right;font-size:12.5px;font-weight:600;color:#5E5954}",
      ".pchip.bad{background:#FBE4E4;color:#8C1D1D}",
      ".inv-pie{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:4px}",
      ".inv-vacio{font-size:13px;font-weight:600;color:#5E5954;text-align:center;padding:18px 8px;line-height:1.45}",
      ".inv-lin{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #ECE8E4}.inv-lin>div:first-child{flex:1;min-width:0}",
      ".inv-lin b{display:block;font-size:14px;font-weight:700}.inv-lin small{display:block;font-size:12.5px;font-weight:600;color:#5E5954;line-height:1.35}",
      ".inv-lin .cant{font-weight:800;white-space:nowrap}.inv-lin .cant.mas{color:#14562A}.inv-lin .cant.menos{color:#8C1D1D}",
      ".inv-num{display:flex;align-items:center;gap:6px;min-width:96px;min-height:44px;padding:0 10px;box-sizing:border-box;border:1.5px solid #D9D4CF;border-radius:12px;background:#fff}",
      ".inv-num input{width:100%;min-width:0;border:0;outline:0;background:none;font:inherit;font-weight:800;text-align:right;padding:0}.inv-num span{font-size:12.5px;font-weight:700;color:#5E5954;white-space:nowrap}",
      ".inv-x{width:44px;height:44px;flex:none;border:0;background:none;border-radius:12px;cursor:pointer;font-size:18px;color:#5E5954}",
      ".inv-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.inv-tiles>div{padding:12px 6px;border-radius:14px;background:#F7F5F3;text-align:center}",
      ".inv-tiles b{display:block;font-size:17px;font-weight:800}.inv-tiles small{display:block;font-size:12px;font-weight:700;color:#5E5954}",
      ".inv-tiles .ok{background:#E3F2E8}.inv-tiles .ok b,.inv-tiles .ok small{color:#14562A}.inv-tiles .mal{background:#FBE4E4}.inv-tiles .mal b,.inv-tiles .mal small{color:#8C1D1D}",
      "#invHoja{position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center}",
      "@media(min-width:600px){#invHoja{align-items:center}}",
      ".inv-hoja{width:100%;max-width:440px;max-height:92vh;overflow:auto;background:#fff;color:#1A1A1A;border-radius:22px 22px 0 0;padding:20px 16px calc(18px + env(safe-area-inset-bottom));box-sizing:border-box;text-align:left}",
      "@media(min-width:600px){.inv-hoja{border-radius:22px}}",
      ".inv-hoja h4{margin:0 0 4px;font-size:18px;font-weight:900;text-transform:none;letter-spacing:0;color:inherit}",
      ".inv-hoja .pnota{margin-bottom:10px}",
      ".inv-hoja .field{width:100%;box-sizing:border-box;min-height:46px;font-size:15px}",
      ".inv-seg{display:grid;gap:4px;padding:4px;border-radius:14px;background:#F5F3F1}.inv-seg.c3{grid-template-columns:repeat(3,minmax(0,1fr))}",
      ".inv-seg button{min-height:44px;border:0;border-radius:10px;background:transparent;font:inherit;font-size:13px;font-weight:700;color:#5E5954;cursor:pointer}",
      ".inv-seg button.on{background:#fff;color:inherit;font-weight:800;box-shadow:0 1px 2px rgba(0,0,0,.08)}",
      ".inv-calc{padding:12px;border-radius:14px;background:#F7F5F3;margin-top:10px;display:grid;gap:6px;font-size:14px}.inv-calc div{display:flex;gap:10px}.inv-calc span{flex:1;font-weight:600;color:#5E5954}.inv-calc b{font-weight:800}",
      ".inv-err{color:#8C1D1D;font-size:13px;font-weight:700;min-height:0;margin-top:8px}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ── hoja (modal) ── */
  function hoja(html){
    cerrarHoja();
    var o = document.createElement("div"); o.id = "invHoja";
    o.innerHTML = '<div class="inv-hoja" role="dialog" aria-modal="true">' + html + '</div>';
    o.addEventListener("click", function(e){ if (e.target === o || e.target.closest("[data-inv-cerrar]")) cerrarHoja(); });
    document.body.appendChild(o);
    return o.firstChild;
  }
  function cerrarHoja(){ var o = qs("#invHoja"); if (o) o.remove(); }

  /* ── pantalla ── */
  function pintar(){
    var r = C.raiz;
    r.innerHTML = '<div class="inv-tabs" role="tablist">' + [["insumos", "Insumos"], ["recetas", "Recetas"], ["historial", "Historial"], ["productos", "Productos"]].map(function(t){
      return '<button type="button" role="tab" data-inv-tab="' + t[0] + '"' + (E.tab === t[0] ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '>' + t[1] + '</button>'; }).join("") + '</div><div id="invCuerpo"></div>';
    if (C.clasico) C.clasico.style.display = E.tab === "productos" ? "" : "none";
    var c = qs("#invCuerpo", r);
    if (!E.d){ c.innerHTML = '<p class="inv-vacio">Cargando…</p>'; return; }
    c.innerHTML = E.tab === "insumos" ? hInsumos() : E.tab === "recetas" ? hRecetas() : E.tab === "historial" ? hHistorial() :
      '<p class="pnota" style="margin:0 2px 10px">Para lo que se vende tal cual (bebidas, por ejemplo): stock por producto, sin receta.</p>';
    if (E.tab === "historial" && !E.movs) cargarMovs();
  }

  function hInsumos(){
    var d = E.d, L = d.insumos || [], h = "";
    /* insumos que llegaron a 0: nada se agota solo, se pregunta */
    (d.avisos || []).forEach(function(a){
      var nombres = (a.usos || []).map(function(x){ var p = prod(x.p); return p ? p.nombre : null; }).filter(Boolean);
      h += '<div class="inv-aviso"><b>' + esc(a.nombre) + ' llegó a 0</b><p>' +
        (nombres.length ? (nombres.length === 1 ? "Lo usa " : "Lo usan " + nombres.length + " productos: ") + esc(lista(nombres)) + ". " : "Ningún producto con receta lo usa. ") +
        'Si todavía te queda, anota cuánto hay.</p><div class="inv-fila2"><button type="button" class="inv-b" data-inv-tengo="' + a.id + '">Todavía tengo</button>' +
        (nombres.length ? '<button type="button" class="inv-b osc" data-inv-agotar="' + a.id + '">Marcar agotados</button>' : '<button type="button" class="inv-b osc" data-inv-seguir="' + a.id + '">Entendido</button>') + '</div>' +
        (nombres.length ? '<button type="button" class="inv-b txt" data-inv-seguir="' + a.id + '">Seguir vendiendo sin cambiar nada</button>' : '') + '</div>';
    });
    /* insumos que volvieron y dejaron productos agotados */
    Object.keys(d.agotados || {}).forEach(function(i){
      var x = ins(i), ps = (d.agotados[i] || []).map(function(p){ var q = prod(p); return q ? q.nombre : null; }).filter(Boolean);
      if (!x || x.stock <= 0 || !ps.length) return;
      h += '<div class="inv-aviso ok"><b>Volvió a haber ' + esc(x.nombre) + '</b><p>' + (ps.length === 1 ? "Quedó agotado " : "Quedaron agotados ") + esc(lista(ps)) + '. ¿' + (ps.length === 1 ? "Lo vuelves" : "Los vuelves") + ' a vender?</p>' +
        '<div class="inv-fila2"><button type="button" class="inv-b" data-inv-dejar="' + i + '">Dejar agotados</button><button type="button" class="inv-b osc" data-inv-reactivar="' + i + '">Volver a vender</button></div></div>';
    });
    if (!L.length) return h + '<div class="pcard"><b class="pcard-t">Tus insumos</b><p class="inv-vacio">Agrega los ingredientes que quieres controlar: pan, carne, queso… Después le dices a cada producto cuánto lleva de cada uno, y cada venta los descuenta sola.</p>' +
      '<button type="button" class="pill pill-solid pill-sm panel-full" data-inv-nuevo>＋ Nuevo insumo</button></div>';
    var cero = L.filter(function(x){ return estado(x) === "cero"; }).length, bajo = L.filter(function(x){ return estado(x) === "bajo"; }).length;
    var bodega = L.reduce(function(t, x){ return t + costoDe(x, Math.max(0, x.stock)); }, 0);
    h += '<div class="inv-res"><span>' + L.length + (L.length === 1 ? " insumo" : " insumos") + (cero ? " · " + cero + " en cero" : "") + (bajo ? " · " + bajo + " bajo el mínimo" : "") + '</span>' + (d.dueno ? '<span>En bodega: ' + plata(bodega) + '</span>' : '') + '</div>';
    var orden = { cero: 0, bajo: 1, bien: 2 };
    L.slice().sort(function(a, b){ return orden[estado(a)] - orden[estado(b)]; }).forEach(function(x){
      var e = estado(x), n = x.unidad === "un" ? dec(x.stock) : dec(x.stock / u(x).f);
      h += '<button type="button" class="pcard inv-ins" data-inv-editar="' + x.id + '"><span class="l1"><b>' + esc(x.nombre) + '</b><span class="pchip ' + (e === "cero" ? "bad" : e === "bajo" ? "warn" : "ok") + '">' + (e === "cero" ? "En cero" : e === "bajo" ? "Bajo" : "Bien") + '</span></span>' +
        '<span class="l2"><strong>' + n + '</strong><em>' + esc(x.unidad === "un" ? nombreUn(x, x.stock) : u(x).grande) + '</em><small>Mínimo ' + esc(fStock(x, x.minimo)) + (d.dueno ? ' · ' + plata(x.costo) + ' ' + u(x).por : '') + '</small></span></button>';
    });
    return h + '<div class="inv-pie"><button type="button" class="pill pill-outline pill-sm" data-inv-nuevo>＋ Nuevo insumo</button><button type="button" class="pill pill-solid pill-sm" data-inv-mov>Anotar compra</button></div>';
  }

  function costoReceta(r){ return (r && r.items || []).reduce(function(t, l){ return t + costoDe(ins(l.i), l.c); }, 0); }
  function hRecetas(){
    var ps = (C.productos() || []).filter(function(p){ return p && p.activo !== false; });
    if (!(E.d.insumos || []).length) return '<div class="pcard"><p class="inv-vacio">Primero agrega tus insumos. Después vuelves aquí y le dices a cada producto cuánto lleva.</p></div>';
    if (!ps.length) return '<div class="pcard"><p class="inv-vacio">Todavía no hay productos.</p></div>';
    var con = ps.filter(function(p){ var r = receta(p.id); return r && r.activa !== false; }).length;
    var h = '<div class="inv-res"><span>' + con + ' de ' + ps.length + ' productos descuentan por receta</span></div><div class="pcard" style="padding-top:4px;padding-bottom:4px">';
    ps.forEach(function(p, k){
      var r = receta(p.id), on = r && r.activa !== false, costo = costoReceta(r), deja = (Number(p.precio) || 0) - costo;
      var sub = on ? r.items.length + (r.items.length === 1 ? " insumo" : " insumos") + (E.d.dueno ? " · cuesta " + plata(costo) + (p.precio > 0 ? " · deja " + Math.round(deja * 100 / p.precio) + "%" : "") : "")
        : r ? "Receta guardada, sin descontar" : "Sin receta";
      h += '<div class="inv-lin"' + (k === 0 ? ' style="border-top:0"' : '') + '><div><b>' + esc(p.nombre) + '</b><small>' + sub + '</small></div>' +
        '<button type="button" class="inv-b" data-inv-receta="' + esc(p.id) + '">' + (r ? "Editar" : "Armar") + '</button></div>';
    });
    return h + '</div>';
  }

  var TIPOS = { venta: "Venta", devolucion: "Devolución", compra: "Compra", merma: "Merma", conteo: "Conteo" };
  function hHistorial(){
    if (!E.movs) return '<p class="inv-vacio">Cargando…</p>';
    if (!E.movs.length) return '<div class="pcard"><p class="inv-vacio">Todavía no hay movimientos. Las ventas se anotan solas.</p></div>';
    var h = '<div class="pcard" style="padding-top:4px;padding-bottom:4px">';
    E.movs.forEach(function(m, k){
      var f = new Date(m.fecha), hoy = new Date().toDateString() === f.toDateString();
      var cuando = (hoy ? "hoy " : f.toLocaleDateString("es-CL", { day: "numeric", month: "short" }) + " ") + f.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
      /* el dueño no tiene nombre de usuario, solo su correo: no se muestra */
      var det = [m.lugar, m.nota, m.total ? plata(m.total) : "", cuando, /@/.test(m.por || "") ? "" : m.por].filter(Boolean).join(" · ");
      var its = (m.items || []), varios = its.length > 1;
      /* una venta de varios insumos lleva su título arriba; un movimiento de un solo insumo, debajo del nombre */
      if (varios) h += '<div class="inv-lin"' + (k === 0 ? ' style="border-top:0"' : '') + '><div><small style="font-weight:800;color:inherit">' + esc((TIPOS[m.tipo] || m.tipo) + (det ? " · " + det : "")) + '</small></div></div>';
      var cant = its.slice(0, 6).map(function(x){
        var s = ins(x.i), signo = x.c > 0 ? "+" : x.c < 0 ? "−" : "";
        var t = m.tipo === "conteo" && m.despues != null ? "= " + (s ? fCant(s, m.despues) : m.despues) : signo + (s ? fCant(s, Math.abs(x.c)) : dec(Math.abs(x.c)));
        return '<div class="inv-lin"' + (varios || (k === 0 && x === its[0]) ? ' style="border-top:0;padding-top:' + (varios ? "2px" : "10px") + '"' : '') + '><div><b>' + esc(x.n || (s && s.nombre) || "Insumo") + '</b>' + (varios ? "" : '<small>' + esc((TIPOS[m.tipo] || m.tipo) + (det ? " · " + det : "")) + '</small>') + '</div>' +
          '<span class="cant' + (m.tipo === "compra" ? " mas" : m.tipo === "merma" ? " menos" : "") + '">' + esc(t) + '</span></div>';
      }).join("");
      h += cant + (its.length > 6 ? '<div class="inv-lin" style="border-top:0;padding-top:2px"><div><small>y ' + (its.length - 6) + ' insumos más</small></div></div>' : '');
    });
    return h + '</div>';
  }
  async function cargarMovs(){
    var r = await llamar({ accion: "movimientos" });
    E.movs = r ? (r.movimientos || []) : [];
    if (E.tab === "historial") pintar();
  }

  /* ── hoja: insumo ── */
  function hojaInsumo(id){
    var x = id ? ins(id) : null, uni = x ? x.unidad : "kg";
    var campo = function(idc, lab, val, extra){ return '<label class="plabel" for="' + idc + '">' + lab + '</label><input class="field" id="' + idc + '" value="' + esc(val == null ? "" : val) + '" ' + (extra || 'inputmode="decimal"') + '>'; };
    var cuerpo = function(){
      var U_ = U[uni];
      return '<h4>' + (x ? "Editar insumo" : "Nuevo insumo") + '</h4><p class="pnota">' + (x ? "El stock se cambia con una compra, una merma o un conteo." : "Un ingrediente o envase que quieres controlar.") + '</p>' +
        campo("invNom", "Nombre", x ? x.nombre : "", 'maxlength="40" placeholder="Ej: Carne molida"') +
        (x ? '' : '<span class="plabel">Se mide en</span><div class="inv-seg c3">' + ["kg", "l", "un"].map(function(k){ return '<button type="button" data-inv-uni="' + k + '"' + (uni === k ? ' class="on"' : '') + '>' + (k === "kg" ? "Kilos" : k === "l" ? "Litros" : "Unidades") + '</button>'; }).join("") + '</div>') +
        (uni === "un" ? campo("invEti", "Cómo las llamas (opcional)", x ? x.etiqueta : "", 'maxlength="16" placeholder="Ej: láminas, panes, porciones"') : '') +
        (x ? '' : campo("invStock", "Cuánto tienes hoy (" + U_.pide + ")", "")) +
        '<div class="pgrid2" style="margin-top:10px"><div>' + campo("invMin", "Avisar bajo (" + U_.pide + ")", x ? (x.unidad === "un" ? x.minimo : x.minimo / U_.f) : "") + '</div>' +
        '<div>' + (E.d.dueno ? campo("invCosto", "Costo " + U_.por, x && x.costo ? x.costo : "", 'inputmode="numeric" placeholder="$"') : '') + '</div></div>' +
        '<div class="inv-err" id="invErr" role="alert"></div>' +
        '<button type="button" class="pill pill-solid pill-sm panel-full" id="invGuardar">' + (x ? "Guardar" : "Agregar insumo") + '</button>' +
        (x ? '<button type="button" class="inv-b txt" id="invBorrar" style="color:#8C1D1D">Eliminar insumo</button>' : '') +
        '<button type="button" class="inv-b txt" data-inv-cerrar>Cancelar</button>';
    };
    var h = hoja(cuerpo());
    h.addEventListener("click", async function(e){
      var b;
      if ((b = e.target.closest("[data-inv-uni]"))){ var nom = qs("#invNom", h).value; uni = b.dataset.invUni; h.innerHTML = cuerpo(); qs("#invNom", h).value = nom; return; }
      if ((b = e.target.closest("#invBorrar"))){
        var usan = (E.d.recetas || []).filter(function(r){ return r.items.some(function(l){ return l.i === x.id; }); }).length;
        if (!confirm("¿Eliminar «" + x.nombre + "»?" + (usan ? "\n\nSe quita de " + usan + (usan === 1 ? " receta." : " recetas.") : ""))) return;
        if (await llamar({ accion: "insumo", op: "borrar", id: x.id }, b)){ cerrarHoja(); pintar(); C.toast("Insumo eliminado"); }
        return;
      }
      if (!(b = e.target.closest("#invGuardar"))) return;
      var f = U[uni].f, er = qs("#invErr", h), val = function(s){ var el = qs(s, h); return el ? el.value : ""; };
      var nombre = val("#invNom").trim(), min = val("#invMin").trim() === "" ? 0 : aNum(val("#invMin")), costo = val("#invCosto").trim() === "" ? 0 : aNum(val("#invCosto")), st = val("#invStock").trim() === "" ? 0 : aNum(val("#invStock"));
      if (!nombre){ er.textContent = "Escribe el nombre."; return; }
      if (!(min >= 0) || !(costo >= 0) || !(st >= 0)){ er.textContent = "Revisa los números: solo cifras, cero o más."; return; }
      var cuerpoApi = { accion: "insumo", nombre: nombre, unidad: uni, etiqueta: val("#invEti").trim(), minimo: min * f, costo: costo };
      if (x) cuerpoApi.id = x.id; else cuerpoApi.stock = st * f;
      er.textContent = "";
      try { var r = await C.api(cuerpoApi); E.d = r; E.movs = null; cerrarHoja(); pintar(); C.toast(x ? "Insumo guardado" : "Insumo agregado"); }
      catch(err){ er.textContent = err.message || "No se pudo guardar"; }
    });
    var n = qs("#invNom", h); if (n && !x) n.focus();
  }

  /* ── hoja: compra, merma o conteo ── */
  function hojaMov(idIns, tipo){
    var L = E.d.insumos || [];
    if (!L.length){ C.toast("Primero agrega un insumo"); return; }
    var st = { tipo: tipo || "compra", ins: idIns || L[0].id, cant: "", total: "", nota: "" };
    var cuerpo = function(){
      var x = ins(st.ins), U_ = u(x), nomU = x.unidad === "un" ? (x.etiqueta || "unidades") : U_.grande;
      return '<h4>Anotar movimiento</h4><div class="inv-seg c3">' + [["compra", "Compra"], ["merma", "Merma"], ["conteo", "Conteo"]].map(function(t){ return '<button type="button" data-inv-tipo="' + t[0] + '"' + (st.tipo === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join("") + '</div>' +
        '<p class="pnota" style="margin-top:8px">' + (st.tipo === "compra" ? "Suma al stock lo que compraste." : st.tipo === "merma" ? "Resta lo que se perdió: se venció, se cayó, se regaló." : "Deja el stock en lo que contaste de verdad.") + '</p>' +
        '<label class="plabel" for="invMIns">Insumo</label><select class="field" id="invMIns">' + L.map(function(o){ return '<option value="' + o.id + '"' + (o.id === st.ins ? " selected" : "") + '>' + esc(o.nombre) + '</option>'; }).join("") + '</select>' +
        '<div class="pgrid2" style="margin-top:10px"><div><label class="plabel" for="invMCant">' + (st.tipo === "conteo" ? "Cuánto hay" : "Cantidad") + ' (' + esc(nomU) + ')</label><input class="field" id="invMCant" inputmode="decimal" value="' + esc(st.cant) + '"></div>' +
        '<div>' + (st.tipo === "compra" && E.d.dueno ? '<label class="plabel" for="invMTotal">Pagaste en total</label><input class="field" id="invMTotal" inputmode="numeric" placeholder="$" value="' + esc(st.total) + '">' : '') + '</div></div>' +
        '<label class="plabel" for="invMNota">Nota (opcional)</label><input class="field" id="invMNota" maxlength="80" value="' + esc(st.nota) + '" placeholder="' + (st.tipo === "compra" ? "Proveedor o factura" : st.tipo === "merma" ? "Qué pasó" : "") + '">' +
        '<div class="inv-calc" id="invMCalc"></div><div class="inv-err" id="invErr" role="alert"></div>' +
        '<button type="button" class="pill pill-solid pill-sm panel-full" id="invMGuardar">' + (st.tipo === "compra" ? "Guardar compra" : st.tipo === "merma" ? "Guardar merma" : "Guardar conteo") + '</button>' +
        '<button type="button" class="inv-b txt" data-inv-cerrar>Cancelar</button>';
    };
    var h = hoja(cuerpo());
    var leer = function(){ ["Cant", "Total", "Nota"].forEach(function(k){ var el = qs("#invM" + k, h); if (el) st[k === "Cant" ? "cant" : k === "Total" ? "total" : "nota"] = el.value; }); };
    var calc = function(){
      var x = ins(st.ins), c = aNum(st.cant) * u(x).f, t = aNum(st.total), filas = [];
      if (c > 0 || (st.tipo === "conteo" && c >= 0 && String(st.cant).trim() !== "")){
        if (st.tipo === "compra" && t > 0) filas.push(["Sale a", plata(t / aNum(st.cant)) + " " + u(x).por]);
        var desp = st.tipo === "compra" ? x.stock + c : st.tipo === "merma" ? x.stock - c : c;
        filas.push(["Hoy hay", fStock(x, x.stock)], ["Stock después", fStock(x, desp)]);
      } else filas.push(["Hoy hay", fStock(x, x.stock)]);
      qs("#invMCalc", h).innerHTML = filas.map(function(f){ return '<div><span>' + f[0] + '</span><b>' + esc(f[1]) + '</b></div>'; }).join("");
    };
    calc();
    h.addEventListener("input", function(){ leer(); calc(); });
    h.addEventListener("change", function(e){ if (e.target.id === "invMIns"){ leer(); st.ins = e.target.value; h.innerHTML = cuerpo(); calc(); } });
    h.addEventListener("click", async function(e){
      var b;
      if ((b = e.target.closest("[data-inv-tipo]"))){ leer(); st.tipo = b.dataset.invTipo; h.innerHTML = cuerpo(); calc(); return; }
      if (!(b = e.target.closest("#invMGuardar"))) return;
      leer();
      var x = ins(st.ins), c = aNum(st.cant), er = qs("#invErr", h);
      if (String(st.cant).trim() === "" || !(st.tipo === "conteo" ? c >= 0 : c > 0)){ er.textContent = "Escribe la cantidad."; return; }
      var t = String(st.total).trim() === "" ? 0 : aNum(st.total);
      if (!(t >= 0)){ er.textContent = "Revisa el total pagado."; return; }
      er.textContent = ""; b.disabled = true;
      try {
        var r = await C.api({ accion: "movimiento", tipo: st.tipo, insumo: st.ins, cantidad: Math.round(c * u(x).f * 1000) / 1000, total: t, nota: st.nota });
        E.d = r; E.movs = null; cerrarHoja(); pintar();
        C.toast(st.tipo === "compra" ? "Compra anotada" : st.tipo === "merma" ? "Merma anotada" : "Conteo guardado");
      } catch(err){ er.textContent = err.message || "No se pudo guardar"; b.disabled = false; }
    });
  }

  /* ── hoja: receta de un producto ── */
  function hojaReceta(pid){
    var p = prod(pid); if (!p) return;
    var r0 = receta(pid), st = { activa: r0 ? r0.activa !== false : true, lineas: (r0 ? r0.items : []).map(function(l){ return { i: l.i, c: l.c }; }), extras: {} };
    /* agregados del producto: cada opción puede descontar un insumo */
    var ops = [];
    (C.grupos() || []).forEach(function(g){
      if (!g || (p.gruposExtras || []).indexOf(g.id) < 0 || g.tipo === "quitar") return;
      (g.opciones || []).forEach(function(o){ if (!o || !o.id || !String(o.nombre || "").trim()) return;
        var e = extra(g.id, o.id), l = e && e.items[0];
        st.extras[g.id + "|" + o.id] = { i: l ? l.i : "", c: l ? l.c : "" };
        ops.push({ g: g.id, o: o.id, nombre: o.nombre, precio: Number(o.precio) || 0 });
      });
    });
    var tiles = function(){
      var costo = st.lineas.reduce(function(t, l){ return t + costoDe(ins(l.i), Number(l.c) || 0); }, 0), precio = Number(p.precio) || 0, deja = precio - costo;
      return '<div><b>' + plata(costo) + '</b><small>Cuesta hacerlo</small></div><div><b>' + plata(precio) + '</b><small>Precio</small></div>' +
        '<div class="' + (deja >= 0 ? "ok" : "mal") + '"><b>' + plata(deja) + '</b><small>Deja' + (precio > 0 ? " · " + Math.round(deja * 100 / precio) + "%" : "") + '</small></div>';
    };
    var txtExtra = function(o){ var e = st.extras[o.g + "|" + o.o], x = ins(e.i);
      return x ? (E.d.dueno ? "Cuesta " + plata(costoDe(x, Number(e.c) || 0)) + ", se cobra " + plata(o.precio) : "Descuenta " + x.nombre) : "Sin insumo: no descuenta nada"; };
    var num = function(attr, val, unidad){ return '<label class="inv-num"><input inputmode="decimal" ' + attr + ' value="' + esc(val) + '" aria-label="Cantidad"><span>' + esc(unidad) + '</span></label>'; };
    var cuerpo = function(){
      var libres = (E.d.insumos || []).filter(function(x){ return !st.lineas.some(function(l){ return l.i === x.id; }); });
      return '<h4>' + esc(p.nombre) + '</h4>' +
        '<div class="pcard" style="margin-top:10px"><div class="pcard-h"><div><b>Descontar por receta</b><small>Cada venta descuenta sus insumos. Apagado, el producto usa su stock propio.</small></div>' +
          '<label class="switch"><input type="checkbox" id="invRAct"' + (st.activa ? " checked" : "") + '><span class="slider"></span></label></div></div>' +
        '<div class="pcard"><b class="pcard-t">Qué lleva</b><p class="pnota" style="margin:2px 0 6px">Cantidad por cada unidad vendida.</p>' +
          (st.lineas.length ? st.lineas.map(function(l, k){ var x = ins(l.i); return '<div class="inv-lin"><div><b>' + esc(x ? x.nombre : "Insumo eliminado") + '</b>' + (E.d.dueno ? '<small data-inv-costo="' + k + '">' + plata(costoDe(x, Number(l.c) || 0)) + '</small>' : '') + '</div>' +
              num('data-inv-lc="' + k + '"', l.c, x ? (x.unidad === "un" ? (x.etiqueta || "un") : u(x).chica) : "") + '<button type="button" class="inv-x" data-inv-quitar="' + k + '" aria-label="Quitar ' + esc(x ? x.nombre : "") + '">✕</button></div>'; }).join("")
            : '<p class="inv-vacio" style="padding:8px">Todavía no lleva nada.</p>') +
          (libres.length ? '<select class="field" id="invRAdd" style="margin-top:10px" aria-label="Agregar insumo"><option value="">＋ Agregar insumo…</option>' + libres.map(function(x){ return '<option value="' + x.id + '">' + esc(x.nombre) + '</option>'; }).join("") + '</select>' : '') + '</div>' +
        (E.d.dueno ? '<div class="pcard"><b class="pcard-t">Cuánto deja</b><div class="inv-tiles" id="invRDeja">' + tiles() + '</div>' +
          '<p class="pnota" style="margin:8px 0 0">Solo insumos. No incluye arriendo, sueldos ni IVA.</p></div>' : '') +
        (ops.length ? '<div class="pcard"><b class="pcard-t">Agregados que también descuentan</b><p class="pnota" style="margin:2px 0 6px">Cuando el cliente los elige, se suman a la receta. Valen para todos los productos que tengan ese agregado.</p>' +
          ops.map(function(o){ var e = st.extras[o.g + "|" + o.o], x = ins(e.i);
            return '<div class="inv-lin" style="flex-wrap:wrap"><div style="flex-basis:100%"><b>' + esc(o.nombre) + '</b><small data-inv-ecosto="' + o.g + "|" + o.o + '">' + esc(txtExtra(o)) + '</small></div>' +
              '<select class="field" data-inv-ei="' + o.g + "|" + o.o + '" style="flex:1;min-width:0" aria-label="Insumo de ' + esc(o.nombre) + '"><option value="">No descuenta</option>' + (E.d.insumos || []).map(function(y){ return '<option value="' + y.id + '"' + (y.id === e.i ? " selected" : "") + '>' + esc(y.nombre) + '</option>'; }).join("") + '</select>' +
              (x ? num('data-inv-ec="' + o.g + "|" + o.o + '"', e.c, x.unidad === "un" ? (x.etiqueta || "un") : u(x).chica) : '') + '</div>'; }).join("") + '</div>' : '') +
        '<div class="inv-err" id="invErr" role="alert"></div><button type="button" class="pill pill-solid pill-sm panel-full" id="invRGuardar">Guardar receta</button><button type="button" class="inv-b txt" data-inv-cerrar>Cancelar</button>';
    };
    var h = hoja(cuerpo());
    var repintar = function(){ var y = h.scrollTop; h.innerHTML = cuerpo(); h.scrollTop = y; };
    h.addEventListener("change", function(e){
      var t = e.target;
      if (t.id === "invRAct"){ st.activa = t.checked; return; }
      if (t.id === "invRAdd" && t.value){ st.lineas.push({ i: t.value, c: "" }); repintar(); var inp = h.querySelector('[data-inv-lc="' + (st.lineas.length - 1) + '"]'); if (inp) inp.focus(); return; }
      if (t.dataset.invEi){ st.extras[t.dataset.invEi] = { i: t.value, c: "" }; repintar(); return; }
    });
    /* al escribir una cantidad se actualizan los montos sin redibujar (así no se pierde el cursor) */
    h.addEventListener("input", function(e){
      var t = e.target, v = aNum(t.value) > 0 ? aNum(t.value) : "";
      if (t.dataset.invLc != null){
        var k = Number(t.dataset.invLc); st.lineas[k].c = v;
        var sm = h.querySelector('[data-inv-costo="' + k + '"]'); if (sm) sm.textContent = plata(costoDe(ins(st.lineas[k].i), Number(v) || 0));
        var dj = qs("#invRDeja", h); if (dj) dj.innerHTML = tiles();
      } else if (t.dataset.invEc){
        st.extras[t.dataset.invEc].c = v;
        var o = ops.filter(function(q){ return q.g + "|" + q.o === t.dataset.invEc; })[0], se = h.querySelector('[data-inv-ecosto="' + t.dataset.invEc + '"]');
        if (o && se) se.textContent = txtExtra(o);
      }
    });
    h.addEventListener("click", async function(e){
      var b;
      if ((b = e.target.closest("[data-inv-quitar]"))){ st.lineas.splice(Number(b.dataset.invQuitar), 1); repintar(); return; }
      if (!(b = e.target.closest("#invRGuardar"))) return;
      /* lo que se esté escribiendo en ese momento también cuenta */
      h.querySelectorAll("[data-inv-lc]").forEach(function(i){ st.lineas[Number(i.dataset.invLc)].c = aNum(i.value) > 0 ? aNum(i.value) : ""; });
      h.querySelectorAll("[data-inv-ec]").forEach(function(i){ st.extras[i.dataset.invEc].c = aNum(i.value) > 0 ? aNum(i.value) : ""; });
      var er = qs("#invErr", h);
      if (st.lineas.some(function(l){ return !(Number(l.c) > 0); })){ er.textContent = "Falta la cantidad de algún insumo."; return; }
      if (Object.keys(st.extras).some(function(k){ return st.extras[k].i && !(Number(st.extras[k].c) > 0); })){ er.textContent = "Falta la cantidad de algún agregado."; return; }
      er.textContent = ""; b.disabled = true;
      try {
        var r = await C.api({ accion: "receta", productoId: pid, activa: st.activa, items: st.lineas.map(function(l){ return { i: l.i, c: Number(l.c) }; }) });
        /* agregados: solo los que cambiaron */
        for (var k = 0; k < ops.length; k++){
          var o = ops[k], e2 = st.extras[o.g + "|" + o.o], antes = extra(o.g, o.o), a0 = antes && antes.items[0];
          var igual = a0 ? (a0.i === e2.i && Number(a0.c) === Number(e2.c)) : !e2.i;
          if (!igual) r = await C.api({ accion: "extra", grupoId: o.g, opcionId: o.o, items: e2.i ? [{ i: e2.i, c: Number(e2.c) }] : [] });
        }
        E.d = r; cerrarHoja(); pintar(); C.toast("Receta guardada");
      } catch(err){ er.textContent = err.message || "No se pudo guardar"; b.disabled = false; }
    });
  }

  /* ── clics de la pantalla ── */
  async function clic(e){
    var b;
    if ((b = e.target.closest("[data-inv-tab]"))){ E.tab = b.dataset.invTab; pintar(); return; }
    if (e.target.closest("[data-inv-nuevo]")){ hojaInsumo(null); return; }
    if ((b = e.target.closest("[data-inv-editar]"))){ hojaInsumo(b.dataset.invEditar); return; }
    if (e.target.closest("[data-inv-mov]")){ hojaMov(null, "compra"); return; }
    if ((b = e.target.closest("[data-inv-tengo]"))){ hojaMov(b.dataset.invTengo, "conteo"); return; }
    if ((b = e.target.closest("[data-inv-receta]"))){ hojaReceta(b.dataset.invReceta); return; }
    if ((b = e.target.closest("[data-inv-agotar]"))){ var r = await llamar({ accion: "aviso", insumo: b.dataset.invAgotar, op: "agotar" }, b); if (r){ pintar(); C.toast(r.agotados_ahora === 1 ? "1 producto marcado agotado" : (r.agotados_ahora || 0) + " productos marcados agotados"); } return; }
    if ((b = e.target.closest("[data-inv-seguir]"))){ if (await llamar({ accion: "aviso", insumo: b.dataset.invSeguir, op: "seguir" }, b)) pintar(); return; }
    if ((b = e.target.closest("[data-inv-reactivar]"))){ var r2 = await llamar({ accion: "reactivar", insumo: b.dataset.invReactivar }, b); if (r2){ pintar(); C.toast("Productos de vuelta a la venta"); } return; }
    if ((b = e.target.closest("[data-inv-dejar]"))){ if (await llamar({ accion: "reactivar", insumo: b.dataset.invDejar, op: "dejar" }, b)) pintar(); }
  }

  async function montar(ctx){
    var primera = !C || C.raiz !== ctx.raiz;
    C = ctx; estilos();
    if (primera) C.raiz.addEventListener("click", clic);
    pintar();
    var r = await llamar({ accion: "ver" });
    if (r) pintar(); else C.raiz.innerHTML = '<div class="pcard"><p class="inv-vacio">No se pudo cargar el inventario. Vuelve a abrir esta sección.</p></div>';
  }

  window.DLInv = { montar: montar, _aNum: aNum, _fStock: fStock, _fCant: fCant };
})();
