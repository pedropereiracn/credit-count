import type { Metadata } from 'next'
import { Fredoka, Nunito } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { AppHeader } from '@/components/app-header'
import './globals.css'


const fredoka = Fredoka({
  variable: '--font-fredoka',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
})

export const metadata: Metadata = {
  title: {
    default: 'Credit Count',
    template: '%s · Credit Count',
  },
  description:
    'Track the rollercoasters you have ridden. Log every ride, watch your credits and stats grow, and appear on the public leaderboard only if you choose to.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} ${nunito.variable} min-h-dvh antialiased`}>
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
