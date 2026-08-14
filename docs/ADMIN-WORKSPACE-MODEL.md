# Admin Workspace Model

El `/admin` actual es la base compartida de operación. La evolución multinegocio debe mantener esta base y agregar un contexto de workspace/negocio.

## Objetivo
- Un solo panel instalable.
- Wonka como director global.
- Selector de negocio/workspace.
- Cada negocio conserva sus datos, integraciones, agentes y permisos.
- El diseño y navegación base del admin se reutilizan.

## Primeros workspaces
- La Manito del Vegano
- Makangru

## Regla
No duplicar el panel completo por cada negocio. Compartir el shell administrativo y resolver datos/acciones según el workspace activo.
