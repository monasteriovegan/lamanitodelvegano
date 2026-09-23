# Supabase Self-Hosted Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar, ensayar y eventualmente ejecutar una migración reversible desde Supabase administrado a Supabase self-hosted en el VPS Contabo, manteniendo el frontend y las rutas API en Vercel.

**Architecture:** Vercel seguirá sirviendo Next.js, webhooks y crons. El VPS alojará un único proyecto Supabase fijado a una release oficial, detrás de un reverse proxy TLS; PostgreSQL, Supavisor, Studio y el gateway interno no se publicarán directamente. La migración se ensayará con un baseline de esquema y datos sintéticos, luego con un restore de producción autorizado, antes de cualquier cutover.

**Tech Stack:** Ubuntu 24.04 LTS, OpenSSH, UFW, Docker Engine, Docker Compose plugin, Supabase self-hosted Docker release `self-hosted/v0.8.1`, PostgreSQL 17, Envoy API Gateway, Vercel Preview/Production, Supabase CLI y `psql`.

**Spec:** `docs/operations/2026-09-22-supabase-self-host-audit.md`

## Global Constraints

- NO cambiar DNS sin aprobación explícita de cutover.
- NO cambiar variables de producción en Vercel durante preparación o ensayo.
- NO eliminar ni modificar el Supabase administrado.
- NO migrar datos de producción durante la preparación inicial.
- NO ejecutar scripts destructivos ni reproducir migraciones sin revisión.
- NO publicar secretos ni credenciales en terminales compartidas, logs, chat o Git.
- Crear commits pequeños y reversibles.
- PostgreSQL, Supavisor, Studio y el API Gateway interno no pueden quedar expuestos directamente a Internet.
- Antes de cada fase con side effects, capturar evidencia y definir rollback.
- Al ejecutar, cargar por canal seguro las variables operativas no secretas `MANITO_SSH_HOST`, `MANITO_SSH_PORT`, `MANITO_ADMIN_CIDR` y, cuando exista, `MANITO_SUPABASE_HOST`; nunca escribir sus valores en Git.

## Review Focus

- Desfase entre el esquema vivo y los SQL del repositorio: el ensayo debe fallar antes de tocar datos si falta una tabla, columna, tipo, constraint, policy, grant, función o trigger.
- Auth y claves JWT: usuarios admin deben poder iniciar sesión y mantener roles sin aceptar tokens firmados por una clave incorrecta.
- Storage y URLs: buckets públicos/privados, rutas y políticas deben conservar el comportamiento sin exponer comprobantes o adjuntos privados.
- Pagos/webhooks/crons: el ensayo no debe enviar eventos reales, duplicar cobros, confirmar dos veces un pedido ni ejecutar jobs programados contra producción.
- Red y Docker: ninguna publicación de Docker puede eludir UFW y abrir `5432`, `6543`, `8000`, Studio u otro servicio interno.

---

### Task 1: Obtener acceso SSH y capturar baseline del VPS

**Files:**
- Create: `docs/operations/2026-09-22-vps-baseline.md`
- Reference: `docs/operations/2026-09-22-supabase-self-host-audit.md`

**Interfaces:**
- Consumes: hostname/IP, puerto, usuario actual y autenticación entregados por canal seguro.
- Produces: inventario no sensible de SO, CPU, RAM, disco, red, usuarios, SSH, UFW, paquetes y servicios.

- [ ] **Step 1: Verificar la identidad del host sin modificarlo**

Run remotely:

```bash
hostnamectl
cat /etc/os-release
uname -a
nproc
free -h
df -hT /
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS
```

Expected: Ubuntu 24.04 LTS; mínimo 2 vCPU, 4 GB RAM y 40 GB SSD, recomendado 4 vCPU, 8 GB RAM y 80 GB SSD.

- [ ] **Step 2: Inventariar exposición y servicios existentes**

Run remotely:

```bash
sudo ss -lntup
sudo systemctl --type=service --state=running
sudo ufw status verbose
sudo nft list ruleset
docker --version || true
docker compose version || true
```

Expected: inventario completo. Si hay cargas existentes, detener la tarea y diseñar coexistencia antes de instalar o reiniciar servicios.

- [ ] **Step 3: Guardar el baseline sanitizado**

