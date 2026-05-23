import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpSdkAdapter } from '../src/adapter.js';
import { normalizeConfig } from '../src/config.js';
import { buildToolNames } from '../src/toolNames.js';
import { registerKnowledgeBaseTool } from '../src/tools/knowledgeBase.js';
import { registerTicketTools } from '../src/tools/tickets.js';
import type { ProxyLinkClient, ToolOutput } from '../src/index.js';
import { FakeMcpServer } from './helpers.js';

function createClient(overrides: Partial<ProxyLinkClient>): ProxyLinkClient {
  return {
    requestJson: async () => ({}) as never,
    queryKnowledgeBase: async () => ({ success: true, answer: 'Answer' }),
    fetchTicketTypes: async () => [
      {
        id: 'billing',
        title: 'Billing',
        description: 'Billing help',
        formFields: [
          {
            id: 'account_email',
            label: 'Account Email',
            type: 'email',
            required: true,
          },
        ],
      },
    ],
    createSupportTicket: async () => ({
      success: true,
      ticketId: 'ticket-1',
      message: 'Created',
    }),
    ...overrides,
  };
}

test('adapter calls server.registerTool with expected tool config', () => {
  const server = new FakeMcpServer();
  const adapter = createMcpSdkAdapter(server as never);

  adapter.registerTool({
    name: 'acme_test',
    title: 'Test Tool',
    description: 'A test tool',
    inputSchema: {} as never,
    annotations: { readOnlyHint: true },
    handler: () => ({ content: [{ type: 'text', text: 'ok' }] }),
  });

  assert.equal(server.registeredTools[0]?.name, 'acme_test');
  assert.equal(server.registeredTools[0]?.title, 'Test Tool');
  assert.deepEqual(server.registeredTools[0]?.annotations, {
    readOnlyHint: true,
  });
});

test('knowledge base handler returns safe output for upstream failures', async () => {
  const server = new FakeMcpServer();
  const config = normalizeConfig({
    companyName: 'Acme',
    toolPrefix: 'acme',
    apiUrl: 'https://api.example.com',
    apiKey: 'secret',
  });

  registerKnowledgeBaseTool(
    createMcpSdkAdapter(server as never),
    config,
    createClient({
      queryKnowledgeBase: async () => {
        throw new Error('Internal details');
      },
    }),
    'acme_search_knowledge_base',
  );

  const result = (await server.registeredTools[0]?.handler({
    query: 'question?',
  })) as ToolOutput;

  assert.equal(result.isError, true);
  assert.equal(result.content[0]?.text, 'An error occurred while searching. Please try again.');
});

test('ticket creation handler validates fields before creating tickets', async () => {
  const server = new FakeMcpServer();
  const config = normalizeConfig({
    companyName: 'Acme',
    toolPrefix: 'acme',
    apiUrl: 'https://api.example.com',
    apiKey: 'secret',
  });
  const toolNames = buildToolNames(config);

  registerTicketTools(
    createMcpSdkAdapter(server as never),
    config,
    createClient({}),
    {
      getTicketTypesToolName: toolNames.getTicketTypesToolName!,
      createSupportTicketToolName: toolNames.createSupportTicketToolName!,
    },
  );

  const createTool = server.registeredTools.find(
    tool => tool.name === 'acme_create_support_ticket',
  );
  const result = (await createTool?.handler({
    ticketTypeId: 'billing',
    ticketTypeName: 'Billing',
    fields: { wrong: 'field' },
  })) as ToolOutput;

  assert.equal(result.structuredContent?.success, false);
  assert.match(result.content[0]?.text ?? '', /Invalid field IDs detected/);
});

test('ticket creation handler sends valid tickets with authoritative ticket title', async () => {
  const server = new FakeMcpServer();
  const config = normalizeConfig({
    companyName: 'Acme',
    toolPrefix: 'acme',
    apiUrl: 'https://api.example.com',
    apiKey: 'secret',
  });
  let ticketTypeName = '';

  registerTicketTools(
    createMcpSdkAdapter(server as never),
    config,
    createClient({
      createSupportTicket: async ticket => {
        ticketTypeName = ticket.ticketTypeName;
        return {
          success: true,
          ticketId: 'ticket-1',
          message: 'Created',
        };
      },
    }),
    {
      getTicketTypesToolName: 'acme_get_ticket_types',
      createSupportTicketToolName: 'acme_create_support_ticket',
    },
  );

  const createTool = server.registeredTools.find(
    tool => tool.name === 'acme_create_support_ticket',
  );
  const result = (await createTool?.handler({
    ticketTypeId: 'billing',
    ticketTypeName: 'Invented Name',
    fields: { account_email: 'user@example.com' },
  })) as ToolOutput;

  assert.equal(ticketTypeName, 'Billing');
  assert.equal(result.structuredContent?.success, true);
});
