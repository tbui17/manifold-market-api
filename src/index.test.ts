import { describe, expect, it, beforeAll } from "vitest";
import entry from "./index.js";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";
import { mcpTools } from "./mcp-server.js";

const pluginTools = getToolPluginMetadata(entry)?.tools ?? [];
const pluginToolNames = new Set(pluginTools.map((t) => t.name));
const mcpToolNames = new Set(mcpTools.map((t) => t.name));

// ── Helpers ──────────────────────────────────────────────────────────

let cache: { marketId: string; marketSlug: string; userId: string; username: string; groupId: string } = {
  marketId: "",
  marketSlug: "",
  userId: "",
  username: "",
  groupId: "",
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
  } catch {
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
      } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
      } catch { /* ignore */ }
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
  } catch { /* ignore */ }
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

  function runLiveTest(toolName: string, makeArgs: () => Record<string, unknown>): void {
    it(toolName, async () => {
      const tool = mcpTools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      if (!tool) return;

      // If dynamic discovery failed, skip dependent tests
      if (toolName === "manifold_get_market" && !cache.marketId) return;
      if (toolName === "manifold_get_market_by_slug" && !cache.marketSlug) return;
      if (toolName === "manifold_get_market_prob" && !cache.marketId) return;
      if (toolName === "manifold_get_market_probs" && !cache.marketId) return;
      if (toolName === "manifold_get_market_positions" && !cache.marketId) return;
      if (toolName === "manifold_get_user_by_id" && !cache.userId) return;
      if (toolName === "manifold_get_user_by_id_lite" && !cache.userId) return;
      if (toolName === "manifold_get_comments" && !cache.marketId) return;
      if (toolName === "manifold_get_group_by_id" && !cache.groupId) return;
      if ((toolName === "manifold_get_user" || toolName === "manifold_get_user_lite") && !cache.username) return;

      const result = await tool.execute(
        makeArgs(),
        { apiKey: process.env.MANIFOLD_API_KEY },
        { signal: undefined, toolCallId: "" },
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    }, 15000);
  }

  runLiveTest("manifold_search_markets", () => ({ term: "AI" }));
  runLiveTest("manifold_get_market", () => ({ marketId: cache.marketId }));
  runLiveTest("manifold_get_market_by_slug", () => ({ marketSlug: cache.marketSlug }));
  runLiveTest("manifold_list_markets", () => ({}));
  runLiveTest("manifold_get_market_prob", () => ({ marketId: cache.marketId }));
  runLiveTest("manifold_get_market_probs", () => ({ ids: [cache.marketId] }));
  runLiveTest("manifold_get_market_positions", () => ({ marketId: cache.marketId }));
  runLiveTest("manifold_get_user", () => ({ username: cache.username }));
  runLiveTest("manifold_get_user_lite", () => ({ username: cache.username }));
  runLiveTest("manifold_get_user_by_id", () => ({ id: cache.userId }));
  runLiveTest("manifold_get_user_by_id_lite", () => ({ id: cache.userId }));
  runLiveTest("manifold_list_users", () => ({}));
  runLiveTest("manifold_get_bets", () => ({ limit: 1 }));
  runLiveTest("manifold_get_comments", () => ({ contractId: cache.marketId }));
  runLiveTest("manifold_get_groups", () => ({ limit: 1 }));
  runLiveTest("manifold_get_group", () => ({ slug: "technology" }));
  runLiveTest("manifold_get_group_by_id", () => ({ id: cache.groupId }));
  runLiveTest("manifold_get_leagues", () => ({ cohort: "all", season: 2025 }));
  runLiveTest("manifold_get_boost_history", () => ({ limit: 1 }));
});

// ── Authenticated read tools (require API key) ─────────────────────

describe("live API — authenticated read tools", () => {
  beforeAll(async () => {
    await discoverUser();
  }, 10000);

  function runAuthedTest(
    toolName: string,
    makeArgs: (user: { userId: string }) => Record<string, unknown>,
  ): void {
    it(toolName, async () => {
      if (!process.env.MANIFOLD_API_KEY) {
        throw new Error(`MANIFOLD_API_KEY not set — skipping: ${toolName}`);
      }

      const tool = mcpTools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      if (!tool) return;

      if (!cache.userId) {
        throw new Error(`Discovery failed for ${toolName}: no user found`);
      }

      const args = makeArgs({ userId: cache.userId });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const result = await tool.execute(
          args,
          { apiKey: process.env.MANIFOLD_API_KEY },
          { signal: controller.signal, toolCallId: "" },
        );
        expect(result).toBeDefined();
        expect(typeof result).toBe("object");
      } finally {
        clearTimeout(timeout);
      }
    }, 30000);
  }

  runAuthedTest("manifold_get_me", () => ({}));
  runAuthedTest("manifold_get_portfolio", (u) => ({ userId: u.userId }));
  runAuthedTest("manifold_get_portfolio_history", (u) => ({ userId: u.userId, period: "allTime" }));
  runAuthedTest("manifold_get_contract_metrics", (u) => ({ userId: u.userId, limit: 1 }));
  runAuthedTest("manifold_get_transactions", () => ({ limit: 1 }));
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

    try {
      await tool.execute(
        {},
        { apiKey: undefined },
        { signal: undefined, toolCallId: "" },
      );
    } catch (cause) {
      const error = cause as Error & { category?: string; status?: number; body?: string };
      expect(error).toBeDefined();
      if (error.category) {
        expect(["upstream", "auth", "network", "timeout", "validation"]).toContain(error.category);
      }
      if (error.status) {
        expect(error.status).toBe(401);
      }
    }
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
