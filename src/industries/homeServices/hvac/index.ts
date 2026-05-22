import type { IndustryPack, IndustryPackContext } from '../../types.js';
import { registerHvacReplacementPricingTool } from './replacementPricing.js';

export const hvacPack: IndustryPack = {
  id: 'home-services/hvac',
  register(context: IndustryPackContext): string[] {
    const toolName = registerHvacReplacementPricingTool(
      context.adapter,
      context.config,
      context.client,
      context.profile,
      context.toolPrefix,
    );
    return [toolName];
  },
};
