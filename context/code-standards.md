# Code Standards

## General

- Keep modules small and single-purpose. One file = one
  responsibility. `register.ts` orchestrates, `client.ts` does HTTP,
  `validation.ts` validates — none of these blend.
- Fix root causes. Do not add a guard in a tool handler when the
  bug is in `normalizeConfig`, `validateTicketInput`, or
  `createProxyLinkClient`.
- Prefer explicit over clever. The whole point of this package is
  that a host developer can read the source in 20 minutes and trust
  it. Do not introduce indirection without a clear payoff.
- Library-shape discipline. No `dotenv`, no `axios`, no install
  scripts, no globals, no top-level side effects, no implicit network
  on import. Anything that breaks "host owns the world" is wrong.
- Follow the workspace rules under `.cursor/rules/` (comments ≤ 3
  lines, no decorative dividers, plain-language prose).

## TypeScript

- Strict mode is required (`tsconfig.json` → `strict: true`,
  `forceConsistentCasingInFileNames: true`).
- `module: NodeNext` + `moduleResolution: NodeNext`. Every relative
  import MUST use the explicit `.js` extension — even though the
  source is `.ts` — because NodeNext resolves the emitted path.
- Avoid `any`. Prefer `unknown` at the boundary, then narrow. The
  adapter's `handler: (input: unknown) => unknown` cast is the only
  intentional `any`-shaped escape and is contained to `src/adapter.ts`.
- Public types live in `src/types.ts` and are re-exported from
  `src/index.ts`. If a type is not re-exported, it is internal.
- Zod is the validation source of truth for tool inputs/outputs.
  Hand-rolled type assertions are not a substitute.

## Library / MCP Conventions

- Tool registration MUST go through the internal `McpAdapter`
  interface, not `server.registerTool` directly. The adapter is what
  keeps the package SDK-version-agnostic.
- Tool names MUST be built by `buildToolNames` (or, for industry
  packs, by `${toolPrefix}_${toolKey}` mirroring that style). Do not
  inline a hardcoded tool name in a handler.
- Cross-tool references inside a pack's description/response copy use
  the convention `{toolPrefix}_<tool_suffix>` (e.g.
  `{toolPrefix}_show_appointment_scheduler`). Phrase the reference
  conditionally ("if available") so hosts that don't register the
  referenced tool aren't broken, and describe the visible scheduling
  action rather than assuming a widget or embedded scheduler UI.
- Tool descriptions interpolate `config.companyName` and other
  user-visible context. They are part of the prompt the model sees —
  treat them as product copy, not implementation notes.
- Every tool sets the four MCP annotations explicitly
  (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint`). Do not omit them.
- Tool handlers MUST NOT throw. Catch, log via `logError`, return
  `errorOutput(...)`.
- Conditional registration (features, packs) MUST be done inside
  `register.ts`. Tool files assume they are wanted.

## Validation

- Zod schemas live in `src/schemas.ts` (core tools) and
  `src/packs/<vertical>/schema.ts` (vertical tools).
- Pure validation logic (cross-field, schema-vs-ticket-type) lives
  in `src/validation.ts`. No network, no logger, no side effects —
  pure functions only.
- `validateTicketInput` returns a discriminated `{ ok: true, ... } |
  { ok: false, message }`. Callers narrow on `ok` and pass `message`
  straight to `errorOutput`. Do not throw.

## API Client

- All HTTP goes through `createProxyLinkClient`. Tool handlers MUST
  NOT call `fetch` directly.
- Every request carries `Authorization: Bearer ${apiKey}`. The client
  constructor adds the header — do not re-add per call.
- `requestJson` throws `ProxyLinkApiError(message, status)` on
  non-2xx. Tool handlers catch, log, and translate to `errorOutput`.
- `fetchFn` is overridable in `createProxyLinkClient` solely for
  tests. Production callers never pass it.

## Output Envelope

- Every successful tool result is `structuredOutput({ success: true,
  ... }, humanReadableText)`. The human text and the structured
  payload are both required — clients pick whichever they consume.
- Every failure path returns `errorOutput(message, structured?,
  isError?)`. Pass `isError: true` only for genuine system failures
  (network down, internal exception), not for user/input errors.
- Do not invent new envelope shapes inline. Add a helper to
  `response.ts` if a recurring pattern emerges.

## Logging

- The `logger` is optional. Code MUST handle `undefined` gracefully —
  use `logError(config.logger, ...)` rather than `config.logger.error(...)`.
- Log messages are stable identifiers
  (`proxylink_search_knowledge_base_failed`,
  `proxylink_hvac_replacement_pricing_failed`). Hosts grep on them.
  Do not change message strings casually.
- Meta keys (`toolName`, `query`, `error`, `stack`) follow the
  existing shape. Include `stack` only when an `Error` was caught.

## File Organization

- `src/index.ts` — Public barrel. Edit only when adding/removing a
  public symbol.
- `src/register.ts` — Orchestration. Adding a new tool group means
  editing this file and `toolNames.ts`.
- `src/config.ts` — Config normalization + validation. New required
  field? Add it here, with a clear error message.
- `src/types.ts` — Public + internal types. Mark internal types with
  a comment if there is a reason they cannot move out of here.
- `src/schemas.ts` — Core tool Zod schemas.
- `src/toolNames.ts` — Deterministic name builder.
- `src/adapter.ts` — `McpServer` ↔ `McpAdapter` wrapper. Do not let
  SDK types leak past this file.
- `src/client.ts` — HTTP client. New endpoint? Add a method here and
  a type for the response in `types.ts`.
- `src/response.ts`, `src/logging.ts`, `src/validation.ts` — Small
  pure utilities. Keep them small.
- `src/tools/<tool>.ts` — One tool registration per file. The file
  exports a single `register<Thing>Tool(adapter, config, client, name)`
  function.
- `src/packs/registry.ts` — Industry pack registry. Add a pack here
  AND under `src/packs/<vertical>/`.
- `src/packs/<vertical>/index.ts` — `IndustryPack` export.
  `tool.ts` registers tools. `schema.ts`, `types.ts`, `catalog.ts`
  follow.
- `tests/*.test.ts` — One test file per source module or behavior.
  Use `tests/helpers.ts` for stub adapters and stub fetch.
- `examples/basic-mcp-server/` — Reference consumer. Keep it
  deliberately minimal — its job is to validate the public surface,
  not to be a full app.
- `dist/` — Generated. Never edit. Never check in.

## Build & Release

- `npm run build` — `tsc -p tsconfig.json`, emits `dist/`.
- `npm test` — Native Node test runner via `tsx`. Watch with
  `tsx --test --watch tests/*.test.ts` (not currently scripted).
- `npm run typecheck` — Uses `tsconfig.test.json` so tests are
  included.
- `npm run release:check` — Full local gate (audit, typecheck, test,
  build, example typecheck, pack dry-run). Run this BEFORE tagging.
  Do not skip; CI runs the same gate but tag-then-fix wastes a
  version number.
- Bumping the version means editing `package.json` and tagging
  `v<version>`. CI does the npm publish via OIDC.
