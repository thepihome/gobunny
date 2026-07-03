import greenhouse from './greenhouse.js';
import ashby from './ashby.js';
import lever from './lever.js';
import workday from './workday.js';

const PROVIDERS = [greenhouse, ashby, lever, workday];

const byId = new Map(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id) {
  return byId.get(id) || null;
}

export function resolveProvider(entry) {
  if (entry.provider) {
    const p = getProvider(entry.provider);
    if (!p) return { error: `unknown provider: ${entry.provider}` };
    return { provider: p };
  }
  for (const p of PROVIDERS) {
    const hit = p.detect?.(entry);
    if (hit) return { provider: p };
  }
  return null;
}

export { PROVIDERS };
