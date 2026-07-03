#!/usr/bin/env bash
# Start the GoBunnyy job portal scanner service only.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCANNER="$ROOT/scanner"
SCANNER_PORT="${SCANNER_PORT:-8790}"

if [[ ! -f "$SCANNER/.env" ]] && [[ -f "$SCANNER/.env.example" ]]; then
  cp "$SCANNER/.env.example" "$SCANNER/.env"
  echo "Created scanner/.env from .env.example"
fi

cd "$SCANNER"
npm install --silent 2>/dev/null || npm install
echo "Scanner starting on http://localhost:${SCANNER_PORT}"
exec env SCANNER_PORT="$SCANNER_PORT" npm start
