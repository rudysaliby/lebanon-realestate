import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IQARI — Data-Driven Property Intelligence',
  description: 'Smart property search with market insights, deal finder, and price analytics.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0a0a0a' }}>
        {children}
      </body>
    </html>
  )
}
