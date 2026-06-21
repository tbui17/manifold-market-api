import { Type } from "typebox";
import { makeGetTool, type ToolFactory } from "../tool-builder.js";

export function createGroupTools(tool: ToolFactory) {
  return [
    tool(
      makeGetTool(
        "manifold_get_groups",
        "List topic groups (called 'topics' on the Manifold website). Groups are collections of related markets. No authentication required.",
        Type.Object({
          limit: Type.Optional(Type.Number({ minimum: 0, maximum: 1000 })),
          beforeTime: Type.Optional(Type.Number({ description: "Get only topics created before this time (ms)" })),
          availableToUserId: Type.Optional(Type.String({ description: "Get only topics that the user has access to" })),
        }),
        "groups",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.beforeTime !== undefined) q.beforeTime = p.beforeTime;
          if (p.availableToUserId !== undefined) q.availableToUserId = p.availableToUserId;
          return q;
        },
      ),
    ),
    tool(
      makeGetTool(
        "manifold_get_group",
        "Get full group/topic details by URL slug — name, description, member counts, and associated markets. No authentication required.",
        Type.Object({
          slug: Type.String(),
        }),
        (p) => `group/${p.slug}`,
      ),
    ),
    tool(
      makeGetTool(
        "manifold_get_group_by_id",
        "Get full group/topic details by unique ID. No authentication required.",
        Type.Object({
          id: Type.String(),
        }),
        (p) => `group/by-id/${p.id}`,
      ),
    ),
  ];
}
