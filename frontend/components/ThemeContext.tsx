'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
}>({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('iqari-theme') as Theme
    if (saved) setTheme(saved)
  }, [])

  const toggle = () => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('iqari-theme', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <div data-theme={theme} style={{ height: '100%' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

// Theme tokens
export const T = {
  dark: {
    bg:          '#0a0a0a',
    bgPanel:     '#0f0f0f',
    bgCard:      'rgba(255,255,255,0.04)',
    bgCardHover: 'rgba(255,255,255,0.07)',
    border:      'rgba(255,255,255,0.08)',
    borderHover: 'rgba(255,255,255,0.15)',
    text:        '#f0ede6',
    textSub:     'rgba(255,255,255,0.5)',
    textMuted:   'rgba(255,255,255,0.25)',
    accent:      '#4ade80',
    accentBg:    'rgba(74,222,128,0.1)',
    accentBorder:'rgba(74,222,128,0.25)',
    mapStyle:    'mapbox://styles/mapbox/dark-v11',
    shadow:      '0 8px 32px rgba(0,0,0,0.6)',
  },
  light: {
    bg:          '#f8f9fa',
    bgPanel:     '#ffffff',
    bgCard:      'rgba(0,0,0,0.03)',
    bgCardHover: 'rgba(0,0,0,0.06)',
    border:      'rgba(0,0,0,0.08)',
    borderHover: 'rgba(0,0,0,0.18)',
    text:        '#111827',
    textSub:     'rgba(0,0,0,0.55)',
    textMuted:   'rgba(0,0,0,0.3)',
    accent:      '#16a34a',
    accentBg:    'rgba(22,163,74,0.08)',
    accentBorder:'rgba(22,163,74,0.25)',
    mapStyle:    'mapbox://styles/mapbox/light-v11',
    shadow:      '0 8px 32px rgba(0,0,0,0.12)',
  },
}
