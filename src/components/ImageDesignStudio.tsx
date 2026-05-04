'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import Logo from './Logo'
import { saveToGallery, urlToDataUrl } from '@/lib/gallery'

const STYLE_OPTIONS = [
  { value: 'realistic', label: '写实' },
  { value: 'anime', label: '动漫' },
  { value: '3d', label: '3D渲染' },
  { value: 'oil', label: '油画' },
  { value: 'watercolor', label: '水彩' },
]

const RATIO_OPTIONS = [
  { value: '1:1', label: '1:1', w: 1, h: 1 },
  { value: '4:3', label: '4:3', w: 4, h: 3 },
  { value: '3:4', label: '3:4', w: 3, h: 4 },
  { value: '16:9', label: '16:9', w: 16, h: 9 },
  { value: '9:16', label: '9:16', w: 9, h: 16 },
]

const COUNT_OPTIONS = [1, 2, 4]

const ROLE_LABEL = { hq: '总部市场部', regional: '区域运营' }

interface GeneratedImage {
  id: string
  url: string
}

interface HistoryItem {
  id: string
  url: string
  prompt: string
  style: string
  ratio: string
  createdAt: number
}

const HISTORY_KEY = 'aipp_image_design_history'
const HISTORY_MAX = 10
const IDB_NAME = 'aipp_image_design'
const IDB_STORE = 'full_images'

// IndexedDB helpers — store/retrieve full-res images by item id
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(id: string, dataUrl: string) {
  try {
    const db = await openIDB()
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(dataUrl, id)
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
    db.close()
  } catch (e) {
    console.error('idbPut failed', e)
  }
}

async function idbGet(id: string): Promise<string | null> {
  try {
    const db = await openIDB()
    const tx = db.transaction(IDB_STORE, 'readonly')
    const result = await new Promise<string | null>((res, rej) => {
      const req = tx.objectStore(IDB_STORE).get(id)
      req.onsuccess = () => res(req.result ?? null)
      req.onerror = () => rej(req.error)
    })
    db.close()
    return result
  } catch {
    return null
  }
}

async function idbDeleteMany(ids: string[]) {
  try {
    const db = await openIDB()
    const tx = db.transaction(IDB_STORE, 'readwrite')
    ids.forEach(id => tx.objectStore(IDB_STORE).delete(id))
    db.close()
  } catch {}
}

function loadHistory(): HistoryItem[] {
  try {
    const items: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    // Migrate: drop any items whose url is a large base64 (>50KB means it's a full-res image, not a thumbnail)
    const clean = items.filter(item => !item.url || item.url.length < 50000)
    if (clean.length !== items.length) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(clean))
    }
    return clean
  } catch { return [] }
}

function saveHistory(items: HistoryItem[]) {
  const toSave = items.slice(0, HISTORY_MAX)
  try {
    // Remove old key first to free space before writing new data
    localStorage.removeItem(HISTORY_KEY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave))
  } catch {
    // Still full after clearing history — give up silently
  }
}

interface TextOverlay {
  content: string
  fontSize: number        // px relative to canvas width, e.g. 0.06
  color: string
  fontFamily: string
  x: number               // 0-1 normalized
  y: number               // 0-1 normalized
  locked?: boolean        // AI-generated texts are locked (no drag/delete)
}

