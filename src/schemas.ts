import { z } from 'zod';

const conversationMessageSchema = z.object({
  timestamp: z.string().describe('ISO 8601 timestamp of the message.'),
  source: z
    .enum(['user', 'agent'])
    .describe("Who sent the message: 'user' or 'agent'."),
  message: z.string().describe('The message content.'),
});

const ticketTypeFormFieldOutput = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum([
    'text',
    'textarea',
    'select',
    'checkbox',
    'date',
    'email',
    'phone',
    'number',
  ]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

const ticketTypeOutput = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  notice: z.string().optional(),
  formFields: z.array(ticketTypeFormFieldOutput),
});

export const searchInput = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "The user's support question in natural language. Use a complete question rather than a single keyword.",
    ),
});

export const searchOutput = z.object({
  success: z.boolean(),
  answer: z.string().optional(),
  usedWebFallback: z.boolean().optional(),
  webSources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      }),
    )
    .optional(),
  message: z.string().optional(),
});

export const getTicketTypesInput = z.object({});

export const getTicketTypesOutput = z.object({
  success: z.boolean(),
  ticketTypes: z.array(ticketTypeOutput),
  message: z.string().optional(),
});

export const createTicketInput = z.object({
  ticketTypeId: z
    .string()
    .min(1)
    .describe('The ticket type ID returned by the get ticket types tool.'),
  ticketTypeName: z
    .string()
    .min(1)
    .describe('The human-readable ticket type name returned by the get ticket types tool.'),
  fields: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .describe('Key-value map of field IDs to values. Only use field.id values from the selected ticket type.'),
  conversation: z
    .array(conversationMessageSchema)
    .optional()
    .describe('Optional brief summary of task-relevant exchanges, limited to the ticket request.'),
});

export const createTicketOutput = z.object({
  success: z.boolean(),
  ticketId: z.string().optional(),
  message: z.string(),
});
