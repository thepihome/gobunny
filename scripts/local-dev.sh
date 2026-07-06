#!/usr/bin/env bash
#
# Test, build, and run GoBunny locally (Workers backend + React frontend).
#
# Usage:
#   ./scripts/local-dev.sh              # install (if needed), test, build, run
#   ./scripts/local-dev.sh test         # run unit tests only
#   ./scripts/local-dev.sh build        # production frontend build + worker dry-run
#   ./scripts/local-dev.sh run          # start backend + frontend (no test/build)
#   ./scripts/local-dev.sh all          # test + build + run
#   ./scripts/local-dev.sh install      # npm install in backend + frontend
#
# Options:
#   --skip-install    Skip npm install
#   --skip-migrate    Skip local D1 schema apply
#   --no-test         Skip tests (with `all` or default)
#   --no-build        Skip build (with `all` or default)
#
# Environment overrides:
#   BACKEND_PORT=8787
#   FRONTEND_PORT=3000
#   REACT_APP_API_URL=http://localhost:8787/api
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
SCANNER="$ROOT/scanner"

BACKEND_PORT="${BACKEND_PORT:-8787}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
API_URL="${REACT_APP_API_URL:-http://localhost:${BACKEND_PORT}/api}"

SKIP_INSTALL=0
SKIP_MIGRATE=0
NO_TEST=0
NO_BUILD=0

BACKEND_PID=""
FRONTEND_PID=""
SCANNER_PID=""

log()  { printf '==> %s\n' "$*"; }
warn() { printf '!!> %s\n' "$*" >&2; }
die()  { warn "$*"; exit 1; }

usage() {
  sed -n '2,18p' "$0" | tr -d '#'
  exit "${1:-0}"
}

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage 0 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-migrate) SKIP_MIGRATE=1 ;;
    --no-test) NO_TEST=1 ;;
    --no-build) NO_BUILD=1 ;;
  esac
done

# First non-flag arg = command
COMMAND=""
for arg in "$@"; do
  case "$arg" in
    -h|--help|--skip-install|--skip-migrate|--no-test|--no-build) ;;
    *)
      COMMAND="$arg"
      break
      ;;
  esac
done
COMMAND="${COMMAND:-all}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

