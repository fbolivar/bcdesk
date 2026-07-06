import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HexDesk — Portal de Soporte',
  description: 'Help desk y gestión de clientes para BC Fabric SAS',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HexDesk',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#EEF1F6',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  )
}
