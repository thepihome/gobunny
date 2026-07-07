-- Optional backfill after scanner columns exist (requires jobs.source_url)
UPDATE jobs SET listing_type = 'external'
WHERE source_url IS NOT NULL AND (listing_type IS NULL OR listing_type = 'internal');
