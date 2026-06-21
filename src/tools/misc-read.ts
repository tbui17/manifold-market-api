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
        }),
        "leagues",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.cohort !== undefined) q.cohort = p.cohort;
          if (p.season !== undefined) q.season = p.season;
          return q;
        },
      ),
    ),
    tool(
      makeGetTool(
        "manifold_get_boost_history",
        "Get the public log of market boosts — promotions applied to markets on the platform. No authentication required.",
        Type.Object({
          limit: Type.Optional(Type.Number({ minimum: 1 })),
          before: Type.Optional(Type.String()),
        }),
        "get-boost-history",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.before !== undefined) q.before = p.before;
          return q;
        },
      ),
    ),
  ];
}
