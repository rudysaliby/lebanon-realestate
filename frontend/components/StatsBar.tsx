'use client'
import { useEffect, useState } from 'react'

export default function StatsBar({ area, type }: { area: string | null; type: string }) {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (!area) return
    const params = new URLSearchParams()
    params.set('area', area)
    if (type !== 'all') params.set('type', type)
    fetch(`/api/analytics?${params}`)
      .then(r => r.json())
      .then(d => setStats(d.stats?.[0] || null))
  }, [area, type])

  if (!stats || !area) return null

  return (
    <div style={{
      background: 'rgba(26,122,60,0.12)',
      borderBottom: '1px solid rgba(34,197,94,0.15)',
      padding: '6px 20px',
      display: 'flex',
      gap: 24,
      alignItems: 'center',
      fontSize: 12,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <span style={{ color: '#22c55e', fontWeight: 500 }}>{area}</span>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>
        Avg: <strong style={{ color: '#f0ede6' }}>${Number(stats.avg_price).toLocaleString()}</strong>
      </span>
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>
        Median: <strong style={{ color: '#f0ede6' }}>${Number(stats.median_price).toLocaleString()}</strong>
      </span>
      {stats.avg_price_per_sqm && (
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>
          Avg/m²: <strong style={{ color: '#f0ede6' }}>${Number(stats.avg_price_per_sqm).toLocaleString()}</strong>
        </span>
      )}
      <span style={{ color: 'rgba(255,255,255,0.35)' }}>
        {stats.listing_count} listings
      </span>
    </div>
  )
}
