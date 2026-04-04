'use client'
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink, Lock, Crown, Coins } from 'lucide-react'
import { useTheme, T } from '@/components/ThemeContext'
import { getTier } from '@/lib/useTier'
import PricingPage from '@/components/PricingPage'
import type { Mode } from '@/app/page'

function parseListing(raw: any) {
  return {
    ...raw,
    price:     raw.price     ? Number(raw.price)     : null,
    size_sqm:  raw.size_sqm  ? Number(raw.size_sqm)  : null,
    bedrooms:  raw.bedrooms  ? Number(raw.bedrooms)  : null,
    bathrooms: raw.bathrooms ? Number(raw.bathrooms) : null,
  }
}

function DealBadge({ ppsqm, medianPpsqm }: { ppsqm: number|null, medianPpsqm: number|null }) {
  if (!ppsqm || !medianPpsqm) return null
  const diff = ((ppsqm - medianPpsqm) / medianPpsqm) * 100
  if (Math.abs(diff) < 5) return (
    <span style={{ background:'rgba(148,163,184,0.25)', color:'#94a3b8', borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:800 }}>FAIR</span>
  )
  const below = diff < 0
  return (
    <span style={{
      background: below ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)',
      color: below ? '#4ade80' : '#f87171',
      borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:800,
    }}>
      {below ? '▼' : '▲'} {Math.abs(Math.round(diff))}% {below ? 'BELOW' : 'ABOVE'}
    </span>
  )
}

function FreeCard({ t, theme, onUpgrade }: any) {
  return (
    <div style={{
      background: t.bgCard, border:`1px solid ${t.border}`,
      borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column',
      minHeight: 320,
    }}>
      {/* Blurred image placeholder */}
      <div style={{
        height:160, background: theme === 'dark' ? 'rgba(74,222,128,0.06)' : 'rgba(22,163,74,0.04)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:40, filter:'blur(2px)', userSelect:'none',
      }}>🏠</div>

      {/* Blurred content */}
      <div style={{ padding:'14px 16px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ height:20, background:t.border, borderRadius:4, filter:'blur(4px)' }} />
        <div style={{ height:14, background:t.border, borderRadius:4, width:'60%', filter:'blur(4px)' }} />
        <div style={{ display:'flex', gap:6 }}>
          {[40,30,35].map((w,i) => (
            <div key={i} style={{ height:22, background:t.border, borderRadius:4, width:`${w}%`, filter:'blur(3px)' }} />
          ))}
        </div>
        <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', alignItems:'center', gap:8, paddingTop:12, borderTop:`1px solid ${t.border}` }}>
          <Crown size={18} color={t.accent} />
          <p style={{ fontSize:11, color:t.text, fontWeight:600, margin:0, textAlign:'center' }}>Explorer required</p>
          <p style={{ fontSize:10, color:t.textMuted, margin:0, textAlign:'center' }}>Unlock all listings sorted by best deal</p>
          <button onClick={onUpgrade} style={{
            background:'#16a34a', border:'none', borderRadius:7,
            padding:'6px 16px', fontSize:11, fontWeight:700, color:'#fff', cursor:'pointer',
          }}>Upgrade — $9/mo</button>
        </div>
      </div>
    </div>
  )
}

function ListingCard({ raw, medianPpsqm, t, theme }: any) {
  const listing = parseListing(raw)
  const price = listing.price ? `$${listing.price.toLocaleString()}` : 'N/A'
  const ppsqm = listing.price && listing.size_sqm
    ? Math.round(listing.price / listing.size_sqm) : null

  return (
    <div style={{
      background:t.bgCard, border:`1px solid ${t.border}`,
      borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column',
    }}>
      {/* Image */}
      <div style={{
        height:160, position:'relative', overflow:'hidden', flexShrink:0,
        background: theme==='dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
      }}>
        {listing.image_url ? (
          <img src={listing.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, opacity:0.12 }}>
            {listing.property_type === 'land' ? '🌿' : listing.property_type === 'commercial' ? '🏢' : '🏠'}
          </div>
        )}
        <div style={{ position:'absolute', top:8, left:8 }}>
          <DealBadge ppsqm={ppsqm} medianPpsqm={medianPpsqm} />
        </div>
        <div style={{ position:'absolute', top:8, right:8 }}>
          <span style={{ background:'rgba(0,0,0,0.65)', color:'rgba(255,255,255,0.85)', borderRadius:4, padding:'2px 7px', fontSize:10 }}>
            {listing.property_type || 'Property'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:700, color:t.text }}>{price}</span>
          {ppsqm && <span style={{ fontSize:11, color:t.textMuted }}>${ppsqm.toLocaleString()}/m²</span>}
        </div>
        <div style={{ fontSize:12, color:t.textSub, lineHeight:1.4 }}>
          {listing.title?.substring(0,60)}{(listing.title?.length||0)>60?'…':''}
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:2 }}>
          {listing.size_sqm && <span style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:4, padding:'2px 6px', fontSize:10, color:t.textSub }}>📐 {listing.size_sqm}m²</span>}
          {listing.bedrooms && <span style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:4, padding:'2px 6px', fontSize:10, color:t.textSub }}>🛏 {listing.bedrooms}</span>}
          {listing.bathrooms && <span style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:4, padding:'2px 6px', fontSize:10, color:t.textSub }}>🚿 {listing.bathrooms}</span>}
          {listing.condition && <span style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:4, padding:'2px 6px', fontSize:10, color:t.textSub }}>{listing.condition}</span>}
        </div>
        <div style={{ fontSize:11, color:t.textMuted, marginTop:'auto' }}>
          📍 {listing.area}{listing.region ? `, ${listing.region}` : ''}
        </div>
        <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:5,
          background:t.accentBg, border:`1px solid ${t.accentBorder}`,
          borderRadius:7, padding:'7px', fontSize:12, color:t.accent,
          textDecoration:'none', fontWeight:600, marginTop:4,
        }}>
          View Listing <ExternalLink size={11}/>
        </a>
      </div>
    </div>
  )
}

