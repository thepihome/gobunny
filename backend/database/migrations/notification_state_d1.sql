-- Per-user notification seen/cleared state for the navbar bell
CREATE TABLE IF NOT EXISTS user_notification_state (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS notification_dismissals (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  dismissed_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_dismissals_user ON notification_dismissals(user_id);
