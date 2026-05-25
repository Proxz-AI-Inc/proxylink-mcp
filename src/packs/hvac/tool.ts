import { errorOutput, structuredOutput } from '../../response.js';
import { logError } from '../../logging.js';
import type {
  McpAdapter,
  NormalizedProxyLinkSupportConfig,
  ProxyLinkClient,
  ToolOutput,
} from '../../types.js';
import type { TenantProfile } from '../types.js';
import type { PricingLookupResponse } from './types.js';
import { HVAC_ADDONS, HVAC_TONNAGES, getHvacAddOn } from './catalog.js';
import {
  replacementPricingInputSchema,
  replacementPricingOutputSchema,
  type ReplacementPricingInput,
} from './schema.js';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function buildPricingTable(result: PricingLookupResponse): string {
  if (!result.success || !result.tiers) {
    return result.error ?? 'Pricing unavailable.';
  }
  const lines: string[] = [];
  lines.push(`Replacement pricing for ${result.tonnage}-ton unit:`);
  for (const tier of result.tiers) {
    lines.push(
      `- ${tier.brand} (${tier.id}): ${formatCents(tier.totalRangeCents.lowCents)}–${formatCents(tier.totalRangeCents.highCents)} (base ${formatCents(tier.baseRangeCents.lowCents)}–${formatCents(tier.baseRangeCents.highCents)} + add-ons ${formatCents(tier.addOnsTotalCents)})`,
    );
  }
  if (result.addOns && result.addOns.length > 0) {
    lines.push('Add-ons applied:');
    for (const addOn of result.addOns) {
      const def = getHvacAddOn(addOn.id);
      lines.push(`- ${def?.label ?? addOn.id}: ${formatCents(addOn.amountCents)}`);
    }
  }
  return lines.join('\n');
}

function buildSuccessText(
  result: PricingLookupResponse,
  schedulerToolName: string,
): string {
  return `${buildPricingTable(result)}\n\nREQUIRED NEXT STEP: Offer the customer an in-home appointment for a formal quote and installation timeline. If a \`${schedulerToolName}\` tool is available, invoke it now to open the scheduler.`;
}

function buildNotConfiguredText(
  config: NormalizedProxyLinkSupportConfig,
  schedulerToolName: string,
): string {
  return `We don't have published pricing for this configuration yet, but ${config.companyName} provides free in-home estimates. REQUIRED NEXT STEP: offer the customer an appointment now. If a \`${schedulerToolName}\` tool is available, invoke it to open the scheduler.`;
}

function buildDescription(
  config: NormalizedProxyLinkSupportConfig,
  profile: TenantProfile,
  schedulerToolName: string,
): string {
  const addOnSummary = HVAC_ADDONS.map(a => {
    const semantic = a.pricingType === 'per-unit' ? ` (${a.unitLabel ?? 'per unit'})` : '';
    return `'${a.id}'${semantic}`;
  }).join(', ');

  if (!profile.hasPricingConfig) {
    return `${config.companyName} has not configured pricing yet. When this tool is called, IMMEDIATELY offer the customer a free in-home estimate. If a \`${schedulerToolName}\` tool is available, invoke it to open the scheduler. Do not tell the customer we cannot help — pivot directly to scheduling. Tonnage must be one of: ${HVAC_TONNAGES.join(', ')}. Available add-ons: ${addOnSummary}.`;
  }

  return `Returns the estimated pricing (material and labor costs) for ${config.companyName} to replace an HVAC unit after the user confirms unit tonnage (GATE 1) and three additional job details (GATE 2).

GATE 1 (read first): Call this tool ONLY after the customer has identified the tonnage of their unit. Never assume, infer, or default a tonnage.

GATE 2 (read first): Call this tool ONLY after the customer has explicitly answered all three of the following questions. Encode every answer in the \`jobDetails\` input — never guess, infer, or default a value.
(a) How many flights of stairs will the technician need to climb? (a flight of stairs is defined as 8 steps or more) — set \`jobDetails.flightsOfStairs\` to the number of flights, or 0 if none.
(b) Is the HVAC unit located in an attic with a drop-down ladder? — set \`jobDetails.inAtticWithDropDownLadder\` to true or false.
(c) Will the technician be able to park within 100 feet of the front door? — set \`jobDetails.canParkWithin100Ft\` to true or false.

If the customer does not answer the questions in GATE 1 or GATE 2: skip pricing entirely. Tell them a quick video consultation lets a ${config.companyName} technician provide a firm quote, and call \`${schedulerToolName}\` as soon as they agree.

If the customer does answer the questions in GATE 1 and GATE 2: then proceed to use this tool to return estimated pricing for the HVAC replacement.

After returning estimated pricing: always offer a video consultation for a firm quote and call \`${schedulerToolName}\` once the customer agrees.`;
}

export function registerHvacReplacementPricingTool(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  client: ProxyLinkClient,
  profile: TenantProfile,
  toolPrefix: string,
): string {
  const toolName = `${toolPrefix}_replacement_pricing`;
  const schedulerToolName = `${toolPrefix}_show_appointment_scheduler`;

  adapter.registerTool<ReplacementPricingInput>({
    name: toolName,
    title: `${config.companyName} HVAC Replacement Pricing`,
    description: buildDescription(config, profile, schedulerToolName),
    inputSchema: replacementPricingInputSchema,
    outputSchema: replacementPricingOutputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    async handler(input): Promise<ToolOutput> {
      if (!profile.hasPricingConfig) {
        return errorOutput(
          buildNotConfiguredText(config, schedulerToolName),
          { success: false, message: 'pricing-not-configured' },
        );
      }
      try {
        const result = await client.requestJson<PricingLookupResponse>(
          '/pricing/lookup',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: 'hvac',
              params: {
                tonnage: input.tonnage,
                tierId: input.tierId,
                jobDetails: input.jobDetails,
              },
            }),
          },
        );

        if (!result.success) {
          return errorOutput(
            result.error ?? 'Unable to retrieve pricing at this time.',
            { success: false, message: result.error ?? 'unknown-error' },
            true,
          );
        }

        return structuredOutput(
          {
            success: true,
            currency: result.currency,
            tonnage: result.tonnage,
            tiers: result.tiers,
            addOns: result.addOns,
          },
          buildSuccessText(result, schedulerToolName),
        );
      } catch (error) {
        logError(config.logger, 'proxylink_hvac_replacement_pricing_failed', {
          toolName,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        return errorOutput(
          'An error occurred while retrieving pricing. Please try again.',
          { success: false, message: 'internal-error' },
          true,
        );
      }
    },
  });

  return toolName;
}
