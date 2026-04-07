'use client'
import { useState } from 'react'
import { Download, Bell, Presentation, Lock, Coins, Check, X } from 'lucide-react'
import { useTheme, T } from '@/components/ThemeContext'
import { getTier, canExportCSV } from '@/lib/useTier'
import { deductTokens } from '@/lib/tokenActions'

type Feature = {
  id: string
  icon: any
  title: string
  subtitle: string
  description: string
  tokenCost: number
  minTier: 'explorer' | 'analyst' | 'admin'
  badge?: string
  badgeColor?: string
}

const FEATURES: Feature[] = [
  {
    id: 'export',
    icon: Download,
    title: 'Data Export',
    subtitle: 'Download as CSV or Excel',
    description: 'Export your filtered listings to a spreadsheet — includes price, size, location, condition, and all tags.',
    tokenCost: 20,
    minTier: 'analyst',
    badge: 'Analyst',
    badgeColor: '#a78bfa',
  },
  {
    id: 'report',
    icon: Presentation,
    title: 'Market Report',
    subtitle: 'AI-generated 3-slide presentation',
    description: 'Claude generates a professional market report for your selected area — median prices, deal distribution, top picks, and trend analysis. Exported as PowerPoint.',
    tokenCost: 30,
    minTier: 'analyst',
    badge: 'AI ✨',
    badgeColor: '#60a5fa',
  },
  {
    id: 'alerts',
    icon: Bell,
    title: 'Proactive Alerts',
    subtitle: 'Get notified when deals appear',
    description: 'Set a price threshold per area. As soon as a new listing drops below it, you\'ll get an email notification. Each active alert costs 10 tokens/month.',
    tokenCost: 10,
    minTier: 'explorer',
    badge: 'Popular',
    badgeColor: '#4ade80',
  },
]

function FeatureCard({ feature, user, tokens, t, theme, onUpgrade, onTokensChanged }: any) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const tier = getTier(user)

  const tierRank: Record<string, number> = { free: 0, explorer: 1, analyst: 2, admin: 99 }
  const hasAccess = tierRank[tier] >= tierRank[feature.minTier]
  const canAfford = tokens >= feature.tokenCost
  const isLocked = !hasAccess

  const handleAction = async () => {
    if (isLocked) { onUpgrade(); return }
    if (!canAfford) {
      setError(`Need ${feature.tokenCost - tokens} more tokens`)
      setTimeout(() => setError(''), 3000)
      return
    }
    setLoading(true)
    setError('')

    // Deduct tokens FIRST before performing the action
    const result = await deductTokens(user.id, feature.tokenCost, feature.id)
    if (!result.success) {
      setError(result.error || 'Failed to deduct tokens')
      setLoading(false)
      setTimeout(() => setError(''), 3000)
      return
    }

    // Refresh user data to reflect new token balance
    if (onTokensChanged) await onTokensChanged()

    // Now perform the actual feature action
    if (feature.id === 'export') {
      try {
        const res = await fetch('/api/listings?period=sale&type_group=residential')
        const data = await res.json()
        const rows = data.features.map((f: any) => {
          const p = f.properties
          return [p.title, p.price, p.size_sqm, p.area, p.region, p.property_type, p.bedrooms, p.bathrooms, p.condition, p.url].join(',')
        })
        const csv = ['Title,Price,Size,Area,Region,Type,Beds,Baths,Condition,URL', ...rows].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'iqari-listings.csv'; a.click()
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch {
        setError('Export failed')
        setTimeout(() => setError(''), 3000)
      }
    } else if (feature.id === 'alerts') {
      onUpgrade('alerts')
    } else if (feature.id === 'report') {
      try {
        const res = await fetch('/api/market-report', { method: 'POST' })
        if (res.ok) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = 'iqari-market-report.pptx'; a.click()
          setSuccess(true)
          setTimeout(() => setSuccess(false), 3000)
        } else {
          setError('Report generation failed')
          setTimeout(() => setError(''), 3000)
        }
      } catch {
        setError('Report generation failed')
        setTimeout(() => setError(''), 3000)
      }
    }

    setLoading(false)
  }

  return (
    <div style={{
      background: t.bgCard, border: `1px solid ${isLocked ? t.border : feature.badgeColor + '30'}`,
      borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Gradient accent */}
      {!isLocked && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${feature.badgeColor}, ${feature.badgeColor}80)`,
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: isLocked ? t.bgCard : `${feature.badgeColor}20`,
            border: `1px solid ${isLocked ? t.border : feature.badgeColor + '40'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <feature.icon size={16} color={isLocked ? t.textMuted : feature.badgeColor} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isLocked ? t.textMuted : t.text }}>
              {feature.title}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted }}>{feature.subtitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {feature.badge && (
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
              background: `${feature.badgeColor}20`, color: feature.badgeColor,
              letterSpacing: '0.04em',
            }}>{feature.badge}</span>
          )}
          {isLocked && <Lock size={12} color={t.textMuted} />}
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, margin: 0 }}>
        {feature.description}
      </p>

      {/* Error message */}
      {error && (
        <div style={{
          fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '5px 10px',
        }}>
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <Coins size={12} color={t.accent} />
          <span style={{ color: t.accent, fontWeight: 700 }}>{feature.tokenCost}</span>
          <span style={{ color: t.textMuted }}>tokens</span>
        </div>

        <button
          onClick={handleAction}
          disabled={loading || (hasAccess && !canAfford)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: 'none', cursor: isLocked || (hasAccess && !canAfford) ? 'not-allowed' : 'pointer',
            background: success ? '#16a34a' :
              isLocked ? 'rgba(107,114,128,0.2)' :
              !canAfford ? 'rgba(107,114,128,0.15)' :
              feature.badgeColor === '#4ade80' ? '#16a34a' :
              feature.badgeColor === '#a78bfa' ? '#7c3aed' : '#2563eb',
            color: isLocked ? t.textMuted : '#fff',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.15s',
          }}>
          {success ? <><Check size={12}/> Done</> :
           loading ? 'Working...' :
           isLocked ? <><Lock size={11}/> {feature.minTier === 'analyst' ? 'Analyst required' : 'Explorer required'}</> :
           !canAfford ? `Need ${feature.tokenCost - tokens} more tokens` :
           feature.id === 'export' ? <><Download size={11}/> Export</> :
           feature.id === 'report' ? <><Presentation size={11}/> Generate</> :
           <><Bell size={11}/> Set Alert</>
          }
        </button>
      </div>
    </div>
  )
}

export default function AnalystFeatures({ user, onUpgrade, onTokensChanged }: {
  user: any, onUpgrade: (action?: string) => void, onTokensChanged?: () => Promise<any>
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const tokens = user?.user_metadata?.tokens ?? 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
      {FEATURES.map(feature => (
        <FeatureCard
          key={feature.id}
          feature={feature}
          user={user}
          tokens={tokens}
          t={t}
          theme={theme}
          onUpgrade={onUpgrade}
          onTokensChanged={onTokensChanged}
        />
      ))}
    </div>
  )
}
