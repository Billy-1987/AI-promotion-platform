'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    async function handleCallback() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const savedState = sessionStorage.getItem('bigoffs_state')

      if (!code || state !== savedState) {
        alert('登录失败，请重试')
        router.replace('/')
        return
      }

      try {
        const res = await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirect_uri: window.location.origin + '/auth/callback',
          }),
        })
        if (!res.ok) throw new Error('exchange failed')
        const user = await res.json()
        sessionStorage.removeItem('bigoffs_state')
        sessionStorage.setItem('aipp_user', JSON.stringify({
          username: user.username ?? user.userId ?? user.id ?? 'bigoffs_user',
          name: user.nickname ?? user.name ?? user.username ?? 'BigOffs 用户',
          role: 'regional',
          region: user.storeName ?? user.store ?? undefined,
          _bigoffs: true,
        }))
        router.replace('/')
      } catch {
        alert('登录失败，请重试')
        router.replace('/')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f7' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0034cc', borderTopColor: 'transparent' }} />
        <p className="text-slate-500 text-sm">正在登录，请稍候...</p>
      </div>
    </div>
  )
}
