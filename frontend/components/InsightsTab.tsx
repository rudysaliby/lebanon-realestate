'use client'
import { useEffect, useState } from 'react'
import { Lock, TrendingDown, TrendingUp, BarChart2 } from 'lucide-react'
import type { Mode } from '@/app/page'

function median(arr: number[]) {
  if (!arr.length) return 0
  const s = [...arr].sort((a,b) => a-b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m-1]+s[m])/2
}

export default function InsightsTab({ mode, user, onSignIn }: {
  mode: Mode, user: any, onSignIn: () => void
}) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'market' | 'deals'>('market')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const p = new URLSearchParams()
      p.set('period', mode.period)
      p.set('type_group', mode.type)
      const res = await fetch(`/api/listings?${p}`)
      const geojson = await res.json()
      const features = geojson?.features || []

      // Aggregate by area
      const areas: Record<string, { area: string, region: string, ppsqms: number[], prices: number[], count: number }> = {}
      for (const f of features) {
        const p = f.properties
        const key = p.area || p.region || 'Unknown'
        if (!areas[key]) areas[key] = { area: p.area || key, region: p.region || '', ppsqms: [], prices: [], count: 0 }
        areas[key].count++
        if (p.price && p.size_sqm) areas[key].ppsqms.push(p.price / p.size_sqm)
        if (p.price) areas[key].prices.push(p.price)
      }

      const result = Object.values(areas)
        .filter(a => a.ppsqms.length >= 5) // min 5 data points
        .map(a => ({
          ...a,
          median_ppsqm: Math.round(median(a.ppsqms)),
          median_price: Math.round(median(a.prices)),
        }))
        .sort((a,b) => b.median_ppsqm - a.median_ppsqm)

      setData(result)
      setLoading(false)
    }
    fetchData()
  }, [mode])

  if (!user) {
    return (
      <div style={{
        height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
        flexDirection:'column', gap:16, background:'#0a0a0a', fontFamily:"'DM Sans',sans-serif",
      }}>
        <div style={{
          background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:16, padding:'40px', textAlign:'center', maxWidth:380,
        }}>
          <Lock size={32} color="rgba(255,255,255,0.2)" style={{ marginBottom:16 }} />
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:'#f0ede6', marginBottom:8 }}>
            Insights require an account
          </h2>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', lineHeight:1.6, marginBottom:24 }}>
            Sign in free to access market analytics, price benchmarks, and the deal finder.
          </p>
          <button onClick={onSignIn} style={{
            background:'#1a6b3a', border:'none', borderRadius:9,
            padding:'12px 28px', fontSize:14, fontWeight:600, color:'#fff', cursor:'pointer', width:'100%',
          }}>Create free account</button>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.2)', marginTop:12 }}>
            Explorer & Analyst plans unlock advanced features
          </p>
        </div>
      </div>
    )
  }

  const maxPpsqm = data[0]?.median_ppsqm || 1

  // Deal finder — top undervalued listings
  const deals = data.filter(a => a.count >= 5).map(a => ({
    ...a,
    // Areas with lowest price vs their region median
  }))

  return (
    <div style={{ height:'100%', overflow:'auto', background:'#0a0a0a', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 24px 48px' }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:700, color:'#f0ede6', letterSpacing:'-0.03em', marginBottom:4 }}>
            Market Intelligence
          </h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>
            {mode.period === 'sale' ? 'For Sale' : 'For Rent'} · {mode.type.charAt(0).toUpperCase()+mode.type.slice(1)} ·
            Based on {data.reduce((s,a) => s+a.count, 0).toLocaleString()} listings with price/sqm data
          </p>
        </div>

        {/* View toggle */}
        <div style={{ display:'flex', gap:8, marginBottom:28 }}>
          {[
            { id:'market' as const, label:'Market Overview', icon:'📊' },
            { id:'deals' as const, label:'Deal Finder', icon:'🎯' },
          ].map(v => (
            <button key={v.id} onClick={() => setActiveView(v.id)} style={{
              padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600,
              cursor:'pointer', display:'flex', alignItems:'center', gap:6,
              background: activeView===v.id ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${activeView===v.id ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: activeView===v.id ? '#4ade80' : 'rgba(255,255,255,0.5)',
            }}>{v.icon} {v.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'rgba(255,255,255,0.3)' }}>
            Computing market data...
          </div>
        ) : activeView === 'market' ? (

          <>
            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:32 }}>
              {[
                { label:'Areas tracked', value: data.length, suffix:'' },
                { label:'Median $/m²', value: Math.round(median(data.map(a=>a.median_ppsqm))).toLocaleString(), prefix:'$' },
                { label:'Most active', value: data.sort((a,b)=>b.count-a.count)[0]?.area || '-', suffix:'' },
                { label:'Highest value', value: data[0]?.area || '-', suffix:'' },
              ].map(({ label, value, prefix, suffix }) => (
                <div key={label} style={{
                  background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
                  borderRadius:12, padding:'16px 18px',
                }}>
                  <div style={{ fontSize:20, fontWeight:700, fontFamily:"'Syne',sans-serif", color:'#f0ede6' }}>
                    {prefix}{value}{suffix}
                  </div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:4 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Bar chart — median price/sqm per area */}
            <div style={{
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:14, padding:'20px 24px',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, color:'#f0ede6' }}>
                  Median Price per m² by Area
                </h3>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>min 5 listings required</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {data.slice(0, 25).map((a, i) => {
                  const pct = (a.median_ppsqm / maxPpsqm) * 100
                  const color = pct > 75 ? '#f87171' : pct > 50 ? '#facc15' : '#4ade80'
                  return (
                    <div key={a.area} style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:140, fontSize:12, color:'rgba(255,255,255,0.7)', textAlign:'right', flexShrink:0 }}>
                        {a.area}
                      </div>
                      <div style={{ flex:1, height:24, background:'rgba(255,255,255,0.05)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{
                          width:`${pct}%`, height:'100%',
                          background:`linear-gradient(90deg, ${color}99, ${color})`,
                          borderRadius:4, transition:'width 0.8s ease',
                          display:'flex', alignItems:'center', paddingLeft:8,
                          minWidth:60,
                        }}>
                          <span style={{ fontSize:11, fontWeight:600, color:'rgba(0,0,0,0.8)', whiteSpace:'nowrap' }}>
                            ${a.median_ppsqm.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)', width:60, textAlign:'right', flexShrink:0 }}>
                        {a.count} listings
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
            <div style={{ marginBottom:20 }}>
              <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#f0ede6', marginBottom:4 }}>
                🎯 Best Value Areas
              </h3>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>
                Areas ranked by value — comparing median price/m² vs regional average.
                Only areas with 5+ listings shown.
              </p>
            </div>

            {/* Regional comparison */}
            {(() => {
              // Group by region
              const regions: Record<string, typeof data> = {}
              data.forEach(a => {
                const r = a.region || 'Other'
                if (!regions[r]) regions[r] = []
                regions[r].push(a)
              })

              return Object.entries(regions).map(([region, areas]) => {
                const regionMedian = median(areas.map(a => a.median_ppsqm))
                const sorted = [...areas].sort((a,b) => a.median_ppsqm - b.median_ppsqm)

                return (
                  <div key={region} style={{
                    background:'rgba(255,255,255,0.03)',
                    border:'1px solid rgba(255,255,255,0.07)',
                    borderRadius:14, padding:'20px', marginBottom:16,
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                      <h4 style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.8)', margin:0 }}>
                        {region}
                      </h4>
                      <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>
                        Region median: ${Math.round(regionMedian).toLocaleString()}/m²
                      </span>
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {sorted.map(a => {
                        const diff = ((a.median_ppsqm - regionMedian) / regionMedian) * 100
                        const isBelow = diff < 0
                        const absDiff = Math.abs(Math.round(diff))
                        return (
                          <div key={a.area} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'10px 14px', borderRadius:8,
                            background: isBelow ? 'rgba(74,222,128,0.05)' : 'rgba(248,113,113,0.05)',
                            border: `1px solid ${isBelow ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)'}`,
                          }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <span style={{ fontSize:14 }}>{isBelow ? <TrendingDown size={14} color="#4ade80" /> : <TrendingUp size={14} color="#f87171" />}</span>
                              <div>
                                <div style={{ fontSize:13, fontWeight:600, color:'#f0ede6' }}>{a.area}</div>
                                <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>{a.count} listings</div>
                              </div>
                            </div>
                            <div style={{ textAlign:'right' }}>
                              <div style={{ fontSize:14, fontWeight:700, color: isBelow ? '#4ade80' : '#f87171' }}>
                                {isBelow ? '▼' : '▲'} {absDiff}%
                              </div>
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>
                                ${a.median_ppsqm.toLocaleString()}/m²
                              </div>
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
  )
}
