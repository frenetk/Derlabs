/* CONFIGURACIÓN */
/* ════════════════════════════════════════════════════════════════
   CONFIGURACIÓN
   ▼▼▼ PEGA AQUÍ TUS CREDENCIALES ▼▼▼
   firebase.google.com → Consola → Tu proyecto → Configuración
   Mientras apiKey sea "PEGAR_AQUÍ" la web funciona en modo demo.
   ════════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBuzHcQezxE36F6nDJWqYsE5rOKUvQbMBM",
  authDomain:        "tienda-test-burgers.firebaseapp.com",
  projectId:         "tienda-test-burgers",
  storageBucket:     "tienda-test-burgers.firebasestorage.app",
  messagingSenderId: "406623629835",
  appId:             "1:406623629835:web:31152eac803ed8c679cd0e"
};
/* STORE_ID ya no es fijo — se resuelve por dominio al arrancar
   boot(), leyendo la colección "dominios" de Firestore. Queda
   declarado acá como "let" (no "const") para que el resto del archivo
   (todos los usos existentes) siga funcionando exactamente igual, sin
   tocar ninguno de esos puntos — todos ellos ya asumen que STORE_ID
   tiene un valor válido, y lo sigue teniendo, solo que ahora se
   resuelve un instante antes en vez de estar escrito a mano. */
let STORE_ID = "test-burgers"; // valor por defecto — red de seguridad si la resolución por dominio falla o el dominio no está registrado
const FUNCTIONS_URL    = "/.netlify/functions";   // Netlify Functions — mismo dominio, sin configuración extra
const VAPID_KEY       = "BN0atA77lvF6LY8buvjl9RLsPXb8ZqESonUfWBDDewV2-_Mr70vcsPNrpvcuFLGJU_mHVRnp084azSSnjvB6ANs";
const GOOGLE_MAPS_KEY = "AIzaSyAc5TwfbIVzuRfuOelbRRXdPXHq8hHD00w";
/* ════════════════════════════════════════════════════════════════ */

const DEMO = FIREBASE_CONFIG.apiKey === "PEGAR_AQUÍ";

/* DEMO DATA */
/* ════════════════════════════════════════════════════════════════
   DEMO DATA
   ════════════════════════════════════════════════════════════════ */
const DEMO_IMAGES = {
  hero:    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&fit=crop",
  burger1: "https://images.unsplash.com/photo-1550317138-10000687a72b?w=800&q=80&fit=crop",
  burger2: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&q=80&fit=crop",
  burger3: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=800&q=80&fit=crop",
  combo1:  "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=800&q=80&fit=crop",
  combo2:  "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=800&q=80&fit=crop",
  fries:   "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80&fit=crop",
  drink:   "https://images.unsplash.com/photo-1582106245687-cbb466a9f07f?w=800&q=80&fit=crop",
  banner:  "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1200&q=80&fit=crop",
  dessert: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80&fit=crop",
  local1:  "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1000&q=80&fit=crop",
  local2:  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&q=80&fit=crop"
};

const MENSAJES_DEFAULT = {
  confirmacion: "✅ *Pedido confirmado {negocio}*\nPedido: #{numero_pedido}\n\nTu pedido fue recibido y está siendo procesado.\nTe avisaremos cuando esté en preparación.\n\n📋 *Resumen:*\n{pedido}\n\n💰 *Total pagado: {total}*\n⏱ *Tiempo estimado: {tiempo_estimado}*",
  preparacion:  "👨‍🍳 Hola {nombre_cliente}!\nTu pedido #{numero_pedido} está en preparación.\n¡Listo en {tiempo_estimado}!",
  camino:       "🛵 Tu pedido #{numero_pedido} ya está en camino!\nTiempo estimado: {tiempo_estimado}.\nCualquier consulta responde este mensaje.",
  listo:        "✅ Tu pedido #{numero_pedido} está listo para retirar.\nTe esperamos en nuestro local."
};

const DEMO_DATA = {
  /* config/general — documento PÚBLICO (reglas: allow read: if true).
     Todo lo que un comprador anónimo necesita ver para navegar y pagar.
     Ningún token ni API key va acá — ver configPrivado más abajo. */
  config: {
    nombre: "TEST BURGERS",
    tagline: "Sabor que no se olvida",
    whatsapp: "CONFIGURAR_WHATSAPP",
    deliveryMinimo: 15000,
    deliveryCosto: 1500,
    tiempoEntrega: "30-45 min",
    abierto: true,
    /* mpActivo: flag público de "¿hay MercadoPago configurado?" — permite
       al checkout mostrar/ocultar esa opción de pago SIN exponer el token
       en sí. Se actualiza junto con mpToken en configPrivado (ver
       btnGuardarMP). */
    mpActivo: false,
    deliveryActivo: true,
    retiroActivo: true,
    rubro: "hamburguesas",
    colorPrimario: "#9B1B30",
    categorias: ["Hamburguesas", "Combos", "Acompañamientos", "Bebidas"],
    heroImagen: DEMO_IMAGES.banner,
    heroBadge: "🔥 Más pedido hoy",
    heroTitulo: "La Monster Doble",
    heroSub: "Doble carne · queso fundido · tocino crocante",
    clubTexto: "Gana puntos con cada pedido",
    puntosTitulo: "PROGRAMA DE PUNTOS",
    puntosLinea1: "1 punto por cada $100 gastado",
    puntosLinea2: "Canjéalos por descuentos exclusivos",
    puntosLinea3: "Automático con cada compra",
    banners: [],
    productoDestacado1: "",
    productoDestacado2: "",
    oferta1: "",
    oferta2: "",
    destacadoSub1: "",
    destacadoSub2: "",
    ofertaSub1: "",
    ofertaSub2: "",
    functionsUrl: "",
    confTitulo: "¡Pago confirmado!",
    confSub: "Tu pedido está siendo procesado",
    timeline1: "Pedido recibido",
    timeline2: "En preparación",
    timeline3: "En camino",
    timeline4: "Entregado",
    mostrarGPS: true,
    footerTexto: "Todos los derechos reservados.",
    footerAno: "2026",
    msjConfirmacion: MENSAJES_DEFAULT.confirmacion,
    msjPreparacion:  MENSAJES_DEFAULT.preparacion,
    msjCamino:       MENSAJES_DEFAULT.camino,
    msjListo:        MENSAJES_DEFAULT.listo
  },
  /* config/privado — documento PRIVADO (reglas: allow read solo dueño
     autenticado). Solo se lee/escribe estando en devmode. */
  configPrivado: {
    mpToken: "CONFIGURAR_TOKEN",
    resendApiKey: "",
    emailEmisor: "",
    emailVendedor: ""
  },
  productos: [
    { id:"p1", orden:1, nombre:"Doble Test Clásica", precio:6990,
      descripcion:"Doble carne, queso cheddar, lechuga, tomate y salsa especial",
      categoria:"Hamburguesas", imagen:DEMO_IMAGES.burger1, activo:true },
    { id:"p2", orden:2, nombre:"Crispy Chicken", precio:5990,
      descripcion:"Pechuga crujiente, coleslaw, pepinillos y mayo chipotle",
      categoria:"Hamburguesas", imagen:DEMO_IMAGES.burger2, activo:true },
    { id:"p3", orden:3, nombre:"Combo Amigos", precio:12990,
      descripcion:"2 hamburguesas + 2 papas fritas + 2 bebidas",
      categoria:"Combos", imagen:DEMO_IMAGES.combo1, activo:true },
    { id:"p4", orden:4, nombre:"Papas Fritas", precio:2490,
      descripcion:"Papas crocantes con sal de mar y alioli",
      categoria:"Acompañamientos", imagen:DEMO_IMAGES.fries, activo:true },
    { id:"p5", orden:5, nombre:"Milkshake", precio:3490,
      descripcion:"Vainilla, chocolate o frutilla — hecho al momento",
      categoria:"Bebidas", imagen:DEMO_IMAGES.drink, activo:true }
  ],
  cupones: [
    { id:"cu1", codigo:"BIENVENIDO10", tipo:"porcentaje", valor:10, descripcion:"En tu primer pedido online", vence:"2026-12-31", activo:true, usosTotales:0 },
    { id:"cu2", codigo:"ENVIOGRATIS", tipo:"monto", valor:2990, descripcion:"En pedidos sobre $10.000", vence:"2026-09-30", activo:true, usosTotales:0 }
  ],
  locales: [
    { id:"l1", nombre:"Local Centro", direccion:"Av. Ejemplo 100, Santiago Centro",
      horario:"Lun–Dom 12:00–23:00", abierto:true, imagen:DEMO_IMAGES.local1 },
    { id:"l2", nombre:"Local Mall", direccion:"Mall Ejemplo, Local 234, Las Condes",
      horario:"Lun–Dom 11:00–22:00", abierto:false, imagen:DEMO_IMAGES.local2 }
  ],
  dispositivos: []
};

const CATEGORIAS_GRID = [];
let FILTROS = ["Todos"];
const VARIABLES_MSJ = ["{nombre_cliente}","{numero_pedido}","{pedido}","{total}","{negocio}","{tiempo_estimado}"];

/* ─── Estado en memoria ─── */
let state = {
  config:        Object.assign({}, DEMO_DATA.config),
  configPrivado: Object.assign({}, DEMO_DATA.configPrivado),
  productos:    [],
  cupones:      [],
  locales:      [],
  dispositivos: []
};
let carrito = [];
let db = null, storage = null, auth = null, authUser = null, clienteUser = null, authPin = null;
/* esPropietario: true solo cuando la sesión de devmode activa es la
   cuenta de propietario (rol="propietario" en Firestore), no la cuenta
   operador del día a día. Se resuelve consultando Firestore cada vez
   que cambia authUser — ver resolverRolPropietario(). */
let esPropietario = false;
let _modoBorrador = false;
let _pendingChanges = [];

/* ─── Snapshot embebido (generado por "Exportar HTML") ─── */
let snapshotData = null;
(function(){
  const el = document.getElementById("snapshot-data");
  if (el) { try { snapshotData = JSON.parse(el.textContent); } catch(e){ console.warn("Snapshot ilegible", e); } }
})();

/* ─── Utilidades ─── */
const qs  = s => document.querySelector(s);

/* ════════════════════════════════════════════════════════════════
   HELPER DEFENSIVO — on(id, evento, fn)
   Registra un listener solo si el elemento existe en el DOM.
   Permite que el mismo motor corra en HTML con distintas secciones
   (index.html vs index-retail.html) sin reventar con null.
   ════════════════════════════════════════════════════════════════ */
function on(id, evento, fn){
  const el = document.getElementById(id);
  if (el) el.addEventListener(evento, fn);
  return el;
}

