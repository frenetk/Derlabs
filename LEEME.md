# LEEME — Tienda de hamburguesas (proyecto independiente)

Este es un proyecto separado, sin nada de DerLabs — la tienda vive en la
raíz de su propio dominio de Netlify.

## Qué contiene

| Archivo | Qué es |
|---|---|
| `index.html` | La tienda — catálogo, checkout, pagos con MercadoPago |
| `pedidos.html` | Panel de gestión de pedidos en tiempo real |
| `formulario.html` | Formulario público (tipo Google Forms) — lo mandas tú a quien quieras |
| `formulario-respuestas.html` | Panel privado con las respuestas del formulario, protegido con tu login |
| `netlify/functions/` | Backend — ver `netlify/functions/README-FIRESTORE-RULES.md` para las reglas de Firestore, imprescindibles antes de subir esto a producción |

## 1. Antes de subir — verifica tu Firebase

Este proyecto usa `STORE_ID = "test-burgers"` en los 4 archivos HTML.
Si vas a conectarlo al mismo Firebase que ya tenías funcionando, no hay
que tocar nada — todos los pedidos, config y datos ya existentes van a
seguir ahí. Si prefieres arrancar con un Firebase totalmente nuevo,
avísame y actualizamos `FIREBASE_CONFIG` en los 4 archivos.

**Importante si venís de una versión anterior de este proyecto:** la
configuración de la tienda ahora vive en dos documentos separados en vez
de uno — `config/general` (público) y `config/privado` (tu Access Token
de MercadoPago, tu Resend API Key, y tus emails de notificación). Si ya
tenías datos guardados con el esquema viejo (todo junto en un solo
documento), hay una migración de un solo paso antes de pegar las reglas
nuevas — está explicada en `netlify/functions/README-FIRESTORE-RULES.md`.
Si es una tienda nueva, no hay nada que migrar: `index.html` ya crea
ambos documentos separados desde el primer guardado.

## 2. Variables de entorno en Netlify

Igual que siempre, en Site configuration → Environment variables:

| Key | Para qué |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Acceso del backend a Firestore |
| `MP_ACCESS_TOKEN` | Respaldo para cobros con MercadoPago — solo se usa si `webhookPago.js` no puede determinar de qué tienda es un pago por algún motivo (ver Paso 3 de la sección 9). Mientras haya una sola tienda, conviene que sea el mismo Access Token que guardás en el paso 5 de abajo |
| `VAPID_PUBLIC_KEY` | Notificaciones push |
| `VAPID_PRIVATE_KEY` | Notificaciones push |
| `VAPID_SUBJECT` | Notificaciones push (`mailto:tu-correo@gmail.com`) |
| `ADMIN_SECRET` | Clave que protege `generar-tienda.html` y `suscripciones.html` — ver sección 9. Elegí algo largo y único, no una contraseña que uses en otro lado |
| `PLATAFORMA_MP_TOKEN` | Access Token de TU cuenta de MercadoPago (no la de ningún cliente) — cobra la mensualidad de la plataforma. Ver sección 14 |

El Access Token de MercadoPago y tu Resend API Key **no** van acá — esos
se guardan desde dentro de la tienda, en devmode (`?dev=1`) → tabs Pagos
y Emails respectivamente, con tu usuario logueado. Quedan en
`config/privado`, protegido por las reglas de Firestore para que nadie
más que vos pueda leerlos.

## 3. Reglas de Firestore — paso obligatorio antes de producción

Ver `netlify/functions/README-FIRESTORE-RULES.md` para las reglas
completas para copiar y pegar en Firebase Console → Firestore Database →
Reglas, por qué están estructuradas así (separan lo que cualquier
visitante necesita leer de lo que solo vos deberías ver, como tu token
de MercadoPago) y cómo crear la cuenta de propietario (ver sección 8 más
abajo). Sin esto pegado, la tienda funciona igual, pero con un nivel de
protección menor al que el código está diseñado para tener.

## 4. Formulario propio — cómo se usa

`formulario.html` es un formulario público de 6 pasos (negocio, contacto,
identidad visual, entrega, dominio, notas) — cualquiera con el link lo
puede completar, sin login. Cada envío se guarda como una respuesta
independiente con su propio ID.

