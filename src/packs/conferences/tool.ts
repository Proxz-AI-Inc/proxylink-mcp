import { logError } from '../../logging.js';
import { errorOutput, structuredOutput } from '../../response.js';
import type {
  McpAdapter,
  NormalizedProxyLinkSupportConfig,
  ProxyLinkClient,
  ToolOutput,
} from '../../types.js';
import {
  getEventsInputSchema,
  getEventsOutputSchema,
  getMemberActionsInputSchema,
  getMemberActionsOutputSchema,
  submitEventRegistrationInterestInputSchema,
  submitEventRegistrationInterestOutputSchema,
  submitMemberActionInputSchema,
  submitMemberActionOutputSchema,
  type SubmitEventRegistrationInterestInput,
  type SubmitMemberActionInput,
} from './schema.js';
import type {
  ConferenceEventsResponse,
  ConferenceMemberActionsResponse,
  ConferenceSubmissionResponse,
} from './types.js';

interface ConferenceToolNames {
  getEvents: string;
  submitEventRegistrationInterest: string;
  getMemberActions: string;
  submitMemberAction: string;
}

function buildConferenceToolNames(toolPrefix: string): ConferenceToolNames {
  return {
    getEvents: `${toolPrefix}_get_events`,
    submitEventRegistrationInterest:
      `${toolPrefix}_submit_event_registration_interest`,
    getMemberActions: `${toolPrefix}_get_member_actions`,
    submitMemberAction: `${toolPrefix}_submit_member_action`,
  };
}

export function registerConferenceTools(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  client: ProxyLinkClient,
  toolPrefix: string,
): string[] {
  const names = buildConferenceToolNames(toolPrefix);

  registerGetEventsTool(adapter, config, client, names);
  registerSubmitEventRegistrationInterestTool(
    adapter,
    config,
    client,
    names,
  );
  registerGetMemberActionsTool(adapter, config, client, names);
  registerSubmitMemberActionTool(adapter, config, client, names);

  return [
    names.getEvents,
    names.submitEventRegistrationInterest,
    names.getMemberActions,
    names.submitMemberAction,
  ];
}

function registerGetEventsTool(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  client: ProxyLinkClient,
  names: ConferenceToolNames,
): void {
  adapter.registerTool<Record<string, never>>({
    name: names.getEvents,
    title: `Get ${config.companyName} Conference Events`,
    description: `Returns published ${config.companyName} conference events, logistics, and exact registration-interest field definitions. Call this before ${names.submitEventRegistrationInterest}.`,
    inputSchema: getEventsInputSchema,
    outputSchema: getEventsOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async handler(): Promise<ToolOutput> {
      try {
        const result = await client.requestJson<ConferenceEventsResponse>(
          '/events',
          { method: 'GET' },
        );

        if (!result.success || !result.events) {
          return errorOutput(
            result.error || 'Failed to fetch conference events.',
            undefined,
            true,
          );
        }

        if (result.events.length === 0) {
          const message = 'No published conference events are currently available.';
          return structuredOutput(
            { success: true, events: [], message },
            message,
          );
        }

        return structuredOutput(
          { success: true, events: result.events },
          JSON.stringify(result.events, null, 2),
        );
      } catch (error) {
        logError(config.logger, 'proxylink_get_conference_events_failed', {
          toolName: names.getEvents,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return errorOutput(
          'An error occurred while retrieving conference events. Please try again.',
          undefined,
          true,
        );
      }
    },
  });
}

function registerSubmitEventRegistrationInterestTool(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  client: ProxyLinkClient,
  names: ConferenceToolNames,
): void {
  adapter.registerTool<SubmitEventRegistrationInterestInput>({
    name: names.submitEventRegistrationInterest,
    title: `Submit ${config.companyName} Event Registration Interest`,
    description: `Records interest in a published ${config.companyName} conference event. Required steps: call ${names.getEvents}, use the exact event and field IDs returned, and submit only after the user explicitly confirms. This records interest only and does not confirm registration.`,
    inputSchema: submitEventRegistrationInterestInputSchema,
    outputSchema: submitEventRegistrationInterestOutputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async handler(input): Promise<ToolOutput> {
      try {
        const result = await client.requestJson<ConferenceSubmissionResponse>(
          `/events/${encodeURIComponent(input.eventId)}/registration-interest`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: input.fields }),
          },
        );

        if (!result.success) {
          return errorOutput(
            result.error || 'Failed to record registration interest.',
            undefined,
            true,
          );
        }

        const message =
          'Your interest has been recorded. This does not confirm registration.';

        return structuredOutput(
          {
            success: true,
            ticketId: result.ticketId,
            message,
          },
          message,
        );
      } catch (error) {
        logError(
          config.logger,
          'proxylink_submit_event_registration_interest_failed',
          {
            toolName: names.submitEventRegistrationInterest,
            eventId: input.eventId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        );

        return errorOutput(
          'An error occurred while recording registration interest. Please try again.',
          undefined,
          true,
        );
      }
    },
  });
}