Write `docs/operations/2026-09-22-vps-baseline.md` sin IP pública, hostname sensible, claves, tokens ni hashes de contraseñas. Incluir comandos, fecha, versiones, puertos y servicios.

- [ ] **Step 4: Commit**

```bash
git add docs/operations/2026-09-22-vps-baseline.md
git commit -m "docs: record VPS baseline"
```

### Task 2: Actualizar Ubuntu y crear el administrador no-root

**Files:**
- Modify: `docs/operations/2026-09-22-vps-baseline.md`

**Interfaces:**
- Consumes: baseline de Task 1 y nombre de usuario operativo acordado `supabaseops`.
- Produces: sistema actualizado y acceso sudo no-root comprobado en una segunda sesión.

- [ ] **Step 1: Actualizar índices y simular el upgrade**

Run remotely:

```bash
sudo apt-get update
apt list --upgradable
sudo apt-get -s dist-upgrade
```

Expected: lista revisable; si propone remover OpenSSH, red o paquetes críticos, detener.

- [ ] **Step 2: Aplicar actualizaciones**

```bash
sudo DEBIAN_FRONTEND=noninteractive apt-get -y dist-upgrade
sudo apt-get -y autoremove --purge
test ! -f /var/run/reboot-required || cat /var/run/reboot-required.pkgs
```

Expected: exit 0. Si se requiere reboot, registrar servicios y reiniciar en una ventana controlada antes de continuar.

- [ ] **Step 3: Crear usuario administrador**

```bash
id supabaseops >/dev/null 2>&1 || sudo adduser --disabled-password --gecos "Supabase operator" supabaseops
sudo usermod -aG sudo supabaseops
sudo -l -U supabaseops
```

Expected: `supabaseops` existe y puede usar sudo; no tiene contraseña reutilizada o publicada.

- [ ] **Step 4: Instalar la clave pública autorizada**

Crear `/home/supabaseops/.ssh/authorized_keys` usando `install -d -m 700` y `install -m 600` desde un archivo temporal seguro, luego fijar `chown -R supabaseops:supabaseops /home/supabaseops/.ssh`. Nunca pegar la clave privada en el servidor.

- [ ] **Step 5: Probar una segunda sesión**

```bash
ssh -p "$MANITO_SSH_PORT" -o PreferredAuthentications=publickey supabaseops@"$MANITO_SSH_HOST"
sudo -n true
```

Expected: login por clave y sudo funcionales. Mantener abierta la sesión original hasta completar la prueba.

- [ ] **Step 6: Endurecer SSH sólo después de la prueba**

Crear `/etc/ssh/sshd_config.d/60-supabaseops.conf` con:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
```

Verify and reload:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

Expected: `sshd -t` exit 0 y una tercera sesión por clave funciona.

- [ ] **Step 7: Documentar y commit**

```bash
git add docs/operations/2026-09-22-vps-baseline.md
git commit -m "docs: record VPS hardening"
```

### Task 3: Configurar UFW sin bloquear SSH

**Files:**
- Modify: `docs/operations/2026-09-22-vps-baseline.md`

**Interfaces:**
- Consumes: puerto SSH verificado y, si existe, IP/CIDR estable de administración.
- Produces: política deny-by-default con sólo SSH permitido durante preparación.

- [ ] **Step 1: Instalar UFW**

```bash
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

- [ ] **Step 2: Permitir SSH antes de habilitar**

Con IP estable:

```bash
sudo ufw allow from "$MANITO_ADMIN_CIDR" to any port "$MANITO_SSH_PORT" proto tcp comment 'SSH admin'
```

Sin IP estable, permitir temporalmente el puerto SSH global, registrar el riesgo y restringirlo cuando exista un origen estable.

- [ ] **Step 3: Habilitar y verificar**

```bash
sudo ufw --force enable
sudo ufw status numbered
sudo ss -lntup
```

Expected: sólo el puerto SSH está permitido inbound; una sesión nueva sigue funcionando.

- [ ] **Step 4: Documentar y commit**

```bash
git add docs/operations/2026-09-22-vps-baseline.md
git commit -m "docs: record VPS firewall baseline"
```

### Task 4: Instalar Docker Engine y Compose desde el repositorio oficial

**Files:**
- Modify: `docs/operations/2026-09-22-vps-baseline.md`

**Interfaces:**
- Consumes: Ubuntu actualizado y UFW activo.
- Produces: Docker Engine y Compose plugin instalados, sin contenedores ni puertos publicados.

