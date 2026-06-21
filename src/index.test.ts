import { describe, expect, it, beforeAll } from "vitest";
import entry from "./index.js";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";
import { mcpTools } from "./mcp-server.js";

const pluginTools = getToolPluginMetadata(entry)?.tools ?? [];
const pluginToolNames = new Set(pluginTools.map((t) => t.name));
const mcpToolNames = new Set(mcpTools.map((t) => t.name));

// ── Helpers ──────────────────────────────────────────────────────────

let cache: { marketId: string; marketSlug: string; userId: string; username: string; groupId: string; authedUserId: string } = {
  marketId: "",
  marketSlug: "",
  userId: "",
  username: "",
  groupId: "",
  authedUserId: "",
};

/** Extract first object with an `id` from a response that may be a raw array or a wrapped object. */
function firstId(response: unknown): string | null {
  if (Array.isArray(response) && response.length > 0) {
    const entry = response[0] as Record<string, unknown>;
    if (typeof entry.id === "string") return entry.id;
  }
  if (typeof response === "object" && response !== null) {
    const obj = response as Record<string, unknown>;
    for (const key of ["results", "users", "markets", "groups", "data"]) {
      const val = obj[key];
      if (Array.isArray(val) && val.length > 0) {
        const entry = val[0] as Record<string, unknown>;
        if (typeof entry.id === "string") return entry.id;
      }
    }
  }
  return null;
}

/** Extract first object with `id` and `username`/`name` from raw-array or wrapped responses. */
function firstUser(response: unknown): { id: string; username: string } | null {
  if (Array.isArray(response) && response.length > 0) {
    const entry = response[0] as Record<string, unknown>;
    if (typeof entry.id === "string") {
      return { id: entry.id, username: (entry.username ?? entry.name ?? "") as string };
    }
  }
  if (typeof response === "object" && response !== null) {
    const obj = response as Record<string, unknown>;
    for (const key of ["results", "users", "data"]) {
      const val = obj[key];
      if (Array.isArray(val) && val.length > 0) {
        const entry = val[0] as Record<string, unknown>;
        if (typeof entry.id === "string") {
          return { id: entry.id, username: (entry.username ?? entry.name ?? "") as string };
        }
      }
    }
  }
  return null;
}

async function discoverMarket(): Promise<void> {
  if (cache.marketId) return;
  const tool = mcpTools.find((t) => t.name === "manifold_search_markets");
  if (!tool) return;
  try {
    const result = await tool.execute({ term: "AI", limit: 5 }, { apiKey: process.env.MANIFOLD_API_KEY }, { signal: undefined, toolCallId: "" });
    const id = firstId(result);
    if (id) {
      cache.marketId = id;
      if (Array.isArray(result)) {
        cache.marketSlug = ((result as Record<string, unknown>[])?.[0]?.slug ?? "") as string;
      } else if (typeof result === "object" && result !== null) {
        const obj = result as Record<string, unknown>;
        const results = obj.results ?? obj.markets ?? obj.data;
        cache.marketSlug = (Array.isArray(results) ? (results as { slug?: string }[])[0]?.slug : "") as string;
      }
    }
  } catch (e) {
    console.warn(`discoverMarket failed: ${(e as Error).message}`);
    const listTool = mcpTools.find((t) => t.name === "manifold_list_markets");
    if (listTool) {
      try {
        const result = await listTool.execute({}, { apiKey: process.env.MANIFOLD_API_KEY }, { signal: undefined, toolCallId: "" });
        const id = firstId(result);
        if (id) {
          cache.marketId = id;
          if (Array.isArray(result)) {
            cache.marketSlug = ((result as Record<string, unknown>[])?.[0]?.slug ?? "") as string;
          }
        }
      } catch (e) { console.warn(`discoverMarket (list fallback) failed: ${(e as Error).message}`); }
    }
  }
}

