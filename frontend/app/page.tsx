'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import FilterBar from '@/components/FilterBar'
import ListingPanel from '@/components/ListingPanel'
import StatsBar from '@/components/StatsBar'
import Header from '@/components/Header'
import AnalyticsLegend from '@/components/AnalyticsLegend'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

export type Filters = {
  minPrice: string; maxPrice: string; type: string; area: string
}

export default function Home() {
  const [listings, setListings] = useState<any>(null)
  const [selected, setSelected] = useState<any | null>(null)
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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#111' }}>
      <Header count={count} loading={loading} />
      <FilterBar filters={filters} onChange={setFilters} />
      {selected?.area && <StatsBar area={selected.area} type={filters.type} />}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView geojson={listings} onSelect={setSelected} selected={selected} />
        <AnalyticsLegend />
        {selected && <ListingPanel listing={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
