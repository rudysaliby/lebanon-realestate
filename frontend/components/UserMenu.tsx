'use client'
import { useState, useRef, useEffect } from 'react'
import { LogOut, Coins, Crown } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { useTheme, T } from '@/components/ThemeContext'
import IqariLogo from '@/components/IqariLogo'

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
  const ref = useRef<HTMLDivElement>(null)
  const tier   = user?.user_metadata?.tier || 'free'
  const tokens = user?.user_metadata?.tokens || 0
  const name   = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        display:'flex', alignItems:'center', gap:8,
        background: t.bgCard, border:`1px solid ${t.border}`,
        borderRadius:8, padding:'5px 10px', cursor:'pointer',
      }}>
        <div style={{
          width:24, height:24, borderRadius:6,
          background:'linear-gradient(135deg, #16a34a, #4ade80)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:11, fontWeight:700, color:'white',
        }}>
          {name[0]?.toUpperCase()}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:1 }}>
          <span style={{ fontSize:12, color:t.text, fontWeight:500 }}>{name}</span>
          <span style={{ fontSize:10, color:TIER_COLORS[tier], fontWeight:600 }}>{TIER_LABELS[tier]}</span>
        </div>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', right:0,
          background: theme === 'dark' ? '#111' : '#fff',
          border:`1px solid ${t.border}`,
          borderRadius:10, padding:'8px', minWidth:210,
          boxShadow: t.shadow, zIndex:100,
          fontFamily:"'DM Sans',sans-serif",
        }}>
          <div style={{ padding:'8px 10px', borderBottom:`1px solid ${t.border}`, marginBottom:6 }}>
            <div style={{ fontSize:12, color:t.textSub, marginBottom:4 }}>{user?.email}</div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{
                fontSize:10, fontWeight:700, color:TIER_COLORS[tier],
                background:`${TIER_COLORS[tier]}20`, padding:'2px 7px', borderRadius:4,
              }}>{TIER_LABELS[tier]}</span>
              {tier !== 'free' && (
                <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:t.textMuted }}>
                  <Coins size={10}/> {tokens} tokens
                </span>
              )}
            </div>
          </div>

          {tier === 'free' && (
            <button style={{
              width:'100%', background:'linear-gradient(135deg, #16a34a, #166534)',
              border:'none', borderRadius:7, padding:'9px', fontSize:12,
              fontWeight:600, color:'#fff', cursor:'pointer', marginBottom:6,
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
              <Crown size={12}/> Upgrade to Explorer
            </button>
          )}

          <button onClick={async () => { await supabase.auth.signOut(); window.location.reload() }} style={{
            width:'100%', background:'none', border:'none', borderRadius:7,
            padding:'8px 10px', fontSize:12, color:t.textMuted, cursor:'pointer',
            display:'flex', alignItems:'center', gap:8, textAlign:'left',
          }}>
            <LogOut size={12}/> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