async function discoverUser(): Promise<void> {
  if (cache.userId) return;

  const listTool = mcpTools.find((t) => t.name === "manifold_list_users");
  if (listTool) {
    try {
      const result = await listTool.execute({}, { apiKey: process.env.MANIFOLD_API_KEY }, { signal: undefined, toolCallId: "" });
      const found = firstUser(result);
      if (found) {
        cache.userId = found.id;
        cache.username = found.username;
        return;
      }
    } catch (e) { console.warn(`discoverUser failed: ${(e as Error).message}`); }
  }

  if (cache.marketId) {
    const posTool = mcpTools.find((t) => t.name === "manifold_get_market_positions");
    if (posTool) {
      try {
        const result = await posTool.execute({ marketId: cache.marketId }, { apiKey: process.env.MANIFOLD_API_KEY }, { signal: undefined, toolCallId: "" });
        const positions = (result as { positions?: unknown[] })?.positions ?? [];
        for (const pos of positions as Record<string, unknown>[]) {
          if (pos.userId && typeof pos.userId === "string") {
            cache.userId = pos.userId;
            cache.username = (pos.username ?? "") as string;
            return;
          }
          if (pos.user && typeof pos.user === "object" && pos.user !== null) {
            const user = pos.user as Record<string, unknown>;
            if (user.id && typeof user.id === "string") {
              cache.userId = user.id;
              cache.username = (user.username ?? user.name ?? "") as string;
              return;
            }
          }
        }
      } catch (e) { console.warn(`discoverUser (position fallback) failed: ${(e as Error).message}`); }
    }
  }
}

async function discoverGroup(): Promise<void> {
  if (cache.groupId) return;
  const tool = mcpTools.find((t) => t.name === "manifold_get_groups");
  if (!tool) return;
  try {
    const result = await tool.execute({ limit: 1 }, { apiKey: process.env.MANIFOLD_API_KEY }, { signal: undefined, toolCallId: "" });
    const id = firstId(result);
    if (id) {
      cache.groupId = id;
    }
  } catch (e) { console.warn(`discoverGroup failed: ${(e as Error).message}`); }
}

// ── Inventory parity (SC-004, SC-005, FR-010) ──────────────────────

describe("inventory parity", () => {
  it("plugin declares tool metadata", () => {
    expect(pluginTools.length).toBeGreaterThan(0);
  });

  it("plugin and MCP server expose the same tool names", () => {
    expect(pluginToolNames).toEqual(mcpToolNames);
  });

  it("total tool count is 40", () => {
    expect(mcpTools.length).toBe(40);
  });

  it("all tool names are manifold_-prefixed", () => {
    for (const t of mcpTools) {
      expect(t.name.startsWith("manifold_")).toBe(true);
    }
  });

  it("no tool name is duplicated", () => {
    const seen = new Set<string>();
    for (const t of mcpTools) {
      expect(seen.has(t.name)).toBe(false);
      seen.add(t.name);
    }
  });

  it("MCP server tool inventory has the same count as the plugin", () => {
    expect(mcpTools.length).toBe(pluginTools.length);
  });

  it("each MCP tool has a non-empty description", () => {
    for (const t of mcpTools) {
      expect(t.description.length).toBeGreaterThan(0);
    }
  });
});

// ── Public read tools — live API tests (SC-010) ────────────────────

