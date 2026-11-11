-- PostgreSQL / Supabase only. Server DB role must own tables or have BYPASSRLS.
-- No browser data API access; all authorisation is enforced by the monolith.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON users,sessions,projects,media,orders,webhook_events,email_jobs,viewer_sessions,catalog,audit,rate_limits FROM anon,authenticated;
-- Private bucket; no client storage policies are granted. Server service-role only.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('gift-media','gift-media',false,26214400,ARRAY['image/jpeg','image/png','image/webp','video/mp4','audio/mpeg','audio/wav'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=26214400;
