'use client'
import { useEffect, useState } from 'react'

const TYPES     = ['all','apartment','villa','land','commercial','shop']
const FURNISHED = ['all','furnished','unfurnished','semi-furnished']
const CONDITION = ['all','new','under-construction','renovated','well-maintained']
const BEDS      = ['all','1','2','3','4','5+']

export type Filters = {
  minPrice: string; maxPrice: string; type: string; area: string
  region: string; subregion: string; furnished: string
  condition: string; bedrooms: string; view: string
}

const DEFAULT: Filters = {
  minPrice:'', maxPrice:'', type:'all', area:'all',
  region:'all', subregion:'all', furnished:'all',
  condition:'all', bedrooms:'all', view:'all'
}

export default function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [areas, setAreas] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [subregions, setSubregions] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/areas').then(r => r.json()).then(d => {
      setAreas(d.areas || [])
      setRegions(d.regions || [])
    })
  }, [])

  useEffect(() => {
    if (filters.region !== 'all') {
      fetch(`/api/areas?region=${encodeURIComponent(filters.region)}`)
        .then(r => r.json()).then(d => setSubregions(d.subregions || []))
    } else {
      setSubregions([])
    }
  }, [filters.region])

  const set = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value })
  const hasFilters = Object.entries(filters).some(([k,v]) => v !== '' && v !== 'all' && DEFAULT[k as keyof Filters] !== v)

  const inp: React.CSSProperties = {
    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
    borderRadius:8, color:'#f0ede6', padding:'5px 10px', fontSize:12,
    fontFamily:"'DM Sans', sans-serif", outline:'none',
  }

  const sel = (key: keyof Filters, options: string[], label: string, width=120) => (
    <select value={filters[key]} onChange={e => set(key, e.target.value)}
      style={{ ...inp, width, cursor:'pointer' }}>
      <option value="all" style={{background:'#1a1a1a'}}>{label}</option>
      {options.filter(o => o !== 'all').map(o => (
        <option key={o} value={o} style={{background:'#1a1a1a'}}>
          {o.charAt(0).toUpperCase() + o.slice(1).replace(/-/g,' ')}
        </option>
      ))}
    </select>
  )

  return (
    <div style={{ background:'#0f0f0f', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'8px 20px', display:'flex', flexDirection:'column', gap:6 }}>
      {/* Row 1: Core filters always visible */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <label style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Price</label>
        <input type="number" placeholder="Min $" value={filters.minPrice} onChange={e => set('minPrice', e.target.value)}
          style={{ ...inp, width:80 }} />
        <input type="number" placeholder="Max $" value={filters.maxPrice} onChange={e => set('maxPrice', e.target.value)}
          style={{ ...inp, width:80 }} />
        {sel('type', TYPES, 'All types', 120)}
        {sel('region', regions, 'All regions', 140)}
        {filters.region !== 'all' && subregions.length > 0 &&
          sel('subregion', subregions, 'All subregions', 150)}
        {sel('area', areas, 'All areas', 140)}

        <button onClick={() => setExpanded(!expanded)} style={{
          background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:8, color:'rgba(255,255,255,0.5)', padding:'5px 10px', fontSize:11,
          cursor:'pointer', fontFamily:"'DM Sans', sans-serif",
        }}>
          {expanded ? '▲ Less' : '▼ More filters'}
        </button>

        {hasFilters && (
          <button onClick={() => onChange(DEFAULT)} style={{
            background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:8, color:'#f87171', padding:'5px 10px', fontSize:11,
            cursor:'pointer', fontFamily:"'DM Sans', sans-serif",
          }}>Clear</button>
        )}
      </div>

      {/* Row 2: Extended filters */}
      {expanded && (
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', paddingTop:4, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          {sel('furnished', FURNISHED, 'Furnished?', 140)}
          {sel('condition', CONDITION, 'Condition', 150)}
          {sel('bedrooms', BEDS, 'Bedrooms', 110)}
          <select value={filters.view} onChange={e => set('view', e.target.value)}
            style={{ ...inp, width:130, cursor:'pointer' }}>
            <option value="all" style={{background:'#1a1a1a'}}>Any view</option>
            <option value="sea" style={{background:'#1a1a1a'}}>Sea view</option>
            <option value="mountain" style={{background:'#1a1a1a'}}>Mountain view</option>
            <option value="open" style={{background:'#1a1a1a'}}>Open view</option>
            <option value="city" style={{background:'#1a1a1a'}}>City view</option>
          </select>
        </div>
      )}
    </div>
  )
}
