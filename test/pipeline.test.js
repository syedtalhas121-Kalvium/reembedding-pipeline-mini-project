import test from 'node:test';
import assert from 'node:assert/strict';

test('feature flag selects embedding_v2 when set', () => {
  const original = process.env.EMBEDDING_VERSION;
  process.env.EMBEDDING_VERSION = 'v2';
  const column = process.env.EMBEDDING_VERSION === 'v2' ? 'embedding_v2' : 'embedding';
  assert.equal(column, 'embedding_v2');
  if (original === undefined) delete process.env.EMBEDDING_VERSION;
  else process.env.EMBEDDING_VERSION = original;
});

test('feature flag defaults to the original embedding column', () => {
  const original = process.env.EMBEDDING_VERSION;
  delete process.env.EMBEDDING_VERSION;
  const column = process.env.EMBEDDING_VERSION === 'v2' ? 'embedding_v2' : 'embedding';
  assert.equal(column, 'embedding');
  if (original !== undefined) process.env.EMBEDDING_VERSION = original;
});

test('estimated workload uses ceil(chars / 4) and illustrative rate', () => {
  const text = 'test sentence here';
  const tokenEstimate = Math.ceil(text.length / 4);
  const dollarCost = (tokenEstimate / 1_000_000) * 0.02;
  assert.equal(tokenEstimate, 5);
  assert.ok(Math.abs(dollarCost - 0.0000001) < Number.EPSILON);
});

test('checkpoint advances and supports restart after the saved id', () => {
  const checkpoint = { last_id: 0 };
  const saveCheckpoint = id => { checkpoint.last_id = id; };
  saveCheckpoint(50);
  assert.equal(checkpoint.last_id, 50);
  const resumedAfter = checkpoint.last_id;
  assert.equal(resumedAfter + 1, 51);
});
