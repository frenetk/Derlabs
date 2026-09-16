# Reglas de Firestore

Este archivo fusiona dos líneas de trabajo que se hicieron por separado
sobre este proyecto y resuelven problemas distintos:

1. **Separar lo público de lo privado dentro de `config`** — el Access
   Token de MercadoPago y la API key de Resend vivían en el mismo
   documento que el catálogo público, así que cualquier regla que
   hiciera legible ese documento (necesario para que la tienda funcione
   sin login) exponía los secretos junto con el resto.
2. **Segunda clave de propietario** — cualquier cuenta con el login
   estándar de devmode podía crear cupones de cualquier descuento,
   cambiar precios, o registrar movimientos de caja falsos. Ahora esas
   tres acciones exigen que la cuenta tenga el rol `"propietario"` para
   esa tienda específica, verificado del lado del servidor.

Ambas viven en el mismo archivo de reglas porque Firestore no permite
dos bloques `match` distintos apuntando a la misma colección — hay que
fusionar los requisitos en una sola regla por colección, no simplemente
concatenar dos archivos.

## Por qué config está partido en dos documentos

La versión más antigua de estas reglas usaba un comodín recursivo:

```
match /tiendas/{storeId}/{document=**} {
  allow read: if true;
  allow write: if request.auth != null;
}
```

Esto hace pública la lectura de **todo** lo que cuelga de
`tiendas/{storeId}/`, sin excepción — incluyendo `config/general`, donde
vivía el `mpToken` y el `resendApiKey`. Cualquier visitante podía abrir
las devtools del navegador, mirar la pestaña Network, o directamente
hacer una petición REST a Firestore, y leer ambos secretos sin ninguna
credencial.

La causa era estructural, no un typo: `config` mezclaba en un mismo
documento datos que un comprador anónimo necesita leer (nombre, color,
delivery) con datos que solo el dueño debería ver (tokens). Ahora son
dos documentos:

- `config/general` — público. Nombre, tagline, color, delivery, mensajes,
  el flag `mpActivo` (si hay MercadoPago configurado, sin revelar el
  token). Todo lo que el checkout necesita mostrar a un comprador
  anónimo.
- `config/privado` — solo el dueño autenticado. `mpToken`, `resendApiKey`,
  `emailEmisor`, `emailVendedor`.

## Por qué existe la segunda clave de propietario

El login estándar de devmode (usuario y contraseña de Firebase
Authentication, cualquiera que crees ahí) entra a lo básico del día a
día: marcar pedidos, subir fotos, cambiar stock, ajustar el catálogo. Es
intencionalmente simple — cualquier cuenta autenticada puede hacer esto,
sin necesitar ningún documento adicional en Firestore.

Cupones, el campo `precio` de un producto, y `registros_diarios` (caja)
son distintos: un abuso ahí cuesta dinero real, directamente. Esas tres
acciones exigen que la cuenta tenga `roles[storeId] == "propietario"` en
`usuarios/{uid}` — verificado del lado del servidor, no solo en el
JavaScript del navegador (que cualquiera puede leer o manipular con clic
derecho → Ver código fuente, o forzando variables desde la consola).

**Cómo crear una cuenta de propietario:**

1. Firebase Console → Authentication → Add user → crea la cuenta con el
   email/contraseña que esa persona va a usar.
2. Firebase Console → Firestore → colección `usuarios` → busca o crea un
   documento con ID = el UID de esa cuenta (lo ves en Authentication tras
   crearla).
3. Dentro de ese documento, agrega o edita el campo `roles` como un mapa
   (map): `{ "el-storeId-de-esa-tienda": "propietario" }`. Si la misma
   persona administra varias tiendas, se le pueden agregar varias
   entradas al mismo mapa, una por storeId.
4. Cualquier otra cuenta que uses como operador del día a día (el login
   estándar de devmode) NO necesita ninguna entrada en `roles` — con
   estar autenticada alcanza para lo básico.

## Reglas completas

