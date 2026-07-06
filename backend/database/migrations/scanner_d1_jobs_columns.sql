-- One-time: add jobs columns for portal scanner dedup.
-- Safe to skip if columns already exist (duplicate column error is OK).
-- Fresh installs get these from database/d1-schema.sql instead.

ALTER TABLE jobs ADD COLUMN source_url TEXT;
ALTER TABLE jobs ADD COLUMN source_provider TEXT;
