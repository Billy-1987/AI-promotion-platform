'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { TryOnStatus, GeminiAnalysis, TryOnResult } from '@/types'
import { BACKGROUNDS } from '@/lib/mockAI'
import { saveToGallery, urlToDataUrl } from '@/lib/gallery'
import BackgroundSelector from './BackgroundSelector'
import ExportButton from './ExportButton'

interface Props {
  status: TryOnStatus
  resultUrl: string | null
  tryOnResult: TryOnResult | null
  selectedBackground: string | null
  suggestedBackgrounds: string[]
  analysis: GeminiAnalysis | null
  isShoes: boolean
  onSelectBackground: (id: string) => void
  onGenerate: () => void
}

export default function PreviewPanel({
  status,
  resultUrl,
  tryOnResult,
  selectedBackground,
  suggestedBackgrounds,
  analysis,
  isShoes,
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
  const [logoPos, setLogoPos] = useState({ x: 0.5, y: 0.88 })
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const posterImgRef = useRef<HTMLImageElement | null>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)

  // 切换结果图时重置 logo 状态
  useEffect(() => {
    setWithLogo(false)
    setCompositedUrl(null)
    posterImgRef.current = null
    logoImgRef.current = null
  }, [resultUrl])

  function loadImage(src: string): Promise<HTMLImageElement> {
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
    if (!resultUrl) return
    setCompositing(true)
    try {
      const [poster, logo] = await Promise.all([
        loadImage(resultUrl),
        loadImage('/bigoffs-logo.png'),
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

  useEffect(() => {
    if (withLogo && posterImgRef.current && logoImgRef.current) {
      redrawCanvas()
    }
  }, [logoPos, withLogo])

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

  async function handleDownload() {
    if (!resultUrl) return
    const isLogoVersion = withLogo && compositedUrl
    const src = isLogoVersion ? compositedUrl! : resultUrl
    const filename = isLogoVersion ? 'BIGOFFS-result.jpg' : 'result.jpg'

    // 触发浏览器下载
    const a = document.createElement('a')
    a.href = src
    a.download = filename
    a.click()

    // 同步存入图库
    try {
      const dataUrl = await urlToDataUrl(src)
      saveToGallery({ dataUrl, filename, source: 'tryon' })
    } catch (e) {
      console.error('Gallery save failed', e)
    }
  }

  const displaySrc = withLogo && compositedUrl ? compositedUrl : resultUrl

  return (
    <div className="flex flex-col h-full">
      <canvas ref={canvasRef} className="hidden" />

      <h2 className="text-xl font-semibold text-white mb-4">{titleText}</h2>

      {/* Main preview area */}
      <div className="flex-1 relative rounded-xl overflow-hidden bg-zinc-800 flex items-center justify-center min-h-[400px]">
        {status === 'idle' && (
          <div className="text-center text-zinc-500">
            <div className="text-5xl mb-3">{idleIcon}</div>
            <p className="text-sm">{idleText}</p>
          </div>
        )}

        {(status === 'detecting' || status === 'ready') && bg && (
          <>
            <Image src={bg.url} alt="Background" fill className="object-cover opacity-40" sizes="600px" />
            <div className="relative z-10 text-center text-zinc-300">
              <div className="text-5xl mb-3">{readyIcon}</div>
              <p className="text-sm">{readyText}</p>
            </div>
          </>
        )}

        {status === 'processing' && (
          <>
            {bg && <Image src={bg.url} alt="Background" fill className="object-cover opacity-40" sizes="600px" />}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-300 text-sm">{processingText}</p>
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
            {/* 居中辅助线 — 拖动时显示 */}
            {dragging && (
              <div className="absolute inset-0 pointer-events-none">
                {/* 垂直中线 */}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l-2 border-dashed border-white/60" />
                {/* 水平中线 */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t-2 border-dashed border-white/60" />
                {/* 中心圆点 */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white/80 bg-white/20" />
                {/* 吸附高亮 */}
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
              <span className="absolute top-2 right-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-medium pointer-events-none">
                {dragging ? '拖动中...' : '已添加 Logo · 可拖动'}
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

      {/* Logo 操作栏 — 仅结果状态显示 */}
      {status === 'result' && resultUrl && (
        <div className="flex gap-2 mt-3">
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
            onClick={handleDownload}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {withLogo ? '下载（含 Logo）' : '下载图片'}
          </button>
        </div>
      )}

      {/* Try-on AI result card */}
      {tryOnResult && status === 'result' && (
        <div className="mt-3 p-3 bg-zinc-800 rounded-lg border border-zinc-700 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">✨ AI 上身效果分析</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-400">匹配度</span>
              <span className="text-sm font-bold text-indigo-400">{tryOnResult.fitScore}%</span>
              <div className="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${tryOnResult.fitScore}%` }} />
              </div>
            </div>
          </div>
          <p className="text-sm text-zinc-200 leading-relaxed">{tryOnResult.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {tryOnResult.styleMatch && (
              <span className="px-2 py-0.5 bg-indigo-900/40 text-indigo-300 text-xs rounded">{tryOnResult.styleMatch}</span>
            )}
            {tryOnResult.occasion && (
              <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded">📍 {tryOnResult.occasion}</span>
            )}
          </div>
        </div>
      )}

      {/* AI clothing analysis */}
      {analysis && status !== 'idle' && !tryOnResult && (
        <div className="mt-3 p-3 bg-zinc-800 rounded-lg border border-zinc-700">
          <p className="text-xs text-zinc-400 mb-1.5">✨ AI 服装分析</p>
          <p className="text-sm text-zinc-200 leading-relaxed mb-2">{analysis.productDescription}</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.colors.map((color, i) => (
              <span key={i} className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded">{color}</span>
            ))}
            {analysis.keywords.slice(0, 3).map((kw, i) => (
              <span key={i} className="px-2 py-0.5 bg-indigo-900/40 text-indigo-300 text-xs rounded">{kw}</span>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      {status !== 'idle' && (
        <>
          <BackgroundSelector
            selectedId={selectedBackground}
            suggestedOrder={suggestedBackgrounds}
            onSelect={onSelectBackground}
          />
          <button
            onClick={onGenerate}
            disabled={status === 'processing' || status === 'detecting'}
            className="w-full mt-3 py-3 rounded-lg font-semibold text-sm transition-all bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === 'processing' ? 'AI 生成中...' : '✨ 生成换装图'}
          </button>
        </>
      )}
    </div>
  )
}
