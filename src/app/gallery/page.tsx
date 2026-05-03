'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import Logo from '@/components/Logo'
import AuthGuard from '@/components/AuthGuard'
import { GalleryItem, getGallery, deleteFromGallery, saveToGallery, urlToDataUrl } from '@/lib/gallery'

const ROLE_LABEL: Record<string, string> = { hq: '总部市场部', regional: '区域运营' }

const NAV = [
  { label: '运营日历', href: '/calendar', icon: '📅' },
  { label: '模板社区', href: '/templates', icon: '🎨' },
  { label: 'AI 换装', href: '/tryon', icon: '👗' },
  { label: 'AI 图片设计', href: '/image-design', icon: '✨' },
  { label: '我的图库', href: '/gallery', icon: '🖼️', active: true },
]

// ─── Logo 合成工具 ────────────────────────────────────────────────────────────
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function compositeWithLogo(
  dataUrl: string,
  logoSrc: string,
  pos: { x: number; y: number },
): Promise<string> {
  const [poster, logo] = await Promise.all([loadImg(dataUrl), loadImg(logoSrc)])
  const canvas = document.createElement('canvas')
  canvas.width = poster.naturalWidth
  canvas.height = poster.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(poster, 0, 0)
  const logoW = poster.naturalWidth * 0.22
  const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW
  ctx.drawImage(logo, poster.naturalWidth * pos.x - logoW / 2, poster.naturalHeight * pos.y - logoH / 2, logoW, logoH)
  return canvas.toDataURL('image/jpeg', 0.92)
}

