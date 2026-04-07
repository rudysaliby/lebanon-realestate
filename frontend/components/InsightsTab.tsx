'use client'
import { useEffect, useState, useRef } from 'react'
import { TrendingDown, TrendingUp, Crown, ChevronRight, ChevronLeft, Coins } from 'lucide-react'
import { useTheme, T } from '@/components/ThemeContext'
import { canViewInsights, canViewDealFinder, canExportCSV, getTier } from '@/lib/useTier'
import PricingPage from '@/components/PricingPage'
import AnalystFeatures from '@/components/AnalystFeatures'
import type { Mode } from '@/app/page'

function median(arr: number[]) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function StatCard({ label, value, sub, color }: any) {
  const { theme } = useTheme()
  const t = T[theme]
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: color || t.text }}>{value}</div>
      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: t.accent, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// Deal Finder drill-down: Region → Subregion → Area → Cards
function DealFinder({ data, mode, user, onSignIn, t, theme }: any) {
  type DrillLevel = 'region' | 'subregion' | 'area'
  const [level, setLevel]         = useState<DrillLevel>('region')
  const [selRegion, setSelRegion] = useState<string | null>(null)
  const [selSubregion, setSelSubregion] = useState<string | null>(null)
  const [tokenUsed, setTokenUsed] = useState(false)
  const canUse = canViewDealFinder(user)
  const tokens = user?.user_metadata?.tokens || 0

  // Group data by region → subregion → area
  const byRegion: Record<string, any[]> = {}
  data.forEach((a: any) => {
    const r = a.region || 'Other'
    if (!byRegion[r]) byRegion[r] = []
    byRegion[r].push(a)
  })

  const bySubregion: Record<string, any[]> = {}
  if (selRegion) {
    byRegion[selRegion]?.forEach((a: any) => {
      const s = a.subregion || a.region || 'Other'
      if (!bySubregion[s]) bySubregion[s] = []
      bySubregion[s].push(a)
    })
  }

  const dealScore = (a: any, regionMedian: number) => {
    if (!a.median_ppsqm || !regionMedian) return 0
    return ((regionMedian - a.median_ppsqm) / regionMedian) * 100 // positive = below market = good deal
  }

  if (!canUse) {
    return (
      <div style={{
        textAlign: 'center', padding: '48px 24px',
        background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14,
      }}>
        <Crown size={32} color={t.accent} style={{ marginBottom: 12 }} />
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>
          Deal Finder — Explorer required
        </h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
          Discover which regions, subregions, and areas have the most undervalued listings.
        </p>
        <button onClick={onSignIn} style={{
          background: '#16a34a', border: 'none', borderRadius: 9,
          padding: '11px 28px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
        }}>Upgrade to Explorer — $9/mo</button>
      </div>
    )
  }

  // Region level
  if (level === 'region') {
    const regionData = Object.entries(byRegion).map(([region, areas]) => {
      const regionMedian = median(areas.map((a: any) => a.median_ppsqm))
      const goodDeals = areas.filter((a: any) => dealScore(a, regionMedian) > 10).length
      const totalListings = areas.reduce((s: any, a: any) => s + a.count, 0)
      return { region, areas, regionMedian, goodDeals, totalListings }
    }).sort((a, b) => b.goodDeals - a.goodDeals)

    return (
      <div>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>
          Click a region to explore subregions and find the best deals.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {regionData.map(({ region, goodDeals, totalListings, regionMedian }) => (
            <button
              key={region}
              onClick={() => { setSelRegion(region); setLevel('subregion') }}
              style={{
                background: goodDeals > 0 ? 'rgba(74,222,128,0.06)' : t.bgCard,
                border: `1px solid ${goodDeals > 0 ? 'rgba(74,222,128,0.2)' : t.border}`,
                borderRadius: 12, padding: '18px 16px', cursor: 'pointer',
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: t.text }}>{region}</span>
                <ChevronRight size={14} color={t.textMuted} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: goodDeals > 5 ? 'rgba(74,222,128,0.15)' : goodDeals > 0 ? 'rgba(250,204,21,0.15)' : t.bgCard,
                  color: goodDeals > 5 ? '#4ade80' : goodDeals > 0 ? '#facc15' : t.textMuted,
                }}>
                  {goodDeals > 0 ? `🎯 ${goodDeals} good deals` : 'No deals'}
                </span>
                <span style={{ fontSize: 11, color: t.textMuted }}>{totalListings.toLocaleString()} listings</span>
              </div>
              {regionMedian > 0 && (
                <div style={{ fontSize: 11, color: t.textMuted }}>
                  Median ${Math.round(regionMedian).toLocaleString()}/m²
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Subregion level
  if (level === 'subregion' && selRegion) {
    const regionAreas = byRegion[selRegion] || []
    const regionMedian = median(regionAreas.map((a: any) => a.median_ppsqm))
    const subData = Object.entries(bySubregion).map(([sub, areas]) => {
      const subMedian = median(areas.map((a: any) => a.median_ppsqm))
      const goodDeals = areas.filter((a: any) => dealScore(a, regionMedian) > 10).length
      const totalListings = areas.reduce((s: any, a: any) => s + a.count, 0)
      return { sub, areas, subMedian, goodDeals, totalListings, diff: dealScore({ median_ppsqm: subMedian }, regionMedian) }
    }).sort((a, b) => b.goodDeals - a.goodDeals)

    return (
      <div>
        <button onClick={() => { setLevel('region'); setSelRegion(null) }} style={{
          background: 'none', border: 'none', color: t.textMuted, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16,
        }}><ChevronLeft size={12}/> {selRegion}</button>

        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>
          Region median: <strong style={{ color: t.text }}>${Math.round(regionMedian).toLocaleString()}/m²</strong>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {subData.map(({ sub, goodDeals, totalListings, subMedian, diff }) => (
            <button
              key={sub}
              onClick={() => { setSelSubregion(sub); setLevel('area') }}
              style={{
                background: diff > 10 ? 'rgba(74,222,128,0.06)' : diff < -10 ? 'rgba(248,113,113,0.04)' : t.bgCard,
                border: `1px solid ${diff > 10 ? 'rgba(74,222,128,0.2)' : diff < -10 ? 'rgba(248,113,113,0.15)' : t.border}`,
                borderRadius: 12, padding: '16px', cursor: 'pointer',
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: t.text }}>{sub}</span>
                <ChevronRight size={13} color={t.textMuted} />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {diff !== 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                    color: diff > 0 ? '#4ade80' : '#f87171',
                    background: diff > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                  }}>
                    {diff > 0 ? '▼' : '▲'} {Math.abs(Math.round(diff))}% vs region
                  </span>
                )}
                {goodDeals > 0 && (
                  <span style={{ fontSize: 11, color: '#4ade80' }}>🎯 {goodDeals} deals</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted }}>
                ${Math.round(subMedian).toLocaleString()}/m² · {totalListings.toLocaleString()} listings
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Area level
  if (level === 'area' && selRegion && selSubregion) {
    const regionMedian = median((byRegion[selRegion] || []).map((a: any) => a.median_ppsqm))
    const areaData = (bySubregion[selSubregion] || [])
      .map((a: any) => ({ ...a, score: dealScore(a, regionMedian) }))
      .sort((a: any, b: any) => b.score - a.score)

    return (
      <div>
        <button onClick={() => setLevel('subregion')} style={{
          background: 'none', border: 'none', color: t.textMuted, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16,
        }}><ChevronLeft size={12}/> {selRegion} › {selSubregion}</button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {areaData.map((a: any) => (
            <div key={a.area} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 10,
              background: a.score > 15 ? 'rgba(74,222,128,0.06)' : a.score < -15 ? 'rgba(248,113,113,0.05)' : t.bgCard,
              border: `1px solid ${a.score > 15 ? 'rgba(74,222,128,0.15)' : a.score < -15 ? 'rgba(248,113,113,0.12)' : t.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {a.score > 0 ? <TrendingDown size={14} color="#4ade80"/> : <TrendingUp size={14} color="#f87171"/>}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{a.area}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{a.count} listings</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: a.score > 0 ? '#4ade80' : '#f87171' }}>
                  {a.score > 0 ? '▼' : '▲'} {Math.abs(Math.round(a.score))}% vs region
                </span>
                <span style={{ fontSize: 11, color: t.textMuted }}>${a.median_ppsqm?.toLocaleString()}/m²</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export default function InsightsTab({ mode, user, onSignIn, onTokensChanged }: {
  mode: Mode, user: any, onSignIn: () => void, onTokensChanged?: () => Promise<any>
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'market' | 'deals' | 'features'>('market')
  const [showPricing, setShowPricing] = useState(false)
  const maxPpsqmRef = useRef<number>(1)

  const canInsights = canViewInsights(user)
  const canExport   = canExportCSV(user)
  const tier        = getTier(user)

  useEffect(() => {
    if (!canInsights) { setLoading(false); return }
    let cancelled = false
    setLoading(true)

    const fetchData = async () => {
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
        if (!areas[key]) areas[key] = {
          area: p.area || key, region: p.region || '',
          subregion: p.subregion || p.region || '',
          ppsqms: [], prices: [], count: 0
        }
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

      if (result.length > 0) maxPpsqmRef.current = result[0].median_ppsqm
      setData(result)
      setLoading(false)
    }

    fetchData()
    return () => { cancelled = true }
  }, [mode.period, mode.type, canInsights])

  const handleUpgrade = async (planId: string, priceId: string) => {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId: user?.id, email: user?.email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { alert('Contact us at hello@iqari.com to upgrade') }
  }

  // Not signed in
  if (!user) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg }}>
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>Sign in for Insights</h2>
        <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, marginBottom: 24 }}>Market analytics and deal finder — free with an account.</p>
        <button onClick={onSignIn} style={{ background: '#16a34a', border: 'none', borderRadius: 9, padding: '12px 28px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', width: '100%' }}>
          Create free account
        </button>
      </div>
    </div>
  )

  // Free tier upgrade prompt
  if (!canInsights) return (
    <>
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, filter: 'blur(6px)', opacity: 0.25, pointerEvents: 'none', padding: 32 }}>
          {[90,75,60,48,35,22].map((w,i) => (
            <div key={i} style={{ display:'flex', gap:12, marginBottom:10, alignItems:'center' }}>
              <div style={{ width:120, height:18, background:t.border, borderRadius:4 }} />
              <div style={{ width:`${w}%`, height:24, background:'#4ade80', borderRadius:4, opacity:0.6 }} />
            </div>
          ))}
        </div>
        <div style={{
          background: theme === 'dark' ? 'rgba(15,15,15,0.96)' : 'rgba(255,255,255,0.96)',
          border: `1px solid ${t.accentBorder}`,
          borderRadius: 16, padding: '36px 40px', textAlign: 'center', maxWidth: 420,
          position: 'relative', zIndex: 10, boxShadow: t.shadow,
        }}>
          <Crown size={28} color="#4ade80" style={{ marginBottom: 14 }} />
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>Insights — Explorer & above</h2>
          <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, marginBottom: 20 }}>Market analytics, benchmarks, and a drill-down deal finder by region.</p>
          {['Median price/m² by area','Deal finder: Region → Subregion → Area','% above/below market per listing','50 tokens/month for AI features'].map(f => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:8, textAlign:'left', marginBottom:6 }}>
              <span style={{ color:'#4ade80' }}>✓</span>
              <span style={{ fontSize:12, color:t.textSub }}>{f}</span>
            </div>
          ))}
          <button onClick={() => setShowPricing(true)} style={{ marginTop:20, background:'#16a34a', border:'none', borderRadius:9, padding:'12px 28px', fontSize:14, fontWeight:700, color:'#fff', cursor:'pointer', width:'100%' }}>
            View Plans & Upgrade
          </button>
          <p style={{ fontSize:11, color:t.textMuted, marginTop:10 }}>Starts at $9/mo · cancel anytime</p>
        </div>
      </div>
      {showPricing && <PricingPage onClose={() => setShowPricing(false)} currentTier={tier} user={user} onUpgrade={handleUpgrade} />}
    </>
  )

  const maxPpsqm = maxPpsqmRef.current || 1
  const totalListings = data.reduce((s,a) => s + a.count, 0)
  const overallMedian = Math.round(median(data.map(a => a.median_ppsqm)))

  return (
    <>
      <div style={{ height:'100%', overflow:'auto', background:t.bg, fontFamily:"'DM Sans',sans-serif", transition:'background 0.3s' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 24px 48px' }}>

          {/* Header */}
          <div style={{ marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
            <div>
              <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:700, color:t.text, letterSpacing:'-0.03em', marginBottom:4 }}>
                Market Intelligence
              </h1>
              <p style={{ fontSize:12, color:t.textMuted, margin:0 }}>
                {mode.period === 'sale' ? 'For Sale' : 'For Rent'} · {mode.type} · {totalListings.toLocaleString()} listings · {data.length} areas
              </p>
            </div>
            <button disabled={!canExport} title={!canExport ? 'Analyst plan required' : 'Export'} style={{
              display:'flex', alignItems:'center', gap:6,
              background:canExport ? t.accentBg : t.bgCard,
              border:`1px solid ${canExport ? t.accentBorder : t.border}`,
              borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600,
              color:canExport ? t.accent : t.textMuted,
              cursor:canExport ? 'pointer' : 'not-allowed', opacity:canExport ? 1 : 0.5,
            }}>📥 Export {!canExport && '🔒'}</button>
          </div>

          {/* View toggle */}
          <div style={{ display:'flex', gap:8, marginBottom:24 }}>
            {[
              { id:'market'   as const, label:'Market Overview', icon:'📊' },
              { id:'deals'    as const, label:'Deal Finder',     icon:'🎯' },
              { id:'features' as const, label:'Tools & Exports', icon:'⚡' },
            ].map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id)} style={{
                padding:'7px 16px', borderRadius:8, fontSize:13, fontWeight:600,
                cursor:'pointer', display:'flex', alignItems:'center', gap:6,
                background:activeView===v.id ? t.accentBg : t.bgCard,
                border:`1px solid ${activeView===v.id ? t.accentBorder : t.border}`,
                color:activeView===v.id ? t.accent : t.textSub,
                transition:'all 0.15s',
              }}>{v.icon} {v.label}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:t.textMuted }}>Computing market data...</div>
          ) : data.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:t.textMuted }}>No areas with 5+ listings for this selection.</div>
          ) : activeView === 'features' ? (
            <div>
              <AnalystFeatures user={user} onUpgrade={(action) => {
                if (!user) { onSignIn(); return }
                setShowPricing(true)
              }} onTokensChanged={onTokensChanged} />
            </div>
          ) : activeView === 'market' ? (
            <>
              {/* Summary */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:28 }}>
                <StatCard label="Areas tracked"  value={data.length} />
                <StatCard label="Median $/m²"    value={`$${overallMedian.toLocaleString()}`} color={t.accent} />
                <StatCard label="Most listings"  value={[...data].sort((a,b)=>b.count-a.count)[0]?.area||'-'} />
                <StatCard label="Highest value"  value={data[0]?.area||'-'} />
              </div>

              {/* Bar chart — stable scale */}
              <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:14, padding:'20px 24px', marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                  <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:t.text, margin:0 }}>
                    Median Price per m² by Area
                  </h3>
                  <span style={{ fontSize:10, color:t.textMuted, background:t.bgCard, padding:'2px 7px', borderRadius:4, border:`1px solid ${t.border}` }}>
                    scale max ${maxPpsqm.toLocaleString()}/m²
                  </span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {data.slice(0,30).map(a => {
                    const pct   = Math.round((a.median_ppsqm / maxPpsqm) * 100)
                    const color = pct > 70 ? '#f87171' : pct > 40 ? '#facc15' : '#4ade80'
                    return (
                      <div key={a.area} style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:130, fontSize:12, color:t.textSub, textAlign:'right', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {a.area}
                        </div>
                        <div style={{ flex:1, height:22, background:theme==='dark'?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)', borderRadius:4, overflow:'hidden' }}>
                          <div style={{ width:`${pct}%`, height:'100%', minWidth:50, background:`linear-gradient(90deg,${color}70,${color})`, borderRadius:4, display:'flex', alignItems:'center', paddingLeft:8, transition:'width 0.5s ease' }}>
                            <span style={{ fontSize:10, fontWeight:700, color:'rgba(0,0,0,0.8)', whiteSpace:'nowrap' }}>${a.median_ppsqm.toLocaleString()}</span>
                          </div>
                        </div>
                        <span style={{ fontSize:11, color:t.textMuted, width:50, textAlign:'right', flexShrink:0 }}>{a.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Distribution insight */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:12, padding:'16px 18px' }}>
                  <h4 style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:t.text, margin:'0 0 12px' }}>Best Value Areas 🟢</h4>
                  {data.slice(-5).reverse().map(a => (
                    <div key={a.area} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${t.border}` }}>
                      <span style={{ fontSize:12, color:t.text }}>{a.area}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:'#4ade80' }}>${a.median_ppsqm.toLocaleString()}/m²</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:12, padding:'16px 18px' }}>
                  <h4 style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:t.text, margin:'0 0 12px' }}>Premium Areas 🔴</h4>
                  {data.slice(0,5).map(a => (
                    <div key={a.area} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${t.border}` }}>
                      <span style={{ fontSize:12, color:t.text }}>{a.area}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:'#f87171' }}>${a.median_ppsqm.toLocaleString()}/m²</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <DealFinder data={data} mode={mode} user={user} onSignIn={() => setShowPricing(true)} t={t} theme={theme} />
          )}
        </div>
      </div>

      {showPricing && <PricingPage onClose={() => setShowPricing(false)} currentTier={tier} user={user} onUpgrade={handleUpgrade} />}
    </>
  )
}
