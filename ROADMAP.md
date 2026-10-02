# Roadmap — después de cerrar multidominio

Este archivo junta las decisiones de una sesión de planificación, para
no perderlas.

## 1. Favicon dinámico por rubro — ✅ hecho, y actualizado

`rubro` ya vive en `config/general` (ver `crearTienda.js`), y el
favicon se genera con un `<canvas>` — pero ya NO dibuja el carácter
emoji crudo con `ctx.fillText()`. Desde el trabajo de la sección 7 (ver
abajo), reutiliza el mismo SVG que `EMOJI_A_ICONO` usa para reemplazar
ese emoji en el resto de la interfaz, cargado como imagen y dibujado
con `ctx.drawImage()` — coherente con el resto del proyecto, que ya no
muestra ningún emoji Unicode en pantalla. Queda un respaldo
(`aplicarFaviconEmojiCrudo`) que sí usa `fillText`, solo por si el SVG
no carga por algún motivo — no debería usarse en el camino normal.

## 2. Splash de carga personalizado con imagen del cliente — ✅ hecho

`actualizarSplashConConfig()` en `index.html` usa `splashImagenBase64`
(guardado desde `crearTienda.js`, subido y comprimido en el panel
`generar-tienda.html`) con prioridad sobre el color plano de marca —
con un overlay oscuro (`#splashScreen.con-imagen`) para que el texto
blanco fijo siga siendo legible sin importar qué tan clara sea la foto
del cliente. Si no hay imagen, cae al color de marca como antes.

## 3. Acceso directo al gestor de pedidos (no PWA completa) — ✅ hecho

`netlify/functions/manifestTienda.js` genera el `manifest.json` al
vuelo según el dominio, con `start_url: "/pedidos.html"` (no
`index.html` — el acceso directo abre el gestor, no la tienda
pública), usando el logo real del cliente si existe. Redirect en
`netlify.toml` (`/manifest.json` → la función) y enlazado desde el
`<head>` de `pedidos.html`.

## 4. Paletas de color por rubro — con fundamento, no a ojo

Decisión: **vos elegís la paleta, no el cliente directamente** — se la
mostrás con una vista previa de calidad y él aprueba o pide ajustes.

Hoy `aplicarColor()` en `index.html` (buscar esa función) solo
sobrescribe 3 variables CSS (`--rojo`, `--rojo-h`, `--sombra`), y
además pone `--rojo-h` (el hover) **igual** al color base, sin generar
ningún matiz — por eso todas las tiendas "se sienten" la misma app
repintada. Hay 10 variables CSS raíz en total (`:root` al inicio de
`index.html`); 160 usos en el archivo dependen de las 7 que hoy nunca
cambian.

**`--verde` y `--dorado` deben quedarse FIJOS en todas las paletas** —
tienen significado semántico universal (verde = éxito/disponible/
descuento/pedido confirmado; dorado = destacado/favorito/puntos). Si
cambian por marca, se pierde esa señal universal para el usuario.

Combinaciones ya diseñadas con respaldo de psicología del color por
industria (investigadas en esta sesión, fuentes de 2025-2026), para
usar como punto de partida — ajustables si algún cliente pide algo más
específico a su marca:

