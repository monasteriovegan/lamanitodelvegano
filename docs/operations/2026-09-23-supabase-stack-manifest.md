# Manifiesto del stack Supabase self-hosted

Fecha: 2026-09-23

Estado inicial de este documento: paquete validado, secretos generados y Compose validado; el stack todavía no se había iniciado al registrar este manifiesto.

## Fuente fijada

- Repositorio oficial: `supabase/supabase`.
- Tag: `self-hosted/v0.8.1`.
- Objeto tag remoto: `690080884040e238926ba22606e8c05a3536829b`.
- Commit checkout: `8c7a4d9dbbaf8b552893822e89d7bf06f33f9220`.
- Ruta VPS: `/opt/supabase-lamanito/stack`.

## Compose efectivo

`COMPOSE_FILE=docker-compose.yml:docker-compose.pg17.yml:docker-compose.lmv.yml`

La release ya define Envoy y PostgreSQL 17 como defaults. Se conserva el override oficial `docker-compose.pg17.yml` de forma explícita y se añade un override local mínimo que:

- enlaza Envoy únicamente a `127.0.0.1:8000`;
- elimina las publicaciones `5432` y `6543` de Supavisor;
- no añade `docker-compose.logs.yml`, por lo que Logflare/Analytics y Vector no forman parte del stack.

El único puerto publicado en el Compose resuelto es:

```text
api-gw 127.0.0.1:8000/tcp -> 8000/tcp
```

Studio permanece en la red Docker y sólo es alcanzable a través de Envoy desde loopback. Database, Supavisor, Auth, Storage, Realtime, Functions y demás servicios internos no publican puertos en el host.

## Imágenes fijadas

| Servicio | Imagen |
|---|---|
| Database | `supabase/postgres:17.6.1.136` |
| Gateway | `envoyproxy/envoy:v1.39.1` |
| Auth | `supabase/gotrue:v2.196.0` |
| REST | `postgrest/postgrest:v14.17` |
| Storage | `supabase/storage-api:v1.74.0` |
| Realtime | `supabase/realtime:v2.134.10` |
| Studio | `supabase/studio:2026.09.07-sha-7996410` |
| Postgres Meta | `supabase/postgres-meta:v0.99.0` |
| Functions | `supabase/edge-runtime:v1.76.2` |
| Supavisor | `supabase/supavisor:2.9.12` |
| Imgproxy | `darthsim/imgproxy:v3.31.4` |

## Secretos y Auth

- `.env` es propiedad de `root:root`, modo `0600`, fuera de Git.
- Se usaron los generadores oficiales `utils/generate-keys.sh --update-env` y `utils/add-new-auth-keys.sh --update-env` con salida suprimida.
- Se generaron secretos nuevos para Postgres, JWT legado, claves anon/service-role, JWKS ES256, claves publishable/secret, Dashboard, Realtime, Supavisor, Postgres Meta y S3.
- Se eliminaron los backups temporales `.env.old` y `docker-compose.yml.old`; no quedaron copias adicionales de secretos.
- `API_EXTERNAL_URL` incluye `/auth/v1`.
- Registro de usuarios por email, teléfono y anónimo deshabilitado durante el ensayo aislado.

## Hashes de configuración no secreta

```text
2cada25b2bcd5b52eb6c6d4cd5de8c0adeb2a7433ffe701991dd24ec13ca618a  docker-compose.yml
bd61c0d7ea268d9c3dbe103277899266a5adeaeb1645a3a35198fed35a617112  docker-compose.pg17.yml
719fd6387457f16344e5f94003c7be1dd4e32bdc45944700130400757987d922  docker-compose.lmv.yml
d27fb4516702358ac5965fb06d207736abeb3c26c7d949f19b90e88b25e694ef  .env.example
5cf6f606d3f05f31533ff92d8ba50a29bf233d8569f1e5267fbf7dd6f09b9a7e  .supabase-version
```

