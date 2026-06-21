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
          contractId: Type.String({ description: "The market/contract ID to bet on" }),
          outcome: Type.Union([Type.Literal("YES"), Type.Literal("NO")]),
          amount: Type.Number({ minimum: 1, description: "Amount of M$ to wager" }),
          limitProb: Type.Optional(
            Type.Number({ minimum: 0.01, maximum: 0.99, description: "Limit price for a limit order (omit for market order)" }),
          ),
          dryRun: Type.Optional(
            Type.Boolean({ description: "If true, simulate the bet without spending mana or placing it" }),
          ),
          answerId: Type.Optional(
            Type.String({ description: "For multiple-choice markets: the answer ID to bet on" }),
          ),
        }),
        "bet",
        (p) => ({
          contractId: p.contractId,
          outcome: p.outcome,
          amount: p.amount,
          limitProb: p.limitProb,
          dryRun: p.dryRun,
          answerId: p.answerId,
        }),
      ),
    ),

    // 2. Place bets across multiple answers in one request
    tool(
      makePostTool(
        "manifold_place_multi_bet",
        "Place bets across multiple answers in a sums-to-one multiple choice market in a single request. Costs real M$ — the `amount` is the total spent across the selected answers.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID" }),
          amount: Type.Number({ minimum: 1, description: "Total amount of M$ to spend across all answers" }),
          answerIds: Type.Array(Type.String(), { description: "Array of answer IDs to buy (minimum 2 for sums-to-one markets)" }),
          limitProb: Type.Optional(
            Type.Number({ minimum: 0, maximum: 1, description: "Limit price (omit for market order)" }),
          ),
        }),
        "multi-bet",
        (p) => ({
          contractId: p.contractId,
          amount: p.amount,
          answerIds: p.answerIds,
          limitProb: p.limitProb,
        }),
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
        "Create a new prediction market. Costs M$ depending on market type and liquidity tier. The creator is charged immediately upon creation.",
        Type.Object({
          question: Type.String({ description: "The market question text" }),
          outcomeType: Type.Union([
            Type.Literal("BINARY"),
            Type.Literal("STONK"),
            Type.Literal("MULTIPLE_CHOICE"),
            Type.Literal("PSEUDO_NUMERIC"),
            Type.Literal("NUMBER"),
            Type.Literal("MULTI_NUMERIC"),
            Type.Literal("DATE"),
            Type.Literal("BOUNTIED_QUESTION"),
            Type.Literal("POLL"),
          ]),
          liquidityTier: Type.Number({
            minimum: 100,
            description: "Liquidity subsidy tier in M$. Must be one of: 100, 1000, 10000, 100000. Higher tiers get more initial liquidity.",
          }),
          description: Type.Optional(Type.String({ description: "Market description / body text (supports Markdown)" })),
          descriptionMarkdown: Type.Optional(Type.String({ description: "Market description as Markdown (alternative to description)" })),
          closeTime: Type.Optional(Type.Number({ description: "When to close the market (Unix timestamp ms, must be in the future)" })),
          groupIds: Type.Optional(Type.Array(Type.String(), { description: "Topic group IDs to add the market to" })),
          visibility: Type.Optional(
            Type.Union([Type.Literal("public"), Type.Literal("unlisted")], {
              description: "Market visibility (default 'public')",
            }),
          ),
          // BINARY / STONK only
          initialProb: Type.Optional(
            Type.Number({ minimum: 1, maximum: 99, description: "For BINARY/STONK: initial probability (1-99, default 50)" }),
          ),
          // MULTIPLE_CHOICE / POLL only
          answers: Type.Optional(
            Type.Array(Type.String(), { description: "For MULTIPLE_CHOICE/POLL: array of answer strings" }),
          ),
          shouldAnswersSumToOne: Type.Optional(
            Type.Boolean({ description: "For MULTIPLE_CHOICE: whether answers sum to 100% (auto-arbitrage)" }),
          ),
          addAnswersMode: Type.Optional(
            Type.Union(
              [Type.Literal("DISABLED"), Type.Literal("ONLY_CREATOR"), Type.Literal("ANYONE")],
              { description: "For MULTIPLE_CHOICE: who can add answers after creation (default DISABLED)" },
            ),
          ),
          // PSEUDO_NUMERIC only
          min: Type.Optional(Type.Number({ description: "For PSEUDO_NUMERIC: minimum value" })),
          max: Type.Optional(Type.Number({ description: "For PSEUDO_NUMERIC: maximum value" })),
          initialValue: Type.Optional(Type.Number({ description: "For PSEUDO_NUMERIC: starting value" })),
          isLogScale: Type.Optional(Type.Boolean({ description: "For PSEUDO_NUMERIC: use log scale" })),
          // NUMBER only
          precision: Type.Optional(Type.Number({ description: "For NUMBER: decimal precision (must be > 0)" })),
          // MULTI_NUMERIC / DATE only
          midpoints: Type.Optional(
            Type.Array(Type.Number(), { description: "For MULTI_NUMERIC/DATE: midpoint values for each answer" }),
          ),
          unit: Type.Optional(Type.String({ description: "For MULTI_NUMERIC: unit label" })),
          timezone: Type.Optional(Type.String({ description: "For DATE: timezone string" })),
          // BOUNTIED_QUESTION only
          totalBounty: Type.Optional(
            Type.Number({ minimum: 1000, description: "For BOUNTIED_QUESTION: total bounty in M$ (minimum 1000)" }),
          ),
        }),
        "market",
        (p) => ({
          question: p.question,
          outcomeType: p.outcomeType,
          liquidityTier: p.liquidityTier,
          description: p.description,
          descriptionMarkdown: p.descriptionMarkdown,
          closeTime: p.closeTime,
          groupIds: p.groupIds,
          visibility: p.visibility,
          initialProb: p.initialProb,
          answers: p.answers,
          shouldAnswersSumToOne: p.shouldAnswersSumToOne,
          addAnswersMode: p.addAnswersMode,
          min: p.min,
          max: p.max,
          initialValue: p.initialValue,
          isLogScale: p.isLogScale,
          precision: p.precision,
          midpoints: p.midpoints,
          unit: p.unit,
          timezone: p.timezone,
          totalBounty: p.totalBounty,
        }),
      ),
    ),

    // 5. Resolve a market — irreversible
    tool(
      makePostTool(
        "manifold_resolve_market",
        "Resolve a market — declare the outcome and pay out bettors. Only the market creator or an admin can resolve. This is irreversible.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID to resolve" }),
          outcome: Type.Union([
            Type.Literal("YES"),
            Type.Literal("NO"),
            Type.Literal("MKT"),
            Type.Literal("CANCEL"),
            Type.Literal("CHOOSE_ONE"),
            Type.Literal("CHOOSE_MULTIPLE"),
          ]),
          probabilityInt: Type.Optional(
            Type.Number({ minimum: 0, maximum: 100, description: "For MKT on binary/pseudo-numeric: the probability (0-100) the market resolves to" }),
          ),
          value: Type.Optional(
            Type.Number({ description: "For MKT on pseudo-numeric: the value the market resolves to" }),
          ),
          answerId: Type.Optional(
            Type.String({ description: "For CHOOSE_ONE multi-choice: the winning answer ID. For independent multi-choice: the specific answer to resolve." }),
          ),
          resolutions: Type.Optional(
            Type.Array(
              Type.Object({
                answerId: Type.String({ description: "The answer ID" }),
                pct: Type.Number({ minimum: 0, maximum: 100, description: "Weight percentage for this answer" }),
              }),
              { description: "For CHOOSE_MULTIPLE multi-choice: per-answer weights summing to 100" },
            ),
          ),
        }),
        (p) => `market/${p.contractId}/resolve`,
        (p) => ({
          outcome: p.outcome,
          probabilityInt: p.probabilityInt,
          value: p.value,
          answerId: p.answerId,
          resolutions: p.resolutions,
        }),
      ),
    ),

    // 6. Sell shares in a market
    tool(
      makePostTool(
        "manifold_sell_shares",
        "Sell shares in a market. Converts shares back to M$ at the current price. Only the authenticated user's own shares can be sold.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID" }),
          outcome: Type.Union([Type.Literal("YES"), Type.Literal("NO")]),
          shares: Type.Optional(Type.Number({ minimum: 0.01, description: "Number of shares to sell (omit to sell all)" })),
          answerId: Type.Optional(Type.String({ description: "Required for multi-choice markets: the answer ID to sell" })),
        }),
        (p) => `market/${p.contractId}/sell`,
        (p) => ({ outcome: p.outcome, shares: p.shares, answerId: p.answerId }),
      ),
    ),

    // 7. Set or update the close time of a market
    tool(
      makePostTool(
        "manifold_close_market",
        "Set or update the close time of a market. After the close time, no new bets can be placed but the market is not yet resolved. Only the market creator can close.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID to close" }),
          closeTime: Type.Optional(
            Type.Number({ description: "New close time (Unix timestamp ms). Omit to close immediately." }),
          ),
        }),
        (p) => `market/${p.contractId}/close`,
        (p) => ({ closeTime: p.closeTime }),
      ),
    ),

    // 8. Add liquidity to a market
    tool(
      makePostTool(
        "manifold_add_liquidity",
        "Add liquidity to a market — subsidizes the market's liquidity pool, which reduces the spread and encourages trading. Costs real M$.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID" }),
          amount: Type.Number({ minimum: 1, description: "Amount of M$ to add as liquidity" }),
        }),
        (p) => `market/${p.contractId}/add-liquidity`,
        (p) => ({ amount: p.amount }),
      ),
    ),

    // 9. Add a new answer to a multi-choice market
    tool(
      makePostTool(
        "manifold_add_answer",
        "Add a new answer to a multi-choice market. Only the market creator or admin can add answers (depending on the market's addAnswersMode).",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID" }),
          text: Type.String({ description: "The answer text" }),
        }),
        (p) => `market/${p.contractId}/answer`,
        (p) => ({ text: p.text }),
      ),
    ),

    // 10. Tag or untag a market with a topic group
    tool(
      makePostTool(
        "manifold_market_group",
        "Tag or untag a market with a topic group. Use `remove: false` (default) to tag, `remove: true` to untag.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID" }),
          groupId: Type.String({ description: "The group/topic ID" }),
          remove: Type.Optional(Type.Boolean({ description: "If true, remove the tag; if false/omitted, add it" })),
        }),
        (p) => `market/${p.contractId}/group`,
        (p) => ({ groupId: p.groupId, remove: p.remove }),
      ),
    ),

    // 11. Rebalance shares in a sums-to-one multi-choice market
    tool(
      makePostTool(
        "manifold_rebalance",
        "Rebalance the authenticated user's position in a sums-to-one multi-choice market — collapses mixed YES/NO positions into all-YES and redeems the minimum across outcomes as cash. Pure accounting, no AMM or fees.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID" }),
        }),
        (p) => `market/${p.contractId}/rebalance`,
        (p) => ({}),
      ),
    ),

    // 12. Add a bounty to a bountied-question market
    tool(
      makePostTool(
        "manifold_add_bounty",
        "Add a bounty to a bountied-question market — post a reward that other users can earn by providing a good answer. Costs real M$.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID" }),
          amount: Type.Number({ minimum: 1, description: "Bounty amount in M$" }),
        }),
        (p) => `market/${p.contractId}/add-bounty`,
        (p) => ({ amount: p.amount }),
      ),
    ),

    // 13. Award a bounty to a comment author
    tool(
      makePostTool(
        "manifold_award_bounty",
        "Award a bounty to a comment author — transfer the bounty reward to the user who posted the winning comment. Costs real M$.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID" }),
          commentId: Type.String({ description: "The comment ID to award" }),
          amount: Type.Number({ minimum: 1, description: "Amount of the bounty to award in M$" }),
        }),
        (p) => `market/${p.contractId}/award-bounty`,
        (p) => ({ commentId: p.commentId, amount: p.amount }),
      ),
    ),

    // 14. Send mana (M$) to other user(s)
    tool(
      makePostTool(
        "manifold_send_mana",
        "Send mana (M$) to one or more users — a direct transfer. Sends real M$ from your balance to the recipients. This action is irreversible.",
        Type.Object({
          toIds: Type.Array(Type.String(), { description: "Array of recipient user IDs" }),
          amount: Type.Number({ minimum: 1, description: "Amount of M$ to send to each recipient" }),
          message: Type.String({ description: "Message to include with the transfer" }),
        }),
        "managram",
        (p) => ({ toIds: p.toIds, amount: p.amount, message: p.message }),
      ),
    ),

    // 15. Create a comment on a market
    tool(
      makePostTool(
        "manifold_create_comment",
        "Create a comment on a market. Costs a flat M$1 fee per comment, deducted from the authenticated user's balance. The comment text is sent as Markdown.",
        Type.Object({
          contractId: Type.String({ description: "The market/contract ID to comment on" }),
          markdown: Type.String({ description: "Comment text in Markdown format" }),
          replyToCommentId: Type.Optional(Type.String({ description: "ID of the parent comment to reply to" })),
        }),
        "comment",
        (p) => ({ contractId: p.contractId, markdown: p.markdown, replyToCommentId: p.replyToCommentId }),
      ),
    ),
  ];
}
