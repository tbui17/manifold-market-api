import { Type } from "typebox";
import { makeGetTool, type ToolFactory } from "../tool-builder.js";

export function createMarketTools(tool: ToolFactory) {
  return [
    // 1. Search markets
    tool(
      makeGetTool(
        "manifold_search_markets",
        "Search and filter prediction markets by free-text term, market type, creator, and sort order. Returns a ranked list of matching markets.",
        Type.Object({
          term: Type.String({ description: "Free-text search query" }),
          contractType: Type.Optional(
            Type.Union([
              Type.Literal("BINARY"),
              Type.Literal("MULTIPLE_CHOICE"),
              Type.Literal("FREE_RESPONSE"),
              Type.Literal("POLL"),
              Type.Literal("NUMERIC"),
              Type.Literal("PSEUDO_NUMERIC"),
              Type.Literal("BOUNTIED_QUESTION"),
            ]),
          ),
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
          offset: Type.Optional(Type.Number({ minimum: 0 })),
          creatorId: Type.Optional(Type.String()),
          sort: Type.Optional(
            Type.Union([
              Type.Literal("liquidity"),
              Type.Literal("volume"),
              Type.Literal("newest"),
              Type.Literal("oldest"),
            ]),
          ),
          filterClosed: Type.Optional(Type.Boolean()),
          filterResolved: Type.Optional(Type.Boolean()),
        }),
        "search-markets",
        (p) => ({
          term: p.term,
          contractType: p.contractType,
          limit: p.limit,
          offset: p.offset,
          creatorId: p.creatorId,
          sort: p.sort,
          filterClosed: p.filterClosed,
          filterResolved: p.filterResolved,
        }),
      ),
    ),

    // 2. Get market by ID
    tool(
      makeGetTool(
        "manifold_get_market",
        "Get full market details including answers, description, resolution info, and all metadata.",
        Type.Object({
          marketId: Type.String({ description: "The market's unique ID" }),
        }),
        (p) => `market/${p.marketId}`,
      ),
    ),

    // 3. Get market by slug
    tool(
      makeGetTool(
        "manifold_get_market_by_slug",
        "Get full market details by URL slug. Returns the full market object.",
        Type.Object({
          marketSlug: Type.String({
            description: "The market's URL slug (e.g., 'will-ai-pass-turing-test')",
          }),
        }),
        (p) => `slug/${p.marketSlug}`,
      ),
    ),

    // 4. List markets
    tool(
      makeGetTool(
        "manifold_list_markets",
        "List markets with cursor-based pagination. Maximum 1000 results per page. Pass the `before` cursor from a previous response to get the next page.",
        Type.Object({
          before: Type.Optional(Type.String()),
        }),
        "markets",
        (p) => ({ before: p.before }),
      ),
    ),

    // 5. Get market probability
    tool(
      makeGetTool(
        "manifold_get_market_prob",
        "Get the current probability for a market. Returns a lightweight response (1-second cache on the upstream).",
        Type.Object({
          marketId: Type.String({ description: "The market's unique ID" }),
        }),
        (p) => `market/${p.marketId}/prob`,
      ),
    ),

    // 6. Get market probabilities (batch)
    tool(
      makeGetTool(
        "manifold_get_market_probs",
        "Batch-fetch current probabilities for multiple markets in a single request. Accepts up to 100 market IDs — requests exceeding this limit will be rejected by the upstream API.",
        Type.Object({
          ids: Type.Array(Type.String(), {
            minItems: 1,
            maxItems: 100,
            description: "Array of market IDs to query (max 100)",
          }),
        }),
        (p) => `market-probs?${p.ids.map((id) => `ids[]=${encodeURIComponent(id)}`).join("&")}`,
      ),
    ),

    // 7. Get market positions
    tool(
      makeGetTool(
        "manifold_get_market_positions",
        "Get the positions/leaderboard for a market — shows which users hold shares and their P&L.",
        Type.Object({
          marketId: Type.String({ description: "The market's unique ID" }),
          top: Type.Optional(Type.Number({ minimum: 1 })),
          bottom: Type.Optional(Type.Number({ minimum: 1 })),
        }),
        (p) => `market/${p.marketId}/positions`,
        (p) => ({
          top: p.top,
          bottom: p.bottom,
        }),
      ),
    ),
  ];
}
