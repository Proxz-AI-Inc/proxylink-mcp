import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpSdkAdapter } from './adapter.js';
import { createProxyLinkClient } from './client.js';
import { normalizeConfig } from './config.js';
import { getIndustryPack } from './packs/registry.js';
import type {
  TenantProfile,
  TenantProfileResponse,
} from './packs/types.js';
import { logError } from './logging.js';
import { buildToolNames } from './toolNames.js';
import { registerKnowledgeBaseTool } from './tools/knowledgeBase.js';
import { registerTicketTools } from './tools/tickets.js';
import type {
  ProxyLinkSupportConfig,
  RegisteredProxyLinkTools,
} from './types.js';

export async function registerProxyLinkSupport(
  server: McpServer,
  config: ProxyLinkSupportConfig,
): Promise<RegisteredProxyLinkTools> {
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

  let profile: TenantProfile;
  try {
    const data = await client.requestJson<TenantProfileResponse>(
      '/tenant/profile',
      { method: 'GET' },
    );

    if (!data.success || !data.profile) {
      throw new Error(data.error || 'Failed to fetch tenant profile.');
    }
    profile = data.profile;
  } catch (error) {
    logError(normalizedConfig.logger, 'proxylink_tenant_profile_fetch_failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    removeGenericTicketToolNames(toolNames);
    return toolNames;
  }

  const pack = getIndustryPack(profile.industry, profile.category);

  if (
    normalizedConfig.features.tickets &&
    !pack?.replacesTicketTools &&
    toolNames.getTicketTypesToolName &&
    toolNames.createSupportTicketToolName
  ) {
    registerTicketTools(adapter, normalizedConfig, client, {
      getTicketTypesToolName: toolNames.getTicketTypesToolName,
      createSupportTicketToolName: toolNames.createSupportTicketToolName,
    });
  } else {
    removeGenericTicketToolNames(toolNames);
  }

  if (pack) {
    const industryToolNames = pack.register({
      adapter,
      config: normalizedConfig,
      client,
      profile,
      toolPrefix: normalizedConfig.toolPrefix,
    });
    toolNames.industryToolNames = industryToolNames;
    toolNames.all.push(...industryToolNames);
  } else {
    normalizedConfig.logger?.warn?.('proxylink_unknown_industry', {
      industry: profile.industry,
      category: profile.category,
    });
  }

  return toolNames;
}

function removeGenericTicketToolNames(
  toolNames: RegisteredProxyLinkTools,
): void {
  const namesToRemove = new Set([
    toolNames.getTicketTypesToolName,
    toolNames.createSupportTicketToolName,
  ]);

  toolNames.all = toolNames.all.filter(name => !namesToRemove.has(name));
  delete toolNames.getTicketTypesToolName;
  delete toolNames.createSupportTicketToolName;
}
