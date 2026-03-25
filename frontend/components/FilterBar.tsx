'use client'
import { useEffect, useState } from 'react'
import { Filters } from '@/app/page'

const TYPES = ['all', 'apartment', 'villa', 'land', 'commercial', 'shop']

export default function FilterBar({ filters, onChange }: {
  filters: Filters
  onChange: (f: Filters) => void
}) {
  const [areas, setAreas] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/areas').then(r => r.json()).then(d => setAreas(d.areas || []))
  }, [])

  const set = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value })

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#f0ede6',
    padding: '6px 10px',
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    width: '100%',
  }

  return (
    <div style={{
      background: '#0f0f0f',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '8px 20px',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 40 }}>
        Price
      </label>
      <input
        type="number"
        placeholder="Min $"
        value={filters.minPrice}
        onChange={e => set('minPrice', e.target.value)}
        style={{ ...inputStyle, width: 90 }}
      />
      <input
        type="number"
        placeholder="Max $"
        value={filters.maxPrice}
        onChange={e => set('maxPrice', e.target.value)}
        style={{ ...inputStyle, width: 90 }}
      />

      <select
        value={filters.type}
        onChange={e => set('type', e.target.value)}
        style={{ ...inputStyle, width: 130, cursor: 'pointer' }}
      >
        {TYPES.map(t => (
          <option key={t} value={t} style={{ background: '#1a1a1a' }}>
            {t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>

      <select
        value={filters.area}
        onChange={e => set('area', e.target.value)}
        style={{ ...inputStyle, width: 150, cursor: 'pointer' }}
      >
        <option value="all" style={{ background: '#1a1a1a' }}>All areas</option>
        {areas.map(a => (
          <option key={a} value={a} style={{ background: '#1a1a1a' }}>{a}</option>
        ))}
      </select>

      {(filters.minPrice || filters.maxPrice || filters.type !== 'all' || filters.area !== 'all') && (
        <button
          onClick={() => onChange({ minPrice: '', maxPrice: '', type: 'all', area: 'all' })}
          style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            color: '#f87171',
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
