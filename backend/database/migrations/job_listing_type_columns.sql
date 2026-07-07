-- Job listing visibility column (one-time; skip if duplicate column error)
ALTER TABLE jobs ADD COLUMN listing_type TEXT DEFAULT 'internal'
  CHECK (listing_type IN ('internal', 'web', 'external'));

CREATE INDEX IF NOT EXISTS idx_jobs_listing_type ON jobs(listing_type);
