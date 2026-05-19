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

registerProxyLinkSupport(server, {
  companyName: 'Acme',
  toolPrefix: 'acme',
  apiUrl: process.env.PROXYLINK_API_URL!,
  apiKey: process.env.PROXYLINK_API_KEY!,
  supportTopics: ['billing', 'account access', 'subscription changes'],
});
```

Registered tool names are deterministic:

- `acme_search_knowledge_base`
- `acme_get_ticket_types`
- `acme_create_support_ticket`

Set `features.knowledgeBase: false` or `features.tickets: false` to skip
either group.

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