cleanup() {
  local exit_code=$?
  if [[ -n "$SCANNER_PID" ]] && kill -0 "$SCANNER_PID" 2>/dev/null; then
    log "Stopping scanner (pid $SCANNER_PID)..."
    kill "$SCANNER_PID" 2>/dev/null || true
    wait "$SCANNER_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    log "Stopping backend (pid $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log "Stopping frontend (pid $FRONTEND_PID)..."
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
  exit "$exit_code"
}

install_deps() {
  if [[ "$SKIP_INSTALL" -eq 1 ]]; then
    log "Skipping npm install (--skip-install)"
    return
  fi

  require_cmd npm
  log "Installing backend dependencies..."
  (cd "$BACKEND" && npm install)

  log "Installing frontend dependencies..."
  (cd "$FRONTEND" && npm install)

  if [[ -d "$SCANNER" ]]; then
    log "Installing scanner dependencies..."
    (cd "$SCANNER" && npm install)
  fi

  log "Dependencies installed."
}

ensure_backend_dev_vars() {
  local vars_file="$BACKEND/.dev.vars"
  local default_secret="local-dev-scanner-secret-change-in-production"
  local scanner_port="${SCANNER_PORT:-8790}"

  if [[ ! -f "$vars_file" ]]; then
    log "Creating $vars_file for local wrangler dev..."
    cat >"$vars_file" <<EOF
JWT_SECRET=local-dev-jwt-secret-change-in-production
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:${FRONTEND_PORT}
FRONTEND_URLS=http://localhost:${FRONTEND_PORT}
SCANNER_SERVICE_URL=http://localhost:${scanner_port}
SCANNER_SECRET=${default_secret}
# Required for Google sign-in — set your OAuth Web client ID:
# GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
EOF
    warn "Add GOOGLE_CLIENT_ID to $vars_file for Google login to work locally."
    return
  fi

  local patched=0
  if ! grep -q '^SCANNER_SECRET=' "$vars_file" 2>/dev/null; then
    echo "SCANNER_SECRET=${default_secret}" >>"$vars_file"
    patched=1
  fi
  if ! grep -q '^SCANNER_SERVICE_URL=' "$vars_file" 2>/dev/null; then
    echo "SCANNER_SERVICE_URL=http://localhost:${scanner_port}" >>"$vars_file"
    patched=1
  fi
  if [[ "$patched" -eq 1 ]]; then
    warn "Added scanner vars to $vars_file — restart wrangler dev if it is already running."
  fi
}

ensure_frontend_env() {
  local env_file="$FRONTEND/.env"
  if [[ -f "$env_file" ]] && grep -q 'REACT_APP_API_URL' "$env_file" 2>/dev/null; then
    return
  fi

  log "Creating $env_file for local frontend..."
  {
    echo "REACT_APP_API_URL=${API_URL}"
    echo "# REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com"
  } >>"$env_file"
}

migrate_local_d1() {
  if [[ "$SKIP_MIGRATE" -eq 1 ]]; then
    log "Skipping local D1 migration (--skip-migrate)"
    return
  fi

  local schema="$BACKEND/database/d1-schema.sql"
  [[ -f "$schema" ]] || die "Missing D1 schema: $schema"

  log "Applying D1 schema to local database (wrangler --local)..."
  (
    cd "$BACKEND"
    npx --yes wrangler@3 d1 execute godashdevcore01 \
      --local \
      --env dev \
      --file=./database/d1-schema.sql \
      2>/dev/null || warn "D1 local migrate skipped or failed (wrangler may need login). Continuing..."
  )

  local admin_seed="$BACKEND/database/scripts/seed-local-admin.sql"
  if [[ -f "$admin_seed" ]]; then
    log "Seeding local admin user (Google Sign-In)..."
    (
      cd "$BACKEND"
      npx --yes wrangler@3 d1 execute godashdevcore01 \
        --local \
        --env dev \
        --file=./database/scripts/seed-local-admin.sql \
        2>/dev/null || warn "Local admin seed skipped or failed. Run manually if needed."
    )
  fi

  local resume_migrate="$BACKEND/database/migrations/resume_d1_content.sql"
  if [[ -f "$resume_migrate" ]]; then
    log "Applying resume D1 content migration..."
    (
      cd "$BACKEND"
      npx --yes wrangler@3 d1 execute godashdevcore01 \
        --local \
        --env dev \
        --file=./database/migrations/resume_d1_content.sql \
        2>/dev/null || warn "Resume migration skipped (columns may already exist)."
    )
  fi

  local scanner_migrate="$BACKEND/database/migrations/scanner_d1.sql"
  if [[ -f "$scanner_migrate" ]]; then
    log "Applying job scanner D1 migration..."
    (
      cd "$BACKEND"
      npx --yes wrangler@3 d1 execute godashdevcore01 \
        --local \
        --env dev \
        --file=./database/migrations/scanner_d1.sql \
        2>/dev/null || warn "Scanner migration skipped (tables may already exist)."
    )
    local scanner_cols="$BACKEND/database/migrations/scanner_d1_jobs_columns.sql"
    if [[ -f "$scanner_cols" ]]; then
      log "Applying job scanner column migration (one-time, OK if already applied)..."
      (
        cd "$BACKEND"
        npx --yes wrangler@3 d1 execute godashdevcore01 \
          --local \
          --env dev \
          --file=./database/migrations/scanner_d1_jobs_columns.sql \
          2>/dev/null || warn "Scanner jobs columns already exist — skipped."
      )
    fi
  fi

  local listing_migrate="$BACKEND/database/migrations/job_listing_type_d1.sql"
  if [[ -f "$listing_migrate" ]]; then
    log "Applying job listing type migration..."
    (
      cd "$BACKEND"
      npx --yes wrangler@3 d1 execute godashdevcore01 \
        --local \
        --env dev \
        --file=./database/migrations/job_listing_type_d1.sql \
        2>/dev/null || warn "Job listing migration skipped."
    )
    local listing_cols="$BACKEND/database/migrations/job_listing_type_columns.sql"
    if [[ -f "$listing_cols" ]]; then
      (
        cd "$BACKEND"
        npx --yes wrangler@3 d1 execute godashdevcore01 \
          --local \
          --env dev \
          --file=./database/migrations/job_listing_type_columns.sql \
          2>/dev/null || warn "Job listing_type column already exists — skipped."
      )
    fi
  fi
}

run_tests() {
  require_cmd npm
  log "Running backend tests..."
  (cd "$BACKEND" && npm test)

  log "Running frontend unit tests..."
  (cd "$FRONTEND" && npm test -- --watchAll=false)

  log "All unit tests passed."
}

run_build() {
  require_cmd npm
  log "Building frontend (production)..."
  (cd "$FRONTEND" && npm run build)

  log "Validating Cloudflare Worker bundle (dry-run)..."
  (
    cd "$BACKEND"
    npx --yes wrangler@3 deploy --dry-run --env dev
  )

  log "Build complete."
}

wait_for_backend() {
  local url="http://localhost:${BACKEND_PORT}/api/health"
  local i
  log "Waiting for backend at $url ..."
  for i in $(seq 1 60); do
    if curl -sf "$url" >/dev/null 2>&1; then
      log "Backend is up."
      return 0
    fi
    sleep 1
  done
  die "Backend did not become ready within 60s. Check wrangler output above."
}

ensure_scanner_env() {
  local env_file="$SCANNER/.env"
  local vars_file="$BACKEND/.dev.vars"
  local default_secret="local-dev-scanner-secret-change-in-production"
  local scanner_port="${SCANNER_PORT:-8790}"
  local api_url="${GOBUNNY_API_URL:-http://localhost:${BACKEND_PORT}/api}"

  local secret="$default_secret"
  if [[ -f "$vars_file" ]] && grep -q '^SCANNER_SECRET=' "$vars_file" 2>/dev/null; then
    secret="$(grep '^SCANNER_SECRET=' "$vars_file" | head -1 | cut -d= -f2-)"
  fi

  if [[ ! -f "$env_file" ]]; then
    log "Creating scanner/.env for local scanner service..."
    cat >"$env_file" <<EOF
SCANNER_PORT=${scanner_port}
SCANNER_SECRET=${secret}
GOBUNNY_API_URL=${api_url}
CONFIG_POLL_MS=60000
EOF
    return
  fi

  if ! grep -q '^SCANNER_SECRET=' "$env_file" 2>/dev/null; then
    echo "SCANNER_SECRET=${secret}" >>"$env_file"
    warn "Added SCANNER_SECRET to scanner/.env — restart the scanner process."
  fi
}

run_scanner() {
  if [[ ! -d "$SCANNER" ]]; then
    warn "Scanner directory not found — skipping scanner service."
    return
  fi
  ensure_scanner_env
  local scanner_port="${SCANNER_PORT:-8790}"
  log "Starting job scanner on port ${scanner_port}..."
  (
    cd "$SCANNER"
    SCANNER_PORT="$scanner_port" npm start
  ) &
  SCANNER_PID=$!
}

run_servers() {
  require_cmd npm
  require_cmd curl

  ensure_backend_dev_vars
  ensure_frontend_env
  ensure_scanner_env
  migrate_local_d1

  trap cleanup EXIT INT TERM

  run_scanner

  log "Starting Workers backend on port ${BACKEND_PORT}..."
  (
    cd "$BACKEND"
    npx --yes wrangler@3 dev --env dev --port "$BACKEND_PORT" --local
  ) &
  BACKEND_PID=$!

  wait_for_backend

  log "Starting React frontend on port ${FRONTEND_PORT}..."
  log "  Frontend: http://localhost:${FRONTEND_PORT}"
  log "  API:      ${API_URL}"
  log "  Scanner:  http://localhost:${SCANNER_PORT:-8790}"
  (
    cd "$FRONTEND"
    PORT="$FRONTEND_PORT" \
    REACT_APP_API_URL="$API_URL" \
    BROWSER=none \
    npm start
  ) &
  FRONTEND_PID=$!

  log "Press Ctrl+C to stop both servers."
  wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || wait "$FRONTEND_PID" 2>/dev/null || wait "$BACKEND_PID" 2>/dev/null || true
}

main() {
  require_cmd node
  require_cmd npm

  case "$COMMAND" in
    install)
      install_deps
      ;;
    test)
      install_deps
      run_tests
      ;;
    build)
      install_deps
      run_build
      ;;
    run)
      install_deps
      run_servers
      ;;
    all)
      install_deps
      if [[ "$NO_TEST" -eq 0 ]]; then
        run_tests
      else
        log "Skipping tests (--no-test)"
      fi
      if [[ "$NO_BUILD" -eq 0 ]]; then
        run_build
      else
        log "Skipping build (--no-build)"
      fi
      run_servers
      ;;
    *)
      die "Unknown command: $COMMAND (use: install | test | build | run | all)"
      ;;
  esac
}

main
