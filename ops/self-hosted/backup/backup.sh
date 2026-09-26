#!/usr/bin/env bash
set -euo pipefail
umask 077

base=/opt/supabase-lamanito/backup
stack=/opt/supabase-lamanito/stack
key="$base/.key"
lock="$base/backup.lock"
run=""
rclone_config=/run/lmv-backup-rclone.conf

exec 9>"$lock"
flock -n 9 || { echo BACKUP_ALREADY_RUNNING; exit 0; }

cleanup() {
  rm -f "$rclone_config"
  if [[ -n "$run" && "$run" == "$base/tmp/run."* && -d "$run" ]]; then
    rm -rf -- "$run"
  fi
}
trap cleanup EXIT

test -r "$key"
mkdir -p "$base"/{daily,weekly,monthly,tmp,logs,offsite}
run=$(mktemp -d "$base/tmp/run.XXXXXX")
stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="lmv-supabase-$stamp.tar.gz.enc"
mkdir -p "$run/payload"/{database,storage,config}

docker inspect -f '{{.State.Health.Status}}' supabase-db | grep -qx healthy
docker exec supabase-db pg_dumpall -U supabase_admin --roles-only --no-role-passwords > "$run/payload/database/roles.sql"
docker exec supabase-db pg_dump -U supabase_admin -d postgres --schema-only --no-owner --no-privileges > "$run/payload/database/schema.sql"
docker exec supabase-db pg_dump -U supabase_admin -d postgres --data-only --disable-triggers --no-owner --no-privileges > "$run/payload/database/data.sql"

set -a
# shellcheck disable=SC1091
source "$stack/.env"
set +a
test -n "${S3_PROTOCOL_ACCESS_KEY_ID:-}"
test -n "${S3_PROTOCOL_ACCESS_KEY_SECRET:-}"
test -n "${REGION:-}"
test -n "${SUPABASE_PUBLIC_URL:-}"
s3_endpoint="${SUPABASE_PUBLIC_URL%/}/storage/v1/s3"
printf '%s\n' \
  '[selfhost]' \
  'type = s3' \
  'provider = Other' \
  "access_key_id = $S3_PROTOCOL_ACCESS_KEY_ID" \
  "secret_access_key = $S3_PROTOCOL_ACCESS_KEY_SECRET" \
  "region = $REGION" \
  "endpoint = $s3_endpoint" \
  'force_path_style = true' > "$rclone_config"

for bucket in productos omnichannel-media wonka-attachments; do
  mkdir -p "$run/payload/storage/$bucket"
  rclone copy "selfhost:$bucket" "$run/payload/storage/$bucket" \
    --config "$rclone_config" \
    --exclude-from "$base/excludes/missing-$bucket.txt" \
    --s3-no-check-bucket --checkers 4 --transfers 4 --log-level ERROR
done

cp -a "$stack/.env" "$run/payload/config/.env"
find "$stack" -maxdepth 1 -type f -name 'docker-compose*.yml' -exec cp -a {} "$run/payload/config/" \;
mkdir -p "$run/payload/config/volumes"
for relative in api/envoy api/kong.yml db/init db/_supabase.sql db/jwt.sql db/logs.sql db/pooler.sql db/realtime.sql db/roles.sql db/webhooks.sql functions pooler proxy; do
  if [[ -e "$stack/volumes/$relative" ]]; then
    mkdir -p "$run/payload/config/volumes/$(dirname "$relative")"
    cp -a "$stack/volumes/$relative" "$run/payload/config/volumes/$relative"
  fi
done

(
  cd "$run/payload"
  find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
  printf 'created_utc=%s\nstack_release=self-hosted/v0.8.1\n' "$stamp" > BACKUP-MANIFEST.txt
  printf 'database_roles_bytes=%s\ndatabase_schema_bytes=%s\ndatabase_data_bytes=%s\n' \
    "$(stat -c %s database/roles.sql)" \
    "$(stat -c %s database/schema.sql)" \
    "$(stat -c %s database/data.sql)" >> BACKUP-MANIFEST.txt
  for bucket in productos omnichannel-media wonka-attachments; do
    count=$(find "storage/$bucket" -type f | wc -l)
    bytes=$(find "storage/$bucket" -type f -printf '%s\n' | awk '{s+=$1} END {print s+0}')
    printf 'storage_%s_objects=%s\nstorage_%s_bytes=%s\n' "$bucket" "$count" "$bucket" "$bytes" >> BACKUP-MANIFEST.txt
  done
)

tar -C "$run/payload" -czf - . | openssl enc -aes-256-cbc -pbkdf2 -salt -pass file:"$key" -out "$base/daily/$archive"
sha256sum "$base/daily/$archive" > "$base/daily/$archive.sha256"
install -o root -g supabaseops -m 0640 "$base/daily/$archive" "$base/offsite/$archive"
install -o root -g supabaseops -m 0640 "$base/daily/$archive.sha256" "$base/offsite/$archive.sha256"

find "$base/daily" -maxdepth 1 -type f -name '*.tar.gz.enc' -printf '%T@ %p\n' | sort -nr | awk 'NR>7 {print $2}' | while read -r old; do rm -f -- "$old" "$old.sha256"; done
if [[ $(date -u +%u) == 7 ]]; then
  cp -a "$base/daily/$archive" "$base/daily/$archive.sha256" "$base/weekly/"
fi
if [[ $(date -u +%d) == 01 ]]; then
  cp -a "$base/daily/$archive" "$base/daily/$archive.sha256" "$base/monthly/"
fi
find "$base/weekly" -maxdepth 1 -type f -name '*.tar.gz.enc' -printf '%T@ %p\n' | sort -nr | awk 'NR>4 {print $2}' | while read -r old; do rm -f -- "$old" "$old.sha256"; done
find "$base/monthly" -maxdepth 1 -type f -name '*.tar.gz.enc' -printf '%T@ %p\n' | sort -nr | awk 'NR>6 {print $2}' | while read -r old; do rm -f -- "$old" "$old.sha256"; done
find "$base/offsite" -maxdepth 1 -type f -name '*.tar.gz.enc' -printf '%T@ %p\n' | sort -nr | awk 'NR>2 {print $2}' | while read -r old; do rm -f -- "$old" "$old.sha256"; done

echo "BACKUP_OK archive=$archive"

