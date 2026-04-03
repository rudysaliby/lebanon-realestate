'use client'
import { useTheme, T } from '@/components/ThemeContext'
import type { Filters, Mode } from '@/app/page'

export default function FilterBar({ filters, mode, onChange }: {
  filters: Filters, mode: Mode, onChange: (f: Filters) => void
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const set = (k: keyof Filters) => (v: string) => onChange({ ...filters, [k]: v })
  const isResidential = mode.type === 'residential'

  const selStyle = {
    background: t.bgCard,
    border: `1px solid ${t.border}`,
    borderRadius: 6, color: t.text, fontSize: 12,
    padding: '4px 8px', cursor: 'pointer', outline: 'none',
  }

  const inpStyle = {
    background: t.bgCard,
    border: `1px solid ${t.border}`,
    borderRadius: 6, color: t.text, fontSize: 12,
    padding: '4px 8px', width: 90, outline: 'none',
  }

  const label = (text: string) => (
    <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' as const }}>{text}</span>
  )

  const regions = [
    { v: 'all', l: 'All Regions' }, { v: 'Beirut', l: 'Beirut' },
    { v: 'Mount Lebanon', l: 'Mount Lebanon' }, { v: 'North Lebanon', l: 'North' },
    { v: 'South Lebanon', l: 'South' }, { v: 'Bekaa', l: 'Bekaa' }, { v: 'Nabatieh', l: 'Nabatieh' },
  ]

  return (
    <div style={{
      background: t.bgPanel,
      borderBottom: `1px solid ${t.border}`,
      padding: '7px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      overflowX: 'auto', flexShrink: 0,
      transition: 'background 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label('Region')}
        <select value={filters.region} onChange={e => set('region')(e.target.value)} style={selStyle}>
          {regions.map(r => <option key={r.v} value={r.v} style={{ background: t.bgPanel }}>{r.l}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label('Min $')}
        <input value={filters.minPrice} onChange={e => set('minPrice')(e.target.value)} placeholder="0" style={inpStyle} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label('Max $')}
        <input value={filters.maxPrice} onChange={e => set('maxPrice')(e.target.value)} placeholder="∞" style={inpStyle} />
      </div>

      {isResidential && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {label('Beds')}
          <select value={filters.bedrooms} onChange={e => set('bedrooms')(e.target.value)} style={selStyle}>
            {[{v:'all',l:'Any'},{v:'1',l:'1+'},{v:'2',l:'2+'},{v:'3',l:'3+'},{v:'4',l:'4+'},{v:'5',l:'5+'}].map(o => (
              <option key={o.v} value={o.v} style={{ background: t.bgPanel }}>{o.l}</option>
            ))}
          </select>
        </div>
      )}

      {isResidential && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {label('Furnished')}
          <select value={filters.furnished} onChange={e => set('furnished')(e.target.value)} style={selStyle}>
            {[{v:'all',l:'Any'},{v:'furnished',l:'Furnished'},{v:'semi-furnished',l:'Semi'},{v:'unfurnished',l:'Unfurnished'}].map(o => (
              <option key={o.v} value={o.v} style={{ background: t.bgPanel }}>{o.l}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label('Condition')}
        <select value={filters.condition} onChange={e => set('condition')(e.target.value)} style={selStyle}>
          {[
            {v:'all',l:'Any'},{v:'new',l:'New'},{v:'well-maintained',l:'Well Maintained'},
            {v:'renovated',l:'Renovated'},{v:'under-construction',l:'Off Plan'},
          ].map(o => (
            <option key={o.v} value={o.v} style={{ background: t.bgPanel }}>{o.l}</option>
          ))}
        </select>
      </div>

      <button
        onClick={() => onChange({ minPrice:'',maxPrice:'',bedrooms:'all',furnished:'all',condition:'all',region:'all' })}
        style={{
          marginLeft: 'auto', background: 'none',
          border: `1px solid ${t.border}`,
          borderRadius: 6, color: t.textMuted, fontSize: 11,
          padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        Reset
      </button>
    </div>
  )
}