function registerGetMemberActionsTool(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  client: ProxyLinkClient,
  names: ConferenceToolNames,
): void {
  adapter.registerTool<Record<string, never>>({
    name: names.getMemberActions,
    title: `Get ${config.companyName} Member Actions`,
    description: `Returns available ${config.companyName} Member Actions with exact field definitions. Call this before ${names.submitMemberAction}.`,
    inputSchema: getMemberActionsInputSchema,
    outputSchema: getMemberActionsOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async handler(): Promise<ToolOutput> {
      try {
        const result =
          await client.requestJson<ConferenceMemberActionsResponse>(
            '/actions',
            { method: 'GET' },
          );

        if (!result.success || !result.actions) {
          return errorOutput(
            result.error || 'Failed to fetch Member Actions.',
            undefined,
            true,
          );
        }

        if (result.actions.length === 0) {
          const message = 'No Member Actions are currently available.';
          return structuredOutput(
            { success: true, actions: [], message },
            message,
          );
        }

        return structuredOutput(
          { success: true, actions: result.actions },
          JSON.stringify(result.actions, null, 2),
        );
      } catch (error) {
        logError(config.logger, 'proxylink_get_member_actions_failed', {
          toolName: names.getMemberActions,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return errorOutput(
          'An error occurred while retrieving Member Actions. Please try again.',
          undefined,
          true,
        );
      }
    },
  });
}

function registerSubmitMemberActionTool(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  client: ProxyLinkClient,
  names: ConferenceToolNames,
): void {
  adapter.registerTool<SubmitMemberActionInput>({
    name: names.submitMemberAction,
    title: `Submit ${config.companyName} Member Action`,
    description: `Submits a ${config.companyName} Member Action for staff review. Required steps: call ${names.getMemberActions}, use the exact action and field IDs returned, and submit only after the user explicitly confirms.`,
    inputSchema: submitMemberActionInputSchema,
    outputSchema: submitMemberActionOutputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    async handler(input): Promise<ToolOutput> {
      try {
        const result = await client.requestJson<ConferenceSubmissionResponse>(
          `/actions/${encodeURIComponent(input.actionId)}/submit`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: input.fields }),
          },
        );

        if (!result.success) {
          return errorOutput(
            result.error || 'Failed to submit Member Action.',
            undefined,
            true,
          );
        }

        const message =
          result.message || 'Your submission was received successfully.';

        return structuredOutput(
          {
            success: true,
            ticketId: result.ticketId,
            message,
          },
          message,
        );
      } catch (error) {
        logError(config.logger, 'proxylink_submit_member_action_failed', {
          toolName: names.submitMemberAction,
          actionId: input.actionId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return errorOutput(
          'An error occurred while submitting the Member Action. Please try again.',
          undefined,
          true,
        );
      }
    },
  });
}
