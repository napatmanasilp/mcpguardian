export type TierId = 'free' | 'developer' | 'team' | 'startup' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';

export interface TierDefinition {
  id: TierId;
  displayName: string;
  monthlyPriceCents: number;       // 0 for Free, -1 for Enterprise (custom)
  annualPricePerMonthCents: number; // 0 for Free, -1 for Enterprise
  scanAllowance: number | null;     // null = unlimited (Enterprise)
  toolCallAllowance: number | null; // null = unlimited (Enterprise)
  seatLimit: number | null;         // null = unlimited
  mcpServerLimit: number | null;    // null = unlimited
}

export const TIER_CATALOG: Record<TierId, TierDefinition> = {
  free: {
    id: 'free',
    displayName: 'Free',
    monthlyPriceCents: 0,
    annualPricePerMonthCents: 0,
    scanAllowance: 50,
    toolCallAllowance: 5_000,
    seatLimit: 1,
    mcpServerLimit: 1,
  },
  developer: {
    id: 'developer',
    displayName: 'Developer',
    monthlyPriceCents: 2_900,
    annualPricePerMonthCents: 2_400,
    scanAllowance: 100,
    toolCallAllowance: 25_000,
    seatLimit: 3,
    mcpServerLimit: 5,
  },
  team: {
    id: 'team',
    displayName: 'Team',
    monthlyPriceCents: 9_900,
    annualPricePerMonthCents: 8_200,
    scanAllowance: 500,
    toolCallAllowance: 150_000,
    seatLimit: 10,
    mcpServerLimit: 25,
  },
  startup: {
    id: 'startup',
    displayName: 'Startup',
    monthlyPriceCents: 29_900,
    annualPricePerMonthCents: 24_800,
    scanAllowance: 2_000,
    toolCallAllowance: 500_000,
    seatLimit: null,
    mcpServerLimit: 100,
  },
  enterprise: {
    id: 'enterprise',
    displayName: 'Enterprise',
    monthlyPriceCents: -1,
    annualPricePerMonthCents: -1,
    scanAllowance: null,
    toolCallAllowance: null,
    seatLimit: null,
    mcpServerLimit: null,
  },
};

export const VALID_TIER_IDS: TierId[] = ['free', 'developer', 'team', 'startup', 'enterprise'];

export function getTier(id: string): TierDefinition | undefined {
  if (!VALID_TIER_IDS.includes(id as TierId)) return undefined;
  return TIER_CATALOG[id as TierId];
}

export function getTierOrThrow(id: string): TierDefinition {
  const tier = getTier(id);
  if (!tier) throw new Error(`Unknown tier: ${id}`);
  return tier;
}

export function isUnlimited(allowance: number | null): boolean {
  return allowance === null;
}

export function getAnnualTotalCents(tier: TierDefinition): number {
  if (tier.annualPricePerMonthCents <= 0) return tier.annualPricePerMonthCents;
  return tier.annualPricePerMonthCents * 12;
}

export function getDisplayPrice(tier: TierDefinition, cycle: BillingCycle): string {
  if (tier.monthlyPriceCents === 0) return 'Free';
  if (tier.monthlyPriceCents === -1) return 'Custom';
  const cents = cycle === 'annual' ? tier.annualPricePerMonthCents : tier.monthlyPriceCents;
  return `$${(cents / 100).toFixed(0)}`;
}
