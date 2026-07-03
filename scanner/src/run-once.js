#!/usr/bin/env node
/**
 * One-shot CLI scan (no HTTP server).
 */
import 'dotenv/config';
import { createGobunnyClient } from './client.js';
import { runScan } from './orchestrator.js';

const apiUrl = process.env.GOBUNNY_API_URL || 'http://localhost:8787/api';
const secret = process.env.SCANNER_SECRET;

if (!secret) {
  console.error('SCANNER_SECRET is required');
  process.exit(1);
}

const client = createGobunnyClient({ apiUrl, secret });

runScan({ client, triggerType: 'cli' })
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.errors?.length && summary.inserted === 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Scan failed:', err.message);
    process.exit(1);
  });
