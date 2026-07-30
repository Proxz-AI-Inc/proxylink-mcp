import test from 'node:test';
import assert from 'node:assert/strict';
import { registerProxyLinkSupport } from '../src/index.js';
import type { ToolOutput } from '../src/index.js';
import { FakeMcpServer, jsonResponse } from './helpers.js';

const baseConfig = {
  companyName: 'Acme',
  toolPrefix: 'acme',
  apiUrl: 'https://api.example.com',
  apiKey: 'test-key',
};

const conferenceProfile = {
  success: true,
  profile: {
    industry: 'conferences',
    category: '',
    hasPricingConfig: false,
    features: { pricing: false },
  },
};

const events = [
  {
    id: 'event-1',
    title: 'Annual Summit',
    startsAt: '2026-10-05T14:00:00Z',
    endsAt: '2026-10-07T23:00:00Z',
    timezone: 'America/Chicago',
    location: 'Austin Convention Center',
    registrationInterest: {
      title: 'Request registration',
      description: 'Tell the conference team you want to attend.',
      notice: 'Registration is not confirmed.',
      formFields: [
        {
          id: 'full-name',
          label: 'Full name',
          type: 'text',
          required: true,
        },
      ],
    },
  },
];

const actions = [
  {
    id: 'action-1',
    title: 'Request a membership letter',
    description: 'Ask the team for a current membership letter.',
    formFields: [
      {
        id: 'purpose',
        label: 'Purpose',
        type: 'text',
        required: true,
      },
    ],
  },
];

type FetchHandler = (
  input: string,
  init?: RequestInit,
) => Response | Promise<Response>;

async function withFetch<T>(
  handler: FetchHandler,
  fn: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init)) as typeof fetch;

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function registerConferenceServer(
  handler: FetchHandler,
  logger?: {
    error?: (message: string, meta?: Record<string, unknown>) => void;
  },
): Promise<FakeMcpServer> {
  const server = new FakeMcpServer();

  await withFetch(handler, () =>
    registerProxyLinkSupport(server as never, {
      ...baseConfig,
      logger,
    }),
  );

  return server;
}

function profileResponse(input: string): Response | undefined {
  if (input.endsWith('/tenant/profile')) {
    return jsonResponse(conferenceProfile);
  }
  return undefined;
}

