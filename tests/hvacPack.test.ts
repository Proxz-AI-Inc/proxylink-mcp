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

function profileAndPricingResponder(
  pricingResponse: unknown,
  pricingStatus = 200,
) {
  return (input: string) => {
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
    if (input.endsWith('/pricing/lookup')) {
      return jsonResponse(pricingResponse, { status: pricingStatus });
    }
    return jsonResponse({ success: false }, { status: 500 });
  };
}

const samplePricingSuccess = {
  success: true,
  currency: 'USD' as const,
  tonnage: 3,
  tiers: [
    {
      id: 'mid' as const,
      brand: 'Trane',
      baseRangeCents: { lowCents: 800000, highCents: 1000000 },
      addOnsTotalCents: 0,
      totalRangeCents: { lowCents: 800000, highCents: 1000000 },
    },
  ],
  addOns: [],
};

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

const validJobDetails = {
  flightsOfStairs: 0,
  inAtticWithDropDownLadder: false,
  canParkWithin100Ft: true,
};

test('handler returns funnel response when hasPricingConfig is false', async () => {
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
    jobDetails: validJobDetails,
  })) as { content: { text: string }[]; structuredContent?: { message?: string } };
  assert.match(output.content[0].text, /acme_show_appointment_scheduler/);
  assert.match(output.content[0].text, /REQUIRED NEXT STEP/);
  assert.match(output.content[0].text, /free in-home estimate/i);
  assert.equal(output.structuredContent?.message, 'pricing-not-configured');
});

test('schema rejects payloads missing jobDetails entirely', async () => {
  const server = new FakeMcpServer();
  await withFetch(profileResponder(true), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  assert.ok(tool);

  const schema = tool!.inputSchema as {
    safeParse: (v: unknown) => { success: boolean };
  };
  const result = schema.safeParse({ tonnage: 3 });
  assert.equal(result.success, false);
});

test('schema rejects payloads missing any single jobDetails field', async () => {
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

  const missingStairs = schema.safeParse({
    tonnage: 3,
    jobDetails: {
      inAtticWithDropDownLadder: false,
      canParkWithin100Ft: true,
    },
  });
  assert.equal(missingStairs.success, false);

  const missingAttic = schema.safeParse({
    tonnage: 3,
    jobDetails: {
      flightsOfStairs: 0,
      canParkWithin100Ft: true,
    },
  });
  assert.equal(missingAttic.success, false);

  const missingParking = schema.safeParse({
    tonnage: 3,
    jobDetails: {
      flightsOfStairs: 0,
      inAtticWithDropDownLadder: false,
    },
  });
  assert.equal(missingParking.success, false);
});

test('schema rejects negative flightsOfStairs', async () => {
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
    jobDetails: { ...validJobDetails, flightsOfStairs: -1 },
  });
  assert.equal(result.success, false);
});

test('schema accepts a fully-specified payload with all gate answers', async () => {
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
    jobDetails: {
      flightsOfStairs: 2,
      inAtticWithDropDownLadder: true,
      canParkWithin100Ft: false,
    },
  });
  assert.equal(result.success, true);
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
    jobDetails: validJobDetails,
  });
  assert.equal(result.success, false);
});

test('description on configured branch contains funnel framing and scheduler reference', async () => {
  const server = new FakeMcpServer();
  await withFetch(profileResponder(true), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  assert.ok(tool);
  assert.match(tool!.description!, /acme_show_appointment_scheduler/);
  assert.match(tool!.description!, /GATE 1/);
  assert.match(tool!.description!, /GATE 2/);
  assert.match(tool!.description!, /skip pricing entirely/i);
  assert.match(tool!.description!, /video consultation/i);
  assert.match(tool!.description!, /jobDetails\.flightsOfStairs/);
  assert.match(tool!.description!, /jobDetails\.inAtticWithDropDownLadder/);
  assert.match(tool!.description!, /jobDetails\.canParkWithin100Ft/);
});

test('description on not-configured branch contains aggressive scheduling pivot', async () => {
  const server = new FakeMcpServer();
  await withFetch(profileResponder(false), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  assert.ok(tool);
  assert.match(tool!.description!, /acme_show_appointment_scheduler/);
  assert.match(tool!.description!, /IMMEDIATELY/);
  assert.match(tool!.description!, /pivot directly to scheduling/i);
});

test('successful pricing response contains REQUIRED NEXT STEP + scheduler reference', async () => {
  const server = new FakeMcpServer();
  await withFetch(profileAndPricingResponder(samplePricingSuccess), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  assert.ok(tool);

  const output = (await tool!.handler({
    tonnage: 3,
    jobDetails: validJobDetails,
  })) as { content: { text: string }[]; structuredContent?: { success?: boolean } };
  assert.equal(output.structuredContent?.success, true);
  assert.match(output.content[0].text, /REQUIRED NEXT STEP/);
  assert.match(output.content[0].text, /acme_show_appointment_scheduler/);
  assert.match(output.content[0].text, /Replacement pricing for 3-ton unit/);
});

test('API-error response stays neutral and does not upsell scheduling', async () => {
  const server = new FakeMcpServer();
  const apiErrorResponse = { success: false, error: 'Tonnage 3 is not configured for this tenant.' };
  await withFetch(profileAndPricingResponder(apiErrorResponse), () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  assert.ok(tool);

  const output = (await tool!.handler({
    tonnage: 3,
    jobDetails: validJobDetails,
  })) as { content: { text: string }[]; isError?: boolean };
  assert.equal(output.isError, true);
  assert.doesNotMatch(output.content[0].text, /acme_show_appointment_scheduler/);
  assert.doesNotMatch(output.content[0].text, /REQUIRED NEXT STEP/);
});

test('handler forwards jobDetails verbatim on the wire to /pricing/lookup', async () => {
  const server = new FakeMcpServer();
  const capturedBodies: unknown[] = [];
  const responder = (input: string, init?: RequestInit) => {
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
    if (input.endsWith('/pricing/lookup')) {
      capturedBodies.push(JSON.parse(String(init?.body ?? '{}')));
      return jsonResponse(samplePricingSuccess);
    }
    return jsonResponse({ success: false }, { status: 500 });
  };

  await withFetch(responder, () =>
    registerProxyLinkSupport(server as never, baseConfig),
  );

  const tool = server.registeredTools.find(
    t => t.name === 'acme_replacement_pricing',
  );
  assert.ok(tool);

  const jobDetails = {
    flightsOfStairs: 2,
    inAtticWithDropDownLadder: true,
    canParkWithin100Ft: false,
  };
  await tool!.handler({ tonnage: 3, jobDetails });

  assert.equal(capturedBodies.length, 1);
  const body = capturedBodies[0] as {
    category: string;
    params: { tonnage: number; jobDetails: unknown; addOns?: unknown };
  };
  assert.equal(body.category, 'hvac');
  assert.equal(body.params.tonnage, 3);
  assert.deepEqual(body.params.jobDetails, jobDetails);
  assert.equal(body.params.addOns, undefined);
});
