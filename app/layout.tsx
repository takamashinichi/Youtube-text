import type { Metadata } from 'next'
import '../src/app/globals.css'

export const metadata: Metadata = {
  title: 'YouTube Text - 字幕取得・要約ツール',
  description: 'YouTubeの動画から字幕を取得し、AIで要約、テキスト変換するツール',
  authors: [{ name: 'Takama Shinichi' }],
  keywords: ['YouTube', '字幕', '要約', 'AI', 'テキスト変換'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="scroll-smooth">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  )
} 