describe("live API — public read tools", () => {
  beforeAll(async () => {
    await discoverMarket();
    await discoverUser();
    await discoverGroup();
  }, 10000);

  function runLiveTest(
    toolName: string,
    makeArgs: () => Record<string, unknown>,
    shape: "array" | "object" | "prob",
  ): void {
    it(toolName, async (ctx) => {
      const tool = mcpTools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      if (!tool) return;

      // If dynamic discovery failed, skip dependent tests (visible, not silent)
      if (toolName === "manifold_get_market" && !cache.marketId) { ctx.skip(true, "No market discovered"); return; }
      if (toolName === "manifold_get_market_by_slug" && !cache.marketSlug) { ctx.skip(true, "No market slug discovered"); return; }
      if (toolName === "manifold_get_market_prob" && !cache.marketId) { ctx.skip(true, "No market discovered"); return; }
      if (toolName === "manifold_get_market_probs" && !cache.marketId) { ctx.skip(true, "No market discovered"); return; }
      if (toolName === "manifold_get_market_positions" && !cache.marketId) { ctx.skip(true, "No market discovered"); return; }
      if (toolName === "manifold_get_user_by_id" && !cache.userId) { ctx.skip(true, "No user discovered"); return; }
      if (toolName === "manifold_get_user_by_id_lite" && !cache.userId) { ctx.skip(true, "No user discovered"); return; }
      if (toolName === "manifold_get_comments" && !cache.marketId) { ctx.skip(true, "No market discovered"); return; }
      if (toolName === "manifold_get_group_by_id" && !cache.groupId) { ctx.skip(true, "No group discovered"); return; }
      if ((toolName === "manifold_get_user" || toolName === "manifold_get_user_lite") && !cache.username) { ctx.skip(true, "No user discovered"); return; }

      const result = await tool.execute(
        makeArgs(),
        { apiKey: process.env.MANIFOLD_API_KEY },
        { signal: undefined, toolCallId: "" },
      );
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (shape === "array") {
        expect(Array.isArray(result)).toBe(true);
      } else {
        expect(typeof result).toBe("object");
        expect(Array.isArray(result)).toBe(false);
      }
      if (shape === "prob") {
        // Binary markets return { prob: number }; multi-choice markets return
        // { answerProbs: Record<string, number> }. Assert whichever is present.
        const probResult = result as { prob?: number; answerProbs?: Record<string, number> };
        if (probResult.prob !== undefined) {
          expect(typeof probResult.prob).toBe("number");
          expect(probResult.prob).toBeGreaterThanOrEqual(0);
          expect(probResult.prob).toBeLessThanOrEqual(1);
        } else {
          expect(probResult.answerProbs).toBeDefined();
          expect(typeof probResult.answerProbs).toBe("object");
          for (const p of Object.values(probResult.answerProbs!)) {
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
          }
        }
      }
    }, 15000);
  }

  runLiveTest("manifold_search_markets", () => ({ term: "AI" }), "array");
  runLiveTest("manifold_get_market", () => ({ marketId: cache.marketId }), "object");
  runLiveTest("manifold_get_market_by_slug", () => ({ marketSlug: cache.marketSlug }), "object");
  runLiveTest("manifold_list_markets", () => ({}), "array");
  runLiveTest("manifold_get_market_prob", () => ({ marketId: cache.marketId }), "prob");
  runLiveTest("manifold_get_market_probs", () => ({ ids: [cache.marketId] }), "object");
  runLiveTest("manifold_get_market_positions", () => ({ marketId: cache.marketId }), "array");
  runLiveTest("manifold_get_user", () => ({ username: cache.username }), "object");
  runLiveTest("manifold_get_user_lite", () => ({ username: cache.username }), "object");
  runLiveTest("manifold_get_user_by_id", () => ({ id: cache.userId }), "object");
  runLiveTest("manifold_get_user_by_id_lite", () => ({ id: cache.userId }), "object");
  runLiveTest("manifold_list_users", () => ({}), "array");
  runLiveTest("manifold_get_bets", () => ({ limit: 1 }), "array");
  runLiveTest("manifold_get_comments", () => ({ contractId: cache.marketId }), "array");
  runLiveTest("manifold_get_groups", () => ({ limit: 1 }), "array");
  runLiveTest("manifold_get_group", () => ({ slug: "technology" }), "object");
  runLiveTest("manifold_get_group_by_id", () => ({ id: cache.groupId }), "object");
  runLiveTest("manifold_get_leagues", () => ({ cohort: "all", season: 2025 }), "array");
  runLiveTest("manifold_get_boost_history", () => ({ limit: 1 }), "object");
});

// ── Authenticated read tools (require API key) ─────────────────────

