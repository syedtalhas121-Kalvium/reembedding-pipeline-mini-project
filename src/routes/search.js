import express from 'express';
import { db } from '../infra.js';
import { embed } from '../embed.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedLimit = Number(req.query.limit) || 10;
  const limit = Math.max(1, Math.min(requestedLimit, 50));

  if (!q) return res.status(400).json({ error: 'q is required' });

  const startedAt = performance.now();

  // Only select from these fixed identifiers; never interpolate user input.
  const searchCol = process.env.EMBEDDING_VERSION === 'v2'
    ? 'embedding_v2'
    : 'embedding';

  try {
    const queryVector = await embed(q);
    const { rows } = await db.query(
      `SELECT id, text, 1 - (${searchCol} <=> $1::vector) AS similarity
       FROM posts_embeddings
       WHERE ${searchCol} IS NOT NULL
       ORDER BY ${searchCol} <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(queryVector), limit]
    );

    res.json({
      results: rows,
      latencyMs: Math.round(performance.now() - startedAt)
    });
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
