import test from 'node:test';
import assert from 'node:assert/strict';
import { createProxyLinkClient, ProxyLinkApiError } from '../src/client/proxylinkClient.js';
import { jsonResponse } from './helpers.js';

test('queryKnowledgeBase posts to /query with bearer auth', async () => {
  const calls: Request[] = [];
  const client = createProxyLinkClient({
    apiUrl: 'https://api.example.com/',
    apiKey: 'secret',
    fetchFn: async input => {
      calls.push(input as Request);
      return jsonResponse({
        success: true,
        answer: 'Known answer',
      });
    },
  });

  const result = await client.queryKnowledgeBase('question?', 'question?');

  assert.equal(result.answer, 'Known answer');
  assert.equal(String(calls[0]), 'https://api.example.com/query');
});

test('fetchTicketTypes returns ticket types from successful responses', async () => {
  const client = createProxyLinkClient({
    apiUrl: 'https://api.example.com',
    apiKey: 'secret',
    fetchFn: async () =>
      jsonResponse({
        success: true,
        ticketTypes: [
          {
            id: 'billing',
            title: 'Billing',
            description: 'Billing help',
            formFields: [],
          },
        ],
      }),
  });

  const result = await client.fetchTicketTypes();

  assert.equal(result[0]?.id, 'billing');
});

test('createSupportTicket posts ticket payloads', async () => {
  let capturedBody = '';
  const client = createProxyLinkClient({
    apiUrl: 'https://api.example.com',
    apiKey: 'secret',
    fetchFn: async (_input, init) => {
      capturedBody = String(init?.body);
      return jsonResponse({
        success: true,
        ticketId: 'ticket-1',
        message: 'Created',
      });
    },
  });

  const result = await client.createSupportTicket({
    ticketTypeId: 'billing',
    ticketTypeName: 'Billing',
    fields: { account_email: 'user@example.com' },
  });

  assert.equal(result.ticketId, 'ticket-1');
  assert.match(capturedBody, /account_email/);
});

test('non-2xx responses throw ProxyLinkApiError with status', async () => {
  const client = createProxyLinkClient({
    apiUrl: 'https://api.example.com',
    apiKey: 'secret',
    fetchFn: async () =>
      jsonResponse(
        { success: false, error: 'Upstream failed' },
        { status: 500 },
      ),
  });

  await assert.rejects(
    () => client.queryKnowledgeBase('question?'),
    (error: unknown) =>
      error instanceof ProxyLinkApiError &&
      error.status === 500 &&
      error.message === 'Upstream failed',
  );
});
