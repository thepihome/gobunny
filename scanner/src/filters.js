function normalizeKeywordList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .filter((k) => typeof k === 'string')
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean);
}

export function buildTitleFilter(titleFilter) {
  const positive = normalizeKeywordList(titleFilter?.positive);
  const negative = normalizeKeywordList(titleFilter?.negative);

  return (title) => {
    const lower = (title || '').toLowerCase();
    const hasPositive = positive.length === 0 || positive.some((k) => lower.includes(k));
    const hasNegative = negative.some((k) => lower.includes(k));
    return hasPositive && !hasNegative;
  };
}

export function buildLocationFilter(locationFilter) {
  if (!locationFilter) return () => true;
  const alwaysAllow = normalizeKeywordList(locationFilter.always_allow);
  const allow = normalizeKeywordList(locationFilter.allow);
  const block = normalizeKeywordList(locationFilter.block);

  return (location) => {
    if (typeof location !== 'string' || location.trim() === '') return true;
    const lower = location.toLowerCase();
    if (alwaysAllow.length > 0 && alwaysAllow.some((k) => lower.includes(k))) return true;
    if (block.length > 0 && block.some((k) => lower.includes(k))) return false;
    if (allow.length === 0) return true;
    return allow.some((k) => lower.includes(k));
  };
}

export function applyFilters(jobs, { titleFilter, locationFilter }) {
  const titleFn = buildTitleFilter(titleFilter);
  const locationFn = buildLocationFilter(locationFilter);
  let filteredTitle = 0;
  let filteredLocation = 0;
  const passed = [];

  for (const job of jobs) {
    if (!titleFn(job.title)) {
      filteredTitle++;
      continue;
    }
    if (!locationFn(job.location)) {
      filteredLocation++;
      continue;
    }
    passed.push(job);
  }

  return { jobs: passed, filteredTitle, filteredLocation };
}
