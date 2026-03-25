'use client'

export default function AnalyticsLegend() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 24,
      left: 16,
      background: '#161616',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '10px 14px',
      zIndex: 100,
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 12,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, marginBottom: 8 }}>
        Pin color = valuation
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Undervalued (&gt;15% below avg)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#818cf8', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Fairly priced</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>Overvalued (&gt;15% above avg)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6b7280', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>No price data</span>
        </div>
      </div>
    </div>
  )
}
