import type { IndustryPack } from './types.js';
import { consultingPack } from './consulting/index.js';
import { hvacPack } from './hvac/index.js';

export const industryPacks: Record<string, IndustryPack> = {
  [consultingPack.id]: consultingPack,
  [hvacPack.id]: hvacPack,
};

export function getIndustryPack(
  industry: string,
  category: string,
): IndustryPack | undefined {
  if (category) {
    return industryPacks[`${industry}/${category}`];
  }
  return industryPacks[industry];
}