Para ver lo que te respondieron, entrás a `formulario-respuestas.html`
con el mismo usuario y contraseña que ya usas en `pedidos.html`. Ahí
aparece la lista completa, con badge "NUEVA" en las que no revisaste,
y el detalle completo al tocar cualquiera.

Si adjuntás un logo en el paso 3, la imagen se comprime sola en tu
navegador antes de guardarse (se redimensiona y ajusta la calidad hasta
quedar bien por debajo del límite de 1 MB que tiene cada documento en
Firestore) — no hace falta que la comprimas vos a mano. Si aun así una
imagen no logra comprimirse lo suficiente (raro, prácticamente solo con
fotos extremadamente detalladas), el formulario te avisa para que
pruebes con otra.

## 5. Después del deploy

- Verifica conexión en `index.html?dev=1` → tab Pagos
- Confirma que las notificaciones push lleguen con un pedido de prueba
- El botón 🗑️ en `pedidos.html` te deja eliminar pedidos manualmente
- **Limpieza de intentos de pago sin completar** — hay DOS mecanismos,
  ambos activos:
  1. `netlify/functions/limpiarPendientes.js`, una scheduled function
     que Netlify ejecuta automáticamente cada 5 minutos, corra o no
     `pedidos.html` abierto en algún navegador.
  2. Un respaldo del lado del cliente dentro de `pedidos.html` que hace
     lo mismo cada 5 minutos, pero solo mientras esa pestaña esté
     abierta con sesión iniciada.
  El segundo existe por si el primero no llega a ejecutarse — las
  scheduled functions consumen del mismo presupuesto de cómputo que el
  resto de tus funciones, revisa el plan de Netlify que tengas
  contratado para saber si eso te alcanza sin costo extra. Ninguno de
  los dos borra nunca un registro marcado "error" — esos quedan para que
  los revises a mano (ver sección 7).

## 6. Cupones y banners — arreglados en una sesión anterior

Ambos tenían el mismo bug: el botón de crear no tenía ningún listener
(no hacía nada al tocarlo) y la lista de existentes nunca se
renderizaba. Ya está resuelto — desde `index.html?dev=1`:

- **Tab Cupones** → completa el formulario (código, tipo, valor) →
  "Crear cupón". Aparece de inmediato en "Cupones existentes", con
  botones para activar/desactivar o eliminar. Crear, editar o eliminar
  un cupón ahora pide la clave de propietario (ver sección 8).
- **Tab Promos** → completa título/subtítulo/emoji/color → vista previa
  en vivo idéntica a como se ve en la tienda → "Agregar banner".
  Importante: los banners son tarjetas de color + emoji + texto, **no
  soportan imagen subida** — si necesitas banners con imagen real, es
  una función nueva a construir, no lo que existe hoy.

Si tenías cupones viejos creados antes de este fix (por ejemplo
BIENVENIDO10 o ENVIOGRATIS con el error "no es canjeable online"),
bórralos desde la lista y créalos de nuevo con el formulario — los
viejos no se corrigen solos porque les falta el dato del valor del
descuento, que antes no se guardaba en ningún lado.

## 7. Checkout — el pedido nace solo cuando el pago se confirma

El pedido se crea SOLO cuando MercadoPago confirma el pago real (vía
webhook) — nunca antes. Mientras alguien esté completando el pago en
MercadoPago, no existe ningún pedido en `pedidos.html`; recién aparece,
ya como "nuevo" y con notificación disparada, cuando el pago está
confirmado de verdad.

