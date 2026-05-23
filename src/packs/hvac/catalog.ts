export const HVAC_CATALOG_VERSION = 1;

export const HVAC_TONNAGES = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export type HvacTonnage = (typeof HVAC_TONNAGES)[number];

export const HVAC_TIER_IDS = ["low", "mid", "high"] as const;
export type HvacTierId = (typeof HVAC_TIER_IDS)[number];
export type PricingTierId = HvacTierId;

export interface HvacTierDefinition {
  id: HvacTierId;
  label: string;
  blurb: string;
}

export interface HvacPricingTier {
  id: HvacTierId;
  brand: string;
}

export interface HvacUnitPriceRange {
  lowCents: number;
  highCents: number;
}

export interface HvacUnitPricing {
  tonnage: number;
  pricing: Record<HvacTierId, HvacUnitPriceRange>;
}

export interface HvacPricingConfig {
  category: "hvac";
  catalogVersion: number;
  currency: "USD";
  tiers: HvacPricingTier[];
  units: HvacUnitPricing[];
  addOns: Record<string, number>;
}

export const HVAC_TIERS: readonly HvacTierDefinition[] = [
  { id: "low", label: "Low-End", blurb: "Builder-grade, value brands" },
  { id: "mid", label: "Mid-Tier", blurb: "Standard residential" },
  { id: "high", label: "High-End", blurb: "Premium / variable-speed" },
];

export type HvacAddOnPricingType = "flat" | "per-unit";

export interface HvacAddOnDefinition {
  id: string;
  label: string;
  helper: string;
  pricingType: HvacAddOnPricingType;
  unitLabel?: string;
}

export const HVAC_ADDONS: readonly HvacAddOnDefinition[] = [
  {
    id: "stairs",
    label: "Additional charge per flight of stairs",
    helper: "A flight is 8+ stair steps. Charged per flight.",
    pricingType: "per-unit",
    unitLabel: "per flight",
  },
  {
    id: "attic",
    label: "Attic with drop-down ladder",
    helper:
      "One-time surcharge when equipment is installed in an attic accessed via a drop-down ladder.",
    pricingType: "flat",
  },
  {
    id: "distance",
    label: "100+ feet from truck to front door",
    helper:
      "One-time surcharge when the truck cannot park within 100 feet of the front door.",
    pricingType: "flat",
  },
];

export const HVAC_ADDON_IDS = HVAC_ADDONS.map((a) => a.id);

export function getHvacAddOn(id: string): HvacAddOnDefinition | undefined {
  return HVAC_ADDONS.find((a) => a.id === id);
}

export function isHvacTonnage(value: number): value is HvacTonnage {
  return (HVAC_TONNAGES as readonly number[]).includes(value);
}
