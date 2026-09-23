# Preflight del VPS para Supabase self-hosted

Fecha: 2026-09-23

Alcance: preparación reversible previa a instalar Supabase. No se modificaron DNS, Vercel ni el proyecto Supabase administrado.

## Swap

- `/swapfile`: 4 GiB (`4294963200` bytes), permisos `0600`.
- Activo mediante `swapon` y persistente en `/etc/fstab` como `/swapfile none swap sw 0 0`.
- `vm.swappiness=10` en `/etc/sysctl.d/99-lmv-swap.conf`.
- Verificación: 4 GiB disponibles, 0 bytes usados al cerrar el preflight.

## SSH y operador

- Una sesión SSH nueva con clave como `supabaseops` terminó correctamente antes y después de retirar la copia temporal local de la clave privada.
- La clave activa y su archivo `.pub` permanecen presentes; sólo se retiró `id_ed25519_lmv_vps.bak-20260922`.
- `supabaseops` pertenece a `sudo` y conserva temporalmente `NOPASSWD` para esta automatización.

### Endurecimiento al terminar la automatización

No retirar `NOPASSWD` antes de comprobar otra sesión SSH y un método sudo operativo. Al terminar, elegir una de estas opciones:

1. establecer de forma interactiva una contraseña fuerte para `supabaseops` y sustituir la regla temporal por `%sudo ALL=(ALL:ALL) ALL`; o
2. sustituirla por una allowlist mínima de comandos operativos, revisada contra los scripts finales.

Después se debe validar con `visudo -cf`, abrir una sesión SSH nueva y probar `sudo` antes de cerrar la sesión existente. La cuenta `root` no se modifica como parte de este preflight.

## Docker y firewall

- UFW: entrada `deny`, salida `allow`, forwarding/routed `deny`.
- Única regla pública: SSH TCP/22 para IPv4 e IPv6.
- Docker Engine: `29.8.1`.
- Docker Compose: `v5.5.1`.
- `/usr/local/sbin/lmv-docker-firewall` mantiene una cadena `LMV-DOCKER-FILTER` enlazada al principio de `DOCKER-USER` para IPv4 e IPv6.
- La cadena acepta conexiones establecidas/relacionadas, descarta conexiones nuevas que entren por la interfaz pública y luego retorna.
- El drop-in `/etc/systemd/system/docker.service.d/20-lmv-firewall.conf` reaplica la protección después de cada inicio de Docker.

Esta defensa complementa UFW porque los puertos publicados por Docker pueden atravesar reglas UFW normales. El stack además debe enlazar su único puerto de ensayo a `127.0.0.1`; la cadena `DOCKER-USER` es defensa adicional, no sustituto del bind en loopback.

## Baseline al cerrar el preflight

- Ubuntu 24.04.5 LTS, 6 vCPU, 11 GiB RAM.
- Disco raíz: 193 GiB, 6.7 GiB usados, 187 GiB disponibles.
- Docker activo y sin contenedores.
- Puertos públicos escuchando: sólo SSH TCP/22 en IPv4 e IPv6.
- Resolved escucha únicamente en loopback TCP/UDP 53.

