// Central tier permission hook — single source of truth
export type Tier = 'free' | 'explorer' | 'analyst' | 'admin'

const TIER_RANK: Record<Tier, number> = {
  free: 0, explorer: 1, analyst: 2, admin: 99
}

export function getTier(user: any): Tier {
  return (user?.user_metadata?.tier as Tier) || 'free'
}

export function hasAccess(user: any, required: Tier): boolean {
  const userTier = getTier(user)
  return TIER_RANK[userTier] >= TIER_RANK[required]
}

export function getTokens(user: any): number {
  return user?.user_metadata?.tokens || 0
}

// Feature flags
export function canViewInsights(user: any)   { return hasAccess(user, 'explorer') }
export function canViewAllCards(user: any)   { return hasAccess(user, 'explorer') }
export function canUseDealAlerts(user: any)  { return hasAccess(user, 'explorer') }
export function canExportCSV(user: any)      { return hasAccess(user, 'analyst')  }
export function canViewDealFinder(user: any) { return hasAccess(user, 'explorer') }
export function isAdmin(user: any)           { return hasAccess(user, 'admin')    }

// Free card limit
export const FREE_CARD_LIMIT = 3