const qsa = s => Array.from(document.querySelectorAll(s));
function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }
function fmtPrecio(n){
  n = Math.round(Number(n) || 0);
  return "$" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function fFecha(iso){
  if (!iso) return "";
  const p = String(iso).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
}

/* ─── Estados de pedido (vocabulario oficial) ───
   nuevo → preparacion → camino → listo   (+ cancelado)
   normEstado() acepta sinónimos legacy: preparando→preparacion, entregado→listo */
function normEstado(e){
  e = String(e || "nuevo");
  if (e === "preparando") return "preparacion";
  if (e === "entregado")  return "listo";
  return e;
}
function badgeEstadoCliente(e){
  const n = normEstado(e);
  const map = { nuevo:"🔴 Nuevo", preparacion:"🟡 Preparando", camino:"🔵 En camino",
    listo:"🟢 Entregado", cancelado:"⚪ Cancelado" };
  return '<span class="cbadge ' + n + '">' + (map[n] || n) + '</span>';
}

/* ─── Netlify Functions: viven en el mismo dominio bajo /.netlify/functions,
   así que no requieren configurar una URL externa. Si el vendedor pega algo
   en devmode → Pagos → FUNCTIONS_URL, eso manda (por si usa otro hosting) ─── */
function functionsURL(){
  var u = String((state.config && state.config.functionsUrl) || "").trim();
  if (u) return u.replace(/\/+$/, "");
  return FUNCTIONS_URL;
}
function functionsListas(){
  return true; // Netlify Functions siempre están disponibles en el mismo deploy
}
let toastTimer = null;
function toast(msg){
  const t = qs("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove("show"), 2400);
}
function porOrden(arr){ return arr.slice().sort((a,b)=>(a.orden||0)-(b.orden||0)); }
function normalizarOrden(arr){ arr.forEach((it,i)=>{ if (it.orden == null) it.orden = i + 1; }); return arr; }
function productosActivos(){ return porOrden(state.productos).filter(p => p.activo !== false); }
/* ── Utilidades de color — conversión y derivación de paleta ──
   Todo el sistema de paletas por rubro (ver ROADMAP.md, sección 4)
   depende de poder derivar matemáticamente hover/contraste/fondos a
   partir de UN solo color de marca, en vez de necesitar que cada
   paleta especifique manualmente cada variable. Esto también es lo
   que permite que un cliente pida un color fuera de las 8 paletas
   curadas y el resultado siga viéndose bien, sin retocar nada a mano. */
/* ── Rubros y su paleta de marca ──
   Mismos 8 ids que RUBROS en formulario.html — mantenerlos
   sincronizados si se agrega un rubro nuevo en cualquiera de los dos
   archivos. Cada color está elegido con fundamento de psicología del
   color por industria (ver ROADMAP.md, sección 4) y verificado con la
   fórmula de contraste WCAG real (no aproximada) contra las funciones
   de abajo — el naranja de "comida-rapida" está corregido respecto al
   primer intento porque el original no llegaba al mínimo de contraste
   con texto blanco. */
const RUBROS = [
  { id:"comida", nombre:"Comida", ico:"🍔", subrubros:[
      { id:"hamburguesas",   nombre:"Hamburguesas",          ico:"🍔", colorPrimario:"#9B1B30" },
      { id:"comida-rapida",  nombre:"Comida rápida",         ico:"🌭", colorPrimario:"#C83D09" },
      { id:"cafeteria",      nombre:"Cafetería",             ico:"☕", colorPrimario:"#5C3D2E" },
      { id:"pasteleria",     nombre:"Pastelería",            ico:"🧁", colorPrimario:"#C2185B" },
      { id:"servicios",      nombre:"Servicios y reservas",  ico:"📅", colorPrimario:"#1565C0" },
  ]},
  { id:"retail", nombre:"Retail", ico:"🛍️", subrubros:[
      { id:"tecnologia",     nombre:"Tecnología",            ico:"📱", colorPrimario:"#0066FF" },
      { id:"ropa",           nombre:"Ropa y accesorios",     ico:"👕", colorPrimario:"#1A1A1A" },
      { id:"belleza",        nombre:"Belleza y estética",    ico:"💄", colorPrimario:"#D46A9F" },
      { id:"limpieza",       nombre:"Productos de limpieza", ico:"🧴", colorPrimario:"#00A88A" },
      { id:"hogar",          nombre:"Hogar y deco",          ico:"🛋️", colorPrimario:"#8B6914" },
  ]},
];

/* Lista plana de subrubros (compatibilidad con panel admin y favicon) */
const RUBROS_PLANOS = RUBROS.flatMap(r => r.subrubros);
function rubroPorId(id){ return RUBROS_PLANOS.find(function(r){ return r.id === id; }) || RUBROS_PLANOS[0]; }

/* Poblar el <select id="pRubro"> del panel admin con subrubros */
function poblarSelectRubro(){
  const sel = qs("#pRubro");
  if (!sel) return;
  const actual = state.config && (state.config.subrubro || state.config.rubro);
  sel.innerHTML = RUBROS_PLANOS.map(s =>
    '<option value="' + s.id + '">' + s.nombre + '</option>'
  ).join("");
  if (actual) sel.value = actual;
}


/* ══════════════════════════════════════════════════════════════
   ÍCONOS SVG en vez de emoji — ver iconos/ en la raíz del proyecto
   para los archivos fuente de cada uno (referencia si hace falta
   agregar o ajustar alguno). Este bloque los trae embebidos como
   strings para no depender de peticiones de red adicionales por
   cada ícono. ══════════════════════════════════════════════════════════════ */
const EMOJI_A_ICONO = {
  "🔔": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/> <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/> </svg>`,
  "🔕": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M8.7 3A6 6 0 0 1 18 8c0 2.3.6 3.9 1.3 5.1"/> <path d="M6 8a6 6 0 0 0-1 3.3C5 18 2 20 2 20h14"/> <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/> <line x1="2" y1="2" x2="22" y2="22"/> </svg>`,
  "📍": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/> <circle cx="12" cy="10" r="3"/> </svg>`,
  "🗺": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/> <circle cx="12" cy="10" r="3"/> </svg>`,
  "🏠": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M3 9.5 12 2l9 7.5"/> <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/> </svg>`,
  "🔒": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="4" y="11" width="16" height="10" rx="2"/> <path d="M8 11V7a4 4 0 0 1 8 0v4"/> </svg>`,
  "⭐": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/> </svg>`,
  "🗑": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M3 6h18"/> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/> <line x1="10" y1="11" x2="10" y2="17"/> <line x1="14" y1="11" x2="14" y2="17"/> </svg>`,
  "💬": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/> </svg>`,
  "📧": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="4" width="20" height="16" rx="2"/> <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/> </svg>`,
  "✉": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="4" width="20" height="16" rx="2"/> <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/> </svg>`,
  "🕐": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="10"/> <polyline points="12 6 12 12 16 14"/> </svg>`,
  "⏳": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="10"/> <polyline points="12 6 12 12 16 14"/> </svg>`,
  "💵": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="6" width="20" height="12" rx="2"/> <circle cx="12" cy="12" r="2"/> <path d="M6 12h.01M18 12h.01"/> </svg>`,
  "📦": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/> <path d="m3.3 7 8.7 5 8.7-5"/> <path d="M12 22V12"/> </svg>`,
  "🛒": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="8" cy="21" r="1"/> <circle cx="19" cy="21" r="1"/> <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/> </svg>`,
  "🔍": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="11" cy="11" r="8"/> <line x1="21" y1="21" x2="16.65" y2="16.65"/> </svg>`,
  "💼": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="7" width="20" height="14" rx="2"/> <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/> </svg>`,
  "👤": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M20 21a8 8 0 0 0-16 0"/> <circle cx="12" cy="7" r="4"/> </svg>`,
  "🚫": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="10"/> <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/> </svg>`,
  "📱": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="5" y="2" width="14" height="20" rx="2"/> <line x1="12" y1="18" x2="12.01" y2="18"/> </svg>`,
  "📞": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/> </svg>`,
  "🍔": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M4 9a8 4 0 0 1 16 0Z"/> <line x1="3" y1="12" x2="21" y2="12"/> <path d="M4 15h16"/> <path d="M5 18h14a1 1 0 0 1 1 1 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 1 1 0 0 1 1-1Z"/> </svg>`,
  "🌭": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M4 15 15 4a3.5 3.5 0 0 1 5 5L9 20a3.5 3.5 0 0 1-5-5Z"/> <path d="m9.5 9.5 5 5"/> </svg>`,
  "☕": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M17 8h1a4 4 0 1 1 0 8h-1"/> <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/> <line x1="6" y1="2" x2="6" y2="4"/> <line x1="10" y1="2" x2="10" y2="4"/> <line x1="14" y1="2" x2="14" y2="4"/> </svg>`,
  "🧁": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M12 3c-1.5 0-2.5 1.2-2.5 2.5S10.2 8 12 8s2.5-1.2 2.5-2.5S13.5 3 12 3Z"/> <path d="M6 11h12l-1.2 8.4a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6Z"/> <path d="M5 11a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3"/> </svg>`,
  "👕": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 .55.45 1 1 1h10a1 1 0 0 0 1-1V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z"/> </svg>`,
  "💅": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M9 2h6l1 5a4 4 0 0 1-8 0Z"/> <path d="M12 11v6"/> <path d="M8 22c0-2.2 1.8-4 4-4s4 1.8 4 4"/> </svg>`,
  "📅": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="3" y="4" width="18" height="18" rx="2"/> <line x1="16" y1="2" x2="16" y2="6"/> <line x1="8" y1="2" x2="8" y2="6"/> <line x1="3" y1="10" x2="21" y2="10"/> </svg>`,
  "🏪": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M2 7h20l-1.5 5a2 2 0 0 1-2 1.5H5.5a2 2 0 0 1-2-1.5Z"/> <path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/> <path d="M9 21v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5"/> <path d="M2 7 4.5 3h15L22 7"/> </svg>`,
  "👁": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/> <circle cx="12" cy="12" r="3"/> </svg>`,
  "🛍": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/> <line x1="3" y1="6" x2="21" y2="6"/> <path d="M16 10a4 4 0 0 1-8 0"/> </svg>`,
  "🎟": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/> <line x1="13" y1="5" x2="13" y2="19" stroke-dasharray="2 2"/> </svg>`,
  "🔥": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/> </svg>`,
  "🧾": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/> <polyline points="14 2 14 8 20 8"/> <line x1="8" y1="13" x2="16" y2="13"/> <line x1="8" y1="17" x2="16" y2="17"/> </svg>`,
  "💡": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M9 18h6"/> <path d="M10 22h4"/> <path d="M12 2a7 7 0 0 0-4 12.7c.5.4.9 1 1 1.6V18h6v-1.7c.1-.6.5-1.2 1-1.6A7 7 0 0 0 12 2Z"/> </svg>`,
  "🛵": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="5" cy="18" r="3"/> <circle cx="19" cy="18" r="3"/> <path d="M5 18V9h6l3 4h5"/> <path d="M9 9V6h3"/> <path d="M15 13l-2-4"/> </svg>`,
  "🚴": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="5" cy="18" r="3"/> <circle cx="19" cy="18" r="3"/> <path d="M5 18V9h6l3 4h5"/> <path d="M9 9V6h3"/> <path d="M15 13l-2-4"/> </svg>`,
  "🔗": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5"/> <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5"/> </svg>`,
  "👑": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="m2 8 4 3 6-7 6 7 4-3-2 11H4Z"/> <line x1="5" y1="21" x2="19" y2="21"/> </svg>`,
  "🎁": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="3" y="8" width="18" height="4" rx="1"/> <path d="M12 8v13"/> <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/> <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8Z"/> <path d="M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8Z"/> </svg>`,
  "🎂": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <line x1="9" y1="3" x2="9" y2="6"/> <path d="M8 3.5c0 .8.5 1 1 1.5s1 .7 1-.1S9.5 3 9 2.5"/> <path d="M4 21v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7Z"/> <path d="M4 17c1 1 2 1 3 0s2-1 3 0 2 1 3 0 2-1 3 0 2 1 3 0"/> <path d="M6 12v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/> </svg>`,
  "👨": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/> <line x1="6" y1="17" x2="18" y2="17"/> </svg>`,
  "🍳": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/> <line x1="6" y1="17" x2="18" y2="17"/> </svg>`,
  "🖼": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="3" y="3" width="18" height="18" rx="2"/> <circle cx="9" cy="9" r="2"/> <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/> </svg>`,
  "📢": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="m3 11 18-5v12L3 14v-3Z"/> <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/> </svg>`,
  "🍪": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z"/> <path d="M8.5 8.5v.01"/> <path d="M16 15.5v.01"/> <path d="M12 12v.01"/> <path d="M11 17v.01"/> <path d="M7 14v.01"/> </svg>`,
  "📁": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/> </svg>`,
  "😞": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="10"/> <path d="M16 16s-1.5-2-4-2-4 2-4 2"/> <line x1="9" y1="9" x2="9.01" y2="9"/> <line x1="15" y1="9" x2="15.01" y2="9"/> </svg>`,
  "🏢": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="4" y="2" width="16" height="20" rx="1"/> <line x1="9" y1="6" x2="9" y2="6.01"/> <line x1="15" y1="6" x2="15" y2="6.01"/> <line x1="9" y1="10" x2="9" y2="10.01"/> <line x1="15" y1="10" x2="15" y2="10.01"/> <line x1="9" y1="14" x2="9" y2="14.01"/> <line x1="15" y1="14" x2="15" y2="14.01"/> <path d="M9 22v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4"/> </svg>`,
  "📭": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M22 12h-6l-2 3h-4l-2-3H2"/> <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/> </svg>`,
  "🎉": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M5.8 11.3 2 22l10.7-3.79"/> <path d="M4 3h.01"/> <path d="M22 8h.01"/> <path d="M15 2h.01"/> <path d="M22 20h.01"/> <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.8-.23 1.6-.86 2.11L4.3 16.28"/> <path d="m22 13-3.5.5-.5 3.5L11 21"/> <path d="M12 3v3"/> <path d="M3 12h3"/> </svg>`,
  "💳": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="5" width="20" height="14" rx="2"/> <line x1="2" y1="10" x2="22" y2="10"/> </svg>`,
  "📌": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <line x1="12" y1="17" x2="12" y2="22"/> <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/> </svg>`,
  "💰": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="8" cy="8" r="6"/> <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/> <path d="M7 6h1v4"/> <path d="m16.71 13.88.7.71-2.82 2.82"/> </svg>`,
  "📋": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="8" y="2" width="8" height="4" rx="1"/> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/> <line x1="8" y1="11" x2="16" y2="11"/> <line x1="8" y1="15" x2="14" y2="15"/> </svg>`,
  "❌": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="10"/> <line x1="15" y1="9" x2="9" y2="15"/> <line x1="9" y1="9" x2="15" y2="15"/> </svg>`,
  "⚙": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="3"/> <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/> </svg>`,
};
/* Colores para los 7 "puntos de estado" (antes emoji de círculo de color) —
   mismos colores que ya usa el resto de la interfaz para esos estados. */
const PUNTO_COLOR = {
  "🔴": "#C62828", "🟢": "#2E7D32", "🟡": "#F9A825",
  "🔵": "#1565C0", "🟠": "#EF6C00", "🟣": "#6A1B9A", "⚪": "#9E9E9E"
};
const SVG_PUNTO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>`;

/* ══════════════════════════════════════════════════════════════
   REEMPLAZO DE EMOJI POR ÍCONOS SVG
   Reemplaza en el propio HTML fuente (antes de insertarlo al DOM)
   todo emoji del mapa por un <span> con el SVG correspondiente. Se
   aplica sobre STRINGS de HTML ya armados (los que arman las
   funciones render*), no sobre el DOM ya insertado — evitando así
   tener que recorrer nodos de texto después de cada render, que es
   más lento y más frágil con contenido que se regenera seguido
   (listas de pedidos, timeline, etc).
   Uso: envolver el string final de cualquier función que arme HTML
   con emoji con reemplazarEmojis(html) antes de asignarlo a
   innerHTML. ══════════════════════════════════════════════════════════════ */
function reemplazarEmojis(html){
  if (!html) return html;
  let out = html;
  for (const emoji in EMOJI_A_ICONO){
    if (out.indexOf(emoji) === -1) continue;
    const span = '<span class="ico-inline">' + EMOJI_A_ICONO[emoji] + '</span>';
    out = out.split(emoji).join(span);
  }
  for (const emoji in PUNTO_COLOR){
    if (out.indexOf(emoji) === -1) continue;
    const span = '<span class="ico-inline" style="color:' + PUNTO_COLOR[emoji] + '">' + SVG_PUNTO + '</span>';
    out = out.split(emoji).join(span);
  }
  return out;
}

/* Aplica reemplazarEmojis() a TODOS los elementos del body que no sean
   ni contengan <script>/<style> — nunca tocar esos dos, porque su
   contenido es código/CSS, no HTML visible: si un emoji dentro de un
   string de JS (ej. "🔴 Nuevo" en un mapa de estados) se reemplazara
   por un <span>, el script dejaría de ser JavaScript válido y la página
   se rompería por completo. Recorre los HIJOS DIRECTOS del body (no
   todo junto con innerHTML del body entero) para no tocar el propio
   <script> principal de la página, que también cuelga directo del
   body. Se llama una vez al terminar boot() — cubre el HTML estático
   inicial. El contenido que se regenera después (listas, carrito,
   toasts) se cubre aparte, en los puntos donde ese contenido se arma. */
/* Recorre TODOS los nodos de texto del body (TreeWalker, no
   innerHTML), saltando SCRIPT/STYLE, y reemplaza solo los nodos que
   contienen un emoji del mapa. A diferencia de reescribir innerHTML de
   bloques completos, esto no reconstruye el DOM alrededor (no rompe el
   foco de un input, no pierde el estado de scroll) y es seguro de
   llamar tantas veces como haga falta — un nodo ya convertido no tiene
   más emoji, así que una segunda pasada no hace nada sobre él. Se
   llama al final de renderAll() (cubre casi todo) y explícitamente
   dentro de cada función de render que no pasa por renderAll() (listas
   de pedidos, historial, direcciones, timeline, confirmación, toasts). */
function aplicarIconosGlobal(raiz){
  try {
    const contenedor = raiz || document.body;
    const walker = document.createTreeWalker(contenedor, NodeFilter.SHOW_TEXT, {
      acceptNode: function(nodo){
        const padreTag = nodo.parentElement ? nodo.parentElement.tagName : "";
        if (padreTag === "SCRIPT" || padreTag === "STYLE") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodosATocar = [];
    let nodo;
    while ((nodo = walker.nextNode())){
      if (tieneAlgunEmoji(nodo.nodeValue)) nodosATocar.push(nodo);
    }
    nodosATocar.forEach(function(textNode){
      const html = reemplazarEmojis(escaparParaHtml(textNode.nodeValue));
      const span = document.createElement("span");
      span.innerHTML = html;
      textNode.parentNode.replaceChild(span, textNode);
      // "Desenvolver" el span: dejar sus hijos en el lugar del nodo de texto original,
      // para no envolver texto normal en un <span> extra que podría afectar el layout.
      while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
      span.parentNode.removeChild(span);
    });
  } catch(e){ console.warn("No se pudieron aplicar los íconos:", e); }
}
function escaparParaHtml(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function tieneAlgunEmoji(texto){
  if (!texto) return false;
  for (const e in EMOJI_A_ICONO) if (texto.indexOf(e) !== -1) return true;
  for (const e in PUNTO_COLOR) if (texto.indexOf(e) !== -1) return true;
  return false;
}


function hexARgb(hex){
  hex = String(hex || "").replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(function(c){ return c + c; }).join("");
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbAHex(r, g, b){
  const c = function(v){ return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); };
  return "#" + c(r) + c(g) + c(b);
}
function rgbAHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min){ h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max){
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslARgb(h, s, l){
  h /= 360; s /= 100; l /= 100;
  if (s === 0){ const v = l * 255; return { r: v, g: v, b: v }; }
  const hue2rgb = function(p, q, t){
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1/3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1/3) * 255
  };
}
/* Luminancia relativa WCAG — base del cálculo de contraste real. */
function luminanciaRelativa(r, g, b){
  const chan = [r, g, b].map(function(v){
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}
/* Razón de contraste WCAG entre dos colores — la fórmula estándar,
   no una aproximación. Usada por textoLegibleSobre() para elegir el
   texto que de verdad cumple el mínimo de legibilidad (4.5:1 para
   texto normal), en vez de solo mirar si el fondo "parece" claro u
   oscuro — un corte de luminancia aproximado había dado blanco sobre
   un rosa (#D46A9F, contraste real 3.3:1, insuficiente) hasta que se
   verificó con el cálculo real; con negro ese mismo rosa da 5.27:1. */
function razonContrasteWCAG(hex1, hex2){
  const l1 = (function(){ const { r, g, b } = hexARgb(hex1); return luminanciaRelativa(r, g, b); })();
  const l2 = (function(){ const { r, g, b } = hexARgb(hex2); return luminanciaRelativa(r, g, b); })();
  const claro = Math.max(l1, l2), oscuro = Math.min(l1, l2);
  return (claro + 0.05) / (oscuro + 0.05);
}
function textoLegibleSobre(hex){
  const contrasteBlanco = razonContrasteWCAG(hex, "#FFFFFF");
  const contrasteNegro  = razonContrasteWCAG(hex, "#1A1A1A");
  // Preferir blanco si ambos cumplen el mínimo AA (4.5:1) — es la
  // opción más común en interfaces de este tipo; si no, el que sí cumpla.
  if (contrasteBlanco >= 4.5) return "#FFFFFF";
  if (contrasteNegro >= 4.5) return "#1A1A1A";
  // Ninguno llega al mínimo (colores muy medios) — usar el que dé más contraste.
  return contrasteBlanco >= contrasteNegro ? "#FFFFFF" : "#1A1A1A";
}
/* Hover real: oscurece un color claro, aclara un color ya oscuro — así
   el hover SIEMPRE se distingue del color base, sin importar el punto
   de partida (antes, aplicarColor() ponía el hover igual al base). */
function colorHover(hex){
  const { r, g, b } = hexARgb(hex);
  const hsl = rgbAHsl(r, g, b);
  const nuevaL = hsl.l > 55 ? Math.max(0, hsl.l - 12) : Math.min(100, hsl.l + 12);
  const rgb = hslARgb(hsl.h, hsl.s, nuevaL);
  return rgbAHex(rgb.r, rgb.g, rgb.b);
}
/* Tinte muy suave del color de marca, para usar como fondo de página
   (reemplaza --crema) — mismo matiz (h) que la marca, muy poca
   saturación y muy alta luminosidad, para que se sienta "de la marca"
   sin competir con el contenido. */
function fondoSuaveDesde(hex){
  const { r, g, b } = hexARgb(hex);
  const hsl = rgbAHsl(r, g, b);
  const rgb = hslARgb(hsl.h, Math.min(25, hsl.s * 0.3), 97);
  return rgbAHex(rgb.r, rgb.g, rgb.b);
}
function aplicarColor(){
  const c = state.config.colorPrimario || "#9B1B30";
  const hover = colorHover(c);
  const fondo = fondoSuaveDesde(c);
  const textoSobreColor = textoLegibleSobre(c);
  document.documentElement.style.setProperty("--rojo", c);
  document.documentElement.style.setProperty("--rojo-h", hover);
  document.documentElement.style.setProperty("--crema", fondo);
  /* --rojo-texto: calculado por contraste (WCAG), no fijo en blanco.
     TODAVÍA no reemplaza los usos existentes de "color:#fff" sobre
     var(--rojo) en el resto del archivo (decenas de puntos) — eso es
     un cambio de superficie grande que merece hacerse con cuidado
     aparte, no de paso acá. Queda disponible para cuando se haga ese
     reemplazo: un color de marca muy claro (ej. un pastel) hoy
     seguiría mostrando texto blanco fijo encima, poco legible. */
  document.documentElement.style.setProperty("--rojo-texto", textoSobreColor);
  const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
  if (!isNaN(r)) document.documentElement.style.setProperty("--sombra", "rgba(" + r + "," + g + "," + b + ",0.15)");
}

/* ══════════════════════════════════════════════════════════════
   SPLASH PERSONALIZADO POR TIENDA — dos capas
   Capa 1 (acá): usa solo el STORE_ID ya resuelto, sin esperar a
   Firestore — se ve al instante, antes de que carguen los datos
   reales de la tienda.
   Capa 2 (actualizarSplashConConfig): usa nombre y color reales de
   state.config, ya con los datos completos — reemplaza lo que puso
   la Capa 1 apenas están disponibles.
   Pendiente (ver ROADMAP.md, sección 2): reemplazar el fondo de color
   por una imagen que el cliente proporciona — hoy solo se ajusta el
   color de fondo, no una imagen. */
function nombreLegibleDesdeStoreId(id){
  // "pizzeria-juan" → "Pizzeria Juan" — solo mientras llega el nombre real
  return String(id || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, function(c){ return c.toUpperCase(); })
    .trim() || "Tu Tienda";
}
function actualizarSplashBasico(){
  /* Aplicar color cacheado de la ultima visita — para que el splash
     no muestre el color por defecto (rojo vino) mientras Firebase
     responde. Se actualiza en cargarFirebase() con el color real. */
  try {
    const colorCache = localStorage.getItem("tb_splash_color");
    if (colorCache) {
      document.documentElement.style.setProperty("--splash-color", colorCache);
    }
  } catch(e){}
  const nombreEl = document.getElementById("splashNombre");
  const subEl = document.getElementById("splashSub");
  if (!nombreEl || !subEl) return;
  nombreEl.textContent = "Cargando";
  subEl.textContent = nombreLegibleDesdeStoreId(STORE_ID);
}
function actualizarSplashConConfig(){
  /* Ya no aplica — el splash nuevo usa --splash-color actualizado en
     cargarFirebase(). Se mantiene la función vacía por compatibilidad
     con el código que la llama. */
}

/* FIREBASE */
/* ════════════════════════════════════════════════════════════════
   FIREBASE — rutas, lectura, tiempo real y escrituras
   Estructura: tiendas/{STORE_ID}/{config|productos|cupones|locales|pedidos|dispositivos|intentos_pago}

   config está partido en dos documentos (ver README-FIRESTORE-RULES.md):
     config/general → público, lo lee cualquier visitante sin sesión
     config/privado → solo el dueño autenticado (mpToken, resendApiKey,
                       emailEmisor, emailVendedor)
   Por eso config/privado y dispositivos (suscripciones push del vendedor)
   solo se piden cuando hay sesión devmode — pedirlos sin sesión no
   filtraría nada (las reglas los rechazan igual), pero sí generaría un
   error de permisos en la consola de cada visitante anónimo sin motivo.
   ════════════════════════════════════════════════════════════════ */
function col(nombre){ return db.collection("tiendas").doc(STORE_ID).collection(nombre); }
function colPrivado(){ return db.collection("tiendas").doc(STORE_ID).collection("config"); }
function mapDocs(snap){ return snap.docs.map(d => Object.assign({ id:d.id }, d.data())); }
function _haySesionDevmode(){ return lsGet("tb_dev_session") === "1" || document.body.classList.contains("dev-on"); }

async function sembrarDatosDemo(){
  const batch = db.batch();
  batch.set(col("config").doc("general"), DEMO_DATA.config);
  batch.set(col("config").doc("privado"), DEMO_DATA.configPrivado);
  DEMO_DATA.productos.forEach(function(p){ batch.set(col("productos").doc(p.id), p); });
  DEMO_DATA.cupones.forEach(function(cu){ batch.set(col("cupones").doc(cu.id), cu); });
  DEMO_DATA.locales.forEach(function(l){ batch.set(col("locales").doc(l.id), l); });
  await batch.commit();
  state.config        = Object.assign({}, DEMO_DATA.config);
  state.configPrivado = Object.assign({}, DEMO_DATA.configPrivado);
  state.productos = normalizarOrden(DEMO_DATA.productos.map(function(p){ return Object.assign({}, p); }));
  state.cupones   = DEMO_DATA.cupones.map(function(cu){ return Object.assign({}, cu); });
  state.locales   = DEMO_DATA.locales.map(function(l){ return Object.assign({}, l); });
  console.log("✅ Firestore estaba vacío — datos demo sembrados");
}

/* Carga (y, si hace falta, re-suscribe) config/privado + dispositivos.
   Se llama desde cargarFirebase() si ya hay sesión al arrancar, y desde
   activarDevmode() por si el login ocurrió después de esa carga inicial. */
let _privadoCargado = false;
async function cargarConfigPrivada(){
  if (_privadoCargado || !db) return;
  _privadoCargado = true;
  try {
    const [cp, di] = await Promise.all([
      colPrivado().doc("privado").get(),
      col("dispositivos").get()
    ]);
    state.configPrivado = Object.assign({}, DEMO_DATA.configPrivado, cp.exists ? cp.data() : {});
    state.dispositivos  = mapDocs(di);
    colPrivado().doc("privado").onSnapshot(d => {
      state.configPrivado = Object.assign({}, DEMO_DATA.configPrivado, d.exists ? d.data() : {});
      renderAll();
    });
    col("dispositivos").onSnapshot(s => { state.dispositivos = mapDocs(s); renderPanelNotif(); });
    renderAll();
  } catch(e){
    _privadoCargado = false; /* permitir reintentar si falló (p.ej. reglas aún no desplegadas) */
    console.warn("No se pudo leer config/privado o dispositivos — ¿sesión devmode válida?", e);
  }
}

/* ── Favicon dinámico por rubro ──
   Dibuja el emoji del rubro sobre un canvas y lo usa como ícono de la
   pestaña — no requiere imágenes preexistentes por rubro, funciona
   igual para cualquier rubro que se agregue después a RUBROS. Mismo
   patrón de dos capas que el splash: Capa 1 apenas arranca (usa lo que
   ya sabemos del rubro por defecto), Capa 2 cuando state.config trae
   el rubro real de la tienda. */
function aplicarFavicon(emoji){
  try {
    /* Reutiliza el mismo SVG que EMOJI_A_ICONO ya usa para reemplazar
       este emoji en el resto de la interfaz — antes, el favicon era el
       único lugar del proyecto que seguía dibujando el carácter emoji
       literal con ctx.fillText() en vez del ícono SVG propio, una
       inconsistencia real con el resto del trabajo de reemplazo. Cargar
       un SVG en un <img> para dibujarlo con drawImage() es async (a
       diferencia de fillText, que era síncrono), así que esta función
       ahora depende de que la imagen termine de cargar antes de volcarla
       al canvas. */
    const svg = EMOJI_A_ICONO[emoji];
    if (!svg) { aplicarFaviconEmojiCrudo(emoji); return; } // respaldo si el emoji no está en el mapa
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    /* El SVG usa stroke="currentColor" — sin un "color:" en el propio
       <svg>, currentColor cae al negro por defecto del navegador dentro
       de una imagen standalone (no hereda del DOM, porque esta imagen
       nunca se inserta en la página). Se fuerza explícitamente un color
       oscuro legible como favicon sobre fondo claro. */
    const svgConColor = svg.replace("<svg ", '<svg style="color:#1A1A1A" ');
    const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgConColor);
    img.onload = function(){
      ctx.drawImage(img, 6, 6, 52, 52); // margen para que no toque los bordes del favicon
      aplicarFaviconDesdeURL(canvas.toDataURL("image/png"));
    };
    img.onerror = function(){ aplicarFaviconEmojiCrudo(emoji); }; // respaldo si el SVG no carga
    img.src = svgUrl;
  } catch(e){ console.warn("No se pudo generar el favicon:", e); }
}
/* Respaldo — dibuja el emoji Unicode crudo, solo si el SVG no está
   disponible o no carga. No debería usarse en el camino normal. */
function aplicarFaviconEmojiCrudo(emoji){
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.font = "52px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 32, 38);
    aplicarFaviconDesdeURL(canvas.toDataURL("image/png"));
  } catch(e){ console.warn("No se pudo generar el favicon de respaldo:", e); }
}
function aplicarFaviconDesdeURL(url){
  let link = document.querySelector('link[rel="icon"]');
  if (!link){
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = url;
}
function actualizarFaviconConConfig(){
  /* Prioridad: el logo real que el cliente subió (guardado como
     logoBase64 al crear la tienda, ver crearTienda.js) > el emoji
     genérico del rubro como respaldo. */
  const logoReal = state.config && state.config.logoBase64;
  if (logoReal) { aplicarFaviconDesdeURL(logoReal); return; }
  const rubroId = (state.config && (state.config.subrubro || state.config.rubro)) || "hamburguesas";
  aplicarFavicon(rubroPorId(rubroId).ico);
}

async function cargarFirebase(){
  /* Mostrar skeletons mientras carga Firestore */
  mostrarSkeletons();
  const conSesion = _haySesionDevmode();
  try {
    const [cf, pr, cu, lo] = await Promise.all([
      col("config").doc("general").get(),
      col("productos").get(),
      col("cupones").get(),
      col("locales").get()
    ]);
    if (cf.exists) state.config = Object.assign({}, DEMO_DATA.config, cf.data());
    /* Actualizar --splash-color SOLO acá, con el color real de Firestore.
       Esto garantiza que el splash arranca negro (default del :root) y
       solo se tiñe cuando Firebase responde con el color verdadero —
       nunca con el valor DEMO intermedio. */
    if (state.config.colorPrimario) {
      document.documentElement.style.setProperty("--splash-color", state.config.colorPrimario);
      try { localStorage.setItem("tb_splash_color", state.config.colorPrimario); } catch(e){}
    }
    state.productos    = normalizarOrden(mapDocs(pr));
    state.cupones      = mapDocs(cu);
    state.locales      = mapDocs(lo);
    actualizarSplashConConfig(); // Capa 2 — nombre y color reales, ya disponibles
    actualizarFaviconConConfig(); // Capa 2 — rubro real, ya disponible
    if (conSesion) await cargarConfigPrivada();
    if (!state.productos.length){
      try { await sembrarDatosDemo(); } catch(se){ console.warn("Seed:", se); }
    }
    renderAll();
    /* Ocultar splash cuando Firebase terminó de cargar el nombre real */
    ocultarSplash();
  } catch(e){
    console.error("Error leyendo Firestore:", e);
    toast("Error al conectar con Firebase");
    ocultarSplash(); /* Ocultar también si hay error para no quedar bloqueado */
  }
  col("config").doc("general").onSnapshot(d => { if (d.exists){ state.config = Object.assign({}, DEMO_DATA.config, d.data()); renderAll(); } });
  col("productos").onSnapshot(s => { state.productos = normalizarOrden(mapDocs(s)); renderAll(); });
  col("cupones").onSnapshot(s => { state.cupones = mapDocs(s); renderAll(); });
  col("locales").onSnapshot(s => { state.locales = mapDocs(s); renderAll(); });
  /* dispositivos y config/privado se suscriben desde cargarConfigPrivada(),
     solo cuando hay sesión devmode — ver comentario al inicio del bloque. */
}

/* — Escrituras: demo → memoria · real → Firestore —
   "config" y "configPrivado" son ambos colName="config" en Firestore
   (mismo padre), pero apuntan a documentos distintos (general/privado) y
   a distinta clave de state — de ahí el parámetro docId en vez de asumirlo. */
function applyLocal(colName, docId, field, value){
  if (colName === "config" && docId === "general"){ state.config[field] = value; return; }
  if (colName === "config" && docId === "privado"){ state.configPrivado[field] = value; return; }
  const it = (state[colName] || []).find(x => x.id === docId);
  if (it) it[field] = value;
}

async function saveField(colName, docId, field, value){
  if (_modoBorrador && !DEMO){
    const oldValue = valorActual(colName, docId, field);
    applyLocal(colName, docId, field, value);
    _pushChange(colName, docId, field, value, oldValue);
    renderAll();
    return true;
  }
  if (DEMO){
    applyLocal(colName, docId, field, value);
    renderAll();
    return true;
  }
  try {
    await col(colName).doc(docId).set({ [field]: value }, { merge:true });
    applyLocal(colName, docId, field, value);
    return true;
  } catch(e){
    console.error("Error al guardar:", e);
    toast("Error al guardar — revisa las reglas de Firestore");
    return false;
  }
}
function saveConfig(field, value){ return saveField("config", "general", field, value); }
/* Campos sensibles (mpToken, resendApiKey, emailEmisor, emailVendedor) —
   requiere sesión devmode real: las reglas de Firestore (ver
   README-FIRESTORE-RULES.md) rechazan esta escritura si no hay auth,
   así que sin sesión esto falla igual, pero conviene no ni intentarlo. */
function saveConfigPrivado(field, value){
  if (!DEMO && !_haySesionDevmode()){
    toast("Necesitas iniciar sesión para guardar esto");
    return Promise.resolve(false);
  }
  return saveField("config", "privado", field, value);
}

async function crearDoc(colName, data){
  if (DEMO){
    const it = Object.assign({ id: colName.slice(0,2) + Date.now() }, data);
    state[colName].push(it);
    renderAll();
    return it.id;
  }
  try { const ref = await col(colName).add(data); return ref.id; }
  catch(e){ console.error(e); toast("Error al crear"); return null; }
}

async function borrarDoc(colName, id){
  if (DEMO){
    state[colName] = state[colName].filter(x => x.id !== id);
    renderAll();
    return true;
  }
  try { await col(colName).doc(id).delete(); return true; }
  catch(e){ console.error(e); toast("Error al eliminar"); return false; }
}

/* ════════════════════════════════════════════════════════════════
   SPA NAVIGATION — subpáginas por hash
   ════════════════════════════════════════════════════════════════ */
const PAGINAS = ["inicio","menu","checkout","confirmacion","cupones","locales","cuenta","producto"];

function paginaActual(){
  const h = (location.hash || "#inicio").replace("#","").split("?")[0];
  return PAGINAS.includes(h) ? h : "inicio";
}
function irPagina(p){ location.hash = "#" + p; }

function _resetDirSelector(){
  var dw = qs("#dirSelectorWrap");
  if (dw){ dw._dirPintado = false; dw._usandoOtra = false; dw.innerHTML = ""; dw.style.display = "none"; }
  /* Reset gate: próxima visita al checkout vuelve a preguntar si no está logueado */
  if (!clienteUser) _ckModoInvitado = false;
}

function router(){
  /* Acceso directo por ?dev=1 */
  if (location.search.includes("dev=1") && !document.body.classList.contains("dev-on")){
    lsSet("tb_dev_session","1");
    setTimeout(function(){ if (!document.body.classList.contains("dev-on")) abrirLogin(); }, 600);
  }
  /* Notificación push → abrir devmode en pestaña Pedidos */
  if (location.hash === "#devpedidos"){
    history.replaceState(null, "", "#inicio");
    if (authUser || DEMO){
      activarDevmode(true);
      /* Abrir panel */
      setTimeout(function(){
        const panelEl = document.getElementById("panelEl") || document.querySelector(".panel");
        if (panelEl && !panelEl.classList.contains("open")) panelEl.classList.add("open");
        const btn = document.querySelector('.ptab[data-pt="pedidos"]');
        if (btn) btn.click();
      }, 150);
    }
    return;
  }
  const p = paginaActual();
  /* Reset selector de direcciones al salir del checkout */
  if (p !== "checkout") _resetDirSelector();
  document.body.dataset.page = p;
  qsa(".page").forEach(el => el.classList.toggle("active", el.id === "page-" + p));
  qsa(".tabbar .tab").forEach(t => t.classList.toggle("active", t.dataset.page === p));
  qs("#menuDrop").classList.remove("open");
  cerrarCarrito();
  if (p === "checkout"){
    evaluarGate();   /* primero gate, luego renderCheckout solo si procede */
    /* Colapsar el resumen al entrar al checkout */
    const res = document.getElementById("ckResumen");
    if (res) res.classList.remove("expandido");
  }
  if (p === "confirmacion") renderConfirmacion();
  window.scrollTo({ top:0, behavior:"auto" });
}

function initNav(){
  window.addEventListener("hashchange", router);
  on("btnBack", "click", () => {
    if (history.length > 1) history.back(); else irPagina("inicio");
  });

  const drop = qs("#menuDrop");
  on("btnBurger", "click", e => { e.stopPropagation(); drop.classList.toggle("open"); });
  document.addEventListener("click", e => {
    if (!drop.contains(e.target) && !e.target.closest("#btnBurger")) drop.classList.remove("open");
  });
  qsa(".mlink").forEach(b => b.addEventListener("click", () => irPagina(b.dataset.go)));

  qsa(".tabbar .tab").forEach(t => t.addEventListener("click", () => {
    irPagina(t.dataset.page);
  }));
  /* Botón "Iniciar sesión" dentro de page-cuenta */
  document.addEventListener("click", e => {
    if (e.target.closest("#btnCuentaLogin"))
      toast("👤 Muy pronto podrás crear tu cuenta — ¡vuelve pronto!");
  });

  on("btnFloat", "click", () => irPagina("menu"));
  on("btnVerMenu", "click", () => irPagina("menu"));
  on("btnVolverInicio", "click", () => irPagina("inicio"));
  on("btnCart", "click", abrirCarrito);

  /* Modal de cookies al cargar */
  if (!lsGet("tb_cookies")) qs("#cookiesModal").classList.add("open");
  qsa("#cookiesModal [data-ck]").forEach(b => b.addEventListener("click", () => {
    lsSet("tb_cookies", b.dataset.ck);
    qs("#cookiesModal").classList.remove("open");
  }));
}

/* ════════════════════════════════════════════════════════════════
   RENDER GLOBAL
   ════════════════════════════════════════════════════════════════ */
let editing = false, pendingRender = false;

function renderAll(){
  if (editing){ pendingRender = true; return; }
  aplicarColor();
  document.body.classList.toggle("cerrada", state.config.abierto === false);
  renderNombre();
  renderInicio();
  renderMenu();
  renderCupones();
  renderLocales();
  renderFooter();
  renderConfTextos();
  renderCartSheet();
  renderCheckout();
  renderPanel();
  aplicarIconosGlobal(); // al final: cubre lo que todas las funciones de arriba acaban de generar
}

function renderNombre(){
  const n = state.config.nombre || "TEST BURGERS";
  const logo = state.config.logoBase64;
  const imgEl = qs("#logoImg");
  const txtEl = qs("#logoTexto");
  if (imgEl && txtEl){
    if (logo){
      imgEl.src = logo;
      imgEl.alt = n;
      imgEl.style.display = "block";
      txtEl.style.display = "none";
      document.body.classList.add("con-logo");
    } else {
      imgEl.style.display = "none";
      txtEl.style.display = "";
      txtEl.textContent = n;
      document.body.classList.remove("con-logo");
    }
  }
  qsa('[data-bind="nombre"]').forEach(el => {
    if (el.id === "logoTop" || el.id === "logoImg" || el.id === "logoTexto") return;
    el.textContent = n;
  });
  document.title = n;
}
function renderFooter(){
  qs("#crTexto").textContent = state.config.footerTexto || "Todos los derechos reservados.";
  qs("#crAnno").textContent  = state.config.footerAno   || "2026";
}
function renderConfTextos(){
  qs("#confTitulo").textContent = state.config.confTitulo || "¡Pago confirmado!";
  qs("#confSub").textContent    = state.config.confSub    || "";
  qs("#tl1").textContent = state.config.timeline1 || "Pedido recibido";
  qs("#tl2").textContent = state.config.timeline2 || "En preparación";
  qs("#tl3").textContent = state.config.timeline3 || "En camino";
  qs("#tl4").textContent = state.config.timeline4 || "Entregado";
  qs("#gpsCard").style.display = (state.config.mostrarGPS === false) ? "none" : "block";
}

/* ════════════════════════════════════════════════════════════════
   INICIO
   ════════════════════════════════════════════════════════════════ */
function skeletonOfertas(){
  return [1,2,3].map(() => '<div class="skel skel-oferta"></div>').join("");
}
function skeletonItems(){
  return [1,2,3].map(() => `
    <div class="skel-item">
      <div class="skel skel-item-img"></div>
      <div class="skel-item-body">
        <div class="skel skel-line w80"></div>
        <div class="skel skel-line w50"></div>
        <div class="skel skel-line w30"></div>
      </div>
    </div>`).join("");
}
function skeletonCats(){
  return [1,2,3,4].map(() => '<div class="skel skel-cat"></div>').join("");
}
function mostrarSkeletons(){
  const of = qs("#ofertasScroll");
  const ml = qs("#menuList");
  const cg = qs("#catGrid");
  const pl = qs("#popularesList");
  if(of) of.innerHTML = skeletonOfertas();
  if(ml) ml.innerHTML = skeletonItems();
  if(cg) cg.innerHTML = skeletonCats();
  if(pl) pl.innerHTML = skeletonItems();
}

function renderInicio(){
  const c = state.config;
  qs("#heroImg").src = c.heroImagen || DEMO_IMAGES.banner;
  qs("#heroBadge").textContent  = c.heroBadge  || "🔥 Más pedido hoy";
  qs("#heroTitulo").textContent = c.heroTitulo || "";
  qs("#heroSub").textContent    = c.heroSub    || "";

  /* ⭐ Banner de puntos (2H) */
  const pt = qs("#puntosTitulo"); if (pt) pt.textContent = c.puntosTitulo || "PROGRAMA DE PUNTOS";
  const p1 = qs("#puntosLinea1"); if (p1) p1.textContent = c.puntosLinea1 || "1 punto por cada $100 gastado";
  const p2 = qs("#puntosLinea2"); if (p2) p2.textContent = c.puntosLinea2 || "Canjéalos por descuentos exclusivos";
  const p3 = qs("#puntosLinea3"); if (p3) p3.textContent = c.puntosLinea3 || "Automático con cada compra";

  /* Ofertas de hoy — 2 slots conectados a la base de datos (2F) */
  const ofSlots = [
    _productoDeSlot(c.oferta1, 0),
    _productoDeSlot(c.oferta2, 1)
  ];
  qs("#ofertasScroll").innerHTML = ofSlots.some(s => s.producto)
    ? ofSlots.map((s, i) => s.producto ? ofertaCardHTML(s.producto, "oferta" + (i+1), c["ofertaSub" + (i+1)] || "") : "").join("")
    : '<p class="vacio">Aún no hay productos. Agrégalos desde el panel admin.</p>';

  /* Categorías 2×2 */
  const catsReales = Array.from(new Set(productosActivos().map(p => p.categoria).filter(Boolean))).sort();
  qs("#catGrid").innerHTML = catsReales.length
    ? catsReales.map(cat => {
        const prods = productosActivos().filter(p => p.categoria === cat && p.imagen);
        const img = prods.length ? prods[0].imagen : "";
        return `
      <button class="cat-tile" data-cat="${esc(cat)}">
        ${img ? `<img src="${esc(img)}" alt="${esc(cat)}" loading="lazy">` : ""}
        <span class="cat-tile-nombre">${esc(cat)}</span>
      </button>`;
      }).join("")
    : "";

  /* 📢 Banners promocionales (2I) */
  renderPromos();

  /* Más pedidos — 2 slots conectados a la base de datos (2F) */
  const dsSlots = [
    _productoDeSlot(c.productoDestacado1, 0),
    _productoDeSlot(c.productoDestacado2, 1)
  ];
  qs("#popularesList").innerHTML = dsSlots.some(s => s.producto)
    ? dsSlots.map((s, i) => s.producto
        ? itemDestacadoHTML(s.producto, "productoDestacado" + (i+1), c["destacadoSub" + (i+1)], s.configurado)
        : "").join("")
    : '<p class="vacio">Todavía no hay productos destacados.</p>';

  /* 🛵 Banner de pedido en curso (2D) */
  renderBannerPedidoActivo();
}

/* Resuelve el producto de un slot destacado: id configurado o fallback por orden */
function _productoDeSlot(prodId, fallbackIdx){
  const activos = productosActivos();
  if (prodId){
    const p = activos.find(x => x.id === prodId);
    if (p) return { producto: p, configurado: true };
  }
  return { producto: activos[fallbackIdx] || null, configurado: false };
}

/* Card de "Ofertas de hoy" — foto/nombre/precio del producto; subtítulo libre editable */
function ofertaCardHTML(p, slot, sub){
  const subField = slot === "oferta1" ? "ofertaSub1" : "ofertaSub2";
  return `
    <div class="oferta-card" data-ver="${esc(p.id)}" data-selprod="${esc(slot)}">
      <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" style="object-fit:cover">
      <div class="oferta-info">
        <div>
          <p class="oferta-nombre">${esc(p.nombre)}</p>
          <p class="oferta-sub${sub ? "" : " sub-vacia"}" data-ecol="config" data-edoc="general" data-efield="${esc(subField)}" data-etype="text">${esc(sub || "＋ subtítulo")}</p>
          <span class="oferta-precio">${fmtPrecio(p.precio)}</span>
        </div>
        <button class="btn-add-circ" data-add="${esc(p.id)}" aria-label="Agregar ${esc(p.nombre)}">＋</button>
      </div>
    </div>`;
}

/* Card de "Más pedidos" — mismo diseño que prod-item, edición vía selector de producto */
function itemDestacadoHTML(p, slot, sub, configurado){
  const subField = slot === "productoDestacado1" ? "destacadoSub1" : "destacadoSub2";
  const subTexto = configurado ? (sub || "") : (sub || p.descripcion || "");
  const tieneStockControl = p.stock != null && p.stock !== "";
  const stockNum   = tieneStockControl ? Number(p.stock) : Infinity;
  const agotado    = tieneStockControl && stockNum <= 0;
  const stockBajo  = tieneStockControl && stockNum > 0 && stockNum <= 5;
  const stockTag   = agotado
    ? '<span class="prod-agotado-tag">AGOTADO</span>'
    : (tieneStockControl && stockNum <= 20
        ? '<span class="prod-stock-tag' + (stockBajo?" low":"") + '">' + stockNum + ' disponibles</span>'
        : '');
  return `
    <div class="prod-item${agotado ? ' prod-agotado' : ''}" data-selprod="${esc(slot)}">
      <div class="prod-img" data-ver="${esc(p.id)}" style="cursor:pointer;position:relative">
        <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">
        ${stockTag}
      </div>
      <div class="prod-info" style="cursor:pointer" data-ver="${esc(p.id)}">
        <p class="prod-nombre">${esc(p.nombre)}</p>
        <p class="prod-desc${subTexto ? "" : " sub-vacia"}" data-ecol="config" data-edoc="general" data-efield="${esc(subField)}" data-etype="text">${esc(subTexto || "＋ subtítulo")}</p>
        <span class="prod-precio">${fmtPrecio(p.precio)}</span>
      </div>
      <button class="pill pill-solid pill-sm prod-cta${agotado?" prod-cta-dis":""}" data-add="${esc(p.id)}" ${agotado?"disabled":""}>
        ${agotado ? "Agotado" : "＋ Agregar"}
      </button>
    </div>`;
}

/* 📢 Carrusel de banners promocionales */
function renderPromos(){
  const bloque = qs("#bloquePromos");
  const scroll = qs("#promoScroll");
  if (!bloque || !scroll) return;
  const hoy = new Date().toISOString().slice(0, 10);
  const activos = (Array.isArray(state.config.banners) ? state.config.banners : [])
    .filter(b => b && (b.titulo || b.subtitulo))
    .filter(b => !b.vence || String(b.vence) >= hoy);
  if (!activos.length){ bloque.style.display = "none"; scroll.innerHTML = ""; return; }
  bloque.style.display = "block";
  scroll.innerHTML = activos.map(b => `
    <div class="promo-card" style="background:${esc(b.color || "#9B1B30")}">
      <span class="promo-emoji">${esc(b.emoji || "🎉")}</span>
      <div class="promo-txt">
        <p class="promo-titulo">${esc(b.titulo || "")}</p>
        <p class="promo-sub">${esc(b.subtitulo || "")}</p>
      </div>
    </div>`).join("");
}

function itemProductoHTML(p){
  const tieneStockControl = p.stock != null && p.stock !== "";
  const stockNum   = tieneStockControl ? Number(p.stock) : Infinity;
  const agotado    = tieneStockControl && stockNum <= 0;
  const stockBajo  = tieneStockControl && stockNum > 0 && stockNum <= 5;
  const stockTag   = agotado
    ? '<span class="prod-agotado-tag">AGOTADO</span>'
    : (tieneStockControl && stockNum <= 20
        ? '<span class="prod-stock-tag' + (stockBajo?" low":"") + '">' + stockNum + ' disponibles</span>'
        : '');
  return `
    <div class="prod-item${agotado ? ' prod-agotado' : ''}">
      <div class="prod-img" data-ecol="productos" data-edoc="${esc(p.id)}" data-efield="imagen" data-etype="img" data-ver="${esc(p.id)}" style="cursor:pointer;position:relative">
        <img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy">
        ${stockTag}
      </div>
      <div class="prod-info" style="cursor:pointer" data-ver="${esc(p.id)}">
        <p class="prod-nombre" data-ecol="productos" data-edoc="${esc(p.id)}" data-efield="nombre" data-etype="text">${esc(p.nombre)}</p>
        <p class="prod-desc" data-ecol="productos" data-edoc="${esc(p.id)}" data-efield="descripcion" data-etype="text">${esc(p.descripcion)}</p>
        <span class="prod-precio" data-ecol="productos" data-edoc="${esc(p.id)}" data-efield="precio" data-etype="precio">${fmtPrecio(p.precio)}</span>
      </div>
      <button class="pill pill-solid pill-sm prod-cta${agotado?" prod-cta-dis":""}" data-add="${esc(p.id)}" ${agotado?"disabled":""}>
        ${agotado ? "Agotado" : "＋ Agregar"}
      </button>
    </div>`;
}

let _prodDetId = null, _prodDetCant = 1;
let _prodDetSeleccion = {};   // { nombreGrupo: opcionElegida } — se resetea cada vez que se abre el modal
let _prodDetTextoPersonal = "";

/* Arma el HTML de selectores de variantes + campo de personalización
   dentro del modal de detalle — vacío si el producto no tiene ninguno
   de los dos activado. Cada grupo es un <select> nativo (sin
   dependencias nuevas, funciona bien en celular); la personalización
   es un input de texto simple. */
function renderVariantesEnDetalle(p){
  const cont = document.getElementById("prodDetVariantes");
  if (!cont) return;
  const grupos = (p.variantesActivas && Array.isArray(p.variantes)) ? p.variantes.filter(g => g.nombre && g.opciones && g.opciones.length) : [];
  let html = "";
  grupos.forEach(g => {
    html += `
      <label class="plabel" style="margin-top:12px">${esc(g.nombre)}</label>
      <select class="field" data-vargrupo="${esc(g.nombre)}">
        <option value="" disabled ${!_prodDetSeleccion[g.nombre] ? "selected" : ""}>Elegí ${esc(g.nombre.toLowerCase())}</option>
        ${g.opciones.map(op => `<option value="${esc(op)}" ${_prodDetSeleccion[g.nombre] === op ? "selected" : ""}>${esc(op)}</option>`).join("")}
      </select>`;
  });
  if (p.permitePersonalizacion){
    html += `
      <label class="plabel" style="margin-top:12px">${esc(p.personalizacionEtiqueta || "Nota personalizada")} <span style="color:var(--muted);font-weight:600">(opcional)</span></label>
      <input class="field" id="prodDetPersonalTexto" maxlength="120" value="${esc(_prodDetTextoPersonal)}" placeholder="Escribí acá...">`;
  }
  cont.innerHTML = html;
}

function abrirDetProducto(prodId){
  const p = state.productos.find(function(x){ return x.id === prodId; });
  if (!p) return;
  _prodDetId = prodId; _prodDetCant = 1;
  _prodDetSeleccion = {}; _prodDetTextoPersonal = "";
  document.getElementById("prodDetImgEl").src = p.imagen || "";
  document.getElementById("prodDetNombre").textContent = p.nombre || "";
  document.getElementById("prodDetDesc").textContent = p.descripcion || "";
  document.getElementById("prodDetPrecio").textContent = fmtPrecio(p.precio);
  document.getElementById("prodDetCant").textContent = "1";
  document.getElementById("prodDetTotal").textContent = fmtPrecio(p.precio);
  renderVariantesEnDetalle(p);
  irPagina("producto");
}

function initDetProducto(){
  document.getElementById("prodDetMenos").addEventListener("click", function(){
    if (_prodDetCant <= 1) return;
    _prodDetCant--;
    document.getElementById("prodDetCant").textContent = _prodDetCant;
    const p = state.productos.find(function(x){ return x.id === _prodDetId; });
    if (p) document.getElementById("prodDetTotal").textContent = fmtPrecio(p.precio * _prodDetCant);
  });
  document.getElementById("prodDetMas").addEventListener("click", function(){
    _prodDetCant++;
    document.getElementById("prodDetCant").textContent = _prodDetCant;
    const p = state.productos.find(function(x){ return x.id === _prodDetId; });
    if (p) document.getElementById("prodDetTotal").textContent = fmtPrecio(p.precio * _prodDetCant);
  });
  /* Guarda la elección apenas cambia — así prodDetAgregar solo lee
     estado ya actualizado, sin tener que releer el DOM en ese momento. */
  document.getElementById("prodDetVariantes").addEventListener("change", function(e){
    const sel = e.target.closest("[data-vargrupo]");
    if (sel){ _prodDetSeleccion[sel.dataset.vargrupo] = sel.value; return; }
    if (e.target.id === "prodDetPersonalTexto"){ _prodDetTextoPersonal = e.target.value; }
  });
  document.getElementById("prodDetVariantes").addEventListener("input", function(e){
    if (e.target.id === "prodDetPersonalTexto"){ _prodDetTextoPersonal = e.target.value; }
  });
  document.getElementById("prodDetAgregar").addEventListener("click", function(){
    if (!_prodDetId) return;
    const p = state.productos.find(function(x){ return x.id === _prodDetId; });
    if (p && p.variantesActivas && Array.isArray(p.variantes)){
      const grupoSinElegir = p.variantes.find(function(g){
        return g.nombre && g.opciones && g.opciones.length && !_prodDetSeleccion[g.nombre];
      });
      if (grupoSinElegir){
        toast("Elegí " + grupoSinElegir.nombre.toLowerCase() + " antes de agregar");
        return;
      }
    }
    for (var i = 0; i < _prodDetCant; i++){
      agregarAlCarrito(_prodDetId, Object.assign({}, _prodDetSeleccion), _prodDetTextoPersonal.trim());
    }
    history.back();
    toast("✅ Agregado al pedido");
  });
  /* Delegado: clic en imagen o info del producto → abrir detalle.
     FIX 2E: si el toque nació en un botón ＋ Agregar (data-add), no navegar —
     ese botón solo agrega al carrito. */
  document.addEventListener("click", function(e){
    if (document.body.classList.contains("dev-on") && !document.body.classList.contains("preview-cliente")) return;
    if (e.target.closest("[data-add], .prod-add, .btn-add-circ, .prod-cta, .prod-cta-dis")) return;
    const ver = e.target.closest("[data-ver]");
    if (!ver) return;
    abrirDetProducto(ver.dataset.ver);
  });
}

/* ════════════════════════════════════════════════════════════════
   MENU
   ════════════════════════════════════════════════════════════════ */
let filtroActual = "Todos";

function renderMenu(){
  const catsSeen = new Set();
  productosActivos().forEach(p => { if (p.categoria) catsSeen.add(p.categoria); });
  FILTROS = ["Todos", ...Array.from(catsSeen).sort()];
  if (filtroActual !== "Todos" && !catsSeen.has(filtroActual)) filtroActual = "Todos";
  qs("#filtrosBar").innerHTML = FILTROS.map(f => `
    <button class="fpill ${f === filtroActual ? "active" : ""}" data-f="${esc(f)}">${esc(f)}</button>`).join("");

  const items = productosActivos().filter(p => filtroActual === "Todos" || p.categoria === filtroActual);
  qs("#menuList").innerHTML = items.length
    ? items.map(p => itemProductoHTML(p)).join("")
    : '<p class="vacio">Pronto agregaremos productos en esta categoría.</p>';
}

function initMenu(){
  on("filtrosBar", "click", e => {
    const b = e.target.closest(".fpill");
    if (!b) return;
    filtroActual = b.dataset.f;
    renderMenu();
  });
  on("catGrid", "click", e => {
    const t = e.target.closest(".cat-tile");
    if (!t) return;
    filtroActual = t.dataset.cat;
    renderMenu();
    irPagina("menu");
  });
  /* ＋ Agregar — delegado global (inicio, menú, ofertas). Si el
     producto tiene variantes o personalización activadas, no agrega
     directo — abre el modal de detalle, que es donde vive el
     selector, en vez de agregar una combinación no elegida. */
  document.addEventListener("click", e => {
    let prodId = null;
    const b = e.target.closest("[data-add]");
    if (b) {
      prodId = b.dataset.add;
    } else {
      const br = e.target.closest(".prod-add, .btn-add-circ");
      if (br) {
        const card = br.closest("[data-id]");
        if (card) prodId = card.dataset.id;
      }
    }
    if (!prodId) return;
    /* Cortar el evento acá para que el handler del modal no lo procese */
    e.stopPropagation();
    e.preventDefault();
    if (document.body.classList.contains("dev-on") && !document.body.classList.contains("preview-cliente")) return;
    const p = state.productos.find(x => x.id === prodId);
    if (p && (p.variantesActivas || p.permitePersonalizacion)){
      abrirDetProducto(prodId);
      return;
    }
    agregarAlCarrito(prodId);
  }, true);  /* capture:true — corre ANTES que el handler del modal */
}

/* ════════════════════════════════════════════════════════════════
   CARRITO — bottom sheet + persistencia en localStorage
   ════════════════════════════════════════════════════════════════ */
function cargarCarrito(){
  try { carrito = JSON.parse(lsGet("tb_carrito") || "[]"); } catch(e){ carrito = []; }
  if (!Array.isArray(carrito)) carrito = [];
}
function guardarCarrito(){ lsSet("tb_carrito", JSON.stringify(carrito)); }
function totalItems(){ return carrito.reduce((s,i)=> s + i.cantidad, 0); }
function subtotalCarrito(){ return carrito.reduce((s,i)=> s + i.precio * i.cantidad, 0); }
/* ════════════════════════════════════════════════════════════════
   ZONAS DE DESPACHO — estado, detección, badge, autocomplete
   ════════════════════════════════════════════════════════════════ */
let _zonaActual   = null;   // null | { nombre, costo, minGratis, cobertura:bool }
let _comunaActual = "";

function _tieneZonas(){
  return Array.isArray(state.config.zonas) && state.config.zonas.length > 0;
}

function _detectarZona(comuna){
  _comunaActual = (comuna || "").trim();
  if (!_comunaActual){ _zonaActual = null; return; }
  if (!_tieneZonas()){ _zonaActual = null; return; }
  const cLow = _comunaActual.toLowerCase();
  let encontrada = null;
  for (const z of state.config.zonas){
    const lista = (z.comunas || "").split(",").map(s => s.toLowerCase().trim()).filter(Boolean);
    if (lista.includes(cLow)){ encontrada = z; break; }
  }
  _zonaActual = encontrada
    ? { nombre: encontrada.nombre||"", costo: Number(encontrada.costo)||0, minGratis: Number(encontrada.minGratis)||0, cobertura: true }
    : { cobertura: false };
}

function costoDelivery(tipo){
  if (tipo === "retiro") return 0;
  if (_tieneZonas() && _zonaActual){
    if (!_zonaActual.cobertura) return 0;  // bloqueado en validación
    const sub = subtotalCarrito();
    const min = _zonaActual.minGratis;
    if (min > 0 && sub >= min) return 0;
    return _zonaActual.costo;
  }
  const sub = subtotalCarrito();
  const min = Number(state.config.deliveryMinimo) || 0;
  if (min > 0 && sub >= min) return 0;
  return Number(state.config.deliveryCosto) || 0;
}

function actualizarZonaBadge(){
  const b = qs("#zonaBadge"); if (!b) return;
  b.className = "";
  if (tipoEntrega !== "delivery" || !_tieneZonas() || !_comunaActual){
    return; // display:none por clase vacía
  }
  if (!_zonaActual || !_zonaActual.cobertura){
    b.className = "zr";
    b.innerHTML = "🚫 <span>Sin cobertura en <strong>" + esc(_comunaActual) + "</strong>. Consulta por WhatsApp.</span>";
    return;
  }
  const sub = subtotalCarrito();
  const gratis = _zonaActual.minGratis > 0 && sub >= _zonaActual.minGratis;
  const precioTxt = gratis
    ? "<strong style='color:var(--verde)'>GRATIS</strong>"
    : fmtPrecio(_zonaActual.costo);
  const minTxt = _zonaActual.minGratis > 0 && !gratis
    ? " (gratis sobre " + fmtPrecio(_zonaActual.minGratis) + ")"
    : "";
  b.className = "zv";
  b.innerHTML = "📍 <span><strong>" + esc(_zonaActual.nombre) + "</strong> · Delivery " + precioTxt + minTxt + "</span>";
}

/* ════════════════════════════════════════════════════════════════
   GOOGLE MAPS — carga garantizada con callback clásico
   ════════════════════════════════════════════════════════════════ */
var _gmapsPromise = null;
function cargarMaps(){
  if (_gmapsPromise) return _gmapsPromise;
  _gmapsPromise = new Promise(function(resolve, reject){
    if (window.google && window.google.maps && window.google.maps.places){ resolve(); return; }
    window.__gmapsReady = function(){ resolve(); };
    var s = document.createElement("script");
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + GOOGLE_MAPS_KEY
          + "&libraries=places&language=es&region=CL&callback=__gmapsReady";
    s.async = true;
    s.onerror = function(){ _gmapsPromise = null; reject(new Error("gmaps-load")); };
    document.head.appendChild(s);
  });
  return _gmapsPromise;
}

function _extraerComuna(comps){
  if (!comps || !comps.length) return "";
  var orden = ["administrative_area_level_3","locality","sublocality_level_1","sublocality","administrative_area_level_2"];
  for (var i = 0; i < orden.length; i++){
    var c = comps.find(function(x){ return (x.types||[]).includes(orden[i]); });
    if (c) return c.long_name || c.longText || "";
  }
  return "";
}

/* ── Selector de comunas (poblado desde las zonas del devmode) ── */
function comunasDeZonas(){
  var lista = [];
  (state.config.zonas || []).forEach(function(z){
    (z.comunas || "").split(",").forEach(function(c){
      c = c.trim(); if (!c) return;
      if (!lista.some(function(x){ return x.toLowerCase() === c.toLowerCase(); })) lista.push(c);
    });
  });
  return lista.sort(function(a, b){ return a.localeCompare(b, "es"); });
}
function poblarComunas(sel, valor){
  if (!sel) return;
  var comunas = comunasDeZonas();
  var wrap = sel.closest(".ffield");
  if (!comunas.length){ if (wrap) wrap.style.display = "none"; sel.innerHTML = ""; return; }
  if (wrap) wrap.style.display = "";
  var vLow = (valor || "").toLowerCase();
  sel.innerHTML = '<option value=""></option>' +
    comunas.map(function(c){
      return '<option value="' + esc(c) + '"' + (vLow === c.toLowerCase() ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join("") +
    '<option value="__otra"' + (valor === "__otra" ? ' selected' : '') + '>Otra comuna…</option>';
  sel.classList.toggle("lleno", !!sel.value);
}
function comunaSeleccionada(sel){
  if (!sel || !sel.value) return "";
  return sel.value === "__otra" ? "tu comuna" : sel.value;
}
function setComunaSelect(sel, comuna){
  if (!sel || !sel.options.length) return;
  var match = "";
  Array.prototype.forEach.call(sel.options, function(o){
    if (o.value && o.value !== "__otra" && o.value.toLowerCase() === (comuna || "").toLowerCase()) match = o.value;
  });
  sel.value = match || (comuna ? "__otra" : "");
  sel.classList.toggle("lleno", !!sel.value);
}
function dirCompletaCheckout(){
  var d = qs("#fDireccion").value.trim();
  /* Solo agregar comuna si hay selector visible y tiene valor */
  if (comunasDeZonas().length > 0){
    var c = comunaSeleccionada(qs("#fComuna"));
    if (c && c !== "tu comuna" && d.toLowerCase().indexOf(c.toLowerCase()) === -1) d += ", " + c;
  }
  return d;
}

/* ════════════════════════════════════════════════════════════════
   AUTOCOMPLETE PROPIO — dropdown 100% nuestro, sin widget de Google
   Usa Places API (New) vía REST — compatible con las keys actuales
   ════════════════════════════════════════════════════════════════ */
function instalarAutocomplete(inputEl, onSelect){
  if (!inputEl || inputEl._gpReady) return;
  inputEl._gpReady = true;

  /* Dropdown anclado al BODY con position:fixed
     — escapa de overflow:hidden y z-index del modal */
  var drop = document.createElement("div");
  drop.className = "gp-drop";
  drop.style.cssText = "position:fixed;z-index:99999;display:none;border-radius:14px;background:#fff;border:1.5px solid #E0E0E0;box-shadow:0 8px 28px rgba(0,0,0,.16);overflow:hidden;font-family:inherit;";
  document.body.appendChild(drop);

  var timer = null, items = [], idx = -1, sesion = null;

  function _uuid(){
    try { return crypto.randomUUID(); }
    catch(e){ return "s" + Date.now() + Math.random().toString(16).slice(2); }
  }

  function posicionar(){
    var r = inputEl.getBoundingClientRect();
    drop.style.left  = r.left + "px";
    drop.style.top   = (r.bottom + 3) + "px";
    drop.style.width = r.width + "px";
  }

  function cerrar(){
    drop.style.display = "none";
    drop.innerHTML = "";
    items = []; idx = -1;
  }

  function pintarMsg(txt){
    drop.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:#888;font-weight:700">' + esc(txt) + '</div>';
    posicionar();
    drop.style.display = "block";
  }

  function pintar(){
    if (!items.length){ pintarMsg("Sin resultados — revisa la dirección"); return; }
    drop.innerHTML = items.map(function(it, i){
      var bg = i===idx ? "background:var(--crema, #faf7f5);" : "";
      return '<div style="padding:11px 14px;cursor:pointer;border-top:'+(i===0?"none":"1px solid #f2f2f2")+';'+bg+'"'
        + ' data-i="'+i+'">'
        + '<div style="font-size:13.5px;font-weight:800;color:#1a1a1a">'+esc(it.principal)+'</div>'
        + (it.secundario?'<div style="font-size:11.5px;color:#888;margin-top:1px">'+esc(it.secundario)+'</div>':"")
        + '</div>';
    }).join("") + '<div style="font-size:9.5px;color:#bbb;text-align:right;padding:4px 10px;letter-spacing:.4px">🔍 Google</div>';
    posicionar();
    drop.style.display = "block";
    drop.querySelectorAll("[data-i]").forEach(function(el){
      el.addEventListener("pointerdown", function(ev){ ev.preventDefault(); elegir(Number(el.dataset.i)); });
    });
  }

  /* Places API (New) vía REST — funciona con las keys actuales de Google */
  function buscar(txt){
    if (!sesion) sesion = _uuid();
    fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_MAPS_KEY },
      body: JSON.stringify({
        input: txt, sessionToken: sesion,
        includedRegionCodes: ["cl"], languageCode: "es-419", regionCode: "cl"
      })
    })
    .then(function(resp){
      if (!resp.ok) return resp.json().then(function(err){
        throw new Error((err.error && err.error.message) || ("HTTP " + resp.status));
      });
      return resp.json();
    })
    .then(function(data){
      items = (data.suggestions || []).filter(function(s){ return s.placePrediction; }).map(function(s){
        var p = s.placePrediction, sf = p.structuredFormat || {};
        return {
          principal: (sf.mainText && sf.mainText.text) || (p.text && p.text.text) || "",
          secundario: (sf.secondaryText && sf.secondaryText.text) || "",
          placeId: p.placeId
        };
      });
      idx = -1; pintar();
    })
    .catch(function(e){
      console.warn("Places búsqueda:", e);
      pintarMsg("⚠️ Google Maps no respondió. Habilita “Places API (New)” en tu key de Google Cloud.");
    });
  }

  function elegir(i){
    var it = items[i]; if (!it) return;
    var textoTemp = it.principal + (it.secundario ? ", " + it.secundario : "");
    inputEl.value = textoTemp;
    cerrar();
    var tok = sesion; sesion = null; /* cierra sesión de facturación */
    fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(it.placeId)
        + "?languageCode=es-419&regionCode=cl" + (tok ? "&sessionToken=" + encodeURIComponent(tok) : ""), {
      headers: {
        "X-Goog-Api-Key": GOOGLE_MAPS_KEY,
        "X-Goog-FieldMask": "formattedAddress,addressComponents,location"
      }
    })
    .then(function(resp){ if (!resp.ok) throw new Error("HTTP " + resp.status); return resp.json(); })
    .then(function(det){
      inputEl.value = det.formattedAddress || textoTemp;
      var f2 = inputEl.closest(".ffield"); if (f2) f2.classList.remove("error");
      onSelect({
        direccion: det.formattedAddress || textoTemp,
        comuna: _extraerComuna(det.addressComponents),
        lat: det.location ? det.location.latitude : null,
        lng: det.location ? det.location.longitude : null
      });
    })
    .catch(function(e){
      console.warn("Places detalle:", e);
      onSelect({ direccion: textoTemp, comuna: "", lat: null, lng: null });
    });
  }

  inputEl.addEventListener("input", function(){
    var txt = (inputEl.value||"").trim();
    if (inputEl.id==="fDireccion"){ _zonaActual=null; _comunaActual=""; actualizarZonaBadge(); }
    if (inputEl.id==="dirInput"){ window._dirModalSel=null; var dm=document.getElementById("dirMapa"); if(dm)dm.classList.remove("show"); }
    clearTimeout(timer);
    if (txt.length < 3){ cerrar(); return; }
    timer = setTimeout(function(){
      pintarMsg("Buscando en Google Maps…");
      buscar(txt);
    }, 300);
  });

  inputEl.addEventListener("keydown", function(e){
    if (drop.style.display === "none") return;
    if (e.key==="ArrowDown"){ e.preventDefault(); idx=Math.min(idx+1,items.length-1); pintar(); }
    else if (e.key==="ArrowUp"){ e.preventDefault(); idx=Math.max(idx-1,0); pintar(); }
    else if (e.key==="Enter"){ e.preventDefault(); elegir(idx>=0?idx:0); }
    else if (e.key==="Escape"){ cerrar(); }
  });

  inputEl.addEventListener("focus", function(){ if(items.length) posicionar(); });
  inputEl.addEventListener("blur",  function(){ setTimeout(cerrar, 200); });
  inputEl._gpCerrar = cerrar;
}

/* Mini-mapa con marcador */
var _minimapas = {};
function mostrarMiniMapa(divId, lat, lng){
  var el = document.getElementById(divId);
  if (!el) return;
  if (lat==null||lng==null){ el.classList.remove("show"); return; }
  cargarMaps().then(function(){
    var pos = {lat:lat, lng:lng};
    el.classList.add("show");
    var mm = _minimapas[divId];
    if (!mm){
      var mapa = new google.maps.Map(el, { center:pos, zoom:16, disableDefaultUI:true, gestureHandling:"none", clickableIcons:false });
      var marker = new google.maps.Marker({ map:mapa, position:pos });
      _minimapas[divId] = { mapa:mapa, marker:marker };
    } else {
      mm.mapa.setCenter(pos); mm.marker.setPosition(pos);
      google.maps.event.trigger(mm.mapa,"resize"); mm.mapa.setCenter(pos);
    }
  }).catch(function(){});
}

/* Descuenta stock de los productos con control activado */
function descontarStock(items){
  /* Actualización OPTIMISTA de UI únicamente — ya NO escribe a Firestore.
     El descuento real de stock ahora lo hace el backend (webhookPago.js
     para MercadoPago, crearPedidoEfectivo.js para efectivo), que es
     quien validó el pedido contra el catálogo real. Si esta función
     también escribiera, el stock se descontaría dos veces. Esto solo
     adelanta visualmente el número en el panel de inventario mientras
     llega el onSnapshot con el valor real que ya escribió el backend. */
  if (!Array.isArray(items)) return;
  try{
    items.forEach(function(it){
      var p = state.productos.find(function(x){ return x.id === it.id; });
      if (!p || p.stock == null || p.stock === "") return;
      var nuevo = Math.max(0, (Number(p.stock)||0) - (Number(it.cantidad)||1));
      p.stock = nuevo; /* solo memoria local — el backend ya escribió el real */
      if (window._renderInventario) window._renderInventario();
    });
  }catch(e){ console.warn("stock:", e); }
}

/* Variante que SÍ escribe a Firestore — usada únicamente por el fallback
   sin backend (DEMO / FUNCTIONS_URL no configurado, ver
   postGuardadoPedidoSinBackend). Ahí no existe ninguna función backend
   que descuente el stock real, así que alguien tiene que hacerlo. */
function descontarStockLocal(items){
  if (!Array.isArray(items)) return;
  try{
    items.forEach(function(it){
      var p = state.productos.find(function(x){ return x.id === it.id; });
      if (!p || p.stock == null || p.stock === "") return;
      var nuevo = Math.max(0, (Number(p.stock)||0) - (Number(it.cantidad)||1));
      p.stock = nuevo; /* UI inmediata */
      saveField("productos", p.id, "stock", nuevo);
      if (window._renderInventario) window._renderInventario();
    });
  }catch(e){ console.warn("stock:", e); }
}

/* prodId: el producto real (para precio/stock/catálogo).
   variantes: { nombreGrupo: opcionElegida } o undefined si el producto
   no tiene variantes activas.
   notaPersonal: texto libre del campo de personalización, o "".

   Dos combinaciones distintas del mismo producto (ej. mismo cuchillo,
   "Cacha: Madera" vs "Cacha: Hueso") tienen que quedar como DOS líneas
   separadas en el carrito, no sumarse en una sola — por eso el
   carrito ya no busca solo por "id", busca por una CLAVE compuesta
   (claveCarrito) que combina el id real con las variantes elegidas.
   El control de stock, en cambio, sigue siendo por producto real
   (prodId), sumando la cantidad de TODAS las líneas de ese producto
   sin importar la variante — el stock es del producto físico, no de
   cada combinación por separado (a menos que el vendedor lleve stock
   por variante, que esta versión no contempla — ver ROADMAP.md si se
   necesita eso más adelante). */
function claveCarrito(prodId, variantes, notaPersonal){
  const partes = [prodId];
  if (variantes && Object.keys(variantes).length){
    partes.push(JSON.stringify(variantes)); // orden estable: mismas claves siempre en el mismo orden de inserción
  }
  if (notaPersonal) partes.push("nota:" + notaPersonal);
  return partes.join("|");
}
function agregarAlCarrito(prodId, variantes, notaPersonal){
  if (state.config.abierto === false){ toast("🔴 La tienda está cerrada por ahora"); return; }
  const p = state.productos.find(x => x.id === prodId);
  if (!p) return;
  /* Control de inventario (stock null/"" = sin control) — suma TODAS
     las líneas de este producto en el carrito, sin importar la
     variante, porque el stock es del producto físico. */
  var _tieneStock = p.stock != null && p.stock !== "";
  if (_tieneStock){
    var disp = Number(p.stock)||0;
    if (disp <= 0){ toast("😞 " + p.nombre + " está agotado"); return; }
    var enCarrito = carrito.filter(x => x.id === prodId).reduce((sum, x) => sum + x.cantidad, 0);
    if (enCarrito >= disp){ toast("Solo quedan " + disp + " de " + p.nombre); return; }
  }
  const clave = claveCarrito(prodId, variantes, notaPersonal);
  const it = carrito.find(x => x.claveCarrito === clave);
  if (it) it.cantidad += 1;
  else carrito.push({
    id:p.id, claveCarrito: clave, nombre:p.nombre, precio:Number(p.precio)||0, imagen:p.imagen||"", cantidad:1,
    variantes: (variantes && Object.keys(variantes).length) ? variantes : undefined,
    notaPersonal: notaPersonal || undefined
  });
  guardarCarrito();
  renderBadge(true);
  renderCartSheet();
  renderCheckout();
  toast("🍔 " + p.nombre + " agregado");
}

function cambiarCantidad(clave, delta){
  const it = carrito.find(x => x.claveCarrito === clave);
  if (!it) return;
  it.cantidad += delta;
  if (it.cantidad <= 0) carrito = carrito.filter(x => x.claveCarrito !== clave);
  guardarCarrito();
  renderBadge(false);
  renderCartSheet();
  renderCheckout();
}

function renderBadge(animar){
  const b = qs("#cartBadge");
  const n = totalItems();
  b.textContent = n;
  b.classList.toggle("oculto", n === 0);
  if (animar && n > 0){
    b.classList.remove("pop");
    void b.offsetWidth;
    b.classList.add("pop");
  }
}

/* Texto corto de variantes/nota para mostrar bajo el nombre del
   producto en el carrito — ej: " · Color: Rojo, Talla: M · "Feliz
   cumple""; vacío si el ítem no tiene ninguno de los dos. */
function textoVariantesCarrito(i){
  const partes = [];
  if (i.variantes){
    const texto = Object.entries(i.variantes).map(([k,v]) => k + ": " + v).join(", ");
    if (texto) partes.push(texto);
  }
  if (i.notaPersonal) partes.push('"' + i.notaPersonal + '"');
  return partes.length ? " · " + partes.map(esc).join(" · ") : "";
}
function renderCartSheet(){
  const n = totalItems();
  qs("#cartCount").textContent = n + (n === 1 ? " ítem" : " ítems");
  qs("#cartItems").innerHTML = carrito.length ? carrito.map(i => `
    <div class="citem">
      <div class="citem-img"><img src="${esc(i.imagen)}" alt="${esc(i.nombre)}"></div>
      <div class="citem-info">
        <p class="citem-nombre">${esc(i.nombre)}</p>
        <span class="citem-var">${fmtPrecio(i.precio)} c/u${textoVariantesCarrito(i)}</span>
        <div class="qty-ctrl">
          <button class="qty-btn" data-cid="${esc(i.claveCarrito)}" data-ca="dec" aria-label="Quitar uno">−</button>
          <span class="qty-num">${i.cantidad}</span>
          <button class="qty-btn" data-cid="${esc(i.claveCarrito)}" data-ca="inc" aria-label="Agregar uno">＋</button>
        </div>
      </div>
      <span class="citem-precio">${fmtPrecio(i.precio * i.cantidad)}</span>
    </div>`).join("")
    : '<p class="vacio" style="padding:26px 4px">Tu carrito está vacío. Agrega algo rico del menú 🍔</p>';

  const sub = subtotalCarrito();
  const del = costoDelivery("delivery");
  qs("#cartSubtotal").textContent = fmtPrecio(sub);
  qs("#cartDelivery").textContent = fmtPrecio(del);
  qs("#cartTotal").textContent    = fmtPrecio(sub + del);
  const gratis = sub > 0 && del === 0 && (Number(state.config.deliveryMinimo)||0) > 0 && sub >= Number(state.config.deliveryMinimo) && _direccionLista();
  qs("#cartFree").classList.toggle("show", gratis);
  qs("#btnCartContinuar").disabled = carrito.length === 0;
  qs("#btnCartContinuar").style.opacity = carrito.length ? "1" : ".5";
}

function abrirCarrito(){
  renderCartSheet();
  qs("#cartOverlay").classList.add("open");
  qs("#cartSheet").classList.add("open");
}
function cerrarCarrito(){
  qs("#cartOverlay").classList.remove("open");
  qs("#cartSheet").classList.remove("open");
}

function initCarrito(){
  cargarCarrito();
  renderBadge(false);
  on("cartOverlay", "click", cerrarCarrito);
  on("cartClose", "click", cerrarCarrito);
  on("cartItems", "click", e => {
    const b = e.target.closest(".qty-btn");
    if (!b) return;
    cambiarCantidad(b.dataset.cid, b.dataset.ca === "inc" ? 1 : -1);
  });
  on("btnCartContinuar", "click", () => {
    if (!carrito.length) return;
    cerrarCarrito();
    irPagina("checkout");
  });
}

/* ════════════════════════════════════════════════════════════════
   CHECKOUT
   ════════════════════════════════════════════════════════════════ */
let tipoEntrega = "delivery";
let metodoPago  = "mercadopago"; /* "efectivo" | "mercadopago" */

function renderSelectorDirecciones(){
  /* Solo en delivery y con usuario logueado */
  const wrap = qs("#dirSelectorWrap");
  if (!wrap) return;
  if (tipoEntrega !== "delivery" || !clienteUser){
    wrap.style.display = "none";
    qs("#campoDireccion").style.display = tipoEntrega === "delivery" ? "block" : "none";
    var _selCom = qs("#fComuna");
    if (_selCom){
      var _firma = comunasDeZonas().join("|");
      if (_selCom.dataset.firma !== _firma){
        poblarComunas(_selCom, _selCom.value);
        _selCom.dataset.firma = _firma;
      }
      var _wrapCom = _selCom.closest(".ffield");
      if (_wrapCom) _wrapCom.style.display = (tipoEntrega === "delivery" && comunasDeZonas().length > 0) ? "block" : "none";
    }
    return;
  }

  /* Si ya está pintado → solo actualizar visibilidad, NO recrear */
  if (wrap._dirPintado){
    wrap.style.display = "block";
    qs("#campoDireccion").style.display = wrap._usandoOtra ? "block" : "none";
    return;
  }

  /* Primera vez: leer de Firestore y construir el HTML */
  if (!db){ wrap.style.display = "none"; return; }
  db.collection("usuarios").doc(clienteUser.uid).collection("direcciones")
    .get().then(function(snap){
      if (snap.empty){ wrap.style.display = "none"; return; }
      const dirs = [];
      snap.forEach(function(d){ dirs.push(Object.assign({ id: d.id }, d.data())); });
      dirs.sort(function(a, b){ return (b.favorita ? 1 : 0) - (a.favorita ? 1 : 0); });
      qs("#campoDireccion").style.display = "none";
      wrap.style.display = "block";
      wrap._usandoOtra = false;
      wrap.innerHTML = '<div class="dir-selector-title">📍 Tus direcciones guardadas</div>' +
        dirs.map(function(d){
          var ico = d.label && d.label.toLowerCase().includes("trabajo") ? "🏢" : (d.label && d.label.toLowerCase().includes("otro") ? "📌" : "🏠");
          return '<div class="dir-option" data-dirid="' + d.id + '" data-dir="' + esc(d.direccion) + '" data-comuna="' + esc(d.comuna || "") + '" data-lat="' + (d.lat != null ? d.lat : "") + '" data-lng="' + (d.lng != null ? d.lng : "") + '" data-telefono="' + esc(d.telefono || "") + '">' +
            '<span class="dir-option-ico">' + ico + '</span>' +
            '<div class="dir-option-txt"><div class="dir-option-label">' + esc(d.label || "Casa") + (d.favorita ? ' ⭐' : '') + '</div>' +
            '<div class="dir-option-addr">' + esc(d.direccion) + '</div></div></div>';
        }).join("") +
        '<div class="dir-option" id="dirNueva"><span class="dir-option-ico">➕</span><div class="dir-option-txt"><div class="dir-option-nueva">Usar otra dirección</div></div></div>';
      /* Marcar como pintado ANTES de los listeners para evitar loops */
      wrap._dirPintado = true;
      /* Auto-seleccionar favorita */
      const fav = dirs.find(function(d){ return d.favorita; }) || dirs[0];
      if (fav){
        const el = wrap.querySelector("[data-dirid=\"" + fav.id + "\"]");
        if (el){
          el.classList.add("sel");
          qs("#fDireccion").value = fav.direccion;
          setComunaSelect(qs("#fComuna"), fav.comuna || "");
          _detectarZona(fav.comuna || "");
          mostrarMiniMapa("ckMapa", fav.lat != null ? fav.lat : null, fav.lng != null ? fav.lng : null);
          /* El teléfono va vinculado a la dirección: si esta dirección
             tiene uno guardado, se usa acá. Si el cliente ya había escrito
             algo distinto a mano, no lo pisamos. */
          var _telFav = qs("#fTelefono");
          if (_telFav && fav.telefono && !_telFav.value.trim()) _telFav.value = fav.telefono;
          renderCheckout();
        }
      }
      /* Listeners de selección */
      wrap.querySelectorAll(".dir-option[data-dirid]").forEach(function(opt){
        opt.addEventListener("click", function(){
          wrap.querySelectorAll(".dir-option").forEach(function(o){ o.classList.remove("sel"); });
          opt.classList.add("sel");
          qs("#fDireccion").value = opt.dataset.dir;
          wrap._usandoOtra = false;
          qs("#campoDireccion").style.display = "none";
          setComunaSelect(qs("#fComuna"), opt.dataset.comuna || "");
          _detectarZona(opt.dataset.comuna || "");
          var la = opt.dataset.lat !== "" ? Number(opt.dataset.lat) : null;
          var ln = opt.dataset.lng !== "" ? Number(opt.dataset.lng) : null;
          mostrarMiniMapa("ckMapa", la, ln);
          /* El teléfono va vinculado a la dirección elegida: cambiar de
             dirección cambia el teléfono a la par, tal como se guardaron
             juntos en "Mi cuenta". */
          var _telOpt = qs("#fTelefono");
          if (_telOpt) _telOpt.value = opt.dataset.telefono || "";
          renderCheckout();
        });
      });
      var btnNueva = wrap.querySelector("#dirNueva");
      if (btnNueva) btnNueva.addEventListener("click", function(){
        wrap.querySelectorAll(".dir-option").forEach(function(o){ o.classList.remove("sel"); });
        btnNueva.classList.add("sel");
        qs("#fDireccion").value = "";
        wrap._usandoOtra = true;
        setComunaSelect(qs("#fComuna"), "");
        _detectarZona("");
        var mck = document.getElementById("ckMapa"); if (mck) mck.classList.remove("show");
        /* Dirección nueva sin vínculo todavía: dejar el teléfono en blanco
           para que el cliente escriba el que corresponde a esta entrega. */
        var _telNueva = qs("#fTelefono");
        if (_telNueva) _telNueva.value = "";
        renderCheckout();
        qs("#campoDireccion").style.display = "block";
        qs("#fDireccion").focus();
      });
    }).catch(function(e){ console.warn("renderSelectorDirecciones:", e); wrap.style.display = "none"; });
}

/* ─── CHECKOUT GATE ─────────────────────────────────────────── */
let _ckModoInvitado = false; /* true cuando eligió "pedir como invitado" */

function mostrarCkGate(){
  qs("#ckGate").classList.add("show");
  qs("#ckForm").classList.remove("show");
  qs("#ckResumenBody").style.display = "none";
}
function mostrarCkForm(){
  qs("#ckGate").classList.remove("show");
  qs("#ckForm").classList.add("show");
  qs("#ckResumenBody").style.display = "";
  renderCheckout();
}

function evaluarGate(){
  /* Si está logueado → ir directo al form rellenando datos */
  if (clienteUser){
    _ckModoInvitado = false;
    /* Pre-rellenar nombre y teléfono desde el perfil */
    const n = qs("#fNombre"), t = qs("#fTelefono");
    if (n && !n.value && clienteUser.displayName) n.value = clienteUser.displayName;
    if (t && !t.value && clienteUser.phoneNumber)  t.value = clienteUser.phoneNumber;
    mostrarCkForm();
  } else if (_ckModoInvitado){
    /* Ya eligió invitado → mostrar form directamente */
    mostrarCkForm();
  } else {
    /* Desconocido → mostrar gate */
    mostrarCkGate();
  }
  actualizarCampoEmail();
}

/* 2A — email obligatorio: con cuenta Google se pre-rellena y bloquea */
function actualizarCampoEmail(){
  const em = qs("#fEmail");
  if (!em) return;
  const campo = em.closest(".ffield");
  let lock = campo ? campo.querySelector(".lock-tag") : null;
  if (clienteUser && clienteUser.email){
    em.value = clienteUser.email;
    em.readOnly = true;
    em.classList.add("bloqueado","lleno");
    if (campo && !lock){
      lock = document.createElement("span");
      lock.className = "lock-tag";
      lock.textContent = "🔒";
      campo.appendChild(lock);
    }
  } else {
    em.readOnly = false;
    em.classList.remove("bloqueado");
    if (lock) lock.remove();
  }
}

/* ════════════════════════════════════════════════════════════════
   2G — CUPONES EN CHECKOUT
   ════════════════════════════════════════════════════════════════ */
let _cuponAplicado = null;   /* { id, codigo, tipo, valor } */

function _cupMsg(txt, ok){
  const m = qs("#cupMsg");
  if (!m) return;
  m.textContent = txt || "";
  m.className = "cup-msg" + (txt ? (ok ? " ok" : " err") : "");
}

function descuentoActual(){
  if (!_cuponAplicado) return 0;
  const sub = subtotalCarrito();
  if (sub <= 0) return 0;
  const c = _cuponAplicado;
  let d = c.tipo === "porcentaje"
    ? Math.round(sub * (Number(c.valor) || 0) / 100)
    : Math.round(Number(c.valor) || 0);
  return Math.max(0, Math.min(d, sub));
}

/* Validación completa de un cupón contra estado local + Firestore.
   Devuelve { ok, cupon?, error? } */
async function validarCupon(codigo){
  codigo = String(codigo || "").trim().toUpperCase();
  if (!codigo) return { ok:false, error:"Escribe un código de cupón" };

  const cup = (state.cupones || []).find(c => String(c.codigo || "").toUpperCase() === codigo);
  if (!cup) return { ok:false, error:"El cupón no existe" };
  if (cup.activo === false) return { ok:false, error:"Este cupón ya no está disponible" };

  /* 2) Expiración */
  if (cup.vence){
    const hoy = new Date().toISOString().slice(0, 10);
    if (String(cup.vence) < hoy) return { ok:false, error:"Este cupón está expirado" };
  }

  /* Valor y tipo: soporta cupones nuevos (tipo/valor) y legacy (solo texto).
     Los cupones legacy no tienen "valor" configurado — no es una
     restricción de canje, es que faltan datos: hay que editarlos desde
     el panel y asignarles un tipo/valor real, o crear uno nuevo. */
  const tipo  = cup.tipo === "monto" ? "monto" : "porcentaje";
  const valor = Number(cup.valor);
  if (!valor || valor <= 0) return { ok:false, error:"Este cupón todavía no tiene un descuento configurado. Contacta al negocio." };

  /* 3) Límite total de usos */
  const limTotal = Number(cup.limiteTotal) || 0;
  if (limTotal > 0 && (Number(cup.usosTotales) || 0) >= limTotal)
    return { ok:false, error:"Este cupón agotó sus usos disponibles" };

  /* 5) Solo registrados / primera compra exigen cuenta */
  const exigeCuenta = cup.soloRegistrados === true || cup.primeraCompra === true;
  if (exigeCuenta && !clienteUser)
    return { ok:false, error:"Este cupón es solo para usuarios registrados. Inicia sesión con Google." };

  /* 4) No usado antes por esta cuenta + condición primera compra */
  if (clienteUser && db && !DEMO){
    try {
      const usado = await colUsuario(clienteUser.uid, "cupones_usados").doc(codigo).get();
      if (usado.exists) return { ok:false, error:"Ya usaste este cupón" };
      if (cup.primeraCompra === true){
        const prev = await colUsuario(clienteUser.uid, "pedidos").limit(1).get();
        if (!prev.empty) return { ok:false, error:"Este cupón es solo para tu primera compra" };
      }
    } catch(e){
      console.warn("validarCupon:", e);
      return { ok:false, error:"No se pudo validar el cupón. Intenta de nuevo." };
    }
  }

  return { ok:true, cupon:{ id: cup.id, codigo: codigo, tipo: tipo, valor: valor } };
}

async function aplicarCupon(){
  const inp = qs("#fCupon");
  const btn = qs("#btnAplicarCupon");
  if (!inp) return;
  if (!carrito.length){ _cupMsg("Agrega productos antes de aplicar un cupón", false); return; }
  if (btn){ btn.disabled = true; btn.textContent = "…"; }
  const r = await validarCupon(inp.value);
  if (btn){ btn.disabled = false; btn.textContent = "Aplicar"; }
  if (!r.ok){
    _cuponAplicado = null;
    _cupMsg(r.error, false);
    renderCheckout();
    return;
  }
  _cuponAplicado = r.cupon;
  const d = descuentoActual();
  _cupMsg("Cupón aplicado: −" + fmtPrecio(d), true);
  renderCheckout();
}

function quitarCupon(){
  _cuponAplicado = null;
  const inp = qs("#fCupon");
  if (inp) inp.value = "";
  _cupMsg("", true);
  renderCheckout();
}

function _pintarCuponUI(){
  const row  = qs("#cupInputRow");
  const apl  = qs("#cupAplicadoRow");
  const code = qs("#cupAplicadoCode");
  if (!row || !apl) return;
  if (_cuponAplicado){
    row.style.display = "none";
    apl.style.display = "flex";
    if (code) code.textContent = _cuponAplicado.codigo;
  } else {
    row.style.display = "flex";
    apl.style.display = "none";
  }
}

/* 2L — ¿hay una dirección de entrega válida ingresada o seleccionada? */
function _direccionLista(){
  if (tipoEntrega !== "delivery") return false;
  const dir = qs("#fDireccion");
  return !!(dir && dir.value.trim());
}

function renderCheckout(){
  const delOn = state.config.deliveryActivo !== false;
  const retOn = state.config.retiroActivo !== false;
  qs("#btnTipoDelivery").style.display = delOn ? "block" : "none";
  qs("#btnTipoRetiro").style.display   = retOn ? "block" : "none";
  if (!delOn && retOn) tipoEntrega = "retiro";
  if (delOn && !retOn) tipoEntrega = "delivery";
  qs("#btnTipoDelivery").classList.toggle("active", tipoEntrega === "delivery");
  qs("#btnTipoRetiro").classList.toggle("active", tipoEntrega === "retiro");

  /* Si el cliente está logueado y tiene direcciones → mostrar selector */
  renderSelectorDirecciones();

  qs("#campoDireccion").style.display = tipoEntrega === "delivery" ? "block" : "none";
  qs("#campoLocal").style.display     = tipoEntrega === "retiro"   ? "block" : "none";

  const sel = qs("#selLocal");
  const seleccion = sel.value;
  sel.innerHTML = state.locales.map(l => `<option value="${esc(l.id)}">${esc(l.nombre)}</option>`).join("");
  if (seleccion) sel.value = seleccion;
  sel.classList.toggle("lleno", !!sel.value);

  qs("#ckItems").innerHTML = carrito.length
    ? carrito.map(i => `${i.cantidad}× ${esc(i.nombre)} — ${fmtPrecio(i.precio * i.cantidad)}`).join("<br>")
    : "Tu carrito está vacío.";

  const sub  = subtotalCarrito();
  const desc = descuentoActual();
  const del  = costoDelivery(tipoEntrega);
  const sinCobertura = tipoEntrega === "delivery" && _tieneZonas() && _zonaActual && !_zonaActual.cobertura;

  qs("#ckSubtotal").textContent = fmtPrecio(sub);

  /* Línea de descuento por cupón (2G) */
  _pintarCuponUI();
  const lDesc = qs("#ckLineaDesc");
  if (lDesc){
    lDesc.style.display = desc > 0 ? "flex" : "none";
    const dc = qs("#ckDescCode");
    if (dc) dc.textContent = _cuponAplicado ? "(" + _cuponAplicado.codigo + ")" : "";
    const dv = qs("#ckDescuento");
    if (dv) dv.textContent = "−" + fmtPrecio(desc);
  }

  qs("#ckDelivery").textContent = sinCobertura ? "—" : fmtPrecio(del);
  qs("#ckLineaDelivery").style.display = tipoEntrega === "delivery" ? "flex" : "none";
  qs("#ckTotal").textContent = sinCobertura ? "—" : fmtPrecio(Math.max(0, sub - desc) + del);

  /* 2L — badge "Delivery gratis": SOLO si (1) hay umbral configurado > 0,
     (2) el subtotal lo alcanza y (3) ya hay dirección de entrega válida. */
  let minGratis = 0;
  if (_tieneZonas()){
    minGratis = (_zonaActual && _zonaActual.cobertura) ? (Number(_zonaActual.minGratis) || 0) : 0;
  } else {
    minGratis = Number(state.config.deliveryMinimo) || 0;
  }
  const gratis = tipoEntrega === "delivery"
    && minGratis > 0
    && sub >= minGratis
    && _direccionLista()
    && !sinCobertura;
  qs("#ckFree").classList.toggle("show", gratis);

  /* Part 4 — sin FUNCTIONS_URL o sin MercadoPago activo: solo efectivo.
     mpActivo es el flag PÚBLICO (config/general) — el token real vive en
     config/privado y nunca llega hasta acá, un comprador anónimo no
     necesita verlo para saber si la opción está disponible. */
  const mpDisponible = functionsListas() && state.config.mpActivo === true;
  const optMP = document.querySelector('.pago-opt[data-pago="mercadopago"]');
  const optEf = document.querySelector('.pago-opt[data-pago="efectivo"]');
  if (optMP) optMP.style.display = mpDisponible ? "flex" : "none";
  if (!mpDisponible && metodoPago === "mercadopago"){
    metodoPago = "efectivo";
    if (optMP) optMP.classList.remove("sel");
    if (optEf) optEf.classList.add("sel");
    const noteEf = qs("#pagoEfectivoNote"), noteMP = qs("#pagoMPNote"), btnConf = qs("#btnConfirmar");
    if (noteEf) noteEf.style.display = "block";
    if (noteMP) noteMP.style.display = "none";
    if (btnConf) btnConf.textContent = "Confirmar pedido →";
  }

  actualizarZonaBadge();
}

function marcarError(id){
  const f = qs("#" + id).closest(".ffield");
  f.classList.add("error","shake");
  setTimeout(()=> f.classList.remove("shake"), 450);
}

function validarCheckout(){
  let ok = true;
  qsa(".ffield").forEach(f => f.classList.remove("error"));
  if (!qs("#fNombre").value.trim()){ marcarError("fNombre"); ok = false; }
  if (!qs("#fTelefono").value.trim()){ marcarError("fTelefono"); ok = false; }
  /* 2A — email obligatorio para todos (invitados y registrados), con formato válido */
  var _email = qs("#fEmail") ? qs("#fEmail").value.trim() : "";
  if (!_email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(_email)){
    marcarError("fEmail");
    if (_email) toast("Revisa el formato del correo electrónico");
    ok = false;
  }
  if (tipoEntrega === "delivery" && !qs("#fDireccion").value.trim()){ marcarError("fDireccion"); ok = false; }
  /* Solo exigir comuna si hay zonas configuradas Y el campo es visible */
  var _selCom = qs("#fComuna");
  var _comunasHay = comunasDeZonas().length > 0;
  var _comunaVis  = _selCom && _selCom.closest(".ffield") && _selCom.closest(".ffield").style.display !== "none";
  if (tipoEntrega === "delivery" && _comunasHay && _comunaVis && !_selCom.value){
    marcarError("fComuna"); toast("Selecciona tu comuna"); ok = false;
  }
  if (tipoEntrega === "delivery" && _tieneZonas() && _zonaActual && !_zonaActual.cobertura){
    toast("🚫 No tenemos cobertura en tu zona. Escoge otra dirección o contáctanos.");
    marcarError("fDireccion"); ok = false;
  }
  return ok;
}

function datosCliente(){
  return {
    nombre:      qs("#fNombre").value.trim(),
    telefono:    qs("#fTelefono").value.trim(),
    email:       qs("#fEmail") ? qs("#fEmail").value.trim() : "",
    direccion:   tipoEntrega === "delivery" ? dirCompletaCheckout() : "",
    comuna:      tipoEntrega === "delivery" ? comunaSeleccionada(qs("#fComuna")) : "",
    local:       tipoEntrega === "retiro" ? (qs("#selLocal").selectedOptions[0]?.textContent || "") : "",
    referencias: qs("#fReferencias").value.trim(),
    notas:       qs("#fNotas").value.trim(),
    tipo:        tipoEntrega,
    metodoPago:  metodoPago,
    efectivo:    metodoPago === "efectivo" ? (qs("#fEfectivo").value.trim() || "") : "",
    uid:         clienteUser ? clienteUser.uid : null
  };
}

function initCheckout(){
  /* Gate buttons */
  on("btnGateGoogle", "click", function(){
    if (!auth){ toast("Conecta Firebase para iniciar sesión"); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(function(e){
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/cancelled-popup-request")){
        auth.signInWithRedirect(provider);
      } else if (e && e.code === "auth/unauthorized-domain"){
        toast("Agrega este dominio en Firebase → Authentication → Dominios autorizados");
      } else {
        toast("No se pudo iniciar sesión");
      }
    });
    /* onAuthStateChanged actualizará clienteUser y llamará evaluarGate */
  });
  on("btnGateGuest", "click", function(){
    _ckModoInvitado = true;
    mostrarCkForm();
  });

  qsa(".tipo-btn").forEach(b => b.addEventListener("click", () => {
    tipoEntrega = b.dataset.tipo;
    renderCheckout();
  }));
  qsa("#page-checkout input, #page-checkout textarea, #page-checkout select").forEach(el =>
    el.addEventListener("input", () => {
      el.closest(".ffield").classList.remove("error");
      if (el.tagName === "SELECT") el.classList.toggle("lleno", !!el.value);
    }));
  on("btnConfirmar", "click", confirmarPedido);

  /* Google Places Autocomplete en campo dirección */
  instalarAutocomplete(qs("#fDireccion"), function(r){
    setComunaSelect(qs("#fComuna"), r.comuna);
    _detectarZona(r.comuna);
    mostrarMiniMapa("ckMapa", r.lat, r.lng);
    renderCheckout();
  });
  /* La visibilidad del badge "delivery gratis" depende de la dirección (2L) */
  on("fDireccion", "input", renderCheckout);
  /* Selector de comuna: fuente de verdad de la zona */
  poblarComunas(qs("#fComuna"), "");
  on("fComuna", "change", function(){
    this.classList.toggle("lleno", !!this.value);
    _detectarZona(comunaSeleccionada(this));
    renderCheckout();
  });

  /* 2G — Cupones */
  const btnCup = qs("#btnAplicarCupon");
  if (btnCup) btnCup.addEventListener("click", aplicarCupon);
  const fCup = qs("#fCupon");
  if (fCup) fCup.addEventListener("keydown", function(e){
    if (e.key === "Enter"){ e.preventDefault(); aplicarCupon(); }
  });
  const btnQ = qs("#btnQuitarCupon");
  if (btnQ) btnQ.addEventListener("click", quitarCupon);

  /* Forma de pago */
  document.querySelectorAll(".pago-opt").forEach(function(opt){
    opt.addEventListener("click", function(){
      document.querySelectorAll(".pago-opt").forEach(function(o){ o.classList.remove("sel"); });
      opt.classList.add("sel");
      metodoPago = opt.dataset.pago;
      var noteEf = qs("#pagoEfectivoNote");
      var noteMP = qs("#pagoMPNote");
      var btnConf = qs("#btnConfirmar");
      if (metodoPago === "efectivo"){
        if(noteEf) noteEf.style.display = "block";
        if(noteMP) noteMP.style.display = "none";
        if(btnConf) btnConf.textContent = "Confirmar pedido →";
      } else {
        if(noteEf) noteEf.style.display = "none";
        if(noteMP) noteMP.style.display = "block";
        if(btnConf) btnConf.textContent = "Ir a MercadoPago →";
      }
    });
  });
}

/* MERCADOPAGO */
/* ════════════════════════════════════════════════════════════════
   MERCADOPAGO — creación de la preferencia vía Firebase Function
   ════════════════════════════════════════════════════════════════ */
/* Construye el objeto pedido completo (estructura oficial del proyecto) */
function construirPedido(pedidoId, cliente){
  const sub   = subtotalCarrito();
  const desc  = descuentoActual();
  const del   = costoDelivery(tipoEntrega);
  const ahora = new Date().toISOString();
  return {
    id: pedidoId,
    fecha: ahora,
    estado: "nuevo",
    total: Math.max(0, sub - desc) + del,
    costoDelivery: del,
    subtotal: sub,
    descuento: desc,
    cuponAplicado: _cuponAplicado ? _cuponAplicado.codigo : null,
    tipo: tipoEntrega,
    metodoPago: metodoPago,
    items: carrito.map(i => ({
      id: i.id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio,
      variantes: i.variantes || null, notaPersonal: i.notaPersonal || null
    })),
    cliente: cliente,
    uid: cliente.uid || null,
    estadoTimeline: { nuevo: ahora, preparacion: null, camino: null, listo: null }
  };
}

/* 2B — doble escritura: fuente de verdad + copia en la cuenta del cliente */
function guardarPedidoFirestore(ped){
  if (!db) return Promise.resolve();
  const principal = db.collection("tiendas").doc(STORE_ID)
    .collection("pedidos").doc(ped.id).set(ped);
  if (ped.uid){
    db.collection("usuarios").doc(ped.uid).collection("pedidos").doc(ped.id)
      .set(ped).catch(function(e){ console.warn("Copia usuario:", e); });
  }
  return principal;
}

/* 2G — registrar uso del cupón (contador global + marca por usuario).
   Usada SOLO por el fallback sin backend (ver más abajo) — con backend
   disponible, crearPedidoEfectivo.js hace esto server-side contra
   Firestore directamente (igual que webhookPago.js para MercadoPago). */
function registrarCuponUsado(ped){
  if (!ped || !ped.cuponAplicado || !db || DEMO) return;
  try {
    const cup = (state.cupones || []).find(c =>
      String(c.codigo || "").toUpperCase() === String(ped.cuponAplicado).toUpperCase());
    if (cup) col("cupones").doc(cup.id)
      .set({ usosTotales: firebase.firestore.FieldValue.increment(1) }, { merge: true })
      .catch(function(){});
    if (ped.uid) colUsuario(ped.uid, "cupones_usados").doc(String(ped.cuponAplicado).toUpperCase())
      .set({ fecha: new Date().toISOString(), pedidoId: ped.id })
      .catch(function(){});
  } catch(e){}
}

/* Acciones post-guardado — usadas SOLO por el fallback sin backend (ver
   confirmarPedido → rama "sin backend disponible" más abajo). Con
   backend disponible, crearPedidoEfectivo.js ya hizo el descuento de
   stock y el registro de cupón server-side, así que llamar a esta
   función en ese caso duplicaría ambas cosas. (Para MercadoPago, el
   equivalente de todo esto ya corre en webhookPago.js — confirmarPedido
   nunca llama a esta función en esa rama.) */
function postGuardadoPedidoSinBackend(ped){
  descontarStockLocal(ped.items);
  notificarPedidoLocal(ped);
  _dispararEmails(ped);
  registrarCuponUsado(ped);
  fetch("/.netlify/functions/notificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: STORE_ID, pedidoId: ped.id,
      cliente: ped.cliente, total: ped.total, items: ped.items
    })
  }).catch(function(e){ console.warn("Push remoto:", e); });
}

function _resetCuponPostCompra(){
  _cuponAplicado = null;
  const fc = qs("#fCupon"); if (fc) fc.value = "";
  _cupMsg("", true);
}

async function confirmarPedido(){
  if (state.config.abierto === false){ toast("🔴 La tienda está cerrada por ahora"); return; }
  if (!carrito.length){ toast("Tu carrito está vacío"); irPagina("menu"); return; }
  if (!validarCheckout()) return;

  const cliente = datosCliente();

  /* ── EFECTIVO ── */
  if (metodoPago === "efectivo" || !functionsListas()){
    if (metodoPago === "mercadopago"){
      toast("⚙️ MercadoPago aún no está configurado en esta tienda");
      return;
    }
    const pedidoIdLocal = "TB" + Date.now().toString().slice(-5);
    const ped = construirPedido(pedidoIdLocal, cliente);
    guardarUltimoPedido(ped);

    /* Con backend disponible: crearPedidoEfectivo.js recalcula precios,
       stock y cupón contra Firestore antes de escribir el pedido — mismo
       principio que crearPago.js/webhookPago.js, solo que sin pasarela
       de pago de por medio (el vendedor cobra en persona). Sin backend
       (DEMO o FUNCTIONS_URL no configurado): único caso que sigue
       escribiendo directo desde el cliente, porque no hay ninguna
       función a la que llamar — es el mismo modo degradado que ya
       existía. */
    if (functionsListas()){
      try {
        const res = await fetch(functionsURL() + "/crearPedidoEfectivo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: STORE_ID,
            pedidoId: pedidoIdLocal,
            items: ped.items.map(function(i){ return { id: i.id, cantidad: i.cantidad, variantes: i.variantes || null, notaPersonal: i.notaPersonal || null }; }),
            cliente: cliente,
            cuponAplicado: ped.cuponAplicado,
            costoDelivery: ped.costoDelivery,
            tipo: ped.tipo
          })
        });
        const j = await res.json().catch(function(){ return {}; });
        if (!res.ok || !j.ok){
          toast(j.error || ("No se pudo confirmar el pedido (HTTP " + res.status + ")"));
          return;
        }
        const pedFinal = j.pedido || ped;
        guardarUltimoPedido(pedFinal);
        carrito = []; guardarCarrito(); renderBadge(false);
        _resetCuponPostCompra();
        toast("✅ Pedido confirmado — pago en efectivo");
        irPagina("confirmacion");
        /* El backend ya validó, escribió el pedido, descontó stock y
           registró el cupón usado — descontarStock() acá es solo la
           actualización OPTIMISTA de UI (ver su comentario), para que el
           panel de inventario, si está abierto, refleje el número al
           instante en vez de esperar el roundtrip del onSnapshot. Las
           notificaciones (push local + email) sí siguen siendo
           responsabilidad del cliente porque dependen de servicios
           (Resend, Web Push) que ya se resuelven del lado del backend
           con getStoreConfig(). */
        descontarStock(pedFinal.items);
        notificarPedidoLocal(pedFinal);
        _dispararEmails(pedFinal);
        fetch("/.netlify/functions/notificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: STORE_ID, pedidoId: pedFinal.id,
            cliente: pedFinal.cliente, total: pedFinal.total, items: pedFinal.items
          })
        }).catch(function(e){ console.warn("Push remoto:", e); });
        escucharPedidoActivoBanner();
      } catch(e){
        console.error("Error confirmando pedido en efectivo:", e);
        toast("No se pudo confirmar el pedido. Intenta de nuevo.");
      }
      return;
    }

    /* Fallback sin backend (DEMO / FUNCTIONS_URL no configurado) — no hay
       validación server-side posible porque no hay ninguna función que
       la haga; se mantiene el comportamiento original. */
    carrito = []; guardarCarrito(); renderBadge(false);
    _resetCuponPostCompra();
    toast("✅ Pedido confirmado — pago en efectivo");
    irPagina("confirmacion");
    if (db){
      guardarPedidoFirestore(ped)
        .then(function(){ postGuardadoPedidoSinBackend(ped); escucharPedidoActivoBanner(); })
        .catch(function(e){ console.warn("Pedido no guardado en Firestore:", e); });
    }
    return;
  }

  /* ── MERCADOPAGO (vía Firebase Function /crearPago) ──
     El backend recalcula precios, stock y cupón contra Firestore — acá
     solo se manda QUÉ se quiere comprar (ids, cantidades, código de
     cupón), nunca los montos: crearPago.js los ignoraría de todas
     formas. El pedido en sí nunca lo crea el cliente — nace en
     webhookPago.js recién cuando MercadoPago confirma el pago. */
  const btn = qs("#btnConfirmar");
  btn.disabled = true; btn.textContent = "Conectando con MercadoPago…";
  try {
    const pedidoId = "TB" + Date.now().toString().slice(-5);
    const ped = construirPedido(pedidoId, cliente);
    guardarUltimoPedido(ped);
    const res = await fetch(functionsURL() + "/crearPago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: STORE_ID,
        pedidoId: pedidoId,
        items: ped.items.map(function(i){ return { id: i.id, cantidad: i.cantidad }; }),
        cliente: cliente,
        cuponAplicado: ped.cuponAplicado,
        costoDelivery: ped.costoDelivery,
        tipo: ped.tipo
      })
    });
    const j = await res.json().catch(function(){ return {}; });
    if (!res.ok || !j.ok){
      /* El backend valida stock/catálogo/cupón antes de generar la
         preferencia — si algo cambió entre que se armó el carrito y se
         confirmó (producto agotado, cupón vencido justo ahora), acá
         llega el motivo real en vez de un error genérico de red. */
      toast(j.error || ("No se pudo iniciar el pago (HTTP " + res.status + ")"));
      btn.disabled = false; btn.textContent = "Ir a MercadoPago →";
      return;
    }
    if (j.pedidoId && j.pedidoId !== ped.id){ ped.id = j.pedidoId; guardarUltimoPedido(ped); }
    window.location.href = j.init_point;
  } catch(e){
    console.error("Error creando pago:", e);
    toast("No se pudo iniciar el pago. Intenta de nuevo.");
    btn.disabled = false; btn.textContent = "Ir a MercadoPago →";
  }
}

