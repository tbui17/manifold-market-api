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
          userId: Type.Optional(Type.String()),
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
          userId: Type.Optional(Type.String()),
          period: Type.Optional(
            Type.Union([
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
          userId: Type.Optional(Type.String()),
          slugs: Type.Optional(Type.Array(Type.String())),
          limit: Type.Optional(Type.Number({ minimum: 1 })),
          fresh: Type.Optional(Type.Boolean()),
        }),
        "get-user-contract-metrics-with-contracts",
        (p) => ({
          userId: p.userId,
          slugs: p.slugs,
          limit: p.limit,
          fresh: p.fresh,
        }),
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
          txntype: Type.Optional(Type.String()),
          before: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
        }),
        "txns",
        (p) => ({
          txntype: p.txntype,
          before: p.before,
          limit: p.limit,
        }),
      ),
    ),
  ];
}
