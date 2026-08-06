# Wonka WhatsApp Gateway

Gateway persistente de WhatsApp para Railway usando Baileys.

## Estado de esta primera entrega

Incluye:

- conexión por QR;
- persistencia de sesión en `/data/baileys-auth`;
- reconexión automática;
- endpoint `/health`;
- reconocimiento del chat contigo mismo;
- comandos globales para pausar, activar y consultar estado;
- recepción y registro de mensajes entrantes.

La conexión con Remy, Supabase, CRM y pedidos se agregará cuando termine la actualización de la web y estén definidos sus endpoints finales.

## Railway

Configurar el servicio con:

- Branch: `feature/wonka-whatsapp-gateway`
- Root Directory: `/services/wonka-whatsapp-gateway`
- Variable `OWNER_PHONE=56990816124`
- Variable `AUTH_FOLDER=/data/baileys-auth`
- Variable `LOG_LEVEL=info`
- Volumen montado en `/data`

Después del deploy, abrir los logs y escanear el QR desde:

`WhatsApp Business > Dispositivos vinculados > Vincular dispositivo`.

## Comandos en el chat contigo mismo

- `Remy, deja de responder`
- `Remy, vuelve a responder`
- `Remy, ¿estás activo?`
