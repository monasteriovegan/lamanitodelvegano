# Meta App Review — La Manito del Vegano

Este documento no contiene secretos ni credenciales.

## Activos y arquitectura

- App principal: `synthetiq Core sirve` (`1691394752113175`).
- Business: La Manito del Vegano (`1210930218761819`).
- Instagram: `@lamanitodelvegano` (`17841419477422736`).
- Facebook Page: `1210803402107834`.
- WhatsApp WABA: `1129249369256097`.
- App secundaria: `Synthetiq Bridge - La Manito` (`1388581679803769`), `BRIDGE/LEGACY`; no reemplazar la app principal.
- OAuth: `https://lamanitodelvegano.cl/api/meta/oauth/start` y `/api/meta/oauth/callback`; el inicio devuelve a Meta el callback `.cl` y el intercambio ocurre server-side en el backend Vercel existente.
- Webhooks: `/api/instagram`, `/api/whatsapp`, `/api/meta/webhooks/messaging`, `/api/meta/webhooks/whatsapp`, `/api/meta/webhooks/leads`.

## Permisos mínimos para mensajería actual

| Permiso | Estado observado | Necesidad |
| --- | --- | --- |
| `instagram_basic` | Listo para la prueba; presente en token | Identificar la cuenta profesional vinculada |
| `instagram_manage_messages` | Listo para la prueba; presente en token | Leer y responder Instagram Direct |
| `pages_manage_metadata` | Listo para la prueba; presente en token | Suscripción a webhooks de la Página |
| `pages_read_engagement` | Listo para la prueba; presente en token | Leer metadatos requeridos de la Página |
| `pages_show_list` | Listo para la prueba; presente en token | Localizar la Página administrada |
| `pages_messaging` | Listo para la prueba; presente en token | Mensajería de Messenger/Page |

Los permisos `instagram_business_*` pertenecen al flujo moderno con Instagram Login. El runtime actual usa Facebook Login/Page e `instagram_manage_messages`; no deben solicitarse ambos conjuntos sin una migración deliberada.

## Bloqueos de acceso avanzado

Meta impide añadir `instagram_manage_messages` a App Review hasta convertir el negocio en **Tech Provider**. El diálogo exige:

1. Business Verification.
2. Access Verification.
3. Responder preguntas de uso, tratamiento y protección de datos.
4. App Review.

Meta advierte que identificarse como Tech Provider es irreversible. No se aceptó ni se pulsó `Continue`.

La verificación del Business `1210930218761819` cambió a **Verificado** el 20 de agosto de 2026. La pantalla de publicación indica que se completó la configuración obligatoria y habilita el botón `Publicar`, pero la app permanece sin publicar por decisión explícita.

Para una app usada únicamente por La Manito, Tech Provider no es necesario ahora. Puede ser apropiado más adelante si Synthetiq se convierte en una plataforma multicliente que permite a otras empresas conectar sus propios activos de Instagram, Facebook, WhatsApp, Ads y CRM. Clasificación actual: **RECOMMENDED LATER / REQUIRES HUMAN DECISION**.

## Identidad y correo corporativo

- Los nameservers activos son `ns1.vercel-dns.com` y `ns2.vercel-dns.com`.
- No existen registros MX, SPF, DKIM ni DMARC publicados para `lamanitodelvegano.cl`.
- No hay evidencia de que Google Workspace esté contratado ni de que `contacto@lamanitodelvegano.cl` exista o reciba correo. El Contact Email de Meta permanece vacío.
- Para un alta nueva de Google Workspace, después de contratarlo y verificar el dominio, preparar en Vercel DNS:
  - MX `@`, prioridad `1`, destino `smtp.google.com`.
  - TXT `@`: `v=spf1 include:_spf.google.com ~all`, siempre que Google sea el único emisor.
  - TXT DKIM en el selector que genere Google Admin (habitualmente `google._domainkey`), usando exactamente la clave pública entregada; no puede preinventarse.
  - TXT `_dmarc`: comenzar con `v=DMARC1; p=none; rua=mailto:<buzón-monitorizado>` después de que SPF y DKIM lleven al menos 48 horas activos; endurecer gradualmente tras revisar reportes.
- No se añadió ningún registro de correo antes de crear el tenant y el buzón.

## Categoría e icono

- Categorías relevantes que Meta ofrece actualmente: `Bots de Messenger para empresas`, `Compras`, `Mensajes`, `Negocios y páginas` y `Utilidad y productividad`.
- Hay más de una opción razonable. No se seleccionó una categoría sin decisión humana; la candidata general más cercana es `Negocios y páginas`, mientras `Bots de Messenger para empresas` describe mejor la función de mensajería.
- La búsqueda local encontró únicamente el favicon genérico de Vercel, assets genéricos y `remy.jpg`; ninguno es un logo oficial de La Manito. No se generó ni subió un icono inventado.

## Instrucciones para el revisor

1. Abrir `https://lamanitodelvegano.cl/admin/login` e iniciar sesión con la cuenta de prueba que el negocio entregue al revisor.
2. Abrir `https://lamanitodelvegano.cl/admin/conversaciones`.
3. Desde una cuenta de Instagram autorizada para la prueba, enviar a `@lamanitodelvegano`: `Hola, necesito información de la Barra Dubái`.
4. Confirmar que el mensaje aparece en la conversación correcta del CRM, con canal Instagram y sin exponer tokens.
5. Permitir que Remy genere una respuesta relacionada con la consulta o responder manualmente desde el panel.
6. Confirmar en Instagram que la respuesta llega al mismo hilo.

Texto sugerido para el caso de uso:

> La Manito del Vegano utiliza `instagram_manage_messages` para recibir y responder consultas de clientes enviadas directamente a su única cuenta profesional, @lamanitodelvegano. El webhook entrega el mensaje al backend HTTPS de la empresa, se persiste en el CRM interno y un administrador puede responder o autorizar una respuesta asistida por Remy. La app no vende datos ni administra cuentas de terceros.

## Screencast requerido

Grabar una sola toma, sin editar datos sensibles:

1. Mostrar el perfil `@lamanitodelvegano` y enviar el DM indicado desde una cuenta con rol de tester.
2. Mostrar el panel `/admin/conversaciones` recibiendo el mensaje.
3. Abrir el hilo y mostrar la identificación del canal Instagram.
4. Enviar una respuesta desde el panel o mostrar la respuesta autorizada de Remy.
5. Volver a Instagram y mostrar la respuesta en el mismo hilo.
6. No mostrar App Secret, access tokens, cookies, variables Vercel ni datos de clientes reales.

## URLs legales

- Privacidad: `https://lamanitodelvegano.cl/privacidad`.
- Términos: `https://lamanitodelvegano.cl/terminos`.
- Eliminación de datos: `https://lamanitodelvegano.cl/eliminacion-de-datos`.

## Acción humana antes de enviar

1. Contratar o activar Google Workspace para `lamanitodelvegano.cl`, crear `contacto@lamanitodelvegano.cl`, completar los registros entregados por Google en Vercel DNS y verificar recepción real.
2. Elegir entre `Negocios y páginas` y `Bots de Messenger para empresas` según si la app se presenta como plataforma empresarial general o bot de atención.
3. Aportar el logo oficial y exportarlo a PNG RGB cuadrado 1024×1024 con zona segura.
4. Decidir conscientemente si Synthetiq debe convertirse en Tech Provider; no continuar sin aceptar el carácter irreversible.
5. Crear una cuenta de prueba legítima y grabar el screencast anterior.
6. Solo entonces agregar los permisos mínimos a App Review, completar las preguntas y enviar.
