#!/bin/sh
# Writes the shared runtime config for all mini apps. Accepts HOST_ORIGINS or VITE_HOST_ORIGINS.
set -e
OUT=/usr/share/nginx/html/env.js
val="$(printenv HOST_ORIGINS || printenv VITE_HOST_ORIGINS || true)"
esc="$(printf '%s' "$val" | sed 's/\\/\\\\/g; s/"/\\"/g')"
echo "window.__ENV__ = { \"HOST_ORIGINS\": \"$esc\" };" > "$OUT"
echo "iemanchat-miniapps: wrote $OUT"
