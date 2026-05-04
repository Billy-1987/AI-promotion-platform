'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { TryOnStatus, GeminiAnalysis, TryOnResult } from '@/types'
import { BACKGROUNDS } from '@/lib/mockAI'
import { saveToGallery, urlToDataUrl } from '@/lib/gallery'
import BackgroundSelector from './BackgroundSelector'

interface Props {
  status: TryOnStatus
  resultUrl: string | null
  tryOnResult: TryOnResult | null
  selectedBackground: string | null
  suggestedBackgrounds: string[]
  analysis: GeminiAnalysis | null
  isShoes: boolean
  username?: string
  onSelectBackground: (id: string) => void
  onGenerate: () => void
}

const OTHER_BRANDS = [
  { value: 'none',         label: '选择品牌',         domain: null },
  { value: 'adidas',       label: 'adidas',           domain: 'adidas.com' },
  { value: 'nike',         label: 'NIKE',             domain: 'nike.com' },
  { value: 'puma',         label: 'PUMA',             domain: 'puma.com' },
  { value: 'tnf',          label: 'THE NORTH FACE',   domain: 'thenorthface.com' },
  { value: 'newbalance',   label: 'New Balance',      domain: 'newbalance.com' },
  { value: 'converse',     label: 'CONVERSE',         domain: 'converse.com' },
  { value: 'vans',         label: 'VANS',             domain: 'vans.com' },
  { value: 'reebok',       label: 'Reebok',           domain: 'reebok.com' },
  { value: 'underarmour',  label: 'UNDER ARMOUR',     domain: 'underarmour.com' },
  { value: 'asics',        label: 'ASICS',            domain: 'asics.com' },
  { value: 'fila',         label: 'FILA',             domain: 'fila.com' },
  { value: 'custom',       label: '自定义品牌...',     domain: null },
]

function getBrandLogoUrl(value: string, customDomain?: string): string | null {
  if (value === 'bigoffs') return '/bigoffs-logo.png'
  if (value === 'custom' && customDomain) {
    return `https://cdn.brandfetch.io/${customDomain}/w/400/h/400`
  }
  const brand = OTHER_BRANDS.find(b => b.value === value)
  return brand?.domain ? `https://cdn.brandfetch.io/${brand.domain}/w/400/h/400` : null
}

function getBrandLabel(value: string, customBrand: string): string {
  if (value === 'custom') return customBrand.trim()
  if (value === 'bigoffs') return 'BigOffs'
  return OTHER_BRANDS.find(b => b.value === value)?.label ?? value
}

