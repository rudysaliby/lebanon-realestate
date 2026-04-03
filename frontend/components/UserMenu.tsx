'use client'
import { useState, useRef, useEffect } from 'react'
import { LogOut, Coins, Crown, Zap } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { useTheme, T } from '@/components/ThemeContext'
import PricingPage from '@/components/PricingPage'
import AdminPanel from '@/components/AdminPanel'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TIER_COLORS: Record<string, string> = {
  free: '#6b7280', explorer: '#4ade80', analyst: '#a78bfa', admin: '#f59e0b',
}
const TIER_LABELS: Record<string, string> = {
  free: 'Free', explorer: 'Explorer', analyst: 'Analyst', admin: '★ Admin',
}

export default function UserMenu({ user }: { user: any }) {
  const { theme } = useTheme()
  const t = T[theme]
  const [open, setOpen] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tier   = user?.user_metadata?.tier || 'free'
  const tokens = user?.user_metadata?.tokens || 0
  const name   = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleUpgrade = async (planId: string, priceId: string) => {
    // Call Stripe checkout API
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          userId: user.id,
          email: user.email,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Payment setup coming soon. Contact us at hello@iqari.com')
      }
    } catch {
      alert('Payment setup coming soon. Contact us at hello@iqari.com')
    }
  }

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o=>!o)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: t.bgCard, border: `1px solid ${t.border}`,
          borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'linear-gradient(135deg, #16a34a, #4ade80)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'white',
          }}>
            {name[0]?.toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
            <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{name}</span>
            <span style={{ fontSize: 10, color: TIER_COLORS[tier], fontWeight: 600 }}>{TIER_LABELS[tier]}</span>
          </div>
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: theme === 'dark' ? '#111' : '#fff',
            border: `1px solid ${t.border}`,
            borderRadius: 10, padding: '8px', minWidth: 210,
            boxShadow: t.shadow, zIndex: 100,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {/* User info */}
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>{user?.email}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: TIER_COLORS[tier],
                  background: `${TIER_COLORS[tier]}20`, padding: '2px 7px', borderRadius: 4,
                }}>{TIER_LABELS[tier]}</span>
                {tier !== 'free' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: t.textMuted }}>
                    <Coins size={10}/> {tokens} tokens
                  </span>
                )}
              </div>
            </div>

            {/* Upgrade CTA — shows for free and explorer */}
            {(tier === 'free' || tier === 'explorer') && (
              <button
                onClick={() => { setOpen(false); setShowPricing(true) }}
                style={{
                  width: '100%',
                  background: tier === 'free'
                    ? 'linear-gradient(135deg, #16a34a, #166534)'
                    : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                  border: 'none', borderRadius: 7, padding: '9px', fontSize: 12,
                  fontWeight: 600, color: '#fff', cursor: 'pointer', marginBottom: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <Crown size={12}/>
                {tier === 'free' ? 'Upgrade to Explorer' : 'Upgrade to Analyst'}
              </button>
            )}

            {/* View all plans */}
            <button
              onClick={() => { setOpen(false); setShowPricing(true) }}
              style={{
                width: '100%', background: 'none',
                border: `1px solid ${t.border}`,
                borderRadius: 7, padding: '8px 10px', fontSize: 12,
                color: t.textMuted, cursor: 'pointer', marginBottom: 4,
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
              }}>
              <Zap size={12}/> View all plans & pricing
            </button>

            {/* Admin panel */}
            {tier === 'admin' && (
              <button
                onClick={() => { setOpen(false); setShowAdmin(true) }}
                style={{
                  width:'100%', background:'rgba(245,158,11,0.08)',
                  border:'1px solid rgba(245,158,11,0.2)',
                  borderRadius:7, padding:'8px 10px', fontSize:12,
                  color:'#f59e0b', cursor:'pointer', marginBottom:4,
                  display:'flex', alignItems:'center', gap:8, textAlign:'left',
                  fontWeight:600,
                }}>
                ★ Admin Panel
              </button>
            )}

            {/* Sign out */}
            <button
              onClick={async () => {
                setOpen(false)
                await supabase.auth.signOut()
                localStorage.removeItem('sb-fgpszczrwudsxlskemnc-auth-token')
                window.location.href = window.location.pathname
              }}
              style={{
                width: '100%', background: 'none', border: 'none',
                borderRadius: 7, padding: '8px 10px', fontSize: 12,
                color: t.textMuted, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
              }}>
              <LogOut size={12}/> Sign out
            </button>
          </div>
        )}
      </div>

      {showPricing && (
        <PricingPage
          onClose={() => setShowPricing(false)}
          currentTier={tier}
          user={user}
          onUpgrade={handleUpgrade}
        />
      )}

      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          user={user}
        />
      )}
    </>
  )
}
