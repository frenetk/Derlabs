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
