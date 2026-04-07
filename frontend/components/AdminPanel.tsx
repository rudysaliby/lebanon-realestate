'use client'
import { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, RefreshCw, Users, MapPin, BarChart2, Coins } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { useTheme, T } from '@/components/ThemeContext'
import IqariLogo from '@/components/IqariLogo'
import { adminUpdateTokens } from '@/lib/tokenActions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Benchmark = {
  id?: string
  area: string
  region: string
  type_group: 'residential' | 'land' | 'commercial'
  price_period: 'sale' | 'monthly'
  median_ppsqm: number
  source: 'manual' | 'computed'
  notes?: string
  updated_at?: string
}

type AdminTab = 'benchmarks' | 'users' | 'stats'

const TYPE_GROUPS = ['residential', 'land', 'commercial'] as const

export default function AdminPanel({ onClose, user }: {
  onClose: () => void
  user: any
}) {
  const { theme } = useTheme()
  const t = T[theme]
  const [activeTab, setActiveTab] = useState<AdminTab>('benchmarks')
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | typeof TYPE_GROUPS[number]>('all')

  // Token management state
  const [tokenUserId, setTokenUserId] = useState<string | null>(null)
  const [tokenAmount, setTokenAmount] = useState('')
  const [tokenAction, setTokenAction] = useState<'add' | 'set' | 'remove'>('add')
  const [tokenSaving, setTokenSaving] = useState(false)
  const [tokenMsg, setTokenMsg] = useState('')

  // New benchmark form
  const [newBM, setNewBM] = useState<Partial<Benchmark>>({
    area: '', region: '', type_group: 'residential', price_period: 'sale', median_ppsqm: 0
  })
  const [addingNew, setAddingNew] = useState(false)
  const [areaList, setAreaList] = useState<{area: string, region: string, subregion: string}[]>([])

  // Fetch distinct areas from listings DB on mount
  useEffect(() => {
    const fetchAreas = async () => {
      const { data } = await supabase
        .from('listings')
        .select('area, region, subregion')
        .not('area', 'is', null)
        .eq('is_active', true)
        .order('area')
      if (data) {
        const seen = new Map<string, {area: string, region: string, subregion: string}>()
        data.forEach((d: any) => {
          if (d.area && !seen.has(d.area)) {
            seen.set(d.area, { area: d.area, region: d.region || '', subregion: d.subregion || '' })
          }
        })
        setAreaList(Array.from(seen.values()).sort((a, b) => a.area.localeCompare(b.area)))
      }
    }
    fetchAreas()
  }, [])

  // When area selected — auto-fill region
  const handleAreaSelect = (areaName: string) => {
    const found = areaList.find(a => a.area === areaName)
    setNewBM(b => ({ ...b, area: areaName, region: found?.region || b?.region || '' }))
  }

  useEffect(() => {
    if (activeTab === 'benchmarks') fetchBenchmarks()
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'stats') fetchStats()
  }, [activeTab])

  const fetchBenchmarks = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('area_benchmarks')
      .select('*')
      .order('area')
    setBenchmarks(data || [])
    setLoading(false)
  }

  const fetchUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  const fetchStats = async () => {
    setLoading(true)
    const { count: listingCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    const { count: userCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    const { data: tierData } = await supabase
      .from('user_profiles')
      .select('tier')

    const tierCounts = tierData?.reduce((acc: any, u: any) => {
      acc[u.tier] = (acc[u.tier] || 0) + 1
      return acc
    }, {})

    const { count: alertCount } = await supabase
      .from('deal_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)

    setStats({ listingCount, userCount, tierCounts, alertCount })
    setLoading(false)
  }

  const saveBenchmark = async (bm: Benchmark) => {
    setSaving(bm.id || 'new')
    const { error } = await supabase
      .from('area_benchmarks')
      .upsert({
        ...bm,
        source: 'manual',
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }, { onConflict: 'area,type_group,price_period' })

    if (!error) {
      await fetchBenchmarks()
    } else {
      alert('Error: ' + error.message)
    }
    setSaving(null)
  }

  const deleteBenchmark = async (id: string) => {
    if (!confirm('Delete this benchmark?')) return
    await supabase.from('area_benchmarks').delete().eq('id', id)
    fetchBenchmarks()
  }

  const updateUserTier = async (userId: string, tier: string) => {
    await supabase.from('user_profiles').update({ tier }).eq('id', userId)
    fetchUsers()
  }

  const handleTokenUpdate = async (targetUserId: string) => {
    const amt = parseInt(tokenAmount)
    if (!amt || amt <= 0) {
      setTokenMsg('Enter a valid amount')
      return
    }
    setTokenSaving(true)
    setTokenMsg('')

    const result = await adminUpdateTokens(user.id, targetUserId, amt, tokenAction)
    if (result.success) {
      setTokenMsg(`Done! New balance: ${result.newBalance} tokens`)
      setTokenAmount('')
      setTokenUserId(null)
      fetchUsers() // refresh the user list
    } else {
      setTokenMsg(result.error || 'Failed')
    }
    setTokenSaving(false)
    setTimeout(() => setTokenMsg(''), 4000)
  }

  const addBenchmark = async () => {
    if (!newBM.area || !newBM.median_ppsqm) return
    await saveBenchmark(newBM as Benchmark)
    setNewBM({ area: '', region: '', type_group: 'residential', price_period: 'sale', median_ppsqm: 0 })
    setAreaSearch('')
    setAddingNew(false)
  }

  // Searchable area dropdown
  const [areaSearch, setAreaSearch] = useState('')
  const [showAreaDrop, setShowAreaDrop] = useState(false)
  const filteredAreas = areaList.filter(a =>
    a.area.toLowerCase().includes(areaSearch.toLowerCase())
  ).slice(0, 30)

  const filtered = filter === 'all' ? benchmarks : benchmarks.filter(b => b.type_group === filter)

  const inp = (value: any, onChange: (v: any) => void, type = 'text', placeholder = '') => (
    <input
      type={type}
      value={value}
      onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={placeholder}
      style={{
        background: t.bgCard, border: `1px solid ${t.border}`,
        borderRadius: 6, padding: '5px 8px', fontSize: 12, color: t.text,
        outline: 'none', width: '100%',
      }}
    />
  )

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 300, overflowY: 'auto', padding: '20px 16px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 960,
        background: theme === 'dark' ? '#0f0f0f' : '#fff',
        border: `1px solid ${t.border}`,
        borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: theme === 'dark' ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IqariLogo size="sm" />
            <div style={{ width: 1, height: 18, background: t.border }} />
            <span style={{
              fontSize: 12, fontWeight: 700, color: '#f59e0b',
              background: 'rgba(245,158,11,0.15)', padding: '3px 10px', borderRadius: 20,
              letterSpacing: '0.05em',
            }}>★ ADMIN PANEL</span>
          </div>
          <button onClick={onClose} style={{
            background: t.bgCard, border: `1px solid ${t.border}`,
            borderRadius: 8, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: t.textMuted,
          }}><X size={16}/></button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 2, padding: '12px 28px 0',
          borderBottom: `1px solid ${t.border}`,
        }}>
          {[
            { id: 'benchmarks' as AdminTab, label: 'Price Benchmarks', icon: <MapPin size={13}/> },
            { id: 'users'      as AdminTab, label: 'Users & Tokens',   icon: <Users size={13}/> },
            { id: 'stats'      as AdminTab, label: 'Stats',            icon: <BarChart2 size={13}/> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: '8px 8px 0 0',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: activeTab === tab.id
                ? theme === 'dark' ? '#1a1a1a' : '#f5f5f5'
                : 'transparent',
              color: activeTab === tab.id ? '#f59e0b' : t.textMuted,
              borderBottom: activeTab === tab.id ? `2px solid #f59e0b` : '2px solid transparent',
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '24px 28px', minHeight: 400 }}>

          {/* BENCHMARKS TAB */}
          {activeTab === 'benchmarks' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>
                    Manual Price Benchmarks
                  </h3>
                  <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>
                    Set median $/m² per area. Used when &lt;5 listings exist in DB for that area.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={fetchBenchmarks} style={{
                    background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 7,
                    padding: '6px 10px', cursor: 'pointer', color: t.textMuted,
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12,
                  }}><RefreshCw size={12}/> Refresh</button>
                  <button onClick={() => setAddingNew(a => !a)} style={{
                    background: '#f59e0b', border: 'none', borderRadius: 7,
                    padding: '6px 14px', cursor: 'pointer', color: '#000',
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
                  }}><Plus size={12}/> Add Area</button>
                </div>
              </div>

              {/* Type filter */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {(['all', ...TYPE_GROUPS] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: filter === f ? '#f59e0b' : t.bgCard,
                    color: filter === f ? '#000' : t.textMuted,
                  }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
                ))}
              </div>

              {/* Add new form */}
              {addingNew && (
                <div style={{
                  background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 10, padding: '16px', marginBottom: 16,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <div style={{ position: 'relative' }}>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>Area name</label>
                      <input
                        value={areaSearch || newBM.area || ''}
                        onChange={e => { setAreaSearch(e.target.value); setShowAreaDrop(true) }}
                        onFocus={() => setShowAreaDrop(true)}
                        onBlur={() => setTimeout(() => setShowAreaDrop(false), 150)}
                        placeholder="Search area..."
                        style={{
                          background: t.bgCard, border: `1px solid ${newBM.area ? t.accentBorder : t.border}`,
                          borderRadius: 6, padding: '5px 8px', fontSize: 12, color: t.text,
                          outline: 'none', width: '100%', boxSizing: 'border-box',
                        }}
                      />
                      {showAreaDrop && filteredAreas.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                          background: theme === 'dark' ? '#1a1a1a' : '#fff',
                          border: `1px solid ${t.border}`, borderRadius: 8,
                          maxHeight: 200, overflowY: 'auto',
                          boxShadow: t.shadow, marginTop: 2,
                        }}>
                          {filteredAreas.map(a => (
                            <div
                              key={a.area}
                              onMouseDown={() => {
                                handleAreaSelect(a.area)
                                setAreaSearch('')
                                setShowAreaDrop(false)
                              }}
                              style={{
                                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                                borderBottom: `1px solid ${t.border}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = t.bgCardHover}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                              <span style={{ fontWeight: 600, color: t.text }}>{a.area}</span>
                              <span style={{ fontSize: 10, color: t.textMuted }}>{a.region}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>Region (auto)</label>
                      <input
                        value={newBM.region || ''}
                        readOnly
                        style={{
                          background: t.bgCard, border: `1px solid ${t.border}`,
                          borderRadius: 6, padding: '5px 8px', fontSize: 12,
                          color: t.textMuted, outline: 'none', width: '100%',
                          boxSizing: 'border-box', cursor: 'default',
                        }}
                        placeholder="Auto-filled"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>Type</label>
                      <select value={newBM.type_group} onChange={e => setNewBM(b => ({...b, type_group: e.target.value as any}))} style={{
                        background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 6,
                        padding: '5px 8px', fontSize: 12, color: t.text, outline: 'none', width: '100%',
                      }}>
                        {TYPE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>Period</label>
                      <select value={newBM.price_period} onChange={e => setNewBM(b => ({...b, price_period: e.target.value as any}))} style={{
                        background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 6,
                        padding: '5px 8px', fontSize: 12, color: t.text, outline: 'none', width: '100%',
                      }}>
                        <option value="sale">Sale</option>
                        <option value="monthly">Rent</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: t.textMuted, display: 'block', marginBottom: 4 }}>$/m²</label>
                      {inp(newBM.median_ppsqm, v => setNewBM(b => ({...b, median_ppsqm: v})), 'number', '2500')}
                    </div>
                    <button onClick={addBenchmark} disabled={saving === 'new'} style={{
                      background: '#f59e0b', border: 'none', borderRadius: 7,
                      padding: '7px 14px', cursor: 'pointer', color: '#000',
                      fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                    }}>
                      {saving === 'new' ? '...' : '+ Save'}
                    </button>
                  </div>
                </div>
              )}

              {/* Benchmarks table */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: t.textMuted, fontSize: 13 }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '40px 0',
                  border: `1px dashed ${t.border}`, borderRadius: 10,
                  color: t.textMuted, fontSize: 13,
                }}>
                  No benchmarks yet. Click "+ Add Area" to set manual price data.
                </div>
              ) : (
                <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {/* Table header */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr auto',
                    padding: '10px 14px', background: t.bgCard,
                    borderBottom: `1px solid ${t.border}`,
                    fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    <span>Area</span>
                    <span>Region</span>
                    <span>Type</span>
                    <span>Period</span>
                    <span>$/m²</span>
                    <span>Source</span>
                    <span></span>
                  </div>

                  {filtered.map((bm, i) => (
                    <BenchmarkRow
                      key={bm.id}
                      bm={bm}
                      t={t}
                      theme={theme}
                      onSave={saveBenchmark}
                      onDelete={() => deleteBenchmark(bm.id!)}
                      saving={saving === bm.id}
                      isLast={i === filtered.length - 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* USERS & TOKENS TAB */}
          {activeTab === 'users' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: t.text, margin: '0 0 4px' }}>
                  User Management & Tokens
                </h3>
                <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>
                  {users.length} users registered. Click the token icon to add/set/remove tokens.
                </p>
              </div>

              {/* Token update success/error message */}
              {tokenMsg && (
                <div style={{
                  marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 12,
                  background: tokenMsg.startsWith('Done') ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                  border: `1px solid ${tokenMsg.startsWith('Done') ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                  color: tokenMsg.startsWith('Done') ? '#4ade80' : '#f87171',
                }}>
                  {tokenMsg}
                </div>
              )}

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: t.textMuted }}>Loading...</div>
              ) : (
                <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 0.8fr',
                    padding: '10px 14px', background: t.bgCard,
                    borderBottom: `1px solid ${t.border}`,
                    fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    <span>Email</span>
                    <span>Tier</span>
                    <span>Tokens</span>
                    <span>Joined</span>
                    <span>Actions</span>
                  </div>
                  {users.map((u, i) => {
                    const TIER_COLORS: Record<string, string> = {
                      free: '#6b7280', explorer: '#4ade80', analyst: '#a78bfa', admin: '#f59e0b'
                    }
                    const isEditing = tokenUserId === u.id
                    return (
                      <div key={u.id}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 0.8fr',
                          padding: '10px 14px', alignItems: 'center',
                          borderBottom: (i < users.length - 1 && !isEditing) ? `1px solid ${t.border}` : 'none',
                          background: u.email === 'rudysaliby@hotmail.com'
                            ? 'rgba(245,158,11,0.04)' : 'transparent',
                        }}>
                          <span style={{ fontSize: 12, color: t.text }}>{u.email}</span>
                          <div>
                            <select
                              value={u.tier || 'free'}
                              onChange={e => updateUserTier(u.id, e.target.value)}
                              style={{
                                background: t.bgCard, border: `1px solid ${t.border}`,
                                borderRadius: 5, padding: '3px 6px', fontSize: 11,
                                color: TIER_COLORS[u.tier || 'free'], fontWeight: 600, cursor: 'pointer',
                              }}>
                              {['free','explorer','analyst','admin'].map(tier => (
                                <option key={tier} value={tier}>{tier}</option>
                              ))}
                            </select>
                          </div>
                          <span style={{ fontSize: 12, color: t.text, fontWeight: 600 }}>
                            {(u.tokens || 0).toLocaleString()}
                          </span>
                          <span style={{ fontSize: 11, color: t.textMuted }}>
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                          </span>
                          <div>
                            <button
                              onClick={() => {
                                setTokenUserId(isEditing ? null : u.id)
                                setTokenAmount('')
                                setTokenAction('add')
                              }}
                              style={{
                                background: isEditing ? '#f59e0b' : 'rgba(245,158,11,0.1)',
                                border: `1px solid ${isEditing ? '#f59e0b' : 'rgba(245,158,11,0.25)'}`,
                                borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: 11, fontWeight: 600,
                                color: isEditing ? '#000' : '#f59e0b',
                              }}
                            >
                              <Coins size={11}/> {isEditing ? 'Cancel' : 'Tokens'}
                            </button>
                          </div>
                        </div>

                        {/* Inline token edit form */}
                        {isEditing && (
                          <div style={{
                            padding: '12px 14px 14px', borderBottom: `1px solid ${t.border}`,
                            background: 'rgba(245,158,11,0.03)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap' }}>
                                Manage tokens for <strong style={{ color: t.text }}>{u.email}</strong>
                              </span>
                              <select
                                value={tokenAction}
                                onChange={e => setTokenAction(e.target.value as any)}
                                style={{
                                  background: t.bgCard, border: `1px solid ${t.border}`,
                                  borderRadius: 5, padding: '4px 8px', fontSize: 11, color: t.text,
                                }}
                              >
                                <option value="add">Add</option>
                                <option value="set">Set to</option>
                                <option value="remove">Remove</option>
                              </select>
                              <input
                                type="number"
                                value={tokenAmount}
                                onChange={e => setTokenAmount(e.target.value)}
                                placeholder="Amount"
                                style={{
                                  background: t.bgCard, border: `1px solid ${t.border}`,
                                  borderRadius: 5, padding: '4px 8px', fontSize: 12, color: t.text,
                                  outline: 'none', width: 90,
                                }}
                              />
                              <button
                                onClick={() => handleTokenUpdate(u.id)}
                                disabled={tokenSaving || !tokenAmount}
                                style={{
                                  background: '#f59e0b', border: 'none', borderRadius: 6,
                                  padding: '5px 14px', fontSize: 11, fontWeight: 700,
                                  color: '#000', cursor: tokenSaving ? 'wait' : 'pointer',
                                  opacity: tokenSaving || !tokenAmount ? 0.6 : 1,
                                }}
                              >
                                {tokenSaving ? '...' : 'Apply'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: t.text, margin: '0 0 20px' }}>
                Platform Overview
              </h3>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: t.textMuted }}>Loading...</div>
              ) : stats && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                      { label: 'Total Listings', value: stats.listingCount?.toLocaleString() || 0, icon: '🏠' },
                      { label: 'Registered Users', value: stats.userCount || 0, icon: '👤' },
                      { label: 'Active Alerts', value: stats.alertCount || 0, icon: '🔔' },
                      { label: 'Paying Users', value: (stats.tierCounts?.explorer || 0) + (stats.tierCounts?.analyst || 0), icon: '💳' },
                    ].map(({ label, value, icon }) => (
                      <div key={label} style={{
                        background: t.bgCard, border: `1px solid ${t.border}`,
                        borderRadius: 12, padding: '16px 18px',
                      }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: t.text }}>{value}</div>
                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Tier breakdown */}
                  <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 20px' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: '0 0 14px' }}>Users by Tier</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { tier: 'admin',    color: '#f59e0b' },
                        { tier: 'analyst',  color: '#a78bfa' },
                        { tier: 'explorer', color: '#4ade80' },
                        { tier: 'free',     color: '#6b7280' },
                      ].map(({ tier, color }) => {
                        const count = stats.tierCounts?.[tier] || 0
                        const total = stats.userCount || 1
                        const pct = Math.round((count / total) * 100)
                        return (
                          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, color: t.textSub, width: 70, textAlign: 'right', textTransform: 'capitalize' }}>{tier}</span>
                            <div style={{ flex: 1, height: 20, background: `${color}20`, borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, minWidth: pct > 0 ? 30 : 0, height: '100%', background: color, borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                                {pct > 5 && <span style={{ fontSize: 10, fontWeight: 700, color: '#000' }}>{count}</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 11, color: t.textMuted, width: 30 }}>{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Inline editable benchmark row
function BenchmarkRow({ bm, t, theme, onSave, onDelete, saving, isLast }: any) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(bm.median_ppsqm)

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr auto',
      padding: '10px 14px', alignItems: 'center',
      borderBottom: isLast ? 'none' : `1px solid ${t.border}`,
      transition: 'background 0.15s',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = t.bgCardHover}
    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{bm.area}</span>
      <span style={{ fontSize: 12, color: t.textSub }}>{bm.region}</span>
      <span style={{
        fontSize: 10, fontWeight: 700,
        color: bm.type_group === 'residential' ? '#4ade80' : bm.type_group === 'land' ? '#facc15' : '#60a5fa',
        background: bm.type_group === 'residential' ? 'rgba(74,222,128,0.1)' : bm.type_group === 'land' ? 'rgba(250,204,21,0.1)' : 'rgba(96,165,250,0.1)',
        padding: '2px 7px', borderRadius: 4, textTransform: 'capitalize',
      }}>{bm.type_group}</span>
      <span style={{
        fontSize: 10, fontWeight: 700,
        color: bm.price_period === 'sale' ? '#4ade80' : '#fb923c',
        background: bm.price_period === 'sale' ? 'rgba(74,222,128,0.1)' : 'rgba(251,146,60,0.1)',
        padding: '2px 7px', borderRadius: 4,
      }}>{bm.price_period === 'sale' ? 'Sale' : 'Rent'}</span>

      {/* Editable price */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {editing ? (
          <input
            type="number"
            value={val}
            onChange={e => setVal(Number(e.target.value))}
            onKeyDown={e => {
              if (e.key === 'Enter') { onSave({...bm, median_ppsqm: val}); setEditing(false) }
              if (e.key === 'Escape') { setVal(bm.median_ppsqm); setEditing(false) }
            }}
            autoFocus
            style={{
              background: t.bgCard, border: `1px solid ${t.accentBorder}`,
              borderRadius: 5, padding: '3px 7px', fontSize: 12, color: t.text,
              outline: 'none', width: 80,
            }}
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            style={{ fontSize: 12, fontWeight: 600, color: t.text, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
            title="Click to edit">
            ${val.toLocaleString()}
          </span>
        )}
        {editing && (
          <button onClick={() => { onSave({...bm, median_ppsqm: val}); setEditing(false) }} style={{
            background: '#16a34a', border: 'none', borderRadius: 4,
            padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer',
          }}>
            {saving ? '...' : <Save size={10}/>}
          </button>
        )}
      </div>

      <span style={{
        fontSize: 10, color: bm.source === 'manual' ? '#f59e0b' : t.textMuted,
        background: bm.source === 'manual' ? 'rgba(245,158,11,0.1)' : t.bgCard,
        padding: '2px 6px', borderRadius: 4, fontWeight: 600,
      }}>{bm.source}</span>

      <button onClick={onDelete} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'rgba(248,113,113,0.4)', padding: 4, borderRadius: 4,
        display: 'flex', alignItems: 'center',
      }}>
        <Trash2 size={12}/>
      </button>
    </div>
  )
}