- [ ] **Step 1: Instalar prerequisitos y keyring**

```bash
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

- [ ] **Step 2: Añadir el repositorio Docker para Ubuntu noble**

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
```

- [ ] **Step 3: Instalar paquetes fijados por APT**

```bash
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

No agregar `supabaseops` al grupo `docker`; ese grupo equivale a root. Usar `sudo docker`.

- [ ] **Step 4: Verificar sin publicar puertos**

```bash
sudo docker version
sudo docker compose version
sudo docker info
sudo docker ps --format '{{.Names}} {{.Ports}}'
sudo ss -lntup
```

Expected: Docker activo, cero contenedores Supabase y ningún puerto nuevo escuchando.

- [ ] **Step 5: Documentar y commit**

```bash
git add docs/operations/2026-09-22-vps-baseline.md
git commit -m "docs: record Docker installation"
```

### Task 5: Inventariar el proyecto Supabase administrado de forma read-only

**Files:**
- Create: `docs/operations/2026-09-22-supabase-live-schema-inventory.md`
- Create: `supabase/baseline/README.md`
- Create: `supabase/baseline/schema.sql`
- Create: `supabase/baseline/roles.sql`

**Interfaces:**
- Consumes: conexión read-only/administrativa del proyecto administrado por canal seguro.
- Produces: baseline sólo de roles/esquema y manifiesto sanitizado; cero datos de producción.

- [ ] **Step 1: Verificar CLI y descubrir comandos**

```bash
npx supabase --version
npx supabase db dump --help
```

Expected: versión registrada y flags confirmados desde `--help`.

- [ ] **Step 2: Ejecutar queries de inventario read-only**

Capturar versión Postgres, extensiones, tablas/columnas, secuencias, constraints, índices, grants, RLS/policies, funciones, triggers, publicaciones Realtime, `auth` config visible y metadata de buckets. Guardar sólo estructura y conteos, nunca filas, emails, teléfonos, tokens ni contenido.

- [ ] **Step 3: Exportar roles y esquema, no data**

```bash
npx supabase db dump --db-url "$SUPABASE_PLATFORM_DB_URL" -f supabase/baseline/roles.sql --role-only
npx supabase db dump --db-url "$SUPABASE_PLATFORM_DB_URL" -f supabase/baseline/schema.sql
```

Expected: no ejecutar `--data-only`; revisar que los archivos no contengan passwords, API keys ni filas de negocio.

- [ ] **Step 4: Comparar con el repositorio**

Verificar las 64 tablas usadas por runtime, diez RPCs, veinte triggers, RLS, cinco buckets y extensión `pgcrypto`. Clasificar los 48 SQL históricos sin ejecutarlos.

- [ ] **Step 5: Escanear secretos y validar SQL**

```bash
git diff --check
rg -n 'eyJ|sb_secret_|service_role|access_token|secret_key|password\s*=' supabase/baseline docs/operations/2026-09-22-supabase-live-schema-inventory.md
```

Expected: sólo nombres de variables o comentarios, ningún valor.

- [ ] **Step 6: Commit**

```bash
git add supabase/baseline docs/operations/2026-09-22-supabase-live-schema-inventory.md
git commit -m "docs: add canonical Supabase schema baseline"
```

### Task 6: Preparar el paquete self-hosted fijado, sin iniciarlo

**Files:**
- Create on VPS: `/opt/supabase-lamanito/source/`
- Create on VPS: `/opt/supabase-lamanito/stack/`
- Create on VPS: `/opt/supabase-lamanito/stack/.supabase-version`
- Create: `docs/operations/2026-09-22-supabase-stack-manifest.md`

**Interfaces:**
- Consumes: Docker funcional, changelog revisado y release `self-hosted/v0.8.1`.
- Produces: configuración versionada/pinneada en disco, todavía detenida.

- [ ] **Step 1: Revisar breaking changes oficiales**

Confirmar Envoy por defecto, PostgreSQL 17, `API_EXTERNAL_URL` con `/auth/v1`, Analytics/Vector opt-in y claves/JWKS nuevas. Si `self-hosted/v0.8.1` deja de ser la release estable, actualizar este plan en un commit separado antes de descargar.

- [ ] **Step 2: Crear directorios con ownership mínimo**

```bash
sudo install -d -m 0750 -o supabaseops -g supabaseops /opt/supabase-lamanito/source
sudo install -d -m 0750 -o supabaseops -g supabaseops /opt/supabase-lamanito/stack
```

- [ ] **Step 3: Descargar la release fijada**

```bash
git clone --depth 1 --branch self-hosted/v0.8.1 https://github.com/supabase/supabase /opt/supabase-lamanito/source
cp -a /opt/supabase-lamanito/source/docker/. /opt/supabase-lamanito/stack/
printf 'ref=self-hosted/v0.8.1\n' | tee /opt/supabase-lamanito/stack/.supabase-version >/dev/null
```

- [ ] **Step 4: Registrar imágenes y hashes**

```bash
cd /opt/supabase-lamanito/stack
sudo docker compose config --images
sha256sum docker-compose*.yml .env.example .supabase-version
```

Expected: manifiesto reproducible. No ejecutar `docker compose up`.

- [ ] **Step 5: Documentar y commit**

```bash
git add docs/operations/2026-09-22-supabase-stack-manifest.md
git commit -m "docs: pin self-hosted Supabase stack"
```

### Task 7: Diseñar red, secretos y servicios mínimos

**Files:**
- Create on VPS: `/opt/supabase-lamanito/stack/.env` mode `0600`
- Modify on VPS: `/opt/supabase-lamanito/stack/docker-compose.yml`
- Create on VPS: `/etc/docker/daemon.json` only if required by the verified Docker/UFW design
- Create: `docs/operations/2026-09-22-supabase-network-secrets.md`

**Interfaces:**
- Consumes: inventario funcional que confirma que Realtime y Edge Functions no se usan.
- Produces: stack mínimo con gateway en loopback, secretos generados y nada público salvo SSH.

- [ ] **Step 1: Generar secretos sin mostrarlos**

Usar los scripts oficiales `generate-keys.sh` y `add-new-auth-keys.sh`, escribir `.env` con umask `077` y almacenar una copia cifrada fuera del VPS. No ejecutar `run.sh secrets` en una terminal compartida.

- [ ] **Step 2: Configurar claves compatibles**

Mantener temporalmente `ANON_KEY` y `SERVICE_ROLE_KEY` para el código existente y habilitar `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `JWT_KEYS` y `JWT_JWKS`. Confirmar que Auth, PostgREST, Storage y cualquier servicio conservado verifican el mismo JWKS.

