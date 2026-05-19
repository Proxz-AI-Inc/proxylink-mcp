import type {
  CreateTicketRequest,
  CreateTicketResponse,
  ProxyLinkClient,
  QueryResponse,
  TicketType,
  TicketTypesResponse,
} from '../types.js';

export interface ProxyLinkClientOptions {
  apiUrl: string;
  apiKey: string;
  fetchFn?: typeof fetch;
}

export class ProxyLinkApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ProxyLinkApiError';
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function readErrorMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: unknown };

  if (typeof data.error === 'string' && data.error.trim().length > 0) {
    return data.error;
  }

  return `ProxyLink API request failed with status ${response.status}.`;
}

export function createProxyLinkClient(
  options: ProxyLinkClientOptions,
): ProxyLinkClient {
  const apiUrl = trimTrailingSlash(options.apiUrl);
  const fetchImpl = options.fetchFn ?? fetch;

  async function requestJson<T>(
    path: string,
    init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> },
  ): Promise<T> {
    const response = await fetchImpl(`${apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new ProxyLinkApiError(await readErrorMessage(response), response.status);
    }

    return response.json() as Promise<T>;
  }

  return {
    queryKnowledgeBase(
      query: string,
      originalQuestion?: string,
    ): Promise<QueryResponse> {
      return requestJson<QueryResponse>('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          original_question: originalQuestion,
        }),
      });
    },

    async fetchTicketTypes(): Promise<TicketType[]> {
      const data = await requestJson<TicketTypesResponse>('/ticket-types', {
        method: 'GET',
      });

      if (!data.success || !data.ticketTypes) {
        throw new ProxyLinkApiError(data.error || 'Failed to fetch ticket types.');
      }

      return data.ticketTypes;
    },

    createSupportTicket(
      ticket: CreateTicketRequest,
    ): Promise<CreateTicketResponse> {
      return requestJson<CreateTicketResponse>('/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket),
      });
    },
  };
}
