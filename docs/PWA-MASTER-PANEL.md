# Synthetiq Master Panel PWA

La aplicación instalable deja de ser solo "Wonka Hub" y pasa a representar el panel administrativo completo.

## Principios
- `start_url`: `/admin`
- El panel administrativo existente sigue siendo la base visual y funcional.
- Wonka permanece como director flotante sobre todas las pantallas del admin.
- Cada futuro negocio debe reutilizar el mismo patrón de panel y exponer sus capacidades a un Tool Layer común.
- La app instalada debe abrir el panel, no una sola pantalla de chat.

## Evolución multinegocio
La Manito del Vegano es el primer workspace. Makangru y futuros negocios deben conectarse como workspaces separados, conservando navegación, roles y herramientas por negocio.
