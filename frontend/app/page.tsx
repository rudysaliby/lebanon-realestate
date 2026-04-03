'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import ModeSelector from '@/components/ModeSelector'
import FilterBar from '@/components/FilterBar'
import AreaPanel from '@/components/AreaPanel'
import InsightsTab from '@/components/InsightsTab'
import AuthModal from '@/components/AuthModal'
import UserMenu from '@/components/UserMenu'
import IqariLogo from '@/components/IqariLogo'
import ThemeToggle from '@/components/ThemeToggle'
import { ThemeProvider, useTheme, T } from '@/components/ThemeContext'
import { BarChart2, Map } from 'lucide-react'
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
  furnished: 'all', condition: 'all', region: 'all',
}

function AppContent() {
  const { theme } = useTheme()
  const t = T[theme]
  const { user } = useUser()
  const [mode, setMode] = useState<Mode | null>(null)
  const [tab, setTab] = useState<'map' | 'insights'>('map')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [geojson, setGeojson] = useState<any>(null)
  const [areaData, setAreaData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(0)
  const [showAuth, setShowAuth] = useState(false)

  const fetchListings = useCallback(async () => {
    if (!mode) return
    setLoading(true)
    const p = new URLSearchParams()
    p.set('period', mode.period)
    p.set('type_group', mode.type)
    if (filters.minPrice)           p.set('min_price', filters.minPrice)
    if (filters.maxPrice)           p.set('max_price', filters.maxPrice)
    if (filters.bedrooms !== 'all') p.set('bedrooms', filters.bedrooms)
    if (filters.furnished !== 'all') p.set('furnished', filters.furnished)
    if (filters.condition !== 'all') p.set('condition', filters.condition)
    if (filters.region !== 'all')   p.set('region', filters.region)
    try {
      const res = await fetch(`/api/listings?${p}`)
      const data = await res.json()
      setGeojson(data)
      setCount(data?.features?.length || 0)
    } catch (e) {}
    setLoading(false)
  }, [mode, filters])

  useEffect(() => { fetchListings() }, [fetchListings])

  if (!mode) return <ModeSelector onSelect={setMode} />

  const modeLabel = `${mode.period === 'sale' ? 'For Sale' : 'For Rent'} · ${
    mode.type === 'residential' ? 'Residential' :
    mode.type === 'land' ? 'Land' : 'Commercial'
  }`

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: "'DM Sans', sans-serif", transition: 'background 0.3s' }}>

      {/* Header */}
      <header style={{
        background: t.bgPanel,
        borderBottom: `1px solid ${t.border}`,
        padding: '0 20px',
        height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 20, flexShrink: 0,
        boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
        transition: 'background 0.3s, border-color 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ cursor: 'pointer' }} onClick={() => setMode(null)}>
            <IqariLogo size="sm" />
          </div>

          <div style={{ width: 1, height: 18, background: t.border }} />

          {/* Mode badge */}
          <button onClick={() => setMode(null)} style={{
            background: t.accentBg,
            border: `1px solid ${t.accentBorder}`,
            borderRadius: 6, padding: '3px 10px',
            fontSize: 11, fontWeight: 600, color: t.accent,
            cursor: 'pointer', letterSpacing: '0.02em', textTransform: 'uppercase',
          }}>
            {modeLabel} ↗
          </button>

          <div style={{ width: 1, height: 18, background: t.border }} />

          {/* Tabs */}
          {(['map', 'insights'] as const).map(tb => (
            <button key={tb} onClick={() => setTab(tb)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 6, fontSize: 12,
              cursor: 'pointer', fontWeight: tab === tb ? 600 : 400,
              background: tab === tb ? t.accentBg : 'transparent',
              border: `1px solid ${tab === tb ? t.accentBorder : 'transparent'}`,
              color: tab === tb ? t.accent : t.textMuted,
              transition: 'all 0.15s',
            }}>
              {tb === 'map' ? <Map size={12} /> : <BarChart2 size={12} />}
              {tb.charAt(0).toUpperCase() + tb.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: t.textMuted }}>
            {loading
              ? <span style={{ color: t.accent }}>Loading...</span>
              : <><strong style={{ color: t.textSub }}>{count.toLocaleString()}</strong> listings</>
            }
          </span>

          <ThemeToggle />

          {user ? (
            <UserMenu user={user} />
          ) : (
            <button onClick={() => setShowAuth(true)} style={{
              background: '#16a34a', border: 'none', borderRadius: 7,
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Filter bar */}
      {tab === 'map' && (
        <FilterBar
          filters={filters}
          mode={mode}
          onChange={f => { setAreaData(null); setFilters(f) }}
        />
      )}

      {/* Main */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tab === 'map' ? (
          <>
            <MapView geojson={geojson} mode={mode} onAreaClick={setAreaData} />

            {areaData && (
              <AreaPanel
                areaData={areaData}
                mode={mode}
                onClose={() => setAreaData(null)}
                user={user}
                onSignIn={() => setShowAuth(true)}
              />
            )}

            {/* Legend */}
            <div style={{
              position: 'absolute', bottom: 28, left: 16,
              background: theme === 'dark' ? 'rgba(15,15,15,0.92)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${t.border}`,
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', flexDirection: 'column', gap: 6,
              boxShadow: t.shadow,
            }}>
              <span style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Price/sqm</span>
              {[
                { color: '#4ade80', label: 'Below market' },
                { color: '#facc15', label: 'Fair market' },
                { color: '#f87171', label: 'Above market' },
                { color: '#9ca3af', label: 'No data' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 11, color: t.textSub }}>{label}</span>
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

export default function Home() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