describe("live API — authenticated read tools", () => {
  beforeAll(async () => {
    if (!process.env.MANIFOLD_API_KEY) return;
    await discoverUser();
  }, 10000);

  function runAuthedTest(
    toolName: string,
    makeArgs: (user: { userId: string }) => Record<string, unknown>,
    shape: "array" | "object" | "prob" = "object",
  ): void {
    it.skipIf(!process.env.MANIFOLD_API_KEY)(toolName, async () => {
      const tool = mcpTools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      if (!tool) return;

      if (!cache.userId) {
        throw new Error(`Discovery failed for ${toolName}: no user found`);
      }

      const args = makeArgs({ userId: cache.userId });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const result = await tool.execute(
          args,
          { apiKey: process.env.MANIFOLD_API_KEY },
          { signal: controller.signal, toolCallId: "" },
        );
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        if (shape === "array") {
          expect(Array.isArray(result)).toBe(true);
        } else {
          expect(typeof result).toBe("object");
          expect(Array.isArray(result)).toBe(false);
        }
      } finally {
        clearTimeout(timeout);
      }
    }, 30000);
  }

  runAuthedTest("manifold_get_me", () => ({}));
  runAuthedTest("manifold_get_portfolio", (u) => ({ userId: u.userId }));
  runAuthedTest("manifold_get_portfolio_history", (u) => ({ userId: u.userId, period: "allTime" }), "array");
  runAuthedTest("manifold_get_contract_metrics", (u) => ({ userId: u.userId, limit: 1 }));

  // get_transactions needs fromId scoped to the authenticated user (not the
  // random user from discoverUser) to avoid a slow unbounded global query.
  it.skipIf(!process.env.MANIFOLD_API_KEY)("manifold_get_transactions", async () => {
    const tool = mcpTools.find((t) => t.name === "manifold_get_transactions");
    expect(tool).toBeDefined();
    if (!tool) return;

    // Discover the authenticated user's ID via get_me if not cached
    if (!cache.authedUserId) {
      const meTool = mcpTools.find((t) => t.name === "manifold_get_me");
      expect(meTool).toBeDefined();
      if (!meTool) return;
      const meResult = await meTool.execute({}, { apiKey: process.env.MANIFOLD_API_KEY }, { signal: undefined, toolCallId: "" });
      cache.authedUserId = (meResult as Record<string, unknown>).id as string;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const result = await tool.execute(
        { fromId: cache.authedUserId, limit: 1 },
        { apiKey: process.env.MANIFOLD_API_KEY },
        { signal: controller.signal, toolCallId: "" },
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    } finally {
      clearTimeout(timeout);
    }
  }, 30000);
});

// ── Error shape tests (FR-021, SC-008) ────────────────────────────

describe("error shape", () => {
  it("404 for unknown market throws error", async () => {
    const tool = mcpTools.find((t) => t.name === "manifold_get_market");
    expect(tool).toBeDefined();
    if (!tool) return;

    await expect(
      tool.execute(
        { marketId: "nonexistent-market-id-xyz-123" },
        { apiKey: process.env.MANIFOLD_API_KEY },
        { signal: undefined, toolCallId: "" },
      ),
    ).rejects.toThrow();
  });
  it("401 for authed tools without API key surfaces auth error", async () => {
    const tool = mcpTools.find((t) => t.name === "manifold_get_me");
    expect(tool).toBeDefined();
    if (!tool) return;

    // Single call: asserts the promise rejects AND the error has the auth
    // category + 401 status. toMatchObject matches own enumerable props set
    // by the ManifoldError constructor (category, status).
    await expect(
      tool.execute(
        {},
        { apiKey: undefined },
        { signal: undefined, toolCallId: "" },
      ),
    ).rejects.toMatchObject({ category: "auth", status: 401 });
  });
});

// ── Write tools — existence checks (SC-002) ───────────────────────

describe("write tools", () => {
  const writeTools = [
    "manifold_place_bet",
    "manifold_place_multi_bet",
    "manifold_cancel_bet",
    "manifold_create_market",
    "manifold_resolve_market",
    "manifold_sell_shares",
    "manifold_close_market",
    "manifold_add_liquidity",
    "manifold_add_answer",
    "manifold_market_group",
    "manifold_rebalance",
    "manifold_add_bounty",
    "manifold_award_bounty",
    "manifold_send_mana",
    "manifold_create_comment",
  ];

  for (const toolName of writeTools) {
    it(`exists: ${toolName}`, () => {
      const tool = mcpTools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
    });
  }
});

// ── Write tools — live integration tests (opt-in) ─────────────────
// Set MANIFOLD_RUN_WRITE_TESTS=1 to run these. Uses a pre-created public
// BINARY test market owned by the API-key user (qPIlzUsCnP). The market
// stays up indefinitely — no afterAll cleanup. Default cost is ~M$3
// (M$1 bet + M$1 comment + M$1 liquidity), partially recovered by selling.
// With MANIFOLD_API_KEY2 set, add M$10 for send_mana. cancel_bet,
// market_group, and close_market are net-zero.

