/**
 * Scanner configuration stored in app_settings.
 */

import { getAppSetting, setAppSetting } from './appSettingsDb.js';

const SCANNER_CONFIG_KEY = 'scanner_config';

export const DEFAULT_SCANNER_CONFIG = {
  schedule_enabled: false,
  schedule_cron: '0 6 * * *',
  default_job_status: 'active',
  title_filter: {
    positive: [],
    negative: ['Intern', 'Junior'],
  },
  location_filter: null,
};

export async function getScannerConfig(env) {
  const raw = await getAppSetting(env, SCANNER_CONFIG_KEY);
  if (!raw) return { ...DEFAULT_SCANNER_CONFIG };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SCANNER_CONFIG,
      ...parsed,
      title_filter: {
        ...DEFAULT_SCANNER_CONFIG.title_filter,
        ...(parsed.title_filter || {}),
      },
    };
  } catch {
    return { ...DEFAULT_SCANNER_CONFIG };
  }
}

export async function saveScannerConfig(env, partial) {
  const current = await getScannerConfig(env);
  const next = {
    ...current,
    ...partial,
    title_filter: partial.title_filter
      ? { ...current.title_filter, ...partial.title_filter }
      : current.title_filter,
  };
  await setAppSetting(env, SCANNER_CONFIG_KEY, JSON.stringify(next));
  return next;
}

export function toPublicScannerConfig(config) {
  return {
    schedule_enabled: Boolean(config.schedule_enabled),
    schedule_cron: config.schedule_cron || DEFAULT_SCANNER_CONFIG.schedule_cron,
    default_job_status: config.default_job_status || 'active',
    title_filter: config.title_filter || DEFAULT_SCANNER_CONFIG.title_filter,
    location_filter: config.location_filter || null,
  };
}