- [ ] **Step 3: Minimizar servicios**

Deshabilitar Analytics/Vector. Omitir Realtime y Edge Functions sólo después de comprobar que Compose no deja dependencias rotas. Conservar Studio únicamente para administración local/túnel.

- [ ] **Step 4: Cerrar puertos de Docker**

Bind del gateway a `127.0.0.1:8000`; no publicar Postgres `5432`, pooler `6543`, Studio ni servicios internos. Verificar `docker compose config` y reglas `DOCKER-USER` antes de arrancar.

- [ ] **Step 5: Validar configuración sin iniciar**

```bash
cd /opt/supabase-lamanito/stack
sudo docker compose config --quiet
sudo docker compose config | grep -nE 'published:|host_ip:|5432|6543|8000'
```

Expected: sólo `127.0.0.1:8000` publicado; ninguna contraseña en el documento o commit.

- [ ] **Step 6: Documentar y commit**

```bash
git add docs/operations/2026-09-22-supabase-network-secrets.md
git commit -m "docs: define Supabase network and secret controls"
```

### Task 8: Iniciar el stack vacío y validar aislamiento

**Files:**
- Modify: `docs/operations/2026-09-22-supabase-stack-manifest.md`

**Interfaces:**
- Consumes: stack validado de Task 7.
- Produces: instancia vacía saludable y accesible sólo por túnel/local.

- [ ] **Step 1: Pull de imágenes fijadas**

```bash
cd /opt/supabase-lamanito/stack
sudo docker compose pull
```

- [ ] **Step 2: Iniciar y esperar healthchecks**

```bash
sudo sh run.sh start
sudo docker compose ps
```

Expected: servicios requeridos `healthy`; si falla uno, revisar logs del servicio y no reiniciar en bucle.

- [ ] **Step 3: Probar localmente**