async function notificarPedidoLocal(pedido){
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator)) return;
    const reg = swRegistration || await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const resumen = (pedido.items || []).map(function(i){ return i.cantidad + "x " + i.nombre; }).join(", ");
    /* 2C — la notificación abre la página real de gestión de pedidos */
    const urlGestion = location.origin + "/pedidos.html";
    reg.showNotification("🛍️ ¡Nuevo pedido! " + fmtPrecio(pedido.total), {
      body: ((pedido.cliente && pedido.cliente.nombre) || "Cliente") + " — " + resumen,
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: "nuevo-pedido",
      data: { url: urlGestion }
    });
  } catch(e){ console.warn("notificarPedidoLocal:", e); }
}

/* Parte 3 — Emails transaccionales vía Firebase Function /enviarEmails (Resend).
   Usada SOLO por el flujo de efectivo (postGuardadoPedidoSinBackend) —
   para MercadoPago, webhookPago.js ya dispara los emails server-side.
   Ya no se decide acá si "hay Resend configurado": ese chequeo vivía en
   cfg.resendApiKey, que ahora está en config/privado y un comprador
   anónimo nunca lo tiene cargado (ni debería). Se llama siempre que el
   backend esté disponible, y es enviarEmails.js quien internamente
   responde { skipped: true } si falta configuración. */
