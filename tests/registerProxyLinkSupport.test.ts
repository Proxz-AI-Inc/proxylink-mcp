import test from 'node:test';
import assert from 'node:assert/strict';
import { registerProxyLinkSupport } from '../src/index.js';
import { FakeMcpServer, jsonResponse } from './helpers.js';

const baseConfig = {
  companyName: 'Acme',
  toolPrefix: 'acme',
  apiUrl: 'https://api.example.com',
  apiKey: 'test-key',
};

interface FetchHandler {
  (input: string, init?: RequestInit): Promise<Response>;
}

async function withMockedFetch<T>(
  handler: FetchHandler,
  fn: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init)) as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

const profileFailing: FetchHandler = async () =>
  jsonResponse({ success: false, error: 'no profile' }, { status: 404 });

const profileUnknown: FetchHandler = async input => {
  if (input.endsWith('/tenant/profile')) {
    return jsonResponse({
      success: true,
      profile: {
        industry: 'unknown',
        category: 'unknown',
        hasPricingConfig: false,
        features: { pricing: false },
      },
    });
  }
  return jsonResponse({ success: false }, { status: 500 });
};

const profileHvacConfigured: FetchHandler = async input => {
  if (input.endsWith('/tenant/profile')) {
    return jsonResponse({
      success: true,
      profile: {
        industry: 'home-services',
        category: 'hvac',
        hasPricingConfig: true,
        features: { pricing: true },
      },
    });
  }
  return jsonResponse({ success: false }, { status: 500 });
};

test('registers deterministic core tool names when profile fetch fails', async () => {
  const server = new FakeMcpServer();

  const result = await withMockedFetch(profileFailing, () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  assert.deepEqual(result.all, [
    'acme_search_knowledge_base',
    'acme_get_ticket_types',
    'acme_create_support_ticket',
  ]);
  assert.equal(server.registeredTools.length, 3);
});

test('supports knowledge-base-only feature registration', async () => {
  const server = new FakeMcpServer();

  const result = await withMockedFetch(profileFailing, () =>
    registerProxyLinkSupport(server as never, {
      ...baseConfig,
      features: { tickets: false },
    }),
  );

  assert.deepEqual(result.all, ['acme_search_knowledge_base']);
  assert.equal(server.registeredTools.length, 1);
});

test('supports tickets-only feature registration', async () => {
  const server = new FakeMcpServer();

  const result = await withMockedFetch(profileFailing, () =>
    registerProxyLinkSupport(server as never, {
      ...baseConfig,
      features: { knowledgeBase: false },
    }),
  );

  assert.deepEqual(result.all, [
    'acme_get_ticket_types',
    'acme_create_support_ticket',
  ]);
  assert.equal(server.registeredTools.length, 2);
});

test('rejects invalid tool prefixes before registering tools', async () => {
  const server = new FakeMcpServer();

  await assert.rejects(
    () =>
      registerProxyLinkSupport(server as never, {
        ...baseConfig,
        toolPrefix: 'bad prefix',
      }),
    /toolPrefix/,
  );
  assert.equal(server.registeredTools.length, 0);
});

test('skips vertical tools when industry is unknown', async () => {
  const server = new FakeMcpServer();
  const warnings: { message: string; meta?: Record<string, unknown> }[] = [];

  const result = await withMockedFetch(profileUnknown, () =>
    registerProxyLinkSupport(server as never, {
      ...baseConfig,
      logger: {
        warn: (message, meta) => warnings.push({ message, meta }),
      },
    }),
  );

  assert.equal(result.industryToolNames, undefined);
  assert.ok(
    warnings.some(w => w.message === 'proxylink_unknown_industry'),
    'should log unknown industry warning',
  );
});

test('registers HVAC pricing tool when profile matches home-services/hvac', async () => {
  const server = new FakeMcpServer();

  const result = await withMockedFetch(profileHvacConfigured, () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  assert.deepEqual(result.industryToolNames, ['acme_replacement_pricing']);
  assert.ok(
    server.registeredTools.some(t => t.name === 'acme_replacement_pricing'),
    'HVAC pricing tool should be registered',
  );
  assert.ok(result.all.includes('acme_replacement_pricing'));
});
