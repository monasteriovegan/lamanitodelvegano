# Auditoría de activos WhatsApp / Meta

Objetivo: exponer por el proxy seguro de la web las consultas de solo lectura necesarias para verificar qué WhatsApp Business Account (WABA) y qué Phone Number ID están asociados a la conexión OAuth actual, sin migrar ni modificar el número.

Rutas previstas en el proxy:

- `/api/meta/assets/whatsapp-business-accounts`
- `/api/meta/assets/whatsapp-phone-numbers`

La primera debe listar los WABA accesibles para la conexión autenticada. La segunda debe devolver los números asociados a un WABA seleccionado, incluyendo cuando Meta lo permita: `id`, `display_phone_number`, `verified_name`, `quality_rating` y estado.

Estas rutas son de lectura y no deben registrar, migrar, eliminar ni modificar números de WhatsApp.