Copiar y pegar tal cual en **Firebase Console → Firestore Database → Reglas**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    /* Cualquier cuenta con rol asignado para ESTA tienda (sea cual sea
       ese rol — hoy solo existe "propietario", pero esto queda listo
       para un rol intermedio tipo "operador" sin tocar las reglas de
       nuevo). Antes, la mayoría de las colecciones de abajo solo
       pedían request.auth != null — es decir, CUALQUIER cuenta válida
       del proyecto Firebase compartido, sin importar si tenía algún
       rol para esta tienda en particular. Con varias tiendas de
       clientes distintos en el mismo Firebase (modelo DerLabs), eso
       significaba que el dueño de una tienda podía entrar al devmode
       de otra con solo conocer (o adivinar) email/contraseña ajenos —
       nada en el servidor lo impedía, aunque el login ya no lo dejara
       pasar del lado del cliente (ver index.html, intentarLogin() /
       resolverRolPropietario()). Esta función es la protección real:
       corre en los servidores de Google, no en el navegador de nadie. */
    function tieneRolEnTienda(storeId){
      return request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.roles[storeId] != null;
    }

    match /tiendas/{storeId} {

      // ── config/general — PÚBLICO. Lo necesita cualquier comprador
      // anónimo para ver el catálogo, delivery, mensajes, etc. Nunca
      // debe contener mpToken, resendApiKey, emailEmisor ni
      // emailVendedor — eso vive en config/privado.
      match /config/general {
        allow read: if true;
        allow write: if tieneRolEnTienda(storeId);
      }

      // ── config/privado — SOLO cuentas con rol para ESTA tienda.
      // mpToken, resendApiKey, emailEmisor, emailVendedor viven acá.
      // No exige específicamente "propietario" (a diferencia de
      // cupones/precio/caja) porque cualquier operador con rol básico
      // necesita poder configurar el backend de su propia tienda —
      // solo lo sensible a nivel de dinero directo (descuentos,
      // precios, caja) exige la segunda clave de propietario.
      match /config/privado {
        allow read, write: if tieneRolEnTienda(storeId);
      }

      // ── productos — lectura pública (catálogo). Escritura: cualquier
      // cuenta con rol para esta tienda puede tocar stock, marcar
      // agotado, subir fotos — el uso diario normal. Solo el campo
      // "precio" exige el rol específico de propietario, para que un
      // operador no pueda regalar productos cambiando precios sin
      // autorización. El backend (webhookPago.js,
      // crearPedidoEfectivo.js) usa el Admin SDK, que ignora estas
      // reglas por completo — el descuento automático de stock tras
      // un pedido sigue funcionando igual.
      match /productos/{prodId} {
        allow read: if true;
        allow write: if tieneRolEnTienda(storeId) &&
          (!request.resource.data.diff(resource.data).affectedKeys().hasAny(["precio"]) ||
           get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.roles[storeId] == "propietario");
      }

      // ── cupones — lectura pública (el checkout necesita mostrar el
      // catálogo de cupones antes de confirmar). Escritura normal
      // (crear, editar, activar/desactivar, eliminar) exige el rol
      // específico de propietario — es dinero regalado directamente,
      // el mismo criterio que el campo "precio" de productos.
      // Excepción puntual: cualquiera autenticado O NO puede
      // incrementar SOLO el campo usosTotales de un cupón que ya
      // existe — es lo único que el modo sin-backend (ver
      // postGuardadoPedidoSinBackend en index.html) necesita hacer
      // desde el navegador del comprador cuando no hay ninguna función
      // de Netlify disponible. Con backend disponible, este incremento
      // ya lo hace crearPago.js/crearPedidoEfectivo.js con el Admin
      // SDK — esta regla solo importa para ese modo degradado, y no
      // abre nada más: no permite crear, borrar, ni tocar ningún otro
      // campo del cupón.
      match /cupones/{cuponId} {
        allow read: if true;
        allow create, delete: if request.auth != null &&
          get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.roles[storeId] == "propietario";
        allow update: if
          (request.auth != null &&
           get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.roles[storeId] == "propietario")
          || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['usosTotales']);
      }

      // ── locales — información pública de sucursales.
      match /locales/{localId} {
        allow read: if true;
        allow write: if tieneRolEnTienda(storeId);
      }

      // ── pedidos — nadie de afuera puede LEER pedidos ajenos (evita
      // que un comprador vea direcciones/teléfonos de otros clientes).
      // La ESCRITURA de creación queda abierta a cualquiera porque dos
      // flujos legítimos sin sesión la necesitan: webhookPago.js/
      // crearPedidoEfectivo.js (Admin SDK, ignora esto de todas
      // formas) y el fallback sin backend (guardarPedidoFirestore en
      // index.html), que escribe directo desde el navegador del
      // comprador cuando no hay ninguna función disponible. Leer,
      // actualizar (avanzar estado) y eliminar sí exigen rol para esta
      // tienda — antes, cualquier cuenta autenticada del Firebase
      // compartido podía leer y editar los pedidos de CUALQUIER
      // tienda, no solo la suya.
      match /pedidos/{pedidoId} {
        allow read: if tieneRolEnTienda(storeId);
        allow create: if true;
        allow update, delete: if tieneRolEnTienda(storeId);
      }

      // ── intentos_pago — registro de auditoría de cada intento de
      // pago con MercadoPago (ver crearPago.js/webhookPago.js). Contiene
      // los mismos datos de cliente que un pedido (nombre, teléfono,
      // dirección, email) mientras el pago todavía no se confirma, así
      // que se protege con el mismo criterio que pedidos: nadie de
      // afuera lee los de otra tienda, pero crearPago.js necesita
      // poder crearlos (Admin SDK, ignora esto igual). Solo cuentas
      // con rol para esta tienda los consultan, desde devmode → Pagos
      // → "Intentos de pago sin confirmar".
      match /intentos_pago/{intentoId} {
        allow read: if tieneRolEnTienda(storeId);
        allow create: if true;
        allow update, delete: if tieneRolEnTienda(storeId);
      }

      // ── registros_diarios — caja (ingresos/egresos manuales). Exige
      // el rol específico de propietario tanto para leer como para
      // escribir: es información financiera directa, no solo un
      // riesgo de escritura abusiva.
      match /registros_diarios/{regId} {
        allow read: if request.auth != null &&
          get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.roles[storeId] == "propietario";
        allow write: if request.auth != null &&
          get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.roles[storeId] == "propietario";
      }

      // ── dispositivos — suscripciones push del VENDEDOR (no de
      // clientes). Nunca deben ser legibles públicamente: exponen
      // endpoint + llaves de cifrado, suficiente para mandarle pushes
      // falsos al celular del dueño. Exige rol para esta tienda — no
      // el rol específico de propietario, cualquier cuenta autorizada
      // gestiona sus propias notificaciones.
      match /dispositivos/{dispId} {
        allow read, write: if tieneRolEnTienda(storeId);
      }

      // ── email_logs — quién recibió qué email, por pedido. Solo el
      // backend escribe acá (Admin SDK); solo cuentas con rol para
      // esta tienda pueden revisarlo.
      match /email_logs/{logId} {
        allow read: if tieneRolEnTienda(storeId);
        allow write: if false;
      }

      // ── formularios — respuestas del formulario público de leads
      // (formulario.html). CREAR es público a propósito: cualquiera con
      // el link debe poder enviarlo sin login, ese es el objetivo del
      // formulario. LEER y ACTUALIZAR (marcar revisado) exigen rol
      // para esta tienda — sin esto, cualquiera que supiera hacer
      // una petición REST a Firestore con el storeId podía leer todas
      // las respuestas sin pasar por el login de
      // formulario-respuestas.html.
      match /formularios/{formId} {
        allow read, update, delete: if tieneRolEnTienda(storeId);
        allow create: if true;
      }

      // ── contratos — evidencia de que una cuenta aceptó los términos
      // de servicio de esta tienda (ver CONTRATO_VERSION en index.html).
      // Cada documento tiene como ID el uid de quien aceptó, así que
      // "create" solo deja escribir el propio documento (uid ===
      // documento), nunca el de otra cuenta. INMUTABLE una vez creado
      // — ni update ni delete, ni siquiera para el dueño: es un
      // registro de evidencia, si se pudiera editar después perdería
      // su valor como prueba de que se aceptó en tal fecha.
      match /contratos/{uid} {
        allow read: if request.auth != null && request.auth.uid == uid;
        allow create: if request.auth != null && request.auth.uid == uid;
        allow update, delete: if false;
      }
    }

    // ── dominios — mapea el hostname de cada cliente (location.hostname
    // en index.html/pedidos.html/formulario.html/formulario-respuestas.html)
    // al storeId de su tienda. Es el corazón del modelo multi-dominio: un
    // solo deploy de código, muchos dominios, cada uno resolviendo una
    // tienda distinta al arrancar. LECTURA pública a propósito —
    // cualquier visitante de cualquier dominio necesita poder resolver
    // a qué tienda pertenece antes de mostrar nada. ESCRITURA cerrada
    // por completo desde el cliente: el único camino legítimo para dar
    // de alta un dominio es crearTienda.js (Admin SDK, protegido con
    // ADMIN_SECRET — ver generar-tienda.html), que ignora esta regla de
    // todas formas. Antes esto permitía "cualquier cuenta autenticada",
    // lo cual habría dejado que el dueño de una tienda reescribiera el
    // mapeo de OTRO dominio hacia su propia tienda (no hay un storeId
    // único al que atar tieneRolEnTienda() acá, porque el documento en
    // sí decide a qué storeId apunta).
    match /dominios/{hostname} {
      allow read: if true;
      allow write: if false;
    }

    // ── plataforma/landing — contenido editable del landing público
    // (derlabs.cl): textos del hero, precios mostrados, frase del
    // footer (ver landing.html). LECTURA pública a propósito —
    // cualquier visitante del landing necesita leer este contenido
    // sin loguearse, es lo que ve la página en sí. ESCRITURA exige
    // roles.plataforma == "propietario" en usuarios/{uid} — mismo
    // mecanismo que protege el devmode de cada tienda (ver
    // tieneRolEnTienda arriba), reutilizado acá con "plataforma" como
    // el storeId reservado para esto, porque el devmode del landing
    // escribe directo desde el navegador sin pasar por ninguna
    // función de Netlify — estas reglas son la única barrera real.
    match /plataforma/landing {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.roles.plataforma == "propietario";
    }
    match /plataforma/landing/resenas/{resenaId} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.roles.plataforma == "propietario";
    }

    // ── suscripciones_plataforma — estado del cobro mensual de la
    // plataforma a cada cliente (ver crearSuscripcionPlataforma.js,
    // webhookSuscripcion.js, listarSuscripciones.js). Nadie del lado
    // del cliente necesita leer ni escribir esto — ni el propio
    // cliente cuya tienda es, ni ninguna cuenta con rol en ninguna
    // tienda. Todo el acceso pasa por Admin SDK con ADMIN_SECRET o por
    // el webhook de MercadoPago, que ignoran esta regla de todas
    // formas — cerrada por completo desde el cliente, igual que
    // dominios en cuanto a escritura, pero acá tampoco lectura pública.
    match /suscripciones_plataforma/{storeId} {
      allow read, write: if false;
    }

    match /usuarios/{uid} {
      allow read: if request.auth != null;
      // El mapa "roles" NUNCA se puede escribir desde el cliente — solo
      // mediante Firebase Console o Admin SDK. Sin esto, cualquier
      // cuenta autenticada podría auto-asignarse
      // roles={"cualquier-tienda":"propietario"} escribiendo directo a
      // su propio documento desde la consola del navegador,
      // saltándose toda la protección de cupones/precio/caja para
      // CUALQUIER tienda del sistema, no solo la suya.
      allow write: if request.auth != null && request.auth.uid == uid &&
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(["roles"]);
    }
    match /usuarios/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Qué falta después de pegar esto

