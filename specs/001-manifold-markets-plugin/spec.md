# Feature Specification: Manifold Markets API Plugin & MCP Server

**Feature Branch**: `001-manifold-markets-plugin`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "Build a Manifold Markets API integration that ships as (1) an OpenClaw tool plugin installable via `openclaw plugins install npm:<package>` and (2) a standalone MCP server usable by any MCP-compatible client. Both artifacts wrap the Manifold Markets REST API at `https://api.manifold.markets/v0/`, exposing ~30 public endpoints as individual tools covering markets, users, groups, bets, comments, transactions, leagues, boosts, and authenticated write actions (betting, market creation, resolution, transfers)."

## Clarifications

### Session 2026-06-20

- Q: How should the "clear error" contract be specified across all error types (missing key, network, timeout, parameter validation, upstream non-2xx)? → A: Define a uniform error shape for all error types: error category (upstream/auth/network/validation), human-readable message, and upstream HTTP status + body when applicable.
- Q: What selection criterion defines which read-only endpoints count as "representative read-only calls" for SC-010/FR-020? → A: All ~16 read-only endpoints are fully exercised against the live API (no sampling); the suite covers every public read-only tool, with auth-required tests clearly separated.
- Q: When should the missing-API-key error be raised for authenticated tools — fail-fast before the HTTP call, or by relying on the upstream 401? → A: Rely on upstream: send the request (with or without a key) and surface the resulting 401 as an auth-category error per FR-012/FR-021. Rationale: small dev team cannot maintain per-tool auth-required metadata.
- Q: What is the scope of human-readable probability formatting, and is it default or opt-in? → A: No formatting at all — pass through all responses verbatim. Remove the FR-003 exception clause; the integration performs zero response transformation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse & Discover Markets (Priority: P1)

A user wants to explore the Manifold Markets prediction-market platform from within their AI assistant or IDE. They ask their assistant to search for markets about a topic, look up a specific market by slug or ID, and read its current probability, answers, and positions/leaderboard. No account or API key is required for any of this — the user is performing read-only discovery of public market data.

**Why this priority**: Read-only market discovery is the most common, lowest-risk interaction with the platform. It delivers immediate value to every user (even those without a Manifold account), requires no credentials, and exercises the largest share of public endpoints. It forms the foundation on which all other stories build.

**Independent Test**: Can be fully tested by searching markets with a term, fetching one returned market by ID, and reading its probability — all without credentials, against the live public API. Delivers value: the user can answer "what prediction markets exist about topic X, and what are their current odds?"

**Acceptance Scenarios**:

1. **Given** the user is not authenticated, **When** they ask to search markets by a free-text term, **Then** the assistant returns a ranked list of matching markets with name, slug, current probability/odds, and close date.
2. **Given** the user knows a market slug, **When** they request that market by slug, **Then** the assistant returns the full market detail including description, answer set (for multi-answer markets), and current probabilities.
3. **Given** the user knows a market ID, **When** they request the market by ID, **Then** the assistant returns the same full market detail.
4. **Given** a market ID, **When** the user requests the current probability, **Then** the assistant returns the market's latest probability value verbatim from the upstream API.
5. **Given** a market ID, **When** the user requests positions/leaderboard, **Then** the assistant returns the traders holding positions in that market ranked by profit or volume.
6. **Given** the user wants to page through all markets, **When** they request successive batches using the "before" cursor, **Then** the assistant returns up to 1000 markets per batch in stable chronological order without gaps or duplicates across pages.

---

### User Story 2 - Explore Users, Groups, Bets & Comments (Priority: P2)

A user wants to research the social and activity side of Manifold Markets: look up a trader's profile, see recent bets placed on markets, read comment threads on a market, and browse topic groups (called "groups" in the API, "topics" on the site). This is still read-only and requires no credentials. The user can also look up leagues (competitive leaderboards) and boost history.

**Why this priority**: These endpoints round out read-only platform exploration and are essential context for a user deciding whether to trade. They require no auth, so they broaden the value to non-account-holders. They are slightly less central than market discovery (US1) because they support rather than enable the core "find a market" journey.

**Independent Test**: Can be fully tested by looking up a known username, fetching recent bets filtered by that user, and reading comments on a market — all without credentials. Delivers value: the user can answer "who is trading on market X, what are they saying, and what have they bet?"

**Acceptance Scenarios**:

