/* cloudflare/functions/_correo.js
   REMITENTE DE LOS CORREOS DE DERLABS — un solo lugar.

   Todos los correos que salen de DerLabs por Resend (bienvenida, recuperar
   clave, aviso de dominio y pedidos) toman el dominio de acá. Para cambiarlo
   no hay que tocar el código: en Cloudflare, Variables del Worker:
     EMAIL_DOMINIO   dominio verificado en Resend (por defecto derlabs.store)
     EMAIL_PEDIDOS   dirección completa de los avisos de pedido
                     (por defecto pedidos@<EMAIL_DOMINIO>)
   La llave de Resend (RESEND_API_KEY) debe pertenecer a ese dominio. */

export const DOMINIO_CORREO = "derlabs.store";

const REG_DOMINIO = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const REG_CORREO = /^[A-Za-z0-9._%+-]{1,64}@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;

export function dominioCorreo(env){
  const d = String((env && env.EMAIL_DOMINIO) || "").trim().toLowerCase();
  return REG_DOMINIO.test(d) ? d : DOMINIO_CORREO;
}
/* "DerLabs <hola@derlabs.store>" */
export function remitenteDerlabs(env, usuario){
  return "DerLabs <" + (usuario || "hola") + "@" + dominioCorreo(env) + ">";
}
/* Dirección para los avisos de pedido (sin nombre) */
export function correoPedidos(env){
  const c = String((env && env.EMAIL_PEDIDOS) || "").trim();
  return REG_CORREO.test(c) ? c : "pedidos@" + dominioCorreo(env);
}
