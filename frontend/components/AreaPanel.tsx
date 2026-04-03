'use client'
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink, Lock } from 'lucide-react'
import { useTheme, T } from '@/components/ThemeContext'
import { canViewAllCards, getTier, FREE_CARD_LIMIT } from '@/lib/useTier'
import type { Mode } from '@/app/page'

function DealBadge({ listing, medianPpsqm }: { listing: any, medianPpsqm: number | null }) {
  if (!listing.price || !listing.size_sqm || !medianPpsqm) return null
  const ppsqm = listing.price / listing.size_sqm
  const diff = ((ppsqm - medianPpsqm) / medianPpsqm) * 100
  if (Math.abs(diff) < 5) return (
    <span style={{ background: 'rgba(148,163,184,0.2)', color: '#94a3b8', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>FAIR</span>
  )
  const below = diff < 0
  return (
    <span style={{
      background: below ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)',
      color: below ? '#4ade80' : '#f87171',
      borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700,
    }}>
      {below ? '▼' : '▲'} {Math.abs(Math.round(diff))}% {below ? 'BELOW' : 'ABOVE'} MARKET
    </span>
  )
}

function ListingCard({ listing, medianPpsqm, isLocked, onSignIn, t, theme }: any) {
  const price   = listing.price ? `$${Number(listing.price).toLocaleString()}` : 'N/A'
  const ppsqm   = listing.price && listing.size_sqm
    ? `$${Math.round(listing.price / listing.size_sqm).toLocaleString()}/m²` : null

  return (
    <div style={{
      background: t.bgCard, border: `1px solid ${t.border}`,
      borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}>
      {/* Image */}
      <div style={{ height: 170, background: t.bgCard, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {listing.image_url ? (
          <img src={listing.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, opacity: 0.15 }}>
            {listing.property_type === 'land' ? '🌿' : listing.property_type === 'commercial' ? '🏢' : '🏠'}
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <DealBadge listing={listing} medianPpsqm={medianPpsqm} />
        </div>
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <span style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.85)', borderRadius: 4, padding: '2px 7px', fontSize: 10 }}>
            {listing.property_type || 'Property'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {isLocked ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8 }}>
            <Lock size={16} color={t.textMuted} />
            <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>Sign in to see price & details</p>
            <button onClick={onSignIn} style={{
              background: '#16a34a', border: 'none', borderRadius: 7,
              padding: '6px 16px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer',
            }}>Sign in free</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: t.text }}>{price}</span>
              {ppsqm && <span style={{ fontSize: 11, color: t.textMuted }}>{ppsqm}</span>}
            </div>
            <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8, lineHeight: 1.4, flex: 1 }}>
              {listing.title?.substring(0, 65)}{listing.title?.length > 65 ? '…' : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: t.textMuted, marginBottom: 12, flexWrap: 'wrap' }}>
              {listing.size_sqm && <span>📐 {listing.size_sqm}m²</span>}
              {listing.bedrooms && <span>🛏 {listing.bedrooms}</span>}
              {listing.bathrooms && <span>🚿 {listing.bathrooms}</span>}
              {listing.condition && <span>✓ {listing.condition}</span>}
              {listing.furnished && listing.furnished !== 'unfurnished' && <span>🛋 {listing.furnished}</span>}
            </div>
            <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: t.accentBg, border: `1px solid ${t.accentBorder}`,
              borderRadius: 7, padding: '8px', fontSize: 12, color: t.accent,
              textDecoration: 'none', fontWeight: 600,
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

  const listings     = areaData?.listings || []
  const total        = areaData?.total_listings || listings.length
  const canSeeAll    = canViewAllCards(user)
  const tier         = getTier(user)

  // Free: show 3 cards, locked cards for rest. Explorer+: show all sorted by deal
  const CARDS_PER_PAGE = 6
  const visibleListings = canSeeAll ? listings : listings.slice(0, FREE_CARD_LIMIT + 3) // show 6, lock last 3
  const totalPages = Math.ceil(visibleListings.length / CARDS_PER_PAGE)
  const pageListings = visibleListings.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE)

  const fmt = (n: any) => n ? `$${Number(n).toLocaleString()}` : 'N/A'

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: theme === 'dark' ? 'rgba(10,10,10,0.97)' : 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', zIndex: 10,
      animation: 'fadeIn 0.2s ease',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`@keyframes fadeIn { from { opacity:0;transform:translateY(8px) } to { opacity:1;transform:none } }`}</style>

      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: t.text, margin: 0 }}>
              {areaData.area}
            </h2>
            <span style={{ fontSize: 12, color: t.textMuted }}>{areaData.region}</span>
          </div>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Listings', value: total.toLocaleString() },
              { label: 'Median Price', value: fmt(areaData.median_price) },
              { label: '$/m²', value: areaData.median_ppsqm ? `$${Number(areaData.median_ppsqm).toLocaleString()}` : 'N/A' },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{value}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>{label}</div>
              </div>
            ))}
          </div>
          {/* Sort indicator */}
          {canSeeAll && (
            <div style={{
              background: t.accentBg, border: `1px solid ${t.accentBorder}`,
              borderRadius: 20, padding: '3px 10px', fontSize: 11, color: t.accent, fontWeight: 600,
            }}>
              🎯 Sorted by best deal
            </div>
          )}
          {!canSeeAll && (
            <div style={{
              background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)',
              borderRadius: 20, padding: '3px 10px', fontSize: 11, color: t.textMuted,
            }}>
              Sorted randomly · upgrade for deal sorting
            </div>
          )}
        </div>
        <button onClick={onClose} style={{
          background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 8,
          width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: t.textMuted,
        }}><X size={16} /></button>
      </div>

      {/* Cards grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {pageListings.map((listing: any, i: number) => {
            const actualIdx = page * CARDS_PER_PAGE + i
            const isLocked = !user
              ? actualIdx >= FREE_CARD_LIMIT
              : tier === 'free' && actualIdx >= FREE_CARD_LIMIT
            return (
              <ListingCard
                key={listing.url || i}
                listing={listing}
                medianPpsqm={areaData.median_ppsqm}
                isLocked={isLocked}
                onSignIn={onSignIn}
                t={t}
                theme={theme}
              />
            )
          })}
        </div>

        {/* Free upgrade prompt */}
        {!canSeeAll && listings.length > FREE_CARD_LIMIT && (
          <div style={{
            marginTop: 24, padding: '20px', textAlign: 'center',
            background: t.accentBg, border: `1px solid ${t.accentBorder}`,
            borderRadius: 12,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 }}>
              {listings.length - FREE_CARD_LIMIT} more listings in {areaData.area}
            </p>
            <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 14 }}>
              Explorer plan unlocks all listings sorted by best deal
            </p>
            <button onClick={onSignIn} style={{
              background: '#16a34a', border: 'none', borderRadius: 8,
              padding: '9px 24px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
            }}>Upgrade to Explorer — $9/mo</button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          padding: '12px 24px', borderTop: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          flexShrink: 0,
        }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{
            background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 7,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: page === 0 ? 'default' : 'pointer',
            color: page === 0 ? t.textMuted : t.textSub, opacity: page === 0 ? 0.4 : 1,
          }}><ChevronLeft size={14} /></button>

          <span style={{ fontSize: 13, color: t.textSub }}>
            Page <strong style={{ color: t.text }}>{page + 1}</strong> of <strong style={{ color: t.text }}>{totalPages}</strong>
            <span style={{ color: t.textMuted, fontSize: 11 }}> · {visibleListings.length} listings</span>
          </span>

          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{
            background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 7,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: page >= totalPages - 1 ? 'default' : 'pointer',
            color: page >= totalPages - 1 ? t.textMuted : t.textSub, opacity: page >= totalPages - 1 ? 0.4 : 1,
          }}><ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  )
}
