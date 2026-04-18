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

export default function ImageDesignStudio() {
  const { user, logout } = useAuth()

  // Basic settings
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('realistic')
  const [ratio, setRatio] = useState('1:1')
  const [count, setCount] = useState(1)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Logo compositing state
  const [withLogo, setWithLogo] = useState(false)
  const [compositing, setCompositing] = useState(false)
  const [compositedUrl, setCompositedUrl] = useState<string | null>(null)
  const [logoPos, setLogoPos] = useState({ x: 0.5, y: 0.88 })
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const posterImgRef = useRef<HTMLImageElement | null>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    setImages([])
    setSelectedImage(null)

    try {
      const res = await fetch('/api/image-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style,
          ratio,
          count,
        }),
      })
      if (!res.ok) throw new Error('生成失败，请重试')
      const data = await res.json()
      if (!data.images?.length) throw new Error('未生成图片，请修改提示词后重试')
      setImages(data.images)
      setSelectedImage(data.images[0].url)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  // Reset logo state when selected image changes
  useEffect(() => {
    setWithLogo(false)
    setCompositedUrl(null)
    posterImgRef.current = null
    logoImgRef.current = null
    setLogoPos({ x: 0.5, y: 0.88 })
  }, [selectedImage])

  // Redraw canvas when logo position changes
  useEffect(() => {
    if (withLogo && posterImgRef.current && logoImgRef.current) redrawCanvas()
  }, [logoPos, withLogo])

  function loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  function redrawCanvas() {
    if (!posterImgRef.current || !logoImgRef.current) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const poster = posterImgRef.current
    const logo = logoImgRef.current
    canvas.width = poster.naturalWidth
    canvas.height = poster.naturalHeight
    ctx.drawImage(poster, 0, 0)
    const logoW = poster.naturalWidth * 0.22
    const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW
    const logoX = poster.naturalWidth * logoPos.x - logoW / 2
    const logoY = poster.naturalHeight * logoPos.y - logoH / 2
    ctx.drawImage(logo, logoX, logoY, logoW, logoH)
    setCompositedUrl(canvas.toDataURL('image/jpeg', 0.92))
  }

  async function handleAddLogo() {
    if (!selectedImage) return
    setCompositing(true)
    try {
      const [poster, logo] = await Promise.all([
        loadImg(selectedImage),
        loadImg('/bigoffs-logo.png'),
      ])
      posterImgRef.current = poster
      logoImgRef.current = logo
      setWithLogo(true)
      redrawCanvas()
    } catch (e) {
      console.error('Logo compositing failed', e)
    } finally {
      setCompositing(false)
    }
  }

  function handleRemoveLogo() {
    setWithLogo(false)
    setCompositedUrl(null)
    posterImgRef.current = null
    logoImgRef.current = null
  }

  function updateLogoPos(clientX: number, clientY: number) {
    const el = previewAreaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    let y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    if (Math.abs(x - 0.5) < 0.03) x = 0.5
    if (Math.abs(y - 0.5) < 0.03) y = 0.5
    setLogoPos({ x, y })
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!withLogo) return
    setDragging(true)
    updateLogoPos(e.clientX, e.clientY)
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    updateLogoPos(e.clientX, e.clientY)
  }
  function handleMouseUp() { setDragging(false) }

  function handleTouchStart(e: React.TouchEvent) {
    if (!withLogo || e.touches.length !== 1) return
    setDragging(true)
    updateLogoPos(e.touches[0].clientX, e.touches[0].clientY)
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging || e.touches.length !== 1) return
    e.preventDefault()
    updateLogoPos(e.touches[0].clientX, e.touches[0].clientY)
  }
  function handleTouchEnd() { setDragging(false) }

  async function handleDownload(url: string) {
    const filename = `ai-design-${Date.now()}.jpg`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    try {
      const dataUrl = await urlToDataUrl(url)
      saveToGallery({ dataUrl, filename, source: 'image-design' })
    } catch (e) {
      console.error('Gallery save failed', e)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-lg font-bold text-white">智能推广平台</h1>
            <p className="text-xs text-zinc-400">AI 图片设计</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-zinc-700">
            <div className="text-right">
              <p className="text-sm text-white font-medium">{user.name}</p>
              <p className="text-xs text-zinc-400">
                {ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
              {user.name[0]}
            </div>
            <button
              onClick={logout}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
            >
              退出
            </button>
          </div>
        )}
      </header>

      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 flex gap-1">
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
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex gap-6">
        {/* Left panel */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">
          {/* Prompt */}
          <div className="bg-zinc-800/50 rounded-2xl p-5">
            <label className="block text-sm font-medium text-zinc-300 mb-2">提示词</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="描述你想生成的图片内容，例如：一只可爱的橘猫坐在窗台上，阳光照射，背景是城市街景..."
              rows={5}
              className="w-full bg-zinc-700/60 border border-zinc-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Style */}
          <div className="bg-zinc-800/50 rounded-2xl p-5">
            <label className="block text-sm font-medium text-zinc-300 mb-3">风格</label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    style === s.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ratio */}
          <div className="bg-zinc-800/50 rounded-2xl p-5">
            <label className="block text-sm font-medium text-zinc-300 mb-3">图片比例</label>
            <div className="flex flex-wrap gap-2">
              {RATIO_OPTIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRatio(r.value)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    ratio === r.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
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
          <div className="bg-zinc-800/50 rounded-2xl p-5">
            <label className="block text-sm font-medium text-zinc-300 mb-3">生成数量</label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    count === n
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {n}张
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        <div className="flex-1 flex flex-col gap-4">
          <canvas ref={canvasRef} className="hidden" />

          {/* Main preview */}
          <div className="bg-zinc-800/50 rounded-2xl flex-1 overflow-hidden min-h-[480px] relative flex items-center justify-center">
            {generating ? (
              <div className="flex flex-col items-center gap-4 text-zinc-400">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-zinc-700" />
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                </div>
                <p className="text-sm">AI 正在创作中，请稍候...</p>
                <p className="text-xs text-zinc-600">通常需要 15-30 秒</p>
              </div>
            ) : selectedImage ? (
              <div
                ref={previewAreaRef}
                className={`w-full h-full relative flex items-center justify-center ${withLogo ? 'cursor-move' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={withLogo && compositedUrl ? compositedUrl : selectedImage}
                  alt="Generated"
                  className="max-w-full max-h-full object-contain rounded-xl select-none"
                  draggable={false}
                />
                {/* 拖动辅助线 */}
                {dragging && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l-2 border-dashed border-white/60" />
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t-2 border-dashed border-white/60" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white/80 bg-white/20" />
                    {logoPos.x === 0.5 && (
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l-2 border-solid border-yellow-400" />
                    )}
                    {logoPos.y === 0.5 && (
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t-2 border-solid border-yellow-400" />
                    )}
                  </div>
                )}
                {/* 状态角标 */}
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
              <div className="flex flex-col items-center gap-3 text-zinc-600">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">输入提示词后点击「立即生成」</p>
              </div>
            )}
          </div>

          {/* Logo + 下载操作栏 */}
          {selectedImage && !generating && (
            <div className="flex gap-2">
              {!withLogo ? (
                <button
                  onClick={handleAddLogo}
                  disabled={compositing}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {compositing
                    ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />处理中...</>
                    : <><img src="/bigoffs-logo.png" alt="" className="h-4 w-auto" />一键添加 Logo</>
                  }
                </button>
              ) : (
                <button
                  onClick={handleRemoveLogo}
                  className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  ✕ 移除 Logo
                </button>
              )}
              <button
                onClick={() => handleDownload(withLogo && compositedUrl ? compositedUrl : selectedImage)}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {withLogo ? '下载（含 Logo）' : '下载图片'}
              </button>
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
                      ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-900'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ width: 100, height: 100 }}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
