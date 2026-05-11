'use client'

import { useEffect } from 'react'

export default function AuthCallback() {

  useEffect(() => {
    async function handleCallback() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const savedState = sessionStorage.getItem('bigoffs_state')

      if (!code || state !== savedState) {
        alert('登录失败，请重试')
        window.location.replace('/')
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
        const rawRole = user.role ?? user.userType ?? user.type ?? ''
        const isHQ = typeof rawRole === 'string' && /^(hq|admin|总部|admin.*hq)/i.test(rawRole)
        sessionStorage.setItem('aipp_user', JSON.stringify({
          username: user.username ?? user.userId ?? user.id ?? 'bigoffs_user',
          name: user.nickname ?? user.name ?? user.username ?? 'BigOffs 用户',
          role: isHQ ? 'hq' : 'regional',
          region: user.storeName ?? user.store ?? undefined,
          _bigoffs: true,
        }))
        // Full page reload so AuthProvider re-reads sessionStorage from scratch
        window.location.replace('/')
      } catch {
        alert('登录失败，请重试')
        window.location.replace('/')
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f7' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0034cc', borderTopColor: 'transparent' }} />
        <p className="text-slate-500 text-sm">正在登录，请稍候...</p>
      </div>
    </div>
  )
}
