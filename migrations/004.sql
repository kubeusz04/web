ALTER TABLE media ADD COLUMN state TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE projects ADD COLUMN deleting INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(reset_at);
