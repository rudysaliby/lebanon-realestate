'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, ExternalLink, BarChart2, MapPin, Home, DollarSign, Tag, ArrowUpRight, ArrowDownRight } from 'lucide-react'

function fmt(n: number | null) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtK(n: number) {
  return n >= 1000 ? `$${Math.round(n/1000)}k` : `$${n}`
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }: any) {
  return (
    <div style={{ background:'#1a1a1a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'16px 20px', flex:1, minWidth:140 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:28, height:28, borderRadius:8, background:`${color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize:24, fontWeight:700, fontFamily:"'Syne',sans-serif", color:'#f0ede6' }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// ── Horizontal Bar Chart ───────────────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, colorFn, unit='' }: any) {
  if (!data?.length) return <div style={{ color:'rgba(255,255,255,0.3)', fontSize:13, padding:'20px 0', textAlign:'center' }}>No data yet</div>
  const max = Math.max(...data.map((d: any) => d[valueKey]))
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {data.map((item: any, i: number) => {
        const val = item[valueKey]
        const pct = max > 0 ? (val / max) * 100 : 0
        const color = colorFn ? colorFn(pct, i) : '#22c55e'
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.6)', minWidth:110, textAlign:'right', flexShrink:0 }}>
              {item[labelKey]}
            </span>
            <div style={{ flex:1, height:8, background:'rgba(255,255,255,0.06)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:4, transition:'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)', minWidth:80, textAlign:'right' }}>
              {unit}{val.toLocaleString()}
            </span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)', minWidth:20 }}>
              {item.listing_count && `${item.listing_count}L`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Price Distribution ─────────────────────────────────────────────────────────
function PriceDistribution({ data }: { data: any[] }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d.count))
  const colors = ['#4ade80','#22c55e','#fbbf24','#f87171']
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:100 }}>
      {data.map((d, i) => {
        const h = max > 0 ? (d.count / max) * 80 : 0
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>{d.count}</span>
            <div style={{ width:'100%', height:h, background:colors[i], borderRadius:'4px 4px 0 0', minHeight: d.count > 0 ? 4 : 0 }} />
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textAlign:'center', lineHeight:1.2 }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Valuation Donut ────────────────────────────────────────────────────────────
function ValuationBreakdown({ summary }: { summary: any }) {
  if (!summary) return null
  const { undervaluedCount, fairCount, overvaluedCount, totalListings } = summary
  const segments = [
    { label: 'Undervalued', count: undervaluedCount, color: '#4ade80' },
    { label: 'Fair', count: fairCount, color: '#818cf8' },
    { label: 'Overvalued', count: overvaluedCount, color: '#f87171' },
  ]
  return (
    <div style={{ display:'flex', gap:16, alignItems:'center' }}>
      {segments.map(s => (
        <div key={s.label} style={{ flex:1, background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:700, fontFamily:"'Syne',sans-serif", color:s.color }}>{s.count}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{s.label}</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>
            {totalListings > 0 ? `${Math.round(s.count/totalListings*100)}%` : '0%'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Deal Card ─────────────────────────────────────────────────────────────────
function DealCard({ deal }: { deal: any }) {
  const isUnder = deal.valuation === 'undervalued'
  const isOver = deal.valuation === 'overvalued'
  const borderColor = isUnder ? 'rgba(34,197,94,0.3)' : isOver ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'

  return (
    <div style={{ background:'#1a1a1a', border:`1px solid ${borderColor}`, borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      {deal.image_url && (
        <div style={{ position:'relative', height:130, overflow:'hidden' }}>
          <img src={deal.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 50%, #1a1a1a)' }} />
          {isUnder && (
            <div style={{ position:'absolute', top:8, right:8, background:'rgba(34,197,94,0.9)', borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:700, color:'#fff', display:'flex', alignItems:'center', gap:4 }}>
              <ArrowDownRight size={11} /> -{deal.discount}%
            </div>
          )}
          {isOver && (
            <div style={{ position:'absolute', top:8, right:8, background:'rgba(239,68,68,0.9)', borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:700, color:'#fff', display:'flex', alignItems:'center', gap:4 }}>
              <ArrowUpRight size={11} /> +{Math.abs(deal.discount)}%
            </div>
          )}
        </div>
      )}
      <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', lineHeight:1.3 }}>
          {deal.title?.slice(0,65)}{deal.title?.length > 65 ? '…' : ''}
        </div>
        <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
          <span style={{ fontSize:17, fontWeight:700, fontFamily:"'Syne',sans-serif", color:'#f0ede6' }}>
            {fmt(deal.price)}
          </span>
          {deal.price_period === 'monthly' && <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>/mo</span>}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {deal.area && <span style={{ fontSize:11, color:'#22c55e' }}>📍 {deal.area}</span>}
          {deal.size_sqm && <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>{deal.size_sqm}m²</span>}
          {deal.bedrooms && <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>🛏 {deal.bedrooms}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>${Number(deal.price_per_sqm).toLocaleString()}/m²</div>
            {deal.area_avg_psqm && <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)' }}>avg ${Number(deal.area_avg_psqm).toLocaleString()}/m²</div>}
          </div>
          <a href={deal.url} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#22c55e', textDecoration:'none', background:'rgba(34,197,94,0.1)', padding:'5px 10px', borderRadius:8 }}>
            View <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InsightsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'undervalued'|'fair'|'overvalued'>('all')
  const [period, setPeriod] = useState('sale')
  const [propType, setPropType] = useState('all')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/deals?period=${period}&type=${propType}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period, propType])

  const deals = (data?.deals || []).filter((d: any) =>
    filter === 'all' ? true : d.valuation === filter
  )

  const pill = (label: string, val: string, current: string, set: (v: any) => void, color='#22c55e') => (
    <button onClick={() => set(val)} style={{
      padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer',
      background: current === val ? `${color}25` : 'rgba(255,255,255,0.05)',
      border: `1px solid ${current === val ? `${color}60` : 'rgba(255,255,255,0.1)'}`,
      color: current === val ? color : 'rgba(255,255,255,0.5)',
      fontFamily:"'DM Sans',sans-serif",
    }}>{label}</button>
  )

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'rgba(255,255,255,0.3)', fontFamily:"'DM Sans',sans-serif", flexDirection:'column', gap:12 }}>
      <BarChart2 size={24} color="rgba(255,255,255,0.2)" />
      Loading market data...
    </div>
  )

  const { summary, areaAnalytics, regionAnalytics, priceDistribution } = data || {}

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:'20px 24px', fontFamily:"'DM Sans',sans-serif", background:'#111' }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:'#f0ede6', margin:'0 0 4px' }}>
          Market Intelligence
        </h2>
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', margin:0 }}>
          Lebanon real estate · {summary?.totalListings || 0} listings analyzed
        </p>
      </div>

      {/* Filters row */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Period</span>
        {pill('For Sale', 'sale', period, setPeriod)}
        {pill('For Rent', 'monthly', period, setPeriod)}
        {pill('All', 'all', period, setPeriod)}
        <div style={{ width:1, height:20, background:'rgba(255,255,255,0.1)', margin:'0 4px' }} />
        <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Type</span>
        {pill('Apartment', 'apartment', propType, setPropType, '#60a5fa')}
        {pill('Villa', 'villa', propType, setPropType, '#60a5fa')}
        {pill('All', 'all', propType, setPropType, '#60a5fa')}
      </div>

      {/* Summary stats */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="Listings" value={summary?.totalListings || 0} sub="with price data" color="#22c55e" icon={Home} />
        <StatCard label="Avg $/m²" value={summary?.avgPsqm ? `$${summary.avgPsqm.toLocaleString()}` : 'N/A'} sub="across all areas" color="#60a5fa" icon={DollarSign} />
        <StatCard label="Best Deals" value={summary?.undervaluedCount || 0} sub=">15% below area avg" color="#4ade80" icon={TrendingDown} />
        <StatCard label="Overvalued" value={summary?.overvaluedCount || 0} sub=">15% above area avg" color="#f87171" icon={TrendingUp} />
      </div>

      {/* Valuation breakdown + Price distribution */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={{ background:'#1a1a1a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#f0ede6', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            <Minus size={14} color="#818cf8" /> Valuation Breakdown
          </div>
          <ValuationBreakdown summary={summary} />
        </div>
        <div style={{ background:'#1a1a1a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#f0ede6', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            <DollarSign size={14} color="#fbbf24" /> Price Range Distribution
          </div>
          <PriceDistribution data={priceDistribution} />
        </div>
      </div>

      {/* Area price chart */}
      <div style={{ background:'#1a1a1a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <BarChart2 size={14} color="#22c55e" />
            <span style={{ fontSize:13, fontWeight:500, color:'#f0ede6' }}>Avg Price/m² by Area</span>
          </div>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>min 2 listings</span>
        </div>
        <BarChart
          data={areaAnalytics}
          labelKey="area"
          valueKey="avg_price_per_sqm"
          unit="$"
          colorFn={(pct: number) => pct > 75 ? '#f87171' : pct > 50 ? '#fbbf24' : pct > 25 ? '#60a5fa' : '#4ade80'}
        />
      </div>

      {/* Region chart */}
      {regionAnalytics?.length > 0 && (
        <div style={{ background:'#1a1a1a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:20, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <MapPin size={14} color="#a78bfa" />
            <span style={{ fontSize:13, fontWeight:500, color:'#f0ede6' }}>Avg Price/m² by Region</span>
          </div>
          <BarChart
            data={regionAnalytics}
            labelKey="region"
            valueKey="avg_price_per_sqm"
            unit="$"
            colorFn={() => '#a78bfa'}
          />
        </div>
      )}

      {/* Deals section */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Tag size={14} color="rgba(255,255,255,0.4)" />
            <span style={{ fontSize:13, fontWeight:500, color:'#f0ede6' }}>Listings</span>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>({deals.length})</span>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {pill('All', 'all', filter, setFilter)}
            {pill('Best Deals 🟢', 'undervalued', filter, setFilter)}
            {pill('Fair 🟣', 'fair', filter, setFilter)}
            {pill('Overvalued 🔴', 'overvalued', filter, setFilter, '#f87171')}
          </div>
        </div>

        {deals.length === 0 ? (
          <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', padding:40, fontSize:14, background:'#1a1a1a', borderRadius:14 }}>
            No listings match this filter — try "All" or run the scraper for more data.
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:14 }}>
            {deals.map((deal: any) => <DealCard key={deal.id} deal={deal} />)}
          </div>
        )}
      </div>
    </div>
  )
}