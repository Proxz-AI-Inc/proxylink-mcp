import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpAdapter, ProxyLinkToolDefinition } from '../types.js';

interface RegisterToolServer {
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
  ): unknown;
}

export function createMcpSdkAdapter(server: McpServer): McpAdapter {
  const mcpServer = server as unknown as RegisterToolServer;

  return {
    registerTool<Input>(definition: ProxyLinkToolDefinition<Input>): unknown {
      return mcpServer.registerTool(
        definition.name,
        {
          title: definition.title,
          description: definition.description,
          inputSchema: definition.inputSchema,
          outputSchema: definition.outputSchema,
          annotations: definition.annotations,
          _meta: definition.meta,
        },
        definition.handler as (input: unknown) => unknown,
      );
    },
  };
}
