# Architecture Context

## Stack

| Layer                   | Technology                                                  | Role                                                                     |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Language                | TypeScript 5.9, strict, `module: NodeNext`, `target: ES2022`| All source. Emits `.js` + `.d.ts` + maps to `dist/`.                     |
| Module system           | ESM only (`"type": "module"`)                               | Imports use `.js` extension; consumed by ESM and modern bundlers.        |
| MCP integration         | `@modelcontextprotocol/sdk` (**peer**, `>=1.29.0 <2`)       | `McpServer.registerTool` is the only surface this library touches.       |
| Validation              | `zod` (**peer**, `^3.25.0 \|\| ^4.0.0`)                     | Input/output schemas for every tool; never bundled.                      |
| HTTP                    | Native `fetch` (Node 20+ built-in)                          | `ProxyLinkClient` — no axios, no node-fetch, no extra HTTP deps.         |
| Tests                   | Node native test runner via `tsx --test tests/*.test.ts`    | No Jest, no Vitest. Tests use a stub adapter + stub `fetchFn`.           |
| Package manager         | npm (CI uses `npm ci`)                                      | Pinned via `package-lock.json`. The rest of the workspace uses Bun;     this package is intentionally on npm because npm provenance + OIDC publish runs through `actions/setup-node`. |
| Runtime                 | Node `>=20`                                                 | Required for built-in `fetch`, native test runner, and ESM in NodeNext. |
| CI                      | GitHub Actions (`.github/workflows/ci.yml`)                 | On every PR and `main` push: audit (high), typecheck, test, build, example typecheck, pack dry-run. |
| Release                 | GitHub Actions (`.github/workflows/release.yml`)            | On `v*` tag push: `release:check` + `npm publish` via OIDC trusted publishing. |
| Workspace               | npm workspaces (`examples/basic-mcp-server`)                | Example app exists to typecheck the package end-to-end as a consumer.    |

## System Boundaries

- `src/index.ts` — Public barrel. Re-exports `registerProxyLinkSupport`
  and the consumer-facing types. The only file external callers
  should be importing from at `@proxylink/mcp`.
- `src/register.ts` — Orchestrator. Normalizes config, builds the
  adapter, builds the client, computes tool names, conditionally
  registers KB and ticket tools, fetches `/tenant/profile`, and
  conditionally registers any matching industry pack.
- `src/config.ts` — `normalizeConfig`. Validates required fields,
  enforces the `toolPrefix` regex (`/^[A-Za-z][A-Za-z0-9_-]*$/`), strips
  trailing slash from `apiUrl`, defaults `features` to all-true.
- `src/toolNames.ts` — `buildToolNames`. Deterministic name builder
  for the core three tools, plus a slot for industry pack names.
- `src/adapter.ts` — `createMcpSdkAdapter`. Wraps
  `McpServer.registerTool` behind the internal `McpAdapter`
  interface, so tools never import the SDK directly.
- `src/client.ts` — `createProxyLinkClient` + `ProxyLinkApiError`.
  Thin `fetch` wrapper around the ProxyLink API. `fetchFn` is
  overridable for tests.
- `src/tools/knowledgeBase.ts` — Registers the KB search tool.
- `src/tools/tickets.ts` — Registers `get_ticket_types` and
  `create_support_ticket`. `create_support_ticket` re-fetches ticket
  types and runs `validateTicketInput` before posting.
- `src/validation.ts` — `validateTicketInput`. Pure function. No
  network, no adapter, no logger.
- `src/schemas.ts` — Zod input/output schemas for every core tool.
- `src/response.ts` — `textOutput`, `structuredOutput`, `errorOutput`
  helpers that produce the `ToolOutput` envelope.
- `src/logging.ts` — `logError` no-op wrapper around the optional
  logger.
- `src/types.ts` — All shared types (public + internal).
- `src/packs/registry.ts` — `industryPacks` map keyed by
  `${industry}/${category}`. Add a new pack here.
- `src/packs/types.ts` — `IndustryPack`, `IndustryPackContext`,
  `TenantProfile` shapes.
