'use client'
import { useState, useEffect } from 'react'
import { Bell, BellOff, Plus, Trash2, Coins, Lock } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { deductTokens } from '@/lib/tokenActions'
import type { Mode } from '@/app/page'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Each alert costs 10 tokens/month to maintain
const ALERT_TOKEN_COST = 10

type Alert = {
  id: string
  area: string
  region: string
  max_price: number
  property_type: string
  price_period: string
  active: boolean
  created_at: string
}

export default function DealAlerts({ mode, user, onSignIn, onTokensChanged }: {
  mode: Mode, user: any, onSignIn: () => void, onTokensChanged?: () => Promise<any>
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [area, setArea] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  const tier = user?.user_metadata?.tier || 'free'
  const tokens = user?.user_metadata?.tokens || 0
  const canUse = tier === 'explorer' || tier === 'analyst' || tier === 'admin'

  useEffect(() => {
    if (!user) return
    fetchAlerts()
  }, [user])

  const fetchAlerts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('deal_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setAlerts(data || [])
    setLoading(false)
  }

  const createAlert = async () => {
    if (!area || !maxPrice) return
    if (tokens < ALERT_TOKEN_COST) {
      setSuccess('Not enough tokens. Each alert costs 10 tokens/month.')
      return
    }
    setSaving(true)

    // Deduct tokens first
    const deductResult = await deductTokens(user.id, ALERT_TOKEN_COST, 'deal_alert')
    if (!deductResult.success) {
      setSuccess(deductResult.error || 'Failed to deduct tokens. Try again.')
      setSaving(false)
      return
    }

    // Refresh user data to reflect new balance
    if (onTokensChanged) await onTokensChanged()

    const { error } = await supabase.from('deal_alerts').insert({
      user_id: user.id,
      area: area.trim(),
      max_price: parseFloat(maxPrice),
      property_type: mode.type,
      price_period: mode.period,
      active: true,
    })
    if (!error) {
      setSuccess(`Alert set! You'll receive emails when ${area} listings drop below $${Number(maxPrice).toLocaleString()}.`)
      setArea(''); setMaxPrice(''); setCreating(false)
      fetchAlerts()
    }
    setSaving(false)
  }

  const toggleAlert = async (id: string, active: boolean) => {
    await supabase.from('deal_alerts').update({ active: !active }).eq('id', id)
    fetchAlerts()
  }

  const deleteAlert = async (id: string) => {
    await supabase.from('deal_alerts').delete().eq('id', id)
    fetchAlerts()
  }

  if (!user) return (
    <div style={{
      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
      borderRadius:14, padding:'24px', textAlign:'center',
    }}>
      <Bell size={24} color="rgba(255,255,255,0.2)" style={{ marginBottom:10 }} />
      <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:14 }}>Sign in to set up deal alerts</p>
      <button onClick={onSignIn} style={{
        background:'#1a6b3a', border:'none', borderRadius:7,
        padding:'8px 20px', fontSize:12, fontWeight:600, color:'#fff', cursor:'pointer',
      }}>Sign in</button>
    </div>
  )

  if (!canUse) return (
    <div style={{
      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
      borderRadius:14, padding:'24px', textAlign:'center',
    }}>
      <Lock size={24} color="rgba(255,255,255,0.2)" style={{ marginBottom:10 }} />
      <p style={{ fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.7)', marginBottom:6 }}>Explorer plan required</p>
      <p style={{ fontSize:12, color:'rgba(255,255,255,0.35)', marginBottom:16 }}>
        Deal alerts cost 10 tokens/month each. Upgrade to start receiving email notifications.
      </p>
      <button style={{
        background:'linear-gradient(135deg, #1a6b3a, #166534)', border:'none', borderRadius:8,
        padding:'10px 24px', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer',
      }}>Upgrade to Explorer — $9/mo</button>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, color:'#f0ede6', margin:0 }}>
            Deal Alerts
          </h3>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', margin:'4px 0 0' }}>
            Email when listings match your criteria · 10 tokens/alert/month
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)', display:'flex', alignItems:'center', gap:5 }}>
            <Coins size={11}/> {tokens} tokens
          </span>
          <button onClick={() => setCreating(c=>!c)} style={{
            display:'flex', alignItems:'center', gap:5,
            background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)',
            borderRadius:7, padding:'6px 12px', fontSize:12, fontWeight:600,
            color:'#4ade80', cursor:'pointer',
          }}>
            <Plus size={12}/> New Alert
          </button>
        </div>
      </div>

      {/* Create form */}
      {creating && (
        <div style={{
          background:'rgba(74,222,128,0.05)', border:'1px solid rgba(74,222,128,0.15)',
          borderRadius:12, padding:'16px', marginBottom:16,
        }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:5 }}>Area name</label>
              <input
                value={area} onChange={e=>setArea(e.target.value)}
                placeholder="e.g. Achrafieh"
                style={{
                  width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
                  borderRadius:7, padding:'8px 10px', fontSize:13, color:'#f0ede6',
                  outline:'none', boxSizing:'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize:11, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:5 }}>Max price ($)</label>
              <input
                value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}
                placeholder="e.g. 500000"
                type="number"
                style={{
                  width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
                  borderRadius:7, padding:'8px 10px', fontSize:13, color:'#f0ede6',
                  outline:'none', boxSizing:'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <p style={{ fontSize:11, color:'rgba(255,255,255,0.3)', margin:0 }}>
              Costs <strong style={{color:'#4ade80'}}>10 tokens/month</strong> · You have {tokens} tokens
            </p>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setCreating(false)} style={{
                background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:7,
                padding:'7px 14px', fontSize:12, color:'rgba(255,255,255,0.4)', cursor:'pointer',
              }}>Cancel</button>
              <button onClick={createAlert} disabled={saving || !area || !maxPrice} style={{
                background:'#1a6b3a', border:'none', borderRadius:7,
                padding:'7px 14px', fontSize:12, fontWeight:600, color:'#fff',
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
              }}>
                {saving ? 'Saving...' : 'Create Alert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div style={{
          background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)',
          borderRadius:8, padding:'10px 14px', fontSize:12, color:'#4ade80', marginBottom:12,
        }}>
          {success}
          <button onClick={()=>setSuccess('')} style={{ float:'right', background:'none', border:'none', color:'#4ade80', cursor:'pointer', fontSize:14 }}>×</button>
        </div>
      )}

      {/* Alert list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'20px', fontSize:12, color:'rgba(255,255,255,0.3)' }}>Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div style={{
          textAlign:'center', padding:'32px',
          background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)',
          borderRadius:12,
        }}>
          <Bell size={20} color="rgba(255,255,255,0.15)" style={{ marginBottom:8 }} />
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.25)', margin:0 }}>No alerts yet. Create one to get notified about deals.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 14px',
              background: alert.active ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
              border:`1px solid ${alert.active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius:10, opacity: alert.active ? 1 : 0.6,
            }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#f0ede6' }}>{alert.area}</span>
                  <span style={{ fontSize:10, background:'rgba(255,255,255,0.07)', padding:'1px 6px', borderRadius:4, color:'rgba(255,255,255,0.4)' }}>
                    {alert.price_period === 'sale' ? 'For Sale' : 'For Rent'}
                  </span>
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>
                  Below <strong style={{color:'rgba(255,255,255,0.6)'}}>${alert.max_price.toLocaleString()}</strong> · 10 tokens/mo
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <button onClick={() => toggleAlert(alert.id, alert.active)} style={{
                  background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6,
                  width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', color: alert.active ? '#4ade80' : 'rgba(255,255,255,0.3)',
                }}>
                  {alert.active ? <Bell size={13}/> : <BellOff size={13}/>}
                </button>
                <button onClick={() => deleteAlert(alert.id)} style={{
                  background:'none', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6,
                  width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', color:'rgba(248,113,113,0.5)',
                }}>
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
