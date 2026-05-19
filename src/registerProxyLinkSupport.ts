import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpSdkAdapter } from './adapters/mcpSdkAdapter.js';
import { createProxyLinkClient } from './client/proxylinkClient.js';
import { normalizeConfig } from './config.js';
import { buildToolNames } from './toolNames.js';
import { registerKnowledgeBaseTool } from './tools/knowledgeBase.js';
import { registerTicketTools } from './tools/tickets.js';
import type {
  ProxyLinkSupportConfig,
  RegisteredProxyLinkTools,
} from './types.js';

export function registerProxyLinkSupport(
  server: McpServer,
  config: ProxyLinkSupportConfig,
): RegisteredProxyLinkTools {
  const normalizedConfig = normalizeConfig(config);
  const adapter = createMcpSdkAdapter(server);
  const client = createProxyLinkClient({
    apiUrl: normalizedConfig.apiUrl,
    apiKey: normalizedConfig.apiKey,
  });
  const toolNames = buildToolNames(normalizedConfig);

  if (normalizedConfig.features.knowledgeBase && toolNames.knowledgeBaseToolName) {
    registerKnowledgeBaseTool(
      adapter,
      normalizedConfig,
      client,
      toolNames.knowledgeBaseToolName,
    );
  }

  if (
    normalizedConfig.features.tickets &&
    toolNames.getTicketTypesToolName &&
    toolNames.createSupportTicketToolName
  ) {
    registerTicketTools(adapter, normalizedConfig, client, {
      getTicketTypesToolName: toolNames.getTicketTypesToolName,
      createSupportTicketToolName: toolNames.createSupportTicketToolName,
    });
  }

  return toolNames;
}