### 1. Migrar config si esta tienda tenía datos previos

Estas reglas asumen que **ya existe** `config/privado` con los 4 campos
sensibles, separado de `config/general`. Si esta tienda tenía datos con
el esquema viejo (todo en `config/general`, incluyendo `mpToken`), hay
que migrar ese documento **antes** de desplegar estas reglas — si se
despliegan primero, `config/general` quedará correctamente protegido
para escritura de campos nuevos, pero el `mpToken` viejo que ya estaba
ahí seguirá siendo público hasta que se mueva a mano.

Pasos, en Firebase Console → Firestore Database → Datos:

1. Abrir `tiendas/{storeId}/config/general`.
2. Copiar los valores de `mpToken`, `resendApiKey`, `emailEmisor`,
   `emailVendedor` (si existen).
3. Crear (o abrir) `tiendas/{storeId}/config/privado` y pegar esos 4
   valores ahí.
4. Volver a `config/general` y **borrar** esos 4 campos de ese documento.
5. Recién ahí pegar las reglas de este archivo.

Si la tienda es nueva (nunca se guardó un token), no hay nada que migrar
— `index.html` ya crea ambos documentos separados desde el primer
guardado (ver `sembrarDatosDemo()` y `saveConfigPrivado()`).

### 2. Crear la cuenta de propietario

