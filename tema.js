/* ════════════════════════════════════════════════════════════════
   P45 — MODO CLARO / OSCURO compartido
   (cocina, delivery y pantallas de administración)

   Uso, dentro del <head>, para que el tema quede puesto antes de pintar:
     <link rel="stylesheet" href="/tema.css?v=45">
     <script src="/tema.js?v=45" data-clave="cocina_tema"></script>

   · La elección se guarda en este equipo (localStorage, con la clave indicada).
   · Cualquier elemento con el atributo data-tema-btn cambia el tema al tocarlo.
     Si la página no trae ninguno, se agrega un botón flotante abajo a la derecha.
   · Por defecto queda en oscuro, como antes.
   ════════════════════════════════════════════════════════════════ */
(function(){
  var sc = document.currentScript;
  var clave = (sc && sc.getAttribute("data-clave")) || "dl_tema";
  var defecto = (sc && sc.getAttribute("data-defecto")) === "claro" ? "claro" : "oscuro";
  var SOL = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
  var LUNA = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  function leer(){
    try { var v = localStorage.getItem(clave); return v === "claro" || v === "oscuro" ? v : defecto; } catch(e){ return defecto; }
  }
  function actual(){ return document.documentElement.getAttribute("data-tema") === "claro" ? "claro" : "oscuro"; }
  function pintar(t){
    document.documentElement.setAttribute("data-tema", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "claro" ? "#FFFFFF" : "#111111");
    var bs = document.querySelectorAll("[data-tema-btn]");
    for (var i = 0; i < bs.length; i++){
      bs[i].innerHTML = t === "claro" ? LUNA : SOL;
      bs[i].setAttribute("aria-label", t === "claro" ? "Cambiar a modo oscuro" : "Cambiar a modo claro");
      bs[i].setAttribute("title", t === "claro" ? "Modo oscuro" : "Modo claro");
    }
  }
  function cambiar(){
    var t = actual() === "claro" ? "oscuro" : "claro";
    try { localStorage.setItem(clave, t); } catch(e){}
    pintar(t);
  }
  pintar(leer());
  function listo(){
    if (!document.querySelector("[data-tema-btn]")){
      var b = document.createElement("button");
      b.type = "button"; b.className = "tema-flot"; b.setAttribute("data-tema-btn", "");
      document.body.appendChild(b);
    }
    document.addEventListener("click", function(e){
      var b = e.target && e.target.closest ? e.target.closest("[data-tema-btn]") : null;
      if (b){ e.preventDefault(); cambiar(); }
    });
    pintar(leer());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", listo); else listo();
  window.DLTema = { cambiar: cambiar, actual: actual, pintar: function(){ pintar(actual()); } };
})();
