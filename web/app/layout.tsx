import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KLEOS - GST Invoice Assistant',
  description: 'Your CA in your pocket. Smart GST invoice reconciliation for Indian MSME store owners.',
  themeColor: '#e8432a',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-background">
      <body className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-background via-background to-[#f1e8da]">
        <div className="w-full max-w-[440px] bg-background rounded-2xl shadow-lg">
          {children}
        </div>
      </body>
    </html>
  )
}
