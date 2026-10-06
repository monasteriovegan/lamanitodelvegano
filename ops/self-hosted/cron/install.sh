#!/usr/bin/env bash
set -euo pipefail

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
install_root=${LMV_INSTALL_ROOT:-}
skip_user_setup=${LMV_SKIP_USER_SETUP:-0}
skip_systemd=${LMV_SKIP_SYSTEMD:-0}

target() {
  printf '%s%s' "$install_root" "$1"
}

make_dir() {
  local mode=$1 path=$2
  if [[ -n $install_root ]]; then
    mkdir -p "$path"
  else
    install -d -m "$mode" "$path"
  fi
}

copy_file() {
  local mode=$1 source=$2 destination=$3
  if [[ -n $install_root ]]; then
    cp "$source" "$destination"
  else
    install -m "$mode" "$source" "$destination"
  fi
}

if [[ -z $install_root && $EUID -ne 0 ]]; then
  printf 'install.sh must run as root\n' >&2
  exit 77
fi

if [[ $skip_user_setup != 1 ]]; then
  if ! getent passwd lmv-cron >/dev/null; then
    useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin --no-create-home lmv-cron
  fi
fi

make_dir 0755 "$(target /usr/local/libexec)"
copy_file 0755 "$source_dir/lmv-cron-run" "$(target /usr/local/libexec/lmv-cron-run)"

make_dir 0700 "$(target /etc/lmv-cron)"
env_file=$(target /etc/lmv-cron/cron.env)
if [[ ! -e $env_file ]]; then
  touch "$env_file"
  printf 'LMV_CRON_BASE_URL=https://lamanitodelvegano.cl\n' > "$env_file"
fi
if [[ -z $install_root ]]; then chmod 0600 "$env_file"; fi

make_dir 0755 "$(target /etc/systemd/system)"
for unit in \
  lmv-reconciliation.service lmv-reconciliation.timer \
  lmv-abandoned-carts.service lmv-abandoned-carts.timer \
  lmv-opportunities.service lmv-opportunities.timer; do
  copy_file 0644 "$source_dir/$unit" "$(target /etc/systemd/system/$unit)"
done

make_dir 0755 "$(target /etc/systemd/journald.conf.d)"
copy_file 0644 "$source_dir/50-lmv-journal-retention.conf" \
  "$(target /etc/systemd/journald.conf.d/50-lmv-journal-retention.conf)"

backup_bin=$(target /opt/supabase-lamanito/backup/bin)
make_dir 0700 "$backup_bin"
copy_file 0700 "$source_dir/cron-healthcheck.sh" "$backup_bin/cron-healthcheck.sh"
copy_file 0700 "$source_dir/../backup/healthcheck.sh" "$backup_bin/healthcheck.sh"

if [[ -z $install_root ]]; then
  chown root:root "$env_file"
fi

if [[ $skip_systemd != 1 ]]; then
  systemctl daemon-reload
  systemctl disable --now \
    lmv-reconciliation.timer \
    lmv-abandoned-carts.timer \
    lmv-opportunities.timer >/dev/null 2>&1 || true
  systemd-analyze verify \
    /etc/systemd/system/lmv-reconciliation.service \
    /etc/systemd/system/lmv-reconciliation.timer \
    /etc/systemd/system/lmv-abandoned-carts.service \
    /etc/systemd/system/lmv-abandoned-carts.timer \
    /etc/systemd/system/lmv-opportunities.service \
    /etc/systemd/system/lmv-opportunities.timer
fi

printf 'LMV_CRON_INSTALL_OK timers=disabled env_file=%s\n' "$env_file"
