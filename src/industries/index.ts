import type { IndustryPack } from './types.js';
import { hvacPack } from './homeServices/hvac/index.js';

export const industryPacks: Record<string, IndustryPack> = {
  [hvacPack.id]: hvacPack,
};

export function getIndustryPack(
  industry: string,
  category: string,
): IndustryPack | undefined {
  return industryPacks[`${industry}/${category}`];
}

export type { IndustryPack, IndustryPackContext } from './types.js';
