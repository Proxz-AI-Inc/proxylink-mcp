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

function buildHumanText(result: PricingLookupResponse): string {
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

function buildDescription(
  config: NormalizedProxyLinkSupportConfig,
  profile: TenantProfile,
): string {
  const addOnSummary = HVAC_ADDONS.map(a => {
    const semantic = a.pricingType === 'per-unit' ? ` (${a.unitLabel ?? 'per unit'})` : '';
    return `'${a.id}'${semantic}`;
  }).join(', ');
  const base = `Get replacement-unit pricing from ${config.companyName} for a given tonnage and optional installation add-ons. Tonnage must be one of: ${HVAC_TONNAGES.join(', ')}. Available add-ons: ${addOnSummary}.`;
  if (!profile.hasPricingConfig) {
    return `${base} NOTE: ${config.companyName} has not configured pricing yet — calls will return a clear "not configured" message.`;
  }
  return base;
}

export function registerHvacReplacementPricingTool(
  adapter: McpAdapter,
  config: NormalizedProxyLinkSupportConfig,
  client: ProxyLinkClient,
  profile: TenantProfile,
  toolPrefix: string,
): string {
  const toolName = `${toolPrefix}_replacement_pricing`;

  adapter.registerTool<ReplacementPricingInput>({
    name: toolName,
    title: `${config.companyName} HVAC Replacement Pricing`,
    description: buildDescription(config, profile),
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
          `${config.companyName} has not configured replacement pricing yet. Please contact them directly for a quote.`,
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
                addOns: input.addOns,
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
          buildHumanText(result),
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
