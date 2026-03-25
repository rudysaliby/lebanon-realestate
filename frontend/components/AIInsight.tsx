'use client'
import { useState } from 'react'
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react'

const VERDICT_CONFIG = {
  Buy:   { color: '#4ade80', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  icon: TrendingUp },
  Watch: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', icon: Minus },
  Skip:  { color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  icon: TrendingDown },
}

export default function AIInsight({ listing }: { listing: any }) {
  const [insight, setInsight] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const analyze = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listing),
      })
      const data = await res.json()
      setInsight(data)
      setDone(true)
    } catch {
      setInsight({ error: 'Analysis failed' })
    }
    setLoading(false)
  }

  const verdict = insight?.verdict ? VERDICT_CONFIG[insight.verdict as keyof typeof VERDICT_CONFIG] : null
  const VerdictIcon = verdict?.icon || Minus

  return (
    <div style={{ margin: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
      {!done ? (
        <button
          onClick={analyze}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.15)',
            border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : 'rgba(139,92,246,0.4)'}`,
            borderRadius: 10,
            color: loading ? 'rgba(255,255,255,0.4)' : '#a78bfa',
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.2s',
          }}
        >
          <Sparkles size={14} />
          {loading ? 'Analyzing with AI...' : 'Get AI Analysis'}
        </button>
      ) : insight?.error ? (
        <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>Analysis failed — try again</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Verdict */}
          {verdict && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: verdict.bg, border: `1px solid ${verdict.border}`,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 70 }}>
                <VerdictIcon size={14} color={verdict.color} />
                <span style={{ fontSize: 15, fontWeight: 700, color: verdict.color, fontFamily: "'Syne', sans-serif" }}>
                  {insight.verdict}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                {insight.verdict_reason}
              </span>
            </div>
          )}

          {/* Score */}
          {insight.score && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                AI Score
              </span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${insight.score * 10}%`,
                  background: insight.score >= 7 ? '#4ade80' : insight.score >= 5 ? '#fbbf24' : '#f87171',
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f0ede6', minWidth: 24 }}>
                {insight.score}/10
              </span>
            </div>
          )}

          {/* Fair value */}
          {insight.fair_value_estimate && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>Est. fair value: </span>
              <span style={{ color: '#f0ede6', fontWeight: 500 }}>{insight.fair_value_estimate}</span>
            </div>
          )}

          {/* Strengths */}
          {insight.strengths?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {insight.strengths.map((s: string, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
                  <CheckCircle size={12} color="#4ade80" style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* Red flags */}
          {insight.red_flags?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {insight.red_flags.map((f: string, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
                  <AlertTriangle size={12} color="#f87171" style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
