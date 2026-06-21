import { Type } from "typebox";
import { makeGetTool, type ToolFactory } from "../tool-builder.js";

export function createMiscReadTools(tool: ToolFactory) {
  return [
    tool(
      makeGetTool(
        "manifold_get_leagues",
        "Get league standings — competitive leaderboards grouping users by trading performance over a period. No authentication required.",
        Type.Object({
          cohort: Type.Optional(Type.String()),
          season: Type.Optional(Type.Number()),
          userId: Type.Optional(Type.String({ description: "Returns only leagues for this user" })),
        }),
        "leagues",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.cohort !== undefined) q.cohort = p.cohort;
          if (p.season !== undefined) q.season = p.season;
          if (p.userId !== undefined) q.userId = p.userId;
          return q;
        },
      ),
    ),
    tool(
      makeGetTool(
        "manifold_get_boost_history",
        "Get the public log of market boosts — promotions applied to markets on the platform. No authentication required.",
        Type.Object({
          limit: Type.Optional(Type.Number({ minimum: 0, maximum: 1000, description: "Number of boosts to return (default 100, max 1000)" })),
          contractId: Type.Optional(Type.String({ description: "Only return boosts for this contract" })),
          postId: Type.Optional(Type.String({ description: "Only return boosts for this post" })),
          userId: Type.Optional(Type.String({ description: "Only return boosts created by this user" })),
          includePending: Type.Optional(Type.Boolean({ description: "Include unfunded cash boosts (default false)" })),
          offset: Type.Optional(Type.Number({ minimum: 0, description: "Number of boosts to skip (default 0)" })),
        }),
        "get-boost-history",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.contractId !== undefined) q.contractId = p.contractId;
          if (p.postId !== undefined) q.postId = p.postId;
          if (p.userId !== undefined) q.userId = p.userId;
          if (p.includePending !== undefined) q.includePending = p.includePending;
          if (p.offset !== undefined) q.offset = p.offset;
          return q;
        },
      ),
    ),
  ];
}
