# Baseline del VPS para Supabase self-hosted

Fecha de captura: 2026-09-22 America/Santiago / 2026-09-23 Europe/Berlin.

## Alcance y límites

- VPS Contabo: `31.220.99.191`, SSH `22/tcp`.
- Esta preparación cubre solamente Ubuntu, acceso administrativo, firewall y Docker.
- No se instaló Supabase self-hosted.
- No se migraron datos ni se modificó el Supabase administrado.
- No se modificaron DNS ni variables de Vercel.
- No se crearon contenedores ni se publicaron puertos de aplicaciones.

## Acceso local

- Alias OpenSSH: `lmv-vps`.
- Usuario por defecto del alias: `supabaseops`.
- Clave dedicada: ED25519, huella `SHA256:RwUv5+RrJEF5SpALTCJFj3CRI8BnVxEKbd2GDAobtag`.
- Huella ED25519 observada del host: `SHA256:9wqUHutOLp4YQ73tEf7pNoJYIe2/jl0QFi1Gq/VQgrY`.
- La clave privada permanece únicamente en el equipo Windows y no fue copiada al VPS.

## Sistema base

| Campo | Valor verificado |
| --- | --- |
| Hostname | `vmi3603728` |
| Sistema | Ubuntu 24.04.5 LTS (Noble) |
| Kernel | `6.8.0-142-generic` |
| Arquitectura | `amd64` / `x86_64` |
| Virtualización | KVM/QEMU |
| CPU | 6 vCPU, AMD EPYC |
| RAM | 11 GiB |
| Swap | 0 B |
| Raíz | ext4, 193 GiB; 191 GiB libres; 2 % usado |
| IPv4 | `31.220.99.191/21` |
| IPv6 | `2605:a144:2360:3728::1/64` |
| Zona horaria | Europe/Berlin |
| NTP | sincronizado |

## Actualización del sistema

- `apt-get update` completó correctamente.
- La simulación y ejecución de `dist-upgrade` reportaron 0 paquetes por actualizar, instalar o eliminar.
- `autoremove` reportó 0 paquetes para eliminar.
- `/var/run/reboot-required` no existe; no se requirió reinicio.

## Usuario administrativo y SSH

- `supabaseops`: UID/GID `1001`, grupos `supabaseops`, `sudo` y `users`.
- Home: `/home/supabaseops`, modo `0750`.
- `.ssh`: modo `0700`; `authorized_keys`: modo `0600`, propietario `supabaseops`.
- Sudo no interactivo validado mediante `/etc/sudoers.d/90-supabaseops`; `visudo -cf` pasó.
- `supabaseops` no pertenece al grupo `docker`.
- Segunda y tercera conexiones SSH independientes por clave: correctas.
- Fragmento de hardening: `/etc/ssh/sshd_config.d/00-supabaseops-hardening.conf`.
- Configuración efectiva validada con `sshd -t` y `sshd -T`:
  - `PermitRootLogin no`
  - `PasswordAuthentication no`
  - `KbdInteractiveAuthentication no`
  - `PubkeyAuthentication yes`
  - puerto `22`
- Ubuntu 24.04 usa activación por `ssh.socket`; `ssh.socket` está activo y habilitado.

## Firewall UFW

- Estado: activo y habilitado al iniciar.
- Logging: `low`.
- Política entrante: `deny`.
- Política saliente: `allow`.
- Política routed/forwarded: `deny`.
- Reglas permitidas:
  - `22/tcp` desde cualquier IPv4, comentario `SSH administration`.
  - `22/tcp` desde cualquier IPv6, comentario `SSH administration`.
- Una conexión SSH nueva fue validada después de activar UFW.
- No existen reglas para `5432`, `6543`, `8000`, Studio, HTTP ni HTTPS.

## Riesgos abiertos después del acceso base

- `supabaseops` tiene `NOPASSWD:ALL`: es necesario para operación automatizada, pero una pérdida de su clave equivale a compromiso root.
- El VPS no tiene swap; antes de alojar Postgres debe definirse una política explícita de memoria/swap.
- La zona horaria del servidor es Europe/Berlin. No bloquea la instalación, pero conviene decidir si se conserva o se normaliza a UTC antes de crear tareas programadas.