// ─── 单张卡片 ─────────────────────────────────────────────────────────────────
function GalleryCard({
  item,
  selected,
  onToggle,
  onClick,
}: {
  item: GalleryItem
  selected: boolean
  onToggle: (id: string) => void
  onClick: (item: GalleryItem) => void
}) {
  return (
    <div
      className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
        selected ? 'ring-2' : 'border-slate-200 hover:border-slate-300'
      }`}
      style={selected ? { borderColor: '#0034cc', boxShadow: '0 0 0 2px rgba(0,52,204,0.2)' } : {}}
      onClick={() => onClick(item)}
    >
      <div className="aspect-[3/4] bg-slate-100">
        <img src={item.dataUrl} alt={item.filename} className="w-full h-full object-cover" />
      </div>
      {/* 选择框 */}
      <button
        className="absolute top-2 left-2 z-10"
        onClick={e => { e.stopPropagation(); onToggle(item.id) }}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          selected ? 'border-transparent' : 'bg-black/40 border-white/60 group-hover:border-white'
        }`} style={selected ? { background: '#0034cc', borderColor: '#0034cc' } : {}}>
          {selected && <span className="text-white text-xs leading-none">✓</span>}
        </div>
      </button>
      {/* 来源标签 */}
      <span className={`absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded font-medium ${
        item.source === 'tryon' ? 'bg-blue-600 text-white' : item.source === 'image-design' ? 'bg-violet-600 text-white' : 'bg-emerald-600 text-white'
      }`}>
        {item.source === 'tryon' ? 'AI换装' : item.source === 'image-design' ? 'AI设计' : '模板'}
      </span>
      {/* 文件名 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
        <p className="text-white text-xs truncate">{item.filename}</p>
        <p className="text-white/60 text-[10px]">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</p>
      </div>
    </div>
  )
}

// ─── 批量加 Logo 弹窗 ─────────────────────────────────────────────────────────
function BatchLogoModal({
  count,
  onConfirm,
  onClose,
}: {
  count: number
  onConfirm: (pos: { x: number; y: number }) => void
  onClose: () => void
}) {
  const [pos, setPos] = useState({ x: 0.5, y: 0.88 })
  const [dragging, setDragging] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  function updatePos(clientX: number, clientY: number) {
    const el = previewRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    let y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    if (Math.abs(x - 0.5) < 0.03) x = 0.5
    if (Math.abs(y - 0.5) < 0.03) y = 0.5
    setPos({ x, y })
  }

  // logo 预览尺寸（相对于预览框）
  const logoPreviewW = 22  // % of preview width
  const logoPreviewH = logoPreviewW / (3864 / 1023) // 保持比例

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">批量添加 Logo</h3>
            <p className="text-sm text-slate-500 mt-0.5">将对 {count} 张图片统一添加 Logo</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">×</button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-500 mb-3">拖动下方预览框设置 Logo 位置，所有图片将使用相同位置</p>

          {/* 位置预览框 */}
          <div
            ref={previewRef}
            className="relative w-full aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden cursor-crosshair border border-slate-300 select-none"
            onMouseDown={e => { setDragging(true); updatePos(e.clientX, e.clientY) }}
            onMouseMove={e => { if (dragging) updatePos(e.clientX, e.clientY) }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onTouchStart={e => { setDragging(true); updatePos(e.touches[0].clientX, e.touches[0].clientY) }}
            onTouchMove={e => { if (dragging) { e.preventDefault(); updatePos(e.touches[0].clientX, e.touches[0].clientY) } }}
            onTouchEnd={() => setDragging(false)}
          >
            {/* 背景格子 */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#666 0,#666 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#666 0,#666 1px,transparent 1px,transparent 40px)' }} />

            {/* 居中辅助线 */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l border-dashed border-white/30" />
            <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t border-dashed border-white/30" />

            {/* 吸附高亮 */}
            {pos.x === 0.5 && <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l-2 border-solid border-yellow-400/80" />}
            {pos.y === 0.5 && <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t-2 border-solid border-yellow-400/80" />}

            {/* Logo 预览 */}
            <div
              className="absolute"
              style={{
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: `${logoPreviewW}%`,
              }}
            >
              <img src="/bigoffs-logo.png" alt="logo" className="w-full h-auto" draggable={false} />
            </div>

            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/50">点击或拖动设置位置</p>
          </div>

          <p className="text-xs text-slate-500 mt-2 text-center">
            位置：水平 {Math.round(pos.x * 100)}% · 垂直 {Math.round(pos.y * 100)}%
            {pos.x === 0.5 ? ' · 水平居中 ✓' : ''}
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">取消</button>
          <button
            onClick={() => onConfirm(pos)}
            className="flex-1 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
            style={{ background: '#0034cc' }}
          >
            确认添加到 {count} 张图片
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 预览弹窗 ─────────────────────────────────────────────────────────────────
function PreviewModal({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  function handleDownload() {
    const a = document.createElement('a')
    a.href = item.dataUrl
    a.download = item.filename
    a.click()
  }
  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <p className="text-slate-800 font-medium">{item.filename}</p>
            <p className="text-slate-500 text-xs mt-0.5">{new Date(item.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">×</button>
        </div>
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-50">
          <img src={item.dataUrl} alt={item.filename} className="max-h-[60vh] w-auto rounded-lg shadow-2xl" />
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
          <button onClick={handleDownload} className="flex-1 py-2.5 text-white text-sm font-medium rounded-lg transition-colors" style={{ background: '#0034cc' }}>下载</button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">关闭</button>
        </div>
      </div>
    </div>
  )
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────
function GalleryContent() {
  const { user, logout } = useAuth()
  const [items, setItems] = useState<GalleryItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<GalleryItem | null>(null)
  const [showBatchLogo, setShowBatchLogo] = useState(false)
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })

  useEffect(() => { setItems(getGallery()) }, [])

  function refresh() { setItems(getGallery()) }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map(i => i.id)))
    }
  }

  function clearSelection() { setSelected(new Set()) }

  // 批量保存（下载）
  function handleBatchSave() {
    const targets = items.filter(i => selected.has(i.id))
    targets.forEach((item, idx) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = item.dataUrl
        a.download = item.filename
        a.click()
      }, idx * 300)
    })
  }

  // 批量删除
  function handleBatchDelete() {
    const ids = Array.from(selected)
    deleteFromGallery(ids)
    setSelected(new Set())
    refresh()
  }

  // 批量加 Logo
  async function handleBatchLogo(pos: { x: number; y: number }) {
    setShowBatchLogo(false)
    const targets = items.filter(i => selected.has(i.id))
    setBatchProcessing(true)
    setBatchProgress({ done: 0, total: targets.length })

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i]
      try {
        const composited = await compositeWithLogo(item.dataUrl, '/bigoffs-logo.png', pos)
        const newFilename = item.filename.replace(/\.(jpg|jpeg|png)$/i, '') + '-BIGOFFS.jpg'
        // 存入图库
        saveToGallery({ dataUrl: composited, filename: newFilename, source: item.source })
        // 同时触发下载
        const a = document.createElement('a')
        a.href = composited
        a.download = newFilename
        a.click()
      } catch (e) {
        console.error('Batch logo failed for', item.id, e)
      }
      setBatchProgress({ done: i + 1, total: targets.length })
    }

    setBatchProcessing(false)
    setSelected(new Set())
    refresh()
  }

  const selectedCount = selected.size
  const allSelected = items.length > 0 && selected.size === items.length

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f7' }}>
      {/* Header */}
      <header className="bigoffs-header px-6 flex items-center justify-between" style={{ height: 60 }}>
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-lg font-bold text-white">智能推广平台</h1>
            <p className="text-xs text-slate-400">我的图库</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-white font-medium">{user.name}</p>
              <p className="text-xs text-slate-400">{ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}</p>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: '#0034cc' }}>{user.name[0]}</div>
            <button onClick={logout} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors">退出</button>
          </div>
        )}
      </header>

      {/* Nav */}
      <nav className="bigoffs-header border-b border-white/10 px-6 flex gap-1">
        {NAV.map(item => (
          <a key={item.label} href={item.href} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            item.active ? 'text-white' : 'border-transparent text-slate-400 hover:text-white hover:border-white/30'
          }`}
          style={item.active ? { borderBottomColor: '#fcea42', color: '#fcea42' } : {}}>
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">我的图库</h2>
            <p className="text-sm text-slate-500 mt-0.5">共 {items.length} 张图片 · 来自 AI 换装、模板社区和 AI 图片设计的下载记录</p>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAll}
                className="px-3 py-1.5 text-sm bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm rounded-lg transition-colors"
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
            </div>
          )}
        </div>

        {/* 批量操作栏 */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-3 mb-5 px-4 py-3 glass-card rounded-xl">
            <span className="text-sm text-slate-700 font-medium">已选 {selectedCount} 张</span>
            <div className="flex-1" />
            <button
              onClick={handleBatchSave}
              className="px-4 py-1.5 text-white text-sm font-medium rounded-lg transition-colors"
              style={{ background: '#0034cc' }}
            >
              一键保存
            </button>
            <button
              onClick={() => setShowBatchLogo(true)}
              disabled={batchProcessing}
              className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm disabled:opacity-40 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <img src="/bigoffs-logo.png" alt="" className="h-3.5 w-auto" />
              批量添加 Logo
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              删除
            </button>
            <button onClick={clearSelection} className="text-slate-500 hover:text-slate-700 text-sm px-2">取消</button>
          </div>
        )}

        {/* 批量处理进度 */}
        {batchProcessing && (
          <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm text-blue-700">
              正在批量添加 Logo... {batchProgress.done} / {batchProgress.total}
            </span>
            <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%`, background: '#0034cc' }}
              />
            </div>
          </div>
        )}

        {/* 图片网格 */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-600">
            <div className="text-6xl mb-4">🖼️</div>
            <p className="text-lg font-medium text-slate-600">图库还是空的</p>
            <p className="text-sm mt-2 text-slate-500">在 AI 换装、模板社区或 AI 图片设计下载图片后，会自动出现在这里</p>
            <div className="flex gap-3 mt-6">
              <a href="/tryon" className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors" style={{ background: '#0034cc' }}>去 AI 换装</a>
              <a href="/templates" className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">去模板社区</a>
              <a href="/image-design" className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">去 AI 图片设计</a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map(item => (
              <GalleryCard
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggle={toggleSelect}
                onClick={setPreview}
              />
            ))}
          </div>
        )}
      </main>

      {/* 弹窗 */}
      {preview && <PreviewModal item={preview} onClose={() => setPreview(null)} />}
      {showBatchLogo && (
        <BatchLogoModal
          count={selectedCount}
          onConfirm={handleBatchLogo}
          onClose={() => setShowBatchLogo(false)}
        />
      )}
    </div>
  )
}

export default function GalleryPage() {
  return <AuthGuard><GalleryContent /></AuthGuard>
}
