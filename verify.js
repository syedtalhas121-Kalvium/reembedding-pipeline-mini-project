import 'dotenv/config';
import pg from 'pg';

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows } = await db.query('SELECT count(*)::bigint AS count FROM posts_embeddings');
  console.log('posts_embeddings rows:', rows[0].count);
} finally {
  await db.end();
}
