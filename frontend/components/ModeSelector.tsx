'use client'
import { useState } from 'react'
import IqariLogo from '@/components/IqariLogo'
import ThemeToggle from '@/components/ThemeToggle'
import { ThemeProvider, useTheme, T } from '@/components/ThemeContext'
import type { Mode } from '@/app/page'

function ModeSelectorContent({ onSelect }: { onSelect: (m: Mode) => void }) {
  const { theme } = useTheme()
  const t = T[theme]
  const [step, setStep] = useState<'period' | 'type'>('period')
  const [period, setPeriod] = useState<'sale' | 'monthly' | null>(null)

  const choosePeriod = (p: 'sale' | 'monthly') => {
    setPeriod(p)
    setStep('type')
  }

  const chooseType = (tp: 'residential' | 'land' | 'commercial') => {
    onSelect({ period: period!, type: tp })
  }

  return (
    <div style={{
      height: '100vh',
      background: t.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative', overflow: 'hidden',
      transition: 'background 0.3s',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${theme === 'dark' ? 'rgba(74,222,128,0.03)' : 'rgba(22,163,74,0.04)'} 1px, transparent 1px), linear-gradient(90deg, ${theme === 'dark' ? 'rgba(74,222,128,0.03)' : 'rgba(22,163,74,0.04)'} 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }} />

      {/* Glow */}
      <div style={{
        position: 'absolute', width: 600, height: 600,
        background: `radial-gradient(circle, ${theme === 'dark' ? 'rgba(26,107,58,0.15)' : 'rgba(22,163,74,0.08)'} 0%, transparent 70%)`,
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* Theme toggle top-right */}
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <ThemeToggle />
      </div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 560, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 48 }}>
          <IqariLogo size="lg" />
        </div>

        {step === 'period' ? (
          <>
            <p style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              Data-Driven Property Intelligence
            </p>
            <h1 style={{
              fontFamily: "'Syne', sans-serif", fontSize: 34, fontWeight: 700,
              color: t.text, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 40,
            }}>
              What are you<br />looking for?
            </h1>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { id: 'sale' as const, label: 'For Sale', icon: '🏠', sub: 'Buy property' },
                { id: 'monthly' as const, label: 'For Rent', icon: '🔑', sub: 'Monthly rental' },
              ].map(opt => (
                <OptionCard key={opt.id} {...opt} onClick={() => choosePeriod(opt.id)} theme={theme} t={t} />
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setStep('period')} style={{
              background: 'none', border: 'none', color: t.textMuted,
              fontSize: 12, cursor: 'pointer', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 5, margin: '0 auto 24px',
            }}>
              ← Back
            </button>
            <h1 style={{
              fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 700,
              color: t.text, letterSpacing: '-0.03em', marginBottom: 8,
            }}>
              Property type
            </h1>
            <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 32 }}>
              {period === 'sale' ? 'For Sale' : 'For Rent'} — select a category
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { id: 'residential' as const, label: 'Residential', icon: '🏘️', sub: 'Apartments & Villas' },
                { id: 'land' as const, label: 'Land', icon: '🌿', sub: 'Plots & Terrain' },
                { id: 'commercial' as const, label: 'Commercial', icon: '🏢', sub: 'Offices & Shops' },
              ].map(opt => (
                <OptionCard key={opt.id} {...opt} onClick={() => chooseType(opt.id)} theme={theme} t={t} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function OptionCard({ icon, label, sub, onClick, theme, t }: any) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, padding: '26px 18px', borderRadius: 14,
        background: hovered ? t.accentBg : t.bgCard,
        border: `1px solid ${hovered ? t.accentBorder : t.border}`,
        cursor: 'pointer', transition: 'all 0.18s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 8px 24px ${theme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)'}` : 'none',
      }}>
      <span style={{ fontSize: 30 }}>{icon}</span>
      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: t.text }}>{label}</span>
      <span style={{ fontSize: 11, color: t.textMuted }}>{sub}</span>
    </button>
  )
}

export default function ModeSelector({ onSelect }: { onSelect: (m: Mode) => void }) {
  return <ModeSelectorContent onSelect={onSelect} />
}
