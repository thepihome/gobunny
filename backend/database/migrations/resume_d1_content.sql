-- Store parsed resume content in D1; reduce reliance on R2 for AI workflows.
ALTER TABLE resumes ADD COLUMN structured_content TEXT;
ALTER TABLE resumes ADD COLUMN ai_insights TEXT;
ALTER TABLE resumes ADD COLUMN source_type TEXT DEFAULT 'file' CHECK (source_type IN ('file', 'editor', 'import'));
