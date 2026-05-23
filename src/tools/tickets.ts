import {
  createTicketInput,
  createTicketOutput,
  getTicketTypesInput,
  getTicketTypesOutput,
} from '../schemas.js';
import { errorOutput, structuredOutput } from '../response.js';
import { logError } from '../logging.js';
import { validateTicketInput } from '../validation.js';
import type {
  CreateTicketInput,
  McpAdapter,
  NormalizedProxyLinkSupportConfig,
  ProxyLinkClient,
  ToolOutput,
} from '../types.js';

export interface TicketToolNames {
  getTicketTypesToolName: string;
  createSupportTicketToolName: string;
}

export function registerTicketTools(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  client: ProxyLinkClient,
  names: TicketToolNames,
): void {
  adapter.registerTool<Record<string, never>>({
    name: names.getTicketTypesToolName,
    title: 'Get Available Ticket Types',
    description: `Returns available ${config.companyName} ticket types with exact field definitions. Must be called before ${names.createSupportTicketToolName}.`,
    inputSchema: getTicketTypesInput,
    outputSchema: getTicketTypesOutput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async handler(): Promise<ToolOutput> {
      try {
        const ticketTypes = await client.fetchTicketTypes();

        if (ticketTypes.length === 0) {
          const message =
            'No ticket types are currently available. Ticket submission is not enabled.';

          return structuredOutput(
            { success: true, ticketTypes: [], message },
            message,
          );
        }

        return structuredOutput(
          { success: true, ticketTypes },
          JSON.stringify(ticketTypes, null, 2),
        );
      } catch (error) {
        logError(config.logger, 'proxylink_get_ticket_types_failed', {
          toolName: names.getTicketTypesToolName,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return errorOutput(
          'Failed to fetch ticket types. Please try again.',
          undefined,
          true,
        );
      }
    },
  });

  adapter.registerTool<CreateTicketInput>({
    name: names.createSupportTicketToolName,
    title: `Create ${config.companyName} Support Ticket`,
    description: `Use this when the user wants to submit a request that requires human review. Required steps: call ${names.getTicketTypesToolName}, use the exact ticket type and field IDs returned by that tool, and create the ticket only after user confirmation.`,
    inputSchema: createTicketInput,
    outputSchema: createTicketOutput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async handler(input): Promise<ToolOutput> {
      try {
        const ticketTypes = await client.fetchTicketTypes();
        const validation = validateTicketInput(
          input,
          ticketTypes,
          names.getTicketTypesToolName,
        );

        if (!validation.ok) {
          return errorOutput(validation.message);
        }

        const result = await client.createSupportTicket({
          ticketTypeId: input.ticketTypeId,
          ticketTypeName: validation.ticketType.title,
          fields: input.fields,
          conversation: input.conversation,
        });

        if (!result.success) {
          return errorOutput(
            result.error || 'Failed to create support ticket.',
            undefined,
            true,
          );
        }

        const message =
          result.message ||
          `Support ticket created successfully. Ticket ID: ${result.ticketId}`;

        return structuredOutput(
          {
            success: true,
            ticketId: result.ticketId,
            message,
          },
          message,
        );
      } catch (error) {
        logError(config.logger, 'proxylink_create_support_ticket_failed', {
          toolName: names.createSupportTicketToolName,
          ticketTypeName: input.ticketTypeName,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return errorOutput(
          'An error occurred while creating the support ticket. Please try again.',
          undefined,
          true,
        );
      }
    },
  });
}
