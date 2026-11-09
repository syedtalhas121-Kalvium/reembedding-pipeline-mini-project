import express from 'express';
import searchRouter from './routes/search.js';
import { db, redis } from './infra.js';

const app = express();
app.use('/search', searchRouter);

const server = app.listen(Number(process.env.PORT || 3000));

async function stop() {
  server.close(async () => {
    await db.end();
    await redis.quit();
  });
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
