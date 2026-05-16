'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import JSZip from 'jszip'
import { useAuth } from '@/lib/auth'
import Logo from '@/components/Logo'
import AuthGuard from '@/components/AuthGuard'
import { GalleryItem, getGallery, getGalleryItem, deleteFromGallery, saveToGallery, urlToDataUrl } from '@/lib/gallery'
import { APP_VERSION } from '@/lib/version'
import { drawImageCrisp } from '@/lib/canvas'

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

// 判定是不是「触屏为主、无 hover」的移动设备（手机 / 平板）。桌面浏览器即便
// `navigator.canShare({ files })` 返回 true，调用 share 会弹 macOS 系统分享面板
// 而非"下载到 Downloads"，对桌面用户是负向体验；所以只在真·移动设备上才走
// Web Share，桌面一律直接下载 / 打 ZIP。
function isTouchOnlyDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse) and (hover: none)').matches
}

async function compositeWithLogo(
  dataUrl: string,
  logoSrc: string,
  pos: { x: number; y: number; scale: number },
): Promise<string> {
  const [poster, logo] = await Promise.all([loadImg(dataUrl), loadImg(logoSrc)])
  const canvas = document.createElement('canvas')
  canvas.width = poster.naturalWidth
  canvas.height = poster.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(poster, 0, 0)
  const logoW = poster.naturalWidth * pos.scale
  const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW
  // 多级降采样保证 logo 边缘锐利 —— 见 src/lib/canvas.ts
  drawImageCrisp(ctx, logo, poster.naturalWidth * pos.x - logoW / 2, poster.naturalHeight * pos.y - logoH / 2, logoW, logoH)
  // PNG 输出 —— 保留 logo 边缘锐利度（JPEG 量化会让 logo 轮廓产生像素感）。
  return canvas.toDataURL('image/png')
}

