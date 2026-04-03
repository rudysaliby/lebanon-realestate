'use client'
import { useEffect, useState, useRef } from 'react'
import { useTheme, T } from '@/components/ThemeContext'
import type { Filters, Mode } from '@/app/page'

function PriceSlider({ min, max, valueMin, valueMax, onChange, t, theme }: {
  min: number, max: number, valueMin: number, valueMax: number,
  onChange: (min: number, max: number) => void, t: any, theme: string
}) {
  const fmt = (n: number) => {
    if (n >= 1000000) return `$${(n/1000000).toFixed(1)}M`
    if (n >= 1000)    return `$${Math.round(n/1000)}k`
    return `$${n}`
  }

  const handleMin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), valueMax - 10000)
    onChange(v, valueMax)
  }
  const handleMax = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), valueMin + 10000)
    onChange(valueMin, v)
  }

  const pctMin = ((valueMin - min) / (max - min)) * 100
  const pctMax = ((valueMax - min) / (max - min)) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>Price</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: t.text }}>
          {fmt(valueMin)} — {fmt(valueMax)}
        </span>
      </div>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        {/* Track */}
        <div style={{
          position: 'absolute', height: 4, left: 0, right: 0,
          background: t.border, borderRadius: 2,
        }} />
        {/* Active track */}
        <div style={{
          position: 'absolute', height: 4, borderRadius: 2,
          background: t.accent,
          left: `${pctMin}%`,
          width: `${pctMax - pctMin}%`,
        }} />
        {/* Min thumb */}
        <input type="range" min={min} max={max} step={10000} value={valueMin} onChange={handleMin}
          style={{
            position: 'absolute', width: '100%', appearance: 'none', background: 'transparent',
            pointerEvents: 'auto', zIndex: 1,
          }}
        />
        {/* Max thumb */}
        <input type="range" min={min} max={max} step={10000} value={valueMax} onChange={handleMax}
          style={{
            position: 'absolute', width: '100%', appearance: 'none', background: 'transparent',
            pointerEvents: 'auto', zIndex: 1,
          }}
        />
      </div>
      <style>{`
        input[type=range] { height: 20px; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb {
          appearance: none; width: 14px; height: 14px; border-radius: 50%;
          background: ${t.accent}; border: 2px solid ${theme === 'dark' ? '#0a0a0a' : '#fff'};
          box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: pointer;
        }
        input[type=range]::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: ${t.accent}; border: 2px solid ${theme === 'dark' ? '#0a0a0a' : '#fff'};
          cursor: pointer; border: none;
        }
      `}</style>
    </div>
  )
}

export default function FilterBar({ filters, mode, onChange }: {
  filters: Filters, mode: Mode, onChange: (f: Filters) => void
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const set = (k: keyof Filters) => (v: string) => onChange({ ...filters, [k]: v })
  const isResidential = mode.type === 'residential'

  const [priceRange, setPriceRange] = useState({ min: 0, max: 5000000, p5: 50000, p95: 2000000 })
  const [sliderMin, setSliderMin] = useState(0)
  const [sliderMax, setSliderMax] = useState(5000000)
  const debounceRef = useRef<any>(null)

  // Fetch realistic price range for current mode
  useEffect(() => {
    fetch(`/api/price-range?period=${mode.period}&type_group=${mode.type}`)
      .then(r => r.json())
      .then(data => {
        setPriceRange(data)
        setSliderMin(data.p5)
        setSliderMax(data.p95)
        onChange({ ...filters, minPrice: '', maxPrice: '' })
      })
      .catch(() => {})
  }, [mode.period, mode.type])

  const handleSliderChange = (min: number, max: number) => {
    setSliderMin(min)
    setSliderMax(max)
    // Debounce filter update
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange({
        ...filters,
        minPrice: min > priceRange.p5  ? String(min) : '',
        maxPrice: max < priceRange.p95 ? String(max) : '',
      })
    }, 400)
  }

  const selStyle: React.CSSProperties = {
    background: t.bgCard, border: `1px solid ${t.border}`,
    borderRadius: 6, color: t.text, fontSize: 12,
    padding: '4px 8px', cursor: 'pointer', outline: 'none',
  }

  const regions = [
    { v: 'all', l: 'All Regions' }, { v: 'Beirut', l: 'Beirut' },
    { v: 'Mount Lebanon', l: 'Mt. Lebanon' }, { v: 'North Lebanon', l: 'North' },
    { v: 'South Lebanon', l: 'South' }, { v: 'Bekaa', l: 'Bekaa' }, { v: 'Nabatieh', l: 'Nabatieh' },
  ]

  return (
    <div style={{
      background: t.bgPanel, borderBottom: `1px solid ${t.border}`,
      padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 16,
      overflowX: 'auto', flexShrink: 0, transition: 'background 0.3s',
    }}>
      {/* Price slider */}
      <PriceSlider
        min={priceRange.min} max={priceRange.max}
        valueMin={sliderMin} valueMax={sliderMax}
        onChange={handleSliderChange}
        t={t} theme={theme}
      />

      <div style={{ width: 1, height: 20, background: t.border, flexShrink: 0 }} />

      {/* Region */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>Region</span>
        <select value={filters.region} onChange={e => set('region')(e.target.value)} style={selStyle}>
          {regions.map(r => <option key={r.v} value={r.v} style={{ background: t.bgPanel }}>{r.l}</option>)}
        </select>
      </div>

      {/* Beds — residential only */}
      {isResidential && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: t.textMuted }}>Beds</span>
          <select value={filters.bedrooms} onChange={e => set('bedrooms')(e.target.value)} style={selStyle}>
            {[{ v: 'all', l: 'Any' }, { v: '1', l: '1+' }, { v: '2', l: '2+' }, { v: '3', l: '3+' }, { v: '4', l: '4+' }, { v: '5', l: '5+' }]
              .map(o => <option key={o.v} value={o.v} style={{ background: t.bgPanel }}>{o.l}</option>)}
          </select>
        </div>
      )}

      {/* Furnished — residential only */}
      {isResidential && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: t.textMuted }}>Furnished</span>
          <select value={filters.furnished} onChange={e => set('furnished')(e.target.value)} style={selStyle}>
            {[{ v: 'all', l: 'Any' }, { v: 'furnished', l: 'Furnished' }, { v: 'semi-furnished', l: 'Semi' }, { v: 'unfurnished', l: 'Unfurnished' }]
              .map(o => <option key={o.v} value={o.v} style={{ background: t.bgPanel }}>{o.l}</option>)}
          </select>
        </div>
      )}

      {/* Condition */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>Condition</span>
        <select value={filters.condition} onChange={e => set('condition')(e.target.value)} style={selStyle}>
          {[{ v: 'all', l: 'Any' }, { v: 'new', l: 'New' }, { v: 'well-maintained', l: 'Good' }, { v: 'renovated', l: 'Renovated' }, { v: 'under-construction', l: 'Off Plan' }]
            .map(o => <option key={o.v} value={o.v} style={{ background: t.bgPanel }}>{o.l}</option>)}
        </select>
      </div>

      {/* Reset */}
      <button
        onClick={() => {
          setSliderMin(priceRange.p5)
          setSliderMax(priceRange.p95)
          onChange({ minPrice: '', maxPrice: '', bedrooms: 'all', furnished: 'all', condition: 'all', region: 'all' })
        }}
        style={{
          marginLeft: 'auto', background: 'none', border: `1px solid ${t.border}`,
          borderRadius: 6, color: t.textMuted, fontSize: 11,
          padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
        Reset
      </button>
    </div>
  )
}
