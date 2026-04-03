'use client'
import { useState } from 'react'
import { Check, Zap, BarChart2, Crown, X } from 'lucide-react'
import { useTheme, T } from '@/components/ThemeContext'
import IqariLogo from '@/components/IqariLogo'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: '',
    color: '#6b7280',
    icon: '🗺️',
    description: 'Explore the market',
    tokens: 0,
    features: [
      'Full map access',
      'All listing prices visible',
      'Area bubbles & clustering',
      'Basic filters',
      '7 property categories',
    ],
    locked: [
      'Insights & analytics',
      'Deal finder',
      'AI property analysis',
      'Deal alerts (email)',
      'Data export',
    ],
    cta: 'Current plan',
    ctaDisabled: true,
  },
  {
    id: 'explorer',
    name: 'Explorer',
    price: 9,
    period: '/mo',
    color: '#4ade80',
    icon: '🔍',
    description: 'For active buyers & renters',
    tokens: 50,
    popular: true,
    features: [
      'Everything in Free',
      'Insights tab & analytics',
      'Deal finder by region',
      '% above/below market per listing',
      '50 tokens / month',
      'AI property analysis (5 tokens)',
      'Deal alerts — email (10 tokens/alert)',
    ],
    locked: [
      'Data export to CSV',
      'Bulk area reports',
    ],
    cta: 'Upgrade to Explorer',
    priceId: 'price_explorer_monthly',
  },
  {
    id: 'analyst',
    name: 'Analyst',
    price: 29,
    period: '/mo',
    color: '#a78bfa',
    icon: '📊',
    description: 'For investors & professionals',
    tokens: 300,
    features: [
      'Everything in Explorer',
      '300 tokens / month',
      'Export listings to CSV (20 tokens)',
      'Bulk area reports (10 tokens)',
      'Price trend history',
      'Portfolio tracking (coming soon)',
      'Priority support',
    ],
    locked: [],
    cta: 'Upgrade to Analyst',
    priceId: 'price_analyst_monthly',
  },
]

const TOKEN_USES = [
  { action: 'AI property analysis', cost: 5, icon: '🤖', desc: 'Deep dive on any listing — valuation, risks, comparables' },
  { action: 'Deal alert (email)', cost: 10, icon: '🔔', desc: 'Get notified when listings match your criteria' },
  { action: 'Area report', cost: 10, icon: '📋', desc: 'Full market analysis for any area' },
  { action: 'Export to CSV', cost: 20, icon: '📥', desc: 'Download filtered listings as spreadsheet' },
]

