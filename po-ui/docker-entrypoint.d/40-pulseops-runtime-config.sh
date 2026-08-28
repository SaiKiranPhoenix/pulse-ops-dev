#!/bin/sh
set -eu

api_base_url="${PULSEOPS_API_BASE_URL:-${VITE_API_BASE_URL:-http://localhost:4000}}"
realtime_url="${PULSEOPS_REALTIME_URL:-${VITE_REALTIME_URL:-${VITE_SOCKET_URL:-http://localhost:4130}}}"

escape_js_string() {
  printf '%s' "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g"
}

cat > /usr/share/nginx/html/pulseops-config.js <<EOF
window.__PULSEOPS_CONFIG__ = {
  apiBaseUrl: '$(escape_js_string "$api_base_url")',
  realtimeUrl: '$(escape_js_string "$realtime_url")'
};
EOF
