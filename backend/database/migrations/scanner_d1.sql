-- Job portal scanner tables and jobs columns (D1 / SQLite)

CREATE TABLE IF NOT EXISTS scan_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  careers_url TEXT NOT NULL,
  provider TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scan_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  trigger_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual', 'scheduled', 'cli')),
  started_at TEXT,
  completed_at TEXT,
  summary TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_sources_enabled ON scan_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_scan_runs_created ON scan_runs(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_url ON jobs(source_url) WHERE source_url IS NOT NULL;

-- Seed example sources (disabled by default — enable in Settings)
INSERT OR IGNORE INTO scan_sources (id, name, careers_url, provider, enabled) VALUES
  (1, 'Stripe', 'https://job-boards.greenhouse.io/stripe', 'greenhouse', 0),
  (2, 'Anthropic', 'https://job-boards.greenhouse.io/anthropic', 'greenhouse', 0),
  (3, 'Linear', 'https://jobs.ashbyhq.com/linear', 'ashby', 0);