1. **Given** a username, **When** the user requests that user's profile, **Then** the assistant returns the full public profile (display name, bio, creation date, follower counts, portfolio summary).
2. **Given** a username or user ID, **When** the user requests the lite/display profile, **Then** the assistant returns display-only fields suitable for attribution without private data.
3. **Given** a user ID, **When** the user requests that user by ID, **Then** the assistant returns the full profile.
4. **Given** the user wants to list users, **When** they request the users list, **Then** the assistant returns up to 1000 users.
5. **Given** filters such as user ID, market ID, answer ID, or time bounds, **When** the user requests bets, **Then** the assistant returns matching bets paginated and ordered as requested, without unauthenticated requests leaking private bet detail.
6. **Given** a market ID or user ID, **When** the user requests comments, **Then** the assistant returns the comment thread with author, text, and timestamps.
7. **Given** the user wants to browse topics, **When** they request groups, **Then** the assistant returns the list of topic groups; and given a slug or ID, the assistant returns a single topic group.
8. **Given** the user wants league standings or boost history, **When** they request leagues or boost history, **Then** the assistant returns the corresponding public data.

---

### User Story 3 - Authenticated Account Actions (Priority: P3)

A user who holds a Manifold Markets account and API key wants to take actions through their assistant: check who they are, view their portfolio and portfolio history, review their per-market contract metrics and transaction history, and execute write operations — place and cancel bets, create and resolve markets, sell shares, close markets, add liquidity, add/award bounties, send mana to another user, and post comments. Each write operation involves real Manifold currency (M$) and must be gated behind the API key with clear warnings in the tool surface.

**Why this priority**: Write actions are the highest-value but highest-risk capabilities. They cannot be safely delivered before read-only coverage exists, and they require credentials the user must explicitly supply. They are P3 not because they are unimportant, but because the plugin is useful without them and they demand the most careful design (money-moving, fee-incurring, irreversible actions).

**Independent Test**: Can be tested with a valid test API key against the live API by calling `get-me` to confirm identity, then placing a minimal-stake bet on a liquid market and verifying the bet appears in the user's bet history. Delivers value: the user can trade and manage markets without leaving their assistant.

**Acceptance Scenarios**:

1. **Given** the user has supplied a valid API key via plugin config (or `MANIFOLD_API_KEY` env var for the MCP server), **When** they ask "who am I", **Then** the assistant returns the authenticated user's own profile.
2. **Given** the user is authenticated, **When** they request their portfolio, portfolio history, contract metrics, or transactions, **Then** the assistant returns the corresponding personal financial data.
3. **Given** the user is authenticated and specifies a market, outcome, and stake, **When** they place a bet, **Then** the assistant submits the bet and returns the resulting bet record including fills and limit-order status.
4. **Given** the user placed a limit order, **When** they cancel that bet by ID, **Then** the assistant cancels the order and returns confirmation.
5. **Given** the user is authenticated and supplies required market parameters, **When** they create a market, **Then** the assistant creates it (noting the M$50–250 cost) and returns the new market.
6. **Given** the user owns or can resolve a market, **When** they resolve it by ID and outcome, **Then** the assistant submits the resolution and returns confirmation.
7. **Given** the user holds shares in a market, **When** they request to sell shares, **Then** the assistant sells the specified shares and returns the result.
8. **Given** the user owns a market, **When** they set a close time, add liquidity, add an answer to a multi-choice market, tag/untag a topic, rebalance, add a bounty, or award a bounty, **Then** the assistant performs the corresponding action and returns the result.
9. **Given** the user is authenticated and specifies a recipient and amount, **When** they send mana to another user, **Then** the assistant transfers the mana and returns confirmation.
10. **Given** the user is authenticated and specifies a market and comment text, **When** they post a comment, **Then** the assistant posts it and returns the comment, with the tool surface clearly disclosing the M$1 comment fee.
11. **Given** the user invokes an authenticated tool without a configured API key, **When** the tool executes, **Then** it sends the request unauthenticated and surfaces the upstream 401 as an `auth`-category error explaining that an API key is required, rather than silently failing or returning a partial success.
12. **Given** the user is authenticated and identifies a multi-choice market, **When** they place bets across multiple answers simultaneously via the multi-bet tool, **Then** the assistant submits the multi-bet and returns the resulting bet records for each answer, with the tool surface disclosing any real-currency cost.

---