function _dispararEmails(ped){
  try {
    if (!functionsListas()) return;
    fetch(functionsURL() + "/enviarEmails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: STORE_ID,
        pedido: ped,
        nombreTienda: (state.config || {}).nombre || "TEST BURGERS",
        urlTienda: location.origin
      })
    }).catch(function(e){ console.warn("Email no enviado:", e); });
  } catch(e){}
}

function guardarUltimoPedido(ped){
  lsSet("tb_ultimo_pedido", JSON.stringify(ped));
}

/* Al volver de MercadoPago: ?status=approved&pedido_id=XXX
   IMPORTANTE: el parámetro "status=approved" en la URL NO es prueba de que
   el pago se realizó — es solo la página de "éxito visual" a la que
   MercadoPago redirige tras el checkout, y un usuario podría llegar a esa
   URL (o volver a abrirla, o escribirla a mano) sin haber pagado nada.
   La única fuente de verdad es el webhook (webhookPago.js), que consulta
   la API real de MercadoPago antes de marcar el pedido como "nuevo".
   Acá solo mostramos la pantalla de confirmación en modo "verificando" y
   dejamos que el listener en tiempo real (escucharEstadoPedido) refleje
   el cambio apenas el webhook confirme el pago del lado del servidor. */
function detectarRetornoPago(){
  const params = new URLSearchParams(location.search);
  const status = params.get("status");
  if (!status) return;
  history.replaceState(null, "", location.pathname + location.hash);
  if (status === "approved"){
    const pid = params.get("pedido_id");
    let ped = ultimoPedido() || {};
    if (pid) ped.id = pid;
    /* El pedido probablemente NO existe todavía en Firestore en este
       momento exacto — el webhook de MercadoPago puede tardar unos
       segundos más que el propio redirect del navegador. Se marca acá
       como "esperando" solo para que renderConfirmacion() sepa mostrar
       el estado "verificando…" en vez de un error de "pedido no
       encontrado". escucharEstadoPedido() reacciona apenas el
       documento aparezca en Firestore, sin necesidad de refrescar. */
    ped.estado = "esperando";
    lsSet("tb_ultimo_pedido", JSON.stringify(ped));
    carrito = []; guardarCarrito(); renderBadge(false);
    _resetCuponPostCompra();
    irPagina("confirmacion");
    /* El listener de escucharEstadoPedido() (llamado desde renderConfirmacion)
       y el de escucharPedidoActivoBanner() ya escuchan Firestore en tiempo
       real, así que la UI se actualiza sola apenas el webhook confirme. */
    escucharPedidoActivoBanner();
  } else if (status === "pending"){
    toast("🕐 Tu pago quedó pendiente de confirmación");
    irPagina("inicio");
  } else {
    toast("El pago no se completó. Puedes intentarlo de nuevo.");
    irPagina("checkout");
  }
}

/* ════════════════════════════════════════════════════════════════
   CONFIRMACION
   ════════════════════════════════════════════════════════════════ */
function ultimoPedido(){
  try { return JSON.parse(lsGet("tb_ultimo_pedido") || "null"); } catch(e){ return null; }
}

let _unsubPedidoCliente = null;
let _timeoutVerificacionPago = null;

function actualizarTimeline(estado){
  const cont = qs("#confTimeline");
  if (!cont) return;
  if (estado === "esperando" || estado === "pendiente_pago"){
    const sub = qs("#confSub");
    if (sub) sub.textContent = "⏳ Verificando tu pago con MercadoPago…";
    return;
  }
  const est = normEstado(estado);
  const pasos = { nuevo:1, preparacion:2, camino:3, listo:4, cancelado:0 };
  const paso = (est in pasos) ? pasos[est] : 1;
  const steps = cont.querySelectorAll(".tl-step");
  steps.forEach(function(s, i){
    s.classList.remove("ok");
    if (i + 1 <= paso) s.classList.add("ok");
  });
  const textos = { nuevo:"Pedido recibido ✅", preparacion:"Preparando tu pedido 👨‍🍳",
    camino:"Tu pedido va en camino 🛵", listo:"¡Entregado! Buen provecho 🎉",
    cancelado:"Pedido cancelado ❌" };
  const sub = qs("#confSub");
  if (sub && textos[est]) sub.textContent = textos[est];
}

/* ════════════════════════════════════════════════════════════════
   2D — BANNER DE PEDIDO EN CURSO + MODAL DE SEGUIMIENTO (cliente)
   Funciona igual con cuenta o como invitado: se escucha en tiempo real
   el doc tiendas/{STORE_ID}/pedidos/{id} usando el pedidoId guardado
   localmente (tb_ultimo_pedido).
   ════════════════════════════════════════════════════════════════ */
let _unsubPedidoActivo = null;
let _pedidoActivo = null;
let _cliPedAbierto = false;

function escucharPedidoActivoBanner(){
  if (_unsubPedidoActivo){ _unsubPedidoActivo(); _unsubPedidoActivo = null; }
  _pedidoActivo = null;
  const ult = ultimoPedido();
  if (!db || !ult || !ult.id){ renderBannerPedidoActivo(); return; }
  _unsubPedidoActivo = db.collection("tiendas").doc(STORE_ID)
    .collection("pedidos").doc(ult.id)
    .onSnapshot(function(doc){
      _pedidoActivo = doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
      renderBannerPedidoActivo();
      if (_cliPedAbierto && _pedidoActivo) pintarCliPedModal(_pedidoActivo);
    }, function(e){ console.warn("pedidoActivo:", e); });
}

function renderBannerPedidoActivo(){
  const w = qs("#bannerPedidoActivo");
  if (!w) return;
  const p = _pedidoActivo;
  const est = p ? normEstado(p.estado) : null;
  const activo = p && est !== "listo" && est !== "cancelado" && p.estado !== "pendiente_pago" && p.estado !== "esperando";
  if (!activo){ w.style.display = "none"; w.innerHTML = ""; return; }
  const ICO = { nuevo:"🧾", preparacion:"👨‍🍳", camino:"🛵" };
  const TIT = { nuevo:"Recibimos tu pedido", preparacion:"Estamos preparando tu pedido", camino:"Tu pedido está en camino" };
  w.style.display = "block";
  w.innerHTML =
    '<div class="ped-activo e-' + esc(est) + '" id="btnPedActivo" role="button" tabindex="0">' +
      '<span class="pa-ico">' + (ICO[est] || "🧾") + '</span>' +
      '<div class="pa-txt">' +
        '<p class="pa-titulo">' + (TIT[est] || "Pedido en curso") + '</p>' +
        '<p class="pa-sub">#' + esc(p.id) + ' · Ver estado →</p>' +
      '</div>' +
      '<span class="pa-flecha">›</span>' +
    '</div>';
}

function _horaCorta(iso){
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit" }); }
  catch(e){ return ""; }
}

function pintarCliPedModal(p){
  if (!p) return;
  const est = normEstado(p.estado);
  const elId = qs("#cliPedId");     if (elId) elId.textContent = "#" + p.id;
  const elF  = qs("#cliPedFecha");  if (elF)  elF.textContent  = p.fecha ? fmtFechaCorta(p.fecha) : "";
  const elB  = qs("#cliPedBadge");  if (elB)  elB.innerHTML    = badgeEstadoCliente(est);
  const res  = qs("#cliPedResumen");
  if (res){
    const lineas = (p.items || []).map(function(i){
      return '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:4px">' +
        '<span>' + i.cantidad + '× ' + esc(i.nombre) + '</span><span>' + fmtPrecio(i.precio * i.cantidad) + '</span></div>';
    }).join("");
    const desc = Number(p.descuento) || 0;
    const filas =
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);font-weight:600;margin-top:8px"><span>Subtotal</span><span>' + fmtPrecio(p.subtotal != null ? p.subtotal : p.total) + '</span></div>' +
      (desc > 0 ? '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--verde);font-weight:700"><span>Descuento' + (p.cuponAplicado ? " (" + esc(p.cuponAplicado) + ")" : "") + '</span><span>−' + fmtPrecio(desc) + '</span></div>' : "") +
      (p.tipo === "delivery" ? '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);font-weight:600"><span>Delivery</span><span>' + fmtPrecio(p.costoDelivery || 0) + '</span></div>' : "") +
      '<div style="display:flex;justify-content:space-between;font-size:14.5px;font-weight:900;margin-top:6px;padding-top:8px;border-top:1px dashed var(--borde)"><span>Total</span><span>' + fmtPrecio(p.total) + '</span></div>' +
      '<div style="font-size:12px;color:var(--muted);font-weight:600;margin-top:8px">' +
        (p.metodoPago === "mercadopago" ? "💳 MercadoPago" : "💵 Efectivo") + " · " +
        (p.tipo === "retiro" ? "Retiro en " + esc((p.cliente && p.cliente.local) || "local")
                             : "Delivery a " + esc((p.cliente && p.cliente.direccion) || "")) +
      '</div>';
    res.innerHTML = lineas + filas;
  }
  const tl = qs("#cliPedTimeline");
  if (tl){
    const tls = p.estadoTimeline || {};
    const pasos = [
      { k:"nuevo",       n:"Pedido recibido",  i:"✓" },
      { k:"preparacion", n:"En preparación",   i:"👨‍🍳" },
      { k:"camino",      n:"En camino",        i:"🛵" },
      { k:"listo",       n:"Entregado",        i:"🏠" }
    ];
    const orden = { nuevo:1, preparacion:2, camino:3, listo:4 };
    const actual = orden[est] || 1;
    tl.innerHTML = est === "cancelado"
      ? '<p style="color:#C62828;font-weight:800;font-size:13.5px;margin:0">❌ Este pedido fue cancelado.</p>'
      : '<div class="cli-tl">' + pasos.map(function(s, i){
          const ok = (i + 1) <= actual;
          const hora = _horaCorta(tls[s.k]);
          return '<div class="cli-tl-step' + (ok ? " ok" : "") + '">' +
            '<span class="cli-tl-dot">' + (ok ? "✓" : (i + 1)) + '</span>' +
            '<div class="cli-tl-info">' +
              '<p class="cli-tl-nombre">' + s.n + '</p>' +
              (hora ? '<p class="cli-tl-hora">' + hora + '</p>' : "") +
            '</div></div>';
        }).join("") + '</div>';
  }
}

function initCliPedModal(){
  const modal = qs("#cliPedModal");
  if (!modal) return;
  document.addEventListener("click", function(e){
    if (e.target.closest("#btnPedActivo") && _pedidoActivo){
      _cliPedAbierto = true;
      pintarCliPedModal(_pedidoActivo);
      modal.classList.add("open");
    }
  });
  modal.addEventListener("click", function(e){
    if (e.target === modal){ modal.classList.remove("open"); _cliPedAbierto = false; }
  });
  const c = qs("#cliPedClose");
  if (c) c.addEventListener("click", function(){ modal.classList.remove("open"); _cliPedAbierto = false; });
}

function escucharEstadoPedido(pedidoId){
  if (_unsubPedidoCliente){ _unsubPedidoCliente(); _unsubPedidoCliente = null; }
  if (_timeoutVerificacionPago){ clearTimeout(_timeoutVerificacionPago); _timeoutVerificacionPago = null; }
  if (!db || !pedidoId) return;
  _unsubPedidoCliente = db.collection("tiendas").doc(STORE_ID)
    .collection("pedidos").doc(pedidoId)
    .onSnapshot(function(doc){
      if (!doc.exists) return;
      const estado = doc.data().estado || "nuevo";
      actualizarEncabezadoConfirmacion(estado);
      actualizarTimeline(estado);
      if (estado !== "pendiente_pago" && estado !== "esperando" && _timeoutVerificacionPago){
        clearTimeout(_timeoutVerificacionPago);
        _timeoutVerificacionPago = null;
      }
    }, function(e){ console.warn("escucharEstadoPedido:", e); });
  /* Si tras un rato razonable el pago sigue sin confirmarse, es probable
     que algo falló del lado del webhook — avisar al cliente en vez de
     dejarlo mirando "verificando…" indefinidamente. */
  _timeoutVerificacionPago = setTimeout(function(){
    const sub = qs("#confSub");
    if (sub && sub.textContent.indexOf("Verificando") !== -1){
      sub.innerHTML = "⏳ Esto está tardando más de lo normal. Si ya pagaste, escríbenos y te confirmamos manualmente.";
    }
  }, 20000);
}

function renderConfirmacion(){
  const ped = ultimoPedido();
  const check = qs("#confCheck");
  check.style.animation = "none"; void check.offsetWidth; check.style.animation = "";
  if (!ped){
    qs("#confNum").textContent = "";
    qs("#confResumen").innerHTML = '<p class="vacio">No hay pedidos recientes.</p>';
    return;
  }
  qs("#confNum").textContent = "#" + ped.id;
  const lineas = (ped.items || []).map(i =>
    `<div class="linea"><span>${i.cantidad}× ${esc(i.nombre)}</span><span>${fmtPrecio(i.precio * i.cantidad)}</span></div>`).join("");
  const entrega = ped.tipo === "retiro"
    ? `<div class="linea"><span>Retiro en</span><span>${esc(ped.cliente?.local || "local")}</span></div>`
    : `<div class="linea"><span>Delivery a</span><span style="text-align:right;max-width:60%">${esc(ped.cliente?.direccion || "")}</span></div>`;
  const labelTotal = (ped.estado === "esperando" || ped.estado === "pendiente_pago") ? "Total a pagar" : "Total pagado";
  qs("#confResumen").innerHTML = lineas + entrega +
    `<div class="linea total"><span>${labelTotal}</span><span>${fmtPrecio(ped.total)}</span></div>`;
  /* El título y el ícono grande no deben decir "confirmado" mientras el
     pago todavía no fue verificado por el webhook — eso era lo que
     mostraba "¡Pago confirmado!" incluso antes de que MercadoPago avisara
     realmente que el cobro se realizó. */
  actualizarEncabezadoConfirmacion(ped.estado);
  actualizarTimeline(ped.estado || "nuevo");
  escucharEstadoPedido(ped.id);
}

function actualizarEncabezadoConfirmacion(estado){
  const tit = qs("#confTitulo");
  const chk = qs("#confCheck");
  if (!tit || !chk) return;
  if (estado === "esperando" || estado === "pendiente_pago"){
    tit.textContent = "Verificando tu pago…";
    chk.textContent = "⏳";
    chk.classList.add("pendiente");
  } else {
    tit.textContent = state.config.confTitulo || "¡Pago confirmado!";
    chk.textContent = "✓";
    chk.classList.remove("pendiente");
  }
}

/* WHATSAPP */
/* ════════════════════════════════════════════════════════════════
   WHATSAPP — mensajes automáticos y seguimiento
   ════════════════════════════════════════════════════════════════ */
function buildMensaje(template, datos){
  return String(template || "")
    .replace(/{nombre_cliente}/g, datos.nombre)
    .replace(/{numero_pedido}/g, datos.id)
    .replace(/{pedido}/g, datos.items)
    .replace(/{total}/g, datos.total)
    .replace(/{negocio}/g, datos.negocio)
    .replace(/{tiempo_estimado}/g, datos.tiempo);
}

function datosMensaje(ped){
  return {
    nombre:  ped?.cliente?.nombre || "cliente",
    id:      ped?.id || "TB00000",
    items:   (ped?.items || []).map(i => i.cantidad + "x " + i.nombre).join("\n") || "—",
    total:   fmtPrecio(ped?.total || 0),
    negocio: state.config.nombre || "TEST BURGERS",
    tiempo:  state.config.tiempoEntrega || "30-45 min"
  };
}

function initWhatsApp(){
  on("btnWhats", "click", () => {
    const num = String(state.config.whatsapp || "").replace(/\D/g, "");
    if (!num || state.config.whatsapp === "CONFIGURAR_WHATSAPP"){
      toast("El negocio aún no configuró su WhatsApp");
      return;
    }
    const msj = buildMensaje(state.config.msjConfirmacion || MENSAJES_DEFAULT.confirmacion, datosMensaje(ultimoPedido()));
    window.open("https://wa.me/" + num + "?text=" + encodeURIComponent(msj), "_blank", "noopener");
  });
}

/* ════════════════════════════════════════════════════════════════
   CUPONES
   ════════════════════════════════════════════════════════════════ */
function renderCupones(){
  const wrap = qs("#cuponesList");
  const items = state.cupones.slice().sort((a,b)=> String(a.vence||"").localeCompare(String(b.vence||"")));
  wrap.innerHTML = items.length ? items.map(c => `
    <div class="card cupon-card lift">
      <div class="cup-top">
        <span class="cup-cod" data-ecol="cupones" data-edoc="${esc(c.id)}" data-efield="codigo" data-etype="text">${esc(c.codigo)}</span>
        <span class="cup-desc-grande" data-ecol="cupones" data-edoc="${esc(c.id)}" data-efield="descuento" data-etype="text">${esc(c.descuento)}</span>
      </div>
      <p class="cup-detalle" data-ecol="cupones" data-edoc="${esc(c.id)}" data-efield="descripcion" data-etype="text">${esc(c.descripcion || "")}</p>
      <p class="cup-vence">Vence el ${esc(fFecha(c.vence))}</p>
      <button class="pill pill-outline pill-sm btn-copiar" data-cod="${esc(c.codigo)}">Copiar código</button>
    </div>`).join("") : '<p class="vacio">No hay cupones activos en este momento.</p>';
}

function initCupones(){
  on("cuponesList", "click", async e => {
    const b = e.target.closest(".btn-copiar");
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.dataset.cod);
    } catch(err){
      const ta = document.createElement("textarea");
      ta.value = b.dataset.cod; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); ta.remove();
    }
    const original = b.textContent;
    b.textContent = "¡Copiado! ✓";
    b.classList.add("copiado");
    setTimeout(() => { b.textContent = original; b.classList.remove("copiado"); }, 2000);
  });
}

/* ════════════════════════════════════════════════════════════════
   LOCALES
   ════════════════════════════════════════════════════════════════ */
function renderLocales(){
  const wrap = qs("#localesList");
  wrap.innerHTML = state.locales.length ? state.locales.map(l => `
    <div class="card local-card lift">
      <div class="local-img" data-ecol="locales" data-edoc="${esc(l.id)}" data-efield="imagen" data-etype="img">
        <img src="${esc(l.imagen || "")}" alt="${esc(l.nombre)}" loading="lazy">
      </div>
      <div class="local-body">
        <p class="local-nombre" data-ecol="locales" data-edoc="${esc(l.id)}" data-efield="nombre" data-etype="text">${esc(l.nombre)}</p>
        <p class="local-dir" data-ecol="locales" data-edoc="${esc(l.id)}" data-efield="direccion" data-etype="text">${esc(l.direccion)}</p>
        <div class="local-meta">
          <span class="${l.abierto === false ? "estado-cerrado" : "estado-abierto"}">${l.abierto === false ? "🔴 Cerrado" : "🟢 Abierto"}</span>
          <span class="local-horario" data-ecol="locales" data-edoc="${esc(l.id)}" data-efield="horario" data-etype="text">${esc(l.horario)}</span>
        </div>
        <a class="pill pill-outline pill-sm" style="display:inline-block;text-decoration:none"
           href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.direccion || "")}"
           target="_blank" rel="noopener">Cómo llegar →</a>
      </div>
    </div>`).join("") : '<p class="vacio">No hay locales configurados todavía.</p>';
}

/* ════════════════════════════════════════════════════════════════
   DEVMODE — activación con Firebase Authentication + edición inline
   ════════════════════════════════════════════════════════════════ */

/* Consulta usuarios/{uid} en Firestore y actualiza esPropietario.
   Esto es solo para la UI (mostrar/ocultar, evitar clics innecesarios)
   — la protección real está en las reglas de Firestore, que exigen el
   mismo rol del lado del servidor antes de aceptar la escritura. Si
   alguien manipulara esta variable desde la consola del navegador,
   igual no podría escribir en cupones/precios/movimientos, porque
   Firestore rechaza la operación sin el rol correcto en su propio
   documento de usuario. */
/* Rol asignado a esta cuenta PARA ESTA TIENDA (roles[STORE_ID]) —
   null si no tiene ninguno. Es la fuente única de verdad para dos
   decisiones distintas: si esPropietario (cupones/precio/caja, más
   arriba) y si la cuenta puede entrar al devmode básico en absoluto
   (ver tieneAccesoDevmode más abajo) — antes, el devmode básico no
   comprobaba nada de esto: cualquier cuenta válida del proyecto
   Firebase compartido entraba al devmode de CUALQUIER dominio, sin
   importar si tenía algún rol asignado para esa tienda específica. */
