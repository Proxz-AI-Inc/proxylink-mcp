export interface PricingLookupAddOnInput {
  id: string;
  quantity?: number;
}

export interface PricingLookupRequest {
  category: string;
  params: {
    tonnage: number;
    tierId?: 'low' | 'mid' | 'high';
    addOns: PricingLookupAddOnInput[];
  };
}

export interface PricingPriceRangeCents {
  lowCents: number;
  highCents: number;
}

export interface PricingLookupTier {
  id: 'low' | 'mid' | 'high';
  brand: string;
  baseRangeCents: PricingPriceRangeCents;
  addOnsTotalCents: number;
  totalRangeCents: PricingPriceRangeCents;
}

export interface PricingLookupAddOn {
  id: string;
  amountCents: number;
}

export interface PricingLookupResponse {
  success: boolean;
  currency?: 'USD';
  tonnage?: number;
  tiers?: PricingLookupTier[];
  addOns?: PricingLookupAddOn[];
  error?: string;
}
