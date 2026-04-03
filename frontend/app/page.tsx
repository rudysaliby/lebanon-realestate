'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import ModeSelector from '@/components/ModeSelector'
import FilterBar from '@/components/FilterBar'
import AreaPanel from '@/components/AreaPanel'
import InsightsTab from '@/components/InsightsTab'
import AuthModal from '@/components/AuthModal'
import UserMenu from '@/components/UserMenu'
import { BarChart2, Map, LogIn } from 'lucide-react'
import { useUser } from '@/lib/useUser'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

export type Mode = {
  period: 'sale' | 'monthly'
  type: 'residential' | 'land' | 'commercial'
}

export type Filters = {
  minPrice: string
  maxPrice: string
  bedrooms: string
  furnished: string
  condition: string
  region: string
}

const DEFAULT_FILTERS: Filters = {
  minPrice: '', maxPrice: '', bedrooms: 'all',
  furnished: 'all', condition: 'all', region: 'all'
}

export default function Home() {
  const { user, loading: authLoading } = useUser()
  const [mode, setMode] = useState<Mode | null>(null)
  const [tab, setTab] = useState<'map' | 'insights'>('map')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [geojson, setGeojson] = useState<any>(null)
  const [areaData, setAreaData] = useState<any>(null) // clicked area
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(0)
  const [showAuth, setShowAuth] = useState(false)

  const fetchListings = useCallback(async () => {
    if (!mode) return
    setLoading(true)
    const p = new URLSearchParams()
    p.set('period', mode.period)
    p.set('type_group', mode.type)
    if (filters.minPrice) p.set('min_price', filters.minPrice)
    if (filters.maxPrice) p.set('max_price', filters.maxPrice)
    if (filters.bedrooms !== 'all') p.set('bedrooms', filters.bedrooms)
    if (filters.furnished !== 'all') p.set('furnished', filters.furnished)
    if (filters.condition !== 'all') p.set('condition', filters.condition)
    if (filters.region !== 'all') p.set('region', filters.region)
    const res = await fetch(`/api/listings?${p}`)
    const data = await res.json()
    setGeojson(data)
    setCount(data?.features?.length || 0)
    setLoading(false)
  }, [mode, filters])

  useEffect(() => { fetchListings() }, [fetchListings])

  if (!mode) return <ModeSelector onSelect={setMode} />

  const modeLabel = `${mode.period === 'sale' ? 'For Sale' : 'For Rent'} · ${
    mode.type === 'residential' ? 'Residential' :
    mode.type === 'land' ? 'Land' : 'Commercial'
  }`

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <header style={{
        background: '#0f0f0f',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 20px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setMode(null)}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect width="22" height="22" rx="5" fill="#1a6b3a"/>
              <path d="M11 3L4 9v10h4v-5h6v5h4V9L11 3z" fill="white" opacity="0.9"/>
              <circle cx="11" cy="11" r="2" fill="#4ade80"/>
            </svg>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: '-0.03em', color: '#f0ede6' }}>
              Prop<span style={{ color: '#4ade80' }}>IQ</span>
            </span>
          </div>

          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />

          {/* Mode badge */}
          <button
            onClick={() => setMode(null)}
            style={{
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.25)',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#4ade80',
              cursor: 'pointer',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}>
            {modeLabel} ↗
          </button>

          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />

          {/* Tabs */}
          {(['map', 'insights'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 6, fontSize: 12,
              cursor: 'pointer', fontWeight: tab === t ? 600 : 400,
              background: tab === t ? 'rgba(74,222,128,0.12)' : 'transparent',
              border: `1px solid ${tab === t ? 'rgba(74,222,128,0.3)' : 'transparent'}`,
              color: tab === t ? '#4ade80' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s',
            }}>
              {t === 'map' ? <Map size={12} /> : <BarChart2 size={12} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            {loading ? <span style={{ color: '#4ade80' }}>Loading...</span> :
              <><strong style={{ color: 'rgba(255,255,255,0.7)' }}>{count.toLocaleString()}</strong> listings</>}
          </span>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <button onClick={() => setShowAuth(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#1a6b3a', border: 'none', borderRadius: 7,
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              color: '#fff', cursor: 'pointer',
            }}>
              <LogIn size={12} /> Sign In
            </button>
          )}
        </div>
      </header>

      {/* Filter bar */}
      {tab === 'map' && (
        <FilterBar filters={filters} mode={mode} onChange={f => { setAreaData(null); setFilters(f) }} />
      )}

      {/* Main content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tab === 'map' ? (
          <>
            <MapView
              geojson={geojson}
              mode={mode}
              onAreaClick={setAreaData}
            />
            {/* Area panel */}
            {areaData && (
              <AreaPanel
                areaData={areaData}
                mode={mode}
                onClose={() => setAreaData(null)}
                user={user}
                onSignIn={() => setShowAuth(true)}
              />
            )}
            {/* Map legend */}
            <div style={{
              position: 'absolute', bottom: 28, left: 16,
              background: 'rgba(15,15,15,0.92)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Price/sqm</span>
              {[
                { color: '#4ade80', label: 'Below market' },
                { color: '#facc15', label: 'Fair market' },
                { color: '#f87171', label: 'Above market' },
                { color: '#6b7280', label: 'No data' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <InsightsTab mode={mode} user={user} onSignIn={() => setShowAuth(true)} />
        )}
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
