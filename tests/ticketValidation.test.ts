import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTicketInput } from '../src/validation.js';
import type { TicketType } from '../src/index.js';

const ticketTypes: TicketType[] = [
  {
    id: 'billing',
    title: 'Billing Request',
    description: 'Billing help',
    formFields: [
      {
        id: 'account_email',
        label: 'Account Email',
        type: 'email',
        required: true,
      },
      {
        id: 'details',
        label: 'Details',
        type: 'textarea',
        required: false,
      },
    ],
  },
];

test('rejects invalid ticket type IDs', () => {
  const result = validateTicketInput(
    {
      ticketTypeId: 'missing',
      ticketTypeName: 'Missing',
      fields: { account_email: 'user@example.com' },
    },
    ticketTypes,
    'acme_get_ticket_types',
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /Invalid ticket type ID/);
});

test('rejects unknown field IDs', () => {
  const result = validateTicketInput(
    {
      ticketTypeId: 'billing',
      ticketTypeName: 'Billing Request',
      fields: {
        account_email: 'user@example.com',
        invented_field: 'value',
      },
    },
    ticketTypes,
    'acme_get_ticket_types',
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /Invalid field IDs detected/);
});

test('rejects missing required fields', () => {
  const result = validateTicketInput(
    {
      ticketTypeId: 'billing',
      ticketTypeName: 'Billing Request',
      fields: { details: 'Need help' },
    },
    ticketTypes,
    'acme_get_ticket_types',
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /Missing required fields/);
});

test('accepts valid ticket payloads', () => {
  const result = validateTicketInput(
    {
      ticketTypeId: 'billing',
      ticketTypeName: 'Billing Request',
      fields: {
        account_email: 'user@example.com',
        details: 'Need help',
      },
    },
    ticketTypes,
    'acme_get_ticket_types',
  );

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.ticketType.title, 'Billing Request');
  }
});
