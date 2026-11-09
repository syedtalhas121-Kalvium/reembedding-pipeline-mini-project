import 'dotenv/config';
import OpenAI from 'openai';
import pg from 'pg';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';

for (const key of ['DATABASE_URL', 'REDIS_URL', 'OPENAI_API_KEY']) {
  if (!process.env[key]) throw new Error('Missing ' + key);
}

export const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
export const llm = new OpenAI({ timeout: 30000, maxRetries: 1 });

redis.on('error', error => console.error('Redis error:', error.message));

/** Embed text, reading from Redis first and caching successful misses. */
export async function rawEmbed(text) {
  const key = 'emb:' + embeddingModel + ':' + createHash('sha256').update(text).digest('hex');
  let cached;
  try {
    cached = await redis.get(key);
  } catch {
    // Redis is an optimization; continue to the embedding provider on failure.
  }
  if (cached) return JSON.parse(cached);

  const response = await llm.embeddings.create({ model: embeddingModel, input: text });
  const vector = response.data[0].embedding;
  try {
    await redis.set(key, JSON.stringify(vector));
  } catch {
    // A cache write failure must not discard a successful embedding.
  }
  return vector;
}
