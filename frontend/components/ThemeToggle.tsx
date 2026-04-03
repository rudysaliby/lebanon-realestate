'use client'
import { useTheme } from '@/components/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 20,
        padding: '4px 10px 4px 6px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* Sun icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.4)' : '#f59e0b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>

      {/* Toggle pill */}
      <div style={{
        width: 32, height: 18, borderRadius: 9,
        background: isDark ? 'rgba(255,255,255,0.12)' : '#16a34a',
        position: 'relative', transition: 'background 0.25s',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute',
          top: 2, left: isDark ? 2 : 16,
          width: 14, height: 14, borderRadius: '50%',
          background: isDark ? 'rgba(255,255,255,0.5)' : '#fff',
          transition: 'left 0.25s, background 0.25s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}/>
      </div>
    </button>
  )
}
