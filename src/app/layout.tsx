import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { APP_NAME } from '@/lib/config'
import { AppHeader } from '@/components/layout/app-header'
import { NavBar } from '@/components/layout/nav-bar'
import { Sidebar } from '@/components/layout/sidebar'
import { OfflineBanner } from '@/components/layout/offline-banner'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from '@/components/providers'

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
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
  themeColor: '#1b3358',
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
      <body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>
        <Providers>
          {/* Desktop: persistent left rail. Mobile: hidden (bottom nav instead). */}
          <Sidebar />

          {/* Content column, offset by the sidebar on desktop. */}
          <div className="flex min-h-screen flex-col md:pl-[15rem]">
            <AppHeader />
            <OfflineBanner />
            <div className="flex-1 pb-20 md:pb-10">{children}</div>
          </div>

          {/* Mobile bottom nav. */}
          <NavBar />
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  )
}
