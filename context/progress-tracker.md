# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- In progress — early library (v0.5.x is the active line). Surface is
  stabilizing; pre-1.0 means small breaking changes still ship as
  minor bumps when the docs flag them. v0.5.0 adds the consulting
  schedule-call pack and reads `schedulingUrl` from the tenant profile.

## Current Goal

- Migrate the per-tenant MCP apps in the workspace (ESPN,
  StateFarm, CCAIA, optionally Realtor/Real-Estate's KB+ticket
  surface) off their duplicated `services/proxylink-api.ts` + tool
  registration code and onto `registerProxyLinkSupport(server, ...)`.

## Completed

- v0.5.0: Consulting industry pack added. `consulting` tenants now get
  `{toolPrefix}_schedule_call`, a text/link scheduler tool backed by the
  tenant profile `schedulingUrl`. The pack registry now supports
  industry-only keys as well as `${industry}/${category}` keys.
- v0.3.0: HVAC pricing tool reframed as a sales funnel. Tool
  description and successful response now directively prompt the
  agent to offer the customer an appointment via
  `{toolPrefix}_show_appointment_scheduler` (convention, not config).
  Not-configured response body also pivots to scheduling. KB and
  tickets unchanged. Pure additive — no config or type surface
  changed.
- v0.2.0: `registerProxyLinkSupport` became `async` and now fetches
  `GET /tenant/profile` at registration time. Breaking change called
  out in the README.
- Industry pack registry (`src/packs/registry.ts`) plus the first
  pack — `home-services/hvac` registering
  `{prefix}_replacement_pricing`.
- Stable `./catalog` subpath export of `HVAC_ADDONS`, `HVAC_TONNAGES`,
  `HVAC_TIERS` so the ProxyLink dashboard can share the same source
  of truth.
- Peer-dependency floor bumped to `@modelcontextprotocol/sdk >=1.29.0`
  (older `1.25.x` not supported).
- npm publish wired via OIDC trusted publishing on `v*` tag push
  (`.github/workflows/release.yml`).
- CI gate: audit (high), typecheck, test, build, example typecheck,
  pack dry-run. Same gate is also `npm run release:check` locally.
- Native Node test runner via `tsx --test` (no Jest / Vitest
  dependency).
- ESM-only output (`type: module`, `module: NodeNext`, `.js`
  extensions in source imports).

## In Progress

- _None recorded — populate as work begins._

## Next Up

- _First unit will be added by the first agent that updates this
  file with concrete in-flight work. Top candidates: migrating the
  ESPN MCP app to the library; adding a second industry pack._

## Open Questions

- The workspace `.cursorrules` describes the older folder layout
  (`adapters/mcpSdkAdapter.ts`, `validation/ticketValidation.ts`,
  `client/proxylinkClient.ts`) and the older entry filename
  (`registerProxyLinkSupport.ts`). Ground truth: those live at flat
  paths under `src/` (`adapter.ts`, `validation.ts`, `client.ts`,
  `register.ts`). Decide whether to (a) reshape the source to match
  the cursorrules or (b) update `.cursorrules` to match reality.
- The cursorrules does not mention industry packs at all. Add a
  section for `packs/` and the `./catalog` subpath next time it is
  edited.
- The cursorrules says `registerProxyLinkSupport` is synchronous —
  outdated as of v0.2.0. Confirm propagation when refreshing.
- Should `validateTicketInput` also enforce field-value types
  (`number` vs `string` per `TicketTypeFormField.type`)? Today it
  only checks field IDs and required-ness.
- For future packs, choose `${industry}/${category}` when the dashboard
  requires a category and `industry` when the industry has no categories.

## Architecture Decisions

- **Library-shape over framework-shape.** No server, no transport,
  no env loading, no global state. Hosts vary too much to safely
  unify those concerns at the package level.
- **Peer-dep `@modelcontextprotocol/sdk` and `zod`.** Hosts pin their
  SDK and Zod versions; the library tolerates a range and never
  bundles either.
- **Native fetch + Node 20 floor.** Skipping `axios` / `node-fetch`
  keeps the install surface tiny and the bundle predictable for
  serverless hosts.
- **Adapter wrapper around `McpServer`.** Tool code becomes
  SDK-version-agnostic and unit-testable with a stub adapter; bumps
  to the MCP SDK stay localized to `src/adapter.ts`.
- **Native Node test runner via `tsx`.** Avoids a Jest/Vitest
  dependency, runs the same way locally and in CI, plays well with
  the ESM + NodeNext config.
- **Industry packs are auto-registered from the tenant profile** —
  hosts do not pass a pack list. The library calls `/tenant/profile`,
  looks up `${industry}/${category}` when the profile has a category,
  otherwise looks up `industry`, and registers whatever matches (or
  warns and proceeds with core tools).
- **Stable subpath export for the HVAC catalog** — chosen over
  duplicating constants in the dashboard. Hosts and dashboards both
  import the same source of truth via `@proxylink/mcp/catalog`.
- **OIDC trusted publishing** — chosen over storing an NPM_TOKEN
  secret. Tag push triggers publish with a short-lived token minted
  by GitHub.
- **Convention over configuration for cross-tool references.** The
  HVAC pack references the scheduler tool by deterministic name
  (`{toolPrefix}_show_appointment_scheduler`) rather than introducing
  a new config field. Wrapped in "if available" guards so hosts
  without a scheduler aren't broken. The consulting scheduler uses
  `{toolPrefix}_schedule_call`, matching the consulting action rather
  than the HVAC appointment wording.

## Session Notes

- `npm run release:check` is the gate. Run it BEFORE tagging — it
  catches audit failures, type drift, broken example consumer, and
  packaging mistakes. Tag-then-fix burns a version number.
- The `examples/basic-mcp-server/` workspace exists to typecheck the
  built library as a real consumer. Keep it minimal; do not let it
  drift into a kitchen-sink demo.
- The package is the only npm-managed project in an otherwise
  Bun-first workspace. That is deliberate — npm OIDC publish runs
  through `actions/setup-node`, and the rest of the workspace's
  Bun pinning would only add friction here.
- The README is part of the published surface. Keep version
  references in the README in sync with `package.json` whenever a
  breaking-change callout is added or removed.
