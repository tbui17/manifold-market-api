<!--
Sync Impact Report
══════════════════
Version change:  N/A → 1.0.0 (initial ratification)
Modified principles: N/A (first adoption)
Added sections: Core Principles (5), Technology Stack, Security Requirements,
  Development Workflow, Governance
Removed sections: N/A
Templates requiring updates: ✅ plan-template.md (Constitution Check section),
  ✅ spec-template.md (no conflicts), ✅ tasks-template.md (no conflicts)
Follow-up TODOs: none
-->

# Manifold Markets API Constitution

## Core Principles

### I. API Fidelity

Tool definitions MUST accurately mirror the Manifold Markets REST API
at `https://api.manifold.markets/v0/`. Parameter schemas must match
the upstream endpoint contracts. Only `visibility: 'public'` endpoints
MAY be exposed. All tool names MUST use the `manifold_` prefix to
prevent collisions with other plugins.

When the upstream API changes, the plugin MUST be updated to reflect
the change within a reasonable timeframe — no stale endpoint
definitions in shipped tools.

### II. TypeBox-Only Schemas

All tool parameter and config schemas MUST use TypeBox constructors.
Zod, raw JSON Schema objects, or other schema libraries are
PROHIBITED. This is a hard SDK constraint: OpenClaw performs static
analysis on compiled TypeBox output to generate manifests. Mixing
schema libraries will break the build pipeline.

### III. Thin Wrapper, Zero Business Logic

Each tool is a thin HTTP client wrapper around one REST endpoint.
Response bodies MUST NOT be filtered, reinterpreted, or mutated
unless the sole purpose is human-readable formatting for LLM
consumption (e.g., probability-to-percentage conversion). No
aggregation, no derived state, no client-side caching beyond what
the HTTP layer provides.

### IV. Testable Contracts

Every tool MUST be independently testable against the live Manifold
API using a valid API key. Tests verify that: tool names declared in
source match the `contracts.tools` array in `openclaw.plugin.json`;
parameter schemas pass TypeBox validation; and execute functions
return the expected shape. Tests that require authentication MUST be
clearly separated from public-read tests.

### V. Platform Parity

The shared API client layer (`src/api-client.ts`) MUST be
platform-agnostic — importable by both the OpenClaw plugin
(`src/index.ts`) and the standalone MCP server (`src/mcp-server.ts`).
No OpenClaw-specific or MCP-specific code in the client layer.
Platform-specific entry points MUST NOT contain business logic; they
thinly wire the shared client to their respective transport.

## Technology Stack

- **Language**: TypeScript 5.9+
- **Schema library**: TypeBox 1.x (no alternatives)
- **Test framework**: Vitest 3.x
- **Plugin SDK**: `openclaw/plugin-sdk` 2026.5.17+
- **MCP SDK**: `@modelcontextprotocol/sdk` (latest)
- **Build**: `tsc` → `openclaw plugins build`
- **Package manager**: npm
- **Target platform**: Node.js (LTS)

All dependencies MUST be pinned to known-good versions. Peer
dependency ranges MAY be broad (e.g., `>=2026.5.17`).

## Security Requirements

- API keys MUST be transmitted only over HTTPS to
  `api.manifold.markets`.
- API keys MUST NOT be logged, committed, or embedded in source
  code. They flow through config or environment variables only.
- The plugin MUST validate that an API key is present before
  attempting any authenticated endpoint call, returning a clear
  error rather than an unhandled failure.
- Only `GET` endpoints that require no auth MAY be called without
  a key. All `POST`/`DELETE` endpoints MUST require one.

## Development Workflow

1. **Build gate**: `npm run plugin:validate` MUST pass before any
   merge. This runs `tsc` + `openclaw plugins build` + manifest
   validation.
2. **Test gate**: `npm test` MUST pass with zero failures. New tools
   MUST have corresponding test coverage.
3. **Manifest sync**: Every tool name in source MUST appear in
   `contracts.tools` in `openclaw.plugin.json`. The build validator
   enforces this, but authors SHOULD verify before pushing.
4. **Endpoint coverage**: When adding new tools, the HANDOFF.md
   endpoint table SHOULD be updated to reflect what's been
   implemented.

## Governance

This constitution supersedes all other development practices for this
repository. Amendments require:

1. Written proposal describing the change and rationale.
2. Version bump per semver: MAJOR for principle removal or
   redefinition, MINOR for new principles or material expansion,
   PATCH for wording and clarifications.
3. Propagation check: dependent templates
   (`.specify/templates/*.md`) MUST be reviewed for conflicts
   after any amendment.
4. All PRs and code reviews MUST verify compliance with the active
   principles. A principle violation without explicit justification
   and complexity tracking is grounds for rejection.

Use `HANDOFF.md` for runtime development guidance — the constitution
defines *what* must hold; the handoff defines *how*.

**Version**: 1.0.0 | **Ratified**: 2026-06-20 | **Last Amended**: 2026-06-20
