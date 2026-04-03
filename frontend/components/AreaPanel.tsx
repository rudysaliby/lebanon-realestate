'use client'
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink, Lock, Crown } from 'lucide-react'
import { useTheme, T } from '@/components/ThemeContext'
import { canViewAllCards, getTier, FREE_CARD_LIMIT } from '@/lib/useTier'
import PricingPage from '@/components/PricingPage'
import type { Mode } from '@/app/page'

// Fix Mapbox GeoJSON property serialization — all values come back as strings
function parseListing(raw: any) {
  return {
    ...raw,
    price:        raw.price        ? Number(raw.price)        : null,
    size_sqm:     raw.size_sqm     ? Number(raw.size_sqm)     : null,
    bedrooms:     raw.bedrooms     ? Number(raw.bedrooms)     : null,
    bathrooms:    raw.bathrooms    ? Number(raw.bathrooms)    : null,
    lat:          raw.lat          ? Number(raw.lat)          : null,
    lng:          raw.lng          ? Number(raw.lng)          : null,
    price_per_sqm: raw.price_per_sqm ? Number(raw.price_per_sqm) : null,
  }
}

function DealBadge({ ppsqm, medianPpsqm }: { ppsqm: number | null, medianPpsqm: number | null }) {
  if (!ppsqm || !medianPpsqm) return null
  const diff = ((ppsqm - medianPpsqm) / medianPpsqm) * 100
  if (Math.abs(diff) < 5) return (
    <span style={{ background: 'rgba(148,163,184,0.25)', color: '#94a3b8', borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em' }}>
      FAIR
    </span>
  )
  const below = diff < 0
  return (
    <span style={{
      background: below ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)',
      color: below ? '#4ade80' : '#f87171',
      borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.03em',
    }}>
      {below ? '▼' : '▲'} {Math.abs(Math.round(diff))}% {below ? 'BELOW' : 'ABOVE'}
    </span>
  )
}

function ListingCard({ raw, medianPpsqm, isLocked, onSignIn, t, theme }: any) {
  const listing = parseListing(raw)
  const price   = listing.price ? `$${listing.price.toLocaleString()}` : 'N/A'
  const ppsqm   = listing.price && listing.size_sqm
    ? Math.round(listing.price / listing.size_sqm) : null

  return (
    <div style={{
      background: t.bgCard, border: `1px solid ${t.border}`,
      borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      height: '100%',
    }}>
      {/* Image */}
      <div style={{ height: 160, position: 'relative', overflow: 'hidden', flexShrink: 0,
        background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' }}>
        {listing.image_url ? (
          <img src={listing.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, opacity: 0.12 }}>
            {listing.property_type === 'land' ? '🌿' : listing.property_type === 'commercial' ? '🏢' : '🏠'}
          </div>
        )}
        {!isLocked && (
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <DealBadge ppsqm={ppsqm} medianPpsqm={medianPpsqm} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <span style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.85)', borderRadius: 4, padding: '2px 7px', fontSize: 10 }}>
            {listing.property_type || 'Property'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isLocked ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
            <Crown size={20} color={t.accent} />
            <p style={{ fontSize: 12, color: t.text, fontWeight: 600, margin: 0 }}>Explorer required</p>
            <p style={{ fontSize: 11, color: t.textMuted, margin: 0 }}>Upgrade to see all listings sorted by best deal</p>
            <button onClick={onSignIn} style={{
              background: '#16a34a', border: 'none', borderRadius: 7,
              padding: '7px 16px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
            }}>Upgrade — $9/mo</button>
          </div>
        ) : (
          <>
            {/* Price */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, color: t.text }}>{price}</span>
              {ppsqm && <span style={{ fontSize: 11, color: t.textMuted }}>${ppsqm.toLocaleString()}/m²</span>}
            </div>

            {/* Title */}
            <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.4 }}>
              {listing.title?.substring(0, 60)}{(listing.title?.length || 0) > 60 ? '…' : ''}
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              {listing.size_sqm && (
                <span style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 10, color: t.textSub }}>
                  📐 {listing.size_sqm}m²
                </span>
              )}
              {listing.bedrooms && (
                <span style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 10, color: t.textSub }}>
                  🛏 {listing.bedrooms}
                </span>
              )}
              {listing.bathrooms && (
                <span style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 10, color: t.textSub }}>
                  🚿 {listing.bathrooms}
                </span>
              )}
              {listing.condition && (
                <span style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 10, color: t.textSub }}>
                  {listing.condition}
                </span>
              )}
              {listing.furnished && listing.furnished !== 'unfurnished' && (
                <span style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 10, color: t.textSub }}>
                  🛋 {listing.furnished}
                </span>
              )}
            </div>

            {/* Area */}
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 'auto' }}>
              📍 {listing.area}{listing.region ? `, ${listing.region}` : ''}
            </div>

            {/* CTA */}
            <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: t.accentBg, border: `1px solid ${t.accentBorder}`,
              borderRadius: 7, padding: '7px', fontSize: 12, color: t.accent,
              textDecoration: 'none', fontWeight: 600, marginTop: 4,
            }}>
              View Listing <ExternalLink size={11} />
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default function AreaPanel({ areaData, mode, onClose, user, onSignIn }: {
  areaData: any, mode: Mode, onClose: () => void, user: any, onSignIn: () => void
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const [page, setPage] = useState(0)
  const [showPricing, setShowPricing] = useState(false)

  const listings     = areaData?.listings || []
  const total        = areaData?.total_listings || listings.length
  const canSeeAll    = canViewAllCards(user)
  const tier         = getTier(user)

  // Free users: see 3 cards only, rest locked
  // Explorer+: see all sorted by best deal (pre-sorted in MapView)
  const CARDS_PER_PAGE = 9
  const shownListings  = canSeeAll ? listings : listings.slice(0, FREE_CARD_LIMIT)
  const lockedCount    = canSeeAll ? 0 : Math.max(0, listings.length - FREE_CARD_LIMIT)
  const totalPages     = Math.max(1, Math.ceil(shownListings.length / CARDS_PER_PAGE))
  const pageListings   = shownListings.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE)

  const fmt     = (n: any) => n ? `$${Number(n).toLocaleString()}` : 'N/A'
  const medPpsqm = areaData.median_ppsqm ? Number(areaData.median_ppsqm) : null

  const handleUpgrade = async (planId: string, priceId: string) => {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId: user?.id, email: user?.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      alert('Contact us at hello@iqari.com to upgrade')
    }
  }

  return (
    <>
      <div style={{
        position: 'absolute', inset: 0,
        background: theme === 'dark' ? 'rgba(10,10,10,0.97)' : 'rgba(248,248,245,0.97)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', zIndex: 10,
        animation: 'fadeIn 0.2s ease',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <style>{`@keyframes fadeIn { from { opacity:0;transform:translateY(6px) } to { opacity:1;transform:none } }`}</style>

        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: t.bgPanel,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Area info */}
            <div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>
                {areaData.area}
              </h2>
              <span style={{ fontSize: 11, color: t.textMuted }}>{areaData.region}</span>
            </div>

            {/* Stats pills */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Listings', value: total.toLocaleString() },
                { label: 'Median', value: fmt(areaData.median_price) },
                { label: '$/m²', value: medPpsqm ? `$${medPpsqm.toLocaleString()}` : 'N/A' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: t.bgCard, border: `1px solid ${t.border}`,
                  borderRadius: 8, padding: '5px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{value}</div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Sort badge */}
            {canSeeAll ? (
              <div style={{ background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: t.accent, fontWeight: 600 }}>
                🎯 Sorted: best deal first
              </div>
            ) : (
              <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: t.textMuted }}>
                🔀 Random · upgrade for deal sorting
              </div>
            )}
          </div>

          <button onClick={onClose} style={{
            background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: t.textMuted, flexShrink: 0,
          }}><X size={15} /></button>
        </div>

        {/* Cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14, alignItems: 'start',
          }}>
            {pageListings.map((listing: any, i: number) => (
              <ListingCard
                key={listing.url || i}
                raw={listing}
                medianPpsqm={medPpsqm}
                isLocked={false}
                onSignIn={() => setShowPricing(true)}
                t={t}
                theme={theme}
              />
            ))}

            {/* Locked cards for free users */}
            {!canSeeAll && lockedCount > 0 && page === 0 && (
              <div style={{
                background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                borderRadius: 14, padding: '28px 20px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                gridColumn: 'span 1',
              }}>
                <Crown size={24} color={t.accent} />
                <p style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: 0 }}>
                  +{lockedCount} more listings
                </p>
                <p style={{ fontSize: 11, color: t.textMuted, margin: 0, lineHeight: 1.5 }}>
                  Explorer plan unlocks all listings sorted by best deal
                </p>
                <button onClick={() => setShowPricing(true)} style={{
                  background: '#16a34a', border: 'none', borderRadius: 8,
                  padding: '8px 20px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                }}>Upgrade — $9/mo</button>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '12px 24px', borderTop: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            flexShrink: 0, background: t.bgPanel,
          }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{
              background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 7,
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: page === 0 ? 'default' : 'pointer', color: page === 0 ? t.textMuted : t.textSub,
              opacity: page === 0 ? 0.4 : 1,
            }}><ChevronLeft size={13} /></button>

            <span style={{ fontSize: 12, color: t.textSub }}>
              Page <strong style={{ color: t.text }}>{page + 1}</strong> of{' '}
              <strong style={{ color: t.text }}>{totalPages}</strong>
            </span>

            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{
              background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 7,
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: page >= totalPages - 1 ? 'default' : 'pointer', color: page >= totalPages - 1 ? t.textMuted : t.textSub,
              opacity: page >= totalPages - 1 ? 0.4 : 1,
            }}><ChevronRight size={13} /></button>
          </div>
        )}
      </div>

      {showPricing && (
        <PricingPage
          onClose={() => setShowPricing(false)}
          currentTier={tier}
          user={user}
          onUpgrade={handleUpgrade}
        />
      )}
    </>
  )
}
