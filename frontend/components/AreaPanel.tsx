'use client'
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink, Lock } from 'lucide-react'
import { useTheme, T } from '@/components/ThemeContext'
import type { Mode } from '@/app/page'

function DealBadge({ listing, medianPpsqm }: { listing: any, medianPpsqm: number | null }) {
  if (!listing.price || !listing.size_sqm || !medianPpsqm) return null
  const ppsqm = listing.price / listing.size_sqm
  const diff = ((ppsqm - medianPpsqm) / medianPpsqm) * 100
  if (Math.abs(diff) < 5) return (
    <span style={{ background:'rgba(148,163,184,0.2)', color:'#94a3b8', borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700 }}>FAIR</span>
  )
  const below = diff < 0
  return (
    <span style={{
      background: below ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)',
      color: below ? '#4ade80' : '#f87171',
      borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700,
    }}>
      {below ? '▼' : '▲'} {Math.abs(Math.round(diff))}% {below ? 'BELOW' : 'ABOVE'}
    </span>
  )
}

export default function AreaPanel({ areaData, mode, onClose, user, onSignIn }: {
  areaData: any, mode: Mode, onClose: () => void, user: any, onSignIn: () => void
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const [idx, setIdx] = useState(0)
  const listings = areaData?.listings || []
  const total = areaData?.total_listings || listings.length
  const current = listings[idx]
  const isLocked = !user && idx >= 3

  const fmt  = (n: any) => n ? `$${Number(n).toLocaleString()}` : 'N/A'

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 360,
      background: theme === 'dark' ? 'rgba(10,10,10,0.97)' : 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(20px)',
      borderLeft: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column', zIndex: 10,
      animation: 'slideIn 0.2s ease',
      boxShadow: t.shadow,
    }}>
      <style>{`@keyframes slideIn { from { transform:translateX(20px);opacity:0 } to { transform:translateX(0);opacity:1 } }`}</style>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:t.text, margin:0 }}>{areaData.area}</h2>
            <span style={{ fontSize:12, color:t.textMuted }}>{areaData.region}</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:t.textMuted, padding:4 }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[
            { label:'Listings', value: total.toLocaleString() },
            { label:'Median Price', value: fmt(areaData.median_price) },
            { label:'$/m²', value: areaData.median_ppsqm ? `$${Number(areaData.median_ppsqm).toLocaleString()}` : 'N/A' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: t.bgCard, borderRadius:8, padding:'8px 10px', textAlign:'center',
              border: `1px solid ${t.border}`,
            }}>
              <div style={{ fontSize:13, fontWeight:700, color:t.text }}>{value}</div>
              <div style={{ fontSize:10, color:t.textMuted, marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Carousel nav */}
      <div style={{ padding:'12px 20px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:12, color:t.textMuted }}>
          <strong style={{color:t.text}}>{idx+1}</strong> / <strong style={{color:t.text}}>{listings.length}</strong>
          {total > listings.length && <span style={{color:t.textMuted}}> (top {listings.length})</span>}
        </span>
        <div style={{ display:'flex', gap:5 }}>
          {[
            { action: () => setIdx(i => Math.max(0, i-1)), icon: <ChevronLeft size={14}/>, disabled: idx===0 },
            { action: () => setIdx(i => Math.min(listings.length-1, i+1)), icon: <ChevronRight size={14}/>, disabled: idx>=listings.length-1 },
          ].map((btn, i) => (
            <button key={i} onClick={btn.action} disabled={btn.disabled} style={{
              background: t.bgCard, border:`1px solid ${t.border}`, borderRadius:6,
              width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
              cursor: btn.disabled ? 'default' : 'pointer',
              color: btn.disabled ? t.textMuted : t.textSub,
            }}>{btn.icon}</button>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div style={{ padding:'0 20px 10px', display:'flex', gap:3, flexWrap:'wrap' }}>
        {listings.slice(0,20).map((_:any, i:number) => (
          <button key={i} onClick={() => setIdx(i)} style={{
            width: i===idx ? 18 : 6, height:6, borderRadius:3, border:'none',
            background: i===idx ? t.accent : t.border,
            cursor:'pointer', padding:0, transition:'all 0.2s',
          }}/>
        ))}
      </div>

      {/* Card */}
      <div style={{ flex:1, padding:'0 20px 20px', overflowY:'auto' }}>
        {current && (
          <div style={{
            background: t.bgCard, border:`1px solid ${t.border}`,
            borderRadius:12, overflow:'hidden',
          }}>
            {/* Image */}
            <div style={{ height:155, background:t.bgCard, position:'relative', overflow:'hidden' }}>
              {current.image_url ? (
                <img src={current.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              ) : (
                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, opacity:0.15 }}>
                  {current.property_type==='land'?'🌿':current.property_type==='commercial'?'🏢':'🏠'}
                </div>
              )}
              <div style={{ position:'absolute', top:8, left:8 }}>
                <DealBadge listing={current} medianPpsqm={areaData.median_ppsqm}/>
              </div>
              <div style={{ position:'absolute', top:8, right:8 }}>
                <span style={{ background:'rgba(0,0,0,0.65)', color:'rgba(255,255,255,0.85)', borderRadius:4, padding:'2px 7px', fontSize:10 }}>
                  {current.property_type || 'Property'}
                </span>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding:'14px 16px' }}>
              {isLocked ? (
                <div style={{ textAlign:'center', padding:'10px 0' }}>
                  <Lock size={16} color={t.textMuted} style={{ marginBottom:8 }}/>
                  <p style={{ fontSize:12, color:t.textMuted, marginBottom:12 }}>Sign in to see price & details</p>
                  <button onClick={onSignIn} style={{
                    background:'#16a34a', border:'none', borderRadius:7,
                    padding:'7px 18px', fontSize:12, fontWeight:600, color:'#fff', cursor:'pointer',
                  }}>Sign in free</button>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                    <span style={{ fontFamily:"'Syne',sans-serif", fontSize:19, fontWeight:700, color:t.text }}>
                      {current.price ? `$${Number(current.price).toLocaleString()}` : 'N/A'}
                    </span>
                    {current.price && current.size_sqm && (
                      <span style={{ fontSize:11, color:t.textMuted }}>
                        ${Math.round(current.price/current.size_sqm).toLocaleString()}/m²
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:12, color:t.textSub, marginBottom:8, lineHeight:1.4 }}>
                    {current.title?.substring(0,70)}{current.title?.length>70?'…':''}
                  </div>
                  <div style={{ display:'flex', gap:10, fontSize:11, color:t.textMuted, marginBottom:12, flexWrap:'wrap' }}>
                    {current.size_sqm && <span>📐 {current.size_sqm}m²</span>}
                    {current.bedrooms && <span>🛏 {current.bedrooms}</span>}
                    {current.bathrooms && <span>🚿 {current.bathrooms}</span>}
                    {current.condition && <span>✓ {current.condition}</span>}
                    {current.furnished && current.furnished!=='unfurnished' && <span>🛋 {current.furnished}</span>}
                  </div>
                  <a href={current.url} target="_blank" rel="noopener noreferrer" style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    background: t.accentBg, border:`1px solid ${t.accentBorder}`,
                    borderRadius:7, padding:'8px', fontSize:12, color:t.accent,
                    textDecoration:'none', fontWeight:600,
                  }}>
                    View Listing <ExternalLink size={11}/>
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
