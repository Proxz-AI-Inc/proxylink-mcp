import { z } from 'zod';
import {
  HVAC_ADDONS,
  HVAC_TIER_IDS,
  HVAC_TONNAGES,
  getHvacAddOn,
} from './catalog.js';

const tonnageList = [...HVAC_TONNAGES] as number[];
const tierIdEnum = z.enum(HVAC_TIER_IDS);
const addOnIds = HVAC_ADDONS.map(a => a.id);
const addOnIdEnum = z.enum(addOnIds as unknown as readonly [string, ...string[]]);

const addOnInputSchema = z.object({
  id: addOnIdEnum.describe('Add-on identifier from the HVAC catalog.'),
  quantity: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Required when the add-on is per-unit (e.g., flights of stairs). Omit for flat add-ons.',
    ),
});

export const replacementPricingInputSchema = z
  .object({
    tonnage: z
      .number()
      .refine(v => tonnageList.includes(v), {
        message: `Tonnage must be one of: ${tonnageList.join(', ')}`,
      })
      .describe(
        'Unit tonnage. Must match a tonnage configured by the company.',
      ),
    tierId: tierIdEnum
      .optional()
      .describe(
        'Optional tier filter. When omitted, all three tiers are returned.',
      ),
    addOns: z
      .array(addOnInputSchema)
      .default([])
      .describe(
        'Applicable add-on surcharges. Stairs require a quantity (flights). Attic and distance are one-time flat fees.',
      ),
  })
  .superRefine((value, ctx) => {
    value.addOns.forEach((addOn, index) => {
      const definition = getHvacAddOn(addOn.id);
      if (!definition) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addOns', index, 'id'],
          message: `Unknown add-on id: ${addOn.id}`,
        });
        return;
      }
      if (definition.pricingType === 'per-unit' && addOn.quantity === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addOns', index, 'quantity'],
          message: `Add-on '${definition.id}' is per-unit and requires a quantity (${definition.unitLabel ?? 'unit count'}).`,
        });
      }
      if (definition.pricingType === 'flat' && addOn.quantity !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addOns', index, 'quantity'],
          message: `Add-on '${definition.id}' is a flat fee and does not accept a quantity.`,
        });
      }
    });
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
