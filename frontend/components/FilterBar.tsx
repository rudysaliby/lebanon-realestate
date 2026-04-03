'use client'
import type { Filters, Mode } from '@/app/page'

const sel = (label: string, value: string, opts: {v:string,l:string}[], onChange: (v:string)=>void) => (
  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
    <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', whiteSpace:'nowrap' }}>{label}</span>
    <select value={value} onChange={e=>onChange(e.target.value)} style={{
      background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:6, color:'rgba(255,255,255,0.8)', fontSize:12, padding:'4px 8px',
      cursor:'pointer', outline:'none',
    }}>
      {opts.map(o=><option key={o.v} value={o.v} style={{background:'#1a1a1a'}}>{o.l}</option>)}
    </select>
  </div>
)

const inp = (label:string, value:string, placeholder:string, onChange:(v:string)=>void) => (
  <div style={{display:'flex',alignItems:'center',gap:6}}>
    <span style={{fontSize:11,color:'rgba(255,255,255,0.3)',whiteSpace:'nowrap'}}>{label}</span>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{
      background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:6,color:'rgba(255,255,255,0.8)',fontSize:12,padding:'4px 8px',
      width:90,outline:'none',
    }} />
  </div>
)

export default function FilterBar({ filters, mode, onChange }: {
  filters: Filters
  mode: Mode
  onChange: (f: Filters) => void
}) {
  const set = (k: keyof Filters) => (v: string) => onChange({ ...filters, [k]: v })
  const isResidential = mode.type === 'residential'
  const isRent = mode.period === 'monthly'

  const regions = [
    {v:'all',l:'All Regions'},{v:'Beirut',l:'Beirut'},{v:'Mount Lebanon',l:'Mount Lebanon'},
    {v:'North Lebanon',l:'North Lebanon'},{v:'South Lebanon',l:'South Lebanon'},
    {v:'Bekaa',l:'Bekaa'},{v:'Nabatieh',l:'Nabatieh'},
  ]

  return (
    <div style={{
      background:'#0f0f0f', borderBottom:'1px solid rgba(255,255,255,0.06)',
      padding:'8px 20px', display:'flex', alignItems:'center', gap:16,
      overflowX:'auto', flexShrink:0,
    }}>
      {sel('Region', filters.region, regions, set('region'))}
      {inp('Min $', filters.minPrice, '0', set('minPrice'))}
      {inp('Max $', filters.maxPrice, '∞', set('maxPrice'))}
      {isResidential && sel('Beds', filters.bedrooms, [
        {v:'all',l:'Any'},{v:'1',l:'1+'},{v:'2',l:'2+'},{v:'3',l:'3+'},{v:'4',l:'4+'},{v:'5',l:'5+'},
      ], set('bedrooms'))}
      {isResidential && sel('Furnished', filters.furnished, [
        {v:'all',l:'Any'},{v:'furnished',l:'Furnished'},{v:'semi-furnished',l:'Semi'},{v:'unfurnished',l:'Unfurnished'},
      ], set('furnished'))}
      {sel('Condition', filters.condition, [
        {v:'all',l:'Any'},{v:'new',l:'New'},{v:'well-maintained',l:'Well Maintained'},
        {v:'renovated',l:'Renovated'},{v:'under-construction',l:'Off Plan'},
      ], set('condition'))}

      {/* Reset */}
      <button onClick={() => onChange({ minPrice:'',maxPrice:'',bedrooms:'all',furnished:'all',condition:'all',region:'all' })}
        style={{
          marginLeft:'auto', background:'none', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:6, color:'rgba(255,255,255,0.35)', fontSize:11, padding:'4px 10px',
          cursor:'pointer', whiteSpace:'nowrap',
        }}>
        Reset
      </button>
    </div>
  )
}
