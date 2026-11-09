import { db } from './infra.js';
import { embed } from './embed.js';

const BATCH = 50;
const JOB = 're-embed-v2';
const PAUSE_MS = 200;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runBackfill() {
  try {
    const checkpoint = await db.query(
      'SELECT last_id FROM job_progress WHERE job_name = $1',
      [JOB]
    );
    let lastId = checkpoint.rows.length ? Number(checkpoint.rows[0].last_id) : 0;

    console.log('Starting from id:', lastId);

    while (true) {
      const { rows } = await db.query(
        `SELECT id, text
         FROM posts_embeddings
         WHERE id > $1 AND embedding_v2 IS NULL
         ORDER BY id ASC
         LIMIT $2`,
        [lastId, BATCH]
      );

      if (rows.length === 0) {
        console.log('Backfill complete.');
        break;
      }

      for (const row of rows) {
        const vector = await embed(row.text);
        await db.query(
          'UPDATE posts_embeddings SET embedding_v2 = $1::vector WHERE id = $2',
          [JSON.stringify(vector), row.id]
        );
        lastId = Number(row.id);
      }

      await db.query(
        `INSERT INTO job_progress (job_name, last_id, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (job_name)
         DO UPDATE SET last_id = EXCLUDED.last_id, updated_at = now()`,
        [JOB, lastId]
      );

      console.log('Batch done. Last id:', lastId);
      await sleep(PAUSE_MS);
    }
  } finally {
    await db.end();
  }
}

runBackfill().catch(error => {
  console.error('Backfill failed:', error);
  process.exitCode = 1;
});
