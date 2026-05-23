import test from 'node:test';
import assert from 'node:assert/strict';
import { registerProxyLinkSupport } from '../src/index.js';
import {
  HVAC_ADDONS,
  HVAC_TONNAGES,
  getHvacAddOn,
} from '../src/packs/hvac/catalog.js';
import { FakeMcpServer, jsonResponse } from './helpers.js';

const baseConfig = {
  companyName: 'Acme',
  toolPrefix: 'acme',
  apiUrl: 'https://api.example.com',
  apiKey: 'test-key',
};

function profileResponder(hasPricingConfig: boolean) {
  return (input: string) => {
    if (input.endsWith('/tenant/profile')) {
      return jsonResponse({
        success: true,
        profile: {
          industry: 'home-services',
          category: 'hvac',
          hasPricingConfig,
          features: { pricing: true },
        },
      });
    }
    return jsonResponse({ success: false }, { status: 500 });
  };
}

async function withFetch<T>(
  handler: (input: string, init?: RequestInit) => Response | Promise<Response>,
  fn: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init)) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

test('catalog exports expected add-ons and tonnages', () => {
  const ids = HVAC_ADDONS.map(a => a.id);
  assert.deepEqual(ids.sort(), ['attic', 'distance', 'stairs']);
  assert.ok(HVAC_TONNAGES.includes(3));
  assert.equal(getHvacAddOn('stairs')?.pricingType, 'per-unit');
  assert.equal(getHvacAddOn('attic')?.pricingType, 'flat');
});

test('handler returns not-configured response when hasPricingConfig is false', async () => {
  const server = new FakeMcpServer();
  await withFetch(profileResponder(false), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  assert.ok(tool, 'pricing tool should still register');

  const output = (await tool!.handler({
    tonnage: 3,
    addOns: [],
  })) as { content: { text: string }[] };
  assert.match(output.content[0].text, /has not configured/i);
});

test('handler validates per-unit add-on requires quantity', async () => {
  const server = new FakeMcpServer();
  await withFetch(profileResponder(true), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  assert.ok(tool);

  // Calling with stairs but no quantity should fail Zod validation.
  // The MCP SDK normally runs the schema before invoking the handler;
  // here we use the schema directly to assert the behavior.
  const schema = tool!.inputSchema as {
    safeParse: (v: unknown) => { success: boolean };
  };
  const result = schema.safeParse({
    tonnage: 3,
    addOns: [{ id: 'stairs' }],
  });
  assert.equal(result.success, false);
});

test('handler accepts flat add-on without quantity', async () => {
  const server = new FakeMcpServer();
  await withFetch(profileResponder(true), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  const schema = tool!.inputSchema as {
    safeParse: (v: unknown) => { success: boolean };
  };
  const result = schema.safeParse({
    tonnage: 3,
    addOns: [{ id: 'attic' }],
  });
  assert.equal(result.success, true);
});

test('handler rejects flat add-on with quantity', async () => {
  const server = new FakeMcpServer();
  await withFetch(profileResponder(true), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  const schema = tool!.inputSchema as {
    safeParse: (v: unknown) => { success: boolean };
  };
  const result = schema.safeParse({
    tonnage: 3,
    addOns: [{ id: 'attic', quantity: 2 }],
  });
  assert.equal(result.success, false);
});

test('handler rejects invalid tonnage', async () => {
  const server = new FakeMcpServer();
  await withFetch(profileResponder(true), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  const schema = tool!.inputSchema as {
    safeParse: (v: unknown) => { success: boolean };
  };
  const result = schema.safeParse({
    tonnage: 99,
    addOns: [],
  });
  assert.equal(result.success, false);
});