let rolDeEstaCuenta = null;
async function resolverRolPropietario(uid){
  if (DEMO){ esPropietario = true; rolDeEstaCuenta = "propietario"; return; }
  try {
    const doc = await db.collection("usuarios").doc(uid).get();
    /* El rol es por tienda, no global — así, cuando el mismo Firebase
       hospeda tiendas de varios dueños distintos (modelo DerLabs:
       cada cliente compra una tienda que corre sobre este Firebase
       compartido), el propietario de una tienda no es automáticamente
       propietario de las demás. roles es un mapa { storeId: rol }. */
    const roles = doc.exists ? (doc.data().roles || {}) : {};
    rolDeEstaCuenta = roles[STORE_ID] || null;
    esPropietario = rolDeEstaCuenta === "propietario";
  } catch(e){
    console.warn("No se pudo resolver el rol:", e);
    rolDeEstaCuenta = null;
    esPropietario = false;
  }
}
/* true si esta cuenta tiene CUALQUIER rol asignado para STORE_ID (no
   solo "propietario" — hoy es el único valor que existe, pero esto
   queda listo para cuando se agregue un rol intermedio tipo
   "operador" sin volver a tocar este punto). Sin esto, cualquier
   cuenta válida del Firebase compartido podía entrar al devmode
   básico (fotos, stock, catálogo, config/privado — incluyendo el
   Access Token de MercadoPago) de CUALQUIER tienda, no solo la suya. */
function tieneAccesoDevmode(){
  return !!rolDeEstaCuenta;
}

/* ── Aceptación de contrato/términos de servicio ──
   Se muestra una vez por cuenta, tras un login válido, antes de dejar
   entrar al devmode. Sube CONTRATO_VERSION cuando el texto legal
   cambie — cualquier cuenta que haya aceptado una versión anterior
   vuelve a ver el modal hasta aceptar la nueva. El texto en sí vive en
   el HTML (#contratoTexto) — reemplazar el placeholder por el
   contrato real antes de usar esto con un cliente real; esto solo
   resuelve el mecanismo (bloquear, registrar quién/cuándo/qué
   versión), no reemplaza la revisión legal del contenido. */
const CONTRATO_VERSION = 1;
async function yaAceptoContrato(uid){
  try {
    const doc = await db.doc("tiendas/" + STORE_ID + "/contratos/" + uid).get();
    return doc.exists && doc.data().version === CONTRATO_VERSION;
  } catch(e){
    console.warn("No se pudo verificar el contrato:", e);
    return false; // ante la duda, mostrar el modal — mejor pedir de más que dejar pasar sin registro
  }
}
function registrarAceptacionContrato(uid, email){
  return db.doc("tiendas/" + STORE_ID + "/contratos/" + uid).set({
    version: CONTRATO_VERSION,
    email: email || null,
    aceptadoEn: new Date().toISOString(),
    userAgent: navigator.userAgent || null // registro adicional, útil como evidencia de que se mostró en un navegador real
  });
}
/* Muestra el modal y devuelve una Promise que se resuelve true/false
   según lo que elija — así intentarLogin() puede "esperar" la
   decisión antes de seguir, igual que espera cualquier otra
   operación async. */
function pedirAceptacionContrato(){
  return new Promise((resolve) => {
    const modal = qs("#contratoModal");
    const check = qs("#contratoCheck");
    const btn   = qs("#contratoBtn");
    check.checked = false;
    btn.disabled = true;
    modal.classList.add("open");
    const onCheck = () => { btn.disabled = !check.checked; };
    const onAceptar = () => {
      modal.classList.remove("open");
      check.removeEventListener("change", onCheck);
      btn.removeEventListener("click", onAceptar);
      resolve(true);
    };
    check.addEventListener("change", onCheck);
    btn.addEventListener("click", onAceptar);
  });
}

/* ── Verificación de propietario para acciones sensibles ──
   Pide las credenciales de la cuenta de propietario SIN cerrar la
   sesión operador activa (usa authPin, una instancia separada de
   Firebase Auth). Devuelve una Promise<boolean>.

   Esto es solo la capa de UI — la protección real está en las reglas
   de Firestore (rol == "propietario" del lado del servidor). Aunque
   alguien saltee este modal manipulando el JS desde la consola del
   navegador, Firestore va a rechazar igual la escritura si la cuenta
   autenticada no tiene el rol correcto en su propio documento.

   Uso: if (!(await pedirVerificacionPropietario("crear cupones"))) return; */
let _pinResolve = null;
function pedirVerificacionPropietario(motivo){
  if (DEMO) return Promise.resolve(true); // sin Firebase real, no aplica
  if (esPropietario) return Promise.resolve(true); // ya está verificado en esta sesión

  return new Promise(function(resolve){
    _pinResolve = resolve;
    qs("#pinMotivo").textContent = motivo
      ? ("Esta acción (" + motivo + ") requiere la cuenta de propietario.")
      : "Esta acción requiere la cuenta de propietario.";
    qs("#pinEmail").value = "";
    qs("#pinPass").value = "";
    qs("#pinErr").classList.remove("show");
    qs("#pinModal").classList.add("open");
    setTimeout(function(){ qs("#pinEmail").focus(); }, 60);
  });
}
async function _intentarVerificacionPin(){
  const email = qs("#pinEmail").value.trim();
  const pass  = qs("#pinPass").value;
  const err   = qs("#pinErr");
  err.classList.remove("show");
  if (!email || !pass){ err.textContent = "Completa email y contraseña"; err.classList.add("show"); return; }

  try {
    const cred = await authPin.signInWithEmailAndPassword(email, pass);
    const doc = await db.collection("usuarios").doc(cred.user.uid).get();
    const roles = doc.exists ? (doc.data().roles || {}) : {};
    const rolOk = roles[STORE_ID] === "propietario";
    await authPin.signOut(); // cerrar la app secundaria de inmediato, ya cumplió su propósito
    if (!rolOk){
      err.textContent = "Esta cuenta no tiene permiso de propietario";
      err.classList.add("show");
      return;
    }
    /* Verificación exitosa para ESTA acción puntual — no se guarda
       como sesión permanente. Cada acción sensible vuelve a pedir la
       verificación, tal como se definió: "cada vez que se necesite
       hacer movimientos importantes que afectan precios o descuentos". */
    qs("#pinModal").classList.remove("open");
    if (_pinResolve) { _pinResolve(true); _pinResolve = null; }
  } catch(e){
    console.warn("Verificación de propietario fallida:", e.code || e);
    err.textContent = "Credenciales incorrectas";
    err.classList.add("show");
  }
}
function _cancelarVerificacionPin(){
  qs("#pinModal").classList.remove("open");
  if (_pinResolve) { _pinResolve(false); _pinResolve = null; }
}

function activarDevmode(irAPedidos){
  document.body.classList.add("dev-on");
  lsSet("tb_dev_session","1");
  /* Por si el login ocurrió DESPUÉS de que cargarFirebase() ya corrió sin
     sesión (visita nueva, primer login) — cargarConfigPrivada() no repite
     el trabajo si ya se había cargado antes (ver _privadoCargado). */
  cargarConfigPrivada();
  if (irAPedidos){
    /* Navegar a pestaña Pedidos del panel */
    setTimeout(function(){
      const btn = document.querySelector('.ptab[data-pt="pedidos"]');
      if (btn) btn.click();
      const panel = document.getElementById("panelEl") || document.querySelector(".panel");
      if (panel) panel.classList.add("open");
    }, 100);
  }
  document.body.classList.remove("preview-cliente");
  qs("#loginModal").classList.remove("open");
  toast("⚙ Modo desarrollador activado");
}
function salirDev(){
  if (!DEMO && auth){ auth.signOut().catch(()=>{}); }
  document.body.classList.remove("dev-on","preview-cliente");
  qs("#adminPanel").classList.remove("open");
  lsDel("tb_dev_session");
  /* Limpiar de memoria lo que solo el dueño autenticado debería ver —
     por si el dispositivo/navegador se comparte con alguien más. */
  state.configPrivado = Object.assign({}, DEMO_DATA.configPrivado);
  state.dispositivos = [];
  _privadoCargado = false;
  toast("Saliste del modo desarrollador");
}
function abrirLogin(){
  qs("#loginEmail").value = ""; qs("#loginPass").value = "";
  qs("#loginErr").classList.remove("show");
  qs("#loginDemoNote").style.display = DEMO ? "block" : "none";
  qs("#loginModal").classList.add("open");
  setTimeout(()=> qs("#loginEmail").focus(), 60);
}
async function intentarLogin(){
  const email = qs("#loginEmail").value.trim();
  const pass  = qs("#loginPass").value;
  const err   = qs("#loginErr");
  err.classList.remove("show");
  if (DEMO){
    /* Sin Firebase configurado no hay Authentication: cualquier credencial no vacía entra. */
    if (!email || !pass){ err.textContent = "Completa email y contraseña"; err.classList.add("show"); return; }
    activarDevmode();
    return;
  }
  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    /* Verificar que esta cuenta tenga algún rol asignado para ESTA
       tienda antes de abrir el devmode — sin esto, cualquier cuenta
       válida del Firebase compartido (la de otro cliente, por
       ejemplo) podía entrar al panel de administración de cualquier
       dominio con solo conocer email/contraseña de otra tienda. */
    await resolverRolPropietario(cred.user.uid);
    if (!tieneAccesoDevmode()){
      await auth.signOut(); // no dejar una sesión válida "colgada" sin autorización para esta tienda
      err.textContent = "Esta cuenta no tiene acceso a esta tienda";
      err.classList.add("show");
      return;
    }
    if (!(await yaAceptoContrato(cred.user.uid))){
      await pedirAceptacionContrato();
      await registrarAceptacionContrato(cred.user.uid, cred.user.email);
    }
    activarDevmode();
  } catch(e){
    console.warn("Login fallido:", e.code || e);
    err.textContent = "Credenciales incorrectas";
    err.classList.add("show");
  }
}

function valorActual(colName, docId, field){
  if (colName === "config" && docId === "general") return state.config[field];
  if (colName === "config" && docId === "privado") return state.configPrivado[field];
  const it = (state[colName] || []).find(x => x.id === docId);
  return it ? it[field] : "";
}

async function guardarInline(colName, docId, field, valor){
  if (_modoBorrador && !DEMO){
    const oldValue = valorActual(colName, docId, field);
    applyLocal(colName, docId, field, valor);
    _pushChange(colName, docId, field, valor, oldValue);
    return true;
  }
  applyLocal(colName, docId, field, valor);
  if (DEMO) return true;
  try {
    await col(colName).doc(docId).set({ [field]: valor }, { merge:true });
    return true;
  } catch(e){
    console.error("Error al guardar:", e);
    toast("Error al guardar — revisa las reglas de Firestore");
    return false;
  }
}

function iniciarEdicion(el){
  const tipo = el.dataset.etype;
  if (tipo === "precio" && !esPropietario && !DEMO){
    pedirVerificacionPropietario("cambiar el precio de un producto").then(function(ok){
      if (ok) iniciarEdicion(el); // reintenta ya verificado
    });
    return;
  }
  editing = true;
  const val = valorActual(el.dataset.ecol, el.dataset.edoc, el.dataset.efield);
  el.dataset.original = tipo === "precio" ? String(Number(val) || 0) : String(val == null ? el.textContent : val);
  el.textContent = el.dataset.original;
  el.contentEditable = "true";
  el.classList.add("editing");
  el.focus();
  try {
    const r = document.createRange(); r.selectNodeContents(el);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  } catch(e){}

  const onKey = ev => {
    if (ev.key === "Enter"){ ev.preventDefault(); el.blur(); }
    else if (ev.key === "Escape"){ ev.preventDefault(); limpiar(); cancelar(); }
  };
  const onBlur = () => { limpiar(); finalizar(); };
  function limpiar(){ el.removeEventListener("keydown", onKey); el.removeEventListener("blur", onBlur); }
  function cancelar(){
    el.contentEditable = "false";
    el.classList.remove("editing");
    editing = false; pendingRender = false;
    renderAll();
  }
  async function finalizar(){
    el.contentEditable = "false";
    const texto = el.textContent.trim();
    const original = el.dataset.original;
    editing = false;
    if (texto === original){ el.classList.remove("editing"); pendingRender = false; renderAll(); return; }
    let valor = texto;
    if (tipo === "precio") valor = parseInt(texto.replace(/[^\d]/g, ""), 10) || 0;
    const ok = await guardarInline(el.dataset.ecol, el.dataset.edoc, el.dataset.efield, valor);
    el.classList.remove("editing");
    if (ok) el.classList.add("save-ok");     /* flash verde de confirmación */
    setTimeout(() => { el.classList.remove("save-ok"); pendingRender = false; renderAll(); }, 700);
  }
  el.addEventListener("keydown", onKey);
  el.addEventListener("blur", onBlur);
}

function initDev(){
  /* 7 taps en el logo en menos de 3 segundos */
  let taps = [];
  on("logoTop", "click", () => {
    const now = Date.now();
    taps = taps.filter(t => now - t < 3000);
    taps.push(now);
    if (taps.length >= 7){
      taps = [];
      if (document.body.classList.contains("dev-on")) return;
      /* Solo email/password puede abrir devmode sin modal */
      if (!DEMO && authUser && authUser.providerData && authUser.providerData[0] && authUser.providerData[0].providerId === "password"){ activarDevmode(); return; }
      abrirLogin();
    }
  });

  on("loginBtn", "click", intentarLogin);
  on("loginPass", "keydown", e => { if (e.key === "Enter") intentarLogin(); });
  on("loginModal", "click", e => { if (e.target === qs("#loginModal")) qs("#loginModal").classList.remove("open"); });
  on("btnSalirDev", "click", salirDev);
  on("previewChip", "click", () => document.body.classList.remove("preview-cliente"));

  on("pinBtn", "click", _intentarVerificacionPin);
  on("pinCancelBtn", "click", _cancelarVerificacionPin);
  on("pinPass", "keydown", e => { if (e.key === "Enter") _intentarVerificacionPin(); });
  on("pinModal", "click", e => { if (e.target === qs("#pinModal")) _cancelarVerificacionPin(); });

  /* 2F — En devmode, tocar una card destacada abre el selector de productos.
     Registrado ANTES del delegado de edición inline (ambos en captura) para
     tener prioridad. El subtítulo (data-ecol) mantiene su edición inline. */
  document.addEventListener("click", e => {
    if (!document.body.classList.contains("dev-on") || document.body.classList.contains("preview-cliente")) return;
    if (editing) return;
    if (e.target.closest("[data-ecol]")) return;   /* subtítulo → edición inline normal */
    const card = e.target.closest("[data-selprod]");
    if (!card) return;
    e.preventDefault(); e.stopPropagation();
    abrirProdSel(card.dataset.selprod);
  }, true);

  /* Edición inline delegada sobre cualquier [data-ecol] */
  document.addEventListener("click", e => {
    if (!document.body.classList.contains("dev-on") || document.body.classList.contains("preview-cliente")) return;
    if (editing) return;
    const el = e.target.closest("[data-ecol]");
    if (!el || el.classList.contains("editing")) return;
    const interactivo = e.target.closest("button, a, input, select, textarea");
    if (interactivo && !interactivo.hasAttribute("data-ecol")) return;
    e.preventDefault(); e.stopPropagation();
    if (el.dataset.etype === "img"){
      abrirImgModal({ col: el.dataset.ecol, doc: el.dataset.edoc, field: el.dataset.efield });
    } else {
      iniciarEdicion(el);
    }
  }, true);
}

/* — Modal de imagen: tabs archivo / URL con vista previa — */
let imgCtx = null, imgModo = "file", imgDataURL = "";

/* ─── 2F: selector de producto destacado (devmode) ─── */
let _prodSelSlot = null;

function abrirProdSel(slot){
  _prodSelSlot = slot;
  const actual = state.config[slot] || "";
  const lista = qs("#prodSelLista");
  if (lista){
    lista.innerHTML = productosActivos().map(p => `
      <div class="psel-row${p.id === actual ? " sel-actual" : ""}">
        <span class="psel-img"><img src="${esc(p.imagen || "")}" alt=""></span>
        <div class="psel-info">
          <p class="psel-nombre">${esc(p.nombre)}</p>
          <p class="psel-precio">${fmtPrecio(p.precio)}</p>
        </div>
        <button class="pill ${p.id === actual ? "pill-solid" : "pill-outline"} pill-sm" data-pselid="${esc(p.id)}">
          ${p.id === actual ? "✓ Actual" : "✓ Seleccionar"}
        </button>
      </div>`).join("") || '<p class="pnota">No hay productos activos. Crea uno en el tab Productos.</p>';
  }
  qs("#prodSelModal").classList.add("open");
}

function initProdSel(){
  const modal = qs("#prodSelModal");
  if (!modal) return;
  modal.addEventListener("click", async e => {
    if (e.target === modal){ modal.classList.remove("open"); return; }
    const b = e.target.closest("[data-pselid]");
    if (!b || !_prodSelSlot) return;
    await saveConfig(_prodSelSlot, b.dataset.pselid);
    modal.classList.remove("open");
    renderInicio();
    toast("✅ Producto destacado actualizado");
  });
  const cancel = qs("#prodSelCancel");
  if (cancel) cancel.addEventListener("click", () => modal.classList.remove("open"));
}

function abrirImgModal(ctx){
  imgCtx = ctx; imgModo = "file"; imgDataURL = "";
  qs("#imgFile").value = ""; qs("#imgUrl").value = "";
  qs("#imgPreviewWrap").classList.remove("show");
  qsa("#imgModal .opt").forEach(o => o.classList.toggle("sel", o.dataset.opt === "file"));
  qs("#imgFileZone").hidden = false;
  qs("#imgUrlZone").hidden = true;
  qs("#imgDemoNote").style.display = DEMO ? "block" : "none";
  const btn = qs("#imgConfirm");
  btn.disabled = false; btn.textContent = "Confirmar";
  qs("#imgModal").classList.add("open");
}
function cerrarImgModal(){ qs("#imgModal").classList.remove("open"); imgCtx = null; }

function initImgModal(){
  qsa("#imgModal .opt").forEach(o => o.addEventListener("click", () => {
    imgModo = o.dataset.opt;
    qsa("#imgModal .opt").forEach(x => x.classList.toggle("sel", x === o));
    qs("#imgFileZone").hidden = imgModo !== "file";
    qs("#imgUrlZone").hidden = imgModo !== "url";
    qs("#imgPreviewWrap").classList.remove("show");
  }));
  on("imgFile", "change", () => {
    const f = qs("#imgFile").files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      imgDataURL = r.result;
      qs("#imgPreview").src = imgDataURL;
      qs("#imgPreviewWrap").classList.add("show");
    };
    r.readAsDataURL(f);
  });
  on("imgUrl", "input", () => {
    const u = qs("#imgUrl").value.trim();
    if (u){ qs("#imgPreview").src = u; qs("#imgPreviewWrap").classList.add("show"); }
    else qs("#imgPreviewWrap").classList.remove("show");
  });
  on("imgCancel", "click", cerrarImgModal);
  on("imgModal", "click", e => { if (e.target === qs("#imgModal")) cerrarImgModal(); });
  on("imgConfirm", "click", confirmarImagen);
}

async function confirmarImagen(){
  if (!imgCtx) return;
  const c = imgCtx.col, d = imgCtx.doc, f = imgCtx.field;

  if (imgModo === "url"){
    const u = qs("#imgUrl").value.trim();
    if (!u){ toast("Pega una URL de imagen"); return; }
    await guardarInline(c, d, f, u);
    cerrarImgModal(); renderAll();
    toast("🖼 Imagen actualizada");
    return;
  }

  const file = qs("#imgFile").files[0];
  if (!file){ toast("Elige un archivo de imagen"); return; }

  if (DEMO){
    await guardarInline(c, d, f, imgDataURL || "");
    cerrarImgModal(); renderAll();
    toast("🖼 Imagen actualizada (solo esta sesión)");
    return;
  }

  const btn = qs("#imgConfirm");
  btn.disabled = true; btn.textContent = "Procesando…";
  try {
    /* Convertir imagen a Base64 y guardar en Firestore — sin Firebase Storage */
    const reader = new FileReader();
    reader.onload = async function(ev){
      try {
        const base64url = ev.target.result; /* data:image/jpeg;base64,... */
        /* Comprimir si es muy grande (max ~800px ancho) */
        const compressed = await comprimirImagen(base64url, 800, 0.82);
        await guardarInline(c, d, f, compressed);
        cerrarImgModal(); renderAll();
        toast("🖼 Imagen guardada");
      } catch(e2){
        console.error(e2);
        toast("Error al guardar la imagen");
        btn.disabled = false; btn.textContent = "Confirmar";
      }
    };
    reader.onerror = function(){
      toast("Error al leer el archivo");
      btn.disabled = false; btn.textContent = "Confirmar";
    };
    reader.readAsDataURL(file);
  } catch(e){
    console.error(e);
    toast("Error al procesar la imagen");
    btn.disabled = false; btn.textContent = "Confirmar";
  }
}

/* Comprime una imagen base64 a max ancho/calidad dada — sin Storage */
function comprimirImagen(dataURL, maxW, calidad){
  return new Promise(function(resolve, reject){
    const img = new Image();
    img.onload = function(){
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxW){ h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", calidad || 0.82));
    };
    img.onerror = function(){ reject(new Error("No se pudo cargar la imagen")); };
    img.src = dataURL;
  });
}

/* ════════════════════════════════════════════════════════════════
   PANEL ADMIN — 6 tabs
   ════════════════════════════════════════════════════════════════ */
let openProdId = null;
const MKEY_FIELD = { msjConf:"msjConfirmacion", msjPrep:"msjPreparacion", msjCamino:"msjCamino", msjListo:"msjListo" };
const PREV_ID    = { msjConf:"prevConf", msjPrep:"prevPrep", msjCamino:"prevCamino", msjListo:"prevListo" };

function datosPreview(){
  return {
    nombre:  "María González",
    id:      "TB84291",
    items:   "2x Doble Test Clásica\n1x Papas Fritas",
    total:   fmtPrecio(16470),
    negocio: state.config.nombre || "TEST BURGERS",
    tiempo:  state.config.tiempoEntrega || "30-45 min"
  };
}
function actualizarPreviews(){
  const datos = datosPreview();
  Object.keys(PREV_ID).forEach(id => {
    const ta = qs("#" + id), pv = qs("#" + PREV_ID[id]);
    if (ta && pv) pv.textContent = buildMensaje(ta.value, datos);
  });
}

function fillPanel(forzar){
  const setVal = (id, v) => {
    const el = qs("#" + id);
    if (!el) return;
    if (!forzar && document.activeElement === el) return;
    if (el.type === "checkbox") el.checked = !!v;
    else el.value = v == null ? "" : v;
  };
  const c  = state.config;
  const cp = state.configPrivado || {};
  setVal("pNombre", c.nombre);
  setVal("pTagline", c.tagline);
  /* Poblar el <select> de rubro una sola vez, desde RUBROS — así un
     rubro nuevo agregado ahí aparece acá solo, sin tocar el HTML. */
  const selRubro = qs("#pRubro");
  if (selRubro && !selRubro.dataset.poblado){
    /* Los <option> de un <select> nativo no renderizan HTML dentro —
       insertar un ícono SVG ahí se vería como texto crudo, no como
       ícono. Por eso acá va solo el nombre, sin el emoji/ícono del
       rubro (a diferencia de los chips visuales de generar-tienda.html,
       que sí pueden mostrarlo porque no son <option>). */
    selRubro.innerHTML = RUBROS.map(r => `<option value="${r.id}">${esc(r.nombre)}</option>`).join("");
    selRubro.dataset.poblado = "1";
  }
  setVal("pRubro", c.subrubro || c.rubro || "hamburguesas");
  setVal("pAbierto", c.abierto !== false);
  setVal("pWhats", c.whatsapp === "CONFIGURAR_WHATSAPP" ? "" : c.whatsapp);
  setVal("pEmailNotif", cp.emailVendedor || cp.emailNotif || "");
  setVal("pFunctionsUrl", c.functionsUrl || "");
  setVal("pResendKey", cp.resendApiKey || "");
  setVal("pEmailEmisor", cp.emailEmisor || "");
  setVal("pEmailVendedor", cp.emailVendedor || cp.emailNotif || "");
  setVal("pDelCosto", c.deliveryCosto);
  setVal("pDelMin", c.deliveryMinimo);
  setVal("pTiempo", c.tiempoEntrega);
  setVal("pDeliveryOn", c.deliveryActivo !== false);
  setVal("pRetiroOn", c.retiroActivo !== false);
  setVal("msjConf", c.msjConfirmacion);
  setVal("msjPrep", c.msjPreparacion);
  setVal("msjCamino", c.msjCamino);
  setVal("msjListo", c.msjListo);
  setVal("pConfTitulo", c.confTitulo);
  setVal("pConfSub", c.confSub);
  setVal("pTl1", c.timeline1); setVal("pTl2", c.timeline2);
  setVal("pTl3", c.timeline3); setVal("pTl4", c.timeline4);
  setVal("pMostrarGPS", c.mostrarGPS !== false);
  setVal("mpToken", (!cp.mpToken || cp.mpToken === "CONFIGURAR_TOKEN") ? "" : cp.mpToken);
  setVal("pColor", c.colorPrimario || "#9B1B30");
  var _ph = qs("#pColorHex");
  if (_ph) _ph.value = (c.colorPrimario || "#9B1B30").replace("#","").toUpperCase();
  actualizarPreviews();
  if (window._renderZonas) window._renderZonas();
  renderCupAdmin();
  renderPromoAdmin();
  actualizarPreviewBanner();
}

/* ══════════════════════════════════════════════════════════════
   CUPONES — panel de administración (devmode)
   Antes, el botón "Crear cupón" no tenía ningún listener (no hacía
   nada al tocarlo) y la lista de cupones existentes nunca se
   renderizaba — el <div id="cupAdminList"> quedaba siempre vacío.
   Este bloque agrega ambas piezas: creación real en Firestore y
   listado con activar/desactivar/eliminar.
══════════════════════════════════════════════════════════════ */
function renderCupAdmin(){
  const wrap = qs("#cupAdminList");
  if (!wrap) return;
  const cupones = state.cupones || [];
  if (!cupones.length){
    wrap.innerHTML = '<p class="pnota">Ningún cupón creado todavía.</p>';
    return;
  }
  wrap.innerHTML = cupones.map(function(cu){
    const tipo = cu.tipo === "monto" ? "monto" : "porcentaje";
    const valorTxt = tipo === "monto" ? ("$" + Number(cu.valor||0).toLocaleString("es-CL")) : ((cu.valor||0) + "%");
    const usos = Number(cu.usosTotales) || 0;
    const limite = Number(cu.limiteTotal) || 0;
    const usosTxt = limite > 0 ? (usos + " / " + limite + " usos") : (usos + " usos · ilimitado");
    const inactivo = cu.activo === false;
    return `
      <div class="cup-admin-card${inactivo ? ' inactivo' : ''}">
        <div class="cup-admin-top">
          <span class="cup-admin-codigo">${esc(cu.codigo || "")}</span>
          <span class="cup-admin-valor">${valorTxt}</span>
        </div>
        <div class="cup-admin-sub">${esc(cu.descripcion || "Sin descripción")} · ${esc(usosTxt)}</div>
        <div class="cup-admin-actions">
          <button class="pill-mini" data-cup-toggle="${esc(cu.id)}" data-activo="${inactivo ? '0' : '1'}">${inactivo ? '✓ Activar' : '✕ Desactivar'}</button>
          <button class="pill-mini pill-mini-del" data-cup-del="${esc(cu.id)}">🗑 Eliminar</button>
        </div>
      </div>`;
  }).join("");

  wrap.querySelectorAll("[data-cup-toggle]").forEach(function(btn){
    btn.addEventListener("click", async function(){
      if (!(await pedirVerificacionPropietario("activar o desactivar un cupón"))) return;
      const id = btn.dataset.cupToggle;
      const activarlo = btn.dataset.activo === "0"; // si data-activo=0, estaba inactivo, así que el click lo activa
      try {
        await col("cupones").doc(id).set({ activo: activarlo }, { merge: true });
        toast(activarlo ? "✓ Cupón activado" : "✕ Cupón desactivado");
      } catch(e){
        console.error(e);
        toast("Error al actualizar el cupón");
      }
    });
  });

  wrap.querySelectorAll("[data-cup-del]").forEach(function(btn){
    btn.addEventListener("click", async function(){
      if (!(await pedirVerificacionPropietario("eliminar un cupón"))) return;
      const id = btn.dataset.cupDel;
      const cu = cupones.find(function(c){ return c.id === id; });
      if (!confirm("¿Eliminar el cupón " + (cu ? cu.codigo : "") + "? Esta acción no se puede deshacer.")) return;
      try {
        await col("cupones").doc(id).delete();
        toast("🗑 Cupón eliminado");
      } catch(e){
        console.error(e);
        toast("Error al eliminar el cupón");
      }
    });
  });
}