export default function PreviewPanel({
  status,
  resultUrl,
  tryOnResult,
  selectedBackground,
  suggestedBackgrounds,
  analysis,
  isShoes,
  username,
  onSelectBackground,
  onGenerate,
}: Props) {
  const bg = BACKGROUNDS.find(b => b.id === selectedBackground)

  const idleIcon = isShoes ? '👟' : '🖼️'
  const idleText = isShoes ? '上传鞋子图后预览场景展示效果' : '上传服装图后预览换装效果'
  const readyIcon = isShoes ? '👟' : '👗'
  const readyText = isShoes ? '选择场景并点击生成展示图' : '选择背景并点击生成换装图'
  const processingText = isShoes ? 'AI 正在生成鞋子场景图...' : 'AI 正在生成换装效果...'
  const titleText = isShoes ? '场景展示预览' : '换装效果预览'

  // Logo 合成状态
  const [withLogo, setWithLogo] = useState(false)
  const [compositing, setCompositing] = useState(false)
  const [compositedUrl, setCompositedUrl] = useState<string | null>(null)
  const [logoPos, setLogoPos] = useState({ x: 0.88, y: 0.10 })
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const posterImgRef = useRef<HTMLImageElement | null>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)

  // 品牌选择
  const [selectedBrand, setSelectedBrand] = useState('none')
  const [customBrand, setCustomBrand] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  // 切换结果图时重置
  useEffect(() => {
    setWithLogo(false)
    setCompositedUrl(null)
    posterImgRef.current = null
    logoImgRef.current = null
    setSelectedBrand('none')
    setCustomBrand('')
    setShowCustomInput(false)
    setLogoPos({ x: 0.88, y: 0.10 })
  }, [resultUrl])

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      // Only set crossOrigin for external URLs — local paths don't need it
      // and setting it on same-origin assets can cause CORS failures in some browsers
      if (src.startsWith('http://') || src.startsWith('https://')) {
        img.crossOrigin = 'anonymous'
      }
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }


  function redrawCanvas() {
    const canvas = canvasRef.current
    if (!canvas || !posterImgRef.current) return
    const ctx = canvas.getContext('2d')!
    const poster = posterImgRef.current

    canvas.width = poster.naturalWidth
    canvas.height = poster.naturalHeight
    ctx.drawImage(poster, 0, 0)

    if (logoImgRef.current) {
      const logo = logoImgRef.current
      const logoW = poster.naturalWidth * 0.22
      const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW
      const logoX = poster.naturalWidth * logoPos.x - logoW / 2
      const logoY = poster.naturalHeight * logoPos.y - logoH / 2
      ctx.drawImage(logo, logoX, logoY, logoW, logoH)
    }

    setCompositedUrl(canvas.toDataURL('image/jpeg', 0.92))
  }

  async function handleAddBigoffsLogo() {
    if (!resultUrl) return
    setCompositing(true)
    try {
      const [poster, logo] = await Promise.all([loadImage(resultUrl), loadImage('/bigoffs-logo.png')])
      posterImgRef.current = poster
      logoImgRef.current = logo
      setSelectedBrand('bigoffs')
      // Draw immediately with the loaded images, don't rely on state update timing
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      canvas.width = poster.naturalWidth
      canvas.height = poster.naturalHeight
      ctx.drawImage(poster, 0, 0)
      const logoW = poster.naturalWidth * 0.22
      const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW
      ctx.drawImage(logo, poster.naturalWidth * logoPos.x - logoW / 2, poster.naturalHeight * logoPos.y - logoH / 2, logoW, logoH)
      setCompositedUrl(canvas.toDataURL('image/jpeg', 0.92))
      setWithLogo(true)
    } catch (e) {
      console.error('Logo compositing failed', e)
      alert('Logo 加载失败，请检查网络后重试')
    } finally {
      setCompositing(false)
    }
  }

  async function handleAddOtherLogo() {
    if (!resultUrl) return
    const logoUrl = getBrandLogoUrl(selectedBrand, customBrand)
    if (!logoUrl || selectedBrand === 'none') return
    setCompositing(true)
    try {
      const [poster, logo] = await Promise.all([loadImage(resultUrl), loadImage(logoUrl)])
      posterImgRef.current = poster
      logoImgRef.current = logo
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      canvas.width = poster.naturalWidth
      canvas.height = poster.naturalHeight
      ctx.drawImage(poster, 0, 0)
      const logoW = poster.naturalWidth * 0.22
      const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW
      ctx.drawImage(logo, poster.naturalWidth * logoPos.x - logoW / 2, poster.naturalHeight * logoPos.y - logoH / 2, logoW, logoH)
      setCompositedUrl(canvas.toDataURL('image/jpeg', 0.92))
      setWithLogo(true)
    } catch (e) {
      console.error('Logo compositing failed', e)
      alert('Logo 加载失败，请检查品牌域名是否正确')
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

  // 拖动时重绘
  useEffect(() => {
    if (withLogo && posterImgRef.current) redrawCanvas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoPos])

  function updateLogoPos(clientX: number, clientY: number) {
    const el = previewAreaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let x = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width))
    let y = Math.max(0.05, Math.min(0.95, (clientY - rect.top) / rect.height))
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

  async function handleDownload() {
    if (!resultUrl) return
    const isLogoVersion = withLogo && compositedUrl
    const src = isLogoVersion ? compositedUrl! : resultUrl
    const brandLabel = getBrandLabel(selectedBrand, customBrand)
    const filename = isLogoVersion ? `${brandLabel.replace(/\s+/g, '-')}-result.jpg` : 'result.jpg'

    const a = document.createElement('a')
    a.href = src
    a.download = filename
    a.click()

    try {
      const dataUrl = await urlToDataUrl(src)
      saveToGallery({ dataUrl, filename, source: 'tryon' }, username)
    } catch (e) {
      console.error('Gallery save failed', e)
    }
  }

  const displaySrc = withLogo && compositedUrl ? compositedUrl : resultUrl
  const activeBrandLabel = getBrandLabel(selectedBrand, customBrand)

  return (
    <div className="flex flex-col h-full">
      <canvas ref={canvasRef} className="hidden" />

      <h2 className="text-xl font-semibold text-slate-800 mb-4">{titleText}</h2>

      {/* Main preview area */}
      <div className="flex-1 relative rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[400px]">
        {status === 'idle' && (
          <div className="text-center text-slate-400">
            <div className="text-5xl mb-3">{idleIcon}</div>
            <p className="text-sm">{idleText}</p>
          </div>
        )}

        {(status === 'detecting' || status === 'ready') && bg && (
          <>
            <Image src={bg.url} alt="Background" fill className="object-cover opacity-40" sizes="600px" />
            <div className="relative z-10 text-center text-slate-600">
              <div className="text-5xl mb-3">{readyIcon}</div>
              <p className="text-sm">{readyText}</p>
            </div>
          </>
        )}

        {status === 'processing' && (
          <>
            {bg && <Image src={bg.url} alt="Background" fill className="object-cover opacity-40" sizes="600px" />}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0034cc', borderTopColor: 'transparent' }} />
              <p className="text-slate-600 text-sm">{processingText}</p>
            </div>
          </>
        )}

        {status === 'result' && displaySrc && (
          <div
            ref={previewAreaRef}
            className={`w-full h-full relative ${withLogo ? 'cursor-move' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={displaySrc}
              alt="result"
              className="w-full h-full object-cover select-none"
              draggable={false}
            />
            {/* 辅助线 */}
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
            {withLogo && (
              <span className="absolute top-2 left-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-medium pointer-events-none">
                {dragging ? '拖动中...' : `已添加 ${activeBrandLabel} · 可拖动`}
              </span>
            )}
            {compositing && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 品牌 Logo 操作区 — 仅结果状态显示 */}
      {status === 'result' && resultUrl && (
        <div className="mt-3 space-y-2">
          {/* 第一行：BigOffs 一键按钮 + 其他品牌下拉 */}
          <div className="flex gap-2">
            <button
              onClick={handleAddBigoffsLogo}
              disabled={compositing}
              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {compositing && selectedBrand === 'bigoffs'
                ? <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                : <img src="/bigoffs-logo.png" alt="" className="h-4 w-auto" />
              }
              一键打 Logo
            </button>

            <select
              value={selectedBrand === 'bigoffs' ? 'none' : selectedBrand}
              onChange={e => {
                const v = e.target.value
                setSelectedBrand(v)
                setShowCustomInput(v === 'custom')
                if (v !== 'custom') setCustomBrand('')
              }}
              className="flex-1 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            >
              {OTHER_BRANDS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>

            {selectedBrand !== 'none' && selectedBrand !== 'bigoffs' && (
              <button
                onClick={handleAddOtherLogo}
                disabled={compositing || (selectedBrand === 'custom' && !customBrand.trim())}
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                {compositing ? <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin inline-block" /> : '添加'}
              </button>
            )}

            {withLogo && (
              <button
                onClick={handleRemoveLogo}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                ✕ 移除
              </button>
            )}
          </div>

          {showCustomInput && (
            <input
              type="text"
              value={customBrand}
              onChange={e => setCustomBrand(e.target.value)}
              placeholder="输入品牌官网域名，如 lululemon.com"
              maxLength={60}
              className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 placeholder-slate-400 focus:outline-none focus:border-blue-400"
            />
          )}

          {/* 下载按钮始终显示 */}
          <button
            onClick={handleDownload}
            className="w-full py-2 text-white text-sm font-medium rounded-lg transition-colors"
            style={{ background: '#0034cc' }}
          >
            {withLogo ? `下载（含 ${activeBrandLabel}）` : '下载图片'}
          </button>
        </div>
      )}

      {/* Try-on AI result card */}
      {tryOnResult && status === 'result' && (
        <div className="mt-3 p-3 glass-card rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">✨ AI 上身效果分析</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">匹配度</span>
              <span className="text-sm font-bold" style={{ color: '#0034cc' }}>{tryOnResult.fitScore}%</span>
              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${tryOnResult.fitScore}%`, background: '#0034cc' }} />
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{tryOnResult.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {tryOnResult.styleMatch && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{tryOnResult.styleMatch}</span>
            )}
            {tryOnResult.occasion && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">📍 {tryOnResult.occasion}</span>
            )}
          </div>
        </div>
      )}

      {/* AI clothing analysis */}
      {analysis && status !== 'idle' && !tryOnResult && (
        <div className="mt-3 p-3 glass-card rounded-lg">
          <p className="text-xs text-slate-500 mb-1.5">✨ AI 服装分析</p>
          <p className="text-sm text-slate-700 leading-relaxed mb-2">{analysis.productDescription}</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.colors.map((color, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{color}</span>
            ))}
            {analysis.keywords.slice(0, 3).map((kw, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{kw}</span>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      {status !== 'idle' && (
        <>
          <button
            onClick={onGenerate}
            disabled={status === 'processing' || status === 'detecting'}
            className="w-full mt-3 py-3 rounded-lg font-semibold text-sm transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#0034cc' }}
          >
            {status === 'detecting' ? 'AI 分析中...' : status === 'processing' ? 'AI 生成中...' : '✨ 生成换装图'}
          </button>
          <BackgroundSelector
            selectedId={selectedBackground}
            suggestedOrder={suggestedBackgrounds}
            onSelect={onSelectBackground}
          />
        </>
      )}
    </div>
  )
}