// Token cost to unlock more cards
const EXPLORER_FREE_CARDS = 6   // free without tokens
const CARDS_PER_TOKEN_UNLOCK = 6 // unlock 6 more per token spend
const TOKEN_COST = 1             // 1 token per unlock

export default function AreaPanel({ areaData, mode, onClose, user, onSignIn }: {
  areaData: any, mode: Mode, onClose: () => void, user: any, onSignIn: () => void
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const [page, setPage] = useState(0)
  const [showPricing, setShowPricing] = useState(false)
  const [unlockedBatches, setUnlockedBatches] = useState(0)

  const tier    = getTier(user)
  const isFree  = !user || tier === 'free'
  const isExplorer = tier === 'explorer'
  const isAnalystPlus = tier === 'analyst' || tier === 'admin'

  const listings   = areaData?.listings || []
  const total      = areaData?.total_count || listings.length
  const medPpsqm   = areaData?.median_ppsqm ? Number(areaData.median_ppsqm) : null
  const showDeals  = areaData?.show_deals_only || false

  // Determine how many cards to show
  const CARDS_PER_PAGE = 9
  let visibleCount: number
  if (isFree) visibleCount = 1
  else if (isAnalystPlus) visibleCount = listings.length
  else visibleCount = EXPLORER_FREE_CARDS + (unlockedBatches * CARDS_PER_TOKEN_UNLOCK)

  const visibleListings = listings.slice(0, Math.min(visibleCount, listings.length))
  const lockedCount = listings.length - visibleListings.length
  const totalPages = Math.max(1, Math.ceil(visibleListings.length / CARDS_PER_PAGE))
  const pageListings = visibleListings.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE)

  const fmt = (n: any) => n ? `$${Number(n).toLocaleString()}` : 'N/A'

  const handleUpgrade = async (planId: string, priceId: string) => {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId: user?.id, email: user?.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { alert('Contact us at hello@iqari.com to upgrade') }
  }

  const handleUnlockMore = () => {
    // In production this would deduct tokens via API
    // For now just unlock the next batch
    setUnlockedBatches(b => b + 1)
  }

  return (
    <>
      <div style={{
        position:'absolute', inset:0,
        background: theme==='dark' ? 'rgba(10,10,10,0.97)' : 'rgba(248,248,245,0.97)',
        backdropFilter:'blur(20px)',
        display:'flex', flexDirection:'column', zIndex:10,
        animation:'fadeIn 0.2s ease', fontFamily:"'DM Sans',sans-serif",
      }}>
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>

        {/* Header */}
        <div style={{
          padding:'14px 24px', borderBottom:`1px solid ${t.border}`,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexShrink:0, background:t.bgPanel,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:t.text, margin:0 }}>
                {areaData.area}
              </h2>
              <span style={{ fontSize:11, color:t.textMuted }}>{areaData.region}</span>
            </div>

            {/* Stats */}
            <div style={{ display:'flex', gap:8 }}>
              {[
                { label:'Listings', value: total.toLocaleString() },
                { label:'Median',   value: fmt(areaData.median_price) },
                { label:'$/m²',     value: medPpsqm ? `$${medPpsqm.toLocaleString()}` : 'N/A' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:8, padding:'5px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:t.text }}>{value}</div>
                  <div style={{ fontSize:10, color:t.textMuted }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Mode badge */}
            {showDeals ? (
              <span style={{ background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#4ade80', fontWeight:600 }}>
                🎯 Good deals only
              </span>
            ) : (
              <span style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:20, padding:'3px 10px', fontSize:11, color:t.textMuted }}>
                All listings
              </span>
            )}

            {/* Sort badge */}
            {!isFree && (
              <span style={{ background:t.accentBg, border:`1px solid ${t.accentBorder}`, borderRadius:20, padding:'3px 10px', fontSize:11, color:t.accent, fontWeight:600 }}>
                🎯 Best deal first
              </span>
            )}
          </div>

          <button onClick={onClose} style={{
            background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:8,
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', color:t.textMuted, flexShrink:0,
          }}><X size={15}/></button>
        </div>

        {/* Cards */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          {isFree ? (
            /* FREE: show 1 real card + upgrade prompt */
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14, marginBottom:20 }}>
                {listings.slice(0,1).map((l: any, i: number) => (
                  <ListingCard key={i} raw={l} medianPpsqm={medPpsqm} t={t} theme={theme} />
                ))}
                {listings.length > 1 && <FreeCard t={t} theme={theme} onUpgrade={() => setShowPricing(true)} />}
                {listings.length > 2 && <FreeCard t={t} theme={theme} onUpgrade={() => setShowPricing(true)} />}
              </div>
              {listings.length > 1 && (
                <div style={{
                  textAlign:'center', padding:'24px', background:t.accentBg,
                  border:`1px solid ${t.accentBorder}`, borderRadius:12,
                }}>
                  <p style={{ fontSize:13, fontWeight:700, color:t.text, marginBottom:6 }}>
                    +{listings.length - 1} more listings in {areaData.area}
                  </p>
                  <p style={{ fontSize:12, color:t.textMuted, marginBottom:16 }}>
                    Explorer plan unlocks all listings sorted by best deal
                  </p>
                  <button onClick={() => setShowPricing(true)} style={{
                    background:'#16a34a', border:'none', borderRadius:8,
                    padding:'10px 28px', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer',
                  }}>Upgrade to Explorer — $9/mo</button>
                </div>
              )}
            </div>
          ) : (
            /* EXPLORER / ANALYST / ADMIN */
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                {pageListings.map((l: any, i: number) => (
                  <ListingCard key={l.url || i} raw={l} medianPpsqm={medPpsqm} t={t} theme={theme} />
                ))}
              </div>

              {/* Token unlock for Explorer */}
              {isExplorer && lockedCount > 0 && page === totalPages - 1 && (
                <div style={{
                  marginTop:20, textAlign:'center', padding:'20px',
                  background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:12,
                }}>
                  <Coins size={20} color={t.accent} style={{ marginBottom:8 }} />
                  <p style={{ fontSize:13, fontWeight:700, color:t.text, marginBottom:4 }}>
                    +{lockedCount} more listings
                  </p>
                  <p style={{ fontSize:12, color:t.textMuted, marginBottom:14 }}>
                    Use {TOKEN_COST} token to unlock {CARDS_PER_TOKEN_UNLOCK} more listings
                  </p>
                  <button onClick={handleUnlockMore} style={{
                    background:t.accent, border:'none', borderRadius:8,
                    padding:'8px 22px', fontSize:12, fontWeight:700, color:'#000', cursor:'pointer',
                    display:'inline-flex', alignItems:'center', gap:6,
                  }}>
                    <Coins size={13}/> Unlock {CARDS_PER_TOKEN_UNLOCK} more · {TOKEN_COST} token
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {!isFree && totalPages > 1 && (
          <div style={{
            padding:'12px 24px', borderTop:`1px solid ${t.border}`,
            display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            flexShrink:0, background:t.bgPanel,
          }}>
            <button onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0} style={{
              background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:7,
              width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
              cursor:page===0?'default':'pointer', color:t.textSub, opacity:page===0?0.4:1,
            }}><ChevronLeft size={13}/></button>

            <span style={{ fontSize:12, color:t.textSub }}>
              Page <strong style={{ color:t.text }}>{page+1}</strong> of <strong style={{ color:t.text }}>{totalPages}</strong>
            </span>

            <button onClick={() => setPage(p => Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1} style={{
              background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:7,
              width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
              cursor:page>=totalPages-1?'default':'pointer', color:t.textSub, opacity:page>=totalPages-1?0.4:1,
            }}><ChevronRight size={13}/></button>
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