async function crearCupon(){
  if (!(await pedirVerificacionPropietario("crear un cupón"))) return;

  const btn = qs("#btnCrearCupon");
  const codigo = (qs("#cpCodigo").value || "").trim().toUpperCase();
  const tipo   = qs("#cpTipo").value === "monto" ? "monto" : "porcentaje";
  const valor  = Number(qs("#cpValor").value);
  const limiteTotal   = Number(qs("#cpLimiteTotal").value) || 0;
  const limiteUsuario = Number(qs("#cpLimiteUsuario").value) || 1;
  const vence  = (qs("#cpVence").value || "").trim();
  const descripcion = (qs("#cpDescripcion").value || "").trim();
  const soloReg  = qs("#cpSoloReg").checked;
  const primera  = qs("#cpPrimera").checked;

  if (!codigo){ toast("Escribe un código para el cupón"); return; }
  if (!valor || valor <= 0){ toast("El valor del descuento debe ser mayor a 0"); return; }
  if (tipo === "porcentaje" && valor > 100){ toast("El porcentaje no puede ser mayor a 100"); return; }

  // Evitar duplicar un código ya existente (case-insensitive)
  const yaExiste = (state.cupones || []).some(function(c){ return String(c.codigo||"").toUpperCase() === codigo; });
  if (yaExiste){ toast("Ya existe un cupón con ese código"); return; }

  const original = btn.textContent;
  btn.textContent = "Creando…";
  btn.disabled = true;

  try {
    const nuevoRef = col("cupones").doc();
    await nuevoRef.set({
      id: nuevoRef.id,
      codigo, tipo, valor,
      limiteTotal, limiteUsuario,
      vence: vence || null,
      descripcion,
      soloRegistrados: soloReg || primera, // primeraCompra siempre exige cuenta también
      primeraCompra: primera,
      activo: true,
      usosTotales: 0,
      creadoEn: new Date().toISOString()
    });

    toast("✓ Cupón " + codigo + " creado");
    // Limpiar el formulario para el siguiente cupón
    qs("#cpCodigo").value = "";
    qs("#cpValor").value = "";
    qs("#cpLimiteTotal").value = "";
    qs("#cpLimiteUsuario").value = "1";
    qs("#cpVence").value = "";
    qs("#cpDescripcion").value = "";
    qs("#cpSoloReg").checked = false;
    qs("#cpPrimera").checked = false;
  } catch(e){
    console.error(e);
    toast("Error al crear el cupón: " + (e.message || e));
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}
const _btnCrearCupon = qs("#btnCrearCupon");
if (_btnCrearCupon) _btnCrearCupon.addEventListener("click", crearCupon);

/* ══════════════════════════════════════════════════════════════
   INTENTOS DE PAGO SIN CONFIRMAR — panel de administración (devmode)
   Consulta tiendas/{storeId}/intentos_pago buscando los que llevan
   más de 3 minutos sin pasar a estado "confirmado" (le da tiempo de
   sobra al webhook de MercadoPago, que normalmente confirma en
   segundos). Esos son los casos donde hay que revisar manualmente si
   el cliente pagó de verdad y el pedido no se creó por algún fallo.
══════════════════════════════════════════════════════════════ */
async function revisarIntentosPago(){
  const btn = qs("#btnRevisarIntentos");
  const wrap = qs("#intentosPagoList");
  if (!btn || !wrap || !db) return;

  const original = btn.textContent;
  btn.textContent = "Revisando…";
  btn.disabled = true;

  try {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const snap = await col("intentos_pago").where("creadoEn", ">", desde).get();

    const sospechosos = [];
    const limiteMs = 3 * 60 * 1000; // 3 minutos de margen antes de considerarlo sospechoso
    snap.forEach(function(doc){
      const d = doc.data();
      if (d.estado === "confirmado") return; // todo salió bien, no mostrar
      const edadMs = Date.now() - new Date(d.creadoEn).getTime();
      if (edadMs > limiteMs) sospechosos.push(d);
    });

    if (!sospechosos.length){
      wrap.innerHTML = '<p class="pnota">✅ Sin intentos pendientes de revisión en las últimas 24h.</p>';
    } else {
      sospechosos.sort(function(a, b){ return new Date(b.creadoEn) - new Date(a.creadoEn); });
      wrap.innerHTML = sospechosos.map(function(d){
        const esError = d.estado === "error";
        const fecha = new Date(d.creadoEn).toLocaleString("es-CL", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"});
        return `
          <div class="cup-admin-card${esError ? '' : ' inactivo'}" style="${esError ? 'border-color:#E53935' : ''}">
            <div class="cup-admin-top">
              <span class="cup-admin-codigo">#${esc(d.id)}</span>
              <span class="cup-admin-valor">${fmtPrecio(d.total)}</span>
            </div>
            <div class="cup-admin-sub">
              ${esc(fecha)} · ${esc(d.cliente?.nombre || "sin nombre")}
              ${esError ? '<br><b style="color:#E53935">Error: ' + esc(d.errorDetalle || "desconocido") + '</b>' : '<br>Estado: ' + esc(d.estado)}
            </div>
          </div>`;
      }).join("");
    }
  } catch(e){
    console.error(e);
    wrap.innerHTML = '<p class="pnota">Error al revisar: ' + esc(e.message) + '</p>';
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}
const _btnRevisarIntentos = qs("#btnRevisarIntentos");
if (_btnRevisarIntentos) _btnRevisarIntentos.addEventListener("click", revisarIntentosPago);

/* ══════════════════════════════════════════════════════════════
   BANNERS PROMOCIONALES — panel de administración (devmode)
   Mismo problema que cupones: el botón "Agregar banner" no tenía
   listener y la lista nunca se renderizaba. Acá se agrega el
   formulario completo (antes solo existía el botón, sin campos),
   vista previa en vivo idéntica al banner real de la tienda, y el
   listado con miniatura — la misma tarjeta .promo-card que ve el
   cliente, no una aproximación.
══════════════════════════════════════════════════════════════ */
function actualizarPreviewBanner(){
  const tit = (qs("#bnTitulo").value || "").trim();
  const sub = (qs("#bnSubtitulo").value || "").trim();
  const emoji = (qs("#bnEmoji").value || "🎉").trim() || "🎉";
  const color = qs("#bnColor").value || "#9B1B30";
  qs("#bnPreviewCard").style.background = color;
  qs("#bnPreviewEmoji").textContent = emoji;
  qs("#bnPreviewTit").textContent = tit || "Título del banner";
  qs("#bnPreviewSub").textContent = sub || "Subtítulo del banner";
}
["bnTitulo","bnSubtitulo","bnEmoji"].forEach(function(id){
  const el = qs("#" + id);
  if (el) el.addEventListener("input", actualizarPreviewBanner);
});
const _bnColor = qs("#bnColor");
const _bnColorHex = qs("#bnColorHex");
if (_bnColor) _bnColor.addEventListener("input", function(){
  _bnColorHex.value = _bnColor.value.replace("#","").toUpperCase();
  actualizarPreviewBanner();
});
if (_bnColorHex) _bnColorHex.addEventListener("input", function(){
  let hex = _bnColorHex.value.replace(/[^0-9A-Fa-f]/g,"").slice(0,6);
  if (hex.length === 6){ _bnColor.value = "#" + hex; actualizarPreviewBanner(); }
});

function renderPromoAdmin(){
  const wrap = qs("#promoAdminList");
  if (!wrap) return;
  const banners = Array.isArray(state.config.banners) ? state.config.banners : [];
  if (!banners.length){
    wrap.innerHTML = '<p class="pnota">Ningún banner creado todavía.</p>';
    return;
  }
  const hoy = new Date().toISOString().slice(0, 10);
  wrap.innerHTML = banners.map(function(b, i){
    const vencido = b.vence && String(b.vence) < hoy;
    const inactivo = b.activo === false;
    let estadoTxt = "Visible ahora en la tienda";
    if (vencido) estadoTxt = "Vencido — oculto automáticamente";
    else if (inactivo) estadoTxt = "Desactivado manualmente";
    return `
      <div class="promo-admin-card">
        <div class="promo-card promo-admin-mini" style="background:${esc(b.color || '#9B1B30')}">
          <span class="promo-emoji">${esc(b.emoji || '🎉')}</span>
          <div class="promo-txt">
            <p class="promo-titulo">${esc(b.titulo || '')}</p>
            <p class="promo-sub">${esc(b.subtitulo || '')}</p>
          </div>
        </div>
        <div class="promo-admin-estado${(vencido||inactivo) ? ' inactivo' : ''}">${esc(estadoTxt)}</div>
        <div class="cup-admin-actions">
          <button class="pill-mini" data-banner-toggle="${i}" data-activo="${inactivo ? '0' : '1'}">${inactivo ? '✓ Activar' : '✕ Desactivar'}</button>
          <button class="pill-mini pill-mini-del" data-banner-del="${i}">🗑 Eliminar</button>
        </div>
      </div>`;
  }).join("");

  wrap.querySelectorAll("[data-banner-toggle]").forEach(function(btn){
    btn.addEventListener("click", function(){
      const i = Number(btn.dataset.bannerToggle);
      const activarlo = btn.dataset.activo === "0";
      const banners = (state.config.banners || []).slice();
      if (!banners[i]) return;
      banners[i] = Object.assign({}, banners[i], { activo: activarlo });
      state.config.banners = banners;
      saveConfig("banners", banners);
      renderPromos();
      toast(activarlo ? "✓ Banner activado" : "✕ Banner desactivado");
    });
  });

  wrap.querySelectorAll("[data-banner-del]").forEach(function(btn){
    btn.addEventListener("click", function(){
      const i = Number(btn.dataset.bannerDel);
      const banners = (state.config.banners || []).slice();
      if (!banners[i]) return;
      if (!confirm("¿Eliminar el banner \"" + (banners[i].titulo || "sin título") + "\"?")) return;
      banners.splice(i, 1);
      state.config.banners = banners;
      saveConfig("banners", banners);
      renderPromos();
      toast("🗑 Banner eliminado");
    });
  });
}

function crearBanner(){
  const btn = qs("#btnNuevoBanner");
  const titulo = (qs("#bnTitulo").value || "").trim();
  const subtitulo = (qs("#bnSubtitulo").value || "").trim();
  const emoji = (qs("#bnEmoji").value || "🎉").trim() || "🎉";
  const color = qs("#bnColor").value || "#9B1B30";
  const vence = (qs("#bnVence").value || "").trim();

  if (!titulo && !subtitulo){ toast("Escribe al menos un título o subtítulo"); return; }

  const banners = Array.isArray(state.config.banners) ? state.config.banners.slice() : [];
  banners.push({ titulo, subtitulo, emoji, color, vence: vence || null, activo: true, creadoEn: new Date().toISOString() });
  state.config.banners = banners;
  saveConfig("banners", banners);
  renderPromos();
  renderPromoAdmin();
  toast("✓ Banner agregado");

  // Limpiar el formulario para el siguiente banner
  qs("#bnTitulo").value = "";
  qs("#bnSubtitulo").value = "";
  qs("#bnEmoji").value = "";
  qs("#bnVence").value = "";
  actualizarPreviewBanner();
}
const _btnNuevoBanner = qs("#btnNuevoBanner");
if (_btnNuevoBanner) _btnNuevoBanner.addEventListener("click", crearBanner);

function renderMpEstado(){
  const t = (state.configPrivado || {}).mpToken;
  qs("#mpEstado").textContent = (!t || t === "CONFIGURAR_TOKEN")
    ? "⚠️ No configurado"
    : "✅ Conectado correctamente";
}

/* Editor de grupos de variantes — hasta 3 grupos por producto (ej.
   Color, Talla). Las opciones de cada grupo se editan como texto
   separado por comas en un solo campo, en vez de un editor de lista
   con botones +/- por opción — más simple de construir y de usar para
   listas cortas (2-6 opciones típicas), sin necesitar una interfaz de
   arrays anidados. saveVariantesGrupo() convierte ese texto a array al
   guardar. */
function renderEditorVariantes(p){
  const grupos = Array.isArray(p.variantes) ? p.variantes : [];
  const filas = grupos.map((g, i) => `
    <div class="variante-grupo" data-vidx="${i}">
      <input class="field pe-variante" data-pid="${esc(p.id)}" data-vidx="${i}" data-vcampo="nombre"
             placeholder="Ej: Color, Tamaño, Material" value="${esc(g.nombre || "")}" style="margin-bottom:6px">
      <input class="field pe-variante" data-pid="${esc(p.id)}" data-vidx="${i}" data-vcampo="opciones"
             placeholder="Opciones separadas por coma: Rojo, Azul, Verde"
             value="${esc((g.opciones || []).join(", "))}">
      <button class="ibtn" data-a="delvariante" data-pid="${esc(p.id)}" data-vidx="${i}" title="Quitar este grupo" style="margin-top:6px">🗑 Quitar grupo</button>
    </div>`).join("");
  const puedeAgregar = grupos.length < 3;
  return `
    <div class="variantes-editor">
      <label class="plabel">Grupos de variantes (hasta 3)</label>
      ${filas || '<p class="pnota" style="margin:6px 0">Todavía no hay grupos — agregá uno.</p>'}
      ${puedeAgregar ? `<button class="pill pill-outline pill-sm" data-a="addvariante" data-pid="${esc(p.id)}" style="margin-top:8px">➕ Agregar grupo de variantes</button>` : '<p class="pnota" style="margin:6px 0">Máximo 3 grupos por producto.</p>'}
    </div>`;
}

/* Operaciones sobre el array producto.variantes — cada una relee el
   producto actual de state, modifica el array completo, y lo guarda
   entero con saveField (Firestore no tiene una forma de "empujar a un
   índice específico de un array" con merge, así que se reemplaza el
   array entero cada vez — para hasta 3 grupos de pocas opciones cada
   uno, el costo es insignificante). */
function agregarGrupoVariante(pid){
  const p = state.productos.find(x => x.id === pid);
  if (!p) return;
  const grupos = Array.isArray(p.variantes) ? p.variantes.slice() : [];
  if (grupos.length >= 3) return; // tope ya reflejado en la UI, doble chequeo acá
  grupos.push({ nombre: "", opciones: [] });
  saveField("productos", pid, "variantes", grupos).then(() => renderPanelProds());
}
function quitarGrupoVariante(pid, idx){
  const p = state.productos.find(x => x.id === pid);
  if (!p) return;
  const grupos = Array.isArray(p.variantes) ? p.variantes.slice() : [];
  grupos.splice(idx, 1);
  saveField("productos", pid, "variantes", grupos).then(() => renderPanelProds());
}
function actualizarCampoVariante(pid, idx, campo, valor){
  const p = state.productos.find(x => x.id === pid);
  if (!p) return;
  const grupos = Array.isArray(p.variantes) ? p.variantes.slice() : [];
  if (!grupos[idx]) return;
  const grupo = Object.assign({}, grupos[idx]);
  if (campo === "opciones"){
    /* Texto separado por comas → array, recortando espacios y
       descartando entradas vacías (ej. una coma de más al final). */
    grupo.opciones = valor.split(",").map(s => s.trim()).filter(Boolean);
  } else {
    grupo.nombre = valor.trim();
  }
  grupos[idx] = grupo;
  saveField("productos", pid, "variantes", grupos);
  /* No se vuelve a renderizar acá a propósito — el campo de texto
     perdería el foco a mitad de tipeo si se re-renderiza en cada
     "change". Alcanza con guardar; el próximo render (al abrir/cerrar
     el editor, o al recargar) ya muestra el valor actualizado. */
}


/* ══════════════════════════════════════════════════════════════
   CATEGORÍAS — helpers
   Fuente de verdad: state.config.categorias (array de strings).
   Si no existe (instalaciones viejas), se deriva de productos.
   ══════════════════════════════════════════════════════════════ */
function obtenerCategorias(){
  if (Array.isArray(state.config.categorias) && state.config.categorias.length){
    return state.config.categorias.slice();
  }
  const cats = Array.from(new Set(productosActivos().map(p => p.categoria).filter(Boolean))).sort();
  if (cats.length){
    state.config.categorias = cats;
    saveConfig("categorias", cats);
  }
  return cats;
}

async function agregarCategoria(nombre){
  nombre = String(nombre || "").trim();
  if (!nombre) return false;
  const cats = obtenerCategorias();
  if (cats.some(c => c.toLowerCase() === nombre.toLowerCase())){
    toast("Esa categoría ya existe");
    return false;
  }
  cats.push(nombre);
  cats.sort((a, b) => a.localeCompare(b, "es"));
  state.config.categorias = cats;
  await saveConfig("categorias", cats);
  toast("Categoría agregada: " + nombre);
  return true;
}

async function renombrarCategoria(viejo, nuevo){
  viejo = String(viejo || "").trim();
  nuevo = String(nuevo || "").trim();
  if (!viejo || !nuevo || viejo === nuevo) return false;
  const cats = obtenerCategorias();
  const idx = cats.findIndex(c => c === viejo);
  if (idx === -1) return false;
  if (cats.some(c => c.toLowerCase() === nuevo.toLowerCase())){
    toast("Ya existe una categoría con ese nombre");
    return false;
  }
  cats[idx] = nuevo;
  cats.sort((a, b) => a.localeCompare(b, "es"));
  state.config.categorias = cats;
  await saveConfig("categorias", cats);
  const afectados = state.productos.filter(p => p.categoria === viejo);
  for (const p of afectados){
    await saveField("productos", p.id, "categoria", nuevo);
  }
  toast("Renombrada: " + viejo + " -> " + nuevo + " (" + afectados.length + " productos)");
  return true;
}

async function eliminarCategoria(nombre){
  nombre = String(nombre || "").trim();
  if (!nombre) return false;
  const afectados = state.productos.filter(p => p.categoria === nombre);
  /* No permitir eliminar si tiene productos asignados */
  if (afectados.length){
    alert("No se puede eliminar la categoría \"" + nombre + "\"\n\n" +
          "Tiene " + afectados.length + " producto(s) asignado(s).\n" +
          "Reasigná esos productos a otra categoría primero.");
    return false;
  }
  if (!confirm("¿Eliminar la categoría \"" + nombre + "\"?")) return false;
  const cats = obtenerCategorias().filter(c => c !== nombre);
  state.config.categorias = cats;
  await saveConfig("categorias", cats);
  toast("Categoría eliminada: " + nombre);
  return true;
}


/* ════════════════════════════════════════════════════════════════
   EDITOR INLINE DE NUEVA CATEGORÍA
   Cuando el usuario elige "Escribir nueva..." en el select,
   se oculta el select y se muestra un input + Guardar/Cancelar.
   ════════════════════════════════════════════════════════════════ */
function abrirInputNuevaCategoria(selectEl){
  const wrap = selectEl.closest(".prod-editor") || selectEl.parentNode;
  if (!wrap) return;

  /* Evitar duplicado si ya está abierto */
  if (wrap.querySelector(".cat-inline-nueva")) {
    const inp = wrap.querySelector(".cat-inline-nueva input");
    if (inp) inp.focus();
    return;
  }

  /* Ocultar el select */
  selectEl.style.display = "none";

  /* Crear contenedor */
  const cont = document.createElement("div");
  cont.className = "cat-inline-nueva";
  cont.style.cssText = "display:flex;gap:6px;align-items:center;margin-top:6px;";
  cont.innerHTML = `
    <input type="text" class="field" placeholder="Nombre de la categoría" style="flex:1;margin:0;padding:10px 12px;font-size:13px;border:1.5px solid var(--borde);border-radius:10px;outline:none">
    <button type="button" class="pill pill-solid pill-sm" data-cat-guardar style="margin:0;padding:8px 14px;font-size:12px">Guardar</button>
    <button type="button" class="pill pill-outline-muted pill-sm" data-cat-cancelar style="margin:0;padding:8px 14px;font-size:12px">Cancelar</button>
  `;
  selectEl.parentNode.insertBefore(cont, selectEl.nextSibling);

  const input = cont.querySelector("input");
  const btnGuardar = cont.querySelector("[data-cat-guardar]");
  const btnCancelar = cont.querySelector("[data-cat-cancelar]");

  input.focus();

  function cerrar(){
    cont.remove();
    selectEl.style.display = "";
    selectEl.value = "";
  }

  async function guardar(){
    const nombre = input.value.trim();
    if (!nombre){
      toast("Escribe un nombre");
      input.focus();
      return;
    }
    /* Agregar al config si no existe (usando helper del Script A) */
    if (typeof agregarCategoria === "function"){
      await agregarCategoria(nombre);
    }
    /* Asignar al producto */
    await saveField("productos", selectEl.dataset.pid, "categoria", nombre);
    toast("Categoría: " + nombre);
    cerrar();
    renderPanelProds();
  }

  btnGuardar.addEventListener("click", guardar);
  btnCancelar.addEventListener("click", cerrar);

  input.addEventListener("keydown", function(e){
    if (e.key === "Enter"){ e.preventDefault(); guardar(); }
    if (e.key === "Escape"){ e.preventDefault(); cerrar(); }
  });
}


/* ════════════════════════════════════════════════════════════════
   GESTIÓN DE CATEGORÍAS — lista con editar y eliminar
   ════════════════════════════════════════════════════════════════ */
function renderPanelCats(){
  const wrap = document.getElementById("catListaAdmin");
  if (!wrap) return;
  const cats = obtenerCategorias();

  if (!cats.length){
    wrap.innerHTML = '<p class="pnota">Sin categorías todavía. Creá la primera abajo.</p>';
    return;
  }

  wrap.innerHTML = cats.map(cat => {
    const count = state.productos.filter(p => p.categoria === cat).length;
    return `
      <div class="cat-admin-row" data-cat="${esc(cat)}">
        <span class="cat-nombre">${esc(cat)}</span>
        <span class="cat-count">${count} prod.</span>
        <span class="cat-btns">
          <button class="ibtn" data-cat-edit="${esc(cat)}" title="Renombrar">✎</button>
          <button class="ibtn" data-cat-del="${esc(cat)}" title="Eliminar">🗑</button>
        </span>
      </div>
    `;
  }).join("");
}

function abrirEditarCat(nombreViejo){
  const wrap = document.getElementById("catListaAdmin");
  if (!wrap) return;
  const fila = wrap.querySelector('[data-cat="' + CSS.escape(nombreViejo) + '"]');
  if (!fila) return;

  /* Reemplazar la fila completa por el input inline */
  const cont = document.createElement("div");
  cont.className = "cat-edit-inline";
  cont.style.cssText = "background:#FFFDE7;padding:8px 10px;border-radius:12px;margin-bottom:6px;";
  cont.innerHTML = `
    <input type="text" value="${esc(nombreViejo)}" placeholder="Nuevo nombre">
    <button class="pill pill-solid pill-sm" data-cat-save style="margin:0;padding:6px 12px;font-size:12px">Guardar</button>
    <button class="pill pill-outline-muted pill-sm" data-cat-cancel style="margin:0;padding:6px 12px;font-size:12px">✕</button>
  `;
  fila.replaceWith(cont);

  const input = cont.querySelector("input");
  const btnSave = cont.querySelector("[data-cat-save]");
  const btnCancel = cont.querySelector("[data-cat-cancel]");
  input.focus();
  input.select();

  function cancelar(){
    cont.replaceWith(fila);
  }

  async function guardar(){
    const nuevo = input.value.trim();
    if (!nuevo || nuevo === nombreViejo){ cancelar(); return; }
    const ok = await renombrarCategoria(nombreViejo, nuevo);
    if (ok){
      renderPanelCats();
      renderPanelProds();
    } else {
      cancelar();
    }
  }

  btnSave.addEventListener("click", guardar);
  btnCancel.addEventListener("click", cancelar);
  input.addEventListener("keydown", function(e){
    if (e.key === "Enter"){ e.preventDefault(); guardar(); }
    if (e.key === "Escape"){ e.preventDefault(); cancelar(); }
  });
}

function abrirNuevaCatAdmin(){
  const wrap = document.getElementById("catListaAdmin");
  if (!wrap) return;
  if (wrap.querySelector(".cat-edit-inline")) return; /* ya hay uno abierto */

  const cont = document.createElement("div");
  cont.className = "cat-edit-inline";
  cont.style.cssText = "background:#E8F5E9;padding:8px 10px;border-radius:12px;margin-bottom:6px;";
  cont.innerHTML = `
    <input type="text" placeholder="Nombre de la nueva categoría">
    <button class="pill pill-solid pill-sm" data-cat-save style="margin:0;padding:6px 12px;font-size:12px">Guardar</button>
    <button class="pill pill-outline-muted pill-sm" data-cat-cancel style="margin:0;padding:6px 12px;font-size:12px">✕</button>
  `;
  wrap.insertBefore(cont, wrap.firstChild);

  const input = cont.querySelector("input");
  const btnSave = cont.querySelector("[data-cat-save]");
  const btnCancel = cont.querySelector("[data-cat-cancel]");
  input.focus();

  function cancelar(){ cont.remove(); }

  async function guardar(){
    const nombre = input.value.trim();
    if (!nombre){ input.focus(); return; }
    const ok = await agregarCategoria(nombre);
    if (ok){ renderPanelCats(); }
    else { input.focus(); }
  }

  btnSave.addEventListener("click", guardar);
  btnCancel.addEventListener("click", cancelar);
  input.addEventListener("keydown", function(e){
    if (e.key === "Enter"){ e.preventDefault(); guardar(); }
    if (e.key === "Escape"){ e.preventDefault(); cancelar(); }
  });
}

function renderPanelProds(){
  const wrap = qs("#panelProds");
  const ae = document.activeElement;
  if (wrap.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
  const cats = FILTROS.slice(1);
  wrap.innerHTML = porOrden(state.productos).map(p => {
    const fila = `
      <div class="prow ${p.activo === false ? "inactivo" : ""}">
        <span class="mini"><img src="${esc(p.imagen || "")}" alt=""></span>
        <span class="ttl">${esc(p.nombre)}<small>${fmtPrecio(p.precio)} · ${esc(p.categoria || "")}</small></span>
        <span class="pbtns">
          <button class="ibtn" data-a="edit" data-pid="${esc(p.id)}" title="Editar">✎</button>
          <button class="ibtn" data-a="up" data-pid="${esc(p.id)}" title="Subir">↑</button>
          <button class="ibtn" data-a="down" data-pid="${esc(p.id)}" title="Bajar">↓</button>
          <button class="ibtn" data-a="del" data-pid="${esc(p.id)}" title="Eliminar">🗑</button>
        </span>
      </div>`;
    if (openProdId !== p.id) return fila;
    return fila + `
      <div class="prod-editor">
        <label class="plabel">Nombre</label>
        <input class="field pe" data-pid="${esc(p.id)}" data-pf="nombre" value="${esc(p.nombre)}">
        <label class="plabel">Precio $</label>
        <input class="field pe" type="number" inputmode="numeric" data-pid="${esc(p.id)}" data-pf="precio" value="${Number(p.precio) || 0}">
        <label class="plabel">Descripción</label>
        <textarea class="field pe" style="min-height:70px" data-pid="${esc(p.id)}" data-pf="descripcion">${esc(p.descripcion || "")}</textarea>
        <label class="plabel">Categoría</label>
        <select class="field pe" data-pid="${esc(p.id)}" data-pf="categoria">
          ${cats.map(f => `<option value="${esc(f)}" ${f === p.categoria ? "selected" : ""}>${esc(f)}</option>`).join("")}
          <option value="__nueva__">✏️ Escribir nueva...</option>
        </select>
        ${!cats.length || p.categoria === "__nueva__" ? `<input class="field pe" style="margin-top:6px" data-pid="${esc(p.id)}" data-pf="categoria" value="${esc(p.categoria !== "__nueva__" ? p.categoria : "")}" placeholder="Nueva categoría">` : ""}
        <button class="pill pill-outline pill-sm panel-full" data-imgprod="${esc(p.id)}">🖼 Cambiar imagen</button>
        <div class="switch-row">
          <span>Activo</span>
          <label class="switch"><input type="checkbox" class="pe" data-pid="${esc(p.id)}" data-pf="activo" ${p.activo !== false ? "checked" : ""}><span class="slider"></span></label>
        </div>
        <div class="switch-row">
          <span>Variantes (opciones que el cliente elige, ej. color o tamaño)</span>
          <label class="switch"><input type="checkbox" class="pe" data-pid="${esc(p.id)}" data-pf="variantesActivas" ${p.variantesActivas ? "checked" : ""}><span class="slider"></span></label>
        </div>
        ${p.variantesActivas ? renderEditorVariantes(p) : ""}
        <div class="switch-row">
          <span>Permitir texto personalizado (algo que el cliente escribe, único por pedido)</span>
          <label class="switch"><input type="checkbox" class="pe" data-pid="${esc(p.id)}" data-pf="permitePersonalizacion" ${p.permitePersonalizacion ? "checked" : ""}><span class="slider"></span></label>
        </div>
        ${p.permitePersonalizacion ? `
        <label class="plabel">Qué le pides al cliente que escriba</label>
        <input class="field pe" data-pid="${esc(p.id)}" data-pf="personalizacionEtiqueta" placeholder="Ej: Nota o mensaje personalizado" value="${esc(p.personalizacionEtiqueta || "")}">
        ` : ""}
      </div>`;
  }).join("") || '<p class="pnota">No hay productos. Crea el primero con el botón de arriba.</p>';
}

async function moverProd(pid, dir){
  const arr = porOrden(state.productos);
  const i = arr.findIndex(p => p.id === pid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  const a = arr[i], b = arr[j];
  const oa = a.orden, ob = b.orden;
  await saveField("productos", a.id, "orden", ob);
  await saveField("productos", b.id, "orden", oa);
}

function renderPanel(){
  renderPanelCats();
  renderPanelProds();
  poblarSelectRubro();
  fillPanel(false);
  renderMpEstado();
  renderPanelNotif();
  if (window._renderZonas)    window._renderZonas();
  if (window._renderFinanzas) window._renderFinanzas();
  if (window._renderInventario) window._renderInventario();
}

function _pushChange(col, doc, field, value, oldValue){
  const idx = _pendingChanges.findIndex(c => c.col===col && c.doc===doc && c.field===field);
  if (idx >= 0){ _pendingChanges[idx].value = value; _actualizarPendingBar(); return; }
  _pendingChanges.push({ col, doc, field, value, oldValue });
  _actualizarPendingBar();
}
function _actualizarPendingBar(){
  const bar = qs("#pendingBar");
  if (!bar) return;
  if (!_pendingChanges.length){ bar.style.display = "none"; return; }
  bar.style.display = "flex";
  qs("#pendingCount").textContent = _pendingChanges.length === 1
    ? "1 cambio sin guardar"
    : _pendingChanges.length + " cambios sin guardar";
}
async function _commitPending(){
  if (!_pendingChanges.length) return true;
  const lista = _pendingChanges.slice();
  const btn = qs("#btnSave");
  if (btn){ btn.disabled = true; btn.textContent = "Guardando…"; }
  try {
    for (const ch of lista){
      await col(ch.col).doc(ch.doc).set({ [ch.field]: ch.value }, { merge:true });
    }
    _pendingChanges = [];
    _actualizarPendingBar();
    if (btn){ btn.disabled = false; btn.textContent = "Guardar"; }
    toast("✅ Cambios guardados");
    return true;
  } catch(e){
    console.error("Error al guardar cambios:", e);
    toast("Error al guardar — intenta de nuevo");
    if (btn){ btn.disabled = false; btn.textContent = "Guardar"; }
    return false;
  }
}
function _discardPending(){
  if (!_pendingChanges.length) return;
  if (!confirm("¿Descartar los " + _pendingChanges.length + " cambios sin guardar?")) return;
  for (const ch of _pendingChanges){
    applyLocal(ch.col, ch.doc, ch.field, ch.oldValue);
  }
  _pendingChanges = [];
  _actualizarPendingBar();
  renderAll();
  toast("Cambios descartados");
}
function _activarModoBorrador(){
  if (_modoBorrador) return;
  _modoBorrador = true;
  _pendingChanges = [];
  _actualizarPendingBar();
}
function _desactivarModoBorrador(){
  _modoBorrador = false;
  _pendingChanges = [];
  _actualizarPendingBar();
}
function _cerrarPanel(){
  if (_pendingChanges.length){
    const guardar = confirm("Tenés " + _pendingChanges.length + " cambio(s) sin guardar.\n\nAceptar = Guardar y cerrar\nCancelar = Descartar y cerrar");
    if (guardar){ _commitPending().then(_doCerrarPanel); return; }
    for (const ch of _pendingChanges){
      applyLocal(ch.col, ch.doc, ch.field, ch.oldValue);
    }
    _pendingChanges = [];
    _actualizarPendingBar();
    renderAll();
  }
  _doCerrarPanel();
}
function _doCerrarPanel(){
  qs("#adminPanel").classList.remove("open");
  document.body.classList.remove("panel-min-on");
  _desactivarModoBorrador();
}

function initPanel(){
  on("btnPanel", "click", () => {
    qs("#adminPanel").classList.add("open");
    _activarModoBorrador();
    renderPanelProds();
    fillPanel(true);
    renderMpEstado();
    renderPanelNotif();
    renderFinanzas();
    renderInventario();
  });
  on("panelClose", "click", _cerrarPanel);
  const _btnMin = qs("#panelMin");
  if (_btnMin) _btnMin.addEventListener("click", function(){
    document.body.classList.toggle("panel-min-on");
  });
  const _chip = qs("#panelChip");
  if (_chip) _chip.addEventListener("click", function(){
    document.body.classList.remove("panel-min-on");
  });
  const _btnSave = qs("#btnSave");
  if (_btnSave) _btnSave.addEventListener("click", _commitPending);
  const _btnDisc = qs("#btnDiscard");
  if (_btnDisc) _btnDisc.addEventListener("click", _discardPending);

  /* ── TAB FINANZAS ─────────────────────────────────────────── */
  var _finPer = "hoy";

  function renderFinanzas(){
    var pedidos = state.pedidos || [];
    var ahora = new Date();
    var _calFecha = qs("#finCalFecha") ? qs("#finCalFecha").value : "";
    var _calWrap  = qs("#finCalWrap");
    if (_calWrap) _calWrap.style.display = _finPer === "cal" ? "block" : "none";
    var filtrado = pedidos.filter(function(p){
      var f = p.fecha ? new Date(p.fecha) : null;
      if (!f) return false;
      if (_finPer === "hoy"){
        return f.toDateString() === ahora.toDateString();
      } else if (_finPer === "semana"){
        var d7 = new Date(ahora); d7.setDate(ahora.getDate()-7);
        return f >= d7;
      } else if (_finPer === "mes"){
        return f.getMonth()===ahora.getMonth() && f.getFullYear()===ahora.getFullYear();
      } else if (_finPer === "90"){
        var d90 = new Date(ahora); d90.setDate(ahora.getDate()-90);
        return f >= d90;
      } else if (_finPer === "cal"){
        if (!_calFecha) return f.toDateString() === ahora.toDateString();
        var chosen = new Date(_calFecha+"T00:00:00");
        return f.toDateString() === chosen.toDateString();
      }
      return true; // total
    });

    var ventas = filtrado.reduce(function(s,p){ return s + (Number(p.total)||0); }, 0);
    var nPed   = filtrado.length;
    var ticket = nPed > 0 ? Math.round(ventas/nPed) : 0;
    var delSum = filtrado.reduce(function(s,p){ return s + (Number(p.costoDelivery)||0); }, 0);

    qs("#finVentas").textContent  = fmtPrecio(ventas);
    qs("#finPedidos").textContent = nPed;
    qs("#finTicket").textContent  = fmtPrecio(ticket);
    qs("#finDelivery").textContent= fmtPrecio(delSum);

    /* Chart de ventas por día */
    var ctx = qs("#finChart");
    if (ctx){
      /* Agrupar por día */
      var dias = {};
      filtrado.forEach(function(p){
        var f = new Date(p.fecha); var k = f.toLocaleDateString("es-CL",{day:"2-digit",month:"2-digit"});
        dias[k] = (dias[k]||0) + (Number(p.total)||0);
      });
      var labels = Object.keys(dias).slice(-14);
      var vals   = labels.map(function(k){ return dias[k]; });
      if (window._finChartInst) window._finChartInst.destroy();
      if (labels.length && typeof Chart !== "undefined"){
        window._finChartInst = new Chart(ctx.getContext("2d"),{
          type:"bar",
          data:{ labels:labels, datasets:[{ data:vals, backgroundColor:"var(--rojo)", borderRadius:6 }] },
          options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ callback:function(v){ return "$"+v.toLocaleString("es-CL"); } } }, x:{ ticks:{ font:{ size:10 } } } }, responsive:true, maintainAspectRatio:false }
        });
      }
    }

    /* Top productos */
    var prodCount = {};
    filtrado.forEach(function(p){
      (p.items||[]).forEach(function(it){ prodCount[it.nombre] = (prodCount[it.nombre]||0) + (it.cantidad||1); });
    });
    var topProds = Object.keys(prodCount).sort(function(a,b){ return prodCount[b]-prodCount[a]; }).slice(0,5);
    var maxV = topProds.length ? prodCount[topProds[0]] : 1;
    var tDiv = qs("#finTopProds");
    if (tDiv){
      tDiv.innerHTML = topProds.length
        ? topProds.map(function(n){
            var pct = Math.round((prodCount[n]/maxV)*100);
            return '<div class="fin-top-item"><div><div style="font-weight:800">'+esc(n)+'</div>'
              +'<div style="width:'+pct+'%;height:5px;border-radius:3px;background:#ffffff;margin-top:4px;min-width:6px"></div></div>'
              +'<span style="font-weight:900;font-size:15px">'+prodCount[n]+'</span></div>';
          }).join("")
        : '<p class="pnota" style="margin:0">Sin datos aún.</p>';
    }

    /* Registros manuales */
    _renderRegistrosFinanzas();
  }

  function _renderRegistrosFinanzas(){
    if (!db) return;
    db.collection("tiendas").doc(STORE_ID).collection("registros_diarios")
      .orderBy("fecha","desc").limit(200)
      .get().then(function(s){
        var arr = []; s.forEach(function(d){ arr.push(Object.assign({id:d.id},d.data())); });
        var div = qs("#finRegistros"); if (!div) return;
        div.innerHTML = arr.length ? arr.map(function(r){
          var esI = r.tipo === "ingreso";
          return '<div class="fin-reg">'
            +'<div class="fin-reg-tipo '+(esI?"i":"e")+'">'+(esI?"＋":"−")+'</div>'
            +'<div style="flex:1"><div style="font-weight:700">'+esc(r.descripcion||r.tipo)+'</div>'
            +'<div style="font-size:11px;color:var(--muted)">'+new Date(r.fecha).toLocaleString("es-CL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+'</div></div>'
            +'<div style="font-weight:900;color:'+(esI?"#1B5E20":"#9B1B30")+'">'+fmtPrecio(r.monto)+'</div>'
            +'</div>';
        }).join("") : '<p class="pnota" style="margin:0">Sin registros manuales.</p>';
      }).catch(function(){});
  }

  qsa(".fin-per").forEach(function(btn){
    btn.addEventListener("click", function(){
      qsa(".fin-per").forEach(function(b){ b.classList.remove("active"); });
      btn.classList.add("active"); _finPer = btn.dataset.per;
      if (_finPer === "cal"){
        var fc = qs("#finCalFecha");
        if (fc && !fc.value){
          var hoy = new Date(); 
          fc.value = hoy.getFullYear()+"-"+("0"+(hoy.getMonth()+1)).slice(-2)+"-"+("0"+hoy.getDate()).slice(-2);
        }
      }
      renderFinanzas();
    });
  });
  var _calInput = qs("#finCalFecha");
  if (_calInput) _calInput.addEventListener("change", function(){ _finPer="cal"; renderFinanzas(); });

  on("btnFinGuardar", "click", async function(){
    if (!db){ toast("Conecta Firebase primero"); return; }
    if (!(await pedirVerificacionPropietario("registrar un ingreso o egreso"))) return;
    var monto = Number(qs("#finMonto").value);
    var desc  = qs("#finDesc").value.trim();
    var tipo  = qs("#finTipoReg").value;
    if (!monto || monto <= 0){ toast("Ingresa un monto válido"); return; }
    var data = { tipo:tipo, monto:monto, descripcion:desc||tipo, fecha:new Date().toISOString() };
    db.collection("tiendas").doc(STORE_ID).collection("registros_diarios").add(data)
      .then(function(){ toast("✅ Registro guardado"); qs("#finMonto").value=""; qs("#finDesc").value=""; _renderRegistrosFinanzas(); })
      .catch(function(e){ toast("Error: "+e.message); });
  });

  /* ── TAB INVENTARIO ───────────────────────────────────────── */
  function renderInventario(){
    var prods = state.productos || [];
    var alertMin = Number(state.config.invAlertMin) || 5;
    var inv = qs("#invLista");
    var alDiv = qs("#invAlertas");
    if (!inv) return;

    inv.innerHTML = prods.length ? prods.map(function(p){
      var stock = Number(p.stock);
      var esInf = isNaN(stock) || p.stock == null || p.stock === "";
      var badge = esInf ? "" : (stock===0?'<span class="inv-badge out">SIN STOCK</span>'
        : (stock<=alertMin?'<span class="inv-badge low">BAJO</span>'
        : '<span class="inv-badge ok">OK</span>'));
      return '<div class="inv-item">'
        +'<div class="inv-nombre">'+esc(p.nombre)+'<br>'+badge+'</div>'
        +'<div class="inv-stock">'
        +'<button class="inv-btn" data-inv-dec="'+p.id+'">−</button>'
        +'<span class="inv-num" id="invN-'+p.id+'">'+(esInf?"∞":stock)+'</span>'
        +'<button class="inv-btn" data-inv-inc="'+p.id+'">＋</button>'
        +'<button class="inv-btn inv-inf-btn" data-inv-inf="'+p.id+'" title="Sin límite (∞)" style="font-size:13px;'+(esInf?'border-color:var(--rojo);color:var(--rojo)':'')+'">∞</button>'
        +'</div></div>';
    }).join("") : '<p class="pnota">Sin productos todavía.</p>';

    /* Alertas */
    if (alDiv){
      var bajos = prods.filter(function(p){ var s=Number(p.stock); return !isNaN(s)&&p.stock!=null&&s<=alertMin&&s>0; });
      var agotados = prods.filter(function(p){ return Number(p.stock)===0&&p.stock!=null; });
      alDiv.innerHTML = "";
      agotados.forEach(function(p){ alDiv.innerHTML += '<div class="inv-alerta">🔴 <strong>'+esc(p.nombre)+'</strong> — Sin stock</div>'; });
      bajos.forEach(function(p){   alDiv.innerHTML += '<div class="inv-alerta">🟡 <strong>'+esc(p.nombre)+'</strong> — Solo '+p.stock+' unidades</div>'; });
      if (!agotados.length && !bajos.length) alDiv.innerHTML = '<p class="pnota" style="margin:0">✅ Todo el stock está bien.</p>';
    }

    if (qs("#invAlertMin")) qs("#invAlertMin").value = alertMin;

    /* Delegated +/- y edición directa — listener en contenedor padre, no en inv (evita duplicados) */
    inv._listenOk = true;
  }

  /* Listener delegado de inventario — se registra UNA SOLA VEZ */
  on("invLista", "click", function(e){
    var dec = e.target.closest("[data-inv-dec]");
    var inc = e.target.closest("[data-inv-inc]");
    var inf = e.target.closest("[data-inv-inf]");
    /* Botón ∞ — vuelve a stock ilimitado */
    if (inf){
      var pid0 = inf.dataset.invInf;
      var prod0 = (state.productos||[]).find(function(x){ return x.id===pid0; });
      if (!prod0) return;
      prod0.stock = null;
      var el0 = document.getElementById("invN-"+pid0);
      if (el0) el0.textContent = "∞";
      if (db) col("productos").doc(pid0).set({stock:null},{merge:true}).catch(function(){});
      if (window._renderInventario) window._renderInventario();
      toast("∞ Stock ilimitado");
      return;
    }
    var pid = dec ? dec.dataset.invDec : (inc ? inc.dataset.invInc : null);
    if (!pid) return;
    var prod = (state.productos||[]).find(function(x){ return x.id===pid; });
    if (!prod) return;
    var cur = prod.stock==null||prod.stock===""?null:Number(prod.stock);
    if (cur===null) cur=99;
    var nuevo = dec ? Math.max(0,cur-1) : cur+1;
    prod.stock=nuevo;
    var el=document.getElementById("invN-"+pid);
    if (el){ el.textContent=nuevo; el.style.color=nuevo===0?"#9B1B30":nuevo<=5?"#B26A00":"var(--texto)"; }
    if (db) col("productos").doc(pid).set({stock:nuevo},{merge:true}).catch(function(){});
    if (window._renderInventario) window._renderInventario();
  });

  /* Edición directa del número al tocarlo */
  on("invLista", "dblclick", function(e){
    var span = e.target.closest(".inv-num");
    if (!span || !span.id) return;
    var pid = span.id.replace("invN-","");
    var prod = (state.productos||[]).find(function(x){ return x.id===pid; });
    if (!prod) return;
    var cur = prod.stock==null||prod.stock===""?"":Number(prod.stock);
    var inp = document.createElement("input");
    inp.type="number"; inp.inputMode="numeric";
    inp.value=isNaN(cur)?"":cur;
    inp.style.cssText="width:52px;text-align:center;font-size:14px;font-weight:900;border:1.5px solid var(--rojo);border-radius:8px;padding:2px 4px;";
    span.replaceWith(inp);
    inp.focus(); inp.select();
    function guardar(){
      var v=Math.max(0,Number(inp.value)||0);
      prod.stock=v;
      var nsp=document.createElement("span");
      nsp.className="inv-num"; nsp.id="invN-"+pid;
      nsp.textContent=v; nsp.style.color=v===0?"#9B1B30":v<=5?"#B26A00":"var(--texto)";
      inp.replaceWith(nsp);
      if (db) col("productos").doc(pid).set({stock:v},{merge:true}).catch(function(){});
      if (window._renderInventario) window._renderInventario();
    }
    inp.addEventListener("blur",guardar);
    inp.addEventListener("keydown",function(ev){ if(ev.key==="Enter"){ev.preventDefault();guardar();} });
  });

  on("btnInvGuardar", "click", function(){
    var min = Number(qs("#invAlertMin").value);
    if (!min || min < 1) return;
    saveConfig("invAlertMin", min);
    toast("✅ Alerta configurada en " + min + " unidades");
    renderInventario();
  });

  window._renderFinanzas  = renderFinanzas;
  window._renderInventario = renderInventario;
  qsa(".ptab").forEach(t => t.addEventListener("click", () => {
    qsa(".ptab").forEach(x => x.classList.toggle("active", x === t));
    qsa(".psec").forEach(s => s.classList.toggle("active", s.id === "pt-" + t.dataset.pt));
  }));

  /* — Tab Tienda + Checkout & WhatsApp: campos → config — */
  const bindCfg = (id, field, tipo) => {
    const el = qs("#" + id);
    el.addEventListener("change", () => {
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (tipo === "num") v = Number(el.value) || 0;
      if (tipo === "trim") v = String(el.value).trim();
      saveConfig(field, v);
    });
  };
  bindCfg("pNombre", "nombre", "trim");
  bindCfg("pTagline", "tagline", "trim");
  /* Rubro: no usa bindCfg genérico porque, además de guardar el rubro
     en sí, tiene que decidir si actualiza colorPrimario a la paleta
     sugerida — solo si el color actual coincide EXACTAMENTE con el de
     algún rubro (es decir, nunca se tocó a mano; las chances de que
     alguien elija a mano un hex idéntico al de una paleta son
     prácticamente nulas). Si el vendedor ya personalizó su color, se
     conserva su elección — cambiar de rubro no debe pisarla. */
  const selRubroEl = qs("#pRubro");
  if (selRubroEl) selRubroEl.addEventListener("change", async () => {
    const nuevoRubro = selRubroEl.value;
    const colorActual = (state.config.colorPrimario || "").toLowerCase();
    const esColorPorDefectoDeAlgunRubro = RUBROS_PLANOS.some(r => r.colorPrimario.toLowerCase() === colorActual);
    await saveConfig("subrubro", nuevoRubro);
    if (esColorPorDefectoDeAlgunRubro){
      const nuevaPaleta = rubroPorId(nuevoRubro);
      await saveConfig("colorPrimario", nuevaPaleta.colorPrimario);
      const pColorEl = qs("#pColor");
      if (pColorEl) pColorEl.value = nuevaPaleta.colorPrimario;
      const pColorHexEl = qs("#pColorHex");
      if (pColorHexEl) pColorHexEl.value = nuevaPaleta.colorPrimario.replace("#","").toUpperCase();
      toast("Rubro y color de marca actualizados");
    } else {
      toast("Rubro actualizado — se conservó tu color personalizado");
    }
  });
  bindCfg("pAbierto", "abierto");
  bindCfg("pWhats", "whatsapp", "trim");
  bindCfg("pDelCosto", "deliveryCosto", "num");
  bindCfg("pDelMin", "deliveryMinimo", "num");
  bindCfg("pTiempo", "tiempoEntrega", "trim");
  bindCfg("pDeliveryOn", "deliveryActivo");
  bindCfg("pRetiroOn", "retiroActivo");
  bindCfg("pConfTitulo", "confTitulo", "trim");
  bindCfg("pConfSub", "confSub", "trim");
  bindCfg("pTl1", "timeline1", "trim");
  bindCfg("pTl2", "timeline2", "trim");
  bindCfg("pTl3", "timeline3", "trim");
  bindCfg("pTl4", "timeline4", "trim");
  bindCfg("pMostrarGPS", "mostrarGPS");

  const _btnLogo = qs("#btnLogo");
  if (_btnLogo) _btnLogo.addEventListener("click", function(){
    abrirImgModal({ col:"config", doc:"general", field:"logoBase64" });
  });
  var _btnEmail = qs("#btnGuardarEmail");
  if (_btnEmail) _btnEmail.addEventListener("click", function(){
    var em = (qs("#pEmailNotif").value || "").trim();
    if (!em || !em.includes("@")){ toast("Ingresa un email válido"); return; }
    saveConfigPrivado("emailVendedor", em);
    saveConfigPrivado("emailNotif", em); /* espejo legacy */
    var evEl = qs("#pEmailVendedor"); if (evEl) evEl.value = em;
    toast("✅ Email guardado: " + em);
  });
  on("btnProbarWa", "click", () => {
    const num = String(qs("#pWhats").value || state.config.whatsapp || "").replace(/\D/g, "");
    if (num.length < 8 || state.config.whatsapp === "CONFIGURAR_WHATSAPP" && !qs("#pWhats").value.trim()){
      toast("Escribe primero el número en formato 569XXXXXXXX");
      return;
    }
    window.open("https://wa.me/" + num, "_blank", "noopener");
  });

  /* ── Tab Zonas ─────────────────────────────────────────────── */
  function renderZonas(){
    const lista = qs("#zonasList");
    const nota  = qs("#zonasEmptyNote");
    if (!lista) return;
    const zonas = state.config.zonas || [];
    nota.style.display = zonas.length ? "none" : "block";
    lista.innerHTML = zonas.map(function(z, i){
      return '<div class="zona-card" data-zi="' + i + '">'
        + '<div class="zona-card-head">'
        +   '<input class="field z-nombre" placeholder="Nombre zona (ej: Centro)" value="' + esc(z.nombre||"") + '" data-zi="' + i + '">'
        +   '<button class="zona-del" data-zi="' + i + '" title="Eliminar zona">🗑</button>'
        + '</div>'
        + '<label class="plabel" style="margin-top:0;font-size:11.5px">Comunas (separar con coma)</label>'
        + '<input class="field z-comunas" placeholder="Ej: Providencia, Ñuñoa, Las Condes" value="' + esc(z.comunas||"") + '" data-zi="' + i + '">'
        + '<div class="zona-row2">'
        +   '<div><label class="plabel">Costo delivery $</label>'
        +       '<input class="field z-costo" type="number" inputmode="numeric" value="' + (Number(z.costo)||0) + '" data-zi="' + i + '"></div>'
        +   '<div><label class="plabel">Mínimo delivery gratis $</label>'
        +       '<input class="field z-min" type="number" inputmode="numeric" value="' + (Number(z.minGratis)||0) + '" data-zi="' + i + '" placeholder="0 = sin mínimo"></div>'
        + '</div>'
      + '</div>';
    }).join("");

    lista.querySelectorAll(".zona-del").forEach(function(btn){
      btn.addEventListener("click", function(){
        var idx = Number(btn.dataset.zi);
        var zs  = (state.config.zonas || []).filter(function(_,j){return j!==idx;});
        state.config.zonas = zs;
        saveConfig("zonas", zs);
        renderZonas();
        renderCheckout();
        toast("Zona eliminada");
      });
    });

    lista.querySelectorAll(".z-nombre,.z-comunas,.z-costo,.z-min").forEach(function(el){
      el.addEventListener("change", function(){ _guardarZonas(); });
    });
  }

  function _guardarZonas(){
    var lista = qs("#zonasList");
    if (!lista) return;
    var zonas = (state.config.zonas || []).map(function(_, i){
      return {
        nombre:    (lista.querySelector(".z-nombre[data-zi='" + i + "']")  || {value:""}).value.trim(),
        comunas:   (lista.querySelector(".z-comunas[data-zi='" + i + "']") || {value:""}).value.trim(),
        costo:     Number((lista.querySelector(".z-costo[data-zi='" + i + "']") || {value:0}).value) || 0,
        minGratis: Number((lista.querySelector(".z-min[data-zi='" + i + "']")   || {value:0}).value) || 0
      };
    });
    state.config.zonas = zonas;
    saveConfig("zonas", zonas);
    if (_comunaActual) _detectarZona(_comunaActual);
    renderCheckout();
  }

  on("btnNuevaZona", "click", function(){
    var zs = state.config.zonas || [];
    zs.push({ nombre: "Zona " + (zs.length + 1), comunas: "", costo: 2000, minGratis: 0 });
    state.config.zonas = zs;
    saveConfig("zonas", zs);
    renderZonas();
  });

  /* Render inicial + exponer para fillPanel */
  renderZonas();
  window._renderZonas = renderZonas;

  /* ── Mensajes automáticos: guardar + preview en vivo + pills de variables — */
  Object.keys(MKEY_FIELD).forEach(id => {
    const ta = qs("#" + id);
    ta.addEventListener("input", actualizarPreviews);
    ta.addEventListener("change", () => saveConfig(MKEY_FIELD[id], ta.value));
  });
  qsa(".varpills").forEach(cont => {
    cont.innerHTML = VARIABLES_MSJ.map(v => `<button type="button" class="vpill">${esc(v)}</button>`).join("");
    cont.addEventListener("click", e => {
      const b = e.target.closest(".vpill");
      if (!b) return;
      const ta = qs("#" + cont.dataset.for);
      const v = b.textContent;
      const start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
      const end   = ta.selectionEnd   != null ? ta.selectionEnd   : start;
      ta.value = ta.value.slice(0, start) + v + ta.value.slice(end);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + v.length;
      actualizarPreviews();
      saveConfig(MKEY_FIELD[ta.id], ta.value);
    });
  });
  on("btnRestaurarMsjs", "click", async () => {
    if (!confirm("¿Restaurar los 4 mensajes por defecto?")) return;
    await saveConfig("msjConfirmacion", MENSAJES_DEFAULT.confirmacion);
    await saveConfig("msjPreparacion",  MENSAJES_DEFAULT.preparacion);
    await saveConfig("msjCamino",       MENSAJES_DEFAULT.camino);
    await saveConfig("msjListo",        MENSAJES_DEFAULT.listo);
    fillPanel(true);
    toast("Mensajes restaurados");
  });

  /* — Tab Productos — */
  on("btnNuevoProd", "click", async () => {
    const max = state.productos.reduce((m, p) => Math.max(m, p.orden || 0), 0);
    const id = await crearDoc("productos", {
      nombre: "Nuevo producto", precio: 0, descripcion: "",
      categoria: "Hamburguesas", imagen: DEMO_IMAGES.burger1,
      activo: true, orden: max + 1
    });
    if (id){ openProdId = id; renderPanelProds(); }
  });
  /* ═══ Handlers de gestión de categorías ═══ */
  const catListaAdmin = document.getElementById("catListaAdmin");
  if (catListaAdmin && !catListaAdmin._listenerOk){
    catListaAdmin._listenerOk = true;
    catListaAdmin.addEventListener("click", async e => {
      const btnEdit = e.target.closest("[data-cat-edit]");
      const btnDel = e.target.closest("[data-cat-del]");
      if (btnEdit){ abrirEditarCat(btnEdit.dataset.catEdit); return; }
      if (btnDel){
        const cat = btnDel.dataset.catDel;
        const ok = await eliminarCategoria(cat);
        if (ok) renderPanelCats();
        return;
      }
    });
  }
  const btnNuevaCatAdmin = document.getElementById("btnNuevaCatAdmin");
  if (btnNuevaCatAdmin && !btnNuevaCatAdmin._listenerOk){
    btnNuevaCatAdmin._listenerOk = true;
    btnNuevaCatAdmin.addEventListener("click", abrirNuevaCatAdmin);
  }

  on("panelProds", "click", e => {
    const img = e.target.closest("[data-imgprod]");
    if (img){ abrirImgModal({ col:"productos", doc: img.dataset.imgprod, field:"imagen" }); return; }
    const b = e.target.closest(".ibtn, [data-a='addvariante']");
    if (!b) return;
    const pid = b.dataset.pid;
    if (b.dataset.a === "edit"){ openProdId = openProdId === pid ? null : pid; renderPanelProds(); }
    else if (b.dataset.a === "up") moverProd(pid, -1);
    else if (b.dataset.a === "down") moverProd(pid, 1);
    else if (b.dataset.a === "del"){
      if (confirm("¿Eliminar este producto?")){ if (openProdId === pid) openProdId = null; borrarDoc("productos", pid); }
    }
    else if (b.dataset.a === "addvariante") agregarGrupoVariante(pid);
    else if (b.dataset.a === "delvariante") quitarGrupoVariante(pid, Number(b.dataset.vidx));
  });
  on("panelProds", "change", e => {
    const elVar = e.target.closest(".pe-variante");
    if (elVar){
      actualizarCampoVariante(elVar.dataset.pid, Number(elVar.dataset.vidx), elVar.dataset.vcampo, elVar.value);
      return;
    }
    const el = e.target.closest(".pe");
    if (!el) return;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.dataset.pf === "precio") v = Number(el.value) || 0;
    const camposQueRerenderizan = ["variantesActivas", "permitePersonalizacion", "activo"];
    if (el.dataset.pf === "categoria" && v === "__nueva__"){
      abrirInputNuevaCategoria(el);
      return;
    }
    saveField("productos", el.dataset.pid, el.dataset.pf, v).then(() => {
      if (camposQueRerenderizan.includes(el.dataset.pf)){
        el.blur();
        renderPanelProds();
      }
    });
  });

  /* — Tab Pagos — */
  on("btnEyeToken", "click", () => {
    const t = qs("#mpToken");
    const oculto = t.style.webkitTextSecurity === "disc" || t.style.webkitTextSecurity === "";
    t.style.webkitTextSecurity = oculto ? "none" : "disc";
    t.style.textSecurity        = oculto ? "none" : "disc";
  });
  on("btnGuardarMP", "click", async () => {
    const v = qs("#mpToken").value.trim();
    if (!v){
      qs("#mpEstado").textContent = "❌ Token inválido";
      return;
    }
    /* El token va al doc PRIVADO; mpActivo (flag público) se actualiza en
       la misma acción para que el checkout sepa mostrar MercadoPago sin
       que ningún comprador anónimo necesite leer el token en sí. */
    const ok = await saveConfigPrivado("mpToken", v);
    if (ok) await saveConfig("mpActivo", true);
    renderMpEstado();
    toast(DEMO ? "💳 Demo: token guardado en esta sesión" : "💳 Token guardado — la validación real ocurre en el backend");
  });

  /* — Backend: FUNCTIONS_URL + verificación /ping — */
  const _fUrl = qs("#pFunctionsUrl");
  if (_fUrl) _fUrl.addEventListener("change", function(){
    saveConfig("functionsUrl", _fUrl.value.trim().replace(/\/+$/, ""));
  });
  const _btnFn = qs("#btnVerificarFn");
  if (_btnFn) _btnFn.addEventListener("click", async function(){
    const est = qs("#fnEstado");
    if (_fUrl && _fUrl.value.trim()) await saveConfig("functionsUrl", _fUrl.value.trim().replace(/\/+$/, ""));
    if (!functionsListas()){ if (est) est.textContent = "⚠️ Pega primero la URL de tus Functions"; return; }
    if (est) est.textContent = "⏳ Verificando…";
    try {
      const r = await fetch(functionsURL() + "/ping");
      if (est) est.textContent = r.ok ? "✅ Backend conectado" : "❌ Respondió HTTP " + r.status;
    } catch(e){
      if (est) est.textContent = "❌ Sin conexión — revisa la URL y el deploy";
    }
  });

  /* — Tab Emails (Resend) — */
  const _btnEyeR = qs("#btnEyeResend");
  if (_btnEyeR) _btnEyeR.addEventListener("click", () => {
    const t = qs("#pResendKey");
    const oculto = t.style.webkitTextSecurity === "disc" || t.style.webkitTextSecurity === "";
    t.style.webkitTextSecurity = oculto ? "none" : "disc";
    t.style.textSecurity        = oculto ? "none" : "disc";
  });
  const _btnGE = qs("#btnGuardarEmails");
  if (_btnGE) _btnGE.addEventListener("click", async function(){
    const est = qs("#emailEstado");
    await saveConfigPrivado("resendApiKey", (qs("#pResendKey").value || "").trim());
    await saveConfigPrivado("emailEmisor", (qs("#pEmailEmisor").value || "").trim());
    const vend = (qs("#pEmailVendedor").value || "").trim();
    await saveConfigPrivado("emailVendedor", vend);
    await saveConfigPrivado("emailNotif", vend); /* espejo legacy */
    if (est) est.textContent = "✅ Configuración guardada";
    toast("📧 Configuración de emails guardada");
  });
  const _btnEP = qs("#btnEmailPrueba");
  if (_btnEP) _btnEP.addEventListener("click", async function(){
    const est = qs("#emailEstado");
    const cfg  = state.config || {};
    const cfgP = state.configPrivado || {};
    if (!functionsListas()){ if (est) est.textContent = "⚠️ Configura FUNCTIONS_URL en el tab Pagos"; return; }
    if (!cfgP.resendApiKey){ if (est) est.textContent = "⚠️ Guarda primero tu Resend API Key"; return; }
    if (est) est.textContent = "⏳ Enviando email de prueba…";
    const pedidoDemo = {
      id: "TB00000",
      fecha: new Date().toISOString(),
      estado: "nuevo",
      total: 12980, subtotal: 10990, descuento: 0, costoDelivery: 1990,
      cuponAplicado: null, tipo: "delivery", metodoPago: "efectivo",
      items: [{ id: "demo", nombre: "Pedido de prueba", cantidad: 1, precio: 10990 }],
      cliente: { nombre: "Cliente de prueba", telefono: "+56912345678",
        email: cfgP.emailVendedor || cfgP.emailNotif || "", direccion: "Dirección de prueba 123",
        comuna: "", referencias: "", notas: "Email de prueba desde devmode", uid: null },
      estadoTimeline: { nuevo: new Date().toISOString(), preparacion: null, camino: null, listo: null }
    };
    try {
      /* Ya NO se manda resendApiKey/emailEmisor/emailVendedor en el body —
         enviarEmails.js los resuelve internamente con getStoreConfig(). */
      const r = await fetch(functionsURL() + "/enviarEmails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: STORE_ID, pedido: pedidoDemo,
          nombreTienda: cfg.nombre || "TEST BURGERS",
          urlTienda: location.origin
        })
      });
      if (est) est.textContent = r.ok ? "✅ Email de prueba enviado — revisa tu bandeja"
                                      : "❌ El backend respondió HTTP " + r.status;
    } catch(e){
      if (est) est.textContent = "❌ No se pudo enviar — revisa FUNCTIONS_URL y la API key";
    }
  });

  /* — Tab Notificaciones — */
  on("btnActivarNotif", "click", activarNotificaciones);
  on("devicesList", "click", e => {
    const b = e.target.closest(".btn-quitar");
    if (!b) return;
    const nombre = b.closest(".device-row")?.querySelector("span")?.firstChild?.textContent?.trim() || "este dispositivo";
    const confirmar = confirm(
      "⚠️ ¿Quitar notificaciones de " + nombre + "?\n\n" +
      "Si lo quitas por error, tendrás que volver a activar las notificaciones desde ese dispositivo.\n\n" +
      "¿Estás seguro?"
    );
    if (!confirmar) return;
    borrarDoc("dispositivos", b.dataset.did);
    setTimeout(renderPanelNotif, 50);
    toast("🔕 Dispositivo eliminado");
  });

  /* — Tab Config — */
  const pc = qs("#pColor");
  const pcHex = qs("#pColorHex");

  function _setColor(hex){
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
    pc.value = hex;
    if (pcHex) pcHex.value = hex.replace("#","").toUpperCase();
    state.config.colorPrimario = hex;
    document.documentElement.style.setProperty("--rojo", hex);
    document.documentElement.style.setProperty("--rojo-h", hex);
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    if (!isNaN(r)) document.documentElement.style.setProperty("--sombra","rgba("+r+","+g+","+b+",0.15)");
    saveConfig("colorPrimario", hex);
  }

  /* Sincronizar hex input cuando el picker nativo cambia */
  pc.addEventListener("input", () => {
    if (pcHex) pcHex.value = pc.value.replace("#","").toUpperCase();
    _setColor(pc.value);
  });
  pc.addEventListener("change", () => saveConfig("colorPrimario", pc.value));

  /* Botón Aplicar desde hex */
  on("btnAplicarColor", "click", () => {
    var raw = (pcHex.value || "").trim().replace(/^#/,"");
    if (raw.length === 3) raw = raw.split("").map(c=>c+c).join(""); /* expandir shorthand */
    if (raw.length === 6 && /^[0-9A-Fa-f]{6}$/.test(raw)){
      _setColor("#" + raw.toUpperCase());
      toast("✅ Color aplicado");
    } else {
      toast("⚠️ Escribe un código hex válido (6 caracteres, ej: 9B1B30)");
      pcHex.focus();
    }
  });

  /* Enter en el campo hex también aplica */
  pcHex.addEventListener("keydown", e => {
    if (e.key === "Enter"){ e.preventDefault(); qs("#btnAplicarColor").click(); }
  });

  /* Sincronizar hex al abrir el panel */
  const _initHex = () => { if (pcHex && pc) pcHex.value = pc.value.replace("#","").toUpperCase(); };
  _initHex();
  on("btnPreview", "click", () => {
    document.body.classList.add("preview-cliente");
    qs("#adminPanel").classList.remove("open");
    toast("👁 Vista previa cliente — toca el botón para volver a editar");
  });
}