```bash
curl --fail --silent http://127.0.0.1:8000/auth/v1/health
curl --fail --silent http://127.0.0.1:8000/rest/v1/ -H "apikey: $SUPABASE_SECRET_KEY" >/dev/null
```

- [ ] **Step 4: Verificar exposición externa**

```bash
sudo ss -lntup
sudo ufw status verbose
sudo nft list ruleset
sudo docker ps --format '{{.Names}} {{.Ports}}'
```

Expected: el gateway sólo en `127.0.0.1:8000`; `5432`, `6543` y Studio no escuchan públicamente.

- [ ] **Step 5: Commit evidencia sanitizada**

```bash
git add docs/operations/2026-09-22-supabase-stack-manifest.md
git commit -m "docs: verify isolated Supabase stack"
```

### Task 9: Restaurar el baseline de esquema y crear fixtures sintéticos

**Files:**
- Create: `supabase/fixtures/self-hosted-smoke.sql`
- Create: `scripts/verify-self-hosted-schema.mjs`
- Create: `test/self-hosted-schema-contract.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `supabase/baseline/roles.sql`, `supabase/baseline/schema.sql` y DB local vía túnel.
- Produces: esquema reproducible, dataset sintético y verificador automático.

- [ ] **Step 1: Escribir test de contrato que falle**

El test debe exigir las 64 tablas runtime, diez RPCs, veinte triggers, RLS esperado, grants, cinco buckets y extensión `pgcrypto`; debe rechazar exposición pública de tablas sensibles.

- [ ] **Step 2: Ejecutar y confirmar fallo en la base vacía**

```bash
npm test -- test/self-hosted-schema-contract.test.ts
```

Expected: FAIL por esquema ausente.

- [ ] **Step 3: Restaurar roles y esquema en una transacción**

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 --file supabase/baseline/roles.sql --file supabase/baseline/schema.sql "$SELF_HOSTED_DB_URL"
```

- [ ] **Step 4: Crear fixtures sin datos reales**

`supabase/fixtures/self-hosted-smoke.sql` debe crear un usuario sintético, rol admin sintético, catálogo mínimo, stock, zona, cupón, configuración de entrega, conversación y pedido de prueba. No incluir emails, teléfonos, tokens, imágenes o IDs de producción.

- [ ] **Step 5: Ejecutar contrato y advisors**

```bash
npm test -- test/self-hosted-schema-contract.test.ts
npx supabase db advisors --help
```

Run advisors con la sintaxis descubierta por `--help`. Expected: contrato PASS y findings de seguridad/performance triaged.

- [ ] **Step 6: Ejecutar suite del repositorio**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: 486+ tests pass, TypeScript exit 0 y build exit 0. Lint no debe superar el baseline de 493 errores y 28 warnings hasta que se haga una limpieza separada.

- [ ] **Step 7: Commit**

```bash
git add supabase/fixtures scripts/verify-self-hosted-schema.mjs test/self-hosted-schema-contract.test.ts package.json package-lock.json
git commit -m "test: verify self-hosted Supabase schema"
```

### Task 10: Recrear Storage y validar privacidad

**Files:**
- Create: `supabase/baseline/storage-buckets.sql`
- Create: `test/self-hosted-storage-contract.test.ts`

**Interfaces:**
- Consumes: metadata read-only de buckets de producción.
- Produces: buckets/policies reproducibles con objetos sintéticos.

- [ ] **Step 1: Escribir test de Storage que falle**

Exigir `productos`, `products`, `blog`, `omnichannel-media` y `wonka-attachments`, verificando public/private, límites MIME/tamaño y RLS de objetos.

- [ ] **Step 2: Crear buckets y policies**

Versionar sólo metadata/policies. Establecer `wonka-attachments` como privado. Revisar `omnichannel-media`: la recomendación es privado por contener comprobantes; si cambia a privado, adaptar el código en una tarea aprobada independiente antes del cutover.

- [ ] **Step 3: Probar objetos sintéticos**

Verificar upload público de producto, URL pública, signed URL privada, expiración, download autorizado y rechazo anon de adjuntos privados.

- [ ] **Step 4: Commit**

```bash
git add supabase/baseline/storage-buckets.sql test/self-hosted-storage-contract.test.ts
git commit -m "test: define Storage migration contract"
```

### Task 11: Configurar backups, restore drill y monitoreo antes de Preview

