# Manifold Markets

OpenClaw tool plugin + standalone MCP server for [Manifold Markets](https://manifold.markets), wrapping the public REST API at `https://api.manifold.markets/v0/`.

## Features

- **OpenClaw plugin** — install via `openclaw plugins install npm:openclaw-plugin-manifold-markets`
- **Standalone MCP server** — run over stdio with any MCP-compatible client
- **40 tools** covering markets, users, groups, bets, comments, leagues, boosts, authenticated reads, and write actions
- **TypeBox schemas** required by the OpenClaw SDK
- **Shared, platform-agnostic HTTP client** used by both entry points
- **Uniform error shape** for upstream, auth, network, timeout, and validation errors
- **No response mutation** — upstream JSON passes through verbatim

## Install

```bash
npm install
```

## OpenClaw plugin

Build and validate:

```bash
npm run plugin:build
npm run plugin:validate
```

Install in OpenClaw:

```bash
openclaw plugins install npm:openclaw-plugin-manifold-markets
```

Configure the plugin with a Manifold API key if you want to use authenticated endpoints. Read-only tools work without a key.

## Standalone MCP server

Set your API key and run the compiled server:

```bash
npm run build
MANIFOLD_API_KEY=your-key npm run mcp:start
```

The server exposes the same 40 `manifold_`-prefixed tools over stdio.

## Development

```bash
npm run build       # compile TypeScript
npm test            # run live-API Vitest suite
npm run plugin:validate  # manifest sync + validation
```

## API key

Get your Manifold API key from your Manifold profile → edit → refresh API key.
