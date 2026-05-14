'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { TryOnStatus, GeminiAnalysis, TryOnResult } from '@/types'
import { BACKGROUNDS } from '@/lib/mockAI'
import { saveToGallery, urlToDataUrl } from '@/lib/gallery'
import { OTHER_BRANDS, getBrandLogoUrl, getBrandLabel } from '@/lib/brands'
import { downloadDataUrl } from '@/lib/download'
import BackgroundSelector from './BackgroundSelector'
import StickerEditor from './StickerEditor'

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

  // Logo 浮层状态 — 两个独立槽位：BigOffs 右上 + 合作品牌左上，可同时存在
  type LogoData = { srcUrl: string; pos: { x: number; y: number }; scale: number; aspect: number }
  type LogoSlot = 'bigoffs' | 'partner'
  const [bigoffsLogo, setBigoffsLogo] = useState<LogoData | null>(null)
  const [partnerLogo, setPartnerLogo] = useState<LogoData | null>(null)
  const [dragging, setDragging] = useState<LogoSlot | null>(null)
  const [compositing, setCompositing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const resultImgRef = useRef<HTMLImageElement>(null)

  function getLogo(slot: LogoSlot): LogoData | null {
    return slot === 'bigoffs' ? bigoffsLogo : partnerLogo
  }
  function patchLogo(slot: LogoSlot, patch: Partial<LogoData>) {
    const setter = slot === 'bigoffs' ? setBigoffsLogo : setPartnerLogo
    setter(prev => (prev ? { ...prev, ...patch } : prev))
  }

  // 品牌选择
  const [selectedBrand, setSelectedBrand] = useState('none')

  // 素材编辑器
  const [showStickerEditor, setShowStickerEditor] = useState(false)
  const [stickerEditedUrl, setStickerEditedUrl] = useState<string | null>(null)
  const [stickerBaseUrl, setStickerBaseUrl] = useState<string | null>(null)

  // 切换结果图时重置
  useEffect(() => {
    setBigoffsLogo(null)
    setPartnerLogo(null)
    setSelectedBrand('none')
    setStickerEditedUrl(null)
    setStickerBaseUrl(null)
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


  // Bake all active logo slots onto the base image, return dataURL
  async function bakeAllLogos(baseUrl: string): Promise<string> {
    const base = await loadImage(baseUrl)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = base.naturalWidth
    canvas.height = base.naturalHeight
    ctx.drawImage(base, 0, 0)
    for (const slot of ['bigoffs', 'partner'] as const) {
      const logo = getLogo(slot)
      if (!logo) continue
      const logoImg = await loadImage(logo.srcUrl)
      const logoW = base.naturalWidth * logo.scale
      const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW
      const logoX = base.naturalWidth * logo.pos.x - logoW / 2
      const logoY = base.naturalHeight * logo.pos.y - logoH / 2
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH)
    }
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  async function loadIntoSlot(slot: LogoSlot, url: string, defaultPos: { x: number; y: number }, brandValue?: string) {
    if (!resultUrl) return
    setCompositing(true)
    try {
      const img = await loadImage(url)
      const data: LogoData = {
        srcUrl: url,
        pos: defaultPos,
        scale: 0.22,
        aspect: img.naturalHeight / img.naturalWidth,
      }
      if (slot === 'bigoffs') setBigoffsLogo(data)
      else setPartnerLogo(data)
      if (brandValue) setSelectedBrand(brandValue)
      setStickerEditedUrl(null)
    } catch (e) {
      console.error('Logo load failed', e)
      alert('Logo 加载失败，请重试')
    } finally {
      setCompositing(false)
    }
  }

  async function handleAddBigoffsLogo() {
    await loadIntoSlot('bigoffs', '/bigoffs-logo.png', { x: 0.85, y: 0.10 })
  }

  function handleRemoveSlot(slot: LogoSlot) {
    if (slot === 'bigoffs') setBigoffsLogo(null)
    else { setPartnerLogo(null); setSelectedBrand('none') }
  }

  // ---- Drag / Resize handlers (per slot) --------------------------
  function startLogoDrag(e: React.PointerEvent, slot: LogoSlot) {
    if ((e.target as HTMLElement).dataset.handle) return
    e.preventDefault()
    e.stopPropagation()
    const overlay = previewAreaRef.current
    const logo = getLogo(slot)
    if (!overlay || !logo) return
    const rect = overlay.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const origX = logo.pos.x * rect.width
    const origY = logo.pos.y * rect.height
    const pid = e.pointerId
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(pid)
    setDragging(slot)

    const onMove = (ev: PointerEvent) => {
      let nx = Math.max(0.02, Math.min(0.98, (origX + ev.clientX - startX) / rect.width))
      let ny = Math.max(0.02, Math.min(0.98, (origY + ev.clientY - startY) / rect.height))
      if (Math.abs(nx - 0.5) < 0.015) nx = 0.5
      if (Math.abs(ny - 0.5) < 0.015) ny = 0.5
      patchLogo(slot, { pos: { x: nx, y: ny } })
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      try { target.releasePointerCapture(pid) } catch {}
      setDragging(null)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  function startLogoResize(e: React.PointerEvent, slot: LogoSlot) {
    e.preventDefault()
    e.stopPropagation()
    const overlay = previewAreaRef.current
    const logo = getLogo(slot)
    if (!overlay || !logo) return
    const rect = overlay.getBoundingClientRect()
    const cx = logo.pos.x * rect.width
    const cy = logo.pos.y * rect.height
    const startDist = Math.hypot(e.clientX - rect.left - cx, e.clientY - rect.top - cy) || 1
    const baseScale = logo.scale
    const pid = e.pointerId
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(pid)

    const onMove = (ev: PointerEvent) => {
      const d = Math.hypot(ev.clientX - rect.left - cx, ev.clientY - rect.top - cy)
      const k = d / startDist
      patchLogo(slot, { scale: Math.max(0.05, Math.min(0.6, +(baseScale * k).toFixed(4))) })
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

  async function handleDownload() {
    if (!resultUrl) return
    const hasAnyLogo = !!(bigoffsLogo || partnerLogo)
    const brandLabel = getBrandLabel(selectedBrand)
    let src: string
    let filename: string
    if (stickerEditedUrl) {
      src = stickerEditedUrl
      filename = 'result-with-stickers.png'
    } else if (hasAnyLogo) {
      setCompositing(true)
      try {
        src = await bakeAllLogos(resultUrl)
      } finally {
        setCompositing(false)
      }
      const tag = partnerLogo ? brandLabel.replace(/\s+/g, '-') : 'BigOffs'
      filename = `${tag}-result.jpg`
    } else {
      src = resultUrl
      filename = 'result.jpg'
    }

    // Convert to dataURL for both download and gallery save
    const dataUrl = src.startsWith('data:') ? src : await urlToDataUrl(src)
    await downloadDataUrl(dataUrl, filename)

    try {
      await saveToGallery({ dataUrl, filename, source: 'tryon' }, username)
    } catch (e) {
      console.error('Gallery save failed', e)
    }
  }

  async function openStickerEditor() {
    if (!resultUrl) return
    const hasAnyLogo = !!(bigoffsLogo || partnerLogo)
    if (hasAnyLogo && !stickerEditedUrl) {
      setCompositing(true)
      try {
        const baked = await bakeAllLogos(resultUrl)
        setStickerBaseUrl(baked)
      } catch (e) {
        console.error('bake before sticker editor failed', e)
        setStickerBaseUrl(stickerEditedUrl || resultUrl)
      } finally {
        setCompositing(false)
      }
    } else {
      setStickerBaseUrl(stickerEditedUrl || resultUrl)
    }
    setShowStickerEditor(true)
  }

  const displaySrc = stickerEditedUrl || resultUrl
  const showLogos = !stickerEditedUrl
  const activeBrandLabel = getBrandLabel(selectedBrand)

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
            className="relative inline-block max-w-full max-h-full"
          >
            <img
              ref={resultImgRef}
              src={displaySrc}
              alt="result"
              draggable={false}
              className="block max-w-full select-none"
              style={{ maxHeight: 'min(70vh, calc(100vh - 220px))' }}
            />

            {showLogos && (
              <>
                {/* Alignment guides while dragging any logo */}
                {dragging && (() => {
                  const logo = getLogo(dragging)
                  if (!logo) return null
                  return (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l-2 border-dashed border-white/60" />
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t-2 border-dashed border-white/60" />
                      {logo.pos.x === 0.5 && (
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px border-l-2 border-solid border-amber-400" />
                      )}
                      {logo.pos.y === 0.5 && (
                        <div className="absolute left-0 right-0 top-1/2 -translate-y-px border-t-2 border-solid border-amber-400" />
                      )}
                    </div>
                  )
                })()}

                {/* Render one overlay per active slot */}
                {(['bigoffs', 'partner'] as const).map(slot => {
                  const logo = getLogo(slot)
                  if (!logo) return null
                  return (
                    <div
                      key={slot}
                      onPointerDown={e => startLogoDrag(e, slot)}
                      className="absolute"
                      style={{
                        left: `${logo.pos.x * 100}%`,
                        top: `${logo.pos.y * 100}%`,
                        width: `${logo.scale * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        cursor: dragging === slot ? 'grabbing' : 'grab',
                        touchAction: 'none',
                      }}
                    >
                      <img
                        src={logo.srcUrl}
                        alt="logo"
                        draggable={false}
                        className="block w-full h-auto select-none"
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* Selection frame */}
                      <div
                        className="absolute pointer-events-none border-2 border-dashed"
                        style={{ inset: -4, borderColor: '#fceb42' }}
                      />
                      {/* Remove button (top-right of overlay) */}
                      <button
                        data-handle="remove"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); handleRemoveSlot(slot) }}
                        className="absolute rounded-full flex items-center justify-center"
                        style={{
                          right: -14, top: -14, width: 22, height: 22,
                          background: '#ef4444', border: '2px solid #fff',
                          color: '#fff', fontSize: 12, lineHeight: 1, fontWeight: 700,
                          cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                        }}
                        title="移除此 Logo"
                      >✕</button>
                      {/* Resize handle (bottom-right) */}
                      <div
                        data-handle="resize"
                        onPointerDown={e => startLogoResize(e, slot)}
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
                      {/* Decorative corner ticks */}
                      {(['nw', 'sw'] as const).map(corner => (
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
                  )
                })}

                {(bigoffsLogo || partnerLogo) && (
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-medium pointer-events-none">
                    {dragging ? '拖动中...' : '拖动定位 · 拖黄色角缩放 · 点 ✕ 移除'}
                  </span>
                )}
              </>
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
          <div className="flex gap-2 min-w-0">
            <button
              onClick={handleAddBigoffsLogo}
              disabled={compositing}
              className="flex items-center gap-1.5 px-2 md:px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
              title="添加 BigOffs Logo"
            >
              {compositing && selectedBrand === 'bigoffs'
                ? <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                : <img src="/bigoffs-logo.png" alt="" className="h-4 w-auto" />
              }
              <span className="hidden sm:inline">添加 Logo</span>
              <span className="sm:hidden">Logo</span>
            </button>

            <select
              value={selectedBrand === 'bigoffs' ? 'none' : selectedBrand}
              disabled={compositing}
              onChange={async e => {
                const v = e.target.value
                if (v === 'none') {
                  setSelectedBrand('none')
                  return
                }
                const url = getBrandLogoUrl(v)
                if (url) await loadIntoSlot('partner', url, { x: 0.15, y: 0.10 }, v)
              }}
              className="flex-1 min-w-0 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-2 md:px-3 py-2 focus:outline-none focus:border-blue-400 disabled:opacity-60"
            >
              {OTHER_BRANDS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>

          </div>

          {/* 下载按钮始终显示 */}
          <button
            onClick={handleDownload}
            disabled={compositing}
            className="w-full py-2 px-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 truncate"
            style={{ background: '#0034cc' }}
          >
            {stickerEditedUrl
              ? '下载（含素材）'
              : (bigoffsLogo && partnerLogo)
                ? '下载（含双 Logo）'
                : bigoffsLogo
                  ? '下载（含 BigOffs）'
                  : partnerLogo
                    ? '下载（含品牌 Logo）'
                    : '下载图片'}
          </button>

          {/* 添加素材按钮 */}
          <button
            onClick={openStickerEditor}
            disabled={!resultUrl || compositing}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            ✨ 添加素材
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

      {/* 素材编辑器 */}
      {showStickerEditor && (
        <StickerEditor
          baseImageUrl={stickerBaseUrl || displaySrc}
          onClose={() => setShowStickerEditor(false)}
          onExport={async (dataUrl) => {
            setStickerEditedUrl(dataUrl)
            setShowStickerEditor(false)
            await downloadDataUrl(dataUrl, `result-with-stickers-${Date.now()}.png`)
          }}
        />
      )}
    </div>
  )
}
