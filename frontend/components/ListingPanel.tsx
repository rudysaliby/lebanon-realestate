'use client'
import { X, ExternalLink, MapPin, Home, Maximize2, DollarSign, TrendingUp, TrendingDown, Minus, Bed, Bath } from 'lucide-react'
import { useEffect, useState } from 'react'
import AIInsight from './AIInsight'
import TagBadges from './TagBadges'

function fmt(n: number | null) {
  if (!n) return 'N/A'
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(n)
}

const SOURCE_LABELS: Record<string,string> = {
  olx: 'OLX Lebanon',
  'realestate.com.lb': 'RealEstate.com.lb',
}

function ValuationBadge({ listing, avg }: { listing: any; avg: number | null }) {
  if (!listing.price_per_sqm || !avg) return null
  const diff = ((listing.price_per_sqm - avg) / avg) * 100
  const abs  = Math.abs(diff)
  if (abs < 15) return <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:8, padding:'4px 10px', fontSize:12 }}><Minus size={12} color="#818cf8" /><span style={{ color:'#818cf8' }}>Fairly priced</span></div>
  if (diff > 15) return <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'4px 10px', fontSize:12 }}><TrendingUp size={12} color="#f87171" /><span style={{ color:'#f87171' }}>Overvalued +{abs.toFixed(0)}% vs area avg</span></div>
  return <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, padding:'4px 10px', fontSize:12 }}><TrendingDown size={12} color="#4ade80" /><span style={{ color:'#4ade80' }}>Undervalued -{abs.toFixed(0)}% vs area avg</span></div>
}

const detailBox: React.CSSProperties = { background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px', display:'flex', flexDirection:'column', gap:3 }
const detailLabel: React.CSSProperties = { fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.05em' }
const detailValue: React.CSSProperties = { fontSize:13, color:'#f0ede6', fontWeight:500 }

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

      {/* Image */}
      {listing.image_url && (
        <div style={{ width:'100%', height:160, overflow:'hidden', position:'relative' }}>
          <img src={listing.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 50%, #161616 100%)' }} />
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:'#22c55e', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{SOURCE_LABELS[listing.source] || listing.source}</div>
          <div style={{ fontSize:14, fontWeight:500, color:'#f0ede6', lineHeight:1.3 }}>{listing.title || 'Untitled listing'}</div>
          {(listing.region || listing.subregion) && (
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:4 }}>
              {[listing.region, listing.subregion, listing.area].filter(Boolean).join(' › ')}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8, color:'rgba(255,255,255,0.5)', width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><X size={14} /></button>
      </div>

      {/* Price */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:22, fontWeight:700, fontFamily:"'Syne', sans-serif", color:'#f0ede6' }}>{fmt(listing.price)}</span>
          {listing.price_period === 'monthly' && <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>/mo</span>}
        </div>
        <ValuationBadge listing={listing} avg={areaAvgPsqm} />
      </div>

      {/* Details grid */}
      <div style={{ padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {listing.area && <div style={detailBox}><MapPin size={12} color="#22c55e" /><span style={detailLabel}>Area</span><span style={detailValue}>{listing.area}</span></div>}
        {listing.property_type && <div style={detailBox}><Home size={12} color="#22c55e" /><span style={detailLabel}>Type</span><span style={detailValue}>{listing.property_type}</span></div>}
        {listing.size_sqm && <div style={detailBox}><Maximize2 size={12} color="#22c55e" /><span style={detailLabel}>Size</span><span style={detailValue}>{listing.size_sqm} m²</span></div>}
        {listing.price_per_sqm && <div style={detailBox}><DollarSign size={12} color="#22c55e" /><span style={detailLabel}>Per m²</span><span style={detailValue}>${Number(listing.price_per_sqm).toLocaleString()}</span></div>}
        {listing.bedrooms && <div style={detailBox}><Bed size={12} color="#22c55e" /><span style={detailLabel}>Bedrooms</span><span style={detailValue}>{listing.bedrooms}</span></div>}
        {listing.bathrooms && <div style={detailBox}><Bath size={12} color="#22c55e" /><span style={detailLabel}>Bathrooms</span><span style={detailValue}>{listing.bathrooms}</span></div>}
      </div>

      {/* Area bar */}
      {areaAvgPsqm && listing.price_per_sqm && (
        <div style={{ margin:'0 16px 12px', background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 12px' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{listing.area} avg $/m²</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:2, width:`${Math.min((Number(listing.price_per_sqm)/(areaAvgPsqm*1.5))*100,100)}%`, background: Number(listing.price_per_sqm) > areaAvgPsqm*1.15 ? '#f87171' : Number(listing.price_per_sqm) < areaAvgPsqm*0.85 ? '#4ade80' : '#818cf8' }} />
            </div>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)', whiteSpace:'nowrap' }}>avg ${areaAvgPsqm.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Tag badges */}
      <TagBadges listing={listing} />

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
