#!/bin/sh
set -eu

mkdir -p /data/.vnc /data/profiles /data/screenshots

: "${VNC_PASSWORD:?missing_VNC_PASSWORD}"

x11vnc -storepasswd "$VNC_PASSWORD" /data/.vnc/passwd >/dev/null

Xvfb :99 -screen 0 1440x1000x24 -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
sleep 1
DISPLAY=:99 fluxbox >/tmp/fluxbox.log 2>&1 &
DISPLAY=:99 x11vnc -display :99 -rfbauth /data/.vnc/passwd -forever -shared -listen 0.0.0.0 -rfbport 5900 -noxdamage >/tmp/x11vnc.log 2>&1 &
websockify --web=/usr/share/novnc 6080 localhost:5900 >/tmp/websockify.log 2>&1 &

export DISPLAY=:99
export BROWSER_HEADLESS=false

echo "synthetiq_supervised_desktop_started display=:99 novnc_port=6080"
exec node src/index.js
