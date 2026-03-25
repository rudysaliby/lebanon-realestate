'use client'
import { Listing } from '@/lib/supabase'
import { X, ExternalLink, MapPin, Home, Maximize2, DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import AIInsight from './AIInsight'

function fmt(n: number | null) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const SOURCE_LABELS: Record<string, string> = {
  olx: 'OLX Lebanon',
  'realestate.com.lb': 'RealEstate.com.lb',
}

function ValuationBadge({ listing, avgPricePerSqm }: { listing: any; avgPricePerSqm: number | null }) {
  if (!listing.price_per_sqm || !avgPricePerSqm) return null
  const diff = ((listing.price_per_sqm - avgPricePerSqm) / avgPricePerSqm) * 100
  const abs  = Math.abs(diff)
  if (abs < 15) return (
    <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:8, padding:'4px 10px', fontSize:12 }}>
      <Minus size={12} color="#818cf8" /><span style={{ color:'#818cf8' }}>Fairly priced</span>
    </div>
  )
  if (diff > 15) return (
    <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'4px 10px', fontSize:12 }}>
      <TrendingUp size={12} color="#f87171" /><span style={{ color:'#f87171' }}>Overvalued +{abs.toFixed(0)}% vs area avg</span>
    </div>
  )
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, padding:'4px 10px', fontSize:12 }}>
      <TrendingDown size={12} color="#4ade80" /><span style={{ color:'#4ade80' }}>Undervalued -{abs.toFixed(0)}% vs area avg</span>
    </div>
  )
}

export default function ListingPanel({ listing, onClose }: { listing: any; onClose: () => void }) {
  const [areaAvgPsqm, setAreaAvgPsqm] = useState<number | null>(null)

  useEffect(() => {
    if (!listing.area) return
    fetch(`/api/analytics?area=${encodeURIComponent(listing.area)}`)
      .then(r => r.json())
      .then(d => { const s = d.stats?.[0]; if (s?.avg_price_per_sqm) setAreaAvgPsqm(Number(s.avg_price_per_sqm)) })
  }, [listing.area])

  return (
    <div style={{ position:'absolute', top:16, right:16, width:320, background:'#161616', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, boxShadow:'0 16px 48px rgba(0,0,0,0.6)', zIndex:100, overflow:'hidden', fontFamily:"'DM Sans', sans-serif", maxHeight:'calc(100vh - 140px)', overflowY:'auto' }}>
      {listing.image_url && (
        <div style={{ width:'100%', height:160, overflow:'hidden', position:'relative' }}>
          <img src={listing.image_url} alt={listing.title || ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 50%, #161616 100%)' }} />
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:'#22c55e', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{SOURCE_LABELS[listing.source] || listing.source}</div>
          <div style={{ fontSize:14, fontWeight:500, color:'#f0ede6', lineHeight:1.3 }}>{listing.title || 'Untitled listing'}</div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8, color:'rgba(255,255,255,0.5)', width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><X size={14} /></button>
      </div>

      {/* Price */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:22, fontWeight:700, fontFamily:"'Syne', sans-serif", color:'#f0ede6' }}>{fmt(listing.price)}</span>
          {listing.price_period === 'monthly' && <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>/mo</span>}
        </div>
        <ValuationBadge listing={listing} avgPricePerSqm={areaAvgPsqm} />
      </div>

      {/* Details */}
      <div style={{ padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {listing.area && <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', gap:3 }}><MapPin size={12} color="#22c55e" /><span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Area</span><span style={{ fontSize:13, color:'#f0ede6', fontWeight:500 }}>{listing.area}</span></div>}
        {listing.property_type && <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', gap:3 }}><Home size={12} color="#22c55e" /><span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Type</span><span style={{ fontSize:13, color:'#f0ede6', fontWeight:500 }}>{listing.property_type}</span></div>}
        {listing.size_sqm && <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', gap:3 }}><Maximize2 size={12} color="#22c55e" /><span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Size</span><span style={{ fontSize:13, color:'#f0ede6', fontWeight:500 }}>{listing.size_sqm} m²</span></div>}
        {listing.price_per_sqm && <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', gap:3 }}><DollarSign size={12} color="#22c55e" /><span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Per m²</span><span style={{ fontSize:13, color:'#f0ede6', fontWeight:500 }}>${Number(listing.price_per_sqm).toLocaleString()}</span></div>}
      </div>

      {/* Area bar */}
      {areaAvgPsqm && listing.price_per_sqm && (
        <div style={{ margin:'0 16px 12px', background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 12px' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{listing.area} area avg $/m²</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:2, width:`${Math.min((Number(listing.price_per_sqm)/(areaAvgPsqm*1.5))*100,100)}%`, background: Number(listing.price_per_sqm) > areaAvgPsqm*1.15 ? '#f87171' : Number(listing.price_per_sqm) < areaAvgPsqm*0.85 ? '#4ade80' : '#818cf8' }} />
            </div>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)', whiteSpace:'nowrap' }}>avg ${areaAvgPsqm.toLocaleString()}</span>
          </div>
        </div>
      )}

      {listing.location_raw && listing.location_raw.length < 60 && (
        <div style={{ padding:'0 16px 12px', fontSize:12, color:'rgba(255,255,255,0.35)' }}>📍 {listing.location_raw}</div>
      )}

      {/* AI Insight */}
      <AIInsight listing={listing} />

      {/* CTA */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:'#1a7a3c', color:'#fff', borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:500, textDecoration:'none' }}>
          View original listing <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}
