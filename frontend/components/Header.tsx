'use client'

export default function Header({ count, loading }: { count: number; loading: boolean }) {
  return (
    <div style={{
      background: '#0f0f0f',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 28, height: 28,
          background: '#1a7a3c',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>🌲</div>
        <span style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: '#f0ede6',
        }}>
          Lebanon<span style={{ color: '#22c55e' }}>Property</span>
        </span>
      </div>
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {loading ? (
          <span style={{ color: '#22c55e' }}>Loading listings...</span>
        ) : (
          <span><strong style={{ color: '#f0ede6' }}>{count.toLocaleString()}</strong> listings found</span>
        )}
      </div>
    </div>
  )
}