export default function PricingPage({ onClose, currentTier, user, onUpgrade }: {
  onClose: () => void
  currentTier: string
  user: any
  onUpgrade: (planId: string, priceId: string) => void
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  const handleUpgrade = async (plan: typeof PLANS[0]) => {
    if (!plan.priceId || plan.ctaDisabled) return
    if (!user) {
      alert('Please sign in first')
      return
    }
    setLoading(plan.id)
    await onUpgrade(plan.id, plan.priceId)
    setLoading(null)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 200, overflowY: 'auto', padding: '24px 16px',
      fontFamily: "'DM Sans', sans-serif",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 900,
        background: theme === 'dark' ? '#0f0f0f' : '#fff',
        border: `1px solid ${t.border}`,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>

        {/* Header */}
        <div style={{
          padding: '32px 40px 24px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          background: theme === 'dark'
            ? 'linear-gradient(135deg, rgba(74,222,128,0.05) 0%, transparent 60%)'
            : 'linear-gradient(135deg, rgba(22,163,74,0.05) 0%, transparent 60%)',
        }}>
          <div>
            <div style={{ marginBottom: 16 }}>
              <IqariLogo size="md" />
            </div>
            <h1 style={{
              fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800,
              color: t.text, margin: '0 0 8px', letterSpacing: '-0.03em',
            }}>
              Unlock Data-Driven Intelligence
            </h1>
            <p style={{ fontSize: 14, color: t.textSub, margin: 0, maxWidth: 480 }}>
              From market overview to deal finder — choose the plan that fits your property journey.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: t.bgCard, border: `1px solid ${t.border}`,
            borderRadius: 8, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: t.textMuted, flexShrink: 0,
          }}><X size={16}/></button>
        </div>

        {/* Billing toggle */}
        <div style={{ padding: '20px 40px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          {(['monthly', 'yearly'] as const).map(b => (
            <button key={b} onClick={() => setBilling(b)} style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: billing === b ? t.accent : t.bgCard,
              color: billing === b ? '#fff' : t.textMuted,
            }}>{b === 'monthly' ? 'Monthly' : 'Yearly (-20%)'}</button>
          ))}
        </div>

        {/* Plans */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, padding: '20px 40px 32px',
        }}>
          {PLANS.map(plan => {
            const isCurrentPlan = currentTier === plan.id
            const price = billing === 'yearly' && plan.price > 0
              ? Math.round(plan.price * 0.8)
              : plan.price

            return (
              <div key={plan.id} style={{
                background: plan.popular
                  ? theme === 'dark' ? 'rgba(74,222,128,0.06)' : 'rgba(22,163,74,0.04)'
                  : t.bgCard,
                border: `1px solid ${plan.popular ? t.accentBorder : t.border}`,
                borderRadius: 16, padding: '24px',
                position: 'relative',
                display: 'flex', flexDirection: 'column',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: t.accent, color: '#000', fontSize: 10, fontWeight: 800,
                    padding: '4px 12px', borderRadius: 20, letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}>MOST POPULAR</div>
                )}

                {/* Plan header */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{plan.icon}</span>
                    <span style={{
                      fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700,
                      color: plan.color,
                    }}>{plan.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: t.text }}>
                      {plan.price === 0 ? 'Free' : `$${price}`}
                    </span>
                    {plan.period && <span style={{ fontSize: 13, color: t.textMuted }}>{plan.period}</span>}
                    {billing === 'yearly' && plan.price > 0 && (
                      <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginLeft: 4 }}>-20%</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>{plan.description}</p>
                  {plan.tokens > 0 && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8,
                      background: `${plan.color}15`, border: `1px solid ${plan.color}30`,
                      borderRadius: 20, padding: '3px 10px', fontSize: 11, color: plan.color, fontWeight: 600,
                    }}>
                      ⚡ {plan.tokens} tokens/month
                    </div>
                  )}
                </div>

                {/* Features */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <Check size={13} color={plan.color} style={{ flexShrink: 0, marginTop: 2 }}/>
                      <span style={{ fontSize: 12, color: t.textSub, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                  {plan.locked.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, opacity: 0.4 }}>
                      <X size={13} color={t.textMuted} style={{ flexShrink: 0, marginTop: 2 }}/>
                      <span style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={plan.ctaDisabled || isCurrentPlan || loading === plan.id}
                  style={{
                    width: '100%', border: 'none', borderRadius: 10,
                    padding: '11px', fontSize: 13, fontWeight: 700,
                    cursor: plan.ctaDisabled || isCurrentPlan ? 'default' : 'pointer',
                    background: isCurrentPlan
                      ? t.bgCard
                      : plan.popular
                      ? '#16a34a'
                      : plan.id === 'analyst'
                      ? 'linear-gradient(135deg, #7c3aed, #a78bfa)'
                      : t.bgCard,
                    color: isCurrentPlan
                      ? t.textMuted
                      : plan.popular || plan.id === 'analyst' ? '#fff' : t.text,
                    border: isCurrentPlan ? `1px solid ${t.border}` : 'none',
                    opacity: loading === plan.id ? 0.7 : 1,
                    transition: 'all 0.15s',
                  }}>
                  {loading === plan.id ? 'Redirecting...' :
                   isCurrentPlan ? '✓ Current plan' :
                   plan.cta}
                </button>
              </div>
            )
          })}
        </div>

        {/* Token uses */}
        <div style={{
          padding: '24px 40px 32px',
          borderTop: `1px solid ${t.border}`,
          background: t.bgCard,
        }}>
          <h3 style={{
            fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700,
            color: t.text, margin: '0 0 16px',
          }}>⚡ What can you do with tokens?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {TOKEN_USES.map(u => (
              <div key={u.action} style={{
                background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fff',
                border: `1px solid ${t.border}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{u.icon}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#4ade80',
                    background: 'rgba(74,222,128,0.1)', padding: '1px 7px', borderRadius: 10,
                  }}>{u.cost} tokens</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>{u.action}</div>
                <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