**El historial de este diseño, para que quede claro por qué está
armado así:**
- Primero, el pedido se creaba al tocar "Pagar" (visible como "pago
  pendiente" desde el principio). Funcionaba, pero mostraba pedidos
  sin pagar en el panel — molesto para el día a día.
- Se probó crear el pedido solo desde el webhook, sin ningún registro
  intermedio. Un pago real de $50 se acreditó en MercadoPago pero el
  pedido nunca apareció en ningún lado — el webhook falló en silencio
  y no quedó ningún rastro del pago.
- Este diseño final resuelve ambos problemas: el pedido nace solo
  cuando el pago se confirma, pero cada intento de pago deja un
  registro de auditoría — invisible en el uso normal, pero ahí si algo
  falla.
- En una sesión posterior se sumó otra pieza: antes de crear ese
  registro de auditoría, ahora se revalida el pedido completo contra
  Firestore (precio real de cada producto, stock disponible, validez
  del cupón) — el registro de auditoría no servía de nada si auditaba
  montos que el navegador del comprador pudo haber manipulado antes de
  mandarlos. Ver la sección 10 para el detalle completo de este punto.

**Cómo funciona en la práctica:** al tocar "Pagar con MercadoPago", se
guarda un registro en `tiendas/{storeId}/intentos_pago/{id}` — nunca
un pedido, nunca dispara notificación. Cuando MercadoPago confirma el
pago (webhook), recién ahí se crea el pedido real y el registro pasa a
"confirmado". Si el pago se confirma pero algo falla creando el
pedido, el registro queda marcado "error" con el detalle del fallo, en
vez de desaparecer.

**Revisalo en devmode → Pagos → "Intentos de pago sin confirmar".**
Muestra solo lo que necesita tu atención: registros en "error"
(pagaron pero el pedido no se creó — hay que investigar) o en
"iniciado" por más de 3 minutos (probablemente cerraron el checkout
sin pagar, no requiere acción, pero podés confirmarlo). Los que
terminaron bien ("confirmado") no se muestran — no hay nada que
revisar ahí.

Los registros que quedan en "iniciado" por más de 30 minutos se borran
solos (ver sección 5) — los que están en "error" NUNCA se borran
automáticamente, quedan para que los revises a mano.

**El pago en efectivo sigue un camino distinto, a propósito:** cuando
el comprador elige pagar en efectivo, no hay ninguna pasarela externa
de por medio — el vendedor cobra en persona al entregar. Ahí no existe
el problema que motivó `intentos_pago` (un aviso externo que puede
fallar en silencio), así que el pedido se valida y se crea directo, sin
pasar por un estado intermedio. Ver `netlify/functions/crearPedidoEfectivo.js`
para el detalle — usa exactamente la misma validación de precios/stock/
cupón que el flujo de MercadoPago.

## 8. Protección contra abuso — segunda clave solo para lo sensible

Cualquiera con la clave diaria de devmode podía crear cupones de
cualquier descuento, cambiar precios, o registrar ingresos/egresos
falsos. Ahora esas tres acciones piden una segunda clave — la de
propietario — que solo maneja el dueño del negocio.

**El resto de devmode no cambia en nada:** el login estándar (el
mismo usuario y contraseña de siempre) sigue entrando a todo lo
normal — marcar pedidos, subir fotos, cambiar stock, ajustar el
catálogo — sin pedir nada adicional. La segunda clave interrumpe
únicamente en tres momentos puntuales: crear/editar/eliminar un
cupón, cambiar el precio de un producto, o registrar un
ingreso/egreso.

**Estructura en Firestore — colección `usuarios`:**
```
usuarios/{uid} → { roles: { "test-burgers": "propietario" } }
```
Solo la cuenta que va a manejar la segunda clave necesita este
documento. El login estándar de devmode (`pedidos.html`, y el resto
de devmode salvo cupones/precios/caja) no consulta esta colección en
absoluto — cualquier cuenta autenticada entra igual.

**Para crear la cuenta de propietario:**

1. Firebase Console → Authentication → Add user → email y contraseña
   que solo el dueño del negocio va a conocer.
2. Firebase Console → Firestore → colección `usuarios` → documento con
   ID = el UID de esa cuenta → campo `roles` (map) con la entrada
   `"test-burgers": "propietario"`.
3. Firebase Console → Firestore → Reglas → pegá las reglas de
   `netlify/functions/README-FIRESTORE-RULES.md` y publicá.

**Cómo funciona en el día a día:** al crear un cupón, cambiar un
precio, o guardar un ingreso/egreso, aparece un cuadro pidiendo la
cuenta de propietario — sin cerrar la sesión de devmode que ya estaba
abierta. Si esa cuenta no tiene `"propietario"` para el `storeId` de
esa tienda en el mapa `roles`, se rechaza igual, aunque las
credenciales sean correctas.

**Por qué es seguro de verdad y no un candado visual:** la protección
real vive en las reglas de Firestore, que corren en los servidores de
Google y verifican `roles[storeId]` antes de aceptar cualquier
escritura en cupones, precios, o caja — no en el JavaScript del
navegador, que cualquiera puede leer con clic derecho → Ver código
fuente.

**No se pudo probar de punta a punta.** No hay forma de correr un
proyecto Firebase real desde este entorno de trabajo — se armó y
revisó la sintaxis con cuidado, pero no se desplegó contra un
Firestore real. Probá con las dos cuentas apenas la despliegues, antes
de confiarte del todo.

## 9. Proceso completo — instalar una tienda nueva para un cliente

**Modelo multi-dominio: un solo deploy de código en Netlify, un solo
proyecto de Firebase, muchos dominios.** Ya no hace falta crear un
sitio de Netlify por cliente ni editar `STORE_ID` a mano en 4
archivos — cada dominio resuelve su tienda automáticamente al arrancar,
consultando la colección `dominios` de Firestore (ver
`netlify/functions/README-FIRESTORE-RULES.md`). El cliente nunca
recibe accesos de infraestructura, solo el producto funcionando.

### Opción rápida — `generar-tienda.html`

Reemplaza el Paso 1 y el Paso 2 de abajo en un solo formulario:
1. Entrá a `tu-dominio/generar-tienda.html` e ingresá el
   `ADMIN_SECRET` que configuraste en Netlify (ver sección 2).
2. Completá nombre del negocio, elegí el rubro (aplica su paleta de
   color automáticamente — la vista previa te muestra cómo va a
   quedar, para mostrarle al cliente antes de confirmar), y el
   dominio del cliente.
3. Opcionalmente, desplegá "Crear también la cuenta de propietario
   ahora" y completá email/contraseña — si lo dejás en blanco, podés
   crear esa cuenta después (Paso 5).
4. "Crear tienda" — queda sembrada `config/general`, `config/privado`,
   y el dominio registrado, todo en un paso. El resultado te muestra
   los pasos que siguen siendo manuales (Paso 3 y el DNS/Netlify).

Esto todavía no sube imágenes (logo, splash) — si el cliente las
tiene, se suben después desde devmode una vez que la tienda ya existe.

Si preferís hacerlo a mano, o el panel no está disponible por algún
motivo, seguí los Pasos 1 y 2 de abajo — hacen exactamente lo mismo
que el formulario, escrito directamente en Firebase Console.

### Paso 1 — Elegir el storeId y sembrar la tienda (manual)

1. Elegí un `storeId` nuevo y único (ej: `pizzeria-juan`, sin espacios
   ni tildes).
2. Firebase Console → Firestore → colección `tiendas` → creá el
   documento `{storeId}` con sus subcolecciones `config/general` y
   `config/privado` (podés copiar la estructura de `test-burgers` como
   plantilla) — nombre, color, rubro, y el resto del contenido se
   termina de ajustar después desde devmode, no hace falta completarlo
   todo acá.

### Paso 2 — Registrar el dominio (manual)

Firebase Console → Firestore → colección `dominios` → creá el
documento con ID = el hostname exacto del cliente (ej.
`pizzeriajuan.cl`, sin `https://` ni barra final) → campo `storeId`
con el valor del Paso 1.

Sin este documento, el dominio del cliente muestra la tienda de
prueba por defecto en vez de la suya — es el paso que más fácil se
olvida, y el único que realmente conecta un dominio con una tienda.

### Paso 3 — Apuntar el dominio hacia Netlify

1. En el registrador de dominios del cliente (o el tuyo, si lo
   compraste vos en su nombre): creá un registro DNS apuntando al
   sitio de Netlify — esto pasa fuera de este proyecto, en el panel
   del registrador.
2. Netlify → tu sitio → Domain management → Add custom domain →
   agregá el mismo hostname que usaste en el Paso 2.

### Paso 4 — El cliente configura SU MercadoPago

Cada tienda cobra a través del MercadoPago del cliente, no del tuyo.
`crearPago.js` guarda el `storeId` en la URL del webhook, así que
`webhookPago.js` sabe pedirle a Firestore el token de **esa tienda
específica** (desde `config/privado`), no un token único compartido.

El cliente (o vos, en su nombre) entra a `su-dominio/?dev=1` → tab
Pagos → pega su propio Access Token de MercadoPago → Guardar.

### Paso 5 — Cuenta de acceso al devmode (obligatorio)

Sin este paso, **nadie va a poder entrar al devmode de esta tienda**
— ni vos, ni el cliente — porque el login ahora exige que la cuenta
tenga un rol asignado para este `storeId` específico (ver sección 12).

1. Firebase Console → Authentication → Add user → creá una cuenta con
   el email/contraseña que le vas a entregar al cliente (o que vas a
   usar vos mismo para administrar esta tienda).
2. Firebase Console → Firestore → colección `usuarios` → documento con
   ID = el UID de esa cuenta → campo `roles` (map) con la entrada
   `"su-storeId": "propietario"` (el storeId del Paso 1).
3. Repetí esto por cada cuenta adicional a la que quieras darle
   acceso a esta tienda (empleados, cajeros) — cada una necesita su
   propia fila en `usuarios`, aunque el valor sea el mismo
   `"propietario"` (hoy es el único rol que existe; ver sección 12
   sobre un posible rol intermedio a futuro).

### Paso 6 — Acuerdo de responsabilidad

Como todas las tiendas comparten tu infraestructura, lo que un cliente
suba (productos, imágenes, textos) queda alojado en tu Firebase y tu
Netlify. Ya existe un mecanismo técnico para esto — ver sección 13 —
pero **el texto legal que ahí se muestra es un placeholder**, tiene que
pasar por un abogado antes de usarse con un cliente real. Como mínimo,
el contrato debería cubrir:
- Todo lo que venda o publique debe ser legal, y es responsabilidad
  del cliente, no tuya.
- Te reservás el derecho de dar de baja el sitio si incumple.
- Las credenciales de devmode son personales e intransferibles.
- Si vendés el dominio como parte del servicio (no que el cliente
  traiga el suyo): quién queda como titular ante el registrador, y qué
  pasa con el dominio si el cliente deja de pagarte.

## 10. Fixes de seguridad de esta sesión

Esta sesión partió de dos versiones de este proyecto que habían
evolucionado por separado: una con el diseño de `intentos_pago` y la
segunda clave de propietario (secciones 7 y 8), y otra con una serie de
fixes de seguridad distintos. Se fusionaron ambas — lo que sigue es lo
que trajo la segunda mitad, ya integrado:

- **El precio de cada producto ya no se confía del navegador al cobrar.**
  Antes, tanto `crearPago.js` como el flujo de efectivo tomaban el
  precio de cada ítem directo del carrito armado en el cliente, sin
  volver a compararlo contra el catálogo real. Cualquiera con las
  devtools abiertas podía interceptar esa llamada y pagar lo que
  quisiera por cualquier producto. Ahora ambos flujos (`crearPago.js` y
  el nuevo `crearPedidoEfectivo.js`) releen cada producto desde
  Firestore antes de crear el registro de auditoría o el pedido —
  usando `validarPedidoCompleto()` en `_firebase.js`, la misma función
  para los dos, así las reglas de negocio (cupones, stock) no divergen
  entre ambos con el tiempo.
- **`config` se partió en `general` (público) y `privado` (dueño
  autenticado)** — antes el Access Token de MercadoPago y la API key de
  Resend vivían en el mismo documento que el catálogo público, así que
  cualquier regla que hiciera legible ese documento (necesaria para que
  la tienda funcione sin login) exponía los secretos junto con el
  resto. Ver la sección 1 de este LEEME y
  `netlify/functions/README-FIRESTORE-RULES.md` para el detalle
  completo, incluida la migración si esta tienda ya tenía datos con el
  esquema viejo.
- **La API key de Resend dejó de viajar en cada request de email** — el
  cliente la mandaba en el body de cada llamada a `enviarEmails.js`,
  visible en la pestaña Network del navegador de cualquier comprador.
  Ahora `enviarEmails.js` siempre la resuelve internamente con
  `getStoreConfig()`.
- **El logo del formulario público ya no puede romper el envío
  completo** — se guarda como Base64 embebido en un documento de
  Firestore, que tiene un límite duro de 1 MB. Antes, cualquier logo de
  más de ~700 KB (común en fotos de celular sin comprimir) hacía fallar
  el envío de las 6 páginas del formulario, no solo el logo. Ahora se
  comprime sola en el navegador antes de guardarse (ver sección 4).
- **`dispositivos`, `email_logs`, `formularios` e `intentos_pago`
  dejaron de ser de lectura pública** en las reglas de Firestore — antes
  quedaban expuestos por el mismo comodín recursivo que exponía
  `config`. Ver `netlify/functions/README-FIRESTORE-RULES.md` para el
  detalle de cada colección.

Estos fixes y el sistema de `intentos_pago`/roles de propietario no se
pisan entre sí — tocan capas distintas del mismo problema (quién puede
escribir qué, cuánto se confía en lo que manda el cliente) y quedaron
verificados juntos, sin que uno rompa al otro.

## 11. Pendiente para la próxima sesión — Emails

El sistema de emails en devmode (tab Emails) pide una Resend API Key y
un email emisor, pero no hay ninguna guía de cómo configurar el dominio
o verificarlo — quedó pendiente de revisar en detalle.

## 12. Escalera de acceso — cómo queda, en dos niveles

Se probó una versión más estricta (login estándar exigiendo un rol
asignado por tienda en Firestore, no solo estar autenticado) y se
descartó por pedido explícito — quedaba más compleja de lo necesario
para cómo se usa el producto en la práctica. El diseño final es más
simple, en dos niveles:

1. **Login estándar de devmode** (usuario y contraseña de Firebase
   Authentication) — entra a `pedidos.html` para marcar pedidos, y a
   devmode para lo básico: fotos, stock, catálogo, config general
   (incluyendo `config/privado` — cualquier cuenta con este nivel puede
   guardar el token de MercadoPago o la API key de Resend de su propia
   tienda). **Necesita tener algún rol asignado en
   `usuarios/{uid}.roles[storeId]`** para poder entrar — cualquier
   valor sirve para este nivel básico (hoy el único valor que existe es
   `"propietario"`, así que en la práctica hoy toda cuenta con acceso
   también tiene automáticamente el nivel 2; si en el futuro se agrega
   un rol intermedio tipo `"operador"`, ese alcanzaría para este nivel
   sin dar acceso al nivel 2).
2. **Segunda clave de propietario** — exclusiva para crear/editar
   cupones, cambiar el precio de un producto, o registrar un
   ingreso/egreso. Exige específicamente `roles[storeId] ==
   "propietario"` (ver sección 8).

Tanto el login básico como la clave de propietario están protegidos
**del lado del servidor** — las reglas de Firestore verifican el rol
antes de aceptar cualquier lectura o escritura, no solo el JavaScript
del navegador (que cualquiera puede saltarse desde la consola). Esto
importa especialmente cuando el mismo Firebase hospeda varias tiendas
de clientes distintos (modelo DerLabs): antes, cualquier cuenta válida
del proyecto compartido podía entrar al devmode básico de *cualquier*
dominio con solo conocer o adivinar credenciales ajenas — el login del
cliente rechazaba la contraseña incorrecta, pero no comprobaba si esa
cuenta tenía permiso para *esa tienda en particular*. Ahora sí: sin una
fila en `usuarios/{uid}.roles[storeId]`, ni el cliente ni el servidor
dejan entrar, sin importar si el email/contraseña son válidos en el
proyecto.

**Consecuencia práctica al dar de alta un cliente:** toda cuenta a la
que le des acceso al devmode de una tienda —no solo la que va a manejar
cupones/precios/caja— necesita su documento en `usuarios/{uid}` con
`roles: { storeId: "propietario" }` (ver sección 8 para los pasos
exactos). Antes de este cambio, "crear la cuenta en Authentication"
alcanzaba para el nivel básico; ahora hace falta ese segundo paso
también para el nivel básico, no solo para la segunda clave.

## 13. Notificaciones y alertas — dos mecanismos distintos, con un límite real

Este proyecto avisa de un pedido nuevo de dos formas que dependen de
cosas completamente distintas:

- **Dentro de `pedidos.html` abierto** (sonido de tres notas, vibración
  corta, y un mensaje rojo que aparece y se va en pantalla) — solo
  funciona si esa pestaña está abierta y visible en algún navegador.
  Si el teléfono está bloqueado o la pestaña en segundo plano, este
  mecanismo no puede sonar, porque el JavaScript de una pestaña no
  visible no corre — no es un bug, es cómo funciona cualquier
  navegador.
- **Notificación push del sistema** (la que aparece en la barra de
  notificaciones de Android, funcione o no `pedidos.html` abierto) — es
  la que sí puede avisar con el teléfono bloqueado o en el bolsillo. Ya
  usa `vibrate` con un patrón largo, `requireInteraction` (se queda en
  pantalla hasta que la tocás, no desaparece sola), y `Urgency: high`
  del lado del servidor.

**El límite real, sin adornarlo:** si el push suena con la pantalla
bloqueada no lo decide el código de esta tienda — lo decide Android,
mirando dos cosas: el perfil de sonido del teléfono en ese momento
(silencio total apaga cualquier sonido de cualquier app, sin excepción)
y el canal de notificación que Android le asignó a Chrome para este
sitio. La especificación web tiene un campo para elegir un sonido
personalizado, pero **ningún navegador lo implementa todavía** — no es
algo que se pueda forzar desde el código, es una limitación de la
plataforma, no de este proyecto.

**Lo que sí hay que configurar una sola vez, en el celular del
vendedor**, para que el push tenga la mejor chance de sonar con la
pantalla bloqueada:

1. Ajustes de Android → Apps → Chrome → Notificaciones.
2. Buscá el sitio (aparece como el dominio de la tienda, algo como
   `storesbyderlabs.netlify.app` o el dominio propio si tiene uno) —
   puede que primero tengas que haber recibido al menos una
   notificación para que aparezca en esta lista.
3. Entrá a esa entrada y asegurate de que la Importancia esté en
   **Alta** o **Urgente**, y elegí un sonido si el listado te lo
   permite.
4. Confirmá que el teléfono no esté en modo Silencio o No Molestar
   cuando esperás pedidos — eso apaga el sonido de todo, sin
   excepción, por diseño de Android.

Sin este paso, la notificación puede seguir llegando y vibrando, pero
el sonido puede no sonar según cómo Android haya clasificado el canal
por defecto la primera vez.

## 13. Aceptación de contrato/términos de servicio

Cada cuenta que entra al devmode de una tienda, la primera vez, ve un
cuadro con el texto del contrato y tiene que tildar "Leí y acepto" para
poder seguir — no se puede saltar. Queda guardado en
`tiendas/{storeId}/contratos/{uid}` quién aceptó, cuándo (fecha y hora
exacta), y qué versión del contrato, más el user agent del navegador
como dato adicional. Ese registro es **inmutable** — ni vos ni el
cliente pueden editarlo ni borrarlo después, para que sirva como
evidencia real.

**Antes de usar esto con un cliente real:**

1. Abrí `index.html`, buscá `#contratoTexto` en el HTML — ahí está el
   texto de ejemplo marcado con "⚠️ TEXTO DE EJEMPLO". Reemplazalo por
   el contrato real que te arme un abogado. Esta pantalla resuelve el
   mecanismo (bloquear, registrar quién/cuándo/qué versión) — el
   contenido legal en sí necesita esa revisión, no alcanza con el
   placeholder.
2. Si el contrato cambia más adelante, subí el número en
   `const CONTRATO_VERSION = 1;` (buscalo en el mismo archivo) — con
   eso, todas las cuentas (aunque ya hubieran aceptado una versión
   anterior) van a volver a ver la pantalla hasta aceptar la nueva.

**Cómo revisar quién aceptó qué:** Firebase Console → Firestore →
`tiendas/{storeId}/contratos` → cada documento tiene como ID el UID de
la cuenta que aceptó, y adentro `version`, `email`, `aceptadoEn`.

**Límite real, para que no genere una falsa sensación de seguridad
legal:** esto es un mecanismo de registro, no una asesoría legal. Que
el sistema guarde "esta cuenta aceptó tal fecha" es un dato técnico
útil como evidencia, pero si el contrato en sí tiene un hueco (por
ejemplo, algo mal redactado sobre titularidad de dominio, o una
cláusula que no es válida según la ley chilena), ese hueco sigue
estando ahí sin importar cuántos clientes lo hayan aceptado con un
clic — la solidez del contrato depende de que lo revise un abogado,
no de este mecanismo.

## 14. Mensualidad — cobro recurrente a cada cliente

Sistema de cobro automático mensual, separado por completo del cobro
de las tiendas a sus compradores — este usa TU MercadoPago, no el de
ningún cliente. Los archivos: `crearSuscripcionPlataforma.js` (genera
el link de cobro recurrente), `webhookSuscripcion.js` (confirma cuando
el cliente autoriza y cada cobro mensual siguiente),
`listarSuscripciones.js` (alimenta el panel), `suscripciones.html` (el
panel en sí, con la clave de `ADMIN_SECRET`).

**Paso manual obligatorio, en el panel de MercadoPago (tu cuenta) —
sin esto, nunca te vas a enterar de que un cliente autorizó ni de los
cobros siguientes:**

1. Entrá al panel de MercadoPago con la cuenta que va a recibir la
   mensualidad (no la de ningún cliente).
2. Buscá la configuración de Webhooks/Notificaciones de tu integración.
3. Activá los tópicos `subscription_preapproval` y
   `subscription_authorized_payment`.
4. La URL de notificación es
   `https://tu-dominio/.netlify/functions/webhookSuscripcion`.

MercadoPago no deja configurar esto desde la API — según su propia
documentación, hay que activarlo desde el panel.

**Cómo crear la mensualidad de un cliente:** en `generar-tienda.html`,
al dar de alta la tienda, desplegá "Iniciar la mensualidad de este
cliente ahora" y completá el monto — necesita el email del propietario
completado también (arriba, en el bloque de la cuenta), porque ahí es
donde se manda el link de autorización. Si preferís, podés dejarlo en
blanco al crear la tienda y correr el formulario de nuevo después con
el mismo dominio para agregar la mensualidad más tarde.

**Cómo revisar vencimientos:** `tu-dominio/suscripciones.html`, misma
clave de `ADMIN_SECRET`. Muestra cada tienda con su estado — al día,
por vencer (dentro de 5 días), vencida, pendiente de que el cliente
autorice, pausada, o cancelada. La decisión de qué hacer con una
tienda vencida (pausarla, contactar al cliente) sigue siendo tuya,
manual — este panel solo te da la visibilidad, no actúa solo. Ver
`ROADMAP.md` si más adelante se quiere automatizar esa parte también.

## 15. Panel del landing — contenido, reseñas y métricas

`derlabs.cl/landing.html#dev` (o simplemente `/#dev` si el redirect
del dominio ya sirve `landing.html` en la raíz) abre un panel con 3
pestañas: **Contenido** (textos del hero, precios mostrados, frase del
footer — se editan sin tocar código y se reflejan al toque en la
página pública), **Reseñas** (agregar/editar/borrar testimonios de
clientes reales — nunca se inventan reseñas, la sección se queda con
"todavía no hay reseñas" hasta que cargues la primera), **Métricas**
(tiendas totales, suscripciones activas, facturación mensual — lee lo
mismo que `suscripciones.html`, pidiendo la misma clave de
`ADMIN_SECRET` aparte, solo para esa pestaña).

**Cómo entrar:** a diferencia de `generar-tienda.html`/
`suscripciones.html` (protegidos solo con `ADMIN_SECRET`), este panel
usa Firebase Auth real — porque escribe directo a Firestore desde el
navegador, sin pasar por ninguna función de Netlify, así que las
reglas de Firestore son la única protección real, y esas reglas
necesitan una sesión de Firebase Auth para verificar quién escribe,
no un secreto que compara el propio JS.

**Crear tu cuenta de acceso**, si todavía no la tenés:
1. Firebase Console → Authentication → Add user → tu email/contraseña.
2. Copiá el UID.
3. Firestore → `usuarios/{tu-uid}` → agregá (o editá) el campo `roles`
   (map) con la entrada `plataforma: propietario` — junto a las que
   ya tengas de tus tiendas, no las reemplaza.

Sin ese paso, aunque el email/contraseña sean correctos, el panel te
rechaza — mismo criterio que ya protege el devmode de cada tienda.