describe.skipIf(!process.env.MANIFOLD_RUN_WRITE_TESTS)("live API — write tools (opt-in)", () => {
  // Uses a single pre-created test market owned by the API-key user.
  // The market is public (unlisted requires identity verification on
  // Manifold's side) and stays up indefinitely.
  // Override with MANIFOLD_TEST_MARKET_ID if needed.
  const testMarketId = process.env.MANIFOLD_TEST_MARKET_ID || "qPIlzUsCnP";
  const apiKey = process.env.MANIFOLD_API_KEY;

  function findTool(name: string) {
    const tool = mcpTools.find((t) => t.name === name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool;
  }

  function makeAbort(ms = 25000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    return {
      signal: controller.signal,
      cleanup: () => clearTimeout(timeout),
    };
  }

  beforeAll(() => {
    if (!apiKey) throw new Error("MANIFOLD_API_KEY not set — cannot run write tests");
    if (!testMarketId) throw new Error("MANIFOLD_TEST_MARKET_ID not set");
  });

  // 1. Place a bet (real, not dryRun) — costs M$1, gives us YES shares to sell
  it("manifold_place_bet places a bet and returns a bet object", async () => {
    const tool = findTool("manifold_place_bet");
    const { signal, cleanup } = makeAbort();
    try {
      const result = await tool.execute(
        { contractId: testMarketId, outcome: "YES", amount: 1 },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(result).toBeDefined();
      const bet = result as Record<string, unknown>;
      expect(bet.amount).toBe(1);
      expect(typeof bet.shares).toBe("number");
      expect(bet.outcome).toBe("YES");
      expect(bet.betId).toBeDefined();
    } finally {
      cleanup();
    }
  }, 30000);

  // 2. Place a bet with dryRun=true — zero cost, no state change
  it("manifold_place_bet (dryRun) returns a simulated bet without spending mana", async () => {
    const tool = findTool("manifold_place_bet");
    const { signal, cleanup } = makeAbort();
    try {
      const result = await tool.execute(
        { contractId: testMarketId, outcome: "NO", amount: 1, dryRun: true },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(result).toBeDefined();
      const bet = result as Record<string, unknown>;
      expect(bet.amount).toBe(1);
      expect(typeof bet.shares).toBe("number");
      expect(bet.outcome).toBe("NO");
    } finally {
      cleanup();
    }
  }, 30000);

  // 3. Create a comment on our own market — costs M$1
  it("manifold_create_comment creates a comment on the disposable market", async () => {
    const tool = findTool("manifold_create_comment");
    const { signal, cleanup } = makeAbort();
    try {
      const result = await tool.execute(
        { contractId: testMarketId, markdown: "Test comment on disposable market." },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(result).toBeDefined();
      const comment = result as Record<string, unknown>;
      expect(comment.id).toBeDefined();
      expect(typeof comment.id).toBe("string");
      expect(comment.userId).toBeDefined();
    } finally {
      cleanup();
    }
  }, 30000);

  // 4. Add liquidity to our own market — costs M$1
  it("manifold_add_liquidity adds liquidity and returns a provision", async () => {
    const tool = findTool("manifold_add_liquidity");
    const { signal, cleanup } = makeAbort();
    try {
      const result = await tool.execute(
        { contractId: testMarketId, amount: 1 },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(result).toBeDefined();
      const liq = result as Record<string, unknown>;
      expect(liq.userId).toBeDefined();
    } finally {
      cleanup();
    }
  }, 30000);

  // 5. Sell the YES shares we acquired in test #1 — recovers mana
  it("manifold_sell_shares sells YES shares back to mana", async () => {
    const tool = findTool("manifold_sell_shares");
    const { signal, cleanup } = makeAbort();
    try {
      const result = await tool.execute(
        { contractId: testMarketId, outcome: "YES" },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(result).toBeDefined();
      // Sell returns a CandidateBet & { betId: string } — a bet-like
      // object with amount, shares, outcome, betId. No status field.
      const sale = result as Record<string, unknown>;
      expect(sale.betId).toBeDefined();
      expect(sale.outcome).toBe("YES");
    } finally {
      cleanup();
    }
  }, 30000);

  // 6. Cancel an unfilled limit order — net M$0 (mana refunded)
  it("manifold_cancel_bet cancels an unfilled limit order", async () => {
    const betTool = findTool("manifold_place_bet");
    const cancelTool = findTool("manifold_cancel_bet");
    const { signal, cleanup } = makeAbort();
    try {
      // Place a limit order at 0.01 — won't fill at current prob ~0.5
      const betResult = await betTool.execute(
        { contractId: testMarketId, outcome: "YES", amount: 1, limitProb: 0.01 },
        { apiKey },
        { signal, toolCallId: "" },
      );
      const bet = betResult as Record<string, unknown>;
      const betId = bet.betId as string;
      expect(betId).toBeDefined();

      // Cancel it — bet/cancel returns a LimitBet with isCancelled: true
      const cancelResult = await cancelTool.execute(
        { betId },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(cancelResult).toBeDefined();
      const cancelled = cancelResult as Record<string, unknown>;
      expect(cancelled.isCancelled).toBe(true);
    } finally {
      cleanup();
    }
  }, 30000);

  // 7. Tag and untag the test market with a group — M$0, fully reversible
  it("manifold_market_group tags and untags the test market", async (ctx) => {
    const tool = findTool("manifold_market_group");
    const { signal, cleanup } = makeAbort();
    try {
      // Discover a group to tag with
      const groupsTool = findTool("manifold_get_groups");
      const groupsResult = await groupsTool.execute(
        { limit: 1 },
        { apiKey },
        { signal, toolCallId: "" },
      );
      const groupId = firstId(groupsResult);
      if (!groupId) {
        ctx.skip(true, "No group discovered");
        return;
      }

      // Tag — market/:contractId/group returns { success: true }
      const tagResult = await tool.execute(
        { contractId: testMarketId, groupId, remove: false },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(tagResult).toEqual({ success: true });

      // Untag
      const untagResult = await tool.execute(
        { contractId: testMarketId, groupId, remove: true },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(untagResult).toEqual({ success: true });
    } finally {
      cleanup();
    }
  }, 30000);

  // 8. Update the close time to 2 years out — M$0, doesn't close the market
  it("manifold_close_market updates the close time", async () => {
    const tool = findTool("manifold_close_market");
    const { signal, cleanup } = makeAbort();
    try {
      const newCloseTime = Date.now() + 2 * 365 * 24 * 60 * 60 * 1000;
      const result = await tool.execute(
        { contractId: testMarketId, closeTime: newCloseTime },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(result).toEqual({ success: true });
    } finally {
      cleanup();
    }
  }, 30000);

  // 9. Send M$10 to the second account — recoverable since both accounts are owned
  // by the same user. Requires MANIFOLD_API_KEY2 (second account) to discover the
  // recipient ID. Upstream returns { success: true } (endpoint.ts falls back when
  // the handler returns undefined).
  it("manifold_send_mana sends mana to another account", async (ctx) => {
    const apiKey2 = process.env.MANIFOLD_API_KEY2;
    if (!apiKey2) {
      ctx.skip(true, "MANIFOLD_API_KEY2 not set");
      return;
    }
    const tool = findTool("manifold_send_mana");
    const meTool = findTool("manifold_get_me");
    const { signal, cleanup } = makeAbort();
    try {
      // Discover the second account's user ID
      const meResult = await meTool.execute(
        {},
        { apiKey: apiKey2 },
        { signal, toolCallId: "" },
      );
      const recipientId = (meResult as Record<string, unknown>).id as string;
      expect(recipientId).toBeDefined();

      // Send M$10 from primary account to second account
      // (M$10 is the non-admin minimum)
      const result = await tool.execute(
        { toIds: [recipientId], amount: 10, message: "API integration test transfer" },
        { apiKey },
        { signal, toolCallId: "" },
      );
      expect(result).toEqual({ success: true });
    } finally {
      cleanup();
    }
  }, 30000);
});
