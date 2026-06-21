import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { configSchema, type ToolFactory } from "./tool-builder.js";
import { createMarketTools } from "./tools/markets.js";
import { createUserTools } from "./tools/users.js";
import { createActivityTools } from "./tools/activity.js";
import { createGroupTools } from "./tools/groups.js";
import { createMiscReadTools } from "./tools/misc-read.js";
import { createAuthedReadTools } from "./tools/authed-read.js";
import { createWriteTools } from "./tools/write.js";

export default defineToolPlugin({
  id: "manifold-markets",
  name: "Manifold Markets",
  description:
    "Query and act on Manifold Markets prediction markets — search markets, fetch users, place bets, manage positions, and more.",
  configSchema,
  tools: (tool: ToolFactory) => [
    ...createMarketTools(tool),
    ...createUserTools(tool),
    ...createActivityTools(tool),
    ...createGroupTools(tool),
    ...createMiscReadTools(tool),
    ...createAuthedReadTools(tool),
    ...createWriteTools(tool),
  ],
});
