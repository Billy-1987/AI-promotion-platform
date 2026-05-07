'use client'

import { useState, FormEvent } from 'react'
import { useAuth, TEST_ACCOUNTS } from '@/lib/auth'
import Logo from './Logo'

const BIGOFFS_CLIENT_ID = '4dNDohJceQKcGoKqadkBJiytX5VEO9tm'
const BIGOFFS_AUTHORIZE_URL = 'https://oapi.bigoffs.com/oauth/authorize'

function loginWithBigOffs() {
  const state = crypto.randomUUID()
  sessionStorage.setItem('bigoffs_state', state)
  const params = new URLSearchParams({
    client_id: BIGOFFS_CLIENT_ID,
    redirect_uri: window.location.origin + '/auth/callback',
    response_type: 'code',
    state,
  })
  window.location.href = BIGOFFS_AUTHORIZE_URL + '?' + params
}

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    const ok = login(username.trim(), password)
    if (!ok) setError('用户名或密码错误')
    setLoading(false)
  }

  const hqAccounts = TEST_ACCOUNTS.filter(a => a.role === 'hq')
  const regionalAccounts = TEST_ACCOUNTS.filter(a => a.role === 'regional')

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1b4b 60%, #0a0a1a 100%)',
      }}
    >
      {/* Background accent blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #0034cc 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #fcea42 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

        {/* Left: Branding */}
        <div className="text-center lg:text-left">
          <div className="mb-5">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">智能推广平台</h1>
          <p className="text-slate-400 text-base mb-8">AI 驱动的推广内容生成系统</p>
          <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
            {['运营日历', '模板社区', 'AI 换装', 'AI 图片设计', '我的图库'].map(f => (
              <span
                key={f}
                className="px-3 py-1 text-sm rounded-full border text-slate-300"
                style={{
                  background: 'rgba(0, 52, 204, 0.15)',
                  borderColor: 'rgba(0, 52, 204, 0.4)',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Login form + test accounts */}
        <div className="space-y-4">
          {/* Login card — glassmorphism */}
          <div
            className="rounded-2xl p-8 border"
            style={{
              background: 'rgba(255, 255, 255, 0.07)',
              backdropFilter: 'blur(16px)',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <h2 className="text-xl font-semibold text-white mb-6">登录账号</h2>

            {/* BigOffs 登录按钮 */}
            <button
              type="button"
              onClick={loginWithBigOffs}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 mb-5"
              style={{
                background: '#fcea42',
                color: '#0a0a1a',
                boxShadow: '0 0 20px rgba(252, 234, 66, 0.3)',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 28px rgba(252, 234, 66, 0.5)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 20px rgba(252, 234, 66, 0.3)')}
            >
              <img src="/bigoffs-logo.png" alt="" className="h-4 w-auto" />
              使用 BigOffs 账号登录
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="text-xs text-slate-500">或使用测试账号</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  className="w-full px-4 py-2.5 rounded-lg text-white placeholder-slate-500 focus:outline-none transition-colors"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#0034cc')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)')}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  required
                  className="w-full px-4 py-2.5 rounded-lg text-white placeholder-slate-500 focus:outline-none transition-colors"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#0034cc')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)')}
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 font-semibold rounded-lg transition-all disabled:opacity-50 text-white"
                style={{ background: '#0034cc' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 52, 204, 0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
          </div>

          {/* Test accounts */}
          <div
            className="rounded-2xl p-5 border"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(12px)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: '#fcea42', boxShadow: '0 0 6px rgba(252, 234, 66, 0.5)' }}
              />
              测试账号（点击自动填入）
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-2">总部市场部</p>
                {hqAccounts.map(a => (
                  <button
                    key={a.username}
                    onClick={() => { setUsername(a.username); setPassword(a.password); setError('') }}
                    className="w-full text-left px-3 py-2 rounded-lg transition-colors mb-1.5"
                    style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0, 52, 204, 0.2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                  >
                    <p className="text-sm text-white">{a.name}</p>
                    <p className="text-xs text-slate-400">{a.username} / {a.password}</p>
                  </button>
                ))}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2">区域运营</p>
                {regionalAccounts.map(a => (
                  <button
                    key={a.username}
                    onClick={() => { setUsername(a.username); setPassword(a.password); setError('') }}
                    className="w-full text-left px-3 py-2 rounded-lg transition-colors mb-1.5"
                    style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0, 52, 204, 0.2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                  >
                    <p className="text-sm text-white">{a.name} <span className="text-slate-500 text-xs">{a.region}</span></p>
                    <p className="text-xs text-slate-400">{a.username} / {a.password}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