const TEXT_FONTS = [
  { value: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif', label: '黑体',    preview: '永' },
  { value: '"STKaiti", "KaiTi", "Noto Serif SC", serif',                   label: '楷体',    preview: '永' },
  { value: '"STSong", "SimSun", "Noto Serif SC", serif',                   label: '宋体',    preview: '永' },
  { value: '"Noto Sans SC", sans-serif',                                    label: '思源黑体', preview: '永' },
  { value: '"Noto Serif SC", serif',                                        label: '思源宋体', preview: '永' },
  { value: '"ZCOOL XiaoWei", serif',                                        label: '站酷小薇', preview: '永' },
  { value: '"ZCOOL QingKe HuangYou", cursive',                              label: '站酷庆科', preview: '永' },
  { value: '"Ma Shan Zheng", cursive',                                      label: '马善政楷', preview: '永' },
  { value: '"Zhi Mang Xing", cursive',                                      label: '志莽行书', preview: '永' },
  { value: '"Long Cang", cursive',                                          label: '龙藏体',  preview: '永' },
]
const TEXT_COLORS = ['#ffffff', '#000000', '#FFD700', '#FF4444', '#00CFFF']
const FONT_SIZES  = [0.03, 0.05, 0.07, 0.10]
const FONT_SIZE_LABELS = ['小', '中', '大', '特大']

// ── 无子组件，直接在主组件内联渲染文字 overlay ──────────────────

export default function ImageDesignStudio() {
  const { user, logout } = useAuth()

  // Basic settings
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('realistic')
  const [ratio, setRatio] = useState('1:1')
  const [count, setCount] = useState(1)

  // Reference images (multi)
  const [refImages, setRefImages] = useState<Array<{ base64: string; mime: string; preview: string }>>([])
  const [refDragOver, setRefDragOver] = useState(false)
  const refInputRef = useRef<HTMLInputElement>(null)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Detail modal
  const [detailImage, setDetailImage] = useState<string | null>(null)
  const [detailPrompt, setDetailPrompt] = useState('')
  const [detailStyle, setDetailStyle] = useState('realistic')
  const [detailRatio, setDetailRatio] = useState('1:1')
  const [detailHistoryIndex, setDetailHistoryIndex] = useState<number | null>(null)

  // History
  const [history, setHistory] = useState<HistoryItem[]>([])
  useEffect(() => { setHistory(loadHistory()) }, [])

  // Logo compositing state
  const [withLogo, setWithLogo] = useState(false)
  const [compositing, setCompositing] = useState(false)
  const [logoPos, setLogoPos] = useState({ x: 0.5, y: 0.88 })
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const posterImgRef = useRef<HTMLImageElement | null>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)

  // Text overlay state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [showTextEditor, setShowTextEditor] = useState(false)
  const [editingText, setEditingText] = useState<TextOverlay>({
    content: '',
    fontSize: 0.07,
    color: '#ffffff',
    fontFamily: TEXT_FONTS[0].value,
    x: 0.5,
    y: 0.5,
  })
  const [selectedTextIdx, setSelectedTextIdx] = useState<number | null>(null)
  // inline editing: when a placed text is selected, user can type directly in the overlay
  const [inlineEditIdx, setInlineEditIdx] = useState<number | null>(null)
  const inlineInputRef = useRef<HTMLInputElement>(null)
  const draggingTextRef = useRef<{ idx: number; startX: number; startY: number; origX: number; origY: number } | null>(null)

  // ── Reference image handlers ──────────────────────────────────
  function handleRefFile(file: File) {
    if (refImages.length >= 4) return // max 4 reference images
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      const img = new window.Image()
      img.onload = () => {
        const MAX = 1024
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', 0.85)
        setRefImages(prev => [...prev, { base64: compressed.split(',')[1], mime: 'image/jpeg', preview: compressed }])
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  function handleRefDrop(e: React.DragEvent) {
    e.preventDefault()
    setRefDragOver(false)
    Array.from(e.dataTransfer.files).forEach(file => {
      if (file.type.startsWith('image/')) handleRefFile(file)
    })
  }

  async function handleGenerate(overridePrompt?: string, overrideStyle?: string, overrideRatio?: string) {
    const usePrompt = overridePrompt ?? prompt
    const useStyle = overrideStyle ?? style
    const useRatio = overrideRatio ?? ratio
    if (!usePrompt.trim()) return
    setGenerating(true)
    setError(null)
    setImages([])
    setSelectedImage(null)
    setDetailImage(null)
    setTextOverlays([])
    setShowTextEditor(false)
    setSelectedTextIdx(null)
    setInlineEditIdx(null)
    setEditingText({ content: '', fontSize: 0.07, color: '#ffffff', fontFamily: TEXT_FONTS[0].value, x: 0.5, y: 0.5 })

    try {
      const res = await fetch('/api/image-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: usePrompt.trim(),
          style: useStyle,
          ratio: useRatio,
          count,
          referenceImages: refImages.length > 0 ? refImages.map(({ base64, mime }) => ({ base64, mime })) : undefined,
        }),
      })
      if (!res.ok) throw new Error('生成失败，请重试')
      const data = await res.json()
      if (!data.images?.length) throw new Error('未生成图片，请修改提示词后重试')
      setImages(data.images)
      setSelectedImage(data.images[0].url)
      if (data.texts?.length) {
        setTextOverlays(data.texts.map((t: TextOverlay) => ({ ...t, locked: true })))
      }
      // Save to history — 生成缩略图（128px）存入历史，避免 localStorage 超限
      const newItems: HistoryItem[] = await Promise.all(
        data.images.map(async (img: GeneratedImage) => {
          let thumbUrl = ''
          try {
            // Convert data URL to blob, then use createImageBitmap for reliable decoding
            const res = await fetch(img.url)
            const blob = await res.blob()
            const bitmap = await createImageBitmap(blob)
            const canvas = document.createElement('canvas')
            const scale = 96 / bitmap.width
            canvas.width = 96
            canvas.height = Math.round(bitmap.height * scale)
            canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
            bitmap.close()
            thumbUrl = canvas.toDataURL('image/jpeg', 0.3)
          } catch (e) {
            console.error('Thumbnail generation failed', e)
          }
          if (!thumbUrl) return null
          // Persist full-res image to IndexedDB
          await idbPut(img.id, img.url)
          return {
            id: img.id,
            url: thumbUrl,
            prompt: usePrompt.trim(),
            style: useStyle,
            ratio: useRatio,
            createdAt: Date.now(),
          }
        })
      ).then(items => items.filter(Boolean) as HistoryItem[])
      const updated = [...newItems, ...loadHistory()].slice(0, HISTORY_MAX)
      saveHistory(updated)
      setHistory(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  function openDetail(url: string, p: string, s: string, r: string, historyIndex?: number) {
    setDetailImage(url)
    setDetailPrompt(p)
    setDetailStyle(s)
    setDetailRatio(r)
    setDetailHistoryIndex(historyIndex ?? null)
  }

  async function navigateHistory(dir: 1 | -1) {
    if (detailHistoryIndex === null) return
    const next = detailHistoryIndex + dir
    if (next < 0 || next >= history.length) return
    const item = history[next]
    const fullUrl = await idbGet(item.id) ?? item.url
    setDetailImage(fullUrl)
    setDetailPrompt(item.prompt)
    setDetailStyle(item.style)
    setDetailRatio(item.ratio)
    setDetailHistoryIndex(next)
  }

  function deleteHistory(id: string) {
    const updated = loadHistory().filter(h => h.id !== id)
    saveHistory(updated)
    idbDeleteMany([id])
    setHistory(updated)
  }

  // Reset compositing state when selected image changes
  useEffect(() => {
    setWithLogo(false)
    posterImgRef.current = null
    logoImgRef.current = null
    setLogoPos({ x: 0.5, y: 0.88 })
  }, [selectedImage])

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

  function drawTexts(ctx: CanvasRenderingContext2D, w: number, h: number, texts: TextOverlay[]) {
    texts.forEach(t => {
      const fontSize = Math.round(w * t.fontSize)
      ctx.font = `bold ${fontSize}px ${t.fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const x = w * t.x
      const y = h * t.y
      const isDark = t.color === '#000000'
      ctx.strokeStyle = isDark ? '#ffffff' : 'rgba(0,0,0,0.65)'
      ctx.lineWidth = fontSize * 0.08
      ctx.lineJoin = 'round'
      ctx.strokeText(t.content, x, y)
      ctx.fillStyle = t.color
      ctx.fillText(t.content, x, y)
    })
  }

  async function handleAddLogo() {
    if (!selectedImage) return
    setCompositing(true)
    try {
      const poster = await loadImg(selectedImage)
      const logo = await loadImg('/bigoffs-logo.png')
      posterImgRef.current = poster
      logoImgRef.current = logo
      setWithLogo(true)
    } catch (e) {
      console.error('Logo compositing failed', e)
    } finally {
      setCompositing(false)
    }
  }

  function handleRemoveLogo() {
    setWithLogo(false)
    logoImgRef.current = null
  }

  async function handleApplyText() {
    if (!editingText.content.trim() || !selectedImage) return
    const newTexts = [...textOverlays, { ...editingText, content: editingText.content.trim() }]
    setTextOverlays(newTexts)
    const newIdx = newTexts.length - 1
    setSelectedTextIdx(newIdx)
    setInlineEditIdx(newIdx)
    setEditingText({ content: '', fontSize: 0.07, color: '#ffffff', fontFamily: TEXT_FONTS[0].value, x: 0.5, y: 0.5 })
    setShowTextEditor(false)
  }

  function handleRemoveText(index: number) {
    const newTexts = textOverlays.filter((_, i) => i !== index)
    setTextOverlays(newTexts)
  }

  // ── Logo drag ──────────────────────────────────────────────────
  function updateLogoPos(clientX: number, clientY: number) {
    const el = previewAreaRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let x = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    let y = Math.max(0, Math.min(1, (clientY - r.top)  / r.height))
    if (Math.abs(x - 0.5) < 0.03) x = 0.5
    if (Math.abs(y - 0.5) < 0.03) y = 0.5
    setLogoPos({ x, y })
  }

  // ── Text drag — global listeners so pointer can leave the element ──
  function startTextDrag(e: React.MouseEvent | React.TouchEvent, idx: number) {
    e.stopPropagation()
    e.preventDefault()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const container = previewAreaRef.current
    if (!container) return
    const t = textOverlays[idx]
    draggingTextRef.current = {
      idx,
      startX: clientX,
      startY: clientY,
      origX: t.x,
      origY: t.y,
    }
    setSelectedTextIdx(idx)

    function onMove(ev: MouseEvent | TouchEvent) {
      ev.preventDefault()
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY
      const ref = draggingTextRef.current
      if (!ref) return
      const rect = previewAreaRef.current?.getBoundingClientRect()
      if (!rect) return
      const nx = Math.max(0.02, Math.min(0.98, ref.origX + (cx - ref.startX) / rect.width))
      const ny = Math.max(0.02, Math.min(0.98, ref.origY + (cy - ref.startY) / rect.height))
      setTextOverlays(prev => prev.map((t2, i) => i === ref.idx ? { ...t2, x: nx, y: ny } : t2))
    }

    function onUp() {
      draggingTextRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
  }

  // ── Preview area handlers (Logo only — text has its own listeners) ──
  function handleMouseDown(e: React.MouseEvent) {
    if (draggingTextRef.current) return
    if (withLogo) { setDragging(true); updateLogoPos(e.clientX, e.clientY) }
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (dragging) updateLogoPos(e.clientX, e.clientY)
  }
  const wasDraggingRef = useRef(false)
  function handleMouseUp() { wasDraggingRef.current = dragging; setDragging(false) }

  function handleTouchStart(e: React.TouchEvent) {
    if (draggingTextRef.current || !withLogo || e.touches.length !== 1) return
    setDragging(true)
    updateLogoPos(e.touches[0].clientX, e.touches[0].clientY)
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging || e.touches.length !== 1) return
    e.preventDefault()
    updateLogoPos(e.touches[0].clientX, e.touches[0].clientY)
  }
  function handleTouchEnd() { wasDraggingRef.current = dragging; setDragging(false) }

  async function handleDownload() {
    if (!selectedImage) return
    const filename = `ai-design-${Date.now()}.jpg`
    const poster = posterImgRef.current ?? await loadImg(selectedImage)
    posterImgRef.current = poster
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = poster.naturalWidth
    canvas.height = poster.naturalHeight
    ctx.drawImage(poster, 0, 0)
    if (textOverlays.length > 0) drawTexts(ctx, canvas.width, canvas.height, textOverlays)
    if (withLogo && logoImgRef.current) {
      const logo = logoImgRef.current
      const logoW = poster.naturalWidth * 0.22
      const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW
      ctx.drawImage(logo, poster.naturalWidth * logoPos.x - logoW / 2, poster.naturalHeight * logoPos.y - logoH / 2, logoW, logoH)
    }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    try {
      saveToGallery({ dataUrl, filename, source: 'image-design' }, user?.username)
    } catch (e) {
      console.error('Gallery save failed', e)
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#f0f2f7' }}>
      {/* Header */}
      <header className="bigoffs-header px-6 flex items-center justify-between flex-shrink-0" style={{ height: 60 }}>
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-lg font-bold text-white">智能推广平台</h1>
            <p className="text-xs text-slate-400">AI 图片设计</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right">
              <p className="text-sm text-white font-medium">{user.name}</p>
              <p className="text-xs text-slate-400">
                {ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: '#0034cc' }}>
              {user.name[0]}
            </div>
            <button
              onClick={logout}
              className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
            >
              退出
            </button>
          </div>
        )}
      </header>

      {/* Nav */}
      <nav className="bigoffs-header border-b border-white/10 px-6 flex gap-1 flex-shrink-0">
        {[
          { label: '运营日历', href: '/calendar', icon: '📅' },
          { label: '模板社区', href: '/templates', icon: '🎨' },
          { label: 'AI 换装', href: '/tryon', icon: '👗' },
          { label: 'AI 图片设计', href: '/image-design', icon: '✨', active: true },
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

      {/* Main */}
      <main className="flex-1 w-full px-6 py-4 flex gap-4 overflow-hidden">
        {/* Left panel */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Reference image upload */}
          <div className="glass-card rounded-2xl p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              参考图（可选，最多4张）
            </label>
            {refImages.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                {refImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img.preview} alt={`参考图${i + 1}`} className="w-full h-20 object-cover rounded-lg" />
                    <button
                      onClick={() => setRefImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center text-xs shadow"
                    >✕</button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">图{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
            {refImages.length < 4 && (
              <div
                onDrop={handleRefDrop}
                onDragOver={e => { e.preventDefault(); setRefDragOver(true) }}
                onDragLeave={() => setRefDragOver(false)}
                onClick={() => refInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl h-20 flex flex-col items-center justify-center cursor-pointer transition-colors ${refDragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-300 hover:bg-slate-50'}`}
              >
                <svg className="w-5 h-5 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-xs text-slate-400">
                  {refImages.length === 0 ? '拖拽或点击上传参考图' : `再添加一张（${refImages.length}/4）`}
                </p>
              </div>
            )}
            <input
              ref={refInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { Array.from(e.target.files ?? []).forEach(f => handleRefFile(f)); e.target.value = '' }}
            />
          </div>

          {/* Prompt */}
          <div className="glass-card rounded-2xl p-4 ring-2 ring-blue-300/40">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#0034cc' }} />
              提示词 <span className="text-slate-400 font-normal text-xs">（从这里开始）</span>
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="描述你想生成的图片内容，例如：一只可爱的橘猫坐在窗台上，阳光照射，背景是城市街景..."
              rows={4}
              className="w-full bg-white border-2 border-blue-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:border-blue-400 transition-colors"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { label: '🌅 环境光影', hint: '黄金时段阳光、霓虹夜景、柔和室内光' },
                { label: '👗 穿着动作', hint: '模特全身正面站立、侧身回眸、动感跑步' },
                { label: '🎨 滤镜构图', hint: '胶片质感、三分构图、浅景深虚化背景' },
              ].map(d => (
                <button
                  key={d.label}
                  type="button"
                  title={d.hint}
                  onClick={() => setPrompt(p => p ? `${p}，${d.hint}` : d.hint)}
                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs rounded-lg transition-colors border border-blue-200"
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">点击维度标签可快速追加描述词</p>
          </div>

          {/* Style */}
          <div className="glass-card rounded-2xl p-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">风格</label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    style === s.value
                      ? 'text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                  style={style === s.value ? { background: '#0034cc' } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ratio */}
          <div className="glass-card rounded-2xl p-4">
            <label className="block text-sm font-medium text-slate-600 mb-2">图片比例</label>
            <div className="flex flex-wrap gap-2">
              {RATIO_OPTIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRatio(r.value)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    ratio === r.value
                      ? 'text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                  style={ratio === r.value ? { background: '#0034cc' } : {}}
                >
                  <span
                    className="border-2 border-current"
                    style={{
                      width: `${Math.round(20 * (r.w / Math.max(r.w, r.h)))}px`,
                      height: `${Math.round(20 * (r.h / Math.max(r.w, r.h)))}px`,
                      minWidth: '10px',
                      minHeight: '10px',
                    }}
                  />
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="glass-card rounded-2xl p-4">
            <label className="block text-sm font-medium text-slate-600 mb-3">生成数量</label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    count === n
                      ? 'text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                  style={count === n ? { background: '#0034cc' } : {}}
                >
                  {n}张
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={() => handleGenerate()}
            disabled={generating || !prompt.trim()}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: '#0034cc' }}
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                生成中...
              </>
            ) : '立即生成'}
          </button>
        </div>

        {/* Right panel: results */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <canvas ref={canvasRef} className="hidden" />

          {/* Main preview */}
          <div className="glass-card rounded-2xl flex-1 min-h-0 overflow-hidden relative flex items-center justify-center p-3">
            {generating ? (
              <div className="flex flex-col items-center gap-4 text-slate-500">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: '#0034cc', borderTopColor: 'transparent' }} />
                </div>
                <p className="text-sm">AI 正在创作中，请稍候...</p>
                <p className="text-xs text-slate-400">通常需要 15-30 秒</p>
              </div>
            ) : selectedImage ? (
              <div
                ref={previewAreaRef}
                className="relative select-none"
                style={(() => {
                  const r = RATIO_OPTIONS.find(r => r.value === ratio)
                  const isPortrait = r && r.h > r.w
                  return {
                    aspectRatio: r ? `${r.w}/${r.h}` : '1/1',
                    ...(isPortrait ? { height: '100%', maxHeight: '100%' } : { width: '100%', maxWidth: '100%' }),
                    cursor: withLogo && !draggingTextRef.current ? 'move' : 'default',
                    containerType: 'inline-size',
                  }
                })()}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => { setSelectedTextIdx(null); setInlineEditIdx(null) }}
              >
                {/* 点击图片本体进入详情 */}
                <img
                  src={selectedImage}
                  alt="Generated"
                  className="w-full h-full object-contain rounded-xl cursor-pointer"
                  draggable={false}
                  onClick={e => { e.stopPropagation(); if (!wasDraggingRef.current) openDetail(selectedImage, prompt, style, ratio) }}
                />

                {/* 文字 HTML overlay — 始终显示，canvas 只用于下载合成 */}
                {(() => {
                  const allTexts = [
                    ...textOverlays.map((t, i) => ({ t, i, isPreview: false })),
                    ...(showTextEditor && editingText.content
                      ? [{ t: editingText, i: -1, isPreview: true }]
                      : []),
                  ]
                  return allTexts.map(({ t, i, isPreview }) => {
                    const isLocked = !isPreview && t.locked
                    const isSelected = !isPreview && !isLocked && selectedTextIdx === i
                    const isInlineEditing = !isPreview && !isLocked && inlineEditIdx === i
                    // Use % of container width so preview matches canvas download (which uses width * fontSize)
                    const fontSizePct = t.fontSize * 100
                    return (
                      <div
                        key={isPreview ? 'preview' : i}
                        className="absolute whitespace-nowrap font-bold"
                        style={{
                          left: `${t.x * 100}%`,
                          top: `${t.y * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          fontSize: `max(12px, ${fontSizePct}cqw)`,
                          color: t.color,
                          fontFamily: t.fontFamily,
                          textShadow: t.color === '#000000'
                            ? '0 0 4px #fff, 0 0 6px #fff'
                            : '0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.7)',
                          opacity: isPreview ? 0.6 : 1,
                          cursor: isPreview || isLocked ? 'default' : isSelected ? 'grab' : 'pointer',
                          userSelect: 'none',
                          padding: '4px 8px',
                          border: isSelected
                            ? '2px dashed rgba(255,255,255,0.9)'
                            : '2px dashed transparent',
                          borderRadius: 4,
                          boxShadow: isSelected ? '0 0 0 1px rgba(0,0,0,0.4)' : 'none',
                          pointerEvents: isPreview || isLocked ? 'none' : 'auto',
                          minWidth: 40,
                        }}
                        onMouseDown={isPreview || isLocked ? undefined : e => {
                          if (isInlineEditing) return
                          e.stopPropagation()
                          setSelectedTextIdx(i)
                          startTextDrag(e, i)
                        }}
                        onTouchStart={isPreview || isLocked ? undefined : e => {
                          if (isInlineEditing) return
                          e.stopPropagation()
                          setSelectedTextIdx(i)
                          startTextDrag(e, i)
                        }}
                        onClick={e => {
                          e.stopPropagation()
                          if (!isPreview && !isLocked) {
                            setSelectedTextIdx(i)
                            setInlineEditIdx(i)
                            setTimeout(() => inlineInputRef.current?.focus(), 0)
                          }
                        }}
                      >
                        {isInlineEditing ? (
                          <input
                            ref={inlineInputRef}
                            value={t.content}
                            onChange={e => {
                              const updated = textOverlays.map((o, idx) => idx === i ? { ...o, content: e.target.value } : o)
                              setTextOverlays(updated)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                setInlineEditIdx(null)
                              }
                              e.stopPropagation()
                            }}
                            onBlur={() => { setInlineEditIdx(null) }}
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            className="bg-transparent outline-none border-none text-inherit font-bold"
                            style={{
                              fontSize: 'inherit',
                              color: 'inherit',
                              fontFamily: 'inherit',
                              width: Math.max(60, t.content.length * 20) + 'px',
                              caretColor: t.color === '#000000' ? '#000' : '#fff',
                              textShadow: 'inherit',
                            }}
                          />
                        ) : (
                          t.content || '\u00A0'
                        )}
                        {isSelected && !isInlineEditing && (
                          <button
                            className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center shadow-lg"
                            style={{ fontSize: 11, lineHeight: 1 }}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); handleRemoveText(i) }}
                          >✕</button>
                        )}
                      </div>
                    )
                  })
                })()}

                {/* Logo HTML overlay */}
                {withLogo && (
                  <img
                    src="/bigoffs-logo.png"
                    alt="Logo"
                    className="absolute pointer-events-none"
                    style={{
                      left: `${logoPos.x * 100}%`,
                      top: `${logoPos.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '22%',
                      height: 'auto',
                    }}
                  />
                )}

                {/* Logo 拖动辅助线 */}
                {dragging && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l border-dashed border-white/40" />
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t border-dashed border-white/40" />
                    {logoPos.x === 0.5 && <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l-2 border-yellow-400" />}
                    {logoPos.y === 0.5 && <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t-2 border-yellow-400" />}
                  </div>
                )}

                {withLogo && (
                  <span className="absolute top-3 right-3 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-medium pointer-events-none">
                    {dragging ? '拖动中...' : '已添加 Logo · 可拖动'}
                  </span>
                )}
                {compositing && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                    <span className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 text-center px-8">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">输入提示词后点击「立即生成」</p>
              </div>
            )}
          </div>

          {/* 操作栏：文字 + Logo + 下载 */}
          {selectedImage && !generating && (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-64">

              <div className="flex gap-2">
                {!withLogo ? (
                  <button onClick={handleAddLogo} disabled={compositing}
                    className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 disabled:opacity-40 text-sm font-medium rounded-lg transition-colors">
                    {compositing
                      ? <><span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />处理中...</>
                      : <><img src="/bigoffs-logo.png" alt="" className="h-4 w-auto" />添加 Logo</>}
                  </button>
                ) : (
                  <button onClick={handleRemoveLogo}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
                    ✕ 移除 Logo
                  </button>
                )}

                {/* 下载按钮 */}
                <button
                  onClick={() => handleDownload()}
                  className="flex-1 py-2 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  style={{ background: '#0034cc' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下载图片
                </button>
              </div>
            </div>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-3">
              {images.map(img => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(img.url)}
                  className={`relative rounded-xl overflow-hidden flex-shrink-0 transition-all ${
                    selectedImage === img.url
                      ? 'opacity-100'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    width: 100,
                    height: 100,
                    ...(selectedImage === img.url ? { outline: '2px solid #0034cc', outlineOffset: 2 } : {}),
                  }}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* History sidebar */}
        <div className="w-44 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 px-1 flex-shrink-0">历史记录</p>
          {history.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-slate-400 text-center">生成图片后<br/>将显示在这里</p>
            </div>
          )}
          {history.map((item, index) => (
            <div key={item.id} className="relative group flex-shrink-0">
              <button
                onClick={async () => {
                  const fullUrl = await idbGet(item.id) ?? item.url
                  openDetail(fullUrl, item.prompt, item.style, item.ratio, index)
                }}
                className="w-full rounded-xl overflow-hidden block"
              >
                <img src={item.url} alt="" className="w-full object-cover rounded-xl hover:opacity-90 transition-opacity" style={{ aspectRatio: item.ratio.replace(':', '/') }} />
                <p className="text-xs text-slate-500 mt-1 px-0.5 truncate">{item.prompt}</p>
              </button>
              <button
                onClick={() => deleteHistory(item.id)}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white text-xs items-center justify-center shadow hidden group-hover:flex"
              >✕</button>
            </div>
          ))}
        </div>
      </main>

      {/* Detail modal */}
      {detailImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setDetailImage(null)}>
          <div
            className="relative bg-white rounded-2xl shadow-2xl flex overflow-hidden"
            style={{ width: '85vw', maxWidth: 1100, height: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setDetailImage(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center text-sm"
            >✕</button>

            {/* Image */}
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-6 relative">
              <img src={detailImage} alt="" className="max-w-full max-h-full object-contain rounded-xl shadow" />
              {/* Prev arrow */}
              {detailHistoryIndex !== null && detailHistoryIndex < history.length - 1 && (
                <button
                  onClick={() => navigateHistory(1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {/* Next arrow */}
              {detailHistoryIndex !== null && detailHistoryIndex > 0 && (
                <button
                  onClick={() => navigateHistory(-1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              {/* Position indicator */}
              {detailHistoryIndex !== null && history.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/40 text-white text-xs px-2.5 py-1 rounded-full">
                  {detailHistoryIndex + 1} / {history.length}
                </div>
              )}
            </div>

            {/* Right panel */}
            <div className="w-72 flex-shrink-0 flex flex-col gap-4 p-6 border-l border-slate-100 overflow-y-auto">
              <div>
                <p className="text-xs text-slate-400 mb-1">提示词</p>
                <p className="text-sm text-slate-800 leading-relaxed">{detailPrompt}</p>
              </div>
              <div className="flex gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">风格</p>
                  <p className="text-sm font-medium text-slate-700">{STYLE_OPTIONS.find(s => s.value === detailStyle)?.label ?? detailStyle}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">比例</p>
                  <p className="text-sm font-medium text-slate-700">{detailRatio}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={() => {
                    setPrompt(detailPrompt)
                    setStyle(detailStyle)
                    setRatio(detailRatio)
                    setDetailImage(null)
                    handleGenerate(detailPrompt, detailStyle, detailRatio)
                  }}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: '#0034cc' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  重新生成
                </button>
                <button
                  onClick={async () => {
                    // Load this image into the main preview and trigger logo compositing
                    setSelectedImage(detailImage!)
                    setRatio(detailRatio)
                    setDetailImage(null)
                    // Small delay to let state settle before compositing
                    setTimeout(async () => {
                      try {
                        const poster = await loadImg(detailImage!)
                        const logo = await loadImg('/bigoffs-logo.png')
                        posterImgRef.current = poster
                        logoImgRef.current = logo
                        setWithLogo(true)
                      } catch (e) {
                        console.error('Logo compositing failed', e)
                      }
                    }, 50)
                  }}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <img src="/bigoffs-logo.png" alt="" className="h-4 w-auto" />
                  一键添加 Logo
                </button>
                <button
                  onClick={async () => {
                    const a = document.createElement('a')
                    a.href = detailImage!
                    a.download = `ai-design-${Date.now()}.jpg`
                    a.click()
                    try {
                      const { urlToDataUrl, saveToGallery } = await import('@/lib/gallery')
                      const dataUrl = await urlToDataUrl(detailImage!)
                      saveToGallery({ dataUrl, filename: a.download, source: 'image-design' }, user?.username)
                    } catch {}
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下载图片
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