Sin al menos una cuenta con `roles[storeId] == "propietario"` en
`usuarios/{uid}`, **nadie** va a poder crear cupones, cambiar precios, o
tocar la caja — ni siquiera el dueño, hasta que exista esa cuenta. Ver
la sección "Por qué existe la segunda clave de propietario" más arriba
para los pasos exactos.

### 3. No se pudo probar de punta a punta

No hay forma de correr un proyecto Firebase real contra este entorno de
trabajo — las reglas se armaron y revisaron con cuidado, pero no se
desplegaron contra un Firestore real. Probar con ambos tipos de cuenta
(login estándar y propietario) apenas se despliegue, antes de confiar
del todo.

## MP_ACCESS_TOKEN por variable de entorno vs. por tienda

Al margen de las reglas de Firestore: `webhookPago.js` ya resuelve esto
correctamente — lee el `storeId` de la query string de
`notification_url` (que `crearPago.js` arma al crear la preferencia) y
busca el token de esa tienda específica en `config/privado` antes de
consultar el pago. Solo cae a la variable de entorno `MP_ACCESS_TOKEN`
como respaldo si el `storeId` no viene en la URL por algún motivo — útil
mientras haya una única tienda en el sistema, pero deja de ser correcto
apenas haya una segunda tienda con su propio MercadoPago sin ese
respaldo. Ver los comentarios en `webhookPago.js` para el detalle
completo.
