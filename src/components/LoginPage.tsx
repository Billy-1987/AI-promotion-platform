'use client'

import { useState, FormEvent } from 'react'
import { useAuth, TEST_ACCOUNTS } from '@/lib/auth'
import Logo from './Logo'

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
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

        {/* Left: Branding */}
        <div className="text-center lg:text-left">
          <div className="text-5xl mb-4"><Logo size="lg" /></div>
          <h1 className="text-3xl font-bold text-white mb-2">智能推广平台</h1>
          <p className="text-zinc-400 text-base mb-6">AI 驱动的推广内容生成系统</p>
          <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
            {['运营日历', 'AI 换装', '背景替换', '模板社区', '图库管理'].map(f => (
              <span key={f} className="px-3 py-1 bg-indigo-900/40 text-indigo-300 text-sm rounded-full border border-indigo-800/50">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Login form + test accounts */}
        <div className="space-y-4">
          {/* Login card */}
          <div className="bg-zinc-800 rounded-2xl p-8 border border-zinc-700">
            <h2 className="text-xl font-semibold text-white mb-6">登录账号</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  className="w-full px-4 py-2.5 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  required
                  className="w-full px-4 py-2.5 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
          </div>

          {/* Test accounts */}
          <div className="bg-zinc-800/60 rounded-2xl p-5 border border-zinc-700/50">
            <p className="text-xs text-zinc-500 mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full inline-block"></span>
              测试账号（点击自动填入）
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-zinc-500 mb-2">总部市场部</p>
                {hqAccounts.map(a => (
                  <button
                    key={a.username}
                    onClick={() => { setUsername(a.username); setPassword(a.password); setError('') }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 transition-colors mb-1.5"
                  >
                    <p className="text-sm text-white">{a.name}</p>
                    <p className="text-xs text-zinc-400">{a.username} / {a.password}</p>
                  </button>
                ))}
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-2">区域运营</p>
                {regionalAccounts.map(a => (
                  <button
                    key={a.username}
                    onClick={() => { setUsername(a.username); setPassword(a.password); setError('') }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 transition-colors mb-1.5"
                  >
                    <p className="text-sm text-white">{a.name} <span className="text-zinc-500 text-xs">{a.region}</span></p>
                    <p className="text-xs text-zinc-400">{a.username} / {a.password}</p>
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
