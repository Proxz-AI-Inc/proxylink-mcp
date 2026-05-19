import type { ProxyLinkToolDefinition } from '../src/types.js';

type CapturedToolDefinition = Omit<
  ProxyLinkToolDefinition<unknown>,
  'handler'
> & {
  handler: (input: unknown) => unknown;
};

export class FakeMcpServer {
  readonly registeredTools: CapturedToolDefinition[] = [];

  registerTool(
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: unknown;
      outputSchema?: unknown;
      annotations?: Record<string, unknown>;
      _meta?: Record<string, unknown>;
    },
    handler: (input: unknown) => unknown,
  ): unknown {
    this.registeredTools.push({
      name,
      title: config.title ?? '',
      description: config.description ?? '',
      inputSchema: config.inputSchema as ProxyLinkToolDefinition['inputSchema'],
      outputSchema: config.outputSchema as ProxyLinkToolDefinition['outputSchema'],
      annotations: config.annotations,
      meta: config._meta,
      handler,
    });

    return undefined;
  }
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}