### User Story 4 - Standalone MCP Server Consumption (Priority: P4)

A user of an MCP-compatible client (Claude Desktop, Cursor, or any other MCP client — not OpenClaw) wants to install and run the same set of Manifold Markets tools as a standalone MCP server over stdio, providing their API key via an environment variable. The tool surface and behavior must be equivalent to the OpenClaw plugin.

**Why this priority**: This broadens the audience beyond OpenClaw users to the wider MCP ecosystem. It is lower priority than the OpenClaw plugin (the primary deliverable) but shares the same underlying client layer, so it is comparatively low-cost once the plugin exists.

**Independent Test**: Can be tested by starting the MCP server with `MANIFOLD_API_KEY` set, issuing an MCP `tools/list` request, and confirming the same tool inventory as the plugin, then calling a read-only tool and a write tool. Delivers value: non-OpenClaw MCP clients gain full Manifold access.

**Acceptance Scenarios**:

1. **Given** the MCP server is installed and `MANIFOLD_API_KEY` is set in the environment, **When** the client connects over stdio and lists tools, **Then** it receives the same set of `manifold_`-prefixed tools as the OpenClaw plugin, with equivalent parameter schemas.
2. **Given** the MCP server is running, **When** the client calls a read-only tool, **Then** it receives the same response shape as the OpenClaw plugin for the same endpoint.
3. **Given** the MCP server is running and `MANIFOLD_API_KEY` is set, **When** the client calls an authenticated write tool, **Then** it behaves identically to the OpenClaw plugin with a configured key.
4. **Given** the MCP server is started without `MANIFOLD_API_KEY`, **When** the client calls an authenticated tool, **Then** it surfaces the same upstream-401 `auth`-category error as the plugin (no pre-check, same rely-on-upstream behavior).

---

### Edge Cases

