/**
 * Create a test market for the write-tool integration tests.
 *
 * Usage:
 *   MANIFOLD_API_KEY=<key> npx tsx scripts/create-test-market.ts
 *
 * Costs M$100 (minimum liquidityTier). The market is public and stays up
 * indefinitely. Print the returned market ID and set it as
 * MANIFOLD_TEST_MARKET_ID when running the write tests:
 *
 *   MANIFOLD_RUN_WRITE_TESTS=1 MANIFOLD_TEST_MARKET_ID=<id> npx vitest run
 */

import { manifoldPost } from "../src/api-client.js";

async function main() {
  const apiKey = process.env.MANIFOLD_API_KEY;
  if (!apiKey) {
    console.error("MANIFOLD_API_KEY not set");
    process.exit(1);
  }

  const result = await manifoldPost<{ id: string; url: string }>(
    "market",
    {
      question: "[API TEST] Manifold plugin integration test market",
      outcomeType: "BINARY",
      liquidityTier: 100,
      closeTime: Date.now() + 365 * 24 * 60 * 60 * 1000,
      visibility: "public",
    },
    apiKey,
  );

  console.log("Market created:");
  console.log("  ID:", result.id);
  console.log("  URL:", result.url);
  console.log();
  console.log("To run write tests:");
  console.log(
    `  MANIFOLD_RUN_WRITE_TESTS=1 MANIFOLD_TEST_MARKET_ID=${result.id} npx vitest run`,
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
