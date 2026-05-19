import type {
  NormalizedProxyLinkSupportConfig,
  RegisteredProxyLinkTools,
} from './types.js';

export function buildToolNames(
  config: NormalizedProxyLinkSupportConfig,
): RegisteredProxyLinkTools {
  const names: RegisteredProxyLinkTools = { all: [] };

  if (config.features.knowledgeBase) {
    names.knowledgeBaseToolName = `${config.toolPrefix}_search_knowledge_base`;
    names.all.push(names.knowledgeBaseToolName);
  }

  if (config.features.tickets) {
    names.getTicketTypesToolName = `${config.toolPrefix}_get_ticket_types`;
    names.createSupportTicketToolName = `${config.toolPrefix}_create_support_ticket`;
    names.all.push(names.getTicketTypesToolName, names.createSupportTicketToolName);
  }

  return names;
}
