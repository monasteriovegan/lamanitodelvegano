#!/usr/bin/env bash
set -uo pipefail

systemctl_bin=${LMV_SYSTEMCTL_BIN:-systemctl}
journalctl_bin=${LMV_JOURNALCTL_BIN:-journalctl}
date_bin=${LMV_DATE_BIN:-date}
max_age_seconds=${LMV_CRON_MAX_AGE_SECONDS:-129600}
max_failures=${LMV_CRON_MAX_FAILURES:-2}
now_epoch=$("$date_bin" -u +%s)
fail=0

jobs=(lmv-reconciliation lmv-abandoned-carts lmv-opportunities)
for job in "${jobs[@]}"; do
  timer="$job.timer"
  service="$job.service"

  if ! "$systemctl_bin" is-enabled --quiet "$timer"; then
    printf 'ALERT timer_disabled=%s\n' "$timer"
    fail=1
  fi

  result=$("$systemctl_bin" show "$service" --property=Result --value 2>/dev/null || true)
  if [[ $result != success ]]; then
    printf 'ALERT service_failed=%s result=%s\n' "$service" "${result:-unknown}"
    fail=1
  fi

  last_exit=$("$systemctl_bin" show "$service" --property=ExecMainExitTimestamp --value 2>/dev/null || true)
  last_epoch=$("$date_bin" --date="$last_exit" +%s 2>/dev/null || true)
  if [[ -z $last_epoch ]]; then
    printf 'ALERT last_success_missing=%s\n' "$service"
    fail=1
  elif (( now_epoch - last_epoch > max_age_seconds )); then
    printf 'ALERT last_success_older_than_36h=%s\n' "$service"
    fail=1
  fi

  failure_count=$("$journalctl_bin" --unit "$service" --since '-36 hours' --no-pager --output=cat 2>/dev/null \
    | grep -c 'outcome=failure' || true)
  if (( failure_count >= max_failures )); then
    printf 'ALERT repeated_failures=%s count=%s\n' "$service" "$failure_count"
    fail=1
  fi
done

if (( fail == 0 )); then
  printf 'CRON_HEALTH_OK timers=%s max_age_seconds=%s\n' "${#jobs[@]}" "$max_age_seconds"
fi
exit "$fail"
