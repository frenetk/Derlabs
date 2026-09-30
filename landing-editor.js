/* landing-editor.js — editor visual del landing (derlabs.cl/editar).
   Lo carga el Worker solo en /editar. Todo lo que agrega a la página
   lleva data-ed-ui y se quita al guardar, así el HTML publicado queda
   limpio y estático. */
(function(){
"use strict";
if (window.__ED_CARGADO) return; window.__ED_CARGADO = true;

var FB_CFG = {
  apiKey: "AIzaSyBuzHcQezxE36F6nDJWqYsE5rOKUvQbMBM",
  authDomain: "tienda-test-burgers.firebaseapp.com",
  projectId: "tienda-test-burgers",
  storageBucket: "tienda-test-burgers.firebasestorage.app",
  messagingSenderId: "406623629835",
  appId: "1:406623629835:web:31152eac803ed8c679cd0e"
};
var API = "/api/landingEditor";
var SDK = "https://www.gstatic.com/firebasejs/9.23.0/firebase-";

var usuario = null, activo = false, previa = false, sucio = false;
var sel = null, editando = null, textoAntes = "";
var historial = [], ocupado = false;

/* ─────────────── Interfaz (shadow DOM: el CSS del landing no la afecta) ─────────────── */
var estiloPagina = document.createElement("style");
estiloPagina.setAttribute("data-ed-ui", "");
estiloPagina.textContent =
  "html.ed-on body{padding-bottom:150px!important}" +
  "html.ed-on [contenteditable]{outline:none;cursor:text;caret-color:#6C5CE7}" +
  "html.ed-on .chat-float{pointer-events:none;opacity:.35}";
document.head.appendChild(estiloPagina);

var host = document.createElement("div");
host.setAttribute("data-ed-ui", "");
host.id = "edHost";
document.documentElement.appendChild(host);
var raiz = host.attachShadow({ mode: "open" });
raiz.innerHTML =
  '<style>' +
  ':host{all:initial}' +
  '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
  '.caja{position:fixed;pointer-events:none;z-index:2147483600;border-radius:4px;display:none}' +
  '#hov{outline:1.5px dashed rgba(108,92,231,.7)}' +
  '#sel{outline:2.5px solid #6C5CE7;box-shadow:0 0 0 4px rgba(108,92,231,.18)}' +
  '#etq{position:fixed;z-index:2147483601;display:none;background:#6C5CE7;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;pointer-events:none;white-space:nowrap}' +
  '#dock{position:fixed;left:0;right:0;bottom:0;z-index:2147483602;background:#141418;color:#fff;box-shadow:0 -8px 30px rgba(0,0,0,.35);padding:8px 10px calc(8px + env(safe-area-inset-bottom))}' +
  '.fila{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;align-items:center}' +
  '.fila::-webkit-scrollbar{display:none}' +
  '#herr{display:none;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.1)}' +
  'button{flex:none;border:0;border-radius:10px;padding:9px 12px;font-size:13px;font-weight:700;cursor:pointer;background:#2A2A33;color:#fff;white-space:nowrap}' +
  'button:active{transform:scale(.96)}' +
  'button.pri{background:#6C5CE7}' +
  'button.ok{background:#2E9E5B}' +
  'button.peligro{background:#5A1F24;color:#FFB4B4}' +
  'button:disabled{opacity:.4}' +
  '#estado{font-size:11.5px;color:#A8A8B3;margin:0 0 6px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '#nombreSel{font-size:12px;font-weight:800;color:#C9C2FF;padding:0 6px 0 2px;flex:none}' +
  '#volver{position:fixed;right:14px;bottom:18px;z-index:2147483603;display:none;background:#6C5CE7;box-shadow:0 8px 24px rgba(0,0,0,.35);padding:12px 16px}' +
  '#toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483604;background:#141418;color:#fff;padding:10px 16px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.3);display:none;max-width:92vw;text-align:center}' +
  '.velo{position:fixed;inset:0;z-index:2147483605;background:rgba(10,10,14,.6);display:none;align-items:center;justify-content:center;padding:16px}' +
  '.modal{background:#1B1B21;color:#F2F2F5;border-radius:16px;padding:20px;width:100%;max-width:380px;max-height:85vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)}' +
  '.modal h3{margin:0 0 6px;font-size:18px}' +
  '.modal p{margin:0 0 14px;font-size:13px;color:#A8A8B3;line-height:1.45}' +
  '.modal input{width:100%;padding:12px;border-radius:10px;border:1px solid #33333D;background:#111116;color:#fff;font-size:15px;margin-bottom:10px}' +
  '.modal input[type=color]{height:44px;padding:4px}' +
  '.modal label{display:block;font-size:12px;font-weight:700;color:#A8A8B3;margin:4px 0 6px}' +
  '.modal .btns{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:6px}' +
  '.err{color:#FF8A8A;font-size:13px;min-height:18px;margin-top:4px}' +
  '.ver{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #2A2A33;font-size:13px}' +
  '.ver small{color:#8A8A96;display:block}' +
  '.menu{display:flex;flex-direction:column;gap:8px}.menu button{text-align:left;padding:12px}' +
  '</style>' +
  '<div id="hov" class="caja"></div><div id="sel" class="caja"></div><div id="etq"></div>' +
  '<div id="dock" style="display:none">' +
    '<div id="herr" class="fila">' +
      '<span id="nombreSel"></span>' +
      '<button data-a="padre" title="Seleccionar el bloque que lo contiene">⬆ Contenedor</button>' +
      '<button data-a="negrita" data-solo="texto"><b>B</b></button>' +
      '<button data-a="enlace" data-solo="enlace">🔗 Enlace</button>' +
      '<button data-a="imagen" data-solo="imagen">🖼 Cambiar imagen</button>' +
      '<button data-a="alt" data-solo="imagen">Texto alt</button>' +
      '<button data-a="placeholder" data-solo="campo">Texto guía</button>' +
      '<button data-a="duplicar">⧉ Duplicar</button>' +
      '<button data-a="subir">▲ Subir</button>' +
      '<button data-a="bajar">▼ Bajar</button>' +
      '<button data-a="colores">🎨 Colores</button>' +
      '<button data-a="borrar" class="peligro">🗑 Borrar</button>' +
      '<button data-a="soltar">✕</button>' +
    '</div>' +
    '<div id="estado">Cargando…</div>' +
    '<div class="fila">' +
      '<button data-a="deshacer" id="bDeshacer" disabled>↶ Deshacer</button>' +
      '<button data-a="previa">👁 Vista previa</button>' +
      '<button data-a="guardar" id="bGuardar">💾 Guardar borrador</button>' +
      '<button data-a="publicar" class="ok">🚀 Publicar</button>' +
      '<button data-a="mas">⋯ Más</button>' +
    '</div>' +
  '</div>' +
  '<button id="volver" data-a="previa">✏️ Volver a editar</button>' +
  '<div id="toast"></div>' +
  '<input type="file" id="archivo" accept="image/*" style="display:none">' +
  '<div class="velo" id="vLogin"><div class="modal">' +
    '<h3>✏️ Editor del landing</h3><p>Entra con tu cuenta de administrador de DerLabs.</p>' +
    '<input id="lEmail" type="email" placeholder="Email" autocomplete="username">' +
    '<input id="lPass" type="password" placeholder="Contraseña" autocomplete="current-password">' +
    '<div class="err" id="lErr"></div>' +
    '<div class="btns"><button data-a="salir">Cancelar</button><button class="pri" data-a="entrar" id="bEntrar">Entrar</button></div>' +
  '</div></div>' +
  '<div class="velo" id="vModal"><div class="modal" id="mCuerpo"></div></div>';

function $(id){ return raiz.getElementById(id); }
var hov = $("hov"), selBox = $("sel"), etq = $("etq"), dock = $("dock"), herr = $("herr");

function toast(t, ms){
  var e = $("toast"); e.textContent = t; e.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(function(){ e.style.display = "none"; }, ms || 2600);
}
function setEstado(t){ $("estado").textContent = t; }
function fecha(iso){
  try { return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch(e){ return iso; }
}
function escH(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function abrirModal(html){ $("mCuerpo").innerHTML = html; $("vModal").style.display = "flex"; }
function cerrarModal(){ $("vModal").style.display = "none"; $("mCuerpo").innerHTML = ""; }
$("vModal").addEventListener("click", function(e){ if (e.target === $("vModal")) cerrarModal(); });

/* ─────────────── Firebase (solo para iniciar sesión) ─────────────── */
function cargarScript(src){
  return new Promise(function(ok, mal){
    var s = document.createElement("script");
    s.src = src; s.setAttribute("data-ed-ui", "");
    s.onload = ok; s.onerror = function(){ mal(new Error("No se pudo cargar " + src)); };
    document.head.appendChild(s);
  });
}
async function prepararFirebase(){
  if (!window.firebase) await cargarScript(SDK + "app-compat.js");
  if (!firebase.auth) await cargarScript(SDK + "auth-compat.js");
  if (!firebase.firestore) await cargarScript(SDK + "firestore-compat.js");
  if (!firebase.apps.length) firebase.initializeApp(FB_CFG);
}
async function esPropietario(u){
  try {
    var d = await firebase.firestore().doc("usuarios/" + u.uid).get();
    return d.exists && (d.data().roles || {}).plataforma === "propietario";
  } catch(e){ return false; }
}
async function api(accion, datos){
  if (!usuario) throw new Error("Sin sesión");
  var t = await usuario.getIdToken();
  var r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + t },
    body: JSON.stringify(Object.assign({ accion: accion }, datos || {}))
  });
  var j = await r.json().catch(function(){ return {}; });
  if (!r.ok || !j.ok) throw new Error(j.error || ("Error " + r.status));
  return j;
}

async function entrar(){
  var em = $("lEmail").value.trim(), pw = $("lPass").value;
  $("lErr").textContent = "";
  if (!em || !pw){ $("lErr").textContent = "Completa email y contraseña"; return; }
  $("bEntrar").disabled = true;
  try {
    var c = await firebase.auth().signInWithEmailAndPassword(em, pw);
    if (!(await esPropietario(c.user))){
      await firebase.auth().signOut();
      $("lErr").textContent = "Esta cuenta no tiene acceso al editor";
      return;
    }
    await iniciar(c.user);
  } catch(e){
    $("lErr").textContent = "Email o contraseña incorrectos";
  } finally { $("bEntrar").disabled = false; }
}

/* ─────────────── Arranque ─────────────── */
async function arrancar(){
  try { await prepararFirebase(); }
  catch(e){ toast("No se pudo cargar el inicio de sesión. Revisa tu conexión.", 6000); return; }
  var listo = false;
  firebase.auth().onAuthStateChanged(async function(u){
    if (listo) return;
    if (u && await esPropietario(u)){ listo = true; await iniciar(u); }
    else { $("vLogin").style.display = "flex"; setTimeout(function(){ $("lEmail").focus(); }, 50); }
  });
}

async function iniciar(u){
  usuario = u;
  $("vLogin").style.display = "none";
  if (window.__landingMigracion){ setEstado("Cargando contenido…"); try { await window.__landingMigracion; } catch(e){} }
  activo = true;
  document.documentElement.classList.add("ed-on");
  dock.style.display = "block";
  var origen = window.__ED_ORIGEN || "base";
  var txt = origen === "borrador" ? "Editando tu borrador (aún no publicado)"
          : origen === "publicada" ? "Editando la versión publicada"
          : "Primera edición: publica para dejar la página fija";
  setEstado(txt);
  if (window.__ED_KV === false) toast("⚠️ El KV LANDING no está conectado: no se podrá guardar.", 7000);
  try {
    var e = await api("estado");
    if (e.publicada) setEstado(txt + " · publicada " + fecha(e.publicada.fecha));
  } catch(err){ /* el estado es informativo */ }
  if (origen === "base") marcarSucio();   /* la versión base aún no está publicada */
  toast("Toca cualquier texto para editarlo. Toca un bloque para moverlo, duplicarlo o borrarlo.", 4500);
}

/* ─────────────── Historial (deshacer) ─────────────── */
function guardarPaso(){
  historial.push(document.body.innerHTML);
  if (historial.length > 30) historial.shift();
  $("bDeshacer").disabled = false;
}
function deshacer(){
  if (!historial.length) return;
  terminarEdicion(true);
  soltar();
  document.body.innerHTML = historial.pop();
  $("bDeshacer").disabled = !historial.length;
  marcarSucio();
}
function marcarSucio(){
  sucio = true;
  $("bGuardar").textContent = "💾 Guardar borrador •";
}
window.addEventListener("beforeunload", function(e){
  if (activo && sucio){ e.preventDefault(); e.returnValue = ""; }
});

/* ─────────────── Selección ─────────────── */
function esUI(e){ return e.composedPath ? e.composedPath().indexOf(host) > -1 : e.target === host; }
function tieneTextoPropio(el){
  for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
  return false;
}
function esTexto(el){
  if (!el || el.nodeType !== 1) return false;
  if (/^(IMG|SVG|INPUT|TEXTAREA|SELECT|VIDEO|IFRAME|HTML|BODY|SCRIPT|STYLE)$/i.test(el.tagName)) return false;
  if (el.closest("svg")) return false;
  if (tieneTextoPropio(el)) return true;
  /* texto vacío de un elemento en línea (ej. se borró todo el contenido) */
  return !el.children.length && /^(H[1-6]|P|SPAN|A|B|STRONG|EM|I|LI|BUTTON|LABEL|SMALL|DIV|TD|TH)$/.test(el.tagName);
}
function objetivo(t){
  if (!t || t.nodeType !== 1) return null;
  var s = t.closest("svg"); if (s) t = s;
  if (t === document.body || t === document.documentElement) return null;
  return t;
}
var NOMBRES = { SECTION: "Sección", HEADER: "Cabecera", FOOTER: "Pie", NAV: "Menú", H1: "Título", H2: "Título", H3: "Subtítulo",
  H4: "Subtítulo", H5: "Subtítulo", H6: "Subtítulo", P: "Párrafo", A: "Enlace / botón", BUTTON: "Botón", IMG: "Imagen", svg: "Ícono",
  SVG: "Ícono", LI: "Ítem", UL: "Lista", OL: "Lista", SPAN: "Texto", FORM: "Formulario", INPUT: "Campo", TEXTAREA: "Campo",
  SELECT: "Selector", LABEL: "Etiqueta", B: "Texto", STRONG: "Texto", DIV: "Bloque" };
function nombreDe(el){
  var n = NOMBRES[el.tagName] || NOMBRES[el.tagName.toUpperCase()] || el.tagName.toLowerCase();
  if (el.tagName === "DIV" && /card|item|plan|tarjeta/i.test(el.className || "")) n = "Tarjeta";
  return n;
}
function seleccionar(el){
  sel = el;
  herr.style.display = el ? "flex" : "none";
  if (!el) return;
  $("nombreSel").textContent = nombreDe(el);
  var tipo = {
    texto: esTexto(el) || !!el.querySelector && tieneTextoPropio(el),
    enlace: !!el.closest("a"),
    imagen: el.tagName === "IMG",
    campo: /^(INPUT|TEXTAREA)$/.test(el.tagName)
  };
  herr.querySelectorAll("[data-solo]").forEach(function(b){ b.style.display = tipo[b.getAttribute("data-solo")] ? "" : "none"; });
  herr.scrollLeft = 0;
}
function soltar(){ terminarEdicion(); sel = null; seleccionar(null); }

function dibujar(){
  if (activo && !previa && sel && sel.isConnected){
    var r = sel.getBoundingClientRect();
    Object.assign(selBox.style, { display: "block", left: r.left - 2 + "px", top: r.top - 2 + "px", width: r.width + 4 + "px", height: r.height + 4 + "px" });
    etq.style.display = "block"; etq.textContent = nombreDe(sel) + (editando ? " · escribiendo" : "");
    etq.style.left = Math.max(4, r.left) + "px";
    etq.style.top = (r.top > 26 ? r.top - 24 : r.bottom + 4) + "px";
  } else { selBox.style.display = "none"; etq.style.display = "none"; }
  requestAnimationFrame(dibujar);
}
requestAnimationFrame(dibujar);

document.addEventListener("mousemove", function(e){
  if (!activo || previa || esUI(e) || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)){ hov.style.display = "none"; return; }
  var el = objetivo(e.target);
  if (!el || el === sel){ hov.style.display = "none"; return; }
  var r = el.getBoundingClientRect();
  Object.assign(hov.style, { display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
}, true);

/* ─────────────── Edición de texto ─────────────── */
function empezarEdicion(el, x, y){
  if (editando === el) return;
  terminarEdicion();
  guardarPaso();
  editando = el; textoAntes = el.innerHTML;
  el.setAttribute("contenteditable", "true");
  el.setAttribute("spellcheck", "true");
  el.focus({ preventScroll: true });
  try {
    var rg = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    if (rg && el.contains(rg.startContainer)){ var s = getSelection(); s.removeAllRanges(); s.addRange(rg); }
  } catch(e){}
}
function terminarEdicion(sinPaso){
  if (!editando) return;
  var el = editando; editando = null;
  el.removeAttribute("contenteditable"); el.removeAttribute("spellcheck");
  if (el.innerHTML !== textoAntes) marcarSucio();
  else if (!sinPaso){ historial.pop(); $("bDeshacer").disabled = !historial.length; }
}
document.addEventListener("keydown", function(e){
  if (!editando) return;
  if (e.key === "Enter"){ e.preventDefault(); document.execCommand("insertLineBreak"); }
  else if (e.key === " " && editando.closest("button")){ e.preventDefault(); document.execCommand("insertText", false, " "); }
  else if (e.key === "Escape"){ e.preventDefault(); soltar(); }
}, true);
document.addEventListener("paste", function(e){
  if (!editando) return;
  e.preventDefault();
  var t = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, t);
}, true);
document.addEventListener("input", function(e){ if (editando && editando.contains(e.target)) marcarSucio(); }, true);

/* Clics en la página */
document.addEventListener("click", function(e){
  if (!activo || esUI(e)) return;
  var a = e.target.closest && e.target.closest("a");
  if (a || (e.target.closest && e.target.closest("button[type=submit], input[type=submit]"))) e.preventDefault();
  if (previa){ if (a) toast("Los enlaces están desactivados en el editor"); return; }
  if (editando && editando.contains(e.target)) return;
  var el = objetivo(e.target);
  if (!el){ soltar(); return; }
  terminarEdicion();
  seleccionar(el);
  if (esTexto(el)) empezarEdicion(el, e.clientX, e.clientY);
}, true);
document.addEventListener("submit", function(e){ if (activo){ e.preventDefault(); e.stopPropagation(); } }, true);

/* ─────────────── Acciones sobre el bloque ─────────────── */
function hermano(el, dir){
  var n = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
  while (n && (n.hasAttribute("data-ed-ui") || /^(SCRIPT|STYLE)$/.test(n.tagName))) n = dir < 0 ? n.previousElementSibling : n.nextElementSibling;
  return n;
}
function leerImagen(file){
  return new Promise(function(ok, mal){
    if (/svg/.test(file.type)){
      var fr = new FileReader(); fr.onload = function(){ ok(fr.result); }; fr.onerror = mal; fr.readAsDataURL(file); return;
    }
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function(){
      var max = 1600, w = img.naturalWidth, h = img.naturalHeight;
      if (w > max){ h = Math.round(h * max / w); w = max; }
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      var d = c.toDataURL("image/webp", 0.85);
      if (d.indexOf("data:image/webp") !== 0) d = c.toDataURL(/png|gif/.test(file.type) ? "image/png" : "image/jpeg", 0.85);
      ok(d);
    };
    img.onerror = function(){ mal(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}
$("archivo").addEventListener("change", async function(){
  var f = this.files && this.files[0]; this.value = "";
  if (!f || !sel || sel.tagName !== "IMG") return;
  var img = sel;
  toast("Subiendo imagen…", 20000);
  try {
    var d = await leerImagen(f);
    var r = await api("subirImagen", { dataUrl: d });
    guardarPaso();
    img.src = r.url; img.removeAttribute("srcset"); img.removeAttribute("sizes");
    marcarSucio(); toast("Imagen cambiada ✓");
  } catch(e){ toast("⚠️ " + e.message, 5000); }
});

function modalColores(el){
  var cs = getComputedStyle(el);
  function hex(c){
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ""); if (!m) return "#000000";
    return "#" + [m[1], m[2], m[3]].map(function(x){ return (+x).toString(16).padStart(2, "0"); }).join("");
  }
  abrirModal('<h3>🎨 Colores</h3><p>Se aplican solo a este elemento.</p>' +
    '<label>Color del texto</label><input type="color" id="cTxt" value="' + hex(cs.color) + '">' +
    '<label>Color de fondo</label><input type="color" id="cFondo" value="' + hex(cs.backgroundColor) + '">' +
    '<div class="btns"><button data-m="quitar">Quitar colores</button><button data-m="cancelar">Cancelar</button><button class="pri" data-m="aplicar">Aplicar</button></div>');
  $("mCuerpo").onclick = function(e){
    var m = e.target.getAttribute("data-m"); if (!m) return;
    if (m === "aplicar"){
      guardarPaso();
      el.style.color = $("cTxt").value;
      if ($("cFondo").value !== hex(cs.backgroundColor) || el.style.background || el.style.backgroundColor){
        el.style.background = $("cFondo").value;
      }
      marcarSucio();
    } else if (m === "quitar"){
      guardarPaso();
      el.style.removeProperty("color"); el.style.removeProperty("background"); el.style.removeProperty("background-color");
      if (!el.getAttribute("style")) el.removeAttribute("style");
      marcarSucio();
    }
    cerrarModal();
  };
}
function modalTexto(titulo, ayuda, valor, alAplicar){
  abrirModal('<h3>' + escH(titulo) + '</h3><p>' + escH(ayuda) + '</p><input id="mTxt" value="' + escH(valor) + '">' +
    '<div class="btns"><button data-m="cancelar">Cancelar</button><button class="pri" data-m="ok">Aplicar</button></div>');
  setTimeout(function(){ $("mTxt").focus(); }, 30);
  $("mCuerpo").onclick = function(e){
    var m = e.target.getAttribute("data-m"); if (!m) return;
    if (m === "ok"){ guardarPaso(); alAplicar($("mTxt").value.trim()); marcarSucio(); }
    cerrarModal();
  };
}

var ACCIONES = {
  padre: function(){
    if (!sel) return;
    terminarEdicion();
    var p = sel.parentElement;
    if (p && p !== document.body && p !== document.documentElement) seleccionar(p);
  },
  negrita: function(){
    if (!editando) return;
    document.execCommand("bold"); marcarSucio();
  },
  enlace: function(){
    var a = sel && sel.closest("a"); if (!a) return;
    terminarEdicion();
    modalTexto("🔗 Enlace", "A dónde lleva al tocarlo. Ej: https://wa.me/569..., #precios, /generar-tienda.html", a.getAttribute("href") || "", function(v){ a.setAttribute("href", v || "#"); });
  },
  imagen: function(){ $("archivo").click(); },
  alt: function(){
    var i = sel; if (!i || i.tagName !== "IMG") return;
    modalTexto("Texto alternativo", "Describe la imagen (ayuda a Google y a lectores de pantalla).", i.getAttribute("alt") || "", function(v){ i.setAttribute("alt", v); });
  },
  placeholder: function(){
    var i = sel; if (!i) return;
    modalTexto("Texto guía del campo", "El texto gris que se ve cuando el campo está vacío.", i.getAttribute("placeholder") || "", function(v){ i.setAttribute("placeholder", v); });
  },
  duplicar: function(){
    if (!sel) return;
    terminarEdicion(); guardarPaso();
    var c = sel.cloneNode(true);
    if (c.id) c.removeAttribute("id");
    c.querySelectorAll("[id]").forEach(function(n){ n.removeAttribute("id"); });
    sel.parentNode.insertBefore(c, sel.nextSibling);
    seleccionar(c); marcarSucio(); toast("Duplicado ✓");
  },
  subir: function(){
    if (!sel) return; var h = hermano(sel, -1); if (!h){ toast("Ya está primero"); return; }
    terminarEdicion(); guardarPaso(); sel.parentNode.insertBefore(sel, h); marcarSucio();
    sel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  },
  bajar: function(){
    if (!sel) return; var h = hermano(sel, 1); if (!h){ toast("Ya está último"); return; }
    terminarEdicion(); guardarPaso(); sel.parentNode.insertBefore(h, sel); marcarSucio();
    sel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  },
  colores: function(){ if (sel){ terminarEdicion(); modalColores(sel); } },
  borrar: function(){
    if (!sel) return;
    var grande = sel.getBoundingClientRect().height > 300 || /^(SECTION|HEADER|FOOTER|FORM)$/.test(sel.tagName);
    if (grande && !confirm("¿Borrar este bloque completo (" + nombreDe(sel) + ")?")) return;
    terminarEdicion(true); guardarPaso();
    sel.remove(); soltar(); marcarSucio(); toast("Borrado · puedes deshacer");
  },
  soltar: soltar,
  deshacer: deshacer,
  previa: function(){
    previa = !previa;
    soltar();
    document.documentElement.classList.toggle("ed-on", !previa);
    dock.style.display = previa ? "none" : "block";
    $("volver").style.display = previa ? "block" : "none";
    hov.style.display = "none";
  },
  guardar: async function(){
    if (ocupado) return; ocupado = true;
    try {
      setEstado("Guardando borrador…");
      await api("guardar", { html: serializar() });
      sucio = false; $("bGuardar").textContent = "💾 Guardar borrador";
      setEstado("Borrador guardado " + fecha(new Date().toISOString()) + " · no es público todavía");
      toast("Borrador guardado ✓");
    } catch(e){ setEstado("⚠️ No se guardó"); toast("⚠️ " + e.message, 6000); }
    finally { ocupado = false; }
  },
  publicar: async function(){
    if (ocupado) return;
    if (!confirm("¿Publicar estos cambios en derlabs.cl?")) return;
    ocupado = true;
    try {
      setEstado("Publicando…");
      await api("publicar", { html: serializar() });
      sucio = false; $("bGuardar").textContent = "💾 Guardar borrador";
      window.__ED_ORIGEN = "publicada";
      setEstado("Publicada " + fecha(new Date().toISOString()));
      toast("🚀 Publicado. Se verá en derlabs.cl en menos de 1 minuto.", 5000);
    } catch(e){ setEstado("⚠️ No se publicó"); toast("⚠️ " + e.message, 6000); }
    finally { ocupado = false; }
  },
  mas: function(){
    abrirModal('<h3>Más opciones</h3><div class="menu">' +
      '<button data-m="versiones">🕘 Versiones publicadas</button>' +
      '<button data-m="descartar">🗑 Descartar borrador</button>' +
      '<button data-m="ver">🌐 Ver sitio publicado</button>' +
      '<button data-m="cerrar">🚪 Cerrar sesión</button>' +
      '<button data-m="x">Cancelar</button></div>');
    $("mCuerpo").onclick = async function(e){
      var m = e.target.closest("[data-m]"); if (!m) return; m = m.getAttribute("data-m");
      if (m === "versiones") return mostrarVersiones();
      cerrarModal();
      if (m === "descartar"){
        if (!confirm("¿Descartar el borrador y volver a la última versión publicada?")) return;
        try { await api("descartar"); sucio = false; location.reload(); } catch(err){ toast("⚠️ " + err.message, 5000); }
      } else if (m === "ver"){ window.open("/", "_blank"); }
      else if (m === "cerrar"){
        if (sucio && !confirm("Tienes cambios sin guardar. ¿Salir igual?")) return;
        sucio = false; await firebase.auth().signOut(); location.href = "/";
      }
    };
  },
  entrar: entrar,
  salir: function(){ location.href = "/"; }
};

async function mostrarVersiones(){
  abrirModal('<h3>🕘 Versiones publicadas</h3><p>Cargando…</p>');
  try {
    var e = await api("estado");
    var l = e.versiones || [];
    abrirModal('<h3>🕘 Versiones publicadas</h3><p>Las últimas ' + l.length + ' publicaciones. Restaurar una la vuelve a publicar.</p>' +
      (l.length ? l.map(function(v, i){
        return '<div class="ver"><div>' + fecha(v.fecha) + (e.publicada && e.publicada.id === v.id ? ' · <b>actual</b>' : '') +
               '<small>' + Math.round(v.bytes / 1024) + ' KB</small></div>' +
               (e.publicada && e.publicada.id === v.id ? '' : '<button data-v="' + escH(v.id) + '">Restaurar</button>') + '</div>';
      }).join("") : '<p>Aún no has publicado nada.</p>') +
      '<div class="btns"><button data-m="x">Cerrar</button></div>');
    $("mCuerpo").onclick = async function(ev){
      var b = ev.target.closest("[data-v],[data-m]"); if (!b) return;
      if (b.hasAttribute("data-m")){ cerrarModal(); return; }
      if (!confirm("¿Publicar de nuevo esta versión? Se descartará el borrador actual.")) return;
      try { await api("restaurar", { id: b.getAttribute("data-v") }); sucio = false; toast("Restaurada ✓"); setTimeout(function(){ location.reload(); }, 700); }
      catch(err){ toast("⚠️ " + err.message, 5000); }
    };
  } catch(err){ abrirModal('<h3>Versiones</h3><p>⚠️ ' + escH(err.message) + '</p><div class="btns"><button data-m="x" onclick="">Cerrar</button></div>'); $("mCuerpo").onclick = cerrarModal; }
}

raiz.addEventListener("click", function(e){
  var b = e.target.closest("[data-a]"); if (!b) return;
  var f = ACCIONES[b.getAttribute("data-a")]; if (f) f();
});
/* Que tocar la barra no saque el foco del texto que se está escribiendo */
dock.addEventListener("mousedown", function(e){ if (e.target.closest("[data-a]")) e.preventDefault(); });
$("lPass").addEventListener("keydown", function(e){ if (e.key === "Enter") entrar(); });

/* Autoguardado del borrador cada 2 minutos si hay cambios */
setInterval(function(){ if (activo && sucio && !ocupado && !editando && window.__ED_KV !== false) ACCIONES.guardar(); }, 120000);

/* ─────────────── HTML final (limpio) ─────────────── */
function serializar(){
  terminarEdicion(true);
  var c = document.documentElement.cloneNode(true);
  c.querySelectorAll("[data-ed-ui], script[data-migracion]").forEach(function(n){ n.remove(); });
  c.querySelectorAll("iframe").forEach(function(n){ if (/firebaseapp\.com|__\/auth/.test(n.src || "")) n.remove(); });
  c.querySelectorAll("[contenteditable]").forEach(function(n){ n.removeAttribute("contenteditable"); });
  c.querySelectorAll("[spellcheck]").forEach(function(n){ if (n.getAttribute("spellcheck") === "true" && !/^(INPUT|TEXTAREA)$/.test(n.tagName)) n.removeAttribute("spellcheck"); });
  c.querySelectorAll(".faq-item.abierto").forEach(function(n){ n.classList.remove("abierto"); });
  c.classList.remove("ed-on");
  if (!c.getAttribute("class")) c.removeAttribute("class");
  var lead = c.querySelector("#leadEstado"); if (lead){ lead.textContent = ""; lead.className = "lead-estado"; }
  return "<!DOCTYPE html>\n" + c.outerHTML;
}
window.__edSerializar = serializar;   /* para pruebas */

arrancar();
})();
