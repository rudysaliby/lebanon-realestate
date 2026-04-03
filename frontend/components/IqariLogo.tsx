'use client'
import { useTheme } from '@/components/ThemeContext'

export default function IqariLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const sizes = {
    sm: { icon: 20, text: 15 },
    md: { icon: 26, text: 19 },
    lg: { icon: 36, text: 28 },
  }
  const s = sizes[size]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Icon */}
      <svg width={s.icon} height={s.icon} viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="9" fill="#16a34a"/>
        <path d="M18 5L6 14v17h7v-8h10v8h7V14L18 5z" fill="white" opacity="0.92"/>
        <circle cx="18" cy="17" r="3.5" fill="#4ade80"/>
      </svg>

      {/* Wordmark: IQ green, ARI white/dark */}
      <span style={{
        fontFamily: "'Syne', sans-serif",
        fontWeight: 800,
        fontSize: s.text,
        letterSpacing: '-0.04em',
        lineHeight: 1,
      }}>
        <span style={{ color: '#4ade80' }}>IQ</span>
        <span style={{ color: isDark ? '#f0ede6' : '#111827' }}>ARI</span>
      </span>
    </div>
  )
}
