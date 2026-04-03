'use client'
import { useEffect, useState, useRef } from 'react'
import { TrendingDown, TrendingUp, Crown } from 'lucide-react'
import { useTheme, T } from '@/components/ThemeContext'
import { canViewInsights, canViewDealFinder, canExportCSV, getTier } from '@/lib/useTier'
import PricingPage from '@/components/PricingPage'
import type { Mode } from '@/app/page'

function median(arr: number[]) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export default function InsightsTab({ mode, user, onSignIn }: {
  mode: Mode, user: any, onSignIn: () => void
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'market' | 'deals'>('market')
  const [showPricing, setShowPricing] = useState(false)
  // Keep stable scale across renders
  const maxPpsqmRef = useRef<number>(1)

  const canInsights = canViewInsights(user)
  const canDeals    = canViewDealFinder(user)
  const canExport   = canExportCSV(user)
  const tier        = getTier(user)

  useEffect(() => {
    if (!canInsights) { setLoading(false); return }
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      const p = new URLSearchParams()
      p.set('period', mode.period)
      p.set('type_group', mode.type)
      const res = await fetch(`/api/listings?${p}`)
      const geojson = await res.json()
      if (cancelled) return
      const features = geojson?.features || []

      const areas: Record<string, any> = {}
      for (const f of features) {
        const p = f.properties
        const key = p.area || p.region || 'Unknown'
        if (!areas[key]) areas[key] = { area: p.area || key, region: p.region || '', ppsqms: [], prices: [], count: 0 }
        areas[key].count++
        if (p.price && p.size_sqm) areas[key].ppsqms.push(Number(p.price) / Number(p.size_sqm))
        if (p.price) areas[key].prices.push(Number(p.price))
      }

      const result = Object.values(areas)
        .filter((a: any) => a.ppsqms.length >= 5)
        .map((a: any) => ({
          ...a,
          median_ppsqm: Math.round(median(a.ppsqms)),
          median_price: Math.round(median(a.prices)),
        }))
        .sort((a: any, b: any) => b.median_ppsqm - a.median_ppsqm)

      // Lock scale once per data load — prevents chart shifting on re-render
      if (result.length > 0) {
        maxPpsqmRef.current = result[0].median_ppsqm
      }

      setData(result)
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [mode.period, mode.type, canInsights]) // stable deps — only refetch when mode changes

  const handleUpgrade = async (planId: string, priceId: string) => {
    // Redirect to LemonSqueezy checkout
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

  // Not logged in
  if (!user) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
        <div style={{
          background: t.bgCard, border: `1px solid ${t.border}`,
          borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 380,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>
            Sign in to access Insights
          </h2>
          <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
            Free account gives you access to market analytics and the deal finder.
          </p>
          <button onClick={onSignIn} style={{
            background: '#16a34a', border: 'none', borderRadius: 9,
            padding: '12px 28px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', width: '100%',
          }}>Create free account</button>
        </div>
      </div>
    )
  }

  // Free tier — show upgrade prompt with blurred preview
  if (!canInsights) {
    return (
      <>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, position: 'relative', overflow: 'hidden' }}>
          {/* Blurred preview */}
          <div style={{ position: 'absolute', inset: 0, filter: 'blur(6px)', opacity: 0.3, pointerEvents: 'none', padding: 32 }}>
            {[90, 75, 60, 45, 35, 25].map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center' }}>
                <div style={{ width: 100, height: 18, background: t.border, borderRadius: 4 }} />
                <div style={{ width: `${w}%`, height: 24, background: '#4ade80', borderRadius: 4, opacity: 0.7 }} />
              </div>
            ))}
          </div>
          {/* Upgrade card */}
          <div style={{
            background: theme === 'dark' ? 'rgba(15,15,15,0.96)' : 'rgba(255,255,255,0.96)',
            border: `1px solid ${t.accentBorder}`,
            borderRadius: 16, padding: '36px 40px', textAlign: 'center', maxWidth: 420,
            position: 'relative', zIndex: 10, boxShadow: t.shadow,
          }}>
            <Crown size={28} color="#4ade80" style={{ marginBottom: 14 }} />
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>
              Insights — Explorer & above
            </h2>
            <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
              Unlock market analytics, price benchmarks, and the deal finder.
            </p>
            {['Median price/m² by area', 'Deal finder ranked by value', '% above/below market per listing', '50 tokens/month included'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', marginBottom: 6 }}>
                <span style={{ color: '#4ade80' }}>✓</span>
                <span style={{ fontSize: 12, color: t.textSub }}>{f}</span>
              </div>
            ))}
            <button
              onClick={() => setShowPricing(true)}
              style={{
                marginTop: 20, background: '#16a34a', border: 'none', borderRadius: 9,
                padding: '12px 28px', fontSize: 14, fontWeight: 700, color: '#fff',
                cursor: 'pointer', width: '100%',
              }}>
              View Plans & Upgrade
            </button>
            <p style={{ fontSize: 11, color: t.textMuted, marginTop: 10 }}>Cancel anytime · starts at $9/mo</p>
          </div>
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

  const maxPpsqm = maxPpsqmRef.current || 1

  return (
    <>
      <div style={{ height: '100%', overflow: 'auto', background: t.bg, fontFamily: "'DM Sans',sans-serif", transition: 'background 0.3s' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 48px' }}>

          {/* Header */}
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 700, color: t.text, letterSpacing: '-0.03em', marginBottom: 4 }}>
                Market Intelligence
              </h1>
              <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>
                {mode.period === 'sale' ? 'For Sale' : 'For Rent'} · {mode.type} ·{' '}
                {data.reduce((s, a) => s + a.count, 0).toLocaleString()} listings · {data.length} areas tracked
              </p>
            </div>
            <button
              disabled={!canExport}
              title={!canExport ? 'Analyst plan required' : 'Export to CSV'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: canExport ? t.accentBg : t.bgCard,
                border: `1px solid ${canExport ? t.accentBorder : t.border}`,
                borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600,
                color: canExport ? t.accent : t.textMuted,
                cursor: canExport ? 'pointer' : 'not-allowed', opacity: canExport ? 1 : 0.5,
              }}>
              📥 Export {!canExport && '🔒'}
            </button>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {[
              { id: 'market' as const, label: 'Market Overview', icon: '📊', locked: false },
              { id: 'deals'  as const, label: 'Deal Finder',     icon: '🎯', locked: !canDeals },
            ].map(v => (
              <button key={v.id} onClick={() => !v.locked && setActiveView(v.id)} style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: v.locked ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                background: activeView === v.id ? t.accentBg : t.bgCard,
                border: `1px solid ${activeView === v.id ? t.accentBorder : t.border}`,
                color: activeView === v.id ? t.accent : v.locked ? t.textMuted : t.textSub,
                opacity: v.locked ? 0.55 : 1,
                transition: 'all 0.15s',
              }}>
                {v.icon} {v.label} {v.locked && '🔒'}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: t.textMuted, fontSize: 13 }}>
              Computing market data...
            </div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: t.textMuted, fontSize: 13 }}>
              No areas with enough data for this selection (min 5 listings per area required).
            </div>
          ) : activeView === 'market' ? (

            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'Areas tracked',  value: data.length },
                  { label: 'Median $/m²',    value: `$${Math.round(median(data.map(a => a.median_ppsqm))).toLocaleString()}` },
                  { label: 'Most active',    value: [...data].sort((a, b) => b.count - a.count)[0]?.area || '-' },
                  { label: 'Highest value',  value: data[0]?.area || '-' },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px',
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: t.text }}>{value}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Bar chart — stable scale locked to maxPpsqmRef */}
              <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: t.text, margin: 0 }}>
                    Median Price per m² by Area
                  </h3>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: t.textMuted }}>min 5 listings</span>
                    {/* Scale indicator */}
                    <span style={{ fontSize: 10, color: t.textMuted, background: t.bgCard, padding: '2px 7px', borderRadius: 4, border: `1px solid ${t.border}` }}>
                      max ${maxPpsqm.toLocaleString()}/m²
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {data.slice(0, 30).map(a => {
                    const pct = Math.round((a.median_ppsqm / maxPpsqm) * 100)
                    const color = pct > 70 ? '#f87171' : pct > 40 ? '#facc15' : '#4ade80'
                    return (
                      <div key={a.area} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 130, fontSize: 12, color: t.textSub, textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.area}
                        </div>
                        <div style={{ flex: 1, height: 22, background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%', minWidth: 50,
                            background: `linear-gradient(90deg, ${color}80, ${color})`,
                            borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8,
                            transition: 'width 0.6s ease',
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,0,0,0.8)', whiteSpace: 'nowrap' }}>
                              ${a.median_ppsqm.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: t.textMuted, width: 55, textAlign: 'right', flexShrink: 0 }}>
                          {a.count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>

          ) : (

            /* DEAL FINDER */
            <div>
              <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>
                Areas ranked vs their regional median. Only areas with 5+ comparable listings shown.
              </p>
              {(() => {
                const regions: Record<string, typeof data> = {}
                data.forEach(a => {
                  const r = a.region || 'Other'
                  if (!regions[r]) regions[r] = []
                  regions[r].push(a)
                })
                return Object.entries(regions).map(([region, areas]) => {
                  const regionMedian = median(areas.map(a => a.median_ppsqm))
                  const sorted = [...areas].sort((a, b) => a.median_ppsqm - b.median_ppsqm)
                  return (
                    <div key={region} style={{
                      background: t.bgCard, border: `1px solid ${t.border}`,
                      borderRadius: 14, padding: 20, marginBottom: 14,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                        <h4 style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: t.textSub, margin: 0 }}>{region}</h4>
                        <span style={{ fontSize: 11, color: t.textMuted }}>Region median: ${Math.round(regionMedian).toLocaleString()}/m²</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {sorted.map(a => {
                          const diff = ((a.median_ppsqm - regionMedian) / regionMedian) * 100
                          const isBelow = diff < 0
                          return (
                            <div key={a.area} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 12px', borderRadius: 8,
                              background: isBelow ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)',
                              border: `1px solid ${isBelow ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {isBelow ? <TrendingDown size={13} color="#4ade80"/> : <TrendingUp size={13} color="#f87171"/>}
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{a.area}</div>
                                  <div style={{ fontSize: 11, color: t.textMuted }}>{a.count} listings</div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: isBelow ? '#4ade80' : '#f87171' }}>
                                  {isBelow ? '▼' : '▲'} {Math.abs(Math.round(diff))}%
                                </div>
                                <div style={{ fontSize: 11, color: t.textMuted }}>${a.median_ppsqm.toLocaleString()}/m²</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
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
