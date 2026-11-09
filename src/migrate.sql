-- Run once before starting the backfill. Keep the original embedding column.
ALTER TABLE posts_embeddings
  ADD COLUMN IF NOT EXISTS embedding_v2 vector(1536);

CREATE TABLE IF NOT EXISTS job_progress (
  job_name TEXT PRIMARY KEY,
  last_id INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS embedding_costs (
  id BIGSERIAL PRIMARY KEY,
  model_version TEXT NOT NULL,
  text_length INT NOT NULL,
  token_estimate INT NOT NULL,
  dollar_cost DECIMAL(12,8) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
