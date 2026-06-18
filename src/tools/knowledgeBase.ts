import {
  searchInput,
  searchOutput,
} from '../schemas.js';
import { errorOutput, structuredOutput } from '../response.js';
import { logError } from '../logging.js';
import type {
  McpAdapter,
  NormalizedProxyLinkSupportConfig,
  ProxyLinkClient,
  ToolOutput,
} from '../types.js';

function buildSearchDescription(config: NormalizedProxyLinkSupportConfig): string {
  const topics =
    config.supportTopics.length > 0
      ? ` about ${config.supportTopics.join(', ')}`
      : '';

  return `Use this when the user asks support questions${topics} for ${config.companyName}. Returns synthesized answers from ${config.companyName}'s knowledge base. Do not use for unrelated general questions.`;
}

export function registerKnowledgeBaseTool(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  client: ProxyLinkClient,
  toolName: string,
): void {
  adapter.registerTool<{ query: string }>({
    name: toolName,
    title: `Search ${config.companyName} Knowledge Base`,
    description: buildSearchDescription(config),
    inputSchema: searchInput,
    outputSchema: searchOutput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async handler({ query }): Promise<ToolOutput> {
      const trimmedQuery = query.trim();

      if (!trimmedQuery) {
        return errorOutput('Please provide a valid query.');
      }

      try {
        const result = await client.queryKnowledgeBase(trimmedQuery, trimmedQuery);

        if (!result.success || !result.answer) {
          const message =
            result.error ||
            'Unable to find an answer. Please try rephrasing your question.';

          return errorOutput(message);
        }

        return structuredOutput(
          {
            success: true,
            answer: result.answer,
            usedWebFallback: result.usedWebFallback ?? false,
            webSources: result.webSources ?? [],
          },
          result.answer,
        );
      } catch (error) {
        logError(config.logger, 'proxylink_search_knowledge_base_failed', {
          toolName,
          query: trimmedQuery,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return errorOutput(
          'An error occurred while searching. Please try again.',
          undefined,
          true,
        );
      }
    },
  });
}
