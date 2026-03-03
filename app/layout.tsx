import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NullPoint - Zero Trust LLM Security',
  description: 'Tactical AI Security Desktop App',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-nullpoint-bg text-nullpoint-text font-mono">
        {children}
      </body>
    </html>
  )
}