- `src/packs/hvac/` — The first industry pack:
  - `index.ts` — registers the pack and the tool name
  - `tool.ts` — `registerHvacReplacementPricingTool`
  - `schema.ts` — Zod input/output for the pricing tool
  - `catalog.ts` — `HVAC_ADDONS`, `HVAC_TONNAGES`, `HVAC_TIERS`
    (also re-exported via the `./catalog` subpath in `package.json`)
  - `types.ts` — Local pricing response types
- `tests/` — Node-test files. One per source file or per behavior
  cluster (`client`, `toolHandlers`, `ticketValidation`, `hvacPack`,
  `registerProxyLinkSupport`). `tests/helpers.ts` holds stub adapter +
  stub `fetchFn` factories.
- `examples/basic-mcp-server/` — npm workspace package that imports
  the built library and typechecks an end-to-end consumer; verifies
  the public surface and the `.js`/`.d.ts` exports actually resolve.
- `dist/` — Build output. The only directory shipped to npm (via
  `files` in `package.json`).

## Storage Model

This package has no storage. It owns no databases, no caches, no
filesystem state. It only:

- holds the caller-provided `apiKey` in a closure inside
  `createProxyLinkClient`,
- talks to the ProxyLink API over `fetch`,
- returns serializable values to the MCP SDK.

If a host needs caching, retries, or persistence, that is the host's
responsibility — do not add it here.

## Auth and Access Model

- The library authenticates to the ProxyLink API with a single
  bearer token (`config.apiKey`) on every request:
  `Authorization: Bearer ${apiKey}`. Every call carries it; there is
  no token refresh, no session.
- The token is tenant-scoped. ProxyLink API derives the calling tenant
  from the SHA-256 hash of the key — this package never sees a
  tenant id.
- There is no inbound auth in this package. Inbound auth (OAuth,
  client-cert, etc.) is the host's responsibility. The library trusts
  the MCP server it is handed.
- `GET /tenant/profile` is fetched once at registration time to learn
  the tenant's industry/category and capability flags
  (`hasPricingConfig`). It is intentionally not re-fetched per
  invocation; reconnect to pick up profile changes.

## Invariants

1. The public surface is `src/index.ts` only. If a symbol is not
   re-exported there, it is internal and may change in any patch
   release.
2. Peer dependencies (`@modelcontextprotocol/sdk`, `zod`) MUST stay
   in `peerDependencies` and never migrate to `dependencies`. The
   host owns the concrete versions.
3. The library never reads `process.env`, never calls `dotenv.config`,
   never accesses the filesystem, and never starts a server. All
   configuration arrives through `ProxyLinkSupportConfig`.
4. `registerProxyLinkSupport` returns a `RegisteredProxyLinkTools`
   object listing every tool name actually registered. Tool names are
   deterministic from `toolPrefix` + features + matched pack — they
   are part of the public contract.
5. Tool handlers always return a `ToolOutput` and never throw. Errors
   are translated into `errorOutput(...)`. The MCP host loop must be
   able to await every handler safely.
6. `create_support_ticket` MUST re-fetch ticket types and call
   `validateTicketInput` before hitting `POST /ticket`. Skipping
   validation produces unreviewable server errors.
7. Industry packs MUST NOT crash registration if `/tenant/profile`
   fails — the orchestrator catches the error, logs it via the
   pluggable logger, and proceeds with the core tools.
8. No tool handler mutates the input object or the config object.
   Treat both as frozen.
9. The build emits ESM-only with `.d.ts`. `package.json` `exports`
   conditions are the source of truth for what subpaths exist — do
   not add new entrypoints without updating `exports` + `typesVersions`
   in the same change.
10. Releases never bypass `npm run release:check`. CI runs the same
    gate before publish; the local script exists so failures are
    caught before tagging.
11. The HVAC pack's tool description and response text reference a
    `{toolPrefix}_show_appointment_scheduler` tool by convention,
    wrapped in conditional "if available" phrasing. Hosts that want
    the upsell to land on a real handle register a scheduling tool at
    that name. This is the seam for when scheduling becomes a real
    industry pack — that pack will register at the conventional name
    and the references resolve unchanged.
