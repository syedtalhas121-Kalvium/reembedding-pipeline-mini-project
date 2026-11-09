import 'dotenv/config';

const PORT = process.env.PORT || 3000;
const QUESTIONS = [
  'how do I cache API responses?',
  'why is my postgres query slow?',
  'best way to handle rate limits',
  'what is connection pooling?',
  'how to set a TTL in Redis'
];

for (const question of QUESTIONS) {
  const url = `http://localhost:${PORT}/search?q=${encodeURIComponent(question)}&limit=3`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Search failed:', response.status, await response.text());
    continue;
  }
  const body = await response.json();
  const column = process.env.EMBEDDING_VERSION === 'v2' ? 'embedding_v2' : 'embedding';
  console.log('[' + column + '] Q:', question);
  console.log('  Top result:', body.results[0]?.text?.slice(0, 100) || 'none');
  console.log('  Latency:', body.latencyMs + 'ms');
}
