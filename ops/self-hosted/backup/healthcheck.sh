#!/usr/bin/env bash
set -euo pipefail

base=/opt/supabase-lamanito/backup
fail=0
containers=(
  realtime-dev.supabase-realtime
  supabase-auth
  supabase-db
  supabase-edge-functions
  supabase-envoy
  supabase-imgproxy
  supabase-meta
  supabase-pooler
  supabase-rest
  supabase-storage
  supabase-studio
)

for container in "${containers[@]}"; do
  state=$(docker inspect -f '{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container" 2>/dev/null || true)
  if [[ "$state" != 'true|healthy' ]]; then echo "ALERT container_not_healthy=$container"; fail=1; fi
done

disk_pct=$(df -P /opt/supabase-lamanito | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if (( disk_pct >= 80 )); then echo "ALERT disk_percent=$disk_pct"; fail=1; fi

mem_total=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
mem_available=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
mem_available_pct=$(( mem_available * 100 / mem_total ))
if (( mem_available_pct < 10 )); then echo "ALERT memory_available_percent=$mem_available_pct"; fail=1; fi

latest=$(find "$base/daily" -maxdepth 1 -type f -name '*.tar.gz.enc' -printf '%T@\n' 2>/dev/null | sort -nr | head -1)
now=$(date +%s)
if [[ -z "$latest" ]] || (( now - ${latest%.*} > 129600 )); then echo 'ALERT backup_older_than_36h'; fail=1; fi

if (( fail == 0 )); then echo "HEALTHCHECK_OK containers=${#containers[@]} disk_percent=$disk_pct memory_available_percent=$mem_available_pct"; fi
exit "$fail"
