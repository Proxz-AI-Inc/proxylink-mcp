# @proxylink/mcp

[![npm version](https://img.shields.io/npm/v/@proxylink/mcp.svg)](https://www.npmjs.com/package/@proxylink/mcp)
[![License](https://img.shields.io/npm/l/@proxylink/mcp.svg)](./LICENSE)

Reusable ProxyLink support tools for existing MCP servers.

This package is intentionally small:

- no HTTP server startup
- no transport ownership
- no `dotenv`
- no `axios`
- no install or postinstall scripts

The host MCP app owns its server, transport, deployment, and environment
loading. ProxyLink only registers support tools on the provided MCP server.

## Install

```bash
npm install @proxylink/mcp @modelcontextprotocol/sdk zod
```

The MCP SDK peer dependency floor is `>=1.29.0 <2`. Older `1.25.x` versions are
not supported by this package.

You need a ProxyLink tenant API key to use the registered tools. Create one
from the ProxyLink dashboard.

## Usage

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProxyLinkSupport } from '@proxylink/mcp';

const server = new McpServer({
  name: 'acme-mcp',
  version: '1.0.0',
});

await registerProxyLinkSupport(server, {
  companyName: 'Acme',
  toolPrefix: 'acme',
  apiUrl: process.env.PROXYLINK_API_URL!,
  apiKey: process.env.PROXYLINK_API_KEY!,
  supportTopics: ['billing', 'account access', 'subscription changes'],
});
```

> **Breaking change in v0.2.0:** `registerProxyLinkSupport` is now `async`.
> Add `await` (or chain `.then()`) when you call it.

Registered core tool names are deterministic:

- `acme_search_knowledge_base`
- `acme_get_ticket_types`
- `acme_create_support_ticket`

If the tenant's industry or industry/category matches a built-in industry pack,
additional vertical tools register automatically. For example, a
`home-services` / `hvac` tenant gets:

- `acme_replacement_pricing`

A `consulting` tenant gets:

- `acme_schedule_call`

Set `features.knowledgeBase: false` or `features.tickets: false` to skip
either core group. Vertical tools always register when the industry pack
matches.

#### HVAC pricing tool — sales-funnel framing

The HVAC pricing tool is intentionally framed to the LLM as a sales funnel —
every pricing response (including the not-configured fallback) directs the
agent to offer the customer an appointment. If your host registers a
scheduling link tool, name it `{toolPrefix}_show_appointment_scheduler` so the
pricing tool can direct the agent to provide a booking link. If you don't register one,
the references are wrapped in "if available" guards so well-behaved agents
skip the call gracefully — but the funnel framing in the response text will
still encourage the agent to ask the customer about scheduling.

#### Consulting schedule-call tool

The consulting pack registers `{toolPrefix}_schedule_call`. The tool returns
the tenant's configured scheduling URL from the ProxyLink tenant profile and is
framed for consulting conversations where the customer wants to discuss scope,
fit, proposals, pricing, or next steps with the consultant.

### Industry catalog subpath
Constants describing supported add-ons, tonnages, and tier IDs are exported
from a stable subpath so the same catalog can power dashboards and other
consumers without re-implementing them:

```ts
import { HVAC_ADDONS, HVAC_TONNAGES, HVAC_TIERS } from '@proxylink/mcp/catalog';
```

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Run the full release gate locally before tagging:

```bash
npm run release:check
```

This runs `npm audit` (high), typecheck, tests, build, the example app
typecheck, and `npm pack --dry-run` so you can verify the published tarball
contents.

## Releasing

Releases are published to npm via GitHub Actions on tag push. Trusted
publishing (OIDC) is used; there are no long-lived publish tokens.

```bash
npm version patch   # or minor / major
git push --follow-tags
```

The `release.yml` workflow runs `release:check`, then `npm publish` with
provenance.

## License

Apache-2.0. See [LICENSE](./LICENSE).