**Files:**
- Create on VPS: `/opt/supabase-lamanito/backup/backup.sh`
- Create on VPS: `/etc/systemd/system/supabase-backup.service`
- Create on VPS: `/etc/systemd/system/supabase-backup.timer`
- Create: `docs/operations/2026-09-22-supabase-backup-restore.md`

**Interfaces:**
- Consumes: stack con esquema y fixtures sintéticos.
- Produces: backup cifrado, copia offsite y restore demostrado.

- [ ] **Step 1: Implementar backup lógico y de objetos**

El script debe usar `pg_dump` compatible con la imagen PostgreSQL, exportar metadata y objetos Storage, cifrar antes de copia offsite, escribir logs sin secretos y retener 7 diarios, 4 semanales y 6 mensuales.

- [ ] **Step 2: Configurar systemd timer**

El servicio debe usar un `EnvironmentFile` root-only, `UMask=0077`, `NoNewPrivileges=true` y salida a journald sin connection strings.

- [ ] **Step 3: Ejecutar restore drill aislado**

Restaurar el backup sintético en un stack temporal o DB separada, correr el contrato de esquema y comparar conteos/checksums de fixtures.

- [ ] **Step 4: Definir monitoreo**

Alertar por healthchecks, disco, memoria, restart loops, expiración TLS, backup atrasado y fallo de restore. No habilitar Analytics/Vector sólo para esto.

- [ ] **Step 5: Commit**

```bash
git add docs/operations/2026-09-22-supabase-backup-restore.md
git commit -m "docs: verify Supabase backup and restore"
```

### Task 12: Exponer HTTPS controlado sin cambiar DNS

**Files:**
- Create on VPS: reverse proxy config under `/etc/caddy/` or `/etc/nginx/`
- Create: `docs/operations/2026-09-22-supabase-https.md`

**Interfaces:**
- Consumes: dominio/subdominio aprobado o acceso temporal por túnel.
- Produces: endpoint HTTPS hacia `127.0.0.1:8000`, sin exponer servicios internos.

- [ ] **Step 1: Mantener el ensayo por túnel mientras no haya DNS aprobado**

```bash
ssh -p "$MANITO_SSH_PORT" -L 8000:127.0.0.1:8000 supabaseops@"$MANITO_SSH_HOST"
```

No abrir `80/443` ni emitir certificados si no existe un hostname aprobado.

- [ ] **Step 2: Tras aprobación separada, instalar reverse proxy**

Permitir `80/tcp` y `443/tcp` en UFW sólo en esta etapa. Proxy hacia `127.0.0.1:8000`, headers correctos, límites de body y TLS moderno. Studio debe mantenerse fuera del vhost público o bajo acceso restringido adicional.

- [ ] **Step 3: Verificar puertos y TLS**

```bash
sudo ss -lntup
sudo ufw status verbose
curl --fail --silent "https://$MANITO_SUPABASE_HOST/auth/v1/health"
```

Expected: público sólo SSH restringido y `80/443`; DB/pooler/gateway/Studio no públicos.

- [ ] **Step 4: Commit**

```bash
git add docs/operations/2026-09-22-supabase-https.md
git commit -m "docs: record Supabase HTTPS exposure"
```

### Task 13: Validar con Vercel Preview, nunca Production

**Files:**
- Create: `docs/operations/2026-09-22-supabase-preview-validation.md`

**Interfaces:**
- Consumes: endpoint HTTPS de ensayo, clave pública y clave server-side de ensayo.
- Produces: matriz end-to-end desde un deployment Preview aislado.

- [ ] **Step 1: Pedir aprobación explícita para variables Preview**

