'use client'
import { useState } from 'react'
import type { Mode } from '@/app/page'

type Step = 'period' | 'type'

export default function ModeSelector({ onSelect }: { onSelect: (m: Mode) => void }) {
  const [step, setStep] = useState<Step>('period')
  const [period, setPeriod] = useState<'sale' | 'monthly' | null>(null)

  const choosePeriod = (p: 'sale' | 'monthly') => {
    setPeriod(p)
    setStep('type')
  }

  const chooseType = (t: 'residential' | 'land' | 'commercial') => {
    onSelect({ period: period!, type: t })
  }

  return (
    <div style={{
      height: '100vh', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(74,222,128,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }} />

      {/* Glow */}
      <div style={{
        position: 'absolute', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(26,107,58,0.15) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 560, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 48 }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="9" fill="#1a6b3a"/>
            <path d="M18 5L6 14v17h7v-8h10v8h7V14L18 5z" fill="white" opacity="0.9"/>
            <circle cx="18" cy="17" r="3" fill="#4ade80"/>
          </svg>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em', color: '#f0ede6' }}>
            Prop<span style={{ color: '#4ade80' }}>IQ</span>
          </span>
        </div>

        {step === 'period' ? (
          <>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              Data-Driven Property Intelligence
            </p>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 700, color: '#f0ede6', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 48 }}>
              What are you<br />looking for?
            </h1>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { id: 'sale' as const, label: 'For Sale', icon: '🏠', sub: 'Buy property' },
                { id: 'monthly' as const, label: 'For Rent', icon: '🔑', sub: 'Monthly rental' },
              ].map(opt => (
                <button key={opt.id} onClick={() => choosePeriod(opt.id)} style={{
                  flex: 1, padding: '28px 20px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.08)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.3)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'
                }}>
                  <span style={{ fontSize: 32 }}>{opt.icon}</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#f0ede6' }}>{opt.label}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{opt.sub}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setStep('period')} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
              fontSize: 12, cursor: 'pointer', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto 24px',
            }}>← Back</button>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 700, color: '#f0ede6', letterSpacing: '-0.03em', marginBottom: 12 }}>
              Property type
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 36 }}>
              {period === 'sale' ? 'For Sale' : 'For Rent'} — select a category
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { id: 'residential' as const, label: 'Residential', icon: '🏘️', sub: 'Apartments & Villas' },
                { id: 'land' as const, label: 'Land', icon: '🌿', sub: 'Plots & Terrain' },
                { id: 'commercial' as const, label: 'Commercial', icon: '🏢', sub: 'Offices & Shops' },
              ].map(opt => (
                <button key={opt.id} onClick={() => chooseType(opt.id)} style={{
                  flex: 1, padding: '24px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.08)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.3)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'
                }}>
                  <span style={{ fontSize: 28 }}>{opt.icon}</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#f0ede6' }}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{opt.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
