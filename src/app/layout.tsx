import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth'

export const metadata: Metadata = {
  title: '智能推广平台',
  description: 'AI 驱动的服装推广内容生成系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Free-for-commercial-use webfonts only — all under the SIL Open Font
          License, which explicitly permits embedding and rasterized output
          (PNGs / images produced by the canvas) for any purpose including
          commercial. We deliberately avoid Microsoft / Apple / Founder /
          Hanyi / STC faces to stay clear of the well-known 微软雅黑 / 方正 /
          华文 licensing risks in mainland China.
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&family=Noto+Serif+SC:wght@400;700;900&family=ZCOOL+XiaoWei&family=ZCOOL+QingKe+HuangYou&family=Ma+Shan+Zheng&family=Zhi+Mang+Xing&family=Inter:wght@400;700;900&family=Roboto:wght@400;700;900&family=Montserrat:wght@400;700;900&family=Playfair+Display:wght@400;700;900&family=Lora:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Oswald:wght@400;700&family=Bebas+Neue&family=Pacifico&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