/* — Exportar HTML con snapshot embebido — */
function exportarHTML(){
  const clone = document.documentElement.cloneNode(true);
  const body = clone.querySelector("body");
  body.classList.remove("dev-on", "preview-cliente", "cerrada");
  body.dataset.page = "inicio";
  clone.querySelectorAll(".open").forEach(el => el.classList.remove("open"));
  clone.querySelectorAll(".show").forEach(el => el.classList.remove("show"));
  clone.querySelectorAll(".editing").forEach(el => { el.classList.remove("editing"); el.removeAttribute("contenteditable"); });
  const viejo = clone.querySelector("#snapshot-data");
  if (viejo) viejo.remove();
  const snap = {
    config: state.config,
    productos: state.productos,
    cupones: state.cupones,
    locales: state.locales
  };
  const sc = clone.ownerDocument.createElement("script");
  sc.type = "application/json";
  sc.id = "snapshot-data";
  sc.textContent = JSON.stringify(snap).replace(/</g, "\\u003c");
  body.insertBefore(sc, body.firstChild);
  const html = "<!DOCTYPE html>\n" + clone.outerHTML;
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "index-snapshot.html";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast("📦 index-snapshot.html descargado");
}

/* SERVICE WORKER */
/* ════════════════════════════════════════════════════════════════
   SERVICE WORKER — inline como blob URL
   ════════════════════════════════════════════════════════════════ */
const SW_CODE = [
'self.addEventListener("push", function(e){',
'  var d = {};',
'  try { d = e.data.json(); } catch(err){ d = { title:"🍔 Nuevo pedido", body: e.data ? e.data.text() : "" }; }',
'  e.waitUntil(self.registration.showNotification(d.title || "🍔 Nuevo pedido", {',
'    body: d.body || "", icon: "/icon-192.png", requireInteraction: true,',
'    tag: "nuevo-pedido",',
'    data: { url: d.url || (self.location.origin + "/pedidos.html") }',
'  }));',
'});',
'self.addEventListener("notificationclick", function(e){',
'  e.notification.close();',
'  var url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : (self.location.origin + "/pedidos.html");',
'  e.waitUntil(',
'    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){',
'      /* 1) Si ya hay una pestaña abierta en /pedidos.html → traerla al frente */',
'      for (var i = 0; i < list.length; i++){',
'        var c = list[i];',
'        if (c.url.indexOf("/pedidos.html") !== -1 && "focus" in c){ return c.focus(); }',
'      }',
'      /* 2) Si hay otra pestaña del sitio → enfocar y navegar a /pedidos.html */',
'      for (var j = 0; j < list.length; j++){',
'        var c2 = list[j];',
'        if (c2.url.indexOf(self.location.origin) === 0 && "focus" in c2){',
'          return c2.focus().then(function(fc){ return fc.navigate(url); });',
'        }',
'      }',
'      /* 3) Nada abierto → abrir /pedidos */',
'      return clients.openWindow(url);',
'    })',
'  );',
'});'
].join("\n");

let swRegistration = null;
async function registrarSW(){
  if (!("serviceWorker" in navigator)) return null;
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js");
    return swRegistration;
  } catch(e){
    console.warn("No se pudo registrar /sw.js:", e);
    return null;
  }
}

/* NOTIFICACIONES PUSH */
/* ════════════════════════════════════════════════════════════════
   NOTIFICACIONES PUSH — al vendedor
   ════════════════════════════════════════════════════════════════ */
function urlBase64ToUint8Array(base64String){
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function nombreDispositivo(){
  const ua = navigator.userAgent;
  const nav = /Edg/i.test(ua) ? "Edge" : /Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : "Navegador";
  const so = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : "";
  /* Incluir el dominio es clave cuando el mismo Firebase se comparte
     entre varios proyectos de Netlify (por ejemplo un proyecto viejo
     de pruebas y el actual) — sin esto, dos dispositivos activados
     desde distintos dominios se ven idénticos en la lista ("Chrome
     Android" x2), y no hay forma de saber cuál borrar. */
  return (nav + " " + so).trim() + " — " + location.hostname;
}

async function activarNotificaciones(){
  if (state.dispositivos.length >= 5){ toast("Máximo 5 dispositivos — quita uno primero"); return; }
  const estado = qs("#notifEstado");

  if (DEMO){
    state.dispositivos.push({ id: "d" + Date.now(), dispositivo: nombreDispositivo(), activadoEn: new Date().toISOString() });
    estado.textContent = "✅ Este dispositivo recibirá alertas de nuevos pedidos";
    renderPanelNotif();
    toast("🔔 Demo: dispositivo registrado en esta sesión");
    return;
  }
  try {
    if (!("Notification" in window)){ estado.textContent = "❌ Este navegador no soporta notificaciones"; return; }
    if (VAPID_KEY === "PEGAR_VAPID_KEY"){ estado.textContent = "⚠️ Configura VAPID_KEY en el bloque de configuración"; return; }
    const permission = await Notification.requestPermission();
    if (permission !== "granted"){ estado.textContent = "❌ Permiso de notificaciones denegado"; return; }
    const reg = swRegistration || await registrarSW();
    if (!reg){ estado.textContent = "❌ Sin Service Worker — sube sw.js aparte (ver consola)"; return; }
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY)
    });
    const idDoc = (btoa(JSON.stringify(subscription)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 60)) || ("d" + Date.now());
    await col("dispositivos").doc(idDoc).set({
      subscription: JSON.stringify(subscription),
      activadoEn: new Date().toISOString(),
      dispositivo: nombreDispositivo()
    });
    estado.textContent = "✅ Este dispositivo recibirá alertas de nuevos pedidos";
  } catch(e){
    console.error(e);
    estado.textContent = "❌ No se pudo activar: " + (e.message || e);
  }
}

function diasDesde(iso){
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (isNaN(d) || d <= 0) return "hoy";
  if (d === 1) return "hace 1 día";
  return "hace " + d + " días";
}
function renderPanelNotif(){
  const wrap = qs("#devicesList");
  if (!wrap) return;
  wrap.innerHTML = state.dispositivos.length ? state.dispositivos.map(d => {
    /* El nombre incluye el dominio desde donde se activó (ver
       nombreDispositivo()) — si coincide con el dominio actual, se
       marca "Este dispositivo" para que sea inconfundible cuál es el
       de este proyecto y cuáles son de otros (p.ej. un proyecto viejo
       que comparte el mismo Firebase). Dispositivos activados antes
       de este cambio no van a tener el dominio en el nombre, y por
       lo tanto tampoco esta marca — se pueden identificar igual por
       fecha de activación. */
    const esEsteDominio = !!location.hostname && (d.dispositivo || "").indexOf(location.hostname) !== -1;
    return `
    <div class="device-row">
      <span>📱 ${esc(d.dispositivo || "Dispositivo")}${esEsteDominio ? ' <b style="color:var(--verde)">· Este dispositivo</b>' : ''}<small>activado ${esc(diasDesde(d.activadoEn))}</small></span>
      <button class="btn-quitar" data-did="${esc(d.id)}">Quitar</button>
    </div>`;
  }).join("") : '<p class="pnota">Ningún dispositivo registrado todavía.</p>';
}

/* ════════════════════════════════════════════════════════════════
   ARRANQUE
   ════════════════════════════════════════════════════════════════ */
function mensajeDemo(){
  console.log(
"%c🍔 " + (state.config.nombre || "TEST BURGERS") + " — MODO DEMO","font-size:15px;font-weight:bold;color:#9B1B30");
  console.log(
"Para conectar la tienda real:\n" +
"1) Crea un proyecto en firebase.google.com y pega FIREBASE_CONFIG arriba en este archivo.\n" +
"2) Activa Firestore y pega las reglas comentadas al final del archivo.\n" +
"3) Authentication → Sign-in method → Email/Password → Add user (tu acceso al modo dev).\n" +
"4) Activa Storage (para subir imágenes desde el panel).\n" +
"5) Despliega las Firebase Functions comentadas al final (MercadoPago + push + WhatsApp) y pega FUNCTIONS_URL.\n" +
"6) Cloud Messaging → Web Push certificates → pega VAPID_KEY.\n" +
"Mientras tanto, todo funciona como demo: pagos simulados y cambios guardados solo en esta sesión.");
}

function estadoDesdeSnapshot(s){
  state.config    = Object.assign({}, DEMO_DATA.config, s.config || {});
  state.productos = normalizarOrden(Array.isArray(s.productos) ? s.productos : []);
  state.cupones   = Array.isArray(s.cupones) ? s.cupones : [];
  state.locales   = Array.isArray(s.locales) ? s.locales : [];
}

/* ════════════════════════════════════════════════════════════════
   PEDIDOS — PANEL VENDEDOR (pestaña 🛍 del devmode)
   ════════════════════════════════════════════════════════════════ */
let _pedidoAbierto = null;

function tiempoRel(iso){
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Ahora";
  if (m < 60) return "Hace " + m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return "Hace " + h + " h";
  return "Hace " + Math.floor(h / 24) + " d";
}

function badgeEstado(e){
  const n = normEstado(e);
  const map = { nuevo:"🟠 Nuevo", preparacion:"🔵 Preparando", camino:"🟣 En camino",
    listo:"🟢 Entregado", cancelado:"🔴 Cancelado", pendiente_pago:"⏳ Pago pendiente" };
  return map[n] || n;
}

function renderListaPedidos(arr){
  const lista = document.getElementById("pedLista");
  const cont  = document.getElementById("pedCont");
  if (!lista) return;
  if (!arr || !arr.length){
    lista.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0">Aún no hay pedidos.</p>';
    if (cont) cont.textContent = "";
    return;
  }
  if (cont) cont.textContent = arr.length + (arr.length === 1 ? " pedido" : " pedidos");
  const ESTADO_SIG = { nuevo:"preparacion", preparacion:"camino", camino:"listo" };
  lista.innerHTML = arr.map(function(p){
    const est = p.estado || "nuevo";
    const its = (p.items || []).map(function(i){ return i.cantidad + "x " + i.nombre; }).join(", ");
    const sig = ESTADO_SIG[est];
    const ESTADO_LBL = { nuevo:"▶ Iniciar", preparacion:"🚴 En camino", camino:"✅ Entregado" };
    const btnSig = sig
      ? '<button class="ped-avanzar pill pill-solid pill-sm" data-pid="'+esc(p.id)+'" data-est="'+sig+'" style="font-size:11px;padding:5px 10px;margin:0">'+ESTADO_LBL[est]+'</button>'
      : '<span style="font-size:11px;color:#2E7D32;font-weight:800">✓ Listo</span>';
    return '<div class="ped-card" data-pid="' + esc(p.id) + '">' +
      '<div class="ped-top"><span class="ped-id">#' + esc(p.id) + '</span><span class="ped-time">' + tiempoRel(p.fecha) + '</span>' +
      '<span class="ped-badge ' + est + '">' + badgeEstado(est) + '</span></div>' +
      '<div class="ped-nombre">' + esc((p.cliente && p.cliente.nombre) || "Cliente") + '</div>' +
      '<div class="ped-items">' + esc(its) + '</div>' +
      '<div class="ped-bottom"><span class="ped-total">' + fmtPrecio(p.total) + '</span>' +
      btnSig + '</div></div>';
  }).join("");
}

function escucharPedidos(){
  const lista = document.getElementById("pedLista");
  if (!db){
    if (lista) lista.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0">Conecta Firebase para ver pedidos.</p>';
    return;
  }
  db.collection("tiendas").doc(STORE_ID).collection("pedidos")
    .orderBy("fecha", "desc").limit(200)
    .onSnapshot(function(s){
      const arr = [];
      s.forEach(function(d){ arr.push(Object.assign({ id: d.id }, d.data())); });
      state.pedidos = arr;
      renderListaPedidos(arr.slice(0,50));
      if (window._renderFinanzas) window._renderFinanzas();
    }, function(e){ console.warn("escucharPedidos:", e); });
}

function abrirDetallePedido(id){
  if (!db) return;
  db.collection("tiendas").doc(STORE_ID).collection("pedidos").doc(id).get()
    .then(function(doc){
      if (!doc.exists){ toast("Pedido no encontrado"); return; }
      _pedidoAbierto = Object.assign({ id: doc.id }, doc.data());
      pintarDetallePedido(_pedidoAbierto);
      const m = document.getElementById("pedidoDetalle");
      if (m) m.classList.add("open");
    })
    .catch(function(e){ console.warn(e); toast("Error al abrir el pedido"); });
}

function pintarDetallePedido(p){
  const est = p.estado || "nuevo";
  function setTxt(id, txt){ const el = document.getElementById(id); if (el) el.textContent = txt; }
  setTxt("detId", "Pedido #" + p.id);
  setTxt("detFecha", new Date(p.fecha).toLocaleString("es-CL"));
  const b = document.getElementById("detBadge");
  if (b){ b.textContent = badgeEstado(est); b.className = "ped-badge " + est; }
  setTxt("detNombre", (p.cliente && p.cliente.nombre) || "—");
  setTxt("detTel", (p.cliente && p.cliente.telefono) || "—");
  setTxt("detTipo", p.tipo === "delivery" ? "🛵 Delivery" : "🏠 Retiro en local");
  const dir = (p.cliente && p.cliente.direccion) || "";
  const dw = document.getElementById("detDirWrap");
  if (dw){
    if (p.tipo === "delivery" && dir){
      dw.style.display = "block";
      setTxt("detDir", dir);
      const mapa = document.getElementById("detMapa");
      if (mapa) mapa.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(dir);
    } else {
      dw.style.display = "none";
    }
  }
  const items = document.getElementById("detItems");
  if (items) items.innerHTML = (p.items || []).map(function(i){
    return '<div class="det-row"><span class="det-lbl">' + i.cantidad + 'x ' + esc(i.nombre) + '</span>' +
      '<span class="det-val">' + fmtPrecio(i.precio * i.cantidad) + '</span></div>';
  }).join("");
  setTxt("detTotal", "Total: " + fmtPrecio(p.total));
  document.querySelectorAll(".est-btn").forEach(function(btn){
    btn.classList.toggle("active", btn.dataset.est === est);
  });
}

function cambiarEstadoPedido(nuevo){
  if (!_pedidoAbierto || !db) return;
  var upd = { estado: nuevo };
  if (["nuevo","preparacion","camino","listo"].indexOf(nuevo) !== -1){
    upd["estadoTimeline." + nuevo] = new Date().toISOString();
  }
  db.collection("tiendas").doc(STORE_ID).collection("pedidos").doc(_pedidoAbierto.id)
    .update(upd)
    .then(function(){
      _pedidoAbierto.estado = nuevo;
      pintarDetallePedido(_pedidoAbierto);
      toast("Estado → " + badgeEstado(nuevo));
    })
    .catch(function(e){ console.warn(e); toast("No se pudo actualizar el estado"); });
}

function initPedidosUI(){
  const cerrar = document.getElementById("btnCerrarDet");
  if (cerrar) cerrar.addEventListener("click", function(){
    const m = document.getElementById("pedidoDetalle");
    if (m) m.classList.remove("open");
    _pedidoAbierto = null;
  });
  const lista = document.getElementById("pedLista");
  if (lista) lista.addEventListener("click", function(e){
    /* Botón rápido de avanzar estado — no abre el detalle */
    const avanzar = e.target.closest(".ped-avanzar");
    if (avanzar){
      e.stopPropagation();
      var pid2 = avanzar.dataset.pid, est2 = avanzar.dataset.est;
      if (!db || !pid2) return;
      var upd2 = { estado: est2 };
      if (["nuevo","preparacion","camino","listo"].indexOf(est2) !== -1){
        upd2["estadoTimeline." + est2] = new Date().toISOString();
      }
      db.collection("tiendas").doc(STORE_ID).collection("pedidos").doc(pid2)
        .update(upd2)
        .then(function(){ toast("Estado → "+badgeEstado(est2)); })
        .catch(function(){ toast("Error al actualizar"); });
      return;
    }
    const card = e.target.closest(".ped-card");
    if (card && card.dataset.pid) abrirDetallePedido(card.dataset.pid);
  });
  document.querySelectorAll(".est-btn").forEach(function(btn){
    btn.addEventListener("click", function(){ cambiarEstadoPedido(btn.dataset.est); });
  });
  const w = document.getElementById("btnWspDet");
  if (w) w.addEventListener("click", function(){
    const p = _pedidoAbierto;
    if (!p) return;
    const tel = String((p.cliente && p.cliente.telefono) || "").replace(/\D/g, "");
    if (!tel){ toast("El pedido no tiene teléfono"); return; }
    const msg = "Hola " + ((p.cliente && p.cliente.nombre) || "") + "! Tu pedido #" + p.id +
      " está: " + badgeEstado(p.estado || "nuevo") + ". Total: " + fmtPrecio(p.total);
    window.open("https://wa.me/" + tel + "?text=" + encodeURIComponent(msg), "_blank");
  });
}

