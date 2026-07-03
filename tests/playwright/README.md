# Playwright — local-only E2E tests

Run against a **local** app URL configured in `.env`. Tests refuse non-localhost targets unless `PLAYWRIGHT_ALLOW_REMOTE=true`.

## Setup

```bash
# From repo root
npm run test:install

# Build frontend (Playwright serves frontend/build by default)
cd frontend && npm run build

# Copy and edit config
cp tests/playwright/.env.example tests/playwright/.env
```

If Playwright browser install fails on Apple Silicon, use system Chrome:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:smoke
```

Ensure the frontend is running (or let Playwright start it automatically):

```bash
cd frontend && npm start
# default: http://localhost:3000
```

Or point at an already-running local URL and skip the auto server:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=true PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:smoke
```

## Run tests

| Command | Suite |
|---------|-------|
| `npm run test:smoke` | Fast critical path checks |
| `npm run test:sanity` | Post-change validation |
| `npm run test:regression` | Full feature coverage |
| `npm run test:e2e` | All Playwright suites |
| `npm run test:unit` | Jest unit tests (frontend) |
| `npm run test:all` | Unit + all Playwright |

### Role-based testing

Set role in `tests/playwright/.env`:

```
PLAYWRIGHT_TEST_ROLE=admin      # admin | consultant | candidate
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` | React app URL |
| `PLAYWRIGHT_API_URL` | `http://localhost:5023/api` | API base for mocks |
| `PLAYWRIGHT_TEST_ROLE` | `admin` | Authenticated user role |
| `PLAYWRIGHT_ALLOW_REMOTE` | `false` | Must be `true` for non-local URLs |

## How auth works

Playwright seeds `localStorage` with a test user and mocks `/api/**` responses locally — no Google OAuth required.

## Reports

```bash
cd tests/playwright && npm run report
```
