import { Type } from "typebox";
import { makePostTool, type ToolFactory } from "../tool-builder.js";

export function createWriteTools(tool: ToolFactory) {
  return [
    // 1. Place a bet on a market (market or limit order)
    tool(
      makePostTool(
        "manifold_place_bet",
        "Place a bet on a market. Costs real M$ — the `amount` parameter specifies the mana to wager. Supports market orders (buy at current price) and limit orders (via `limitProb`).",
        Type.Object({
          marketId: Type.String({ description: "The market ID to bet on" }),
          outcome: Type.Union([
            Type.Literal("YES"),
            Type.Literal("NO"),
          ]),
          amount: Type.Number({ minimum: 1, description: "Amount of M$ to wager" }),
          limitProb: Type.Optional(
            Type.Number({ minimum: 0.01, maximum: 0.99, description: "Limit price for a limit order (omit for market order)" }),
          ),
        }),
        "bet",
        (p) => ({ marketId: p.marketId, outcome: p.outcome, amount: p.amount, limitProb: p.limitProb }),
      ),
    ),

    // 2. Place bets across multiple answers in one request
    tool(
      makePostTool(
        "manifold_place_multi_bet",
        "Place bets across multiple answers in a multi-choice or free-response market in a single request. Costs real M$ — each bet in the array incurs its own wager amount.",
        Type.Object({
          marketId: Type.String({ description: "The market ID" }),
          bets: Type.Array(
            Type.Object({
              answerId: Type.String({ description: "The answer ID to bet on" }),
              amount: Type.Number({ minimum: 1, description: "Amount of M$ to wager" }),
            }),
          ),
        }),
        "multi-bet",
        (p) => ({ marketId: p.marketId, bets: p.bets }),
      ),
    ),

    // 3. Cancel an unfilled limit order bet
    tool(
      makePostTool(
        "manifold_cancel_bet",
        "Cancel an unfilled limit order bet. Only pending limit orders can be cancelled — filled or settled bets cannot.",
        Type.Object({
          betId: Type.String({ description: "The bet ID to cancel" }),
        }),
        (p) => `bet/cancel/${p.betId}`,
      ),
    ),

    // 4. Create a new prediction market
    tool(
      makePostTool(
        "manifold_create_market",
        "Create a new prediction market. Costs M$50–250 depending on market type and liquidity settings. The creator is charged immediately upon creation.",
        Type.Object({
          question: Type.String({ description: "The market question text" }),
          outcomeType: Type.Union([
            Type.Literal("BINARY"),
            Type.Literal("MULTIPLE_CHOICE"),
            Type.Literal("FREE_RESPONSE"),
            Type.Literal("POLL"),
            Type.Literal("NUMERIC"),
            Type.Literal("PSEUDO_NUMERIC"),
            Type.Literal("BOUNTIED_QUESTION"),
          ]),
          description: Type.Optional(Type.String({ description: "Market description / body text (supports Markdown)" })),
          closeTime: Type.Optional(Type.Number({ description: "When to close the market (Unix timestamp ms)" })),
          groupIds: Type.Optional(Type.Array(Type.String(), { description: "Topic group IDs to add the market to" })),
          initialProb: Type.Optional(
            Type.Number({ minimum: 0.01, maximum: 0.99, description: "Initial probability for binary markets (default 0.5)" }),
          ),
          expectLabResolve: Type.Optional(Type.Boolean({ description: "Whether the market uses LAB resolve" })),
          resolution: Type.Optional(Type.String({ description: "Pre-resolve value (for creating already-resolved markets)" })),
        }),
        "market",
        (p) => ({
          question: p.question,
          outcomeType: p.outcomeType,
          description: p.description,
          closeTime: p.closeTime,
          groupIds: p.groupIds,
          initialProb: p.initialProb,
          expectLabResolve: p.expectLabResolve,
          resolution: p.resolution,
        }),
      ),
    ),

    // 5. Resolve a market — irreversible
    tool(
      makePostTool(
        "manifold_resolve_market",
        "Resolve a market — declare the outcome and pay out bettors. Only the market creator or an admin can resolve. This is irreversible.",
        Type.Object({
          marketId: Type.String({ description: "The market ID to resolve" }),
          resolution: Type.Union([
            Type.Literal("YES"),
            Type.Literal("NO"),
            Type.Literal("MKT"),
            Type.Literal("CANCEL"),
            Type.Literal("N/A"),
          ]),
          payout: Type.Optional(Type.Number({ minimum: 0, description: "Custom payout amount (for N/A resolution on bountied questions)" })),
          answerId: Type.Optional(Type.String({ description: "For multi-choice: the winning answer ID" })),
        }),
        (p) => `market/${p.marketId}/resolve`,
        (p) => ({ resolution: p.resolution, payout: p.payout, answerId: p.answerId }),
      ),
    ),

    // 6. Sell shares in a market
    tool(
      makePostTool(
        "manifold_sell_shares",
        "Sell shares in a market. Converts shares back to M$ at the current price. Only the authenticated user's own shares can be sold.",
        Type.Object({
          marketId: Type.String({ description: "The market ID" }),
          shares: Type.Number({ minimum: 0.01, description: "Number of shares to sell" }),
          outcome: Type.Union([Type.Literal("YES"), Type.Literal("NO")]),
        }),
        (p) => `market/${p.marketId}/sell`,
        (p) => ({ shares: p.shares, outcome: p.outcome }),
      ),
    ),

    // 7. Set or update the close time of a market
    tool(
      makePostTool(
        "manifold_close_market",
        "Set or update the close time of a market. After the close time, no new bets can be placed but the market is not yet resolved. Only the market creator can close.",
        Type.Object({
          marketId: Type.String({ description: "The market ID to close" }),
          closeTime: Type.Number({ description: "New close time (Unix timestamp ms)" }),
        }),
        (p) => `market/${p.marketId}/close`,
        (p) => ({ closeTime: p.closeTime }),
      ),
    ),

    // 8. Add liquidity to a market
    tool(
      makePostTool(
        "manifold_add_liquidity",
        "Add liquidity to a market — subsidizes the market's liquidity pool, which reduces the spread and encourages trading. Costs real M$.",
        Type.Object({
          marketId: Type.String({ description: "The market ID" }),
          amount: Type.Number({ minimum: 1, description: "Amount of M$ to add as liquidity" }),
        }),
        (p) => `market/${p.marketId}/add-liquidity`,
        (p) => ({ amount: p.amount }),
      ),
    ),

    // 9. Add a new answer to a multi-choice or free-response market
    tool(
      makePostTool(
        "manifold_add_answer",
        "Add a new answer to a multi-choice or free-response market. Only the market creator or admin can add answers to a multi-choice market after creation.",
        Type.Object({
          marketId: Type.String({ description: "The market ID" }),
          text: Type.String({ description: "The answer text" }),
        }),
        (p) => `market/${p.marketId}/answer`,
        (p) => ({ text: p.text }),
      ),
    ),

    // 10. Tag or untag a market with a topic group
    tool(
      makePostTool(
        "manifold_market_group",
        "Tag or untag a market with a topic group. Use `add` to tag, `remove` to untag.",
        Type.Object({
          marketId: Type.String({ description: "The market ID" }),
          groupId: Type.String({ description: "The group/topic ID" }),
          action: Type.Union([Type.Literal("add"), Type.Literal("remove")]),
        }),
        (p) => `market/${p.marketId}/group`,
        (p) => ({ groupId: p.groupId, action: p.action }),
      ),
    ),

    // 11. Rebalance shares across answers in a multi-choice market
    tool(
      makePostTool(
        "manifold_rebalance",
        "Rebalance the authenticated user's position in a multi-choice market — redistribute shares across answers without withdrawing mana.",
        Type.Object({
          marketId: Type.String({ description: "The market ID" }),
          targetAnswerWeights: Type.Record(
            Type.String(),
            Type.Number({ minimum: 0, description: "Target weight (proportion) for this answer" }),
          ),
        }),
        (p) => `market/${p.marketId}/rebalance`,
        (p) => ({ targetAnswerWeights: p.targetAnswerWeights }),
      ),
    ),

    // 12. Add a bounty to a bountied-question market
    tool(
      makePostTool(
        "manifold_add_bounty",
        "Add a bounty to a bountied-question market — post a reward that other users can earn by providing a good answer. Costs real M$.",
        Type.Object({
          marketId: Type.String({ description: "The market ID" }),
          amount: Type.Number({ minimum: 1, description: "Bounty amount in M$" }),
          description: Type.Optional(Type.String({ description: "Description of what the bounty is for" })),
        }),
        (p) => `market/${p.marketId}/add-bounty`,
        (p) => ({ amount: p.amount, description: p.description }),
      ),
    ),

    // 13. Award a bounty to a comment author
    tool(
      makePostTool(
        "manifold_award_bounty",
        "Award a bounty to a comment author — transfer the bounty reward to the user who posted the winning comment. Costs real M$.",
        Type.Object({
          marketId: Type.String({ description: "The market ID" }),
          commentId: Type.String({ description: "The comment ID to award" }),
          amount: Type.Number({ minimum: 1, description: "Amount of the bounty to award in M$" }),
        }),
        (p) => `market/${p.marketId}/award-bounty`,
        (p) => ({ commentId: p.commentId, amount: p.amount }),
      ),
    ),

    // 14. Send mana (M$) to another user
    tool(
      makePostTool(
        "manifold_send_mana",
        "Send mana (M$) to another user — a direct transfer. Sends real M$ from your balance to the recipient. This action is irreversible.",
        Type.Object({
          toId: Type.String({ description: "Recipient user ID" }),
          amount: Type.Number({ minimum: 1, description: "Amount of M$ to send" }),
          message: Type.Optional(Type.String({ description: "Optional message to include with the transfer" })),
        }),
        "managram",
        (p) => ({ toId: p.toId, amount: p.amount, message: p.message }),
      ),
    ),

    // 15. Create a comment on a market
    tool(
      makePostTool(
        "manifold_create_comment",
        "Create a comment on a market. Costs a flat M$1 fee per comment, deducted from the authenticated user's balance.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID to comment on" }),
          content: Type.String({ description: "Comment text (supports Markdown)" }),
          replyToCommentId: Type.Optional(Type.String({ description: "ID of the parent comment to reply to" })),
        }),
        "comment",
        (p) => ({ contractId: p.contractId, content: p.content, replyToCommentId: p.replyToCommentId }),
      ),
    ),
  ];
}
