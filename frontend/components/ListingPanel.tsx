'use client'
import { Listing } from '@/lib/supabase'
import { X, ExternalLink, MapPin, Home, Maximize2, DollarSign } from 'lucide-react'

function fmt(n: number | null, currency = 'USD') {
  if (!n) return 'Price N/A'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

const SOURCE_LABELS: Record<string, string> = {
  olx: 'OLX Lebanon',
  propertyfinder: 'Property Finder LB',
}

export default function ListingPanel({ listing, onClose }: {
  listing: Listing
  onClose: () => void
}) {
  const panel: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 320,
    background: '#161616',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
    zIndex: 100,
    overflow: 'hidden',
    fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <div style={panel}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {SOURCE_LABELS[listing.source] || listing.source}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f0ede6', lineHeight: 1.3 }}>
            {listing.title || 'Untitled listing'}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          borderRadius: 8,
          color: 'rgba(255,255,255,0.5)',
          width: 28, height: 28,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <X size={14} />
        </button>
      </div>

      {/* Price */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: '#f0ede6' }}>
          {fmt(listing.price)}
        </span>
        {listing.price_period === 'monthly' && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>/mo</span>
        )}
      </div>

      {/* Details grid */}
      <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {listing.area && (
          <div style={detailBox}>
            <MapPin size={12} color="#22c55e" />
            <span style={detailLabel}>Area</span>
            <span style={detailValue}>{listing.area}</span>
          </div>
        )}
        {listing.property_type && (
          <div style={detailBox}>
            <Home size={12} color="#22c55e" />
            <span style={detailLabel}>Type</span>
            <span style={detailValue} className="capitalize">{listing.property_type}</span>
          </div>
        )}
        {listing.size_sqm && (
          <div style={detailBox}>
            <Maximize2 size={12} color="#22c55e" />
            <span style={detailLabel}>Size</span>
            <span style={detailValue}>{listing.size_sqm} m²</span>
          </div>
        )}
        {listing.price_per_sqm && (
          <div style={detailBox}>
            <DollarSign size={12} color="#22c55e" />
            <span style={detailLabel}>Per m²</span>
            <span style={detailValue}>${listing.price_per_sqm.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Location */}
      {listing.location_raw && (
        <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          📍 {listing.location_raw}
        </div>
      )}

      {/* CTA */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: '#1a7a3c',
            color: '#fff',
            borderRadius: 10,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'background 0.15s',
          }}
        >
          View on {SOURCE_LABELS[listing.source] || listing.source}
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}

const detailBox: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 8,
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
}
const detailLabel: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.3)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}
const detailValue: React.CSSProperties = {
  fontSize: 13,
  color: '#f0ede6',
  fontWeight: 500,
}
