import type {
  NormalizedProxyLinkSupportConfig,
  ProxyLinkSupportConfig,
} from './types.js';

const TOOL_PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`ProxyLink config ${fieldName} is required.`);
  }

  return value.trim();
}

export function normalizeConfig(
  config: ProxyLinkSupportConfig,
): NormalizedProxyLinkSupportConfig {
  const companyName = requireNonEmptyString(config.companyName, 'companyName');
  const toolPrefix = requireNonEmptyString(config.toolPrefix, 'toolPrefix');
  const apiUrl = trimTrailingSlash(requireNonEmptyString(config.apiUrl, 'apiUrl'));
  const apiKey = requireNonEmptyString(config.apiKey, 'apiKey');

  if (!TOOL_PREFIX_PATTERN.test(toolPrefix)) {
    throw new Error(
      'ProxyLink config toolPrefix must start with a letter and only contain letters, numbers, underscores, or hyphens.',
    );
  }

  return {
    companyName,
    toolPrefix,
    apiUrl,
    apiKey,
    supportTopics:
      config.supportTopics
        ?.map(topic => topic.trim())
        .filter(topic => topic.length > 0) ?? [],
    features: {
      knowledgeBase: config.features?.knowledgeBase ?? true,
      tickets: config.features?.tickets ?? true,
    },
    logger: config.logger,
  };
}
