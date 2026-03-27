'use client'

const TAG_CONFIG: Record<string, { color: string; bg: string; border: string; emoji: string }> = {
  // Furnished
  'furnished':       { color:'#4ade80', bg:'rgba(34,197,94,0.12)',   border:'rgba(34,197,94,0.3)',   emoji:'🛋️' },
  'unfurnished':     { color:'#94a3b8', bg:'rgba(148,163,184,0.1)',  border:'rgba(148,163,184,0.2)', emoji:'🏠' },
  'semi-furnished':  { color:'#86efac', bg:'rgba(134,239,172,0.1)',  border:'rgba(134,239,172,0.2)', emoji:'🪑' },
  // Condition
  'new':             { color:'#60a5fa', bg:'rgba(96,165,250,0.12)',  border:'rgba(96,165,250,0.3)',  emoji:'✨' },
  'under-construction': { color:'#fbbf24', bg:'rgba(251,191,36,0.12)', border:'rgba(251,191,36,0.3)', emoji:'🏗️' },
  'renovated':       { color:'#a78bfa', bg:'rgba(167,139,250,0.12)', border:'rgba(167,139,250,0.3)', emoji:'🔨' },
  'well-maintained': { color:'#34d399', bg:'rgba(52,211,153,0.1)',   border:'rgba(52,211,153,0.2)', emoji:'👍' },
  // Views
  'sea':             { color:'#38bdf8', bg:'rgba(56,189,248,0.12)',  border:'rgba(56,189,248,0.3)',  emoji:'🌊' },
  'mountain':        { color:'#86efac', bg:'rgba(134,239,172,0.1)',  border:'rgba(134,239,172,0.2)', emoji:'⛰️' },
  'open':            { color:'#fde68a', bg:'rgba(253,230,138,0.1)',  border:'rgba(253,230,138,0.2)', emoji:'🌅' },
  'city':            { color:'#c4b5fd', bg:'rgba(196,181,253,0.1)',  border:'rgba(196,181,253,0.2)', emoji:'🌆' },
  // Floor type
  'rooftop':         { color:'#fb923c', bg:'rgba(251,146,60,0.12)',  border:'rgba(251,146,60,0.3)',  emoji:'🏔️' },
  'penthouse':       { color:'#f472b6', bg:'rgba(244,114,182,0.12)', border:'rgba(244,114,182,0.3)', emoji:'👑' },
  'duplex':          { color:'#c4b5fd', bg:'rgba(196,181,253,0.1)',  border:'rgba(196,181,253,0.2)', emoji:'🏘️' },
  // Features
  'pool':            { color:'#38bdf8', bg:'rgba(56,189,248,0.12)',  border:'rgba(56,189,248,0.3)',  emoji:'🏊' },
  'garden':          { color:'#4ade80', bg:'rgba(74,222,128,0.12)',  border:'rgba(74,222,128,0.3)',  emoji:'🌿' },
  'terrace':         { color:'#fde68a', bg:'rgba(253,230,138,0.1)',  border:'rgba(253,230,138,0.2)', emoji:'🌞' },
  'parking':         { color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.2)', emoji:'🚗' },
  'elevator':        { color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.2)', emoji:'🔼' },
  'generator':       { color:'#fbbf24', bg:'rgba(251,191,36,0.1)',  border:'rgba(251,191,36,0.2)',  emoji:'⚡' },
  'gym':             { color:'#f472b6', bg:'rgba(244,114,182,0.1)', border:'rgba(244,114,182,0.2)', emoji:'💪' },
  'balcony':         { color:'#fde68a', bg:'rgba(253,230,138,0.1)', border:'rgba(253,230,138,0.2)', emoji:'🌇' },
  'security':        { color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.2)', emoji:'🔒' },
  'solar':           { color:'#fbbf24', bg:'rgba(251,191,36,0.1)',  border:'rgba(251,191,36,0.2)',  emoji:'☀️' },
  // Lifestyle
  'luxury':          { color:'#f59e0b', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)',  emoji:'💎' },
  'gated':           { color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.2)', emoji:'🏰' },
  'prime-location':  { color:'#f472b6', bg:'rgba(244,114,182,0.12)',border:'rgba(244,114,182,0.3)', emoji:'📍' },
  'investment':      { color:'#4ade80', bg:'rgba(74,222,128,0.12)', border:'rgba(74,222,128,0.3)',  emoji:'📈' },
  // Payment
  'installments':    { color:'#60a5fa', bg:'rgba(96,165,250,0.12)', border:'rgba(96,165,250,0.3)',  emoji:'💳' },
}

function Tag({ label }: { label: string }) {
  const cfg = TAG_CONFIG[label] || { color:'rgba(255,255,255,0.5)', bg:'rgba(255,255,255,0.05)', border:'rgba(255,255,255,0.1)', emoji:'•' }
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:3,
      background: cfg.bg, border:`1px solid ${cfg.border}`,
      borderRadius:6, padding:'2px 7px', fontSize:11,
      color: cfg.color, whiteSpace:'nowrap',
    }}>
      <span style={{ fontSize:10 }}>{cfg.emoji}</span>
      {label.replace(/-/g,' ')}
    </span>
  )
}

export default function TagBadges({ listing }: { listing: any }) {
  const tags: string[] = []

  if (listing.furnished)    tags.push(listing.furnished)
  if (listing.condition)    tags.push(listing.condition)
  if (listing.floor_type)   tags.push(listing.floor_type)
  if (listing.view_type)    tags.push(...(listing.view_type || []))
  if (listing.features)     tags.push(...(listing.features || []))
  if (listing.lifestyle)    tags.push(...(listing.lifestyle || []))
  if (listing.payment_type === 'installments') tags.push('installments')

  if (tags.length === 0) return null

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'0 16px 12px' }}>
      {tags.slice(0, 8).map(t => <Tag key={t} label={t} />)}
    </div>
  )
}