// ─── 单张卡片 ─────────────────────────────────────────────────────────────────
function GalleryCard({
  item,
  selected,
  saved,
  onToggle,
  onClick,
}: {
  item: GalleryItem
  selected: boolean
  saved: boolean
  onToggle: (id: string) => void
  onClick: (item: GalleryItem) => void
}) {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    getGalleryItem(item.id).then(url => { if (url) setDataUrl(url) })
  }, [item.id])

  return (
    <div
      className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
        selected ? 'ring-2' : 'border-slate-200 hover:border-slate-300'
      }`}
      style={selected ? { borderColor: '#0034cc', boxShadow: '0 0 0 2px rgba(0,52,204,0.2)' } : {}}
      onClick={() => onClick({ ...item, dataUrl })}
    >
      <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center">
        {dataUrl
          ? <img src={dataUrl} alt={item.filename} className="w-full h-full object-cover" />
          : <span className="w-6 h-6 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
        }
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
      {/* 来源标签 + 已保存标记（已保存时叠在来源标签下方，绿色高亮）*/}
      <span className={`absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded font-medium ${
        item.source === 'tryon' ? 'bg-blue-600 text-white' : item.source === 'image-design' ? 'bg-violet-600 text-white' : 'bg-emerald-600 text-white'
      }`}>
        {item.source === 'tryon' ? 'AI换装' : item.source === 'image-design' ? 'AI设计' : '模板'}
      </span>
      {saved && (
        <span className="absolute top-9 right-2 text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-500 text-white shadow-sm flex items-center gap-0.5 leading-none">
          <span className="text-[11px]">✓</span> 已保存
        </span>
      )}
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
  onConfirm: (pos: { x: number; y: number; scale: number }) => void
  onClose: () => void
}) {
  const [pos, setPos] = useState({ x: 0.85, y: 0.10 })
  const [scale, setScale] = useState(0.22)
  const [dragging, setDragging] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // 拖 logo 主体 → 移动位置（offset-based，不再 teleport）
  function startDrag(e: React.PointerEvent) {
    if ((e.target as HTMLElement).dataset.handle) return
    e.preventDefault()
    e.stopPropagation()
    const overlay = previewRef.current
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const origX = pos.x * rect.width
    const origY = pos.y * rect.height
    const pid = e.pointerId
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(pid)
    setDragging(true)

    const onMove = (ev: PointerEvent) => {
      let nx = Math.max(0.02, Math.min(0.98, (origX + ev.clientX - startX) / rect.width))
      let ny = Math.max(0.02, Math.min(0.98, (origY + ev.clientY - startY) / rect.height))
      if (Math.abs(nx - 0.5) < 0.015) nx = 0.5
      if (Math.abs(ny - 0.5) < 0.015) ny = 0.5
      setPos({ x: nx, y: ny })
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      try { target.releasePointerCapture(pid) } catch {}
      setDragging(false)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  // 拖 ↘ 角手柄 → 缩放
  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const overlay = previewRef.current
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const cx = pos.x * rect.width
    const cy = pos.y * rect.height
    const startDist = Math.hypot(e.clientX - rect.left - cx, e.clientY - rect.top - cy) || 1
    const baseScale = scale
    const pid = e.pointerId
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(pid)

    const onMove = (ev: PointerEvent) => {
      const d = Math.hypot(ev.clientX - rect.left - cx, ev.clientY - rect.top - cy)
      setScale(Math.max(0.05, Math.min(0.6, +(baseScale * d / startDist).toFixed(4))))
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      try { target.releasePointerCapture(pid) } catch {}
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

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
          <p className="text-sm text-slate-500 mb-3">拖动 Logo 设置位置；拖动右下角黄点缩放</p>

          {/* 位置预览框 */}
          <div
            ref={previewRef}
            className="relative w-full aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden border border-slate-300 select-none"
          >
            {/* 背景格子 */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#666 0,#666 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#666 0,#666 1px,transparent 1px,transparent 40px)' }} />

            {/* 拖动时辅助线 */}
            {dragging && (
              <>
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l border-dashed border-white/40 pointer-events-none" />
                <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t border-dashed border-white/40 pointer-events-none" />
                {pos.x === 0.5 && <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l-2 border-solid border-yellow-400 pointer-events-none" />}
                {pos.y === 0.5 && <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t-2 border-solid border-yellow-400 pointer-events-none" />}
              </>
            )}

            {/* Logo overlay — 拖主体移位置，拖 ↘ 角缩放 */}
            <div
              onPointerDown={startDrag}
              className="absolute"
              style={{
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
                width: `${scale * 100}%`,
                transform: 'translate(-50%, -50%)',
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none',
              }}
            >
              <img src="/bigoffs-logo.png" alt="logo" className="block w-full h-auto select-none" style={{ pointerEvents: 'none' }} draggable={false} />
              {/* 黄色虚线选择框 */}
              <div className="absolute pointer-events-none border-2 border-dashed" style={{ inset: -4, borderColor: '#fceb42' }} />
              {/* ↘ 缩放手柄 */}
              <div
                data-handle="resize"
                onPointerDown={startResize}
                className="absolute rounded-full flex items-center justify-center"
                style={{
                  right: -14, bottom: -14, width: 28, height: 28,
                  background: '#fceb42', border: '2px solid #111',
                  cursor: 'nwse-resize', touchAction: 'none',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                  fontSize: 14, lineHeight: 1, color: '#111', fontWeight: 700,
                }}
                title="拖动缩放 Logo"
              >↘</div>
              {/* 装饰角点 */}
              {(['nw', 'ne', 'sw'] as const).map(corner => (
                <div
                  key={corner}
                  className="absolute pointer-events-none rounded-full"
                  style={{
                    width: 10, height: 10,
                    background: '#fceb42', border: '2px solid #111',
                    ...(corner.includes('n') ? { top: -5 } : { bottom: -5 }),
                    ...(corner.includes('w') ? { left: -5 } : { right: -5 }),
                  }}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-2 text-center">
            位置：水平 {Math.round(pos.x * 100)}% · 垂直 {Math.round(pos.y * 100)}% · 大小 {Math.round(scale * 100)}%
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">取消</button>
          <button
            onClick={() => onConfirm({ ...pos, scale })}
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
function PreviewModal({
  item,
  saved,
  onSaved,
  onClose,
}: {
  item: GalleryItem
  saved: boolean
  onSaved: () => void
  onClose: () => void
}) {
  // item.dataUrl may already be loaded by GalleryCard; use it directly
  const dataUrl = item.dataUrl
  const [saving, setSaving] = useState(false)

  // 单图保存 — 与 handleBatchSave 一致的混合方案：先试 navigator.share，
  // 不支持 / 用户未在分享面板取消时再降级到原生 `<a download>`. 这样 iOS Safari
  // 下点击「保存」会弹系统分享面板（可一键存到「照片」），而不是把图片在新标签里打开。
  async function handleSave() {
    if (!dataUrl || saving) return
    setSaving(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const mimeMatch = dataUrl.match(/^data:([^;]+);/)
      const mime = mimeMatch?.[1] ?? blob.type ?? 'application/octet-stream'
      const file = new File([blob], item.filename, { type: mime })

      const nav = typeof navigator !== 'undefined' ? navigator : null
      // 仅在触屏移动设备上调 share —— 桌面 Safari/Chrome 即便 canShare===true
      // 也会弹系统分享面板，桌面用户其实想要"下载到 Downloads"
      const canUseShare = isTouchOnlyDevice()
        && !!(nav?.share && nav?.canShare && nav.canShare({ files: [file] }))

      if (canUseShare) {
        try {
          await nav!.share({ files: [file], title: item.filename })
          onSaved()
          return
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') return
          // 其它错误：落到下载兜底
          console.warn('navigator.share failed for single image, falling back to download:', e)
        }
      }

      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = item.filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      onSaved()
    } catch (e) {
      console.error('Save failed', e)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 已保存 → 绿色按钮 + ✓；保存中 → 灰色禁用 + loading；其它 → 主色蓝
  const saveBtnStyle: React.CSSProperties = saved
    ? { background: '#10b981' }
    : { background: '#0034cc' }
  const saveBtnLabel = saving ? '保存中...' : saved ? '✓ 已保存' : '保存'

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
          {dataUrl
            ? <img src={dataUrl} alt={item.filename} className="max-h-[60vh] w-auto rounded-lg shadow-2xl" />
            : <span className="w-8 h-8 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          }
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
          <button
            onClick={handleSave}
            disabled={!dataUrl || saving}
            className="flex-1 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            style={saveBtnStyle}
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saveBtnLabel}
          </button>
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
  // Batch-save state — separate from batchProcessing so 一键保存 and 批量加 Logo
  // can each show their own progress without interfering. savedIds persists for
  // the page's lifetime so the user can tell at a glance what's already exported.
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchSaveProgress, setBatchSaveProgress] = useState({ done: 0, total: 0 })
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  useEffect(() => { setItems(getGallery(user?.username)) }, [user?.username])

  // Refresh when switching back to this tab, when another tab saves, or when same-tab saves
  useEffect(() => {
    function refresh() { setItems(getGallery(user?.username)) }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('gallery-updated', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('gallery-updated', refresh)
    }
  }, [user?.username])

  function refresh() { setItems(getGallery(user?.username)) }

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

  // 批量保存 — 混合方案：
  //   1) 阶段 1：从 IndexedDB 把选中的图都拉成 File 对象（带进度条）
  //   2) 阶段 2a：优先调用 navigator.share({ files })，让 iOS/Android 走原生分享面板
  //                直接存到「相册/照片」，体验最佳
  //   2b）如果浏览器不支持 Web Share API（典型场景：微信内置浏览器、桌面 Firefox），
  //       自动降级为 JSZip 打包后一次性下载 gallery-YYYYMMDD.zip
  //   2c）单张选择时跳过 ZIP，直接下载单文件
  // 只有真正完成（share 成功 / zip 已触发下载）才把 ID 写进 savedIds —— 用户在分享面板按取消
  // 不会留下「已保存」误标。
  async function handleBatchSave() {
    const targets = items.filter(i => selected.has(i.id))
    if (targets.length === 0) return
    setBatchSaving(true)
    setBatchSaveProgress({ done: 0, total: targets.length })

    // ── 阶段 1：dataURL → File[] ──
    const usedNames = new Set<string>()
    const files: File[] = []
    for (let idx = 0; idx < targets.length; idx++) {
      const item = targets[idx]
      try {
        const dataUrl = await getGalleryItem(item.id)
        if (dataUrl) {
          const blob = await (await fetch(dataUrl)).blob()
          const mimeMatch = dataUrl.match(/^data:([^;]+);/)
          const mime = mimeMatch?.[1] ?? blob.type ?? 'application/octet-stream'
          // ZIP 内禁止重名；如已存在则补 -2 / -3 后缀
          let name = item.filename
          if (usedNames.has(name)) {
            const dot = name.lastIndexOf('.')
            const base = dot > 0 ? name.slice(0, dot) : name
            const ext = dot > 0 ? name.slice(dot) : ''
            let n = 2
            while (usedNames.has(`${base}-${n}${ext}`)) n++
            name = `${base}-${n}${ext}`
          }
          usedNames.add(name)
          files.push(new File([blob], name, { type: mime }))
        }
      } catch (e) {
        console.error('Build file failed for', item.id, e)
      }
      setBatchSaveProgress({ done: idx + 1, total: targets.length })
    }

    if (files.length === 0) {
      setBatchSaving(false)
      alert('未能加载任何图片，请重试')
      return
    }

    // ── 阶段 2：优先 Web Share，否则 ZIP / 单文件下载 ──
    const targetIds = targets.map(t => t.id)
    const markAllSaved = () => setSavedIds(prev => {
      const next = new Set(prev)
      for (const id of targetIds) next.add(id)
      return next
    })

    const nav = typeof navigator !== 'undefined' ? navigator : null
    // 同 PreviewModal.handleSave：仅触屏设备走 share，桌面直接 ZIP / 单文件下载
    const canUseShare = isTouchOnlyDevice()
      && !!(nav?.share && nav?.canShare && nav.canShare({ files }))

    if (canUseShare) {
      try {
        await nav!.share({ files, title: '图库导出' })
        markAllSaved()
        setBatchSaving(false)
        return
      } catch (e) {
        const errName = (e as Error)?.name
        if (errName === 'AbortError') {
          // 用户在分享面板里取消 —— 这是有意行为，不再走 ZIP 兜底
          setBatchSaving(false)
          return
        }
        // 其它错误（权限被禁、分享目标不支持 files 等）→ 落到 ZIP 兜底
        console.warn('navigator.share failed, falling back to ZIP:', e)
      }
    }

    try {
      let blob: Blob
      let filename: string
      if (files.length === 1) {
        // 只有一张时不打包，直接下载原文件
        blob = files[0]
        filename = files[0].name
      } else {
        const zip = new JSZip()
        for (const f of files) zip.file(f.name, f)
        blob = await zip.generateAsync({ type: 'blob' })
        filename = `gallery-${new Date().toISOString().slice(0, 10)}.zip`
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      markAllSaved()
    } catch (e) {
      console.error('ZIP / single-file download failed:', e)
      alert('下载失败，请重试')
    } finally {
      setBatchSaving(false)
    }
  }

  // 批量删除
  function handleBatchDelete() {
    const ids = Array.from(selected)
    deleteFromGallery(ids, user?.username)
    setSelected(new Set())
    refresh()
  }

  // 批量加 Logo
  async function handleBatchLogo(pos: { x: number; y: number; scale: number }) {
    setShowBatchLogo(false)
    const targets = items.filter(i => selected.has(i.id))
    setBatchProcessing(true)
    setBatchProgress({ done: 0, total: targets.length })

    for (let i = 0; i < targets.length; i++) {
      const item = targets[i]
      try {
        const fullDataUrl = await getGalleryItem(item.id)
        if (!fullDataUrl) continue
        const composited = await compositeWithLogo(fullDataUrl, '/bigoffs-logo.png', pos)
        // compositeWithLogo 现在输出 PNG，扩展名跟着改
        const newFilename = item.filename.replace(/\.(jpg|jpeg|png)$/i, '') + '-BIGOFFS.png'
        await saveToGallery({ dataUrl: composited, filename: newFilename, source: item.source }, user?.username)
        // 不自动下载——只入库，用户可去图库里逐张下载或后续手动批量保存
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
      <header className="bigoffs-header px-3 md:px-6 flex items-center justify-between overflow-hidden flex-shrink-0" style={{ height: 60 }}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Logo />
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold text-white truncate">智能推广平台</h1>
            <p className="text-xs text-slate-400 truncate">我的图库</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {user && (
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <div className="text-right hidden sm:block min-w-0">
                <p className="text-sm text-white font-medium truncate">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">{ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}</p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#0034cc' }}>{user.name[0]}</div>
              <button onClick={logout} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors flex-shrink-0 whitespace-nowrap">退出</button>
            </div>
          )}
          <span className="hidden md:inline text-xs text-slate-400 ml-1 flex-shrink-0">{APP_VERSION}</span>
        </div>
      </header>

      {/* Nav */}
      <nav className="bigoffs-header border-b border-white/10 px-3 md:px-6 flex gap-1 flex-shrink-0 overflow-x-auto whitespace-nowrap">
        {NAV.map(item => (
          <Link key={item.label} href={item.href} prefetch className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            item.active ? 'text-white' : 'border-transparent text-slate-400 hover:text-white hover:border-white/30'
          }`}
          style={item.active ? { borderBottomColor: '#fcea42', color: '#fcea42' } : {}}>
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-8">
        {/* 顶部工具栏 */}
        <div className="flex items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">我的图库</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">共 {items.length} 张图片 · 来自 AI 换装、模板社区和 AI 图片设计的下载记录</p>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={toggleAll}
                className="px-3 py-1.5 text-sm bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm rounded-lg transition-colors whitespace-nowrap"
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
            </div>
          )}
        </div>

        {/* 批量操作栏 — mobile 横向滚动避免文字竖排 */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-5 px-3 md:px-4 py-2.5 md:py-3 glass-card rounded-xl overflow-x-auto">
            <span className="text-sm text-slate-700 font-medium whitespace-nowrap flex-shrink-0">已选 {selectedCount} 张</span>
            <div className="flex-1 min-w-0 hidden sm:block" />
            <button
              onClick={handleBatchSave}
              disabled={batchSaving}
              className="px-3 md:px-4 py-1.5 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#0034cc' }}
            >
              {batchSaving ? `保存中 ${batchSaveProgress.done}/${batchSaveProgress.total}` : '一键保存'}
            </button>
            <button
              onClick={() => setShowBatchLogo(true)}
              disabled={batchProcessing}
              className="px-3 md:px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm disabled:opacity-40 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0"
            >
              <img src="/bigoffs-logo.png" alt="" className="h-3.5 w-auto" />
              <span className="hidden sm:inline">批量</span>添加 Logo
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 md:px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
            >
              删除
            </button>
            <button onClick={clearSelection} className="text-slate-500 hover:text-slate-700 text-sm px-2 whitespace-nowrap flex-shrink-0">取消</button>
          </div>
        )}

        {/* 一键保存进度 */}
        {batchSaving && (
          <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
            <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm text-emerald-700 whitespace-nowrap">
              正在保存... {batchSaveProgress.done} / {batchSaveProgress.total}
            </span>
            <div className="flex-1 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(batchSaveProgress.done / Math.max(1, batchSaveProgress.total)) * 100}%` }}
              />
            </div>
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
              <Link href="/tryon" prefetch className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors" style={{ background: '#0034cc' }}>去 AI 换装</Link>
              <Link href="/templates" prefetch className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">去模板社区</Link>
              <Link href="/image-design" prefetch className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors">去 AI 图片设计</Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map(item => (
              <GalleryCard
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                saved={savedIds.has(item.id)}
                onToggle={toggleSelect}
                onClick={setPreview}
              />
            ))}
          </div>
        )}
      </main>

      {/* 弹窗 */}
      {preview && (
        <PreviewModal
          item={preview}
          saved={savedIds.has(preview.id)}
          onSaved={() => setSavedIds(prev => {
            const next = new Set(prev)
            next.add(preview.id)
            return next
          })}
          onClose={() => setPreview(null)}
        />
      )}
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
