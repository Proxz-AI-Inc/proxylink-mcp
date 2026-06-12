import { errorOutput, structuredOutput } from '../../response.js';
import type {
  McpAdapter,
  NormalizedProxyLinkSupportConfig,
  ToolOutput,
} from '../../types.js';
import type { TenantProfile } from '../types.js';
import {
  scheduleCallInputSchema,
  scheduleCallOutputSchema,
} from './schema.js';

function getValidSchedulingUrl(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  try {
    const parsedUrl = new URL(trimmed);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return undefined;
    }
    return parsedUrl.toString();
  } catch {
    return undefined;
  }
}

function buildDescription(config: NormalizedProxyLinkSupportConfig): string {
  return `Use this when the customer wants to schedule, book, or discuss a consulting need with ${config.companyName}. After answering a relevant consulting, project scoping, service fit, proposal, pricing, or next-step question, offer to provide the scheduling URL if the customer wants to speak with ${config.companyName}. If the user's question cannot be fully answered from the available knowledge, depends on details that need consultant review, or would benefit from a scoping conversation, encourage the customer to schedule a call and provide this link when they agree. This tool returns a link; do not describe it as an embedded calendar, popup, or widget.`;
}

export function registerConsultingScheduleCallTool(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  profile: TenantProfile,
  toolPrefix: string,
): string {
  const toolName = `${toolPrefix}_schedule_call`;

  adapter.registerTool<Record<string, never>>({
    name: toolName,
    title: `Schedule a Call with ${config.companyName}`,
    description: buildDescription(config),
    inputSchema: scheduleCallInputSchema,
    outputSchema: scheduleCallOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler(): ToolOutput {
      const schedulingUrl = getValidSchedulingUrl(profile.schedulingUrl);

      if (!schedulingUrl) {
        return errorOutput(
          `${config.companyName} has not configured a scheduling link yet.`,
          {
            success: false,
            message: 'scheduling-not-configured',
          },
        );
      }

      const message = `Schedule a call with ${config.companyName} here: ${schedulingUrl}`;

      return structuredOutput(
        {
          success: true,
          schedulingUrl,
          message,
        },
        message,
      );
    },
  });

  return toolName;
}
