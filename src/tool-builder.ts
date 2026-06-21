/**
 * Tool builder helpers — map declarative tool specs to OpenClaw tool definitions
 * wired to the shared api-client. Centralizes execute→client wiring so tool
 * modules stay declarative. Handles abort-signal passthrough (FR-011).
 *
 * Per FR-003: verbatim passthrough. Per FR-006/Q3: no auth pre-check.
 */

import { Type, type TSchema, type Static } from "typebox";
import { manifoldGet, manifoldPost } from "./api-client.js";
import type { ToolPluginExecutionContext, ToolPluginToolDefinition } from "openclaw/plugin-sdk/tool-plugin";

export type PluginConfig = { apiKey?: string };

/**
 * Compatible type for the OpenClaw `tool()` factory passed to the `tools` callback.
 * Tool modules use this as their parameter type for `createXxxTools(tool)`.
 * The SDK's generic factory is assignable to this permissive type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolFactory = (def: any) => any;

/** Config schema for the plugin (FR-007). */
export const configSchema = Type.Object({
  apiKey: Type.Optional(
    Type.String({
      description:
        "Manifold Markets API key for authenticated endpoints. Obtain from your Manifold profile → edit → refresh API key.",
    }),
  ),
});

/**
 * Create a GET tool definition wired to manifoldGet.
 * @param path - API path after /v0/, or a function that builds it from params
 * @param query - Optional function to extract query params from the tool params
 */
export function makeGetTool<T extends TSchema>(
  name: string,
  description: string,
  parameters: T,
  path: string | ((p: Static<T>) => string),
  query?: (p: Static<T>) => Record<string, unknown>,
) {
  return {
    name,
    description,
    parameters,
    execute: async (
      params: Static<T>,
      config: PluginConfig,
      ctx: ToolPluginExecutionContext,
    ) => {
      ctx.signal?.throwIfAborted();
      const resolvedPath = typeof path === "function" ? path(params) : path;
      return manifoldGet(
        resolvedPath,
        query?.(params),
        config.apiKey,
        ctx.signal,
      );
    },
  };
}

/**
 * Create a POST tool definition wired to manifoldPost.
 * @param path - API path after /v0/, or a function that builds it from params
 * @param body - Optional function to build the request body from params.
 *               If omitted, params is sent as the body directly.
 */
export function makePostTool<T extends TSchema>(
  name: string,
  description: string,
  parameters: T,
  path: string | ((p: Static<T>) => string),
  body?: (p: Static<T>) => Record<string, unknown>,
) {
  return {
    name,
    description,
    parameters,
    execute: async (
      params: Static<T>,
      config: PluginConfig,
      ctx: ToolPluginExecutionContext,
    ) => {
      ctx.signal?.throwIfAborted();
      const resolvedPath = typeof path === "function" ? path(params) : path;
      return manifoldPost(
        resolvedPath,
        body ? body(params) : (params as unknown as Record<string, unknown>),
        config.apiKey,
        ctx.signal,
      );
    },
  };
}
