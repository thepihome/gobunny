#!/usr/bin/env node
/**
 * Independent scanner HTTP service.
 * - POST /run — trigger scan (async)
 * - GET /health — liveness
 * - GET /status — current run state + last summary
 */
import 'dotenv/config';
import http from 'http';
import cron from 'node-cron';
import { createGobunnyClient } from './client.js';
import { runScan } from './orchestrator.js';

const PORT = parseInt(process.env.SCANNER_PORT || '8790', 10);
const apiUrl = process.env.GOBUNNY_API_URL || 'http://localhost:8787/api';
const secret = process.env.SCANNER_SECRET;
const configPollMs = parseInt(process.env.CONFIG_POLL_MS || '60000', 10);

if (!secret) {
  console.error('SCANNER_SECRET is required. Copy scanner/.env.example to scanner/.env');
  process.exit(1);
}

const client = createGobunnyClient({ apiUrl, secret });

let isRunning = false;
let lastSummary = null;
let lastError = null;
let lastCompletedAt = null;
let scheduleEnabled = false;
let scheduleCron = '0 6 * * *';
let cronTask = null;

function secretOk(req) {
  return req.headers['x-scanner-secret'] === secret;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function triggerRun(triggerType = 'manual') {
  if (isRunning) {
    return { ok: false, status: 409, body: { error: 'Scan already in progress' } };
  }
  isRunning = true;
  lastError = null;

  runScan({ client, triggerType, log: console.log })
    .then((summary) => {
      lastSummary = summary;
      lastCompletedAt = new Date().toISOString();
    })
    .catch((err) => {
      lastError = err.message;
      console.error('Scan error:', err);
    })
    .finally(() => {
      isRunning = false;
    });

  return {
    ok: true,
    status: 202,
    body: { status: 'started', message: 'Scan started in background' },
  };
}

function applySchedule() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
  if (!scheduleEnabled) return;
  if (!cron.validate(scheduleCron)) {
    console.warn(`Invalid cron expression: ${scheduleCron}`);
    return;
  }
  cronTask = cron.schedule(scheduleCron, () => {
    if (isRunning) {
      console.log('Scheduled scan skipped — already running');
      return;
    }
    console.log(`Scheduled scan triggered (${scheduleCron})`);
    triggerRun('scheduled');
  });
  console.log(`Schedule active: ${scheduleCron}`);
}

async function refreshConfig() {
  try {
    const config = await client.getConfig();
    const nextEnabled = Boolean(config.schedule_enabled);
    const nextCron = config.schedule_cron || '0 6 * * *';
    if (nextEnabled !== scheduleEnabled || nextCron !== scheduleCron) {
      scheduleEnabled = nextEnabled;
      scheduleCron = nextCron;
      applySchedule();
    }
  } catch (err) {
    let hint = '';
    if (err.status === 401) {
      hint =
        ' — set matching SCANNER_SECRET in backend/.dev.vars and scanner/.env, then restart wrangler dev + scanner';
    } else if (err.message === 'fetch failed' || err.cause?.code === 'ECONNREFUSED') {
      hint = ' — is wrangler dev running on GOBUNNY_API_URL?';
    }
    console.warn(`Config poll failed: ${err.message}${hint}`);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === '/health' && req.method === 'GET') {
    return send(200, {
      status: 'ok',
      running: isRunning,
      schedule_enabled: scheduleEnabled,
      schedule_cron: scheduleCron,
    });
  }

  if (url.pathname === '/status' && req.method === 'GET') {
    return send(200, {
      running: isRunning,
      last_completed_at: lastCompletedAt,
      last_summary: lastSummary,
      last_error: lastError,
      schedule_enabled: scheduleEnabled,
      schedule_cron: scheduleCron,
    });
  }

  if (url.pathname === '/run' && req.method === 'POST') {
    if (!secretOk(req)) return send(401, { error: 'Unauthorized' });
    try {
      const body = await readBody(req);
      const triggerType = body.trigger_type || 'manual';
      const result = await triggerRun(triggerType);
      return send(result.status, result.body);
    } catch (e) {
      return send(400, { error: e.message });
    }
  }

  return send(404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`GoBunnyy scanner listening on http://localhost:${PORT}`);
  console.log(`API: ${apiUrl}`);
  refreshConfig();
  setInterval(refreshConfig, configPollMs);
});
