import { Type } from "typebox";
import { makeGetTool, type ToolFactory } from "../tool-builder.js";

const betParams = Type.Object({
  userId: Type.Optional(Type.String()),
  username: Type.Optional(Type.String()),
  contractId: Type.Optional(Type.String()),
  contractSlug: Type.Optional(Type.String()),
  answerId: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
  before: Type.Optional(Type.String()),
  after: Type.Optional(Type.String()),
  beforeTime: Type.Optional(Type.Number()),
  afterTime: Type.Optional(Type.Number()),
  order: Type.Optional(
    Type.Union([Type.Literal("asc"), Type.Literal("desc")]),
  ),
  kinds: Type.Optional(Type.Array(Type.String())),
  minAmount: Type.Optional(Type.Number({ minimum: 0 })),
  filterRedemptions: Type.Optional(Type.Boolean()),
});

const commentParams = Type.Object({
  contractId: Type.Optional(Type.String()),
  userId: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 1000 })),
  before: Type.Optional(Type.String()),
});

export function createActivityTools(tool: ToolFactory) {
  return [
    tool(
      makeGetTool(
        "manifold_get_bets",
        "List bets with rich filtering. Supports filtering by user, market, answer, time range, bet kind, minimum amount, and redemption filtering. Use `before`/`after` cursors for pagination.",
        betParams,
        "bets",
        (p) => ({
          userId: p.userId,
          username: p.username,
          contractId: p.contractId,
          contractSlug: p.contractSlug,
          answerId: p.answerId,
          limit: p.limit,
          before: p.before,
          after: p.after,
          beforeTime: p.beforeTime,
          afterTime: p.afterTime,
          order: p.order,
          kinds: p.kinds,
          minAmount: p.minAmount,
          filterRedemptions: p.filterRedemptions,
        }),
      ),
    ),
    tool(
      makeGetTool(
        "manifold_get_comments",
        "List comments on a market or by a user. Provide `contractId` to get comments on a specific market, or `userId` to get all comments by a user.",
        commentParams,
        "comments",
        (p) => ({
          contractId: p.contractId,
          userId: p.userId,
          limit: p.limit,
          before: p.before,
        }),
      ),
    ),
  ];
}
