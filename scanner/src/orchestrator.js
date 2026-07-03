import { makeHttpCtx } from './providers/_http.js';
import { resolveProvider } from './providers/index.js';
import { applyFilters } from './filters.js';

const CONCURRENCY = 8;

async function parallelFetch(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

/**
 * Run a full portal scan against configured sources.
 * @param {object} options
 * @param {import('./client.js').createGobunnyClient extends Function ? ReturnType<import('./client.js').createGobunnyClient> : any} options.client
 * @param {string} [options.triggerType]
 * @param {function} [options.log]
 */
export async function runScan({ client, triggerType = 'manual', log = console.log }) {
  const config = await client.getConfig();
  const sources = config.sources || [];

  if (sources.length === 0) {
    throw new Error('No enabled scan sources configured');
  }

  const { run_id: runId } = await client.runStart(triggerType);
  log(`Scan run #${runId} started (${triggerType})`);

  const ctx = makeHttpCtx();
  let totalFound = 0;
  let filteredTitle = 0;
  let filteredLocation = 0;
  const errors = [];
  const allJobs = [];

  const targets = [];
  for (const source of sources) {
    const resolved = resolveProvider(source);
    if (!resolved) {
      errors.push({ company: source.name, error: 'no provider matched' });
      continue;
    }
    if (resolved.error) {
      errors.push({ company: source.name, error: resolved.error });
      continue;
    }
    targets.push({ ...source, _provider: resolved.provider });
  }

  const tasks = targets.map((entry) => async () => {
    const provider = entry._provider;
    try {
      const jobs = await provider.fetch(entry, ctx);
      if (!Array.isArray(jobs)) throw new Error(`${provider.id}: fetch() did not return an array`);
      totalFound += jobs.length;
      for (const job of jobs) {
        allJobs.push({
          ...job,
          source_provider: provider.id,
          source: `${provider.id}-api`,
        });
      }
      log(`  ✓ ${entry.name}: ${jobs.length} jobs (${provider.id})`);
    } catch (err) {
      errors.push({ company: entry.name, error: err.message });
      log(`  ✗ ${entry.name}: ${err.message}`);
    }
  });

  await parallelFetch(tasks, CONCURRENCY);

  const { jobs: filtered, filteredTitle: ft, filteredLocation: fl } = applyFilters(allJobs, {
    titleFilter: config.title_filter,
    locationFilter: config.location_filter,
  });
  filteredTitle = ft;
  filteredLocation = fl;

  const ingestResult = await client.ingest(filtered, config.default_job_status || 'active');

  const summary = {
    run_id: runId,
    companies_scanned: targets.length,
    total_found: totalFound,
    filtered_title: filteredTitle,
    filtered_location: filteredLocation,
    passed_filters: filtered.length,
    inserted: ingestResult.inserted,
    duplicates: ingestResult.duplicates,
    errors,
  };

  await client.runComplete({
    run_id: runId,
    status: errors.length === targets.length && targets.length > 0 ? 'failed' : 'completed',
    summary,
    error_message: errors.length ? errors.map((e) => `${e.company}: ${e.error}`).join('; ') : null,
  });

  log(`Scan #${runId} complete: ${ingestResult.inserted} new jobs, ${ingestResult.duplicates} existing`);
  return summary;
}
