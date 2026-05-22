import type {
  McpAdapter,
  NormalizedProxyLinkSupportConfig,
  ProxyLinkClient,
  TenantProfile,
} from '../types.js';

export interface IndustryPackContext {
  adapter: McpAdapter;
  config: NormalizedProxyLinkSupportConfig;
  client: ProxyLinkClient;
  profile: TenantProfile;
  toolPrefix: string;
}

export interface IndustryPack {
  id: string;
  register(context: IndustryPackContext): string[];
}
