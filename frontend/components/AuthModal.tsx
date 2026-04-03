'use client'
import { useState } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type AuthView = 'signin' | 'signup'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<AuthView>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    setError(''); setLoading(true)
    try {
      if (view === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        })
        if (error) throw error
        setSuccess('Check your email to confirm your account!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  const inp = (label: string, type: string, value: string, onChange: (v:string)=>void, extra?: any) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display:'block', fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:6 }}>{label}</label>
      <div style={{ position:'relative' }}>
        <input
          type={type === 'password' && showPw ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{
            width:'100%', background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.12)', borderRadius:8,
            padding:'10px 14px', fontSize:14, color:'#f0ede6', outline:'none',
            boxSizing:'border-box',
          }}
          {...extra}
        />
        {type === 'password' && (
          <button onClick={() => setShowPw(s=>!s)} style={{
            position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
            background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)',
          }}>
            {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:100,
      fontFamily:"'DM Sans',sans-serif",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:'#111', border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:16, padding:'32px', width:380, position:'relative',
        boxShadow:'0 24px 64px rgba(0,0,0,0.8)',
      }}>
        <button onClick={onClose} style={{
          position:'absolute', top:16, right:16, background:'none', border:'none',
          cursor:'pointer', color:'rgba(255,255,255,0.3)',
        }}><X size={18}/></button>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:8 }}>
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="9" fill="#1a6b3a"/>
              <path d="M18 5L6 14v17h7v-8h10v8h7V14L18 5z" fill="white" opacity="0.9"/>
              <circle cx="18" cy="17" r="3" fill="#4ade80"/>
            </svg>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:'#f0ede6' }}>
              Prop<span style={{color:'#4ade80'}}>IQ</span>
            </span>
          </div>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', margin:0 }}>
            {view === 'signin' ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        {success ? (
          <div style={{ background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:8, padding:'12px 16px', fontSize:13, color:'#4ade80', textAlign:'center' }}>
            {success}
          </div>
        ) : (
          <>
            {/* Google */}
            <button onClick={handleGoogle} style={{
              width:'100%', background:'rgba(255,255,255,0.06)',
              border:'1px solid rgba(255,255,255,0.12)', borderRadius:8,
              padding:'10px', fontSize:14, color:'rgba(255,255,255,0.8)',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              marginBottom:20, fontWeight:500,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }}/>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>or</span>
              <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }}/>
            </div>

            {view === 'signup' && inp('Full name', 'text', name, setName)}
            {inp('Email', 'email', email, setEmail, { autoFocus: true })}
            {inp('Password', 'password', password, setPassword)}

            {error && (
              <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'#f87171', marginBottom:14 }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              width:'100%', background:'#1a6b3a', border:'none', borderRadius:8,
              padding:'12px', fontSize:14, fontWeight:700, color:'#fff',
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
              marginBottom:16,
            }}>
              {loading ? 'Loading...' : view === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            <p style={{ textAlign:'center', fontSize:13, color:'rgba(255,255,255,0.35)' }}>
              {view === 'signin' ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => { setView(v => v==='signin'?'signup':'signin'); setError('') }} style={{
                background:'none', border:'none', color:'#4ade80', fontSize:13, cursor:'pointer', fontWeight:600,
              }}>
                {view === 'signin' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>

            {view === 'signup' && (
              <div style={{
                marginTop:16, padding:'12px 14px',
                background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.15)',
                borderRadius:8,
              }}>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.4)', margin:0, textAlign:'center' }}>
                  Free account includes map access + Insights tab.<br/>
                  <span style={{color:'#4ade80'}}>50 tokens</span> with Explorer · <span style={{color:'#4ade80'}}>200 tokens</span> with Analyst
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
