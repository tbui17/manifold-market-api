# Research: Manifold Markets API Plugin & MCP Server

**Phase**: 0 (Outline & Research) | **Date**: 2026-06-20 | **Plan**: [plan.md](./plan.md)

## Research Approach

No NEEDS CLARIFICATION unknowns were extracted from Technical Context — the spec, the ratified constitution, and `HANDOFF.md` (the prior-session research document) already ground every technical decision. This file consolidates the locked decisions and their rationale as the research output, in lieu of dispatched research agents. Where a decision originated in a spec clarification, the clarification Q-number is cited.

## Locked Decisions

### D1: Shared HTTP client as the sole platform-agnostic core

**Decision**: A single `src/api-client.ts` module owns all HTTP concerns (base URL, `Authorization: Key` header, uniform error wrapping, abort-signal propagation, verbatim passthrough). Both `src/index.ts` (OpenClaw) and `src/mcp-server.ts` (MCP) consume it and contain no business logic.

**Rationale**: Constitution Principle V (Platform Parity) mandates this. SC-005 requires equivalent behavior across plugin and MCP server; a shared client guarantees it by construction. Avoids divergence bugs.

**Alternatives considered**:
- Separate HTTP code per entry point — rejected: violates Principle V, doubles maintenance, risks behavioral drift.
- Inline fetch calls in each tool — rejected: scatters HTTP concerns, no uniform error shape (violates FR-021).

### D2: Uniform error shape (FR-021)

**Decision**: All errors — upstream non-2xx, missing/invalid key (surfaced as upstream 401), network failure, timeout, parameter validation — use one shape: `{ category: "upstream"|"auth"|"network"|"timeout"|"validation", message: string, status?: number, body?: string }`.

**Rationale**: Spec §Clarifications Q1 (user-selected Option A). Makes every "clear error" occurrence objectively testable (resolves checklist CHK017). Gives the host/LLM consistent error parsing. Aligns with thin-wrapper principle: errors are thrown, not response-body mutations.

**Alternatives considered**:
- Extend "status + body" to missing-key/network only, leave validation as schema rejection — rejected: inconsistent error surface, harder to test.
- Keep "clear error" subjective — rejected: untestable, fails SC-008.

### D3: Rely on upstream 401 for auth gating (no per-tool auth metadata)

**Decision**: Authenticated tools send the request with whatever key is configured (none if absent) and surface the resulting upstream 401 as an `auth`-category error. The integration maintains NO per-tool auth-required flag table and does NOT pre-check for a key before the HTTP call.

**Rationale**: Spec §Clarifications Q3 (user-selected Option B, explicit rationale: "small dev team cannot maintain per-tool auth-required metadata"). Keeps the shared client endpoint-agnostic (Principle V). Still satisfies the security outcome — no unauthenticated success on protected endpoints — via the upstream 401 surfaced per FR-021. Simplifies the client to two functions (`manifoldGet`, `manifoldPost`) with no auth-awareness.

**Constitution tension (documented in plan §Complexity Tracking)**: Constitution §Security lines 85–87 say "validate key present before auth call." This deviation is justified by the user's explicit Q3 clarification and the small-team maintenance rationale. The security *outcome* is preserved; only the *mechanism* differs (upstream enforcement vs. client pre-check).

**Alternatives considered**:
- Fail-fast pre-check per tool (Option A) — rejected: requires maintaining auth-required metadata for ~30 endpoints that drifts as the alpha API changes.
- Hybrid: fail-fast for writes, rely-on-upstream for authed-reads (Option C) — rejected: adds complexity without reducing the metadata burden meaningfully.

### D4: Zero response transformation (verbatim passthrough)

**Decision**: The client passes upstream response bodies to the caller verbatim with no transformation — no probability-to-percentage conversion, no field renaming, no filtering.

**Rationale**: Spec §Clarifications Q4 (user-selected Option C). Fully resolves the FR-003 "zero business logic" tension (checklist CHK034/CHK007). Removes the only exception clause in the thin-wrapper principle. Keeps the client trivially simple: `return res.json()`.

**Alternatives considered**:
- Format primary `probability` field only (Option B, matching Manifold's reference `chancifyUltraLiteMarket`) — rejected: user chose verbatim; any field-walking is business logic the team declined to maintain.
- Format all probability-like fields (Option A) — rejected: requires response-body introspection, violates Principle III.

### D5: TypeBox for all schemas (constitution-mandated, not a choice)

**Decision**: All tool parameter schemas and the plugin config schema use TypeBox constructors exclusively.

**Rationale**: Constitution Principle II is a hard SDK constraint — OpenClaw performs static analysis on compiled TypeBox output to generate `openclaw.plugin.json`. This is not a research finding; it is a non-negotiable constraint. `typebox: ^1.1.38` is already scaffolded.

### D6: Tool grouping by domain under `src/tools/`

**Decision**: ~30 tool definitions are split into domain modules: `markets.ts`, `users.ts`, `activity.ts`, `groups.ts`, `misc-read.ts`, `authed-read.ts`, `write.ts`. A `tool-builder.ts` helper maps each declarative tool spec (name, method, path, params, apiKey-source) to a TypeBox-schema tool wired to `api-client`.

**Rationale**: ~30 tools in a single `index.ts` is unreadable and unmaintainable. Domain grouping matches the spec's user-story structure (US1 markets, US2 users/activity/groups, US3 authed actions). The helper keeps tool modules declarative (just data + schema) and centralizes the execute→client wiring, so `index.ts` stays a thin aggregator.

**Alternatives considered**:
- One tool per file (~30 files) — rejected: excessive file count for thin definitions; domain grouping is coarser but more navigable.
- All tools inline in `index.ts` — rejected: ~800+ line file, poor maintainability.

### D7: MCP server over stdio, API key from `MANIFOLD_API_KEY` env var

**Decision**: `src/mcp-server.ts` uses `@modelcontextprotocol/sdk` `Server` + `StdioServerTransport`, reads the API key from `process.env.MANIFOLD_API_KEY`, and delegates `tools/list` + `tools/call` to the same tool inventory as the plugin.

**Rationale**: Spec FR-002, FR-007, US4. HANDOFF.md §6 documents the exact SDK pattern. stdio is the only transport in scope (Assumptions). Env-var channel keeps the MCP server credential handling parallel to the plugin's config-field channel.

## External Dependencies (validated)

| Dependency | Version | Source | Status |
|---|---|---|---|
| `typebox` | `^1.1.38` | scaffolded in `package.json` | Pinned, known-good |
| `openclaw` (peer) | `>=2026.5.17` | scaffolded | Broad range per constitution |
| `typescript` | `^5.9.0` | scaffolded | Per constitution §Tech Stack |
| `vitest` | `^3.2.0` | scaffolded | Per constitution §Tech Stack |
| `@modelcontextprotocol/sdk` | latest | to add | Per HANDOFF.md §6; pin to known-good on install |
| Manifold REST API | alpha, `https://api.manifold.markets/v0/` | HANDOFF.md §3 | Pinned to current public contract; updates required if upstream changes (Assumptions) |

## Reference Sources

- Manifold API docs: https://docs.manifold.markets/api
- Manifold schema source: https://github.com/manifoldmarkets/manifold/blob/main/common/src/api/schema.ts
- Manifold existing MCP server (reference for patterns): https://github.com/manifoldmarkets/manifold/blob/main/backend/api/src/mcp.ts
- OpenClaw tool plugins docs: https://docs.openclaw.ai/plugins/tool-plugins
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Prior-session research: `HANDOFF.md` (repo root)
