import { z } from 'zod';
import { HVAC_TIER_IDS, HVAC_TONNAGES } from './catalog.js';

const tonnageList = [...HVAC_TONNAGES] as number[];
const tierIdEnum = z.enum(HVAC_TIER_IDS);

const jobDetailsSchema = z.object({
  flightsOfStairs: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Required. Number of flights of stairs the technician must climb to reach the install location. A flight is 8 or more steps. Enter 0 if there are no stairs. Ask the customer this before calling — never guess or default.",
    ),
  inAtticWithDropDownLadder: z
    .boolean()
    .describe(
      "Required. True if the HVAC unit is located in an attic accessed via a drop-down ladder. Ask the customer this before calling — never guess or default.",
    ),
  canParkWithin100Ft: z
    .boolean()
    .describe(
      "Required. True if the technician will be able to park within 100 feet of the front door. Ask the customer this before calling — never guess or default.",
    ),
});

export const replacementPricingInputSchema = z.object({
  tonnage: z
    .number()
    .refine(v => tonnageList.includes(v), {
      message: `Tonnage must be one of: ${tonnageList.join(', ')}`,
    })
    .describe(
      'Unit tonnage. Must match a tonnage configured by the company. Ask the customer to confirm tonnage before calling — never guess or default.',
    ),
  tierId: tierIdEnum
    .optional()
    .describe(
      'Optional tier filter. When omitted, all three tiers are returned.',
    ),
  jobDetails: jobDetailsSchema.describe(
    'GATE 2 answers. All three fields are required and represent the job characteristics that influence pricing add-ons.',
  ),
});

export const priceRangeSchema = z.object({
  lowCents: z.number().int().nonnegative(),
  highCents: z.number().int().nonnegative(),
});

export const replacementPricingTierSchema = z.object({
  id: tierIdEnum,
  brand: z.string(),
  baseRangeCents: priceRangeSchema,
  addOnsTotalCents: z.number().int().nonnegative(),
  totalRangeCents: priceRangeSchema,
});

export const replacementPricingAddOnSchema = z.object({
  id: z.string(),
  amountCents: z.number().int().nonnegative(),
});

export const replacementPricingOutputSchema = z.object({
  success: z.boolean(),
  currency: z.literal('USD').optional(),
  tonnage: z.number().optional(),
  tiers: z.array(replacementPricingTierSchema).optional(),
  addOns: z.array(replacementPricingAddOnSchema).optional(),
  message: z.string().optional(),
});

export type ReplacementPricingInput = z.infer<
  typeof replacementPricingInputSchema
>;
