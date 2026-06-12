# @proxylink/mcp

## Overview

`@proxylink/mcp` is a reusable npm library that registers ProxyLink
support tools (knowledge base search, ticket types, ticket creation,
and industry-specific verticals) on a host's `McpServer`. It is
intentionally library-shaped: no HTTP server startup, no transport
ownership, no `dotenv`, no `axios`, no install / postinstall scripts.
The host MCP app owns its server, transport, deployment, and
environment loading — this package only registers tools. It is the
extraction target for the per-tenant MCP apps in the workspace
(ESPN, StateFarm, CCAIA, Realtor, etc.) so they can replace duplicated
`services/proxylink-api.ts` + tool registration code with a single
`registerProxyLinkSupport(server, {...})` call.

## Goals

1. Be the single source of truth for ProxyLink's support-tool surface
   so every MCP host registers tools with identical names, descriptions,
   I/O schemas, validation, and error shapes.
2. Stay minimal: no transport, no env loading, no globals, no side
   effects at import time. The host stays in control.
3. Support per-tenant industry verticals (e.g. `home-services/hvac`)
   by auto-registering an extra tool when the tenant profile matches a
   built-in pack, without leaking that logic into every host.
4. Ship safe, signed releases via OIDC trusted publishing on tag push
   — no long-lived npm tokens in the repo.

## Core User Flow

This is a library — its "user" is a developer writing a host MCP app.

1. Developer installs the package and its two peer dependencies:
   `npm install @proxylink/mcp @modelcontextprotocol/sdk zod`.
2. They construct an `McpServer` from the MCP SDK.
3. They `await registerProxyLinkSupport(server, { companyName,
   toolPrefix, apiUrl, apiKey, supportTopics?, features?, logger? })`.
4. The library:
   - validates and normalizes the config,
   - registers `{prefix}_search_knowledge_base` (if enabled),
   - registers `{prefix}_get_ticket_types` and
     `{prefix}_create_support_ticket` (if enabled),
   - fetches `GET /tenant/profile` from the ProxyLink API,
   - if the profile's `industry/category` or industry matches a built-in
     industry pack, registers the pack's tools (e.g.
     `{prefix}_replacement_pricing` for HVAC or `{prefix}_schedule_call`
     for consulting),
   - returns a `RegisteredProxyLinkTools` object listing every tool
     name it registered.
5. Tool invocations from the MCP client flow through the host's
   transport → MCP SDK → the library's handler → `ProxyLinkClient`
   → ProxyLink API → result mapped into a `ToolOutput`.

## Features

### Core tool registration

- `{prefix}_search_knowledge_base` — KB query with conversation
  rephrasing, returns structured `{ success, answer, usedWebFallback,
  webSources }`.
- `{prefix}_get_ticket_types` — Lists tenant-enabled ticket types
  with full form-field schema. Must be called before creating a
  ticket.
- `{prefix}_create_support_ticket` — Re-fetches ticket types,
  validates field IDs and required fields with `validateTicketInput`,
  then posts to the API. Returns ticket id on success.

### Industry packs (auto-registered)

- `home-services/hvac` → `{prefix}_replacement_pricing` — Calls
  `POST /pricing/lookup` with tonnage, optional tier id, and add-ons.
  Honors `profile.hasPricingConfig` (the not-configured branch pivots
  the response to a scheduling offer instead of an apology). The tool
  is framed to the LLM as a sales funnel: every successful pricing
  response directs the agent to offer the customer an appointment, and
  the description / response text reference a
  `{prefix}_show_appointment_scheduler` tool by convention — hosts
  that register one at that name get the upsell wired up automatically,
  hosts that don't are protected by "if available" guards in the copy.
- `consulting` → `{prefix}_schedule_call` — Returns the tenant's
  configured scheduling URL from `GET /tenant/profile`. It is framed for
  consulting questions where the customer wants to discuss scope, fit,
  proposals, pricing, or next steps with the consultant.

### Stable subpath exports

- `@proxylink/mcp` — `registerProxyLinkSupport` + public types
  (`ConversationMessage`, `CreateTicketInput`, `TicketType`,
  `QueryResponse`, etc.).
- `@proxylink/mcp/catalog` — `HVAC_ADDONS`, `HVAC_TONNAGES`,
  `HVAC_TIERS` for non-MCP consumers (dashboards, validators).

### Adapter abstraction

- `createMcpSdkAdapter(server)` wraps `McpServer.registerTool` behind
  an `McpAdapter` interface, so tool code stays SDK-version-agnostic
  and unit-testable with a stub adapter.

### HTTP client

- `createProxyLinkClient({ apiUrl, apiKey, fetchFn? })` — `fetch`-based
  HTTP client with `queryKnowledgeBase`, `fetchTicketTypes`,
  `createSupportTicket`, and a generic `requestJson`. Throws
  `ProxyLinkApiError` with status on non-2xx. `fetchFn` is overridable
  for tests.

### Configurable feature flags

- `features.knowledgeBase` (default `true`)
- `features.tickets` (default `true`)
  Setting either to `false` skips that group entirely. Industry packs
  always register when the profile matches.

### Pluggable logging

- `config.logger` (`{ debug?, info?, warn?, error? }`) — optional. If
  omitted, the library is silent. `logError` is a no-op when no logger
  is provided.

## Scope

### In Scope

- Tool registration on a caller-provided `McpServer`
- ProxyLink HTTP client (KB query, ticket types, ticket create,
  tenant profile with scheduling URL, pricing lookup)
- Input/output validation (Zod schemas + the `validateTicketInput`
  helper)
- Industry pack registry + the HVAC pack
- Stable type exports and the `/catalog` subpath
- npm publish via OIDC trusted publishing on tag push

### Out of Scope

- Starting an HTTP/SSE/stdio server, choosing a transport, or owning
  the request loop
- Reading environment variables (`dotenv`, `process.env` lookups)
- OAuth, auth middleware, session management
- Caching, rate limiting, retries (host's job if needed)
- Direct Firestore / Firebase Admin access (the package only talks to
  the ProxyLink API server)
- UI / dashboard / docs site

## Success Criteria

1. A host MCP app can register the full support tool surface in one
   `await registerProxyLinkSupport(server, config)` call with no other
   imports from this package.
2. The same release exposes `registerProxyLinkSupport` from `.` and
   the HVAC catalog from `./catalog`, both with working type
   definitions verified by `examples/basic-mcp-server`.
3. `npm run release:check` (`audit --audit-level=high`, typecheck,
   tests, build, example typecheck, pack dry-run) passes locally and
   in CI before every tag.
4. Releases publish to npm via OIDC on tag push without any
   long-lived secrets in the repo.
5. The peer-dependency range (`@modelcontextprotocol/sdk >=1.29.0 <2`,
   `zod ^3.25.0 || ^4.0.0`) holds — no concrete version of either
   leaks into `dependencies`.