- What happens when the Manifold API returns a non-2xx status (e.g., 404 for an unknown market/user ID, 401 for an invalid API key, 429 for rate-limit)? The tool MUST surface the upstream status and body as a clear error rather than swallowing it.
- What happens when a required path parameter (market ID, slug, username) is empty or malformed? The tool MUST reject it before making the request with a parameter-validation error.
- What happens when an optional filter parameter is omitted? The tool MUST NOT include that parameter in the upstream request, letting the API apply its documented defaults.
- What happens when the upstream API is unreachable or times out? The tool MUST return a clear network/timeout error and honor any cancellation signal from the host runtime.
- What happens when an authenticated tool is called via the plugin without `apiKey` in config, or via the MCP server without `MANIFOLD_API_KEY`? The tool MUST send the request unauthenticated and surface the resulting upstream 401 as an `auth`-category error per FR-021; it MUST NOT pre-check for a key or silently swallow the 401.
- What happens when a write operation would spend real M$ (bet, market creation, managram) or incur a fee (comment)? The tool description MUST disclose the cost; the tool MUST still execute when explicitly invoked by the user with valid credentials.
- What happens when the API enforces its 500-requests-per-minute-per-IP rate limit? The tool MUST surface rate-limit errors clearly; the tool inventory is intentionally unbatched so the host/LLM can pace calls.
- What happens when an array-valued parameter (e.g., market IDs for batch probabilities) exceeds the documented maximum (100)? The tool MUST document the limit in its description; behavior beyond the limit follows the upstream API.
- What happens when the same plugin is loaded with no config at all? Read-only tools MUST still function; authenticated tools send requests unauthenticated and surface the upstream 401 as an `auth`-category error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The integration MUST ship as an OpenClaw tool plugin installable via `openclaw plugins install npm:<package>`, exposing every supported Manifold endpoint as an individual tool.
- **FR-002**: The integration MUST additionally ship as a standalone MCP server runnable over stdio, exposing an equivalent set of tools to any MCP-compatible client.
- **FR-003**: Every tool MUST wrap exactly one Manifold Markets REST endpoint at base URL `https://api.manifold.markets/v0/` and MUST NOT aggregate, cache beyond the HTTP layer, or mutate upstream response bodies. Response bodies pass through to the caller verbatim with zero transformation.
- **FR-004**: Only Manifold endpoints marked `visibility: 'public'` in the upstream schema MUST be exposed. Undocumented or private endpoints MUST NOT be shipped.
- **FR-005**: Every tool name MUST be prefixed with `manifold_` to prevent collisions with other plugins/tools.
- **FR-006**: Read-only (GET) tools MUST function without any API key. Authenticated (auth-required) tools rely on the upstream API to reject unauthenticated calls: the tool sends the request with whatever key is configured (none if absent) and surfaces the resulting 401 as an `auth`-category error per FR-021. The integration MUST NOT maintain per-tool auth-required metadata or pre-check for a key before the HTTP call.
- **FR-007**: The OpenClaw plugin MUST accept the Manifold API key via a plugin config field. The standalone MCP server MUST accept it via the `MANIFOLD_API_KEY` environment variable. The API key MUST be transmitted only over HTTPS via the `Authorization: Key <apiKey>` header and MUST NEVER be logged or included in tool output.
- **FR-008**: All tool parameter and config schemas MUST use TypeBox constructors. No other schema library, and no hand-written raw JSON Schema, is permitted in tool definitions.
- **FR-009**: A shared, platform-agnostic API client layer MUST be the sole owner of HTTP concerns (base URL, headers, error handling, abort-signal propagation). Both the OpenClaw plugin entry point and the MCP server entry point MUST consume this shared client and MUST contain no business logic of their own.
- **FR-010**: The plugin manifest's declared tool contracts MUST exactly match the tool names actually exported by the plugin entry point, and this consistency MUST be statically verifiable by the plugin build/validate step.
- **FR-011**: Every tool MUST honor the host runtime's cancellation/abort signal and abort the upstream HTTP request when the signal is aborted.
- **FR-012**: When the upstream API returns a non-2xx response, the tool MUST surface the HTTP status code and response body in a clear error message; it MUST NOT return a silently empty or partial success.
- **FR-013**: Write-action tools (bet, multi-bet, cancel bet, create market, resolve market, sell shares, close market, add liquidity, add answer, tag/untag group, rebalance, add bounty, award bounty, send mana, create comment) MUST be individually exposed, MUST require authentication, and MUST include in their tool description any real-currency cost or fee that the action incurs (e.g., market creation M$50–250, comment M$1 fee).
- **FR-014**: Market discovery tools MUST support searching by free-text term, fetching a single market by ID, fetching a single market by slug, paging the full market list via a cursor, reading the current probability of a market, batch-reading probabilities for up to 100 market IDs, and reading a market's positions/leaderboard.
- **FR-015**: User tools MUST support fetching a user by username (full and lite), by ID (full and lite), listing users, and searching users by term.
- **FR-016**: Activity tools MUST support listing bets (filterable by user, market, answer, time bounds, kind, amount, and redemption filtering) and listing comments (by market or by user).
- **FR-017**: Group/topic tools MUST support listing groups, fetching a group by slug, and fetching a group by ID.
- **FR-018**: The integration MUST expose leagues and boost-history read endpoints.
- **FR-019**: Authenticated personal-data tools MUST expose "get me", live portfolio metrics, portfolio history, per-user per-market contract metrics (with contracts), and transaction history.
- **FR-020**: Every tool MUST be independently testable against the live Manifold API. Tests MUST verify that exported tool names match the manifest's `contracts.tools` array, that parameter schemas pass TypeBox validation, and that execute functions return the expected response shape. The suite MUST fully exercise all ~16 public read-only endpoints against the live API (no sampling); tests requiring authentication MUST be clearly separated from public-read tests.
- **FR-021**: All tool errors — whether from upstream non-2xx responses, missing/invalid API key, network failure, timeout, or parameter validation — MUST use a single uniform error shape containing: an error category drawn from the set {upstream, auth, network, timeout, validation}, a human-readable message, and (when applicable) the upstream HTTP status code and response body. This uniform shape is what every occurrence of "clear error" in this spec refers to, making error behavior objectively testable.
- **FR-022**: The integration MUST NOT implement client-side rate-limit throttling. The tool inventory MUST remain unbatched (one tool per endpoint) so the host runtime / LLM can pace calls. Upstream 429 responses MUST surface as `upstream`-category errors per FR-021. The responsibility boundary is explicit: the integration surfaces rate-limit errors; the host runtime / LLM is responsible for pacing calls.

### Key Entities *(include if feature involves data)*

