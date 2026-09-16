/* Service Worker — resuelve la tienda por dominio, igual que el resto
   del sitio (ver README-FIRESTORE-RULES.md, colección "dominios"). No
   se consulta Firestore directo desde acá — self.location.hostname se
   manda a ultimoPedido.js, que resuelve el storeId contra la MISMA
   colección "dominios" que usan index.html/pedidos.html/
   formulario.html, así no hay una segunda fuente de verdad para el
   mismo mapeo. */
self.addEventListener("install", function(e){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(clients.claim()); });

/* Respaldo cuando el push llega sin payload utilizable — pide el resumen
   del último pedido a una función backend (Admin SDK), no a Firestore
   directo. Antes esto consultaba Firestore vía REST sin ningún token,
   lo cual dejó de funcionar cuando `pedidos` pasó a exigir autenticación
   para lectura (ver README-FIRESTORE-RULES.md) — correcto para que un
   comprador anónimo no pueda leer datos de otros clientes, pero un
   service worker no tiene forma simple de mantener un token de Firebase
   Auth vigente. La función devuelve solo title/body/url — nunca
   dirección, teléfono ni email. */
async function ultimoPedido(){
  try {
    const r = await fetch("/.netlify/functions/ultimoPedido?hostname=" + encodeURIComponent(self.location.hostname));
    const j = await r.json();
    return (j && j.ok && j.pedido) ? j.pedido : null;
  } catch(e){
    console.warn("SW: no pude pedir el último pedido:", e.message);
    return null;
  }
}

self.addEventListener("push", function(e){
  e.waitUntil((async function(){
    /* Intentar leer payload del push */
    var d = null;
    if (e.data){
      try { d = e.data.json(); } catch(err){ d = null; }
    }
    /* Si no hay payload, pedir el resumen al backend */
    if (!d || !d.title){
      d = await ultimoPedido();
    }
    /* Fallback si todo falla */
    if (!d){
      d = {title:"🍔 Nuevo pedido", body:"Toca para ver el detalle", url:"/pedidos.html"};
    }
    return self.registration.showNotification(d.title, {
      body:    d.body || "",
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
      silent:  false,
      renotify: true,
      tag:     "nuevo-pedido",
      data:    {url: d.url || "/pedidos.html"}
    });
  })());
});

self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : "/pedidos.html";
  e.waitUntil(clients.matchAll({type:"window", includeUncontrolled:true}).then(function(list){
    for (var i = 0; i < list.length; i++){
      if (list[i].url && list[i].url.indexOf(self.registration.scope) === 0){
        return list[i].focus().then(function(wc){ return wc.navigate(url); });
      }
    }
    return clients.openWindow(url);
  }));
});
