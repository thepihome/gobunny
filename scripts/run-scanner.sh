#!/usr/bin/env bash
# Start the GoBunnyy job portal scanner service only.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCANNER="$ROOT/scanner"
BACKEND="$ROOT/backend"
SCANNER_PORT="${SCANNER_PORT:-8790}"
BACKEND_PORT="${BACKEND_PORT:-8787}"
DEFAULT_SECRET="local-dev-scanner-secret-change-in-production"

secret="$DEFAULT_SECRET"
if [[ -f "$BACKEND/.dev.vars" ]] && grep -q '^SCANNER_SECRET=' "$BACKEND/.dev.vars" 2>/dev/null; then
  secret="$(grep '^SCANNER_SECRET=' "$BACKEND/.dev.vars" | head -1 | cut -d= -f2-)"
fi

if [[ ! -f "$SCANNER/.env" ]]; then
  cat >"$SCANNER/.env" <<EOF
SCANNER_PORT=${SCANNER_PORT}
SCANNER_SECRET=${secret}
GOBUNNY_API_URL=http://localhost:${BACKEND_PORT}/api
CONFIG_POLL_MS=60000
EOF
  echo "Created scanner/.env"
elif ! grep -q '^SCANNER_SECRET=' "$SCANNER/.env" 2>/dev/null; then
  echo "SCANNER_SECRET=${secret}" >>"$SCANNER/.env"
  echo "Added SCANNER_SECRET to scanner/.env"
fi

if [[ -f "$BACKEND/.dev.vars" ]] && ! grep -q '^SCANNER_SECRET=' "$BACKEND/.dev.vars" 2>/dev/null; then
  echo "SCANNER_SERVICE_URL=http://localhost:${SCANNER_PORT}" >>"$BACKEND/.dev.vars"
  echo "SCANNER_SECRET=${secret}" >>"$BACKEND/.dev.vars"
  echo "Added SCANNER_SECRET to backend/.dev.vars — restart wrangler dev if running."
fi

cd "$SCANNER"
npm install --silent 2>/dev/null || npm install
echo "Scanner starting on http://localhost:${SCANNER_PORT}"
exec env SCANNER_PORT="$SCANNER_PORT" npm start