- **Market** (called "contract" internally): A prediction question with outcomes. Key attributes: ID, slug, question text, outcome type (binary, free-response, multiple-choice, numeric, pseudo-numeric, bountied question, poll), mechanism, current probability/odds, answer set, close time, resolution state, volume, liquidity. List endpoints return a lite form; single-market endpoints return the full form with answers and description.
- **User**: A Manifold trader. Key attributes: ID, username, display name, bio, avatar, creation date, follower/following counts, and (for the authenticated user) portfolio and balance data. Lite variants expose display-only fields.
- **Bet**: A wager on a market outcome. Key attributes: ID, market ID, user ID, outcome, amount, shares, probability at time of bet, limit-order status, fills, and timestamp. Supports filtering by user, market, answer, time, and kind.
- **Comment**: A message posted on a market by a user. Key attributes: ID, market ID, author, text, timestamps. Posting incurs an M$1 fee.
- **Group** ("topic" on site): A collection of related markets. Key attributes: ID, slug, name, description, member counts.
- **Transaction** (txn): A record of mana movement (bets, payouts, transfers, fees). Key attributes: ID, type, amount, sender/receiver, timestamp. Requires authentication to read.
- **Portfolio Metrics**: Live and historical measures of an authenticated user's account value, profit/loss, and per-market positions.
- **League**: A competitive leaderboard grouping users by trading performance over a period.
- **Boost**: A promotion record for a market; boost history is the public log of boosts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with no Manifold account can discover and read the full detail of any public market — by search, by slug, or by ID — and receive its current probability value verbatim from the upstream API, within a single assistant turn.
- **SC-002**: The integration exposes every one of the ~30 public Manifold REST endpoints as a distinct tool, with no public endpoint missing and no private/undocumented endpoint exposed.
- **SC-003**: Every read-only tool returns correct data when called against the live public API with no credentials; every authenticated tool, when called without credentials, surfaces the upstream 401 as an `auth`-category error, and returns correct results when called with a valid key.
- **SC-004**: The OpenClaw plugin's manifest-declared tools exactly match the tools exported in source, verified automatically by the plugin validate step on every build.
- **SC-005**: The standalone MCP server exposes the same tool inventory and equivalent parameter schemas as the OpenClaw plugin, such that a tool call that succeeds against one succeeds against the other with the same response shape.
- **SC-006**: A user can complete a full authenticated trading journey — look up a market, place a bet, confirm the bet in history, then sell the shares — entirely through tool calls, with each step returning clear success or error feedback. For multi-choice markets, the same journey covers placing bets across multiple answers via the multi-bet tool.
- **SC-007**: Every tool's declared parameter schema accepts correctly-formed inputs and rejects malformed or missing required inputs with a clear validation error, and the project's standard build, validate, and test commands all pass cleanly.
- **SC-008**: Upstream API errors (non-2xx, rate-limit, timeout), missing-key errors, network errors, and validation errors are all surfaced to the caller using the uniform error shape (category + message + status/body when applicable), with zero cases of silent empty-success returns.
- **SC-009**: Every tool honors the host's cancellation signal, aborting in-flight HTTP requests when the caller cancels.
- **SC-010**: The integration's automated tests pass against the live API for all ~16 public read-only endpoints (full coverage, no sampling), and the suite clearly distinguishes credential-required tests from public tests.

## Assumptions

- Users have stable internet connectivity and can reach `https://api.manifold.markets/v0/`.
- Read-only users do not need a Manifold account; only authenticated (write and personal-data) tools require an API key, which the user obtains from their Manifold profile.
- The Manifold API remains at its current alpha-state public contract for the lifetime of this release; the integration pins to current documented behavior and will require updates if the upstream changes.
- The 500-requests-per-minute-per-IP rate limit is enforced by the upstream API; the integration does not implement client-side throttling but exposes rate-limit errors clearly. The host runtime / LLM is responsible for pacing calls.
- WebSocket streaming (`wss://api.manifold.markets/ws`) is explicitly out of scope for this feature; it is a documented future enhancement.
- The shared API client layer performs no client-side caching beyond what the HTTP layer provides; the `/v0/market/[id]/prob` endpoint's ~1s upstream cache is sufficient.
- The integration targets OpenClaw `>=2026.5.17` and the current MCP TypeScript SDK as scaffolded; peer dependency ranges may be broad.
- For the MCP server, the single supported transport is stdio; other transports (SSE, HTTP) are out of scope for this release.
- The plugin is distributed as an npm package; publishing scope and access are a packaging decision deferred to the publish step, not part of this specification.
