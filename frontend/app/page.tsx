'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import FilterBar from '@/components/FilterBar'
import ListingPanel from '@/components/ListingPanel'
import StatsBar from '@/components/StatsBar'
import Header from '@/components/Header'
import AnalyticsLegend from '@/components/AnalyticsLegend'
import InsightsTab from '@/components/InsightsTab'
import { Map, BarChart2 } from 'lucide-react'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

export type Filters = { minPrice: string; maxPrice: string; type: string; area: string }

export default function Home() {
  const [tab, setTab] = useState<'map' | 'insights'>('map')
  const [listings, setListings] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [filters, setFilters] = useState<Filters>({ minPrice: '', maxPrice: '', type: 'all', area: 'all' })
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.minPrice) params.set('min_price', filters.minPrice)
    if (filters.maxPrice) params.set('max_price', filters.maxPrice)
    if (filters.type !== 'all') params.set('type', filters.type)
    if (filters.area !== 'all') params.set('area', filters.area)
    const res = await fetch(`/api/listings?${params}`)
    const data = await res.json()
    setListings(data)
    setCount(data?.features?.length || 0)
    setLoading(false)
  }, [filters])

  useEffect(() => { fetchListings() }, [fetchListings])

  const tabBtn = (id: 'map' | 'insights', label: string, Icon: any) => (
    <button onClick={() => setTab(id)} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
      background: tab === id ? 'rgba(34,197,94,0.15)' : 'transparent',
      border: `1px solid ${tab === id ? 'rgba(34,197,94,0.4)' : 'transparent'}`,
      color: tab === id ? '#4ade80' : 'rgba(255,255,255,0.4)',
      fontFamily: "'DM Sans', sans-serif",
      transition: 'all 0.15s',
    }}>
      <Icon size={13} />
      {label}
    </button>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#111' }}>
      {/* Header with tabs */}
      <div style={{ background: '#0f0f0f', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, background: '#1a7a3c', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🌲</div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: '#f0ede6' }}>
            Lebanon<span style={{ color: '#22c55e' }}>Property</span>
          </span>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          {tabBtn('map', 'Map', Map)}
          {tabBtn('insights', 'Insights', BarChart2)}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', sans-serif" }}>
          {loading ? <span style={{ color: '#22c55e' }}>Loading...</span> : <span><strong style={{ color: '#f0ede6' }}>{count.toLocaleString()}</strong> listings</span>}
        </div>
      </div>

      {/* Map tab content */}
      {tab === 'map' && (
        <>
          <FilterBar filters={filters} onChange={f => { setSelected(null); setFilters(f) }} />
          {selected?.area && <StatsBar area={selected.area} type={filters.type} />}
        </>
      )}

      {/* Content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tab === 'map' ? (
          <>
            <MapView geojson={listings} onSelect={setSelected} selected={selected} />
            <AnalyticsLegend />
            {selected && <ListingPanel listing={selected} onClose={() => setSelected(null)} />}
          </>
        ) : (
          <InsightsTab />
        )}
      </div>
    </div>
  )
}
