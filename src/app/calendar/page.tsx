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
interface BrandRow {
  week: string
  month: number
  weekTitle: string
  brand: string
  [key: string]: unknown
}
interface CalendarMeta {
  uploaded: boolean
  filename?: string
  uploadedAt?: string
  summary?: WeekEntry[]
  allRows?: BrandRow[]
  headers?: string[] // Excel 第5列起的真实表头
}

function CalendarContent() {
  const { user, logout } = useAuth()
  const [meta, setMeta] = useState<CalendarMeta | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [dragging, setDragging] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isHQ = user?.role === 'hq'
  const ROLE_LABEL: Record<string, string> = { hq: '总部市场部', regional: '区域运营' }

  const brandRows = selectedBrand
    ? (meta?.allRows ?? []).filter(r => r.brand === selectedBrand)
    : []

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

  const currentWeek = getCurrentWeek()

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f7' }}>
      <header className="bigoffs-header px-6 flex items-center justify-between" style={{ height: 60 }}>
        <div className="flex items-center gap-4">
          <Logo />
          <div>
            <h1 className="text-base font-bold text-white">智能推广平台</h1>
            <p className="text-xs text-slate-400">运营日历</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right">
              <p className="text-sm text-white font-medium">{user.name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}</p>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: '#0034cc' }}>
              {user.name[0]}
            </div>
            <button onClick={logout} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors">退出</button>
          </div>
        )}
      </header>

      <nav className="bigoffs-header border-b border-white/10 px-6 flex gap-1">
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
                ? 'text-white'
                : 'border-transparent text-slate-400 hover:text-white hover:border-white/30'
            }`}
            style={item.active ? { borderBottomColor: '#fcea42', color: '#fcea42' } : {}}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* 品牌详情视图 */}
        {selectedBrand ? (
          <BrandDetail
            brand={selectedBrand}
            rows={brandRows}
            headers={meta?.headers ?? []}
            onBack={() => setSelectedBrand(null)}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">运营日历</h2>
                {meta?.uploadedAt && (
                  <p className="text-xs text-slate-400 mt-1">
                    最近更新：{new Date(meta.uploadedAt).toLocaleString('zh-CN')}
                    {meta.filename && <span className="ml-2 text-slate-300">· {meta.filename}</span>}
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
                        className="px-4 py-2 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                        style={{ background: dragging ? '#0045ff' : '#0034cc' }}
                      >
                        {uploading
                          ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />上传中...</>
                          : <>⬆ 上传运营日历</>}
                      </button>
                    </div>
                    {uploadMsg && (
                      <span className={`text-sm ${uploadMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
                        {uploadMsg}
                      </span>
                    )}
                  </>
                )}
                {meta?.uploaded && (
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                  >
                    ⬇ 下载原始文件
                  </button>
                )}
              </div>
            </div>

            {!meta?.uploaded ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-base text-slate-700 font-medium">暂无运营日历</p>
                {isHQ && (
                  <>
                    <p className="text-sm mt-1 mb-6 text-slate-500">拖拽 Excel 文件到下方区域，或点击选择文件</p>
                    <div
                      onDrop={handleDrop}
                      onDragOver={e => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onClick={() => fileRef.current?.click()}
                      className={`w-full max-w-md border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all glass-card ${
                        dragging ? 'border-blue-400 shadow-lg' : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-3">
                          <span className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0034cc', borderTopColor: 'transparent' }} />
                          <p className="text-slate-700 text-sm">正在解析文件...</p>
                        </div>
                      ) : (
                        <>
                          <div className="text-4xl mb-3">📂</div>
                          <p className="text-slate-700 font-medium">拖拽 Excel 文件到此处</p>
                          <p className="text-slate-500 text-sm mt-1">或点击选择文件 · 支持 .xlsx / .xls</p>
                        </>
                      )}
                    </div>
                    {uploadMsg && (
                      <p className={`mt-3 text-sm ${uploadMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
                        {uploadMsg}
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {meta.summary?.map((entry, idx) => (
                  <WeekCard
                    key={entry.week}
                    entry={entry}
                    currentWeek={idx === 0 ? currentWeek : undefined}
                    onBrandClick={setSelectedBrand}
                  />
                ))}
              </div>
            )}
          </>
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

function WeekCard({ entry, currentWeek, onBrandClick }: { entry: WeekEntry; currentWeek?: string; onBrandClick: (brand: string) => void }) {
  return (
    <div className="flex gap-3 items-start">
      {/* 当前周标签 */}
      <div className="w-20 shrink-0 pt-3 flex flex-col items-center gap-1.5">
        {currentWeek && (
          <>
            <span className="text-sm text-slate-500 font-medium">当前</span>
            <span className="px-3 py-1.5 border text-base font-bold rounded-xl text-center" style={{ background: 'rgba(252,234,66,0.15)', borderColor: 'rgba(252,234,66,0.5)', color: '#b45309' }}>
              {currentWeek}
            </span>
          </>
        )}
      </div>

      {/* 卡片主体 */}
      <div className="flex-1 glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-200/60">
          <span className="px-3 py-1 text-white text-sm font-bold rounded-lg" style={{ background: '#0034cc' }}>{entry.week}</span>
          <span className="text-slate-500 text-sm">{entry.month} 月</span>
          <span className="text-slate-800 font-semibold text-base flex-1">{entry.title}</span>
          <span className="text-slate-400 text-sm">{entry.brands.length} 个品牌 · {entry.brands.reduce((s, b) => s + b.count, 0)} 款</span>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {entry.brands.map((b, i) => {
            const c = BRAND_COLORS[i % BRAND_COLORS.length]
            return (
              <button
                key={b.name}
                onClick={() => onBrandClick(b.name)}
                className={`flex items-center justify-between ${c.bg} border ${c.border} rounded-lg px-3 py-2 transition-all hover:scale-105 hover:shadow-lg cursor-pointer`}
              >
                <span className={`text-sm font-medium truncate ${c.text}`}>{b.name}</span>
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded shrink-0 ${c.badge}`}>{b.count} 款</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BrandDetail({ brand, rows, headers, onBack }: { brand: string; rows: BrandRow[]; headers: string[]; onBack: () => void }) {
  const byWeek = rows.reduce<Record<string, BrandRow[]>>((acc, r) => {
    if (!acc[r.week]) acc[r.week] = []
    acc[r.week].push(r)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          ← 返回运营日历
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{brand}</h2>
          <p className="text-xs text-slate-500 mt-0.5">共 {rows.length} 条记录 · {Object.keys(byWeek).length} 个周次</p>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(byWeek).map(([week, weekRows]) => (
          <div key={week} className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200/60">
              <span className="px-3 py-1 text-white text-sm font-bold rounded-lg" style={{ background: '#0034cc' }}>{week}</span>
              <span className="text-slate-500 text-sm">{weekRows[0].month} 月</span>
              <span className="text-slate-700 font-medium text-sm flex-1">{weekRows[0].weekTitle}</span>
              <span className="text-slate-400 text-xs">{weekRows.length} 条</span>
            </div>

            {/* 表格 */}
            <div className="overflow-x-auto">
              <table className="text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200/60" style={{ background: 'rgba(0,52,204,0.04)' }}>
                    <th className="text-left px-6 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide w-8">#</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">品牌</th>
                    {headers.map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">
                        <span title={h.length > 6 ? h : undefined}>
                          {h.length > 6 ? h.slice(0, 6) + '…' : h}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200/60 hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-3 text-slate-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium">{row.brand}</td>
                      {headers.map(h => {
                        const raw = row[h]
                        const isEmpty = raw == null || raw === '' || /^\*+$/.test(String(raw))
                        if (isEmpty) return (
                          <td key={h} className="px-4 py-3"><span className="text-slate-300">—</span></td>
                        )
                        const isCoverageCol = h.includes('铺店 覆盖率')
                        if (isCoverageCol && typeof raw === 'number') {
                          return (
                            <td key={h} className="px-4 py-3 text-slate-700">
                              {Math.round(raw * 100)}%
                            </td>
                          )
                        }
                        const text = String(raw)
                        const lines = text.split('\n').filter(l => l.trim())
                        return (
                          <td key={h} className="px-4 py-3 text-slate-700">
                            {lines.length > 1 ? (
                              <ul className="space-y-0.5">
                                {lines.map((l, i) => <li key={i} className="text-xs">{l}</li>)}
                              </ul>
                            ) : text}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CalendarPage() {
  return <AuthGuard><CalendarContent /></AuthGuard>
}

function getCurrentWeek(): string {
  const now = new Date()
  const year = now.getFullYear()
  const shortYear = year % 100 // 2026 → 26

  // 本年第一天
  const jan1 = new Date(year, 0, 1)
  // 本年第一个周一（ISO 周从周一开始）
  const dayOfWeek = jan1.getDay() // 0=周日, 1=周一...
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek
  const firstMonday = new Date(jan1)
  firstMonday.setDate(jan1.getDate() + daysToMonday)

  // 今天距第一个周一的天数
  const diffMs = now.getTime() - firstMonday.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const weekNum = diffDays < 0 ? 1 : Math.floor(diffDays / 7) + 1

  return `${shortYear}W${weekNum}`
}
