'use client'
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink, Lock } from 'lucide-react'
import type { Mode } from '@/app/page'

function DealBadge({ listing, medianPpsqm }: { listing: any, medianPpsqm: number | null }) {
  if (!listing.price || !listing.size_sqm || !medianPpsqm || medianPpsqm <= 0) return null
  const ppsqm = listing.price / listing.size_sqm
  const diff = ((ppsqm - medianPpsqm) / medianPpsqm) * 100
  if (Math.abs(diff) < 5) return (
    <span style={{ background:'rgba(148,163,184,0.15)', color:'#94a3b8', borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:600 }}>
      FAIR MARKET
    </span>
  )
  const isBelow = diff < 0
  return (
    <span style={{
      background: isBelow ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
      color: isBelow ? '#4ade80' : '#f87171',
      borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:600,
    }}>
      {isBelow ? '▼' : '▲'} {Math.abs(Math.round(diff))}% {isBelow ? 'BELOW' : 'ABOVE'} MARKET
    </span>
  )
}

function ListingCard({ listing, medianPpsqm, isLocked, onSignIn }: {
  listing: any, medianPpsqm: number | null, isLocked: boolean, onSignIn: () => void
}) {
  const price = listing.price ? `$${Number(listing.price).toLocaleString()}` : 'N/A'
  const ppsqm = listing.price && listing.size_sqm
    ? `$${Math.round(listing.price / listing.size_sqm).toLocaleString()}/m²`
    : null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, overflow: 'hidden', flexShrink: 0,
      width: '100%',
    }}>
      {/* Image */}
      <div style={{ height: 160, background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
        {listing.image_url ? (
          <img src={listing.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, opacity:0.2 }}>
            {listing.property_type === 'land' ? '🌿' : listing.property_type === 'commercial' ? '🏢' : '🏠'}
          </div>
        )}
        {/* Deal badge */}
        <div style={{ position:'absolute', top:8, left:8 }}>
          <DealBadge listing={listing} medianPpsqm={medianPpsqm} />
        </div>
        {/* Type badge */}
        <div style={{ position:'absolute', top:8, right:8 }}>
          <span style={{ background:'rgba(0,0,0,0.7)', color:'rgba(255,255,255,0.7)', borderRadius:4, padding:'2px 7px', fontSize:10 }}>
            {listing.property_type || 'Property'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px' }}>
        {isLocked ? (
          <div style={{ textAlign:'center', padding:'8px 0' }}>
            <Lock size={18} color="rgba(255,255,255,0.3)" style={{ marginBottom:6 }} />
            <p style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:10 }}>Sign in to see price & details</p>
            <button onClick={onSignIn} style={{
              background:'#1a6b3a', border:'none', borderRadius:7,
              padding:'7px 16px', fontSize:12, fontWeight:600, color:'#fff', cursor:'pointer',
            }}>Sign in free</button>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <span style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#f0ede6' }}>{price}</span>
              {ppsqm && <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{ppsqm}</span>}
            </div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginBottom:6, lineHeight:1.4 }}>
              {listing.title?.substring(0, 70)}{listing.title?.length > 70 ? '…' : ''}
            </div>
            <div style={{ display:'flex', gap:12, fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:12, flexWrap:'wrap' }}>
              {listing.size_sqm && <span>📐 {listing.size_sqm}m²</span>}
              {listing.bedrooms && <span>🛏 {listing.bedrooms} bed</span>}
              {listing.bathrooms && <span>🚿 {listing.bathrooms} bath</span>}
              {listing.condition && <span>✓ {listing.condition}</span>}
              {listing.furnished && listing.furnished !== 'unfurnished' && <span>🛋 {listing.furnished}</span>}
            </div>
            <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:5,
              background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)',
              borderRadius:7, padding:'8px', fontSize:12, color:'#4ade80',
              textDecoration:'none', fontWeight:600,
            }}>
              View Listing <ExternalLink size={11} />
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default function AreaPanel({ areaData, mode, onClose, user, onSignIn }: {
  areaData: any, mode: Mode, onClose: () => void,
  user: any, onSignIn: () => void
}) {
  const [idx, setIdx] = useState(0)
  const listings = areaData?.listings || []
  const total = areaData?.total_listings || listings.length
  const current = listings[idx]

  const prev = () => setIdx(i => Math.max(0, i-1))
  const next = () => setIdx(i => Math.min(listings.length-1, i+1))

  // First 3 cards free, rest locked for non-users
  const isLocked = !user && idx >= 3

  const fmt = (n: number | null) => n ? `$${n.toLocaleString()}` : 'N/A'
  const fmtPpsqm = (n: number | null) => n ? `$${n.toLocaleString()}/m²` : 'N/A'

  return (
    <div style={{
      position:'absolute', top:0, right:0, bottom:0,
      width:360, background:'rgba(10,10,10,0.97)',
      backdropFilter:'blur(20px)',
      borderLeft:'1px solid rgba(255,255,255,0.08)',
      display:'flex', flexDirection:'column', zIndex:10,
      animation:'slideIn 0.2s ease',
    }}>
      <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>

      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:'#f0ede6', margin:0 }}>
              {areaData.area}
            </h2>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>{areaData.region}</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', padding:4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:12 }}>
          {[
            { label:'Listings', value: total.toLocaleString() },
            { label:'Median Price', value: fmt(areaData.median_price) },
            { label:'Median $/m²', value: fmtPpsqm(areaData.median_ppsqm) },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 10px', textAlign:'center'
            }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#f0ede6' }}>{value}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Carousel */}
      <div style={{ flex:1, padding:'16px 20px', overflow:'hidden', display:'flex', flexDirection:'column', gap:12 }}>
        {/* Navigation */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>
            Listing <strong style={{color:'rgba(255,255,255,0.7)'}}>{idx+1}</strong> of <strong style={{color:'rgba(255,255,255,0.7)'}}>{listings.length}</strong>
            {total > listings.length && <span style={{color:'rgba(255,255,255,0.3)'}}> (showing {listings.length})</span>}
          </span>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={prev} disabled={idx===0} style={{
              background:'rgba(255,255,255,0.06)', border:'none', borderRadius:6,
              width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              color: idx===0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
            }}><ChevronLeft size={14} /></button>
            <button onClick={next} disabled={idx>=listings.length-1} style={{
              background:'rgba(255,255,255,0.06)', border:'none', borderRadius:6,
              width:28, height:28, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              color: idx>=listings.length-1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
            }}><ChevronRight size={14} /></button>
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {listings.slice(0, 20).map((_:any, i:number) => (
            <button key={i} onClick={() => setIdx(i)} style={{
              width: i === idx ? 20 : 6, height:6, borderRadius:3,
              background: i === idx ? '#4ade80' : 'rgba(255,255,255,0.15)',
              border:'none', cursor:'pointer', padding:0,
              transition:'all 0.2s',
            }} />
          ))}
        </div>

        {/* Card */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {current && (
            <ListingCard
              listing={current}
              medianPpsqm={areaData.median_ppsqm}
              isLocked={isLocked}
              onSignIn={onSignIn}
            />
          )}
        </div>
      </div>
    </div>
  )
}