test('conference tools expose the required names, annotations, and confirmation wording', async () => {
  const server = await registerConferenceServer(input => {
    return (
      profileResponse(input) ??
      jsonResponse({ success: false }, { status: 500 })
    );
  });

  const tools = server.registeredTools.filter(
    tool => tool.name !== 'acme_search_knowledge_base',
  );

  assert.deepEqual(
    tools.map(tool => tool.name),
    [
      'acme_get_events',
      'acme_submit_event_registration_interest',
      'acme_get_member_actions',
      'acme_submit_member_action',
    ],
  );

  for (const tool of tools) {
    assert.equal(tool.annotations?.title, tool.title);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, false);
  }

  assert.deepEqual(tools[0]?.annotations, {
    title: 'Get Acme Conference Events',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });
  assert.deepEqual(tools[1]?.annotations, {
    title: 'Submit Acme Event Registration Interest',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
  assert.deepEqual(tools[2]?.annotations, {
    title: 'Get Acme Member Actions',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });
  assert.deepEqual(tools[3]?.annotations, {
    title: 'Submit Acme Member Action',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
  assert.match(
    tools[1]?.description ?? '',
    /call acme_get_events/i,
  );
  assert.match(tools[1]?.description ?? '', /explicitly confirms/i);
  assert.match(tools[1]?.description ?? '', /does not confirm registration/i);
  assert.match(
    tools[3]?.description ?? '',
    /call acme_get_member_actions/i,
  );
  assert.match(tools[3]?.description ?? '', /explicitly confirms/i);

  const parsed = tools[1]?.inputSchema.safeParse({
    eventId: 'event-1',
    fields: { 'full-name': 'Ada Lovelace' },
    conversation: [{ source: 'user', message: 'Do not send' }],
  });
  assert.equal(parsed?.success, true);
  if (parsed?.success) {
    assert.equal('conversation' in parsed.data, false);
  }
});

test('get events returns structured event and registration-interest definitions', async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const server = await registerConferenceServer((input, init) => {
    calls.push({ url: input, method: init?.method });

    return (
      profileResponse(input) ??
      jsonResponse({ success: true, events })
    );
  });
  const tool = server.registeredTools.find(
    item => item.name === 'acme_get_events',
  );

  const output = (await tool?.handler({})) as ToolOutput;

  assert.equal(calls.at(-1)?.url, 'https://api.example.com/events');
  assert.equal(calls.at(-1)?.method, 'GET');
  assert.deepEqual(output.structuredContent, {
    success: true,
    events,
  });
  assert.match(output.content[0]?.text ?? '', /Annual Summit/);
  assert.match(output.content[0]?.text ?? '', /full-name/);
});

test('event-interest submission sends only fields and always returns the disclaimer', async () => {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  const server = await registerConferenceServer((input, init) => {
    calls.push({
      url: input,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });

    return (
      profileResponse(input) ??
      jsonResponse({
        success: true,
        ticketId: 'ticket-1',
        message: 'Interest recorded.',
      })
    );
  });
  const tool = server.registeredTools.find(
    item => item.name === 'acme_submit_event_registration_interest',
  );

  const output = (await tool?.handler({
    eventId: 'event/1',
    fields: { 'full-name': 'Ada Lovelace' },
    conversation: [{ source: 'user', message: 'Do not send' }],
  })) as ToolOutput;

  assert.deepEqual(calls.at(-1), {
    url: 'https://api.example.com/events/event%2F1/registration-interest',
    method: 'POST',
    body: {
      fields: { 'full-name': 'Ada Lovelace' },
    },
  });
  assert.deepEqual(output.structuredContent, {
    success: true,
    ticketId: 'ticket-1',
    message:
      'Your interest has been recorded. This does not confirm registration.',
  });
  assert.match(output.content[0]?.text ?? '', /does not confirm registration/i);
});

test('Member Action tools use the actions API and preserve its success message', async () => {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  const server = await registerConferenceServer((input, init) => {
    calls.push({
      url: input,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });

    if (input.endsWith('/tenant/profile')) {
      return jsonResponse(conferenceProfile);
    }
    if (input.endsWith('/actions')) {
      return jsonResponse({ success: true, actions });
    }
    return jsonResponse({
      success: true,
      ticketId: 'ticket-2',
      message: 'Your submission was received successfully.',
    });
  });
  const getTool = server.registeredTools.find(
    item => item.name === 'acme_get_member_actions',
  );
  const submitTool = server.registeredTools.find(
    item => item.name === 'acme_submit_member_action',
  );

  const getOutput = (await getTool?.handler({})) as ToolOutput;
  const submitOutput = (await submitTool?.handler({
    actionId: 'action/1',
    fields: { purpose: 'Employer' },
    conversation: [{ source: 'user', message: 'Do not send' }],
  })) as ToolOutput;

  assert.deepEqual(getOutput.structuredContent, {
    success: true,
    actions,
  });
  assert.deepEqual(
    calls.find(call => call.url === 'https://api.example.com/actions'),
    {
      url: 'https://api.example.com/actions',
      method: 'GET',
      body: undefined,
    },
  );
  assert.deepEqual(calls.at(-1), {
    url: 'https://api.example.com/actions/action%2F1/submit',
    method: 'POST',
    body: {
      fields: { purpose: 'Employer' },
    },
  });
  assert.deepEqual(submitOutput.structuredContent, {
    success: true,
    ticketId: 'ticket-2',
    message: 'Your submission was received successfully.',
  });
});

test('conference API failures return safe errors and stable logs', async () => {
  const errors: { message: string; meta?: Record<string, unknown> }[] = [];
  const server = await registerConferenceServer(
    input => {
      return (
        profileResponse(input) ??
        jsonResponse(
          { success: false, error: 'Private upstream details' },
          { status: 500 },
        )
      );
    },
    {
      error: (message, meta) => errors.push({ message, meta }),
    },
  );
  const tool = server.registeredTools.find(
    item => item.name === 'acme_get_events',
  );

  const output = (await tool?.handler({})) as ToolOutput;

  assert.equal(output.isError, true);
  assert.equal(
    output.content[0]?.text,
    'An error occurred while retrieving conference events. Please try again.',
  );
  assert.ok(
    errors.some(error => error.message === 'proxylink_get_conference_events_failed'),
  );
});