No modificar Production. Configurar sólo Preview: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` o publishable key compatible y `SUPABASE_SERVICE_ROLE_KEY`/secret key compatible.

- [ ] **Step 2: Desactivar side effects externos**

Usar credenciales sandbox o ausentes; `META_SEND_MODE=disabled`; sin cron activo; sin webhooks externos apuntando al Preview; Flow/MP sandbox; email/WhatsApp/Instagram/Wonka en modo seguro.

- [ ] **Step 3: Ejecutar matriz crítica con datos sintéticos**

Validar catálogo, producto, checkout, stock idempotente, pedido, login/reset/logout, roles admin, uploads públicos/privados, Flow sandbox, Mercado Pago sandbox, Pixel/CAPI test mode, WhatsApp read-only, Instagram sin outbound, Wonka sin jobs reales y endpoints cron invocados manualmente una sola vez.

- [ ] **Step 4: Verificar ausencia de tráfico al Supabase administrado**

Revisar logs del Preview y red del navegador para confirmar que no aparece el host administrado ni URLs antiguas salvo contenido histórico explícitamente catalogado.

- [ ] **Step 5: Commit**

```bash
git add docs/operations/2026-09-22-supabase-preview-validation.md
git commit -m "docs: validate self-hosted Supabase preview"
```

### Task 14: Ensayo autorizado de datos de producción

**Files:**
- Create: `docs/operations/2026-09-22-supabase-data-rehearsal.md`

**Interfaces:**
- Consumes: aprobación explícita para copiar datos, ventana y canal seguro para credenciales.
- Produces: restore de ensayo, conteos/checksums, prueba de Auth/Storage y duración medida.

- [ ] **Step 1: Crear dumps oficiales separados**

```bash
npx supabase db dump --db-url "$SUPABASE_PLATFORM_DB_URL" -f roles.sql --role-only
npx supabase db dump --db-url "$SUPABASE_PLATFORM_DB_URL" -f schema.sql
npx supabase db dump --db-url "$SUPABASE_PLATFORM_DB_URL" -f data.sql --use-copy --data-only
```

- [ ] **Step 2: Restaurar con triggers suspendidos**

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command 'SET session_replication_role = replica' --file data.sql "$SELF_HOSTED_DB_URL"
```

- [ ] **Step 3: Copiar Storage por separado**

Preservar bucket, path, metadata, MIME y privacidad. No reescribir producción; copiar a self-hosted y verificar checksums.

- [ ] **Step 4: Validar**

Comparar conteos por tabla, secuencias, FK huérfanas, checksums de objetos, usuarios Auth, roles, RLS, RPCs, triggers, idempotencia y URLs antiguas. No enviar side effects externos.

- [ ] **Step 5: Destruir el ensayo sólo con aprobación**

Conservar el entorno si se necesita investigar. Nunca ejecutar `reset.sh` o `docker compose down -v` sin una aprobación destructiva específica y targets verificados.

- [ ] **Step 6: Commit**

```bash
git add docs/operations/2026-09-22-supabase-data-rehearsal.md
git commit -m "docs: record Supabase data rehearsal"
```

### Task 15: Diseñar y aprobar cutover/rollback de producción

**Files:**
- Create: `docs/operations/2026-09-22-supabase-cutover-runbook.md`

**Interfaces:**
- Consumes: Preview completo, ensayo de datos, RTO/RPO y aprobación explícita.
- Produces: runbook minuto a minuto con go/no-go y rollback.

- [ ] **Step 1: Definir freeze y último sync**

Elegir ventana, bloquear escrituras o poner checkout en mantenimiento, capturar último dump y Storage delta, restaurar, verificar y medir lag cero. No usar doble escritura.

- [ ] **Step 2: Definir cambio de Vercel Production**

Cambiar las tres variables Supabase sólo después de autorización explícita y redeploy controlado. Mantener las credenciales administradas disponibles para rollback; no eliminar el proyecto administrado.

- [ ] **Step 3: Definir webhooks y cron**

Como los callbacks siguen en Vercel, no cambiar Meta, Flow o Mercado Pago por el host Supabase. Verificar una sola fuente de cron y pausar side effects durante la ventana.

- [ ] **Step 4: Definir rollback**

Ante cualquier fallo de Auth, checkout, stock, pedidos, pagos, webhooks, Storage o admin: detener escrituras self-hosted, restaurar variables Vercel anteriores, redeploy, verificar el managed project y reconciliar manualmente escrituras creadas durante la ventana.

- [ ] **Step 5: Definir observación posterior**

Monitorear al menos 24 horas: errores 4xx/5xx, latencia, conexiones DB, disco, pagos pendientes, webhooks, jobs, Auth, uploads y consistencia de stock/pedidos. Mantener rollback disponible.

- [ ] **Step 6: Commit y aprobación final**

```bash
git add docs/operations/2026-09-22-supabase-cutover-runbook.md
git commit -m "docs: define Supabase cutover and rollback"
```

No ejecutar el cutover hasta que el usuario apruebe explícitamente este runbook final.
