import { Type } from "typebox";
import { makeGetTool, type ToolFactory } from "../tool-builder.js";

const betParams = Type.Object({
  userId: Type.Optional(Type.String()),
  username: Type.Optional(Type.String()),
  contractId: Type.Optional(Type.String()),
  contractSlug: Type.Optional(Type.String()),
  answerId: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 0, maximum: 50000 })),
  before: Type.Optional(Type.String()),
  after: Type.Optional(Type.String()),
  beforeTime: Type.Optional(Type.Number()),
  afterTime: Type.Optional(Type.Number()),
  order: Type.Optional(
    Type.Union([Type.Literal("asc"), Type.Literal("desc")]),
  ),
  kinds: Type.Optional(Type.Union([Type.Literal("open-limit")])),
  minAmount: Type.Optional(Type.Number({ minimum: 0 })),
  filterRedemptions: Type.Optional(Type.Boolean()),
  id: Type.Optional(Type.String({ description: "Get only bets with this specific bet ID" })),
  includeZeroShareRedemptions: Type.Optional(Type.Boolean()),
  excludeApi: Type.Optional(Type.Boolean({ description: "If true, exclude bets placed via the API" })),
  commentRepliesOnly: Type.Optional(Type.Boolean()),
  count: Type.Optional(Type.Boolean({ description: "If true, return a count of matching bets instead of the bets themselves" })),
  points: Type.Optional(Type.Number({ minimum: 0, maximum: 10000, description: "Number of points to return for charting" })),
});

const commentParams = Type.Object({
  contractId: Type.Optional(Type.String()),
  userId: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 0, maximum: 1000 })),
  contractSlug: Type.Optional(Type.String({ description: "The slug of the market to read comments of" })),
  afterTime: Type.Optional(Type.Number({ description: "Include only comments after this timestamp (ms)" })),
  page: Type.Optional(Type.Number({ minimum: 0, description: "Page number for pagination with limit" })),
  order: Type.Optional(Type.Union([Type.Literal("likes"), Type.Literal("newest"), Type.Literal("oldest")])),
  isPolitics: Type.Optional(Type.Boolean()),
});

export function createActivityTools(tool: ToolFactory) {
  return [
    tool(
      makeGetTool(
        "manifold_get_bets",
        "List bets with rich filtering. Supports filtering by user, market, answer, time range, bet kind, minimum amount, and redemption filtering. Use `before`/`after` cursors for pagination.",
        betParams,
        "bets",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.userId !== undefined) q.userId = p.userId;
          if (p.username !== undefined) q.username = p.username;
          if (p.contractId !== undefined) q.contractId = p.contractId;
          if (p.contractSlug !== undefined) q.contractSlug = p.contractSlug;
          if (p.answerId !== undefined) q.answerId = p.answerId;
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.before !== undefined) q.before = p.before;
          if (p.after !== undefined) q.after = p.after;
          if (p.beforeTime !== undefined) q.beforeTime = p.beforeTime;
          if (p.afterTime !== undefined) q.afterTime = p.afterTime;
          if (p.order !== undefined) q.order = p.order;
          if (p.kinds !== undefined) q.kinds = p.kinds;
          if (p.minAmount !== undefined) q.minAmount = p.minAmount;
          if (p.filterRedemptions !== undefined) q.filterRedemptions = p.filterRedemptions;
          if (p.id !== undefined) q.id = p.id;
          if (p.includeZeroShareRedemptions !== undefined) q.includeZeroShareRedemptions = p.includeZeroShareRedemptions;
          if (p.excludeApi !== undefined) q.excludeApi = p.excludeApi;
          if (p.commentRepliesOnly !== undefined) q.commentRepliesOnly = p.commentRepliesOnly;
          if (p.count !== undefined) q.count = p.count;
          if (p.points !== undefined) q.points = p.points;
          return q;
        },
      ),
    ),
    tool(
      makeGetTool(
        "manifold_get_comments",
        "List comments on a market or by a user. Provide `contractId` to get comments on a specific market, or `userId` to get all comments by a user.",
        commentParams,
        "comments",
        (p) => {
          const q: Record<string, unknown> = {};
          if (p.contractId !== undefined) q.contractId = p.contractId;
          if (p.userId !== undefined) q.userId = p.userId;
          if (p.limit !== undefined) q.limit = p.limit;
          if (p.contractSlug !== undefined) q.contractSlug = p.contractSlug;
          if (p.afterTime !== undefined) q.afterTime = p.afterTime;
          if (p.page !== undefined) q.page = p.page;
          if (p.order !== undefined) q.order = p.order;
          if (p.isPolitics !== undefined) q.isPolitics = p.isPolitics;
          return q;
        },
      ),
    ),
  ];
}
