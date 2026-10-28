#!/bin/bash
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --silent
[ -e /dev/video10 ] || pkexec modprobe v4l2loopback devices=1 video_nr=10 card_label=wepland exclusive_caps=1 max_buffers=8 2>/dev/null
node server.js >/tmp/wepland.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1.2
google-chrome --app=https://localhost:8443/ --user-data-dir="$HOME/.config/wepland-app" \
  --ignore-certificate-errors --window-size=900,700 --class=wepland --name=wepland \
  --disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows >/dev/null 2>&1
