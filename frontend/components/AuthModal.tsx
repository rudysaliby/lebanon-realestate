'use client'
import { useState } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import IqariLogo from '@/components/IqariLogo'
import { useTheme, T } from '@/components/ThemeContext'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme()
  const t = T[theme]
  const [view, setView]       = useState<'signin'|'signup'>('signin')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]       = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    setError(''); setLoading(true)
    try {
      if (view === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: name } }
        })
        if (error) throw error
        setSuccess('Check your email to confirm your account!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      }
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }

  const inpStyle = {
    width:'100%', background:t.bgCard, border:`1px solid ${t.border}`,
    borderRadius:8, padding:'10px 14px', fontSize:14, color:t.text,
    outline:'none', boxSizing:'border-box' as const,
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
      fontFamily:"'DM Sans',sans-serif",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: theme === 'dark' ? '#111' : '#fff',
        border:`1px solid ${t.border}`,
        borderRadius:16, padding:'32px', width:380, position:'relative',
        boxShadow: t.shadow,
      }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', cursor:'pointer', color:t.textMuted }}>
          <X size={18}/>
        </button>

        <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
          <IqariLogo size="md" />
        </div>
        <p style={{ textAlign:'center', fontSize:13, color:t.textMuted, marginBottom:24 }}>
          {view === 'signin' ? 'Sign in to your account' : 'Create your free account'}
        </p>

        {success ? (
          <div style={{ background:t.accentBg, border:`1px solid ${t.accentBorder}`, borderRadius:8, padding:'12px 16px', fontSize:13, color:t.accent, textAlign:'center' }}>
            {success}
          </div>
        ) : (
          <>
            <button onClick={handleGoogle} style={{
              width:'100%', background:t.bgCard, border:`1px solid ${t.border}`,
              borderRadius:8, padding:'10px', fontSize:14, color:t.text,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              marginBottom:18, fontWeight:500,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
              <div style={{ flex:1, height:1, background:t.border }}/>
              <span style={{ fontSize:11, color:t.textMuted }}>or</span>
              <div style={{ flex:1, height:1, background:t.border }}/>
            </div>

            {view === 'signup' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12, color:t.textMuted, marginBottom:5 }}>Full name</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} style={inpStyle}/>
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, color:t.textMuted, marginBottom:5 }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus style={inpStyle}/>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, color:t.textMuted, marginBottom:5 }}>Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleSubmit()} style={inpStyle}/>
                <button onClick={()=>setShowPw(s=>!s)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:t.textMuted }}>
                  {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'#f87171', marginBottom:14 }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              width:'100%', background:'#16a34a', border:'none', borderRadius:8,
              padding:'12px', fontSize:14, fontWeight:700, color:'#fff',
              cursor:loading?'default':'pointer', opacity:loading?0.7:1, marginBottom:14,
            }}>
              {loading ? 'Loading...' : view==='signin' ? 'Sign In' : 'Create Account'}
            </button>

            <p style={{ textAlign:'center', fontSize:13, color:t.textMuted }}>
              {view==='signin' ? "Don't have an account? " : "Already have an account? "}
              <button onClick={()=>{setView(v=>v==='signin'?'signup':'signin');setError('')}} style={{ background:'none', border:'none', color:t.accent, fontSize:13, cursor:'pointer', fontWeight:600 }}>
                {view==='signin' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>

            {view === 'signup' && (
              <div style={{ marginTop:14, padding:'10px 12px', background:t.accentBg, border:`1px solid ${t.accentBorder}`, borderRadius:8 }}>
                <p style={{ fontSize:11, color:t.textMuted, margin:0, textAlign:'center', lineHeight:1.6 }}>
                  Free includes map + prices.<br/>
                  <span style={{color:t.accent}}>50 tokens/mo</span> with Explorer ·{' '}
                  <span style={{color:'#a78bfa'}}>300 tokens/mo</span> with Analyst<br/>
                  <span style={{color:t.textMuted, fontSize:10}}>Tokens unlock AI analysis · deal alerts · exports</span>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
