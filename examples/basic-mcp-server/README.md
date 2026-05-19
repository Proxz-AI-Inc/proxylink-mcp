# ProxyLink MCP Basic Example

This example shows the intended customer integration shape. It creates a fresh
MCP server and Streamable HTTP transport per request.

Set environment variables before running:

```bash
export PROXYLINK_API_URL="https://api.proxylink.com"
export PROXYLINK_API_KEY="your-tenant-api-key"
npm run dev -w examples/basic-mcp-server
```

The example listens on `PORT` or `3000`.
