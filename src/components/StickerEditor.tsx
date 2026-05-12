'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { uid } from '@/lib/utils'

export interface Sticker {
  id: string
  type: 'text' | 'emoji' | 'shape' | 'logo'
  x: number
  y: number
  rotation: number
  flipH: boolean
  flipV: boolean
  // Text
  text?: string
  font?: string
  sizeRatio?: number
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  // Text effects (each independent toggle)
  hasStroke?: boolean
  strokeColor?: string
  hasShadow?: boolean
  shadowColor?: string
  hasBg?: boolean
  bgColor?: string
  curve?: number  // 0 or undefined = off; 0.05..0.4 = sagitta ratio
  // Emoji
  char?: string
  // Shape
  shape?: string
  wRatio?: number
  hRatio?: number
  fill?: string
  fillOpacity?: number
  stroke?: string
  strokeWidthRatio?: number
  arrowRatio?: number
  waveCount?: number
  // Logo
  logoId?: string
  url?: string
}

export const FONTS = [
  { id: 'calibri',  label: 'Calibri', css: 'Calibri, "PingFang SC", "Microsoft YaHei", sans-serif' },
  { id: 'yahei',    label: '微软雅黑', css: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { id: 'pingfang', label: '苹方',     css: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { id: 'simsun',   label: '宋体',     css: 'SimSun, "Songti SC", serif' },
  { id: 'times',    label: 'Times',   css: '"Times New Roman", Times, serif' },
  { id: 'impact',   label: 'Impact',  css: 'Impact, sans-serif' },
]

export const EMOJI_PALETTE = [
  '⭐','✨','💫','🌟','❤️','🔥','💯','🎉',
  '👑','🌹','🌸','🍃','☀️','🌙','⚡','💎',
  '🎀','🎁','🏷️','✅','📍','📌','💬','💡',
  '🛍️','👠','👜','🧢','🕶️','💄','💋','😎',
]

export const SHAPES = [
  { id: 'rect',     label: '□',  kind: 'fill' as const },
  { id: 'circle',   label: '○',  kind: 'fill' as const },
  { id: 'triangle', label: '△',  kind: 'fill' as const },
  { id: 'star',     label: '☆',  kind: 'fill' as const },
  { id: 'heart',    label: '♥',  kind: 'fill' as const },
  { id: 'line',     label: '—',  kind: 'line' as const },
  { id: 'arrow',    label: '→',  kind: 'line' as const },
  { id: 'wave',     label: '〰', kind: 'line' as const },
]

// Default colors for each effect when first toggled on
const DEFAULT_STROKE_COLOR = '#000000'
const DEFAULT_SHADOW_COLOR = 'rgba(0,0,0,0.55)'
const DEFAULT_BG_COLOR = '#000000'
const DEFAULT_CURVE = 0.16  // sagitta ratio when curve is first toggled on

const COLOR_SWATCHES = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#fceb42',
  '#22c55e', '#0034cc', '#8b5cf6', '#ec4899', '#94a3b8',
]

interface Props {
  baseImageUrl: string | null
  onClose?: () => void
  onExport?: (dataUrl: string) => void
}

function shapeKind(id: string) {
  return SHAPES.find(s => s.id === id)?.kind ?? 'fill'
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// =====================================================================
// useLongPress — fires `action` immediately on pointerdown, then again on
// an interval after a short hold delay. `release` (optional) fires once
// on pointerup/leave/cancel if any tick happened.
// =====================================================================

function useLongPress(
  action: () => void,
  release?: () => void,
  opts: { initialDelay?: number; interval?: number } = {}
) {
  const { initialDelay = 350, interval = 55 } = opts
  const actionRef = useRef(action)
  const releaseRef = useRef(release)
  actionRef.current = action
  releaseRef.current = release

  const timersRef = useRef<{
    initial?: ReturnType<typeof setTimeout>
    tick?: ReturnType<typeof setInterval>
  }>({})
  const activeRef = useRef(false)

  const stop = useCallback(() => {
    if (timersRef.current.initial) clearTimeout(timersRef.current.initial)
    if (timersRef.current.tick) clearInterval(timersRef.current.tick)
    timersRef.current = {}
    if (activeRef.current) {
      activeRef.current = false
      releaseRef.current?.()
    }
  }, [])

  useEffect(() => () => {
    if (timersRef.current.initial) clearTimeout(timersRef.current.initial)
    if (timersRef.current.tick) clearInterval(timersRef.current.tick)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    activeRef.current = true
    actionRef.current()
    timersRef.current.initial = setTimeout(() => {
      timersRef.current.tick = setInterval(() => actionRef.current(), interval)
    }, initialDelay)
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {}
  }, [initialDelay, interval])

  return {
    onPointerDown,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  }
}

// =====================================================================
// PixelInput — number input + ±1 buttons. value/onChange use ratio,
// UI works in pixels via the provided base.
// =====================================================================

function PixelInput({
  ratio,
  base,
  minPx,
  maxPx,
  onChange,
  inputWidth = 56,
  unit = 'px',
}: {
  ratio: number
  base: number
  minPx: number
  maxPx: number
  onChange: (newRatio: number) => void
  inputWidth?: number
  unit?: string
}) {
  const denom = base > 0 ? base : 1000
  const currentPx = Math.max(1, Math.round(ratio * denom))
  // Refs hold latest values so long-press tick handlers always see fresh state
  const ratioRef = useRef(ratio)
  ratioRef.current = ratio
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const bump = useCallback((delta: number) => {
    const cur = Math.max(1, Math.round(ratioRef.current * denom))
    const next = Math.max(minPx, Math.min(maxPx, cur + delta))
    onChangeRef.current(next / denom)
  }, [denom, minPx, maxPx])

  const decBind = useLongPress(() => bump(-1))
  const incBind = useLongPress(() => bump(1))

  const set = (n: number) => {
    if (isNaN(n)) return
    const clamped = Math.max(minPx, Math.min(maxPx, n))
    onChange(clamped / denom)
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        {...decBind}
        className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 text-white text-sm leading-none select-none touch-none"
      >−</button>
      <div className="relative">
        <input
          type="number"
          value={currentPx}
          min={minPx}
          max={maxPx}
          step={1}
          onChange={e => set(parseInt(e.target.value, 10))}
          className="h-6 pl-1.5 pr-5 bg-zinc-800 border border-zinc-700 rounded text-white text-xs font-mono text-center"
          style={{ width: `${inputWidth}px` }}
        />
        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500">{unit}</span>
      </div>
      <button
        type="button"
        {...incBind}
        className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 text-white text-sm leading-none select-none touch-none"
      >+</button>
    </div>
  )
}

// =====================================================================
// RotationStepper — ±1° with long-press support. Live ticks go through
// onLiveBump (no history), pointerup triggers onCommit once. Manual number
// input goes through onSetExact (commits immediately).
// =====================================================================

function RotationStepper({
  value,
  onLiveBump,
  onCommit,
  onSetExact,
}: {
  value: number
  onLiveBump: (delta: number) => void
  onCommit: () => void
  onSetExact: (n: number) => void
}) {
  const decBind = useLongPress(() => onLiveBump(-1), onCommit)
  const incBind = useLongPress(() => onLiveBump(1), onCommit)
  return (
    <div className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 h-8 bg-zinc-700 rounded-md text-xs text-white">
      <span className="text-zinc-300">旋转</span>
      <button
        {...decBind}
        className="w-5 h-5 rounded bg-zinc-800 border border-zinc-600 text-white text-xs leading-none select-none touch-none"
      >−</button>
      <div className="relative">
        <input
          type="number"
          value={Math.round(value)}
          min={0}
          max={359}
          step={1}
          onChange={e => {
            const n = parseInt(e.target.value, 10)
            if (isNaN(n)) return
            onSetExact(((n % 360) + 360) % 360)
          }}
          className="h-5 pl-1 pr-3 bg-zinc-800 border border-zinc-600 rounded text-white text-xs font-mono text-center"
          style={{ width: 44 }}
        />
        <span className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-400">°</span>
      </div>
      <button
        {...incBind}
        className="w-5 h-5 rounded bg-zinc-800 border border-zinc-600 text-white text-xs leading-none select-none touch-none"
      >+</button>
    </div>
  )
}

// =====================================================================
// Sticker JSX renderers
// =====================================================================

function ShapeSVG({ s, short }: { s: Sticker; short: number }) {
  const kind = shapeKind(s.shape || 'rect')
  const fill = s.fill || '#fceb42'
  const stroke = s.stroke || '#fceb42'
  const fillOpacity = s.fillOpacity ?? 1
  const sw = Math.max(1, (s.strokeWidthRatio || 0.012) * short)

  if (kind === 'line') {
    let d = 'M0,0.5 L1,0.5'
    if (s.shape === 'arrow') {
      const a = Math.min(0.48, Math.max(0.08, s.arrowRatio || 0.25))
      d = `M0,0.5 L1,0.5 M${1 - a},${0.5 - a / 2} L1,0.5 L${1 - a},${0.5 + a / 2}`
    } else if (s.shape === 'wave') {
      const n = Math.max(1, Math.min(8, s.waveCount || 3))
      d = 'M0,0.5'
      for (let i = 0; i < n; i++) {
        const xMid = i / n + 0.5 / n
        const xEnd = (i + 1) / n
        const dir = i % 2 === 0 ? -1 : 1
        d += ` Q${xMid},${0.5 + dir * 0.5} ${xEnd},0.5`
      }
    }
    return (
      <svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    )
  }

  let body: React.ReactNode = null
  const fillStroke = (s.strokeWidthRatio || 0) > 0 ? { stroke, strokeWidth: (s.strokeWidthRatio || 0) * short } : {}
  if (s.shape === 'circle') {
    body = <ellipse cx={0.5} cy={0.5} rx={0.5} ry={0.5} fill={fill} fillOpacity={fillOpacity} {...fillStroke} />
  } else if (s.shape === 'triangle') {
    body = <polygon points="0.5,0 1,1 0,1" fill={fill} fillOpacity={fillOpacity} {...fillStroke} />
  } else if (s.shape === 'star') {
    const pts: string[] = []
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 === 0 ? 0.5 : 0.2
      pts.push(`${0.5 + Math.cos(a) * r},${0.5 + Math.sin(a) * r}`)
    }
    body = <polygon points={pts.join(' ')} fill={fill} fillOpacity={fillOpacity} {...fillStroke} />
  } else if (s.shape === 'heart') {
    body = (
      <path
        d="M0.5,0.92 C0.5,0.92 0.03,0.60 0.03,0.33 C0.03,0.14 0.20,0.05 0.32,0.05 C0.40,0.05 0.46,0.10 0.50,0.18 C0.54,0.10 0.60,0.05 0.68,0.05 C0.80,0.05 0.97,0.14 0.97,0.33 C0.97,0.60 0.50,0.92 0.50,0.92 Z"
        fill={fill}
        fillOpacity={fillOpacity}
        {...fillStroke}
      />
    )
  } else {
    body = <rect width={1} height={1} fill={fill} fillOpacity={fillOpacity} {...fillStroke} />
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
      {body}
    </svg>
  )
}

// Curved text via SVG textPath. Renders when sticker.curve > 0.
// Supports stroke / shadow / italic / bold / underline; bg is skipped for curve.
function CurvedTextSvg({ sticker, fontPx }: { sticker: Sticker; fontPx: number }) {
  const t = ((sticker.text || '文字').replace(/\n/g, ' ')) || '文字'
  const fontCss = FONTS.find(f => f.id === sticker.font)?.css || FONTS[0].css
  const charW = fontPx * 0.62
  const totalW = Math.max(charW, charW * t.length)
  const sagRatio = Math.max(0, Math.min(0.5, sticker.curve || DEFAULT_CURVE))
  const sag = Math.max(0.5, totalW * sagRatio)
  const padX = Math.max(8, fontPx * 0.4)
  const padTop = Math.max(8, sag * 0.6 + fontPx * 0.15)
  const padBottom = Math.max(8, fontPx * 0.3)
  const svgW = totalW + padX * 2
  const svgH = fontPx * 1.3 + padTop + padBottom
  const baselineY = svgH - padBottom
  const startX = padX
  const endX = padX + totalW
  const cpX = svgW / 2
  const cpY = baselineY - sag * 2
  const d = `M ${startX} ${baselineY} Q ${cpX} ${cpY} ${endX} ${baselineY}`
  const pathId = `aipp-curve-${sticker.id}`
  const shadowId = `aipp-shadow-${sticker.id}`
  const strokeW = Math.max(1.5, fontPx * 0.07)
  const shadowOff = Math.max(2, fontPx * 0.06)
  const useStroke = !!sticker.hasStroke
  const useShadow = !!sticker.hasShadow
  return (
    <svg width={svgW} height={svgH} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <path id={pathId} d={d} fill="none" />
        {useShadow && (
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow
              dx={shadowOff}
              dy={shadowOff}
              stdDeviation={shadowOff * 0.6}
              floodColor={sticker.shadowColor || DEFAULT_SHADOW_COLOR}
            />
          </filter>
        )}
      </defs>
      <text
        fontSize={fontPx}
        fontFamily={fontCss}
        fontWeight={sticker.bold ? 800 : 400}
        fontStyle={sticker.italic ? 'italic' : 'normal'}
        textDecoration={sticker.underline ? 'underline' : 'none'}
        fill={sticker.color || '#ffffff'}
        stroke={useStroke ? (sticker.strokeColor || DEFAULT_STROKE_COLOR) : 'none'}
        strokeWidth={useStroke ? strokeW * 2 : 0}
        style={useStroke ? { paintOrder: 'stroke' } : undefined}
        filter={useShadow ? `url(#${shadowId})` : undefined}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {t}
        </textPath>
      </text>
    </svg>
  )
}

// Build CSS for non-curve text. Effects (stroke / shadow / bg) are independent
// toggles that can stack. 描边 follows the 醒图 style: filled body + outline
// around it, achieved via webkit-text-stroke + paint-order: stroke fill.
function getTextCss(s: Sticker, displayH: number): React.CSSProperties {
  const px = (s.sizeRatio || 0.06) * displayH
  const strokeW = Math.max(1.5, px * 0.07)
  const shadowOff = Math.max(2, px * 0.06)
  const css: React.CSSProperties = {
    fontFamily: FONTS.find(f => f.id === s.font)?.css || FONTS[0].css,
    fontSize: `${px}px`,
    fontWeight: s.bold ? 800 : 400,
    fontStyle: s.italic ? 'italic' : 'normal',
    color: s.color || '#ffffff',
    whiteSpace: 'pre-wrap',
    textAlign: s.align || 'center',
    lineHeight: 1.15,
  }
  if (s.underline) css.textDecoration = 'underline'
  if (s.hasStroke) {
    css.WebkitTextStroke = `${strokeW}px ${s.strokeColor || DEFAULT_STROKE_COLOR}`
    // paint-order ensures stroke paints first, then fill on top — so the
    // stroke shows only on the outside half of the glyph outline (醒图-style)
    ;(css as React.CSSProperties & { paintOrder?: string }).paintOrder = 'stroke fill'
  }
  if (s.hasShadow) {
    css.textShadow = `${shadowOff}px ${shadowOff}px ${shadowOff * 1.8}px ${s.shadowColor || DEFAULT_SHADOW_COLOR}`
  }
  if (s.hasBg) {
    css.background = s.bgColor || DEFAULT_BG_COLOR
    css.padding = `${px * 0.15}px ${px * 0.35}px`
    css.borderRadius = `${px * 0.2}px`
  }
  return css
}

// =====================================================================
// StickerItem — drag / resize / rotate (long-press on touch)
// =====================================================================

interface StickerItemProps {
  sticker: Sticker
  selected: boolean
  displaySize: { w: number; h: number }
  onSelect: () => void
  onUpdate: (partial: Partial<Sticker>) => void
  onCommit: () => void
  onDelete: () => void
}

function StickerItem({ sticker, selected, displaySize, onSelect, onUpdate, onCommit, onDelete }: StickerItemProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const short = Math.min(displaySize.w, displaySize.h) || 1

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    const overlay = wrapRef.current?.parentElement
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const origX = sticker.x * rect.width
    const origY = sticker.y * rect.height
    const pid = e.pointerId
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(pid)

    let dragging = e.pointerType !== 'touch'  // mouse/pen: drag immediately; touch: wait for long-press
    let longPressTimer: ReturnType<typeof setTimeout> | null = null

    if (e.pointerType === 'touch') {
      longPressTimer = setTimeout(() => {
        dragging = true
        longPressTimer = null
        target.style.cursor = 'grabbing'
      }, 350)
    }

    const onMove = (ev: PointerEvent) => {
      if (dragging) {
        onUpdate({
          x: Math.max(0, Math.min(1, (origX + ev.clientX - startX) / rect.width)),
          y: Math.max(0, Math.min(1, (origY + ev.clientY - startY) / rect.height)),
        })
      } else if (longPressTimer) {
        // movement before long-press fires → cancel (treat as tap)
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
          clearTimeout(longPressTimer)
          longPressTimer = null
        }
      }
    }
    const onUp = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      try { target.releasePointerCapture(pid) } catch {}
      if (dragging) onCommit()
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const overlay = wrapRef.current?.parentElement
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const cx = sticker.x * rect.width
    const cy = sticker.y * rect.height
    const startDist = Math.hypot(e.clientX - rect.left - cx, e.clientY - rect.top - cy) || 1
    const baseW = sticker.wRatio || 0.28
    const baseH = sticker.hRatio || 0.22
    const baseSize = sticker.sizeRatio || 0.12
    const pid = e.pointerId
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(pid)

    const onMove = (ev: PointerEvent) => {
      const d = Math.hypot(ev.clientX - rect.left - cx, ev.clientY - rect.top - cy)
      const k = d / startDist
      if (sticker.type === 'text' || sticker.type === 'emoji') {
        onUpdate({ sizeRatio: Math.max(0.02, Math.min(0.5, baseSize * k)) })
      } else if (sticker.type === 'shape') {
        onUpdate({
          wRatio: Math.max(0.03, Math.min(1, baseW * k)),
          hRatio: Math.max(0.03, Math.min(1, baseH * k)),
        })
      } else if (sticker.type === 'logo') {
        onUpdate({ sizeRatio: Math.max(0.05, Math.min(0.6, baseSize * k)) })
      }
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      try { target.releasePointerCapture(pid) } catch {}
      onCommit()
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const startRotate = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const overlay = wrapRef.current?.parentElement
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const cx = sticker.x * rect.width
    const cy = sticker.y * rect.height
    const startAngle = (Math.atan2(e.clientY - rect.top - cy, e.clientX - rect.left - cx) * 180) / Math.PI
    const baseRot = sticker.rotation || 0
    const pid = e.pointerId
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(pid)

    const onMove = (ev: PointerEvent) => {
      const a = (Math.atan2(ev.clientY - rect.top - cy, ev.clientX - rect.left - cx) * 180) / Math.PI
      onUpdate({ rotation: (((baseRot + a - startAngle) % 360) + 360) % 360 })
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      try { target.releasePointerCapture(pid) } catch {}
      onCommit()
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const wrapStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${sticker.x * 100}%`,
    top: `${sticker.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${sticker.rotation || 0}deg) scale(${sticker.flipH ? -1 : 1}, ${sticker.flipV ? -1 : 1})`,
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
  }

  let inner: React.ReactNode = null
  if (sticker.type === 'text') {
    if ((sticker.curve || 0) > 0) {
      inner = <CurvedTextSvg sticker={sticker} fontPx={(sticker.sizeRatio || 0.06) * displaySize.h} />
    } else {
      inner = <div style={getTextCss(sticker, displaySize.h)}>{sticker.text || '文字'}</div>
    }
  } else if (sticker.type === 'emoji') {
    inner = (
      <div style={{ fontSize: `${(sticker.sizeRatio || 0.12) * displaySize.h}px`, lineHeight: 1 }}>
        {sticker.char || '⭐'}
      </div>
    )
  } else if (sticker.type === 'shape') {
    const w = (sticker.wRatio || 0.28) * short
    const h = (sticker.hRatio || 0.22) * short
    inner = (
      <div style={{ width: `${w}px`, height: `${h}px` }}>
        <ShapeSVG s={sticker} short={short} />
      </div>
    )
  } else if (sticker.type === 'logo' && sticker.url) {
    const w = (sticker.sizeRatio || 0.15) * short
    inner = (
      <img
        src={sticker.url}
        alt=""
        draggable={false}
        style={{ width: `${w}px`, height: 'auto', display: 'block', pointerEvents: 'none' }}
      />
    )
  }

  return (
    <div ref={wrapRef} style={wrapStyle} onPointerDown={startDrag}>
      {selected && (
        <div
          data-handle="frame"
          style={{
            position: 'absolute',
            inset: '-6px',
            border: '1.5px dashed #fceb42',
            pointerEvents: 'none',
            borderRadius: 2,
          }}
        />
      )}
      {inner}
      {selected && (
        <>
          <button
            data-handle="del"
            onPointerDown={e => { e.stopPropagation() }}
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{
              position: 'absolute', top: -14, right: -14,
              width: 24, height: 24, borderRadius: '50%',
              background: '#111', color: '#fff', border: '2px solid #fceb42',
              fontSize: 14, cursor: 'pointer', zIndex: 10, lineHeight: 1,
            }}
          >
            ×
          </button>
          <div
            data-handle="resize"
            onPointerDown={startResize}
            style={{
              position: 'absolute', right: -10, bottom: -10,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fceb42', border: '2px solid #111',
              cursor: 'nwse-resize', zIndex: 10,
            }}
          />
          <div
            data-handle="rotate"
            onPointerDown={startRotate}
            style={{
              position: 'absolute', left: '50%', top: -30, marginLeft: -10,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fceb42', border: '2px solid #111',
              cursor: 'grab', zIndex: 10,
            }}
          />
          {['nw', 'ne', 'sw'].map(c => (
            <div
              key={c}
              data-handle="dot"
              style={{
                position: 'absolute',
                width: 10, height: 10, borderRadius: '50%',
                background: '#111', border: '2px solid #fceb42',
                pointerEvents: 'none',
                ...(c === 'nw' && { left: -7, top: -7 }),
                ...(c === 'ne' && { right: -7, top: -7 }),
                ...(c === 'sw' && { left: -7, bottom: -7 }),
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}

// =====================================================================
// Main editor
// =====================================================================

type TabId = 'text' | 'shape' | 'emoji'
const HISTORY_LIMIT = 20
const DRAWER_HEIGHT = 280

interface PanelText {
  content: string
  font: string
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  sizeRatio: number
  align: 'left' | 'center' | 'right'
  hasStroke: boolean
  strokeColor: string
  hasShadow: boolean
  shadowColor: string
  hasBg: boolean
  bgColor: string
  curve: number
}

interface TextTemplate {
  id: string
  font: string
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  sizeRatio: number
  align: 'left' | 'center' | 'right'
  hasStroke: boolean
  strokeColor: string
  hasShadow: boolean
  shadowColor: string
  hasBg: boolean
  bgColor: string
  curve: number
}
interface PanelShape {
  shape: string
  wRatio: number
  hRatio: number
  fill: string
  stroke: string
  strokeWidthRatio: number
}
interface PanelEmoji { sizeRatio: number; char: string }

export default function StickerEditor({ baseImageUrl, onClose, onExport }: Props) {
  // History
  const [history, setHistory] = useState<Sticker[][]>([[]])
  const [cursor, setCursor] = useState(0)
  const stickers = history[cursor]
  const draftRef = useRef<Sticker[] | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('text')

  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  const [panelText, setPanelText] = useState<PanelText>({
    content: '',
    font: 'calibri',
    color: '#ffffff',
    bold: false,
    italic: false,
    underline: false,
    sizeRatio: 0.06,
    align: 'center',
    hasStroke: false,
    strokeColor: DEFAULT_STROKE_COLOR,
    hasShadow: false,
    shadowColor: DEFAULT_SHADOW_COLOR,
    hasBg: false,
    bgColor: DEFAULT_BG_COLOR,
    curve: 0,
  })
  const [panelShape, setPanelShape] = useState<PanelShape>({
    shape: 'rect', wRatio: 0.28, hRatio: 0.22, fill: '#fceb42', stroke: '#fceb42', strokeWidthRatio: 0,
  })
  const [panelEmoji, setPanelEmoji] = useState<PanelEmoji>({ sizeRatio: 0.12, char: '⭐' })

  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null)
  const [editingEmojiId, setEditingEmojiId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Whether the curve effect row is expanded. Decoupled from `panelText.curve > 0`
  // so the user can drag the slider all the way to 0 without the row collapsing.
  const [curveActive, setCurveActive] = useState(false)

  // Text templates persisted in localStorage
  const [textTemplates, setTextTemplates] = useState<TextTemplate[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('aipp_text_templates')
      if (raw) setTextTemplates(JSON.parse(raw))
    } catch {}
  }, [])

  const persistTemplates = (next: TextTemplate[]) => {
    setTextTemplates(next)
    try { localStorage.setItem('aipp_text_templates', JSON.stringify(next)) } catch {}
  }

  const saveTextTemplate = () => {
    const tpl: TextTemplate = {
      id: uid(),
      font: panelText.font,
      color: panelText.color,
      bold: panelText.bold,
      italic: panelText.italic,
      underline: panelText.underline,
      sizeRatio: panelText.sizeRatio,
      align: panelText.align,
      hasStroke: panelText.hasStroke,
      strokeColor: panelText.strokeColor,
      hasShadow: panelText.hasShadow,
      shadowColor: panelText.shadowColor,
      hasBg: panelText.hasBg,
      bgColor: panelText.bgColor,
      curve: panelText.curve,
    }
    persistTemplates([tpl, ...textTemplates].slice(0, 30))
  }

  const applyTextTemplate = (tpl: TextTemplate) => {
    setPanelText(p => ({
      ...p,
      font: tpl.font,
      color: tpl.color,
      bold: tpl.bold,
      italic: tpl.italic,
      underline: tpl.underline,
      sizeRatio: tpl.sizeRatio,
      align: tpl.align,
      hasStroke: tpl.hasStroke,
      strokeColor: tpl.strokeColor,
      hasShadow: tpl.hasShadow,
      shadowColor: tpl.shadowColor,
      hasBg: tpl.hasBg,
      bgColor: tpl.bgColor,
      curve: tpl.curve,
    }))
    setCurveActive(tpl.curve > 0)
  }

  const deleteTextTemplate = (id: string) => {
    persistTemplates(textTemplates.filter(t => t.id !== id))
  }

  // While any editing mode is active, overlay panel values onto the sticker being edited
  // so the canvas reflects every change live, without polluting history.
  const displayedStickers = useMemo<Sticker[]>(() => {
    if (!editingTextId && !editingShapeId && !editingEmojiId) return stickers
    return stickers.map(s => {
      if (s.id === editingTextId && s.type === 'text') {
        return {
          ...s,
          text: panelText.content || '文字',
          font: panelText.font,
          color: panelText.color,
          bold: panelText.bold,
          italic: panelText.italic,
          underline: panelText.underline,
          sizeRatio: panelText.sizeRatio,
          align: panelText.align,
          hasStroke: panelText.hasStroke,
          strokeColor: panelText.strokeColor,
          hasShadow: panelText.hasShadow,
          shadowColor: panelText.shadowColor,
          hasBg: panelText.hasBg,
          bgColor: panelText.bgColor,
          curve: panelText.curve,
        }
      }
      if (s.id === editingShapeId && s.type === 'shape') {
        return {
          ...s,
          shape: panelShape.shape,
          wRatio: panelShape.wRatio,
          hRatio: panelShape.hRatio,
          fill: panelShape.fill,
          stroke: panelShape.stroke,
          strokeWidthRatio: panelShape.strokeWidthRatio,
        }
      }
      if (s.id === editingEmojiId && s.type === 'emoji') {
        return {
          ...s,
          char: panelEmoji.char,
          sizeRatio: panelEmoji.sizeRatio,
        }
      }
      return s
    })
  }, [stickers, editingTextId, editingShapeId, editingEmojiId, panelText, panelShape, panelEmoji])

  // ResizeObserver — keep displaySize fresh
  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const ro = new ResizeObserver(() => {
      setDisplaySize({ w: img.clientWidth, h: img.clientHeight })
    })
    ro.observe(img)
    return () => ro.disconnect()
  }, [baseImageUrl])

  // ---- History helpers ----------------------------------------------
  const pushHistory = useCallback((next: Sticker[]) => {
    setHistory(h => {
      const base = h.slice(0, cursor + 1)
      base.push(next)
      return base.length > HISTORY_LIMIT + 1 ? base.slice(base.length - HISTORY_LIMIT - 1) : base
    })
    setCursor(c => Math.min(c + 1, HISTORY_LIMIT))
  }, [cursor])

  const updateLive = useCallback((updater: (prev: Sticker[]) => Sticker[]) => {
    draftRef.current = updater(draftRef.current ?? history[cursor])
    setHistory(h => {
      const copy = h.slice()
      copy[cursor] = draftRef.current!
      return copy
    })
  }, [cursor, history])

  const commitDraft = useCallback(() => {
    if (!draftRef.current) return
    pushHistory(draftRef.current)
    draftRef.current = null
  }, [pushHistory])

  const updateSticker = (id: string, partial: Partial<Sticker>) => {
    updateLive(prev => prev.map(s => (s.id === id ? { ...s, ...partial } : s)))
  }

  const addAndCommit = (s: Sticker) => {
    pushHistory([...stickers, s])
    setSelectedId(s.id)
  }

  const deleteAndCommit = (id: string) => {
    pushHistory(stickers.filter(s => s.id !== id))
    if (selectedId === id) setSelectedId(null)
    if (editingTextId === id) setEditingTextId(null)
    if (editingShapeId === id) setEditingShapeId(null)
    if (editingEmojiId === id) setEditingEmojiId(null)
  }

  const updateAndCommit = (id: string, partial: Partial<Sticker>) => {
    pushHistory(stickers.map(s => (s.id === id ? { ...s, ...partial } : s)))
  }

  const undo = () => {
    if (cursor === 0) return
    draftRef.current = null
    setCursor(c => c - 1)
    setSelectedId(null)
    setEditingTextId(null)
    setEditingShapeId(null)
    setEditingEmojiId(null)
  }
  const redo = () => {
    if (cursor >= history.length - 1) return
    draftRef.current = null
    setCursor(c => c + 1)
    setSelectedId(null)
    setEditingTextId(null)
    setEditingShapeId(null)
    setEditingEmojiId(null)
  }
  const canUndo = cursor > 0
  const canRedo = cursor < history.length - 1

  // ---- Adders --------------------------------------------------------
  const textStickerFromPanel = (): Omit<Sticker, 'id' | 'type'> => ({
    text: panelText.content || '文字',
    font: panelText.font,
    color: panelText.color,
    bold: panelText.bold,
    italic: panelText.italic,
    underline: panelText.underline,
    sizeRatio: panelText.sizeRatio,
    align: panelText.align,
    hasStroke: panelText.hasStroke,
    strokeColor: panelText.strokeColor,
    hasShadow: panelText.hasShadow,
    shadowColor: panelText.shadowColor,
    hasBg: panelText.hasBg,
    bgColor: panelText.bgColor,
    curve: panelText.curve,
    x: 0.5, y: 0.5, rotation: 0, flipH: false, flipV: false,
  })

  const addTextFromPanel = () => {
    if (editingTextId) {
      const { x, y, rotation, flipH, flipV, ...rest } = textStickerFromPanel()
      void x; void y; void rotation; void flipH; void flipV
      updateAndCommit(editingTextId, rest)
      setEditingTextId(null)
    } else {
      addAndCommit({ id: uid(), type: 'text', ...textStickerFromPanel() })
    }
  }

  const editExistingText = (s: Sticker) => {
    setEditingTextId(s.id)
    const curve = s.curve || 0
    setPanelText({
      content: s.text || '',
      font: s.font || 'calibri',
      color: s.color || '#ffffff',
      bold: s.bold ?? false,
      italic: s.italic ?? false,
      underline: s.underline ?? false,
      sizeRatio: s.sizeRatio || 0.06,
      align: s.align || 'center',
      hasStroke: s.hasStroke ?? false,
      strokeColor: s.strokeColor || DEFAULT_STROKE_COLOR,
      hasShadow: s.hasShadow ?? false,
      shadowColor: s.shadowColor || DEFAULT_SHADOW_COLOR,
      hasBg: s.hasBg ?? false,
      bgColor: s.bgColor || DEFAULT_BG_COLOR,
      curve,
    })
    setCurveActive(curve > 0)
    setActiveTab('text')
  }

  const addShapeFromPanel = () => {
    const isLine = shapeKind(panelShape.shape) === 'line'
    if (editingShapeId) {
      updateAndCommit(editingShapeId, {
        shape: panelShape.shape,
        wRatio: panelShape.wRatio,
        hRatio: isLine ? Math.max(panelShape.hRatio, 0.06) : panelShape.hRatio,
        fill: panelShape.fill,
        stroke: panelShape.stroke,
        strokeWidthRatio: isLine ? Math.max(panelShape.strokeWidthRatio, 0.012) : panelShape.strokeWidthRatio,
      })
      setEditingShapeId(null)
    } else {
      addAndCommit({
        id: uid(), type: 'shape', shape: panelShape.shape,
        wRatio: panelShape.wRatio,
        hRatio: isLine ? Math.max(panelShape.hRatio, 0.06) : panelShape.hRatio,
        fill: panelShape.fill, fillOpacity: 1, stroke: panelShape.stroke,
        strokeWidthRatio: isLine ? Math.max(panelShape.strokeWidthRatio, 0.012) : panelShape.strokeWidthRatio,
        arrowRatio: 0.25, waveCount: 3,
        x: 0.5, y: 0.5, rotation: 0, flipH: false, flipV: false,
      })
    }
  }

  const editExistingShape = (s: Sticker) => {
    setEditingShapeId(s.id)
    setPanelShape({
      shape: s.shape || 'rect',
      wRatio: s.wRatio ?? 0.28,
      hRatio: s.hRatio ?? 0.22,
      fill: s.fill || '#fceb42',
      stroke: s.stroke || '#fceb42',
      strokeWidthRatio: s.strokeWidthRatio ?? 0,
    })
    setActiveTab('shape')
  }

  // When editing, clicking an emoji in the grid changes the editing sticker's char (live overlay).
  // When not editing, it adds a new emoji sticker immediately.
  const addEmojiFromPanel = (char: string) => {
    if (editingEmojiId) {
      setPanelEmoji(p => ({ ...p, char }))
    } else {
      addAndCommit({
        id: uid(), type: 'emoji', char,
        sizeRatio: panelEmoji.sizeRatio,
        x: 0.5, y: 0.5, rotation: 0, flipH: false, flipV: false,
      })
    }
  }

  const saveEmojiEdit = () => {
    if (!editingEmojiId) return
    updateAndCommit(editingEmojiId, {
      char: panelEmoji.char,
      sizeRatio: panelEmoji.sizeRatio,
    })
    setEditingEmojiId(null)
  }

  const editExistingEmoji = (s: Sticker) => {
    setEditingEmojiId(s.id)
    setPanelEmoji({
      sizeRatio: s.sizeRatio ?? 0.12,
      char: s.char || '⭐',
    })
    setActiveTab('emoji')
  }

  // ---- Export to canvas ---------------------------------------------
  const loadImg = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const img = document.createElement('img')
    if (src.startsWith('http://') || src.startsWith('https://')) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

  const exportImage = async () => {
    if (!baseImageUrl || exporting) return
    setExporting(true)
    try {
      const base = await loadImg(baseImageUrl)
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      canvas.width = base.naturalWidth
      canvas.height = base.naturalHeight
      ctx.drawImage(base, 0, 0)

      const short = Math.min(canvas.width, canvas.height)

      for (const s of displayedStickers) {
        ctx.save()
        ctx.translate(s.x * canvas.width, s.y * canvas.height)
        ctx.rotate(((s.rotation || 0) * Math.PI) / 180)
        ctx.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1)

        if (s.type === 'text') {
          const f = FONTS.find(ff => ff.id === s.font) || FONTS[0]
          const px = Math.round((s.sizeRatio || 0.06) * canvas.height)
          const align = s.align || 'center'
          const lineH = px * 1.15
          const fontStyle = s.italic ? 'italic ' : ''
          const fontWeight = s.bold ? '800 ' : ''
          ctx.font = `${fontStyle}${fontWeight}${px}px ${f.css}`
          ctx.textAlign = align as CanvasTextAlign
          ctx.textBaseline = 'middle'
          const strokeW = Math.max(1.5, px * 0.07)
          const shadowOff = Math.max(2, px * 0.06)

          const setShadow = () => {
            if (s.hasShadow) {
              ctx.shadowColor = s.shadowColor || DEFAULT_SHADOW_COLOR
              ctx.shadowBlur = shadowOff * 1.8
              ctx.shadowOffsetX = shadowOff
              ctx.shadowOffsetY = shadowOff
            }
          }
          const clearShadow = () => {
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.shadowOffsetX = 0
            ctx.shadowOffsetY = 0
          }

          if ((s.curve || 0) > 0) {
            // Curve mode: flatten newlines; draw each char along an arc
            const flat = ((s.text || '文字').replace(/\n/g, ' '))
            const chars = Array.from(flat || '文字')
            const widths = chars.map(c => ctx.measureText(c).width || px * 0.5)
            const totalW = widths.reduce((a, b) => a + b, 0)
            const sagRatio = Math.max(0, Math.min(0.5, s.curve || DEFAULT_CURVE))
            const sag = Math.max(0.5, totalW * sagRatio)
            const R = (totalW * totalW + 4 * sag * sag) / (8 * sag)
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'

            let ang = -(totalW / R) / 2
            for (let i = 0; i < chars.length; i++) {
              const charAng = widths[i] / R
              const mid = ang + charAng / 2
              const cx = R * Math.sin(mid)
              const cy = (R - sag) - R * Math.cos(mid)
              ctx.save()
              ctx.translate(cx, cy)
              ctx.rotate(mid)
              setShadow()
              if (s.hasStroke) {
                ctx.strokeStyle = s.strokeColor || DEFAULT_STROKE_COLOR
                ctx.lineWidth = strokeW * 2
                ctx.lineJoin = 'round'
                ctx.strokeText(chars[i], 0, 0)
              }
              ctx.fillStyle = s.color || '#ffffff'
              ctx.fillText(chars[i], 0, 0)
              clearShadow()
              ctx.restore()
              ang += charAng
            }
          } else {
            const lines = (s.text || '').split('\n')
            let maxW = 0
            for (const line of lines) {
              const w = ctx.measureText(line).width
              if (w > maxW) maxW = w
            }
            const blockH = lines.length * lineH
            const anchorX = align === 'left' ? -maxW / 2 : align === 'right' ? maxW / 2 : 0
            const firstY = -blockH / 2 + lineH / 2
            const drawLines = (fn: (line: string, x: number, y: number) => void) => {
              for (let i = 0; i < lines.length; i++) {
                fn(lines[i], anchorX, firstY + i * lineH)
              }
            }

            // 1. Background block (drawn first, no shadow)
            if (s.hasBg) {
              const padX = px * 0.35
              const padY = px * 0.15
              const bgW = maxW + padX * 2
              const bgH = blockH + padY * 2
              ctx.fillStyle = s.bgColor || DEFAULT_BG_COLOR
              roundRect(ctx, -bgW / 2, -bgH / 2, bgW, bgH, px * 0.2)
              ctx.fill()
            }

            // 2. Shadow applies to stroke + fill combined silhouette.
            setShadow()

            // 3. Stroke (drawn before fill so paint order matches CSS paint-order: stroke fill)
            //    Doubling lineWidth keeps the outside half visible after the fill paints on top.
            if (s.hasStroke) {
              ctx.strokeStyle = s.strokeColor || DEFAULT_STROKE_COLOR
              ctx.lineWidth = strokeW * 2
              ctx.lineJoin = 'round'
              drawLines((line, x, y) => ctx.strokeText(line, x, y))
            }

            // 4. Fill body
            ctx.fillStyle = s.color || '#ffffff'
            drawLines((line, x, y) => ctx.fillText(line, x, y))

            clearShadow()

            // 5. Underline per line (drawn last so it sits above any stroke)
            if (s.underline) {
              ctx.strokeStyle = s.color || '#ffffff'
              ctx.lineWidth = Math.max(1, px * 0.06)
              for (let i = 0; i < lines.length; i++) {
                const lineY = firstY + i * lineH + px * 0.42
                const w = ctx.measureText(lines[i]).width
                let xStart: number, xEnd: number
                if (align === 'left') { xStart = anchorX; xEnd = anchorX + w }
                else if (align === 'right') { xStart = anchorX - w; xEnd = anchorX }
                else { xStart = -w / 2; xEnd = w / 2 }
                ctx.beginPath()
                ctx.moveTo(xStart, lineY)
                ctx.lineTo(xEnd, lineY)
                ctx.stroke()
              }
            }
          }
        } else if (s.type === 'emoji') {
          const px = Math.round((s.sizeRatio || 0.12) * canvas.height)
          ctx.font = `${px}px -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(s.char || '⭐', 0, 0)
        } else if (s.type === 'shape') {
          const w = (s.wRatio || 0.28) * short
          const h = (s.hRatio || 0.22) * short
          const sw = (s.strokeWidthRatio || 0) * short
          ctx.fillStyle = s.fill || '#fceb42'
          ctx.strokeStyle = s.stroke || '#fceb42'
          ctx.lineWidth = Math.max(1, sw || 1)
          ctx.globalAlpha = s.fillOpacity ?? 1

          if (shapeKind(s.shape || 'rect') === 'line') {
            ctx.lineWidth = Math.max(1, (s.strokeWidthRatio || 0.012) * short)
            ctx.beginPath()
            if (s.shape === 'line') {
              ctx.moveTo(-w / 2, 0)
              ctx.lineTo(w / 2, 0)
            } else if (s.shape === 'arrow') {
              const a = Math.min(0.48, Math.max(0.08, s.arrowRatio || 0.25)) * w
              ctx.moveTo(-w / 2, 0)
              ctx.lineTo(w / 2, 0)
              ctx.moveTo(w / 2 - a, -a / 2)
              ctx.lineTo(w / 2, 0)
              ctx.lineTo(w / 2 - a, a / 2)
            } else if (s.shape === 'wave') {
              const n = Math.max(1, Math.min(8, s.waveCount || 3))
              ctx.moveTo(-w / 2, 0)
              for (let i = 0; i < n; i++) {
                const x0 = -w / 2 + (i * w) / n
                const xMid = x0 + w / (2 * n)
                const xEnd = -w / 2 + ((i + 1) * w) / n
                const dir = i % 2 === 0 ? -1 : 1
                ctx.quadraticCurveTo(xMid, dir * (w / 4), xEnd, 0)
              }
            }
            ctx.lineCap = 'round'
            ctx.stroke()
          } else if (s.shape === 'rect') {
            ctx.fillRect(-w / 2, -h / 2, w, h)
            if (sw > 0) ctx.strokeRect(-w / 2, -h / 2, w, h)
          } else if (s.shape === 'circle') {
            ctx.beginPath()
            ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
            ctx.fill()
            if (sw > 0) ctx.stroke()
          } else if (s.shape === 'triangle') {
            ctx.beginPath()
            ctx.moveTo(0, -h / 2)
            ctx.lineTo(w / 2, h / 2)
            ctx.lineTo(-w / 2, h / 2)
            ctx.closePath()
            ctx.fill()
            if (sw > 0) ctx.stroke()
          } else if (s.shape === 'star') {
            ctx.beginPath()
            for (let i = 0; i < 10; i++) {
              const a = -Math.PI / 2 + (i * Math.PI) / 5
              const r = i % 2 === 0 ? 0.5 : 0.2
              const px = Math.cos(a) * r * w
              const py = Math.sin(a) * r * h
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
            }
            ctx.closePath()
            ctx.fill()
            if (sw > 0) ctx.stroke()
          } else if (s.shape === 'heart') {
            ctx.beginPath()
            const W = w, H = h
            ctx.moveTo(0, H * 0.42)
            ctx.bezierCurveTo(-W * 0.55, H * 0.08, -W * 0.50, -H * 0.42, 0, -H * 0.18)
            ctx.bezierCurveTo(W * 0.50, -H * 0.42, W * 0.55, H * 0.08, 0, H * 0.42)
            ctx.closePath()
            ctx.fill()
            if (sw > 0) ctx.stroke()
          }
          ctx.globalAlpha = 1
        } else if (s.type === 'logo' && s.url) {
          try {
            const logoImg = await loadImg(s.url)
            const logoW = (s.sizeRatio || 0.15) * short
            const logoH = (logoImg.naturalHeight / logoImg.naturalWidth) * logoW
            ctx.drawImage(logoImg, -logoW / 2, -logoH / 2, logoW, logoH)
          } catch {}
        }

        ctx.restore()
      }

      const dataUrl = canvas.toDataURL('image/png')
      onExport?.(dataUrl)
    } catch (e) {
      console.error('Export failed', e)
      alert('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  const selectedSticker = displayedStickers.find(s => s.id === selectedId) || null

  const onCanvasBackdropPointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) setSelectedId(null)
  }

  // Display-pixel helpers
  const sizePx = (ratio: number) =>
    displaySize.h > 0 ? `${Math.round(ratio * displaySize.h)}px` : `${Math.round(ratio * 1000)}‰`
  const shortPx = (ratio: number) => {
    const short = Math.min(displaySize.w, displaySize.h)
    return short > 0 ? `${Math.round(ratio * short)}px` : `${Math.round(ratio * 1000)}‰`
  }
  const stepRatio = (current: number, delta: number, min: number, max: number) =>
    Math.max(min, Math.min(max, +(current + delta).toFixed(3)))

  // =====================================================================
  // Render
  // =====================================================================

  const TABS: { id: TabId; icon: string; label: string }[] = [
    { id: 'text',  icon: 'Aa', label: '文字' },
    { id: 'shape', icon: '◇',  label: '图形' },
    { id: 'emoji', icon: '✨', label: '图案' },
  ]

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col select-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <button
          onClick={onClose}
          aria-label="关闭"
          className="w-10 h-10 flex items-center justify-center text-white hover:bg-zinc-800 rounded-lg text-xl"
        >
          ✕
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="w-10 h-10 flex items-center justify-center text-white disabled:text-zinc-600 hover:bg-zinc-800 disabled:hover:bg-transparent rounded-lg text-lg"
            title="撤销"
          >
            ↶
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="w-10 h-10 flex items-center justify-center text-white disabled:text-zinc-600 hover:bg-zinc-800 disabled:hover:bg-transparent rounded-lg text-lg"
            title="重做"
          >
            ↷
          </button>
        </div>
        <button
          onClick={exportImage}
          disabled={!baseImageUrl || exporting}
          className="px-4 h-9 disabled:opacity-40 text-zinc-900 text-sm font-semibold rounded-lg flex items-center gap-2"
          style={{ background: '#fceb42' }}
        >
          {exporting
            ? <span className="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
            : '↓'}
          完成
        </button>
      </header>

      {/* Canvas area */}
      <div
        ref={canvasAreaRef}
        className="flex-1 flex items-center justify-center bg-zinc-950 overflow-hidden p-3 relative min-h-0"
        onPointerDown={onCanvasBackdropPointerDown}
      >
        {baseImageUrl ? (
          <div className="relative max-w-full max-h-full inline-block" onPointerDown={onCanvasBackdropPointerDown}>
            <img
              ref={imgRef}
              src={baseImageUrl}
              alt="base"
              draggable={false}
              className="block max-w-full max-h-full"
              style={{ objectFit: 'contain' }}
              onLoad={e => {
                const img = e.currentTarget
                setDisplaySize({ w: img.clientWidth, h: img.clientHeight })
              }}
            />
            <div
              className="absolute inset-0"
              style={{ touchAction: 'none' }}
              onPointerDown={e => { if (e.target === e.currentTarget) setSelectedId(null) }}
            >
              {displayedStickers.map(s => (
                <StickerItem
                  key={s.id}
                  sticker={s}
                  selected={s.id === selectedId}
                  displaySize={displaySize}
                  onSelect={() => setSelectedId(s.id)}
                  onUpdate={partial => updateSticker(s.id, partial)}
                  onCommit={commitDraft}
                  onDelete={() => deleteAndCommit(s.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-zinc-500">无图片</p>
        )}
      </div>

      {/* Inspector strip — only when sticker selected */}
      {selectedSticker && (
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-t border-zinc-800 overflow-x-auto flex-shrink-0">
          {selectedSticker.type === 'text' && (
            <button
              onClick={() => editExistingText(selectedSticker)}
              className="flex-shrink-0 px-3 h-8 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-md"
            >
              ✎ 编辑文字
            </button>
          )}
          {selectedSticker.type === 'shape' && (
            <button
              onClick={() => editExistingShape(selectedSticker)}
              className="flex-shrink-0 px-3 h-8 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-md"
            >
              ✎ 编辑图形
            </button>
          )}
          {selectedSticker.type === 'emoji' && (
            <button
              onClick={() => editExistingEmoji(selectedSticker)}
              className="flex-shrink-0 px-3 h-8 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-md"
            >
              ✎ 编辑图案
            </button>
          )}
          <RotationStepper
            value={selectedSticker.rotation || 0}
            onLiveBump={(delta) => {
              const id = selectedSticker.id
              updateLive(prev => prev.map(s => {
                if (s.id !== id) return s
                const next = (((s.rotation || 0) + delta) % 360 + 360) % 360
                return { ...s, rotation: next }
              }))
            }}
            onCommit={commitDraft}
            onSetExact={(n) => updateAndCommit(selectedSticker.id, { rotation: n })}
          />
          <button
            onClick={() => updateAndCommit(selectedSticker.id, { flipH: !selectedSticker.flipH })}
            className={`flex-shrink-0 px-3 h-8 text-white text-xs rounded-md ${selectedSticker.flipH ? 'bg-amber-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
          >
            ⇄ 水平
          </button>
          <button
            onClick={() => updateAndCommit(selectedSticker.id, { flipV: !selectedSticker.flipV })}
            className={`flex-shrink-0 px-3 h-8 text-white text-xs rounded-md ${selectedSticker.flipV ? 'bg-amber-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
          >
            ⇅ 垂直
          </button>
          {selectedSticker.type === 'shape' && (
            <>
              <label className="flex-shrink-0 flex items-center gap-1.5 px-2 h-8 bg-zinc-700 rounded-md text-white text-xs cursor-pointer">
                填充
                <input
                  type="color"
                  value={selectedSticker.fill || '#fceb42'}
                  onChange={e => updateAndCommit(selectedSticker.id, { fill: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-none p-0 bg-transparent"
                />
              </label>
              <label className="flex-shrink-0 flex items-center gap-1.5 px-2 h-8 bg-zinc-700 rounded-md text-white text-xs cursor-pointer">
                描边
                <input
                  type="color"
                  value={selectedSticker.stroke || '#fceb42'}
                  onChange={e => updateAndCommit(selectedSticker.id, { stroke: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-none p-0 bg-transparent"
                />
              </label>
            </>
          )}
          <button
            onClick={() => deleteAndCommit(selectedSticker.id)}
            className="flex-shrink-0 ml-auto px-3 h-8 bg-red-600 hover:bg-red-500 text-white text-xs rounded-md"
          >
            🗑 删除
          </button>
        </div>
      )}

      {/* Tab bar */}
      <nav className="flex bg-zinc-900 border-t border-zinc-800 flex-shrink-0">
        {TABS.map(t => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                active ? 'text-zinc-900' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}
              style={active ? { background: '#fceb42' } : {}}
            >
              <span className="text-base leading-none">{t.icon}</span>
              <span className="text-[11px] leading-none font-medium">{t.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Drawer panel — fixed height, content swaps by tab */}
      <div
        className="bg-zinc-900 border-t border-zinc-800 overflow-y-auto flex-shrink-0"
        style={{
          height: DRAWER_HEIGHT,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {activeTab === 'text' && (
          <div className="p-3 space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-[11px] text-zinc-500 w-10 flex-shrink-0 pt-2">内容</span>
              <div className="relative flex-1">
                <textarea
                  value={panelText.content}
                  onChange={e => setPanelText(p => ({ ...p, content: e.target.value }))}
                  onKeyDown={e => {
                    // Cmd/Ctrl + Enter inserts a newline at the caret
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      const ta = e.currentTarget
                      const start = ta.selectionStart
                      const end = ta.selectionEnd
                      const before = panelText.content.slice(0, start)
                      const after = panelText.content.slice(end)
                      const next = `${before}\n${after}`
                      setPanelText(p => ({ ...p, content: next }))
                      requestAnimationFrame(() => {
                        ta.selectionStart = ta.selectionEnd = start + 1
                      })
                    }
                  }}
                  placeholder={editingTextId ? '编辑文字内容（Cmd/Ctrl+Enter 换行）' : '输入文字（Cmd/Ctrl+Enter 换行）'}
                  rows={2}
                  maxLength={240}
                  className="w-full px-3 py-2 pr-8 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-400 placeholder-zinc-500 resize-y"
                />
                {panelText.content && (
                  <button
                    onClick={() => setPanelText(p => ({ ...p, content: '' }))}
                    className="absolute right-2 top-2 w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-xs"
                    aria-label="清空"
                  >×</button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 w-10 flex-shrink-0">对齐</span>
              <div className="flex gap-1.5">
                {([
                  { id: 'left',   icon: '⇤' },
                  { id: 'center', icon: '⇔' },
                  { id: 'right',  icon: '⇥' },
                ] as const).map(a => {
                  const active = panelText.align === a.id
                  return (
                    <button
                      key={a.id}
                      onClick={() => setPanelText(p => ({ ...p, align: a.id }))}
                      className={`w-9 h-8 rounded-md text-base border transition-colors ${
                        active ? 'border-yellow-400 text-zinc-900' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'
                      }`}
                      style={active ? { background: '#fceb42' } : {}}
                      aria-label={`align-${a.id}`}
                    >{a.icon}</button>
                  )
                })}
              </div>
            </div>

            {/* Templates strip */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 w-10 flex-shrink-0">模板</span>
              <div className="flex gap-1.5 flex-1 overflow-x-auto pr-1">
                <button
                  onClick={saveTextTemplate}
                  title="保存当前样式为模板"
                  aria-label="保存模板"
                  className="flex-shrink-0 w-10 h-10 rounded-lg border-2 border-dashed border-zinc-600 text-zinc-400 text-xl flex items-center justify-center hover:border-yellow-400 hover:text-yellow-400"
                >＋</button>
                {textTemplates.map(t => {
                  const previewPx = 14
                  const wrapperStyle: React.CSSProperties = t.hasBg
                    ? { background: t.bgColor, padding: '2px 4px', borderRadius: 4 }
                    : {}
                  const css = getTextCss({
                    id: t.id, type: 'text', x: 0, y: 0, rotation: 0, flipH: false, flipV: false,
                    font: t.font, color: t.color, bold: t.bold, italic: t.italic, underline: t.underline,
                    sizeRatio: previewPx / 100, align: 'center',
                    hasStroke: t.hasStroke, strokeColor: t.strokeColor,
                    hasShadow: false, shadowColor: t.shadowColor,
                    hasBg: false, bgColor: t.bgColor,
                    curve: 0,
                  }, 100)
                  return (
                    <div key={t.id} className="relative group flex-shrink-0">
                      <button
                        onClick={() => applyTextTemplate(t)}
                        className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-yellow-400 flex items-center justify-center overflow-hidden"
                      >
                        <span style={wrapperStyle}>
                          <span style={css}>Aa</span>
                        </span>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteTextTemplate(t.id) }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none opacity-0 group-hover:opacity-100"
                        aria-label="删除模板"
                      >×</button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Font + size row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 w-7 flex-shrink-0">字体</span>
                <select
                  value={panelText.font}
                  onChange={e => setPanelText(p => ({ ...p, font: e.target.value }))}
                  className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-yellow-400"
                >
                  {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] text-zinc-500">大小</span>
                <PixelInput
                  ratio={panelText.sizeRatio}
                  base={displaySize.h}
                  minPx={1}
                  maxPx={Math.max(40, Math.round((displaySize.h || 1000) * 0.5))}
                  onChange={r => setPanelText(p => ({ ...p, sizeRatio: r }))}
                />
              </div>
            </div>

            {/* Format toggles: B / I / U */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 w-10 flex-shrink-0">格式</span>
              <div className="flex gap-1.5">
                {([
                  { key: 'bold' as const,      label: 'B', cls: 'font-bold' },
                  { key: 'italic' as const,    label: 'I', cls: 'italic' },
                  { key: 'underline' as const, label: 'U', cls: 'underline' },
                ]).map(f => {
                  const active = panelText[f.key]
                  return (
                    <button
                      key={f.key}
                      onClick={() => setPanelText(p => ({ ...p, [f.key]: !p[f.key] }))}
                      className={`w-9 h-8 rounded-md border text-base transition-colors ${f.cls} ${
                        active ? 'border-yellow-400 text-zinc-900' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'
                      }`}
                      style={active ? { background: '#fceb42' } : {}}
                      aria-label={f.key}
                    >{f.label}</button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 w-10 flex-shrink-0">颜色</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {COLOR_SWATCHES.map(c => (
                  <button
                    key={c}
                    onClick={() => setPanelText(p => ({ ...p, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      panelText.color.toLowerCase() === c.toLowerCase() ? 'border-yellow-400 scale-110' : 'border-zinc-700'
                    }`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
                <label className="w-6 h-6 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center cursor-pointer text-zinc-400 text-xs overflow-hidden">
                  ＋
                  <input
                    type="color"
                    value={panelText.color}
                    onChange={e => setPanelText(p => ({ ...p, color: e.target.value }))}
                    className="opacity-0 w-0 h-0"
                  />
                </label>
              </div>
            </div>

            {/* Effect: 描边 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={panelText.hasStroke}
                  onChange={e => setPanelText(p => ({ ...p, hasStroke: e.target.checked, strokeColor: p.strokeColor || DEFAULT_STROKE_COLOR }))}
                  className="w-3.5 h-3.5 accent-yellow-400"
                />
                <span className="text-[11px] text-zinc-300">描边</span>
              </label>
              {panelText.hasStroke && (
                <div className="flex items-center gap-1.5 pl-5 flex-wrap">
                  {COLOR_SWATCHES.map(c => (
                    <button
                      key={c}
                      onClick={() => setPanelText(p => ({ ...p, strokeColor: c }))}
                      className={`w-5 h-5 rounded-full border-2 ${
                        panelText.strokeColor.toLowerCase() === c.toLowerCase() ? 'border-yellow-400 scale-110' : 'border-zinc-700'
                      }`}
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                  <label className="w-5 h-5 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center cursor-pointer text-zinc-400 text-[10px] overflow-hidden">
                    ＋
                    <input
                      type="color"
                      value={panelText.strokeColor.startsWith('#') ? panelText.strokeColor : '#000000'}
                      onChange={e => setPanelText(p => ({ ...p, strokeColor: e.target.value }))}
                      className="opacity-0 w-0 h-0"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Effect: 阴影 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={panelText.hasShadow}
                  onChange={e => setPanelText(p => ({ ...p, hasShadow: e.target.checked, shadowColor: p.shadowColor || DEFAULT_SHADOW_COLOR }))}
                  className="w-3.5 h-3.5 accent-yellow-400"
                />
                <span className="text-[11px] text-zinc-300">阴影</span>
              </label>
              {panelText.hasShadow && (
                <div className="flex items-center gap-1.5 pl-5 flex-wrap">
                  {COLOR_SWATCHES.map(c => (
                    <button
                      key={c}
                      onClick={() => setPanelText(p => ({ ...p, shadowColor: c }))}
                      className={`w-5 h-5 rounded-full border-2 ${
                        panelText.shadowColor.toLowerCase() === c.toLowerCase() ? 'border-yellow-400 scale-110' : 'border-zinc-700'
                      }`}
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                  <label className="w-5 h-5 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center cursor-pointer text-zinc-400 text-[10px] overflow-hidden">
                    ＋
                    <input
                      type="color"
                      value={panelText.shadowColor.startsWith('#') ? panelText.shadowColor : '#000000'}
                      onChange={e => setPanelText(p => ({ ...p, shadowColor: e.target.value }))}
                      className="opacity-0 w-0 h-0"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Effect: 弯曲 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={curveActive}
                  onChange={e => {
                    const on = e.target.checked
                    setCurveActive(on)
                    if (on && panelText.curve === 0) {
                      setPanelText(p => ({ ...p, curve: DEFAULT_CURVE }))
                    } else if (!on) {
                      setPanelText(p => ({ ...p, curve: 0 }))
                    }
                  }}
                  className="w-3.5 h-3.5 accent-yellow-400"
                />
                <span className="text-[11px] text-zinc-300">弯曲</span>
              </label>
              {curveActive && (
                <div className="flex items-center gap-2 pl-5">
                  <span className="text-[10px] text-zinc-500">程度</span>
                  <input
                    type="range"
                    min={0}
                    max={0.4}
                    step={0.01}
                    value={panelText.curve}
                    onChange={e => setPanelText(p => ({ ...p, curve: parseFloat(e.target.value) }))}
                    className="flex-1 accent-yellow-400"
                  />
                  <input
                    type="number"
                    value={Math.round(panelText.curve * 100)}
                    min={0}
                    max={40}
                    step={1}
                    onChange={e => {
                      const n = parseInt(e.target.value, 10)
                      if (isNaN(n)) return
                      setPanelText(p => ({ ...p, curve: Math.max(0, Math.min(0.4, n / 100)) }))
                    }}
                    className="w-12 h-6 px-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs font-mono text-center"
                  />
                </div>
              )}
            </div>

            {/* Effect: 背景 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={panelText.hasBg}
                  onChange={e => setPanelText(p => ({ ...p, hasBg: e.target.checked, bgColor: p.bgColor || DEFAULT_BG_COLOR }))}
                  className="w-3.5 h-3.5 accent-yellow-400"
                />
                <span className="text-[11px] text-zinc-300">背景</span>
              </label>
              {panelText.hasBg && (
                <div className="flex items-center gap-1.5 pl-5 flex-wrap">
                  {COLOR_SWATCHES.map(c => (
                    <button
                      key={c}
                      onClick={() => setPanelText(p => ({ ...p, bgColor: c }))}
                      className={`w-5 h-5 rounded-full border-2 ${
                        panelText.bgColor.toLowerCase() === c.toLowerCase() ? 'border-yellow-400 scale-110' : 'border-zinc-700'
                      }`}
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                  <label className="w-5 h-5 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center cursor-pointer text-zinc-400 text-[10px] overflow-hidden">
                    ＋
                    <input
                      type="color"
                      value={panelText.bgColor.startsWith('#') ? panelText.bgColor : '#000000'}
                      onChange={e => setPanelText(p => ({ ...p, bgColor: e.target.value }))}
                      className="opacity-0 w-0 h-0"
                    />
                  </label>
                </div>
              )}
            </div>

            <button
              onClick={addTextFromPanel}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-zinc-900"
              style={{ background: 'linear-gradient(135deg, #fceb42, #f7d25a)' }}
            >
              {editingTextId ? '✓ 保存修改' : '＋ 添加文字'}
            </button>
          </div>
        )}

        {activeTab === 'shape' && (
          <div className="p-3 space-y-3">
            <div>
              <p className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider">填充形状</p>
              <div className="grid grid-cols-5 gap-2">
                {SHAPES.filter(s => s.kind === 'fill').map(s => {
                  const active = panelShape.shape === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setPanelShape(p => ({ ...p, shape: s.id }))}
                      className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-all border ${
                        active ? 'border-yellow-400 text-zinc-900' : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500'
                      }`}
                      style={active ? { background: '#fceb42' } : {}}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider">线条形状</p>
              <div className="grid grid-cols-5 gap-2">
                {SHAPES.filter(s => s.kind === 'line').map(s => {
                  const active = panelShape.shape === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setPanelShape(p => ({ ...p, shape: s.id, strokeWidthRatio: Math.max(p.strokeWidthRatio, 0.012) }))}
                      className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-all border ${
                        active ? 'border-yellow-400 text-zinc-900' : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500'
                      }`}
                      style={active ? { background: '#fceb42' } : {}}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 w-6">宽</span>
                <PixelInput
                  ratio={panelShape.wRatio}
                  base={Math.min(displaySize.w, displaySize.h)}
                  minPx={6}
                  maxPx={Math.max(40, Math.min(displaySize.w, displaySize.h) || 1000)}
                  onChange={r => setPanelShape(p => ({ ...p, wRatio: r }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 w-6">高</span>
                <PixelInput
                  ratio={panelShape.hRatio}
                  base={Math.min(displaySize.w, displaySize.h)}
                  minPx={6}
                  maxPx={Math.max(40, Math.min(displaySize.w, displaySize.h) || 1000)}
                  onChange={r => setPanelShape(p => ({ ...p, hRatio: r }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 w-10 flex-shrink-0">填充</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {COLOR_SWATCHES.map(c => (
                  <button
                    key={c}
                    onClick={() => setPanelShape(p => ({ ...p, fill: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      panelShape.fill.toLowerCase() === c.toLowerCase() ? 'border-yellow-400 scale-110' : 'border-zinc-700'
                    }`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 w-10 flex-shrink-0">描边</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {COLOR_SWATCHES.map(c => (
                  <button
                    key={c}
                    onClick={() => setPanelShape(p => ({ ...p, stroke: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      panelShape.stroke.toLowerCase() === c.toLowerCase() ? 'border-yellow-400 scale-110' : 'border-zinc-700'
                    }`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={addShapeFromPanel}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-zinc-900"
              style={{ background: 'linear-gradient(135deg, #fceb42, #f7d25a)' }}
            >
              {editingShapeId ? '✓ 保存修改' : '＋ 添加图形'}
            </button>
          </div>
        )}

        {activeTab === 'emoji' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">大小</span>
              <PixelInput
                ratio={panelEmoji.sizeRatio}
                base={displaySize.h}
                minPx={12}
                maxPx={Math.max(60, Math.round((displaySize.h || 1000) * 0.5))}
                onChange={r => setPanelEmoji(p => ({ ...p, sizeRatio: r }))}
              />
              <span className="text-[11px] text-zinc-500 ml-auto">
                {editingEmojiId ? '点击图案替换当前' : '点击图案直接添加'}
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJI_PALETTE.map((emoji, i) => {
                const active = editingEmojiId && panelEmoji.char === emoji
                return (
                  <button
                    key={i}
                    onClick={() => addEmojiFromPanel(emoji)}
                    className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-colors border ${
                      active ? 'border-yellow-400 bg-zinc-700' : 'border-zinc-700 bg-zinc-800 hover:border-yellow-400'
                    }`}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
            {editingEmojiId && (
              <button
                onClick={saveEmojiEdit}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-zinc-900"
                style={{ background: 'linear-gradient(135deg, #fceb42, #f7d25a)' }}
              >
                ✓ 保存修改
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
