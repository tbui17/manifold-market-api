/**
 * Read-only user tools for the Manifold Markets API plugin.
 */

import { Type } from "typebox";
import { makeGetTool, type ToolFactory } from "../tool-builder.js";

export function createUserTools(tool: ToolFactory) {
  return [
    tool(
      makeGetTool(
        "manifold_get_user",
        "Get full user profile by username — display name, bio, creation date, follower/following counts, portfolio summary.",
        Type.Object({
          username: Type.String(),
        }),
        (p) => `user/${p.username}`,
      ),
    ),
    tool(
      makeGetTool(
        "manifold_get_user_lite",
        "Get display-only user info by username — name, avatar, basic profile without full portfolio data.",
        Type.Object({
          username: Type.String(),
        }),
        (p) => `user/${p.username}/lite`,
      ),
    ),
    tool(
      makeGetTool(
        "manifold_get_user_by_id",
        "Get full user profile by unique ID.",
        Type.Object({
          id: Type.String(),
        }),
        (p) => `user/by-id/${p.id}`,
      ),
    ),
    tool(
      makeGetTool(
        "manifold_get_user_by_id_lite",
        "Get display-only user info by unique ID.",
        Type.Object({
          id: Type.String(),
        }),
        (p) => `user/by-id/${p.id}/lite`,
      ),
    ),
    tool(
      makeGetTool(
        "manifold_list_users",
        "List users with cursor-based pagination. Maximum 1000 results per page.",
        Type.Object({
          before: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Number({ minimum: 0, maximum: 1000, description: "Max results per page" })),
          order: Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")])),
        }),
        "users",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.before !== undefined) q.before = p.before;
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.order !== undefined) q.order = p.order;
          return q;
        },
      ),
    ),
    tool(
      makeGetTool(
        "manifold_search_users",
        "Search users by username or display name.",
        Type.Object({
          term: Type.String(),
          limit: Type.Optional(Type.Number({ minimum: 0, maximum: 1000 })),
          page: Type.Optional(Type.Number({ minimum: 0 })),
        }),
        "search-users",
        (p) => ({
          term: p.term,
          ...(p.limit !== undefined ? { limit: p.limit } : {}),
          ...(p.page !== undefined ? { page: p.page } : {}),
        }),
      ),
    ),
  ];
}
