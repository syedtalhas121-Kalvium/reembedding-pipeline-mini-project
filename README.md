# ThreadNest: Re-Embedding Pipeline and Cost Logger

This project upgrades semantic search from the legacy `text-embedding-ada-002` vectors to `text-embedding-3-small` without removing the old search path. It adds a second vector column, resumable backfill checkpoints, a version-based search switch, and an estimated-workload log.

## Implementation

- **Resumable backfill:** processes at most 50 rows at a time, selects only rows whose `embedding_v2` is NULL, and resumes after the last saved `id` in `job_progress`.
- **Crash safety:** each vector is saved before the batch checkpoint. If a process stops mid-batch, already-written vectors are skipped on restart.
- **Throttling:** waits 200 ms between batches.
- **Search cutover:** `EMBEDDING_VERSION=v1` (default) searches `embedding`; `EMBEDDING_VERSION=v2` searches `embedding_v2`. The model and column must always be paired.
- **Workload logging:** after each successful embed helper call, logs model, character count, estimated tokens, and an illustrative dollar estimate. Logging failure is non-fatal.

## Prerequisites

- Node.js 20+
- PostgreSQL with pgvector and a populated `posts_embeddings` table containing legacy vectors in `embedding`
- Redis
- An OpenAI API key with embedding access

## Setup

```bash
cp .env.example .env
npm install
node verify.js
psql "$DATABASE_URL" -f src/migrate.sql
npm test
```

Set real credentials in the local `.env`; never commit that file. The migration adds `embedding_v2 vector(1536)`, `job_progress`, and `embedding_costs`. It deliberately retains the original `embedding` column.

## Backfill and resume

Run with the new model:

```bash
EMBEDDING_MODEL=text-embedding-3-small npm run backfill
```

Stop it with Ctrl+C after at least one batch, then run the same command again. It resumes from the saved checkpoint and skips rows that already have a new vector.

PowerShell:

```powershell
$env:EMBEDDING_MODEL="text-embedding-3-small"
npm run backfill
```

Useful evidence queries (capture results before stopping, after stopping, and after resuming):

```sql
SELECT job_name, last_id, updated_at FROM job_progress
WHERE job_name = 're-embed-v2';

SELECT
  count(*) AS total_rows,
  count(embedding) AS legacy_vectors,
  count(embedding_v2) AS new_vectors,
  count(*) FILTER (WHERE embedding_v2 IS NULL) AS remaining
FROM posts_embeddings;
```

## Validate both search paths

Start the server with matching model and column settings. Run the five-question script in a second terminal for each configuration.

Legacy path:

```bash
EMBEDDING_VERSION=v1 EMBEDDING_MODEL=text-embedding-ada-002 npm start
EMBEDDING_VERSION=v1 npm run questions
```

New path (restart the server before switching):

```bash
EMBEDDING_VERSION=v2 EMBEDDING_MODEL=text-embedding-3-small npm start
EMBEDDING_VERSION=v2 npm run questions
```

On PowerShell, set the environment variables with `$env:NAME="value"` before each command.

Record the five top results and latency values for both runs here:

| Question | v1 top result | v1 latency | v2 top result | v2 latency |
|---|---|---:|---|---:|
| how do I cache API responses? | _Run locally_ | — | _Run locally_ | — |
| why is my postgres query slow? | _Run locally_ | — | _Run locally_ | — |
| best way to handle rate limits | _Run locally_ | — | _Run locally_ | — |
| what is connection pooling? | _Run locally_ | — | _Run locally_ | — |
| how to set a TTL in Redis | _Run locally_ | — | _Run locally_ | — |

## Estimated workload log

Inspect the recorded estimates:

```sql
SELECT model_version, count(*) AS helper_calls,
       sum(text_length) AS characters,
       sum(token_estimate) AS estimated_tokens,
       sum(dollar_cost) AS estimated_workload_value
FROM embedding_costs
GROUP BY model_version
ORDER BY model_version;
```

The estimate is `ceil(text.length / 4)` tokens and `$0.02 per million estimated tokens`. It is **not billed API spend**: the helper does not expose cache-hit metadata, so every successful helper call is logged, including cache hits. Character count is only a rough token proxy; exact token counts require the model tokenizer. Logging failures are intentionally non-fatal and can leave missing rows.

## Tests and runtime evidence

Run `npm test` to execute the offline unit checks. These tests cover the feature-flag choice, estimate arithmetic, and checkpoint-resume arithmetic; they do not connect to PostgreSQL, Redis, or OpenAI. Live checkpoint counts, the five paired search outputs, and the workload total must be captured against your own populated database and credentials using the commands above. No runtime measurements are fabricated in this README.
