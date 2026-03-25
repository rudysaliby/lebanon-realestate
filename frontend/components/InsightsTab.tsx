'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, ExternalLink, BarChart2, Tag } from 'lucide-react'

function fmt(n: number | null) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function DiscountBadge({ discount }: { discount: number }) {
  if (discount > 15) return (
    <span style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      -{discount}% vs avg
    </span>
  )
  if (discount < -15) return (
    <span style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      +{Math.abs(discount)}% above avg
    </span>
  )
  return (
    <span style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
      Fair price
    </span>
  )
}

function DealCard({ deal }: { deal: any }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {deal.image_url && (
        <img src={deal.image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      )}
      <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
          {deal.title?.slice(0, 70)}{deal.title?.length > 70 ? '...' : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: '#f0ede6' }}>
            {fmt(deal.price)}
            {deal.price_period === 'monthly' && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>/mo</span>}
          </span>
          <DiscountBadge discount={deal.discount} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {deal.area && <span style={{ fontSize: 11, color: '#22c55e' }}>📍 {deal.area}</span>}
          {deal.size_sqm && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{deal.size_sqm}m²</span>}
          {deal.price_per_sqm && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>${Number(deal.price_per_sqm).toLocaleString()}/m²</span>}
        </div>
        {deal.area_avg_psqm && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            Area avg: ${Number(deal.area_avg_psqm).toLocaleString()}/m²
          </div>
        )}
        <a href={deal.url} target="_blank" rel="noopener noreferrer"
          style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#22c55e', textDecoration: 'none' }}>
          View listing <ExternalLink size={10} />
        </a>
      </div>
    </div>
  )
}

function AreaChart({ areas }: { areas: any[] }) {
  if (!areas.length) return null
  const max = Math.max(...areas.map((a: any) => Number(a.avg_price_per_sqm) || 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {areas.map((area: any) => {
        const val = Number(area.avg_price_per_sqm) || 0
        const pct = max > 0 ? (val / max) * 100 : 0
        return (
          <div key={area.area} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', minWidth: 110, textAlign: 'right' }}>{area.area}</span>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct > 75 ? '#f87171' : pct > 40 ? '#fbbf24' : '#4ade80', borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 70 }}>${val.toLocaleString()}/m²</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', minWidth: 30 }}>{area.listing_count}L</span>
          </div>
        )
      })}
    </div>
  )
}

export default function InsightsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'undervalued' | 'fair' | 'overvalued'>('undervalued')
  const [period, setPeriod] = useState('all')

  useEffect(() => {
    fetch(`/api/deals?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [period])

  const deals = (data?.deals || []).filter((d: any) =>
    filter === 'all' ? true : d.valuation === filter
  )

  const pill = (label: string, val: string, current: string, set: (v: any) => void) => (
    <button onClick={() => set(val)} style={{
      padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
      background: current === val ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${current === val ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)'}`,
      color: current === val ? '#4ade80' : 'rgba(255,255,255,0.5)',
      fontFamily: "'DM Sans', sans-serif",
    }}>{label}</button>
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', sans-serif" }}>
      Loading insights...
    </div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 600, color: '#f0ede6', margin: '0 0 4px' }}>
          Market Insights
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          {data?.deals?.length || 0} listings with price/m² data · sorted by value
        </p>
      </div>

      {/* Area price chart */}
      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <BarChart2 size={15} color="#22c55e" />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#f0ede6' }}>Avg price/m² by area</span>
        </div>
        <AreaChart areas={data?.areaAnalytics || []} />
      </div>

      {/* Deals filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tag size={13} color="rgba(255,255,255,0.3)" />
        {pill('Best deals', 'undervalued', filter, setFilter)}
        {pill('Fair price', 'fair', filter, setFilter)}
        {pill('Overvalued', 'overvalued', filter, setFilter)}
        {pill('All', 'all', filter, setFilter)}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {pill('For sale', 'sale', period, setPeriod)}
          {pill('For rent', 'monthly', period, setPeriod)}
          {pill('All', 'all', period, setPeriod)}
        </div>
      </div>

      {/* Deal cards grid */}
      {deals.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40, fontSize: 14 }}>
          No listings match this filter yet — run the scraper to get more data.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {deals.map((deal: any) => <DealCard key={deal.id} deal={deal} />)}
        </div>
      )}
    </div>
  )
}
