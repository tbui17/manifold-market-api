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
          term: Type.Optional(Type.String({ description: "Free-text search query" })),
          contractType: Type.Optional(
            Type.Union([
              Type.Literal("ALL"),
              Type.Literal("BINARY"),
              Type.Literal("MULTIPLE_CHOICE"),
              Type.Literal("DEPENDENT_MULTIPLE_CHOICE"),
              Type.Literal("INDEPENDENT_MULTIPLE_CHOICE"),
              Type.Literal("FREE_RESPONSE"),
              Type.Literal("PSEUDO_NUMERIC"),
              Type.Literal("BOUNTIED_QUESTION"),
              Type.Literal("STONK"),
              Type.Literal("POLL"),
              Type.Literal("NUMBER"),
              Type.Literal("MULTI_NUMERIC"),
              Type.Literal("DATE"),
            ]),
          ),
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
          offset: Type.Optional(Type.Number({ minimum: 0 })),
          creatorId: Type.Optional(Type.String()),
          sort: Type.Optional(
            Type.Union([
              Type.Literal("newest"),
              Type.Literal("score"),
              Type.Literal("daily-score"),
              Type.Literal("freshness-score"),
              Type.Literal("24-hour-vol"),
              Type.Literal("most-popular"),
              Type.Literal("liquidity"),
              Type.Literal("subsidy"),
              Type.Literal("last-updated"),
              Type.Literal("close-date"),
              Type.Literal("start-time"),
              Type.Literal("resolve-date"),
              Type.Literal("random"),
              Type.Literal("bounty-amount"),
              Type.Literal("prob-descending"),
              Type.Literal("prob-ascending"),
              Type.Literal("prob-50"),
            ]),
          ),
          filter: Type.Optional(
            Type.Union([
              Type.Literal("open"),
              Type.Literal("closing-90-days"),
              Type.Literal("closing-week"),
              Type.Literal("closing-month"),
              Type.Literal("closing-day"),
              Type.Literal("closed"),
              Type.Literal("resolved"),
              Type.Literal("all"),
              Type.Literal("news"),
              Type.Literal("uncertain"),
            ]),
          ),
          beforeTime: Type.Optional(Type.Number()),
          topicSlug: Type.Optional(Type.String()),
          forYou: Type.Optional(Type.Boolean()),
          isPrizeMarket: Type.Optional(Type.Boolean()),
          token: Type.Optional(Type.String()),
          gids: Type.Optional(Type.Array(Type.String())),
          liquidity: Type.Optional(Type.Number()),
          hasBets: Type.Optional(Type.Boolean()),
          includeLiteAnswers: Type.Optional(Type.Boolean()),
        }),
        "search-markets",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.term !== undefined) q.term = p.term;
          if (p.contractType !== undefined) q.contractType = p.contractType;
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.offset !== undefined) q.offset = p.offset;
          if (p.creatorId !== undefined) q.creatorId = p.creatorId;
          if (p.sort !== undefined) q.sort = p.sort;
          if (p.filter !== undefined) q.filter = p.filter;
          if (p.beforeTime !== undefined) q.beforeTime = p.beforeTime;
          if (p.topicSlug !== undefined) q.topicSlug = p.topicSlug;
          if (p.forYou !== undefined) q.forYou = p.forYou;
          if (p.isPrizeMarket !== undefined) q.isPrizeMarket = p.isPrizeMarket;
          if (p.token !== undefined) q.token = p.token;
          if (p.gids !== undefined) q.gids = p.gids;
          if (p.liquidity !== undefined) q.liquidity = p.liquidity;
          if (p.hasBets !== undefined) q.hasBets = p.hasBets;
          if (p.includeLiteAnswers !== undefined) q.includeLiteAnswers = p.includeLiteAnswers;
          return q;
        },
      ),
    ),

    // 2. Get market by ID
    tool(
      makeGetTool(
        "manifold_get_market",
        "Get full market details including answers, description, resolution info, and all metadata.",
        Type.Object({
          marketId: Type.String({ description: "The market's unique ID" }),
          lite: Type.Optional(Type.Boolean({ description: "If true, return a lighter market object without answers/description" })),
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
          lite: Type.Optional(Type.Boolean({ description: "If true, return a lighter market object without answers/description" })),
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
          limit: Type.Optional(Type.Number({ minimum: 0, maximum: 1000, description: "Max results per page (default 500, max 1000)" })),
          sort: Type.Optional(
            Type.Union([
              Type.Literal("created-time"),
              Type.Literal("updated-time"),
              Type.Literal("last-bet-time"),
              Type.Literal("last-comment-time"),
            ]),
          ),
          order: Type.Optional(
            Type.Union([
              Type.Literal("asc"),
              Type.Literal("desc"),
            ]),
          ),
          userId: Type.Optional(Type.String()),
          groupId: Type.Optional(Type.String()),
        }),
        "markets",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.before !== undefined) q.before = p.before;
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.sort !== undefined) q.sort = p.sort;
          if (p.order !== undefined) q.order = p.order;
          if (p.userId !== undefined) q.userId = p.userId;
          if (p.groupId !== undefined) q.groupId = p.groupId;
          return q;
        },
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
          userId: Type.Optional(Type.String()),
          answerId: Type.Optional(Type.String()),
          summaryOnly: Type.Optional(Type.Boolean()),
          order: Type.Optional(
            Type.Union([
              Type.Literal("shares"),
              Type.Literal("profit"),
            ]),
          ),
        }),
        (p) => `market/${p.marketId}/positions`,
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.top !== undefined) q.top = p.top;
          if (p.bottom !== undefined) q.bottom = p.bottom;
          if (p.userId !== undefined) q.userId = p.userId;
          if (p.answerId !== undefined) q.answerId = p.answerId;
          if (p.summaryOnly !== undefined) q.summaryOnly = p.summaryOnly;
          if (p.order !== undefined) q.order = p.order;
          return q;
        },
      ),
    ),
  ];
}
