import type {
  McpAdapter,
  NormalizedProxyLinkSupportConfig,
  ProxyLinkClient,
} from '../types.js';

export interface TenantProfile {
  industry: string;
  category: string;
  hasPricingConfig: boolean;
  features: {
    pricing: boolean;
  };
}

export interface TenantProfileResponse {
  success: boolean;
  profile?: TenantProfile;
  error?: string;
}

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
