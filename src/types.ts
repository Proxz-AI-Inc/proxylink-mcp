import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';

export interface ProxyLinkLogger {
  debug?: (message: string, meta?: Record<string, unknown>) => void;
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
}

export interface ProxyLinkSupportConfig {
  companyName: string;
  toolPrefix: string;
  apiUrl: string;
  apiKey: string;
  supportTopics?: string[];
  features?: {
    knowledgeBase?: boolean;
    tickets?: boolean;
  };
  logger?: ProxyLinkLogger;
}

export interface NormalizedProxyLinkSupportConfig {
  companyName: string;
  toolPrefix: string;
  apiUrl: string;
  apiKey: string;
  supportTopics: string[];
  features: {
    knowledgeBase: boolean;
    tickets: boolean;
  };
  logger?: ProxyLinkLogger;
}

export interface RegisteredProxyLinkTools {
  all: string[];
  knowledgeBaseToolName?: string;
  getTicketTypesToolName?: string;
  createSupportTicketToolName?: string;
  industryToolNames?: string[];
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolOutput {
  _meta?: Record<string, unknown>;
  structuredContent?: Record<string, unknown>;
  content: TextContent[];
  isError?: boolean;
}

export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface QueryResponse {
  success: boolean;
  queryId?: string;
  answer?: string;
  usedWebFallback?: boolean;
  webAnswer?: string;
  webSources?: WebSearchSource[];
  error?: string;
}

export interface ConversationMessage {
  timestamp: string;
  source: 'user' | 'agent';
  message: string;
}

export interface CreateTicketInput {
  ticketTypeId: string;
  ticketTypeName: string;
  fields: Record<string, string | number | boolean>;
  conversation?: ConversationMessage[];
}

export interface CreateTicketRequest extends CreateTicketInput {}

export interface CreateTicketResponse {
  success: boolean;
  ticketId?: string;
  message?: string;
  error?: string;
}

export interface TicketTypeFormField {
  id: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'date'
    | 'email'
    | 'phone'
    | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface TicketType {
  id: string;
  title: string;
  description: string;
  notice?: string;
  formFields: TicketTypeFormField[];
}

export interface TicketTypesResponse {
  success: boolean;
  ticketTypes?: TicketType[];
  error?: string;
}

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

export interface PricingLookupAddOnInput {
  id: string;
  quantity?: number;
}

export interface PricingLookupRequest {
  category: string;
  params: {
    tonnage: number;
    tierId?: 'low' | 'mid' | 'high';
    addOns: PricingLookupAddOnInput[];
  };
}

export interface PricingPriceRangeCents {
  lowCents: number;
  highCents: number;
}

export interface PricingLookupTier {
  id: 'low' | 'mid' | 'high';
  brand: string;
  baseRangeCents: PricingPriceRangeCents;
  addOnsTotalCents: number;
  totalRangeCents: PricingPriceRangeCents;
}

export interface PricingLookupAddOn {
  id: string;
  amountCents: number;
}

export interface PricingLookupResponse {
  success: boolean;
  currency?: 'USD';
  tonnage?: number;
  tiers?: PricingLookupTier[];
  addOns?: PricingLookupAddOn[];
  error?: string;
}

export interface ProxyLinkClient {
  queryKnowledgeBase(
    query: string,
    originalQuestion?: string,
  ): Promise<QueryResponse>;
  fetchTicketTypes(): Promise<TicketType[]>;
  createSupportTicket(
    ticket: CreateTicketRequest,
  ): Promise<CreateTicketResponse>;
  fetchTenantProfile(): Promise<TenantProfile>;
  pricingLookup(request: PricingLookupRequest): Promise<PricingLookupResponse>;
}

export interface ProxyLinkToolDefinition<Input = Record<string, unknown>> {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema?: z.ZodType;
  annotations?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  handler: (input: Input) => Promise<ToolOutput> | ToolOutput;
}

export interface McpAdapter {
  registerTool<Input>(definition: ProxyLinkToolDefinition<Input>): unknown;
}

export type McpServerLike = Pick<McpServer, 'registerTool'>;
