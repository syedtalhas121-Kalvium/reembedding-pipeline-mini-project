import { rawEmbed, embeddingModel, db } from './infra.js';

/**
 * Embed text and record estimated workload for every successful helper call.
 * This is an estimate (including cache hits), not billed API usage.
 */
export async function embed(text) {
  const vector = await rawEmbed(text);
  const textLength = text.length;
  const tokenEstimate = Math.ceil(textLength / 4);
  const dollarCost = (tokenEstimate / 1_000_000) * 0.02;

  // Logging must not make an otherwise successful embedding/search fail.
  try {
    await db.query(
      `INSERT INTO embedding_costs
         (model_version, text_length, token_estimate, dollar_cost)
       VALUES ($1, $2, $3, $4)`,
      [embeddingModel, textLength, tokenEstimate, dollarCost]
    );
  } catch (error) {
    console.error('Embedding workload log failed:', error.message);
  }

  return vector;
}
