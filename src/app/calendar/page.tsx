'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import Logo from '@/components/Logo'
import AuthGuard from '@/components/AuthGuard'

interface BrandEntry { name: string; count: number }
interface WeekEntry {
  week: string
  month: number
  title: string
  brands: BrandEntry[]
}
interface CalendarMeta {
  uploaded: boolean
  filename?: string
  uploadedAt?: string
  summary?: WeekEntry[]
}

function CalendarContent() {
  const { user, logout } = useAuth()
  const [meta, setMeta] = useState<CalendarMeta | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isHQ = user?.role === 'hq'
  const ROLE_LABEL: Record<string, string> = { hq: '总部市场部', regional: '区域运营' }

  useEffect(() => { fetchMeta() }, [])

  async function fetchMeta() {
    const res = await fetch('/api/calendar')
    const data = await res.json()
    setMeta(data)
  }

  async function uploadFile(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) {
      setUploadMsg('请选择 Excel 文件（.xlsx 或 .xls）')
      return
    }
    setUploading(true)
    setUploadMsg('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/calendar', { method: 'POST', body: fd })
    if (res.ok) {
      setUploadMsg('✓ 上传成功')
      await fetchMeta()
    } else {
      setUploadMsg('上传失败，请重试')
    }
    setUploading(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  async function handleDownload() {
    const res = await fetch('/api/calendar/download')
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = meta?.filename ?? 'calendar.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-lg font-bold text-white">智能推广平台</h1>
            <p className="text-xs text-zinc-400">运营日历</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-zinc-700">
            <div className="text-right">
              <p className="text-sm text-white font-medium">{user.name}</p>
              <p className="text-xs text-zinc-400">{ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
              {user.name[0]}
            </div>
            <button onClick={logout} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800">退出</button>
          </div>
        )}
      </header>

      <nav className="border-b border-zinc-800 px-6 flex gap-1">
        {[
          { label: '运营日历', href: '/calendar', icon: '📅', active: true },
          { label: '模板社区', href: '/templates', icon: '🎨' },
          { label: 'AI 换装', href: '/tryon', icon: '👗' },
          { label: 'AI 图片设计', href: '/image-design', icon: '✨' },
          { label: '我的图库', href: '/gallery', icon: '🖼️' },
        ].map(item => (
          <a
            key={item.label}
            href={item.href}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              item.active
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">运营日历</h2>
            {meta?.uploadedAt && (
              <p className="text-xs text-zinc-500 mt-1">
                最近更新：{new Date(meta.uploadedAt).toLocaleString('zh-CN')}
                {meta.filename && <span className="ml-2 text-zinc-600">· {meta.filename}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isHQ && (
              <>
                <input ref={fileRef} type="file" onChange={handleFileInput} className="hidden" />
                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  className="contents"
                >
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className={`px-4 py-2 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${dragging ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                  >
                    {uploading
                      ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />上传中...</>
                      : <>⬆ 上传运营日历</>}
                  </button>
                </div>
                {uploadMsg && (
                  <span className={`text-sm ${uploadMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {uploadMsg}
                  </span>
                )}
              </>
            )}
            {meta?.uploaded && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                ⬇ 下载原始文件
              </button>
            )}
          </div>
        </div>

        {!meta?.uploaded ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-base">暂无运营日历</p>
            {isHQ && (
              <>
                <p className="text-sm mt-1 mb-6">拖拽 Excel 文件到下方区域，或点击选择文件</p>
                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onClick={() => fileRef.current?.click()}
                  className={`w-full max-w-md border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                    dragging ? 'border-indigo-400 bg-indigo-900/20' : 'border-zinc-600 hover:border-zinc-400'
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-zinc-300 text-sm">正在解析文件...</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-4xl mb-3">📂</div>
                      <p className="text-zinc-300 font-medium">拖拽 Excel 文件到此处</p>
                      <p className="text-zinc-500 text-sm mt-1">或点击选择文件 · 支持 .xlsx / .xls</p>
                    </>
                  )}
                </div>
                {uploadMsg && (
                  <p className={`mt-3 text-sm ${uploadMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {uploadMsg}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {meta.summary?.map((entry) => (
              <WeekCard key={entry.week} entry={entry} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

const BRAND_COLORS = [
  { bg: 'bg-indigo-900/50', border: 'border-indigo-700', text: 'text-indigo-200', badge: 'bg-indigo-700 text-indigo-100' },
  { bg: 'bg-emerald-900/50', border: 'border-emerald-700', text: 'text-emerald-200', badge: 'bg-emerald-700 text-emerald-100' },
  { bg: 'bg-amber-900/50', border: 'border-amber-700', text: 'text-amber-200', badge: 'bg-amber-700 text-amber-100' },
  { bg: 'bg-rose-900/50', border: 'border-rose-700', text: 'text-rose-200', badge: 'bg-rose-700 text-rose-100' },
  { bg: 'bg-sky-900/50', border: 'border-sky-700', text: 'text-sky-200', badge: 'bg-sky-700 text-sky-100' },
  { bg: 'bg-violet-900/50', border: 'border-violet-700', text: 'text-violet-200', badge: 'bg-violet-700 text-violet-100' },
  { bg: 'bg-orange-900/50', border: 'border-orange-700', text: 'text-orange-200', badge: 'bg-orange-700 text-orange-100' },
  { bg: 'bg-teal-900/50', border: 'border-teal-700', text: 'text-teal-200', badge: 'bg-teal-700 text-teal-100' },
  { bg: 'bg-pink-900/50', border: 'border-pink-700', text: 'text-pink-200', badge: 'bg-pink-700 text-pink-100' },
  { bg: 'bg-cyan-900/50', border: 'border-cyan-700', text: 'text-cyan-200', badge: 'bg-cyan-700 text-cyan-100' },
  { bg: 'bg-lime-900/50', border: 'border-lime-700', text: 'text-lime-200', badge: 'bg-lime-700 text-lime-100' },
  { bg: 'bg-fuchsia-900/50', border: 'border-fuchsia-700', text: 'text-fuchsia-200', badge: 'bg-fuchsia-700 text-fuchsia-100' },
]

function WeekCard({ entry }: { entry: WeekEntry }) {
  return (
    <div className="bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-700">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-700">
        <span className="px-3 py-1 bg-indigo-600 text-white text-sm font-bold rounded-lg">{entry.week}</span>
        <span className="text-zinc-400 text-sm">{entry.month} 月</span>
        <span className="text-white font-semibold text-base flex-1">{entry.title}</span>
        <span className="text-zinc-500 text-sm">{entry.brands.length} 个品牌 · {entry.brands.reduce((s, b) => s + b.count, 0)} 款</span>
      </div>
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {entry.brands.map((b, i) => {
          const c = BRAND_COLORS[i % BRAND_COLORS.length]
          return (
            <div key={b.name} className={`flex items-center justify-between ${c.bg} border ${c.border} rounded-lg px-3 py-2`}>
              <span className={`text-sm font-medium truncate ${c.text}`}>{b.name}</span>
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded shrink-0 ${c.badge}`}>{b.count} 款</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  return <AuthGuard><CalendarContent /></AuthGuard>
}
