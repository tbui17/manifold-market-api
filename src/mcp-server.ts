/**
 * Standalone MCP server over stdio exposing the full Manifold Markets toolset.
 *
 * Thin wiring only — all HTTP concerns live in the shared api-client.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { createMarketTools } from "./tools/markets.js";
import { createUserTools } from "./tools/users.js";
import { createActivityTools } from "./tools/activity.js";
import { createGroupTools } from "./tools/groups.js";
import { createMiscReadTools } from "./tools/misc-read.js";
import { createAuthedReadTools } from "./tools/authed-read.js";
import { createWriteTools } from "./tools/write.js";
import type { ToolFactory } from "./tool-builder.js";

// ── Collect tool definitions (exported for parity tests) ─────────────

export interface McpTool {
  name: string;
  description: string;
  parameters: unknown;
  execute: (
    params: unknown,
    config: { apiKey?: string },
    ctx: { signal?: AbortSignal | undefined; toolCallId: string },
  ) => Promise<unknown>;
}

export const mcpTools: McpTool[] = [];
const collectorFactory: ToolFactory = (def) => {
  mcpTools.push(def);
  return def;
};

createMarketTools(collectorFactory);
createUserTools(collectorFactory);
createActivityTools(collectorFactory);
createGroupTools(collectorFactory);
createMiscReadTools(collectorFactory);
createAuthedReadTools(collectorFactory);
createWriteTools(collectorFactory);

// ── MCP server setup ──────────────────────────────────────────────────

const server = new Server(
  { name: "manifold-markets", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// tools/list — return the full 40-tool inventory
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
    })),
  };
});

// tools/call — execute the requested tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = mcpTools.find((t) => t.name === name);
  if (!tool) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true,
    };
  }

  try {
    const result = await tool.execute(
      args ?? {},
      { apiKey: process.env.MANIFOLD_API_KEY },
      { signal: undefined, toolCallId: "" },
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (cause) {
    const error = cause as Error;
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────

// Only boot the stdio server when this file IS the entry point
// (i.e. run via `node dist/mcp-server.js` or `npm run mcp:start`).
// When imported by tests or other modules, skip startup.
if (import.meta.url === `file://${process.argv[1]}`) {
  const transport = new StdioServerTransport();
  server.connect(transport).catch(console.error);
}
