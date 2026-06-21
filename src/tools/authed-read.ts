/**
 * Authenticated personal-data tool definitions.
 *
 * These endpoints require a valid Manifold API key. Per FR-006/Q3 the plugin
 * does NOT pre-check for a key — it sends the request with whatever key is
 * configured (none if absent). The upstream API returns a 401 which surfaces
 * as an `auth`-category error (FR-021).
 */

import { Type } from "typebox";
import { makeGetTool, type ToolFactory } from "../tool-builder.js";

export function createAuthedReadTools(tool: ToolFactory) {
  return [
    // ------------------------------------------------------------------
    // 1. manifold_get_me  —  GET /v0/me
    // ------------------------------------------------------------------
    tool(
      makeGetTool(
        "manifold_get_me",
        "Get the authenticated user's own profile — identity confirmation, account details, and balance.",
        Type.Object({}),
        "me",
      ),
    ),

    // ------------------------------------------------------------------
    // 2. manifold_get_portfolio  —  GET /v0/get-user-portfolio
    // ------------------------------------------------------------------
    tool(
      makeGetTool(
        "manifold_get_portfolio",
        "Get live portfolio metrics for the authenticated user — current account value, profit/loss, and per-market position summary.",
        Type.Object({
          userId: Type.String({ description: "The ID of the user to get portfolio for" }),
        }),
        "get-user-portfolio",
        (p) => ({ userId: p.userId }),
      ),
    ),

    // ------------------------------------------------------------------
    // 3. manifold_get_portfolio_history  —  GET /v0/get-user-portfolio-history
    // ------------------------------------------------------------------
    tool(
      makeGetTool(
        "manifold_get_portfolio_history",
        "Get historical portfolio value over time for the authenticated user — account value series for charting/analysis.",
        Type.Object({
          userId: Type.String({ description: "The ID of the user to get portfolio history for" }),
          period: Type.Optional(
            Type.Union([
              Type.Literal("1hour"),
              Type.Literal("6hour"),
              Type.Literal("daily"),
              Type.Literal("weekly"),
              Type.Literal("monthly"),
              Type.Literal("allTime"),
            ]),
          ),
        }),
        "get-user-portfolio-history",
        (p) => ({
          userId: p.userId,
          period: p.period,
        }),
      ),
    ),

    // ------------------------------------------------------------------
    // 4. manifold_get_contract_metrics  —  GET /v0/get-user-contract-metrics-with-contracts
    // ------------------------------------------------------------------
    tool(
      makeGetTool(
        "manifold_get_contract_metrics",
        "Get the authenticated user's per-market contract metrics with full contract details — positions, profit/loss, and the associated market objects for each position.",
        Type.Object({
          userId: Type.String({ description: "The ID of the user to get contract metrics for" }),
          limit: Type.Optional(Type.Number({ minimum: 0 })),
          offset: Type.Optional(Type.Number({ minimum: 0, description: "Number of records to skip for pagination" })),
          perAnswer: Type.Optional(Type.Boolean({ description: "If true, return metrics per answer for multi-choice markets" })),
          order: Type.Optional(Type.Union([Type.Literal("lastBetTime"), Type.Literal("profit")])),
        }),
        "get-user-contract-metrics-with-contracts",
        (p) => {
          const q: Record<string, unknown> = {};
          q.userId = p.userId;
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.offset !== undefined) q.offset = p.offset;
          if (p.perAnswer !== undefined) q.perAnswer = p.perAnswer;
          if (p.order !== undefined) q.order = p.order;
          return q;
        },
      ),
    ),

    // ------------------------------------------------------------------
    // 5. manifold_get_transactions  —  GET /v0/txns
    // ------------------------------------------------------------------
    tool(
      makeGetTool(
        "manifold_get_transactions",
        "List transaction history for the authenticated user — bets, payouts, transfers, fees, and other mana movements.",
        Type.Object({
          limit: Type.Optional(Type.Number({ minimum: 0, maximum: 100, description: "Max results per page (default 100, max 100)" })),
          token: Type.Optional(Type.Union([Type.Literal("M$"), Type.Literal("CASH")])),
          offset: Type.Optional(Type.Number({ minimum: 0, description: "Number of records to skip for pagination" })),
          before: Type.Optional(Type.Number({ description: "Include only transactions created before this timestamp (ms)" })),
          after: Type.Optional(Type.Number({ description: "Include only transactions created after this timestamp (ms)" })),
          toId: Type.Optional(Type.String({ description: "Include only transactions to this user ID" })),
          fromId: Type.Optional(Type.String({ description: "Include only transactions from this user ID" })),
          category: Type.Optional(Type.String({ description: "Include only transactions of this category (e.g. MANA_PAYMENT)" })),
          ignoreCategories: Type.Optional(Type.Array(Type.String(), { description: "Categories to exclude" })),
        }),
        "txns",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.token !== undefined) q.token = p.token;
          if (p.offset !== undefined) q.offset = p.offset;
          if (p.before !== undefined) q.before = p.before;
          if (p.after !== undefined) q.after = p.after;
          if (p.toId !== undefined) q.toId = p.toId;
          if (p.fromId !== undefined) q.fromId = p.fromId;
          if (p.category !== undefined) q.category = p.category;
          if (p.ignoreCategories !== undefined) q.ignoreCategories = p.ignoreCategories;
          return q;
        },
      ),
    ),
  ];
}
