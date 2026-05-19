import test from 'node:test';
import assert from 'node:assert/strict';
import { registerProxyLinkSupport } from '../src/index.js';
import { FakeMcpServer } from './helpers.js';

const baseConfig = {
  companyName: 'Acme',
  toolPrefix: 'acme',
  apiUrl: 'https://api.example.com',
  apiKey: 'test-key',
};

test('registers deterministic tool names with default features', () => {
  const server = new FakeMcpServer();

  const result = registerProxyLinkSupport(server as never, baseConfig);

  assert.deepEqual(result, {
    all: [
      'acme_search_knowledge_base',
      'acme_get_ticket_types',
      'acme_create_support_ticket',
    ],
    knowledgeBaseToolName: 'acme_search_knowledge_base',
    getTicketTypesToolName: 'acme_get_ticket_types',
    createSupportTicketToolName: 'acme_create_support_ticket',
  });
  assert.deepEqual(
    server.registeredTools.map(tool => tool.name),
    result.all,
  );
});

test('supports knowledge-base-only feature registration', () => {
  const server = new FakeMcpServer();

  const result = registerProxyLinkSupport(server as never, {
    ...baseConfig,
    features: { tickets: false },
  });

  assert.deepEqual(result.all, ['acme_search_knowledge_base']);
  assert.equal(server.registeredTools.length, 1);
});

test('supports tickets-only feature registration', () => {
  const server = new FakeMcpServer();

  const result = registerProxyLinkSupport(server as never, {
    ...baseConfig,
    features: { knowledgeBase: false },
  });

  assert.deepEqual(result.all, [
    'acme_get_ticket_types',
    'acme_create_support_ticket',
  ]);
  assert.equal(server.registeredTools.length, 2);
});

test('rejects invalid tool prefixes before registering tools', () => {
  const server = new FakeMcpServer();

  assert.throws(
    () =>
      registerProxyLinkSupport(server as never, {
        ...baseConfig,
        toolPrefix: 'bad prefix',
      }),
    /toolPrefix/,
  );
  assert.equal(server.registeredTools.length, 0);
});
