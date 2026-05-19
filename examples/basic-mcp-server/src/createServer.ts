import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProxyLinkSupport } from '@proxylink/mcp';

export function createConfiguredMcpServer(): McpServer {
  const server = new McpServer({
    name: 'proxylink-basic-example',
    version: '0.1.0',
  });

  registerProxyLinkSupport(server, {
    companyName: process.env.PROXYLINK_COMPANY_NAME ?? 'Acme',
    toolPrefix: process.env.PROXYLINK_TOOL_PREFIX ?? 'acme',
    apiUrl: process.env.PROXYLINK_API_URL ?? 'https://api.proxylink.com',
    apiKey: process.env.PROXYLINK_API_KEY ?? 'replace-me',
    supportTopics: ['billing', 'account access', 'subscription changes'],
  });

  return server;
}