| Rubro | Principal | Hover | Fondo | Fundamento |
|---|---|---|---|---|
| 🍔 Hamburguesas | `#9B1B30` | `#C4273A` | `#FBF7F5` | La actual — vino intenso, apetito + carácter |
| 🌭 Comida rápida | `#C83D09` | `#F2601F` | `#FFF8F2` | Naranja/rojo = urgencia y apetito (McDonald's, Coca-Cola). Ajustado de `#D8420A` a `#C83D09` — el original daba 4.46:1 de contraste con texto blanco, apenas bajo el mínimo WCAG AA (4.5:1); este valor da 5.09:1 |
| ☕ Cafetería | `#5C3D2E` | `#7A5240` | `#F7F1EA` | Marrón = calidez artesanal, distinto de los rubros de comida rápida |
| 🧁 Pastelería | `#C2185B` | `#E91E63` | `#FFF5F8` | Dulce, femenino sin infantil, distinto del rosa suave de belleza |
| 👕 Ropa | `#1A1A1A` | `#3D3D3D` | `#FAFAFA` | Negro = elegancia/moda, editorial |
| 💅 Belleza | `#D46A9F` | `#E890BC` | `#FDF6FA` | Rosa/coral suave — el más respaldado en la literatura para belleza. Contraste 3.3:1 con texto blanco (insuficiente) — usar texto oscuro (`#1A1A1A`), que da 5.27:1 |
| 📅 Servicios | `#1565C0` | `#1E88E5` | `#F4F8FC` | Azul = confianza, consistente en toda la literatura para servicios |
| 🏪 Otro | `#546E7A` | `#607D8B` | `#F5F7F8` | Neutro pero no aburrido, base decente sin encasillar |

Todas verificadas con la fórmula de contraste real WCAG (no una
aproximación) — ver `textoLegibleSobre()`/`razonContrasteWCAG()` en
`index.html`, ya implementadas y probadas contra estas 8 paletas.

Trabajo técnico — estado actual:
- ✅ Hover calculado con fórmula HSL (más oscuro si el color es claro,
  más claro si es oscuro), no copiado del color base — implementado y
  probado en `colorHover()`.
- ✅ Contraste de texto calculado con la fórmula real WCAG (razón de
  contraste, no solo luminancia aproximada) — implementado en
  `textoLegibleSobre()`/`razonContrasteWCAG()`, verificado contra las 8
  paletas (ver tabla arriba, incluye el ajuste que este cálculo obligó
  a hacer en la paleta de Comida rápida).
- ✅ Fondo suave derivado del tono de marca (`fondoSuaveDesde()`), no un
  crema fijo para todas las tiendas.
- ✅ **Selector de RUBRO conectado a la paleta** — devmode → Tienda tiene
  un `<select>` poblado desde `RUBROS` (`#pRubro`). Al cambiarlo,
  actualiza `colorPrimario` a la paleta sugerida SOLO si el color
  actual coincide exactamente con el de algún rubro (es decir, nunca
  se personalizó a mano) — si el vendedor ya eligió su propio color, no
  se le pisa al cambiar de rubro.
- ✅ **`var(--rojo-texto)` reemplazó `color:#fff` fijo** en los 17 puntos
  reales del archivo donde el texto vive sobre `background:var(--rojo)`
  (confirmado con un script que distingue esos casos de los ~20 que
  usaban blanco sobre otros fondos — `--verde`, `--dorado`, colores
  fijos — que correctamente no debían tocarse). Verificado dos veces
  con criterios distintos (por línea individual y por bloque de regla
  completo) hasta confirmar cero casos restantes.

**Hallazgo nuevo, sin tocar (fuera del alcance de este pendiente):**
`pedidos.html` tiene su propia paleta fija — `--rojo:#E53935`, sin
relación con `colorPrimario` de ninguna tienda (es el panel operativo
del vendedor, no debería cambiar de color con cada cliente). Ese rojo
fijo da 4.23:1 de contraste con texto blanco, por debajo del mínimo
WCAG AA (4.5:1) — un problema real de legibilidad, pero de diseño
visual fijo del panel, no del sistema de paletas dinámicas por rubro.
No se tocó porque no era parte de lo pedido explícitamente; queda
anotado para decidir si se ajusta en otra sesión.

## 5. Herramienta para generar tiendas nuevas

Objetivo: automatizar lo más posible el alta de un cliente nuevo,
dejando manual solo lo que técnicamente no se puede automatizar.

**Construido y funcionando** — `generar-tienda.html` (panel, protegido
con `ADMIN_SECRET`) + `netlify/functions/crearTienda.js` (backend con
Admin SDK):
- Nombre del negocio (editable libremente, ej. "Pizzería de Juan
  Carlos") → genera `storeId` único, con sufijo numérico si el slug ya
  existe.
- Selección de rubro (chips visuales) → aplica automáticamente la
  paleta correspondiente (sección 4) — colorPrimario, y de ahí el resto
  se deriva en la tienda real con las mismas fórmulas que `index.html`.
- Vista previa en vivo antes de confirmar — header, botón, hover, y
  swatches de color, usando las mismas fórmulas HSL/contraste WCAG que
  la tienda real (duplicadas a propósito en el panel, que es un HTML
  independiente sin acceso al script de `index.html`).
- Crea `tiendas/{storeId}/config/general` y `config/privado` con todo
  lo de arriba ya precargado.
- Crea `dominios/{hostname} → { storeId }`, evitando pisar un dominio
  que ya apunta a otra tienda.
- Opcionalmente crea la cuenta de Firebase Auth de propietario (Admin
  SDK) y le asigna `roles[storeId] = "propietario"` — si se deja en
  blanco, la tienda queda creada igual y la cuenta se arma después.
- Al terminar, muestra un resumen con los pasos manuales que faltan
  (DNS, Netlify, MercadoPago del cliente), no solo "listo" sin más.

**Falta todavía** de lo que esta sección pedía originalmente:
- **Selección/generación de favicon** — el panel no toca esto; la
  tienda ya lo genera sola por rubro en tiempo real (sección 1), así
  que no hace falta que el panel lo suba, se mantiene así a propósito.

**Deuda técnica a vigilar:** la lista de 8 rubros (con su color y/o
emoji, según lo que necesite cada archivo) existe en 5 lugares
distintos — `index.html`, `formulario.html`, `generar-tienda.html`,
`crearTienda.js` (colores), y `pedidos.html` (solo emoji, para su
propio favicon). Hoy están sincronizadas, verificado línea por línea
en cada sesión que las tocó, pero si se agrega un rubro nuevo hay que
tocar los 5 lugares a mano. Si esto sigue creciendo, vale la pena
centralizarlo en un solo lugar que los demás consulten (por ejemplo,
una colección `rubros` en Firestore, leída por los 5), en vez de
seguir duplicándolo.

**Queda manual, con el motivo:**
- Apuntar el DNS del dominio del cliente hacia Netlify — pasa en el
  registrador de dominios del cliente, fuera del alcance de este
  proyecto.
- Agregar el dominio en Netlify (Domain management) — automatizable
  con la API de Netlify si se quiere después, pero requiere guardar un
  token de administración de Netlify en el backend (superficie de
  riesgo nueva a evaluar antes de sumarlo).
- El Access Token de MercadoPago del cliente — tiene que salir de SU
  cuenta de MercadoPago, nunca generable por un formulario.
- El acuerdo comercial/legal con cada cliente.

## 6. Templates múltiples — descartado por ahora

Se evaluó (rubro delivery vs. otros templates futuros, ej. reservas)
y se decidió **no** encararlo todavía — un solo template (el actual,
comida/delivery) para todos los rubros, diferenciado por paleta e
imágenes, no por HTML distinto. Motivo técnico: Netlify sirve archivos
estáticos precompilados, así que "elegir template por dominio" hoy
requeriría tocar `netlify.toml` y redesplegar por cada template nuevo
— no es automatizable desde un formulario sin repensar la arquitectura
de deploy. Si en el futuro se retoma, hay que resolver primero si los
templates nuevos comparten el mismo backend (Firestore, pedidos,
roles) o si alguno necesita lógica de datos distinta (ej. un template
de reservas necesitaría calendario, no carrito).

## 7. Emojis reemplazados por íconos SVG — ✅ hecho

Se reemplazaron los emoji "que se notan como emoji" (comida,
decorativos, expresivos) por íconos SVG propios, en las 4 zonas
confirmadas por capturas reales: página de inicio, checkout, devmode,
gestor de pedidos. Se dejaron fuera a propósito los símbolos
funcionales discretos (flechas `→ ← ↑ ↓`, checks `✓ ✅`, cerrar `✕`,
editar `✏ ✎`, menú `☰`, más `➕`) — se ven como parte del sistema de
interfaz, no como emoji suelto.

**Cómo se construyeron los 55 íconos:** no hay acceso de red en el
entorno de trabajo para descargar una librería de íconos real (se
intentó contra Lucide, un host no está en la lista blanca de red) —
así que se escribieron a mano siguiendo su convención exacta (viewBox
24×24, stroke 2px, `stroke-linecap`/`stroke-linejoin` "round", sin
relleno salvo los puntos de estado). Viven en `iconos/` en la raíz del
proyecto, cada uno verificado como XML válido antes de integrarse.

**Proceso de verificación — no se dibujó a ciegas:** los primeros
intentos incluyeron íconos sin respaldo real (corona, regalo, torta,
edificio, cámara) descartados por criterio propio antes de verificar
contra el código real. Se corrigió el método: un script clasifica cada
línea de `index.html`/`pedidos.html` en "código real" vs. "comentario",
y solo lo que aparece en código real entra a la lista. Esa lista se
confirmó además contra 12 capturas de pantalla reales del sitio
desplegado — que sí revelaron 3 casos que el análisis de texto no
había capturado bien (⭐ en el banner de puntos del inicio, no solo en
Mi Cuenta; ⚙️ en el título grande del panel de devmode) y confirmaron
que el botón de WhatsApp en `pedidos.html` ya era un SVG propio del
logo real, nunca fue un emoji.

**Mecanismo de reemplazo:** un mapa central `EMOJI_A_ICONO` (más
`PUNTO_COLOR` para los 7 puntos de estado de pedido, que necesitan
color dinámico) y una función `aplicarIconosGlobal()` que recorre
nodos de texto del DOM con `TreeWalker` — no reescribe bloques de
`innerHTML` (eso rompía el foco de inputs y era costoso), solo
reemplaza los nodos puntuales que contienen un emoji. Es idempotente:
llamarla de más no hace nada sobre un nodo ya convertido. Conectada en
dos capas — dentro de `renderAll()`/`renderLista()`/`renderDetalle()`
(cobertura inmediata, sin parpadeo) y un `setInterval` de refuerzo
cada 2 segundos (cubre lo que no pasa por esas funciones, sin tener
que identificar cada una de las ~34 funciones de render una por una).

**Bug real encontrado y corregido en el proceso:** la primera
inserción en `pedidos.html` dejó `aplicarIconosGlobal` sin definir
(0 definiciones, 5 llamadas) — se usó una versión desactualizada del
bloque a insertar. Se detectó con la misma verificación de consistencia
que se viene aplicando en todo el proyecto (contar definiciones vs.
llamadas de cada función tocada) antes de dar el trabajo por cerrado,
no después.

**Duplicado en 2 archivos:** `index.html` y `pedidos.html` son
documentos HTML independientes sin JS compartido — el mapa completo
de 55 íconos vive copiado en ambos. Si se agrega un ícono nuevo, hay
que sincronizar los dos (ver también la nota de duplicación de la
sección 5, que ya señalaba este mismo patrón para los datos de
`RUBROS`).

**No probado en un navegador real** — verificado exhaustivamente por
sintaxis (`node --check` en los 16 archivos del proyecto) y por
consistencia de definiciones/llamadas, pero nunca visto renderizado.
La primera apertura real en un celular es la prueba que falta.

## 8. Mensualidad — pausado automático (pendiente, más adelante)

El sistema de cobro mensual (ver LEEME.md, sección 14) ya avisa qué
tiendas están vencidas, pero no actúa solo — la decisión de pausar una
tienda que no pagó sigue siendo manual. Si más adelante se quiere
automatizar: agregar a `webhookSuscripcion.js` que, cuando el estado
pase a "cancelled" o quede vencido más de X días, escriba
`config/general.abierto = false` de la tienda correspondiente (ya
existe ese campo, index.html ya lo respeta para bloquear pedidos) —
haría falta decidir el umbral de días de gracia antes de pausar, y si
avisar al cliente antes de que pase.

## 9. Dos dominios, dos modalidades de venta (plan en curso)

Decisión de arquitectura de negocio, tomada en sesión — antes de
construir, documentada acá para no perderla.

**Dos dominios, mismo Firebase/Netlify de siempre** (no hace falta
nada nuevo — el sistema ya soporta agregar dominios, ver `dominios/`
en Firestore):

- **Dominio de marca (landing de venta)** — página comercial: reseñas
  de clientes, features, precios, legal/derechos reservados, contacto,
  WhatsApp, chatbot de cotización. Ahí viven `generar-tienda.html` y
  `suscripciones.html` (ya construidos). Servido con un redirect
  condicional por `Host` en `netlify.toml` hacia `landing.html` — NO
  pasa por el mecanismo de `dominios/` de Firestore (eso es solo para
  tiendas de clientes). Pieza técnica ya lista: la regla en
  `netlify.toml` con `conditions = {Host = [...]}`, con un placeholder
  `TU-DOMINIO-DE-MARCA.cl` a reemplazar por el dominio real una vez
  comprado — y `landing.html` con un placeholder mínimo "en
  construcción", a reemplazar por el diseño real (esperando imágenes
  de referencia del usuario para seguir su patrón visual).
- **Dominio de producto** — donde corren las tiendas reales, con el
  DNS de cada cliente apuntando ahí. Es el mismo `index.html`/
  `pedidos.html` de siempre, sin cambios de arquitectura.

**Dos modalidades de venta, mismo motor de código:**

1. **Mensualidad (ya existe)** — el cliente edita solo desde devmode,
   cobro recurrente vía `suscripciones.html` (ver sección 14 del
   LEEME).
2. **Desarrollo a medida / pago único (nueva, no construida)** — mismo
   código base (devmode, gestor de pedidos, todo el sistema), pero el
   diseño se personaliza a medida para ese cliente puntual. Pago único,
   con una mantención opcional aparte (no mensualidad obligatoria).
   Falta definir: ¿esto usa el mismo `crearTienda.js`/`generar-tienda.html`
   con un flag nuevo ("modalidad: pago_unico" vs "mensualidad"), o es
   un flujo separado? Probablemente lo primero — el storeId y la
   tienda en Firestore no cambian de estructura, solo cambia si tiene
   una fila en `suscripciones_plataforma` (mensualidad) o un pago
   único registrado aparte (a definir cómo se registra ese pago único
   — ¿otra colección, `pagos_unicos_plataforma`?).

**Dominios reales — ya comprados y conectados en código (✅):**
- `derlabs.cl` — landing de marca. Redirect condicional por `Host` ya
  apunta a `landing.html` en `netlify.toml` (cubre con y sin "www.").
- `derlabs.store` — dominio de producto, donde corren las tiendas de
  todos los clientes. No necesitó ningún cambio de código — el
  sistema ya resuelve todo por `location.hostname` contra Firestore
  (`dominios/{hostname}`), así que funciona en cuanto se agregue en
  Netlify → Domain management y se registren ahí los dominios de cada
  cliente, igual que se hacía antes con el subdominio de Netlify.
- Un tercer dominio, todavía sin uso decidido — anotarlo acá cuando
  se decida.

**Pendiente:** falta agregar `derlabs.cl` y `derlabs.store` en
Netlify (Domain management → Add domain alias / Add custom domain,
según corresponda a cuál es el dominio principal del sitio) y apuntar
el DNS de cada uno — ver LEEME.md para el detalle de registros DNS.

## 10. Extras y armado de productos (P23) — ✅ hecho

Grupos de opciones con precio, guardados una vez en la tienda
(`config/general.gruposExtras`) y enlazados a cada producto
(`producto.gruposExtras = [ids]`). Tipos: elige 1, elige varios (máx.),
con cantidad (máx. de cada uno) y quitar (sin costo). Opción "Hay" para
marcar un ingrediente agotado. Plantillas: hamburguesa, pizza,
burrito/bowl, shawarma, combo; al aplicar una plantilla se reutilizan los
grupos con el mismo nombre, así que muchos productos comparten "Tamaño" o
"Agrega extras" y se editan en un solo lugar.

El precio lo recalcula el servidor (`calcularExtras` en `_firebase.js`, la
misma lógica que `gxCalcular` en `app.js`). El servidor escribe el detalle
en `variantes`, por eso pedidos, cocina, caja y seguimiento lo muestran
sin cambios. Se corrigió además que los pedidos de MercadoPago perdían
las variantes.

Pendiente:
- Caja (POS): vender productos con extras desde la caja (hoy se cobra el precio base).
- Mitad y mitad real en pizzas (dos sabores con precio del más caro): hoy se arma con un grupo "Segunda mitad".

## 11. Promociones + menú completo en el inicio (P24) — ✅ hecho (estilo App)

"Ofertas de hoy" pasa a "Promociones": lista vertical, interruptor
"En promoción" + "precio antes" por producto (badge de % automático), y
debajo el menú completo por categorías con pestañas fijas. Campos:
`producto.enPromo`, `producto.precioAntes`, `config.destacadosIds` (hasta 6).
En modo DEV: "Elegir destacados" y "Elegir promociones" en el inicio. El
estilo Clásico solo cambia el título a "Promociones". Las barras del
carrusel ahora van dentro de cada tarjeta.

## 12. Segunda pasarela: Flow (P29) — ✅ hecho · camino a Webpay directo

**Flow (Webpay, tarjetas y transferencia): hecho, falta probarlo con una
cuenta real de Flow** (sandbox primero). El comercio pega su API Key y
Secret Key en Panel → Pagos (`config/privado`: `flowApiKey`,
`flowSecretKey`, `flowSandbox`; `config/general.flowActivo` muestra la
opción "Webpay" en el checkout). Se puede tener Mercado Pago, Flow o ambos.
- `crearPago.js` recibe `pasarela: "flow"` y llama a `flow.js` →
  `iniciarPagoFlow()`: `payment/create` firmado (parámetros ordenados,
  nombre+valor, HMAC-SHA256 en `s`), orden única `<pedido>-<azar>`,
  `timeout` de 25 min, y guarda el intento con `flowToken`.
- `/api/webhookFlow` (urlConfirmation): token → `payment/getStatus` → si
  `status == 2` (pagada) crea el pedido (`metodoPago: "flow"`). Revisa que
  el token sea el del intento y que el monto pagado sea el del pedido.
- `/api/retornoFlow` (urlReturn, el navegador llega por POST): consulta el
  estado y redirige a `/?status=approved|pending|failure&pedido_id=`. Si
  la confirmación no llegó, espera 2,5 s y crea el pedido ahí mismo.
- Flow exige el correo del pagador: con Webpay el checkout lo pide también
  a invitados de tiendas de comida (solo con esa forma de pago). Los
  correos de compra de DerLabs siguen la regla del punto 14.
- Mercado Pago no se tocó (`webhookPago.js` igual que antes). La creación
  del pedido está repetida en `flow.js`; unificar ambas más adelante.
- Repartidor, gestor y caja tratan `flow` como pagado en línea.

Webpay Plus directo (para tiendas que ya tienen convenio con Transbank):
- Datos por tienda en `config/privado`: código de comercio + API Key Secret.
- REST con headers `Tbk-Api-Key-Id` / `Tbk-Api-Key-Secret`; crear
  transacción (buy_order ≤ 26, session_id, amount, return_url) → redirigir
  con `token_ws` → en la ruta de retorno hacer commit (PUT) y aprobar si
  `response_code == 0` y `status == AUTHORIZED`. Abandono: llega
  `TBK_TOKEN` sin `token_ws`.
- No hay webhook: la confirmación es el commit en la ruta de retorno, así
  que esa ruta tiene que ser idempotente (si el cliente recarga, no se
  confirma dos veces).
- Integración: código 597055555532 y su llave pública de pruebas.
- Para producción Transbank valida la integración con evidencias, entrega
  la llave secreta y pide una compra real de $50. Antes de abrirlo a
  tiendas, confirmar con soporte@transbank.cl si cada comercio nuevo debe
  validar por separado una integración propia como la nuestra.
- Verificar rutas y versión de la API en transbankdevelopers.cl antes de
  programar (no se pudo leer la referencia oficial al investigar).

## 13. Velocidad, splash y panel ordenado (P26) — ✅ hecho

- Guardar del panel: un solo envío (batch) agrupado por documento, en vez de
  una escritura por campo. Las escuchas de Firestore redibujan una vez.
- Arranque: el Worker inyecta la tienda del dominio (`window.__DL_DOM`) y el
  color; se ahorra la consulta a "dominios". Copia local de la tienda en
  `localStorage` (`dl_tienda_v1_<storeId>`): en la segunda visita se pinta al
  instante y Firestore la actualiza por detrás.
- La tienda ya no espera a Firebase para pintarse: el Worker incrusta
  config, productos, cupones y locales en el HTML (`<script id="dl-datos">`,
  caché de 60 s) y `v26Hidratar()` los usa al arrancar. Las fotos guardadas
  como data: en Firestore se sirven como imágenes normales en `/timg/<c|p|l>/
  <id>/<campo>` (caché de 7 días). Firebase se conecta después y deja todo al
  día. Si el Worker no puede incrustar los datos, se usa la copia local; si
  tampoco hay, el splash queda blanco hasta que Firebase responda.
- Splash estilo Ágil / Roof Burger (`#splashScreen.con-logo`): parte blanco
  con el logo grande; cuando la tienda real ya está pintada pasa a
  transparente oscurecido (`.sobre-tienda`) y se retira. Nunca se ve la
  página de muestra detrás. Al logo se le quita el fondo blanco
  automáticamente (script junto al splash en index.html). Sin logo queda el
  splash blanco con el ícono genérico.
- "Club <nombre>" en Mi cuenta sale del nombre de la tienda (Worker + app.js).
- Términos del servicio definitivos (CONTRATO_VERSION = 2: cada dueño los
  acepta de nuevo al entrar al panel). Pendiente: revisión de un abogado y
  agregar razón social y RUT de DerLabs.
- Panel: inicio por grupos (Ventas, Catálogo, Entrega y cobro, Avisos, Mi
  tienda) con interruptor Tienda abierta/cerrada. Las secciones son las
  mismas. Pendiente: ordenar el interior de cada sección.

## Referencia de diseño (pedido del dueño)

La referencia visual y de flujo para las tiendas de comida es **Ágil** (la
plataforma de roofburger.cl): portada con corte diagonal, splash con el
logo sobre la tienda oscurecida, hoja de producto con grupos
Requerido/Opcional y barra "Agregar $X" fija abajo. Ante la duda en un
diseño nuevo, replicar ese estilo.

## 14. Correo en el checkout (P27) — ✅ hecho

- Con cuenta Google: no se pide; se usa el de la cuenta (verificado).
- Invitado en tienda de comida: no se pide y no se le envía correo.
- Invitado en retail/boutique: opcional, con aviso de errores de tipeo
  comunes (gmial.com, hotmail.con, …).
- `enviarEmails.js` aplica la misma regla en el servidor; el aviso al dueño
  se envía siempre. Motivo: evitar rebotes que dañan la reputación del
  dominio de envío.

## 15. Estado del plan original (numeración corregida)

El plan de fines de septiembre usaba otros números. Así quedó cada punto:

| Plan original | Estado |
|---|---|
| P9–P21 publicados | Hecho |
| P21b reparación automática de dominios | Código subido (cron de 5 min + visitas). Falta verificarlo en producción. |
| P22 vitrina + diseño "Clásico" | Hecho |
| P23 tienda instantánea + imágenes en R2 | Tienda instantánea hecha (sección 13, el Worker incrusta los datos). Imágenes en R2: PENDIENTE (siguen en Firestore, servidas por /timg con caché). |
| P24 panel nuevo | Navegación por grupos hecha (sección 13). Interior de cada sección: PENDIENTE. |
| P25 en adelante: caja | En curso (sección 16). |

Los números P23–P27 de las secciones 10–14 son los que se usaron después
para extras, promociones, hoja de producto, velocidad/panel y correo.

## 16. Caja local a nivel profesional (competir con Fu.do / Toteat)

Objetivo del dueño: que todo el sistema del local quede completo y
profesional. Principal: imprimir en las térmicas que los locales ya tienen.
Alternativa: pantallas en vez de papel.

Ya existía: mesas por zona, para llevar, rondas, cobro mixto / por partes /
por productos, propina 10% con un toque, descuentos, turnos y cierre,
personal (cajero, garzón, cocina), pantalla de cocina con tiempos y sonido,
reparto propio y PedidosYa Envíos.

**Caja 1 — vender completo: ✅ hecho.** Extras y armado en la caja
(`local-util.js` → `DL.extras`, precio recalculado por `cajaLocal.js` con
`calcularExtras`). Precuenta para todos los roles.

**Caja 2 — impresión y estaciones: ✅ hecho, falta probar con una impresora
real.** `local-util.js` → `DL.print`: comanda por estación, precuenta y
comprobante, en 58 u 80 mm. Dos métodos por equipo (se guarda en el equipo,
no en la tienda): "Directa" con la app RawBT en Android (ESC/POS, página de
códigos 850) y "Del sistema" (diálogo de impresión del navegador).
Estaciones: `config.cajaBarra` = categorías que van a la barra; el resto es
cocina. Cada producto vendido guarda `cat`. La pantalla de cocina puede
mostrar solo una estación y cada una marca lo suyo (`estListas` en el
pedido); la ronda queda lista cuando terminan todas. La pantalla de cocina
también puede imprimir sola las comandas que llegan.
Por confirmar en un local: que Chrome deje imprimir sin tocar la pantalla
con RawBT (si no, queda el botón 🖨 de cada comanda).

**Caja 3 — mesas: ✅ hecho.** Plano del salón por zona: cada mesa guarda
`forma` (cuadrada, redonda, larga, barra), `sillas` y su casilla (`x`, `y`)
en `config.cajaMesas`; el dueño lo arma en "Editar plano" (arrastrar o tocar
mesa y casilla). Sin plano guardado las mesas se muestran en fila, como
antes. Colores: libre, ocupada, pago parcial y "pidió la cuenta"
(`pedido.cuentaPedida`, se marca al abrir la pre-cuenta y se borra al
agregar productos). En el pedido: `garzon`, `personas`, `mesasUnidas`
(mesas juntadas a la cuenta) y `com` en cada producto (0 = para compartir,
1..n = comensal). Acciones nuevas en `cajaLocal.js`: `datosMesa`,
`pedirCuenta`, `asignarComensal`, `moverItems` (a mesa libre u ocupada; si
el origen queda vacío se libera con `movida: true` y no cuenta como
anulación), `juntarMesas`, `separarMesas`. `pagar` acepta `com` y `propina`
por pago (cobro "Por comensal": lo propio + la parte de lo compartido).
Las acciones que usan la posición de un producto mandan `n` (cuántos veía
la caja) y el servidor las rechaza si la cuenta cambió en otro equipo.
Por confirmar en producción: la consulta de cuentas abiertas
(`canal == local` y `cerrado == false`); si Firestore la rechazara, la
función usa sola la consulta por fecha de las últimas 36 horas.
Pendiente menor: comensal en la comanda impresa y pre-cuenta impresa por
persona.

**Caja 4 — boleta electrónica SII:** solo para el plan Pro y solo para
pagos en efectivo o transferencia (el comprobante de tarjeta, en máquina o
por internet, vale como boleta según el SII; el local debe declarar ese
modelo de emisión). Se descartó el bot sobre el portal gratuito del SII.
Camino elegido: una sola cuenta de DerLabs en SimpleAPI (12 UF al año,
compartida entre todos los RUT) y cada local con su certificado digital.
Antes de programar hay que confirmar: el trámite de inscripción de cada
local como emisor, el precio del certificado y que ese plan de SimpleAPI
cubra boletas. La propina va fuera de la boleta. Hoy los tickets dicen
"Documento interno. No es boleta".

**Caja 5 — control:** arqueo ciego, propinas por garzón y período, ventas
por hora / garzón / canal, exportar a Excel.

**Después:** QR por mesa para pedir desde el celular, recetas e insumos,
funcionamiento sin conexión.

## 17. Planes Básico y Pro (P28) — ✅ hecho

- **Básico:** tienda online, gestor de pedidos, GPS y repartidores. Pagos por
  Mercado Pago (su comprobante vale como boleta). El efectivo en retiro o
  entrega sigue disponible y esa boleta la emite el local por su cuenta.
- **Pro:** todo lo anterior + caja local, mesas, cocina e impresión (y la
  boleta SII cuando esté). Solo tiendas de comida.
- La verdad del plan vive en `planes/{storeId}` (colección sin reglas: solo
  la lee y escribe el Worker). `config/general.plan` y `cajaLocal` son una
  copia para el panel y la caja. `planTienda.js` → `planDe()` lo revisa en
  cada llamada de `cajaLocal.js` (memoria de 60 s por instancia, así que un
  cambio de plan puede tardar un minuto en notarse).
- `/api/planTienda` (clave de administrador): `listar` y `cambiar`. Se usa
  desde "Planes de las tiendas" en `generar-tienda.html`. La primera vez
  que se lista, las tiendas antiguas quedan registradas con lo que tenían
  (con caja local → Pro; sin ella → Básico).
- Panel de la tienda: fila "Caja y mesas" en Ventas. En Básico muestra la
  etiqueta "Pro" y al tocarla avisa "Solo disponible en el plan Pro" con un
  botón que escribe al WhatsApp de DerLabs. `/caja` y `/cocina` muestran el
  mismo aviso.
- Pendiente: cobro automático de la suscripción según el plan.
