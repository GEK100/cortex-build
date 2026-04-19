import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { APP_NAME } from '@/lib/config'
import { AppHeader } from '@/components/layout/app-header'
import { NavBar } from '@/components/layout/nav-bar'
import { OfflineBanner } from '@/components/layout/offline-banner'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from '@/components/providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Construction project intelligence',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
}

export const viewport: Viewport = {
  themeColor: '#3D4A5C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-GB">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <AppHeader />
          <OfflineBanner />
          <div className="pt-12 pb-14">{children}</div>
          <NavBar />
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  )
}