/* ════════════════════════════════════════════════════════════════
   MI CUENTA — LOGIN GOOGLE (clientes)
   ════════════════════════════════════════════════════════════════ */
let _unsubMisPedidos = null;

function initCuenta(){
  const g = document.getElementById("btnGoogleLogin");
  if (g) g.addEventListener("click", function(){
    if (!auth){ toast("Conecta Firebase para iniciar sesión"); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(function(e){
      console.warn("Google login:", e);
      if (e && e.code === "auth/unauthorized-domain"){
        toast("Agrega este dominio en Firebase → Authentication → Dominios autorizados");
      } else if (e && (e.code === "auth/popup-blocked" || e.code === "auth/cancelled-popup-request")){
        auth.signInWithRedirect(provider);
      } else {
        toast("No se pudo iniciar sesión");
      }
    });
  });
  const out = document.getElementById("btnCerrarSesionCliente");
  if (out) out.addEventListener("click", function(){ if (auth) auth.signOut(); });
  renderCuentaLogin();
  initCuentaSubTabs();
  initHistorial();
  initDirecciones();
  initDirModal();
}

function renderCuentaLogin(){
  const off  = document.getElementById("cuentaLoggedOut");
  const on   = document.getElementById("cuentaLoggedIn");
  const card = document.getElementById("cardPedidosCliente");
  const pts  = document.getElementById("cuentaPuntos");
  const lbl  = document.getElementById("cuentaPuntosLabel");
  if (!off || !on) return;
  if (clienteUser){
    off.style.display = "none";
    on.style.display = "block";
    const n = document.getElementById("cuentaNombre");
    const m = document.getElementById("cuentaEmail");
    const f = document.getElementById("cuentaFoto");
    if (n) n.textContent = clienteUser.displayName || "Cliente";
    if (m) m.textContent = clienteUser.email || "";
    if (f){
      if (clienteUser.photoURL){ f.src = clienteUser.photoURL; f.style.display = "block"; }
      else f.style.display = "none";
    }
    if (card) card.style.display = "block";
    if (lbl) lbl.textContent = "1 punto por cada $100 gastado";
  } else {
    off.style.display = "block";
    on.style.display = "none";
    if (card) card.style.display = "none";
    if (pts) pts.textContent = "—";
    if (lbl) lbl.textContent = "Inicia sesión para ver tu saldo";
    const ml = document.getElementById("misPedidosLista");
    if (ml) ml.innerHTML = "";
  }
}

function escucharMisPedidos(uid){
  if (!db || !uid) return;
  if (_unsubMisPedidos){ _unsubMisPedidos(); _unsubMisPedidos = null; }
  _unsubMisPedidos = db.collection("tiendas").doc(STORE_ID).collection("pedidos")
    .where("uid", "==", uid).limit(30)
    .onSnapshot(function(s){
      const arr = [];
      s.forEach(function(d){ arr.push(Object.assign({ id: d.id }, d.data())); });
      arr.sort(function(a, b){ return new Date(b.fecha) - new Date(a.fecha); });
      const ml = document.getElementById("misPedidosLista");
      if (ml){
        ml.innerHTML = arr.length ? arr.map(function(p){
          const est = p.estado || "nuevo";
          const its = (p.items || []).map(function(i){ return i.cantidad + "x " + i.nombre; }).join(", ");
          return '<div style="background:var(--crema);border-radius:12px;padding:12px;margin-bottom:10px;border-left:4px solid var(--rojo)">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
            '<span style="font-weight:900;font-size:12px;color:var(--rojo)">#' + esc(p.id) + '</span>' +
            '<span class="ped-badge ' + est + '">' + badgeEstado(est) + '</span></div>' +
            '<div style="font-size:12.5px;color:var(--muted);margin-bottom:6px;font-weight:600">' + esc(its) + '</div>' +
            '<div style="font-weight:900;font-size:14px">' + fmtPrecio(p.total) + '</div></div>';
        }).join("") : '<p style="color:var(--muted);font-size:13px;margin:0">Aún no tienes pedidos.</p>';
      }
      const activos = arr.filter(function(p){ return (p.estado || "nuevo") !== "cancelado"; });
      const pts = Math.floor(activos.reduce(function(s2, p){ return s2 + (Number(p.total) || 0); }, 0) / 100);
      const el = document.getElementById("cuentaPuntos");
      if (el) el.textContent = String(pts);
    }, function(e){ console.warn("escucharMisPedidos:", e); });
}

/* ══ Mi Cuenta — extensión: historial, direcciones, pagos ══ */
let _unsubHistorial   = null;
let _histFiltro       = "todos";
let _histTodos        = [];
let _dirLabel         = "Casa";

function colUsuario(uid, sub){ return db.collection("usuarios").doc(uid).collection(sub); }

function fmtFechaCorta(iso){
  var d = new Date(iso);
  return d.toLocaleDateString("es-CL",{day:"2-digit",month:"short"}) + " " +
         d.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
}

/* Sub-tabs */
function initCuentaSubTabs(){
  var tabs = document.getElementById("cuentaSubTabs");
  if (!tabs) return;
  tabs.querySelectorAll(".ctab").forEach(function(t){
    t.addEventListener("click", function(){
      tabs.querySelectorAll(".ctab").forEach(function(x){ x.classList.toggle("active", x===t); });
      ["ct-historial","ct-direcciones","ct-pagos"].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.style.display = (el.id === "ct-"+t.dataset.ct) ? "block" : "none";
      });
    });
  });
}

/* Historial */
function renderHistorial(arr){
  var filtrados = _histFiltro === "todos" ? arr
    : _histFiltro === "proceso" ? arr.filter(function(p){return["nuevo","preparando","camino"].includes(p.estado||"nuevo");})
    : arr.filter(function(p){return p.estado===_histFiltro;});
  var lista = document.getElementById("histLista");
  var vacio = document.getElementById("histVacio");
  if (!lista) return;
  if (!filtrados.length){ lista.innerHTML=""; vacio.style.display="block"; return; }
  vacio.style.display="none";
  lista.innerHTML = filtrados.map(function(p){
    var est = p.estado||"nuevo";
    var items = (p.items||[]).map(function(i){return i.cantidad+"× "+esc(i.nombre);}).join(", ");
    var date = p.fecha ? fmtFechaCorta(p.fecha) : "";
    var lineasHtml = (p.items||[]).map(function(i){
      return '<div class="hist-linea"><span>'+i.cantidad+"× "+esc(i.nombre)+'</span><span>'+fmtPrecio(i.precio*i.cantidad)+'</span></div>';
    }).join("");
    return '<div class="hist-card">'
      +'<div class="hist-head">'
        +'<div style="min-width:0;flex:1">'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
            +'<span style="font-weight:900;font-size:13px;color:var(--rojo)">#'+esc(p.id)+'</span>'
            +'<span class="ped-badge '+est+'" style="font-size:10.5px">'+badgeEstado(est)+'</span>'
          +'</div>'
          +'<div style="font-size:12px;color:var(--muted);font-weight:600">'+esc(items)+'</div>'
          +'<span style="font-size:11.5px;color:var(--muted)">'+date+'</span>'
        +'</div>'
        +'<div style="text-align:right;flex-shrink:0">'
          +'<div style="font-weight:900;font-size:14px;margin-bottom:4px">'+fmtPrecio(p.total)+'</div>'
          +'<span class="hist-arrow">▾</span>'
        +'</div>'
      +'</div>'
      +'<div class="hist-body">'
        +lineasHtml
        +'<div class="hist-linea total"><span>Total</span><span>'+fmtPrecio(p.total)+'</span></div>'
        +'<button class="pill pill-solid pill-sm" style="width:100%;margin-top:10px" data-rep="'+esc(p.id)+'">↩ Repetir pedido</button>'
      +'</div>'
    +'</div>';
  }).join("");
}

function escucharHistorial(uid){
  if (_unsubHistorial){ _unsubHistorial(); _unsubHistorial = null; }
  if (!db || !uid) return;
  _unsubHistorial = db.collection("tiendas").doc(STORE_ID).collection("pedidos")
    .where("uid","==",uid).orderBy("fecha","desc").limit(50)
    .onSnapshot(function(s){
      _histTodos = [];
      s.forEach(function(d){ _histTodos.push(Object.assign({id:d.id}, d.data())); });
      renderHistorial(_histTodos);
      renderPagos(_histTodos);
    }, function(e){ console.warn("historial:", e); });
}

function initHistorial(){
  var fils = document.querySelector(".hist-filtros");
  if (fils) fils.addEventListener("click", function(e){
    var b = e.target.closest(".hfpill"); if (!b) return;
    _histFiltro = b.dataset.hf;
    fils.querySelectorAll(".hfpill").forEach(function(x){ x.classList.toggle("active",x===b); });
    renderHistorial(_histTodos);
  });
  var lista = document.getElementById("histLista");
  if (lista) lista.addEventListener("click", function(e){
    var card = e.target.closest(".hist-card");
    var rep  = e.target.closest("[data-rep]");
    if (rep){
      var pid = rep.dataset.rep;
      var ped = _histTodos.find(function(p){return p.id===pid;});
      if (ped){
        (ped.items||[]).forEach(function(it){
          var prod = state.productos.find(function(p){return p.nombre===it.nombre;});
          if (prod) for (var i=0; i<(it.cantidad||1); i++) agregarAlCarrito(prod.id);
        });
        toast("🛒 Productos agregados al carrito");
        irPagina("menu");
      }
      return;
    }
    if (card) card.classList.toggle("abierto");
  });
}

/* Direcciones */
function escucharDirecciones(uid){
  if (!db || !uid) return;
  colUsuario(uid,"direcciones").orderBy("creadoEn","desc")
    .onSnapshot(function(s){
      var arr=[]; s.forEach(function(d){arr.push(Object.assign({id:d.id},d.data()));});
      renderDirecciones(arr);
    }, function(e){ console.warn("direcciones:",e); renderDirecciones([]); });
}

function renderDirecciones(arr){
  var lista=document.getElementById("dirLista");
  var vacio=document.getElementById("dirVacio");
  if (!lista) return;
  if (!arr.length){ lista.innerHTML=""; vacio.style.display="block"; return; }
  vacio.style.display="none";
  var ICOS={"Casa":"🏠","Trabajo":"💼","Otro":"📌"};
  lista.innerHTML=arr.map(function(d){
    return '<div class="dir-card '+(d.favorita?"favorita":"")+'">'
      +'<span class="dir-ico">'+(ICOS[d.label]||"📌")+'</span>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">'
          +'<span style="font-weight:900;font-size:14px">'+esc(d.label)+'</span>'
          +(d.favorita?'<span style="font-size:11px;color:var(--dorado);font-weight:800">⭐ Favorita</span>':'')
        +'</div>'
        +'<p style="margin:0 0 3px;font-size:13px;font-weight:700">'+esc(d.direccion)+'</p>'
        +(d.telefono?'<p style="margin:0 0 3px;font-size:12px;color:var(--muted);font-weight:700">📞 '+esc(d.telefono)+'</p>':'')
        +(d.referencias?'<p style="margin:0;font-size:12px;color:var(--muted);font-weight:600">'+esc(d.referencias)+'</p>':'')
        +'<div class="dir-cta">'
          +(!d.favorita?'<button class="pill pill-outline pill-sm" style="font-size:11.5px;padding:6px 12px" data-dfav="'+esc(d.id)+'">⭐ Favorita</button>':'')
          +'<button class="pill pill-outline pill-sm" style="font-size:11.5px;padding:6px 12px" data-dedit="'+esc(d.id)+'">✏ Editar</button>'
          +'<button class="pill pill-outline pill-sm" style="font-size:11.5px;padding:6px 12px;border-color:#ddd;color:var(--muted)" data-ddel="'+esc(d.id)+'">🗑</button>'
        +'</div>'
      +'</div>'
    +'</div>';
  }).join("");
}

function initDirecciones(){
  var btn=document.getElementById("btnNuevaDir");
  if (btn) btn.addEventListener("click",function(){abrirDirModal(null);});
  var lista=document.getElementById("dirLista");
  if (!lista) return;
  lista.addEventListener("click",function(e){
    var uid=clienteUser&&clienteUser.uid; if(!uid)return;
    var fav=e.target.closest("[data-dfav]");
    var edit=e.target.closest("[data-dedit]");
    var del=e.target.closest("[data-ddel]");
    if(fav){
      colUsuario(uid,"direcciones").get().then(function(s){
        var batch=db.batch();
        s.forEach(function(d){batch.update(d.ref,{favorita:d.id===fav.dataset.dfav});});
        return batch.commit();
      }).catch(function(err){toast("Error al guardar");});
      return;
    }
    if(del){
      if(!confirm("¿Eliminar esta dirección?"))return;
      colUsuario(uid,"direcciones").doc(del.dataset.ddel).delete()
        .then(function(){toast("Dirección eliminada");})
        .catch(function(){toast("Error al eliminar");});
      return;
    }
    if(edit){
      colUsuario(uid,"direcciones").doc(edit.dataset.dedit).get()
        .then(function(d){if(d.exists)abrirDirModal(Object.assign({id:d.id},d.data()));})
        .catch(function(){});
    }
  });
}

function abrirDirModal(dir){
  _dirLabel=(dir&&dir.label)||"Casa";
  document.getElementById("dirModalTitulo").textContent=dir?"Editar dirección":"Nueva dirección";
  var inp = document.getElementById("dirInput");
  inp.value=(dir&&dir.direccion)||"";
  document.getElementById("dirRefInput").value=(dir&&dir.referencias)||"";
  document.getElementById("dirTelInput").value=(dir&&dir.telefono)||(clienteUser&&clienteUser.telefono)||"";
  document.getElementById("dirFavCheck").checked=!!(dir&&dir.favorita);
  document.getElementById("dirEditId").value=(dir&&dir.id)||"";
  document.querySelectorAll(".lset-btn").forEach(function(b){b.classList.toggle("active",b.dataset.lb===_dirLabel);});
  /* Estado de selección: si editamos, partimos de los datos guardados */
  window._dirModalSel = dir && dir.comuna
    ? { direccion: dir.direccion, comuna: dir.comuna, lat: (dir.lat!=null?dir.lat:null), lng: (dir.lng!=null?dir.lng:null) }
    : null;
  poblarComunas(document.getElementById("dirComuna"), (dir && dir.comuna) || "");
  var mp = document.getElementById("dirMapa");
  if (mp) mp.classList.remove("show");
  if (window._dirModalSel && window._dirModalSel.lat != null){
    mostrarMiniMapa("dirMapa", window._dirModalSel.lat, window._dirModalSel.lng);
  }
  document.getElementById("dirModal").classList.add("open");
  setTimeout(function(){
    instalarAutocomplete(inp, function(r){
      window._dirModalSel = r;
      setComunaSelect(document.getElementById("dirComuna"), r.comuna);
      mostrarMiniMapa("dirMapa", r.lat, r.lng);
    });
    inp.focus();
  },100);
}

function initDirModal(){
  var _dc = document.getElementById("dirComuna");
  if (_dc) _dc.addEventListener("change", function(){
    _dc.classList.toggle("lleno", !!_dc.value);
    var c = _dc.value === "__otra" ? "" : _dc.value;
    window._dirModalSel = Object.assign({}, window._dirModalSel || {}, { comuna: c });
  });
  document.querySelectorAll(".lset-btn").forEach(function(b){
    b.addEventListener("click",function(){
      _dirLabel=b.dataset.lb;
      document.querySelectorAll(".lset-btn").forEach(function(x){x.classList.toggle("active",x===b);});
    });
  });
  var favRow=document.getElementById("dirFavRow");
  if(favRow)favRow.addEventListener("click",function(){var ch=document.getElementById("dirFavCheck");ch.checked=!ch.checked;});
  var cancel=document.getElementById("dirModalCancel");
  if(cancel)cancel.addEventListener("click",function(){document.getElementById("dirModal").classList.remove("open");});
  var modal=document.getElementById("dirModal");
  if(modal)modal.addEventListener("click",function(e){if(e.target===modal)modal.classList.remove("open");});
  var guardar=document.getElementById("dirModalGuardar");
  if(guardar)guardar.addEventListener("click",function(){
    var uid=clienteUser&&clienteUser.uid;
    if(!uid){toast("Debes iniciar sesión");return;}
    var dir=document.getElementById("dirInput").value.trim();
    if(!dir){document.getElementById("dirInput").focus();toast("Escribe la dirección");return;}
    var tel=document.getElementById("dirTelInput").value.trim();
    if(!tel){document.getElementById("dirTelInput").focus();toast("Escribe un teléfono de contacto");return;}
    var sel = window._dirModalSel;
    var data={
      label:_dirLabel,
      direccion:dir,
      telefono:tel,
      comuna: (function(){
        var dc = document.getElementById("dirComuna");
        if (dc && dc.value && dc.value !== "__otra") return dc.value;
        return (sel && sel.comuna) || "";
      })(),
      lat: (sel && sel.lat != null) ? sel.lat : null,
      lng: (sel && sel.lng != null) ? sel.lng : null,
      referencias:document.getElementById("dirRefInput").value.trim(),
      favorita:document.getElementById("dirFavCheck").checked,
      creadoEn:new Date().toISOString()
    };
    var editId=document.getElementById("dirEditId").value;
    guardar.disabled=true; guardar.textContent="Guardando…";
    var ref=editId?colUsuario(uid,"direcciones").doc(editId):colUsuario(uid,"direcciones").doc();
    var fin=function(){guardar.disabled=false;guardar.textContent="Guardar dirección";};
    if(data.favorita){
      colUsuario(uid,"direcciones").get()
        .then(function(s){
          var batch=db.batch();
          s.forEach(function(d){if(d.id!==ref.id)batch.update(d.ref,{favorita:false});});
          batch.set(ref,data,{merge:true});
          return batch.commit();
        })
        .then(function(){document.getElementById("dirModal").classList.remove("open");toast("📍 Dirección guardada");fin();})
        .catch(function(err){console.warn(err);toast("Error: "+(err.message||"intenta de nuevo"));fin();});
    } else {
      ref.set(data,{merge:true})
        .then(function(){document.getElementById("dirModal").classList.remove("open");toast("📍 Dirección guardada");})
        .catch(function(err){console.warn(err);toast("Error: "+(err.message||"intenta de nuevo"));})
        .finally(fin);
    }
  });
}

/* Pagos */
function renderPagos(arr){
  var hist=document.getElementById("pagosHistorial");
  var vacio=document.getElementById("pagosVacio");
  if(!hist)return;
  var pagados=arr.filter(function(p){return p.estado&&p.estado!=="cancelado";});
  if(!pagados.length){hist.innerHTML="";vacio.style.display="block";return;}
  vacio.style.display="none";
  hist.innerHTML=pagados.map(function(p){
    return '<div class="pago-hist-item">'
      +'<div><p style="margin:0;font-weight:800;font-size:13px">#'+esc(p.id)+'</p>'
      +'<p style="margin:0;font-size:11.5px;color:var(--muted)">'+(p.fecha?fmtFechaCorta(p.fecha):"")+' · '+(p.tipo==="retiro"?"Retiro":"Delivery")+'</p></div>'
      +'<span style="font-weight:900;font-size:14px;color:#16a34a">+ '+fmtPrecio(p.total)+'</span>'
    +'</div>';
  }).join("");
}

/* Mostrar/ocultar secciones extra con la sesión */
function activarSeccionesExtra(uid){
  var tabs=document.getElementById("cuentaSubTabs");
  if(tabs) tabs.style.display="block";
  document.getElementById("ct-historial").style.display="block";
  if(uid){
    escucharHistorial(uid);
    escucharDirecciones(uid);
  }
}
function desactivarSeccionesExtra(){
  var tabs=document.getElementById("cuentaSubTabs");
  if(tabs) tabs.style.display="none";
  ["ct-historial","ct-direcciones","ct-pagos"].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display="none";
  });
  if(_unsubHistorial){_unsubHistorial();_unsubHistorial=null;}
}


/* ═══ CHECKOUT RESUMEN TOGGLE ═══ */
function initCkResumen(){
  const handle = document.getElementById("ckHandle");
  const resumen = document.getElementById("ckResumen");
  if (!handle || !resumen) return;
  handle.addEventListener("click", function(){
    resumen.classList.toggle("expandido");
  });
}

/* ═══ SPLASH SCREEN ═══ */
function ocultarSplash(){
  const s = document.getElementById("splashScreen");
  if (s) s.classList.add("oculto");
}

async function boot(){
  initNav(); initMenu(); initCarrito(); initCheckout();
  initCupones(); initWhatsApp(); initDev(); initImgModal(); initPanel(); initDetProducto();
  initProdSel(); initCliPedModal();
  /* Restaurar sesión devmode — SOLO en DEMO se reactiva directo (no hay
     Firebase Auth real que verificar). Fuera de DEMO, activarDevmode()
     ya NO se llama desde acá: se limpia el flag guardado de
     localStorage si Firebase Auth no confirma una sesión real con rol
     válido para esta tienda dentro de unos segundos — es
     auth.onAuthStateChanged() quien decide si reabrir el panel,
     después de comprobar roles[STORE_ID] (ver más abajo). Antes, este
     setTimeout llamaba a activarDevmode() con el solo hecho de que
     localStorage dijera que hubo sesión — sin volver a comprobar nada
     contra Firebase, ni siquiera que la sesión de Auth siguiera activa. */
  if (lsGet("tb_dev_session") === "1"){
    if (DEMO){
      setTimeout(function(){
        if (!document.body.classList.contains("dev-on")) activarDevmode();
      }, 900);
    } else {
      setTimeout(function(){
        if (!document.body.classList.contains("dev-on")) lsDel("tb_dev_session");
      }, 6000); // margen generoso para que onAuthStateChanged + resolverRolPropietario terminen primero
    }
  }

  const firebaseDisponible = typeof firebase !== "undefined";

  if (DEMO || !firebaseDisponible){
    if (!DEMO && !firebaseDisponible) console.error("No cargaron los scripts de Firebase (CDN). Revisa la conexión.");
    if (DEMO) mensajeDemo();
    if (snapshotData){
      estadoDesdeSnapshot(snapshotData);
    } else {
      state.productos = normalizarOrden(DEMO_DATA.productos.map(p => Object.assign({}, p)));
      state.cupones   = DEMO_DATA.cupones.map(c => Object.assign({}, c));
      state.locales   = DEMO_DATA.locales.map(l => Object.assign({}, l));
      state.dispositivos = [];
    }
    detectarRetornoPago();
    router();
    renderAll();
    try { escucharPedidos(); initCuenta(); initPedidosUI(); initCkResumen(); } catch(e){ console.warn(e); }
    return; /* splash se oculta en cargarFirebase */
  }

  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();
  auth = firebase.auth();
  storage = firebase.storage();

  /* Resolución de STORE_ID por dominio — el corazón del modelo
     multi-tienda. Antes de esto, STORE_ID era una constante fija en
     el código, distinta por cada copia del archivo que se subía a
     Netlify. Ahora hay UN SOLO código, y esta consulta decide a qué
     tienda pertenece según location.hostname.

     Si el dominio actual no está registrado en la colección
     "dominios" (por ejemplo, mientras se prueba en local, o si la
     fila todavía no se creó en Firestore), STORE_ID se queda con el
     valor por defecto ("test-burgers") declarado más arriba — esto
     es intencional: nunca debe romperse el sitio actual por un
     dominio nuevo mal configurado o por un fallo de red puntual. */
  try {
    const domDoc = await db.collection("dominios").doc(location.hostname).get();
    if (domDoc.exists && domDoc.data().storeId) {
      STORE_ID = domDoc.data().storeId;
    }
  } catch(e) {
    console.warn("No se pudo resolver STORE_ID por dominio, se usa el valor por defecto:", e);
  }

  /* Splash — Capa 1 (inmediata, sin esperar a Firestore): mientras
     cargarFirebase() todavía no trajo el nombre real de la tienda,
     mostramos un nombre derivado del storeId recién resuelto — mucho
     mejor que dejar "DerLabs Stores" fijo, que solo tiene sentido
     para la tienda de prueba original. La Capa 2 (nombre y color
     reales desde config) se aplica más abajo, en actualizarSplashConConfig(). */
  actualizarSplashBasico();
  /* Favicon — Capa 1: a diferencia del splash, acá no hay forma de
     adivinar el rubro real antes de que responda Firestore (el
     storeId no lo revela), así que se usa el ícono neutro de "otro"
     como respaldo temporal. La Capa 2 (rubro real) se aplica en
     actualizarFaviconConConfig() dentro de cargarFirebase(). */
  aplicarFavicon(rubroPorId("otro").ico);

  /* App secundaria SOLO para verificar la cuenta de propietario en
     acciones sensibles (cupones, precios, caja) sin cerrar la sesión
     operador que ya está activa en `auth`. Si usara la misma instancia,
     signInWithEmailAndPassword reemplazaría la sesión actual en vez de
     solo verificar credenciales al pasar. */
  const _appPin = firebase.apps.find(a => a.name === "verificacionPin") ||
    firebase.initializeApp(FIREBASE_CONFIG, "verificacionPin");
  authPin = _appPin.auth();
  auth.onAuthStateChanged(async function(u){
    const prov = (u && u.providerData && u.providerData[0]) ? u.providerData[0].providerId : null;
    authUser = (u && prov === "password") ? u : null;
    if (authUser){
      await resolverRolPropietario(authUser.uid);
      /* Único punto que decide si (re)abrir el devmode con una sesión
         de Firebase Auth ya existente — cubre tanto una sesión que
         Firebase restauró solo (persistencia local del navegador)
         como el margen que dejó boot() al arrancar (ver arriba). Si
         hay sesión de Auth pero sin rol para ESTA tienda, nunca se
         abre el panel — antes, boot() lo abría solo con el flag de
         localStorage, sin llegar a comprobar esto. */
      if (tieneAccesoDevmode() && !document.body.classList.contains("dev-on")){
        activarDevmode();
      } else if (!tieneAccesoDevmode() && lsGet("tb_dev_session") === "1"){
        // Sesión de Auth válida pero sin rol para esta tienda — no dejar el flag colgado.
        lsDel("tb_dev_session");
      }
    } else {
      esPropietario = false;
      rolDeEstaCuenta = null;
    }
    if (u && prov === "google.com"){
      clienteUser = u;
      renderCuentaLogin();
      escucharMisPedidos(u.uid);
      activarSeccionesExtra(u.uid);
      /* Si esta MISMA cuenta de Google también tiene rol de devmode
         para esta tienda, avisar — quedarse logueado como "cliente"
         con la cuenta admin, sin darse cuenta, es la forma más común
         de terminar con dos sesiones (Google + password) peleándose
         por la misma instancia de auth, que se siente como que "el
         sistema colapsa" aunque ninguna de las dos credenciales se
         haya dañado. */
      db.doc("usuarios/" + u.uid).get().then(function(doc){
        var roles = doc.exists ? (doc.data().roles || {}) : {};
        if (roles[STORE_ID]){
          toast("⚠️ Estás en 'Mi cuenta' con tu cuenta de administrador — salí de acá antes de entrar al devmode");
        }
      }).catch(function(){});
      /* Si el usuario se logueó estando en el checkout gate → avanzar al form */
      if (document.body.dataset.page === "checkout") evaluarGate();
    } else {
      clienteUser = null;
      renderCuentaLogin();
      if (_unsubMisPedidos){ _unsubMisPedidos(); _unsubMisPedidos = null; }
      desactivarSeccionesExtra();
      if (document.body.dataset.page === "checkout") actualizarCampoEmail();
    }
  });
  if (snapshotData) estadoDesdeSnapshot(snapshotData);
  /* Detectar retorno de MercadoPago DESPUÉS de tener db (finaliza el pedido) */
  detectarRetornoPago();
  router();
  renderAll();
  cargarFirebase();
  try { escucharPedidos(); } catch(e){ console.warn(e); }
  try { initCuenta(); } catch(e){ console.warn(e); }
  try { initPedidosUI(); } catch(e){ console.warn(e); }
  try { initCkResumen(); } catch(e){ console.warn(e); }
  try { escucharPedidoActivoBanner(); } catch(e){ console.warn(e); }
  registrarSW();
  /* splash se oculta cuando cargarFirebase() termina */
}
boot();
/* Refuerzo periódico — cubre cualquier emoji que se haya insertado por
   fuera de renderAll() (toasts, listas que se regeneran solas, timeline
   de un pedido puntual) sin necesitar identificar cada una de las
   funciones de render que lo generan. Seguro de llamar repetidamente:
   aplicarIconosGlobal() es idempotente, un nodo de texto ya convertido
   no contiene más emoji así que una pasada de más no hace nada. El
   intervalo es generoso (no hace falta más frecuencia que la velocidad
   humana de interacción) para mantener el costo insignificante. */
setInterval(function(){ aplicarIconosGlobal(); }, 2000);

/* Recuperación tras volver de MercadoPago sin pagar (bfcache) — el
   navegador puede restaurar esta página desde memoria en vez de
   recargarla al usar "Atrás"/"Volver", con el JavaScript exactamente
   congelado en el estado que tenía al irse: el botón "Ir a
   MercadoPago" queda disabled con el texto "Conectando…" (ver
   confirmarPedido(), justo antes de window.location.href), porque esa
   línea de código nunca volvió a ejecutarse para revertirlo — la
   página no se recargó, solo se "despausó". El síntoma reportado
   ("no me deja cambiar a efectivo") es consecuencia de este botón
   congelado, no de la selección de forma de pago en sí. La forma más
   simple y segura de arreglar esto es forzar un reload real — así
   también se resincroniza cualquier otra cosa que pudiera haber
   cambiado mientras tanto (stock, config), no solo el botón. */
window.addEventListener("pageshow", function(e){
  if (!e.persisted) return; // navegación normal, no bfcache — no hacer nada
  var btn = qs("#btnConfirmar");
  if (btn && btn.disabled){
    location.reload();
  }
});

/* ════════════════════════════════════════════════════════════════
   FIX BOTONES AGREGAR — bind directo a las cards renderizadas.
   El delegado global no garantiza orden sobre el handler del modal.
   Este listener corre en fase de captura sobre cada botón específico,
   por lo que detiene el evento antes de que abra el detalle.
   ════════════════════════════════════════════════════════════════ */
(function(){
  /* Resolver id del producto por 3 vias: data-add → data-id del padre → nombre visible */
  function _resolverId(btn){
    var pid = btn.dataset && btn.dataset.add;
    if (pid) return pid;

    var card = btn.closest("[data-id]");
    if (card && card.dataset.id) return card.dataset.id;

    var card2 = btn.closest(".prod-item, .oferta-card, article");
    if (!card2) card2 = btn.parentElement;
    if (!card2) return null;

    var nombreEl = card2.querySelector(".prod-nombre, .prod-name, .card-title, h3, h4");
    if (!nombreEl) return null;
    var nombre = (nombreEl.textContent || "").trim().toLowerCase();
    if (!nombre) return null;

    var encontrado = state.productos.find(function(x){
      return (x.nombre || "").trim().toLowerCase() === nombre;
    });
    return encontrado ? encontrado.id : null;
  }

  function _bindAdd(root){
    if (!root || !root.querySelectorAll) return;
    var botones = root.querySelectorAll("[data-add], .btn-add-circ, .prod-add, .prod-cta, .prod-cta-dis");
    botones.forEach(function(btn){
      if (btn._addBound) return;
      btn._addBound = true;
      btn.addEventListener("click", function(ev){
        /* SIEMPRE bloquear: nunca abrir modal al tocar boton agregar */
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();

        var pid = _resolverId(btn);
        if (!pid) return;
        if (document.body.classList.contains("dev-on") && !document.body.classList.contains("preview-cliente")) return;

        var p = state.productos.find(function(x){ return x.id === pid; });
        if (p && (p.variantesActivas || p.permitePersonalizacion)){
          abrirDetProducto(pid);
          return;
        }
        agregarAlCarrito(pid);
      }, true);
    });
  }

  window._bindAdd = _bindAdd;

  function _init(){
    _bindAdd(document.body);
    ["ofertasScroll","menuList","popularesList","catGrid","promoScroll"].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      _bindAdd(el);
      var mo = new MutationObserver(function(){ _bindAdd(el); });
      mo.observe(el, { childList: true, subtree: true });
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", _init);
  } else {
    setTimeout(_init, 0);
  }
})();

/* ════════════════════════════════════════════════════════════════
   FIX BOTONES AGREGAR — bind directo a las cards renderizadas.
   El delegado global no garantiza orden sobre el handler del modal.
   Este listener corre en fase de captura sobre cada botón específico,
   por lo que detiene el evento antes de que abra el detalle.
   ════════════════════════════════════════════════════════════════ */
(function(){
  function _bindAdd(root){
    if (!root || !root.querySelectorAll) return;
    var botones = root.querySelectorAll("[data-add], .btn-add-circ, .prod-add, .prod-cta");
    botones.forEach(function(btn){
      if (btn._addBound) return;
      btn._addBound = true;
      btn.addEventListener("click", function(ev){
        var pid = btn.dataset.add;
        if (!pid){
          var card = btn.closest("[data-id]");
          if (card) pid = card.dataset.id;
        }
        if (!pid) return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        if (document.body.classList.contains("dev-on") && !document.body.classList.contains("preview-cliente")) return;
        var p = state.productos.find(function(x){ return x.id === pid; });
        if (p && (p.variantesActivas || p.permitePersonalizacion)){
          abrirDetProducto(pid);
          return;
        }
        agregarAlCarrito(pid);
      }, true);
    });
  }

  window._bindAdd = _bindAdd;

  function _init(){
    _bindAdd(document.body);
    ["ofertasScroll","menuList","popularesList","catGrid","promoScroll"].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      _bindAdd(el);
      var mo = new MutationObserver(function(){ _bindAdd(el); });
      mo.observe(el, { childList: true, subtree: true });
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", _init);
  } else {
    setTimeout(_init, 0);
  }
})();

/* ════════════════════════════════════════════════════════════════
   BACKEND — netlify/functions/:
     _firebase.js            → helper compartido (Admin SDK, config,
                                validación de pedido/cupón)
     crearPago.js             → POST — valida y crea el registro de
                                auditoría en intentos_pago (el pedido
                                real nace en webhookPago.js)
     crearPedidoEfectivo.js   → POST — crea pedido en efectivo (misma
                                validación que crearPago.js, sin paso
                                intermedio porque no hay webhook externo)
     webhookPago.js           → POST — MercadoPago notifica pago
                                aprobado; acá nace el pedido real
     enviarEmails.js          → POST — emails transaccionales (Resend)
     notificar.js             → POST — Web Push al vendedor
     ultimoPedido.js          → GET  — respaldo del push cuando el
                                payload cifrado no llega (ver sw.js)
     limpiarPendientes.js     → scheduled — borra intentos_pago sin
                                completar (nunca los que están en error)
     crearTienda.js           → POST — automatiza el alta de una tienda
                                nueva (ver generar-tienda.html), protegida
                                con ADMIN_SECRET
     manifestTienda.js        → GET  — genera el manifest.json dinámico
                                por dominio (ver netlify.toml, redirect
                                de /manifest.json)
     ping.js                  → GET  — health check

   HERRAMIENTAS — generar-tienda.html: panel para dar de alta una
   tienda nueva (paleta por rubro, imágenes, dominio, cuenta de
   propietario) sin escribir nada a mano en Firebase Console. Ver
   LEEME.md sección 9 y ROADMAP.md sección 5.

   REGLAS FIRESTORE — ver netlify/functions/README-FIRESTORE-RULES.md
   (reglas completas para copiar/pegar, fusiona la separación config
   público/privado con la segunda clave de propietario para cupones,
   precios y caja — incluye cómo crear la cuenta de propietario y los
   pasos de migración si esta tienda tenía datos con el esquema viejo).

   DESPLIEGUE:
     1. netlify deploy (netlify.toml ya apunta a netlify/functions)
     2. Configurar en Netlify → Site configuration → Environment
        variables: FIREBASE_SERVICE_ACCOUNT, MP_ACCESS_TOKEN,
        VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, ADMIN_SECRET
        (ver LEEME.md)
     3. Pegar las reglas de Firestore (ver README-FIRESTORE-RULES.md)
     4. Crear al menos una cuenta de propietario (ver el mismo README) —
        sin esto, nadie puede crear cupones, cambiar precios, ni tocar
        la caja
     5. En devmode → Pagos, guardar el Access Token de MercadoPago
     6. En devmode → Emails, guardar la Resend API Key
   ════════════════════════════════════════════════════════════════ */
