'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import Logo from '@/components/Logo'
import AuthGuard from '@/components/AuthGuard'
import { saveToGallery, urlToDataUrl } from '@/lib/gallery'
import { APP_VERSION } from '@/lib/version'
import { downloadDataUrl } from '@/lib/download'

type Category = '全部' | '节日' | '节气' | '促销' | '通用'

interface TemplateItem {
  id: string
  title: string
  category: Category
  date?: string
  searchTopic: string
}

const TEMPLATES: TemplateItem[] = [
  // 节日 - 传统节日
  { id: 'yuandan',    title: '元旦',   category: '节日', date: '1月1日',        searchTopic: '元旦' },
  { id: 'chunjie',   title: '春节',   category: '节日', date: '农历正月初一',   searchTopic: '春节' },
  { id: 'yuanxiao',  title: '元宵节', category: '节日', date: '农历正月十五',   searchTopic: '元宵节' },
  { id: 'qingming',  title: '清明节', category: '节日', date: '4月4-6日',       searchTopic: '清明节' },
  { id: 'duanwu',    title: '端午节', category: '节日', date: '农历五月初五',   searchTopic: '端午节' },
  { id: 'qixi',      title: '七夕节', category: '节日', date: '农历七月初七',   searchTopic: '七夕节' },
  { id: 'zhongyuan', title: '中元节', category: '节日', date: '农历七月十五',   searchTopic: '中元节' },
  { id: 'zhongqiu',  title: '中秋节', category: '节日', date: '农历八月十五',   searchTopic: '中秋节' },
  { id: 'chongyang', title: '重阳节', category: '节日', date: '农历九月初九',   searchTopic: '重阳节' },
  { id: 'dongzhi_j', title: '冬至',   category: '节日', date: '12月21-23日',    searchTopic: '冬至' },
  // 节日 - 现代节日
  { id: 'qingren',   title: '情人节', category: '节日', date: '2月14日',        searchTopic: '情人节' },
  { id: 'funv',      title: '妇女节', category: '节日', date: '3月8日',         searchTopic: '妇女节' },
  { id: 'laodong',   title: '劳动节', category: '节日', date: '5月1日',         searchTopic: '劳动节' },
  { id: 'muqin',     title: '母亲节', category: '节日', date: '5月第二个周日',  searchTopic: '母亲节' },
  { id: 'ertong',    title: '儿童节', category: '节日', date: '6月1日',         searchTopic: '儿童节' },
  { id: 'fuqin',     title: '父亲节', category: '节日', date: '6月第三个周日',  searchTopic: '父亲节' },
  { id: 'guoqing',   title: '国庆节', category: '节日', date: '10月1日',        searchTopic: '国庆节' },
  { id: 'shengdan',  title: '圣诞节', category: '节日', date: '12月25日',       searchTopic: '圣诞节' },

  // 节气 - 全部24节气
  { id: 'xiaohan',     title: '小寒', category: '节气', date: '1月5-7日',    searchTopic: '小寒' },
  { id: 'dahan',       title: '大寒', category: '节气', date: '1月20-21日',  searchTopic: '大寒' },
  { id: 'lichun',      title: '立春', category: '节气', date: '2月3-5日',    searchTopic: '立春' },
  { id: 'yushui',      title: '雨水', category: '节气', date: '2月18-20日',  searchTopic: '雨水' },
  { id: 'jingzhe',     title: '惊蛰', category: '节气', date: '3月5-7日',    searchTopic: '惊蛰' },
  { id: 'chunfen',     title: '春分', category: '节气', date: '3月20-21日',  searchTopic: '春分' },
  { id: 'qingming_q',  title: '清明', category: '节气', date: '4月4-6日',    searchTopic: '清明节' },
  { id: 'guyu',        title: '谷雨', category: '节气', date: '4月19-21日',  searchTopic: '谷雨' },
  { id: 'lixia',       title: '立夏', category: '节气', date: '5月5-7日',    searchTopic: '立夏' },
  { id: 'xiaoman',     title: '小满', category: '节气', date: '5月20-22日',  searchTopic: '小满' },
  { id: 'mangzhong',   title: '芒种', category: '节气', date: '6月5-7日',    searchTopic: '芒种' },
  { id: 'xiazhi',      title: '夏至', category: '节气', date: '6月21-22日',  searchTopic: '夏至' },
  { id: 'xiaoshu',     title: '小暑', category: '节气', date: '7月6-8日',    searchTopic: '小暑' },
  { id: 'dashu',       title: '大暑', category: '节气', date: '7月22-24日',  searchTopic: '大暑' },
  { id: 'liqiu',       title: '立秋', category: '节气', date: '8月7-9日',    searchTopic: '立秋' },
  { id: 'chushu',      title: '处暑', category: '节气', date: '8月22-24日',  searchTopic: '处暑' },
  { id: 'bailu',       title: '白露', category: '节气', date: '9月7-9日',    searchTopic: '白露' },
  { id: 'qiufen',      title: '秋分', category: '节气', date: '9月22-24日',  searchTopic: '秋分' },
  { id: 'hanlu',       title: '寒露', category: '节气', date: '10月7-9日',   searchTopic: '寒露' },
  { id: 'shuangjiang', title: '霜降', category: '节气', date: '10月23-24日', searchTopic: '霜降' },
  { id: 'lidong',      title: '立冬', category: '节气', date: '11月7-8日',   searchTopic: '立冬' },
  { id: 'xiaoxue',     title: '小雪', category: '节气', date: '11月22-23日', searchTopic: '小雪' },
  { id: 'daxue',       title: '大雪', category: '节气', date: '12月6-8日',   searchTopic: '大雪' },
  { id: 'dongzhi_q',   title: '冬至', category: '节气', date: '12月21-23日', searchTopic: '冬至' },

  // 促销
  { id: 'nianhuo',       title: '年货节',   category: '促销', date: '1月',         searchTopic: '年货节' },
  { id: 'qingren_sale',  title: '情人节促销', category: '促销', date: '2月14日',   searchTopic: '情人节促销' },
  { id: 'nvwang',        title: '38女王节', category: '促销', date: '3月8日',       searchTopic: '38女王节' },
  { id: 'chunji',        title: '春季上新', category: '促销', date: '3-4月',        searchTopic: '春季上新' },
  { id: 'wuyi_sale',     title: '五一促销', category: '促销', date: '5月1日',       searchTopic: '五一促销' },
  { id: 'sale618',       title: '618大促',  category: '促销', date: '6月18日',      searchTopic: '618大促' },
  { id: 'shuqi',         title: '暑期特惠', category: '促销', date: '7-8月',        searchTopic: '暑期特惠' },
  { id: 'qixi_sale',     title: '七夕促销', category: '促销', date: '农历七月初七', searchTopic: '七夕促销' },
  { id: 'kaixue',        title: '开学季',   category: '促销', date: '8-9月',        searchTopic: '开学季' },
  { id: 'zhongqiu_gift', title: '中秋礼盒', category: '促销', date: '农历八月十五', searchTopic: '中秋礼盒' },
  { id: 'guoqing_sale',  title: '国庆大促', category: '促销', date: '10月1日',      searchTopic: '国庆大促' },
  { id: 'shuang11',      title: '双11狂欢', category: '促销', date: '11月11日',     searchTopic: '双11狂欢' },
  { id: 'shuang12',      title: '双12年终', category: '促销', date: '12月12日',     searchTopic: '双12年终' },
  { id: 'shengdan_sale', title: '圣诞促销', category: '促销', date: '12月25日',     searchTopic: '圣诞促销' },
  { id: 'nianzong',      title: '年终盘点', category: '促销', date: '12月',         searchTopic: '年终盘点' },

  // 通用
  { id: 'xinpin',  title: '新品上市', category: '通用', searchTopic: '新品上市' },
  { id: 'pinpai',  title: '品牌推广', category: '通用', searchTopic: '品牌推广' },
  { id: 'mendian', title: '门店活动', category: '通用', searchTopic: '门店活动' },
  { id: 'huiyuan', title: '会员专享', category: '通用', searchTopic: '会员专享' },
  { id: 'xianshu', title: '限时秒杀', category: '通用', searchTopic: '限时秒杀' },
  { id: 'manjian', title: '满减优惠', category: '通用', searchTopic: '满减优惠' },
]

const CATEGORY_COLORS: Record<Category, string> = {
  '全部': 'bg-slate-500',
  '节日': 'bg-rose-600',
  '节气': 'bg-emerald-600',
  '促销': 'bg-amber-600',
  '通用': 'bg-blue-600',
}

const ROLE_LABEL: Record<string, string> = { hq: '总部市场部', regional: '区域运营' }

type VariantData = { url: string | null; slogans: [string, string] }

// Client-side cache — keyed by `topic:variant`
const variantCache: Record<string, VariantData> = {}

async function fetchVariant(topic: string, variant: number, force = false): Promise<VariantData> {
  const key = `${topic}:${variant}`
  if (!force && variantCache[key] !== undefined) return variantCache[key]
  try {
    const params = new URLSearchParams({ topic, variant: String(variant) })
    if (force) params.set('force', '1')
    const res = await fetch(`/api/templates?${params}`)
    const data = await res.json()
    const result: VariantData = {
      url: data.url ?? null,
      slogans: Array.isArray(data.slogans) && data.slogans.length === 2
        ? (data.slogans as [string, string])
        : [`${topic}，精彩呈现`, `${topic}，惊喜不停`],
    }
    variantCache[key] = result
    return result
  } catch {
    return { url: null, slogans: [`${topic}，精彩呈现`, `${topic}，惊喜不停`] }
  }
}

function TemplateCard({
  item,
  onClick,
}: {
  item: TemplateItem
  onClick: (item: TemplateItem, data: VariantData) => void
}) {
  const [url0, setUrl0] = useState<string | null>(null)
  const [slogans0, setSlogans0] = useState<[string, string] | null>(null)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver — only start loading when card enters viewport
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    fetchVariant(item.searchTopic, 0).then(v0 => {
      if (!cancelled) { setUrl0(v0.url); setSlogans0(v0.slogans); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [visible, item.searchTopic])

  const colorClass = CATEGORY_COLORS[item.category]

  return (
    <div
      ref={cardRef}
      className="group bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col"
      onClick={() => onClick(item, { url: url0, slogans: slogans0 ?? [`${item.searchTopic}，精彩呈现`, `${item.searchTopic}，惊喜不停`] })}
    >
      {/* 9:16 thumbnail */}
      <div className="aspect-[9/16] bg-slate-100 relative overflow-hidden">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
            <span className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs">AI 生成中...</span>
          </div>
        ) : url0 ? (
          <>
            <img
              src={url0}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-lg">
                点击预览
              </span>
            </div>
          </>
        ) : !visible ? null : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <span className="text-3xl">🎨</span>
            <span className="text-xs">生成失败</span>
          </div>
        )}
        <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded text-white font-medium ${colorClass}`}>
          {item.category}
        </span>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
        {item.date && <p className="text-xs text-slate-500 mt-0.5">{item.date}</p>}
        {slogans0 && (
          <p className="text-xs text-slate-600 mt-1.5 italic line-clamp-1" title={slogans0[0]}>
            「{slogans0[0]}」
          </p>
        )}
      </div>
    </div>
  )
}

function PreviewModal({
  item,
  initial,
  username,
  onClose,
}: {
  item: TemplateItem
  initial: VariantData
  username?: string
  onClose: () => void
}) {
  const [activeVariant, setActiveVariant] = useState(0)
  // Start with whatever variant 0 we already have; lazy-load variant 1 on open
  const [imageUrls, setImageUrls] = useState<[string | null, string | null]>([initial.url, null])
  const [variantSlogans, setVariantSlogans] = useState<[[string, string], [string, string] | null]>([initial.slogans, null])
  const [sloganIndex, setSloganIndex] = useState<0 | 1>(0)
  const [loadingV1, setLoadingV1] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const imageUrl = imageUrls[activeVariant] ?? imageUrls[0]
  const currentSlogans = variantSlogans[activeVariant] ?? variantSlogans[0]
  const currentSlogan = currentSlogans[sloganIndex]

  async function handleRegenerate() {
    setRegenerating(true)
    handleRemoveLogo()
    const next = await fetchVariant(item.searchTopic, activeVariant, true)
    if (next.url) {
      setImageUrls(prev => {
        const arr: [string | null, string | null] = [prev[0], prev[1]]
        arr[activeVariant] = next.url
        return arr
      })
      setVariantSlogans(prev => {
        const arr: [[string, string], [string, string] | null] = [prev[0], prev[1]]
        arr[activeVariant] = next.slogans
        return arr
      })
    }
    setRegenerating(false)
  }

  function handleSwapSlogan() {
    setSloganIndex(i => (i === 0 ? 1 : 0))
  }

  // Load variant 1 in background when modal opens
  useEffect(() => {
    if (imageUrls[1]) return
    let cancelled = false
    setLoadingV1(true)
    fetchVariant(item.searchTopic, 1).then(v1 => {
      if (!cancelled) {
        setImageUrls(prev => [prev[0], v1.url])
        setVariantSlogans(prev => [prev[0], v1.slogans])
        setLoadingV1(false)
      }
    })
    return () => { cancelled = true }
  }, [item.searchTopic]) // eslint-disable-line react-hooks/exhaustive-deps

  const [withLogo, setWithLogo] = useState(false)
  const [compositing, setCompositing] = useState(false)
  const [logoPos, setLogoPos] = useState({ x: 0.85, y: 0.10 })
  const [logoScale, setLogoScale] = useState(0.22)
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const posterImgRef = useRef<HTMLImageElement | null>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)
  const logoOverlayRef = useRef<HTMLDivElement>(null)

  // Auto-save to gallery when image becomes available
  useEffect(() => {
    if (!imageUrl || !username) return
    let cancelled = false
    ;(async () => {
      try {
        const dataUrl = await urlToDataUrl(imageUrl)
        if (!cancelled) await saveToGallery({ dataUrl, filename: `${item.title}.png`, source: 'template' }, username)
      } catch { /* non-fatal */ }
    })()
    return () => { cancelled = true }
  }, [imageUrl, username]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset logo state when switching variants
  function switchVariant(v: number) {
    setActiveVariant(v)
    setSloganIndex(0)
    setWithLogo(false)
    posterImgRef.current = null
    logoImgRef.current = null
    setLogoPos({ x: 0.85, y: 0.10 })
    setLogoScale(0.22)
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      // 本地资源直接加载
      if (!src.startsWith('http://') && !src.startsWith('https://')) {
        img.src = src
        return
      }
      // 外部 URL：先 fetch 转成 blob URL，避免 canvas CORS 污染
      fetch(src)
        .then(r => r.blob())
        .then(blob => { img.src = URL.createObjectURL(blob) })
        .catch(reject)
    })
  }

  async function bakeWithLogo(baseUrl: string): Promise<string> {
    const [poster, logo] = await Promise.all([loadImage(baseUrl), loadImage('/bigoffs-logo.png')])
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    canvas.width = poster.naturalWidth
    canvas.height = poster.naturalHeight
    ctx.drawImage(poster, 0, 0)
    const logoW = poster.naturalWidth * logoScale
    const logoH = (logo.naturalHeight / logo.naturalWidth) * logoW
    const logoX = poster.naturalWidth * logoPos.x - logoW / 2
    const logoY = poster.naturalHeight * logoPos.y - logoH / 2
    ctx.drawImage(logo, logoX, logoY, logoW, logoH)
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  async function handleAddLogo() {
    if (!imageUrl) return
    setCompositing(true)
    try {
      const logo = await loadImage('/bigoffs-logo.png')
      logoImgRef.current = logo
      setWithLogo(true)
    } catch (e) {
      console.error('Logo load failed', e)
    } finally {
      setCompositing(false)
    }
  }

  function handleRemoveLogo() {
    setWithLogo(false)
    posterImgRef.current = null
    logoImgRef.current = null
    setLogoScale(0.22)
    setLogoPos({ x: 0.85, y: 0.10 })
  }

  // ── Drag / Resize handlers for logo overlay ──────────────────────
  function startLogoDrag(e: React.PointerEvent) {
    if ((e.target as HTMLElement).dataset.handle) return
    e.preventDefault()
    e.stopPropagation()
    const overlay = logoOverlayRef.current?.parentElement
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const origX = logoPos.x * rect.width
    const origY = logoPos.y * rect.height
    const pid = e.pointerId
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(pid)
    setDragging(true)

    const onMove = (ev: PointerEvent) => {
      let nx = Math.max(0.02, Math.min(0.98, (origX + ev.clientX - startX) / rect.width))
      let ny = Math.max(0.02, Math.min(0.98, (origY + ev.clientY - startY) / rect.height))
      if (Math.abs(nx - 0.5) < 0.015) nx = 0.5
      if (Math.abs(ny - 0.5) < 0.015) ny = 0.5
      setLogoPos({ x: nx, y: ny })
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

  function startLogoResize(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const overlay = logoOverlayRef.current?.parentElement
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const cx = logoPos.x * rect.width
    const cy = logoPos.y * rect.height
    const startDist = Math.hypot(e.clientX - rect.left - cx, e.clientY - rect.top - cy) || 1
    const baseScale = logoScale
    const pid = e.pointerId
    const target = e.currentTarget as HTMLDivElement
    target.setPointerCapture(pid)

    const onMove = (ev: PointerEvent) => {
      const d = Math.hypot(ev.clientX - rect.left - cx, ev.clientY - rect.top - cy)
      const k = d / startDist
      setLogoScale(Math.max(0.05, Math.min(0.6, +(baseScale * k).toFixed(4))))
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
    if (!imageUrl) return
    let src: string
    let filename: string
    if (withLogo) {
      setCompositing(true)
      try {
        src = await bakeWithLogo(imageUrl)
      } finally {
        setCompositing(false)
      }
      filename = `${item.title}-BIGOFFS.jpg`
    } else {
      src = imageUrl
      filename = `${item.title}.png`
    }

    // 触发浏览器下载（mobile-safe: Web Share API → Blob URL）
    const dataUrl = src.startsWith('data:') ? src : await urlToDataUrl(src)
    await downloadDataUrl(dataUrl, filename)

    // 同步存入图库
    try {
      await saveToGallery({ dataUrl, filename, source: 'template' }, username)
    } catch (e) {
      console.error('Gallery save failed', e)
    }
  }

  const displaySrc = imageUrl

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <canvas ref={canvasRef} className="hidden" />

      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 md:px-6 py-3 md:py-4 border-b border-slate-200 shrink-0">
          {/* Top row: badge + title + (date) + close */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <span className={`text-xs px-2 py-0.5 rounded text-white font-medium whitespace-nowrap flex-shrink-0 ${CATEGORY_COLORS[item.category]}`}>
              {item.category}
            </span>
            <h3 className="text-base md:text-lg font-bold text-slate-800 truncate min-w-0 flex-1">{item.title}</h3>
            {item.date && <span className="hidden sm:inline text-sm text-slate-500 whitespace-nowrap flex-shrink-0">{item.date}</span>}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 flex-shrink-0"
            >
              ×
            </button>
          </div>
          {/* Action row: variant switcher + 换金句 + 换一张 (wraps / scrolls horizontally on narrow screens) */}
          <div className="flex items-center gap-2 md:gap-3 mt-2 md:mt-3 overflow-x-auto whitespace-nowrap">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden flex-shrink-0">
              <button
                onClick={() => switchVariant(0)}
                className={`px-2.5 md:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${activeVariant === 0 ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                style={activeVariant === 0 ? { background: '#0034cc' } : {}}
              >
                款式一
              </button>
              <button
                onClick={() => { if (imageUrls[1]) switchVariant(1) }}
                disabled={!imageUrls[1]}
                className={`px-2.5 md:px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${activeVariant === 1 ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50'}`}
                style={activeVariant === 1 ? { background: '#0034cc' } : {}}
              >
                {loadingV1 && <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />}
                款式二
              </button>
            </div>
            <button
              onClick={handleSwapSlogan}
              className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0 whitespace-nowrap"
              title="切换另一条金句"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m-4 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              换金句
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors flex-shrink-0 whitespace-nowrap"
            >
              {regenerating
                ? <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
              }
              换一张
            </button>
          </div>
        </div>

        {/* Main image */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-50">
          {displaySrc ? (
            <div className="relative">
              <div ref={previewRef} className="relative inline-block">
                <img
                  src={displaySrc}
                  alt={item.title}
                  className="block max-h-[52vh] w-auto rounded-lg shadow-2xl object-contain select-none"
                  draggable={false}
                />
                {withLogo && (
                  <>
                    {/* 拖动时显示居中辅助线 */}
                    {dragging && (
                      <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px w-px border-l-2 border-dashed border-white/60" />
                        <div className="absolute left-0 right-0 top-1/2 -translate-y-px h-px border-t-2 border-dashed border-white/60" />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white/80 bg-white/20" />
                        {logoPos.x === 0.5 && (
                          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px w-px border-l-2 border-solid border-yellow-400/90" />
                        )}
                        {logoPos.y === 0.5 && (
                          <div className="absolute left-0 right-0 top-1/2 -translate-y-px h-px border-t-2 border-solid border-yellow-400/90" />
                        )}
                      </div>
                    )}
                    {/* Logo overlay — drag body to move, drag ↘ handle to resize */}
                    <div
                      ref={logoOverlayRef}
                      onPointerDown={startLogoDrag}
                      className="absolute"
                      style={{
                        left: `${logoPos.x * 100}%`,
                        top: `${logoPos.y * 100}%`,
                        width: `${logoScale * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        cursor: dragging ? 'grabbing' : 'grab',
                        touchAction: 'none',
                      }}
                    >
                      <img
                        src="/bigoffs-logo.png"
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
                      {/* Resize handle (bottom-right) */}
                      <div
                        data-handle="resize"
                        onPointerDown={startLogoResize}
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
                  </>
                )}
              </div>
              {withLogo && (
                <span className="absolute top-2 right-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-medium pointer-events-none">
                  {dragging ? '拖动中...' : '拖动定位 · 拖黄色角缩放'}
                </span>
              )}
              {compositing && (
                <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                  <span className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-center">
              <div className="text-5xl mb-3">🎨</div>
              <p>暂无可用图片</p>
            </div>
          )}
        </div>

        {/* Slogan */}
        {currentSlogan && (
          <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center justify-center gap-2 shrink-0">
            <span className="text-slate-400 text-sm">「</span>
            <p className="text-base font-medium text-slate-800 italic text-center">{currentSlogan}</p>
            <span className="text-slate-400 text-sm">」</span>
            <span className="text-xs text-slate-400 ml-2">{sloganIndex + 1}/2</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
          {!withLogo ? (
            <button
              onClick={handleAddLogo}
              disabled={!imageUrl || compositing}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm disabled:opacity-40 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shrink-0"
            >
              {compositing
                ? <><span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />处理中...</>
                : <><img src="/bigoffs-logo.png" alt="" className="h-4 w-auto" />添加 Logo</>
              }
            </button>
          ) : (
            <button
              onClick={handleRemoveLogo}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors shrink-0"
            >
              ✕ 移除 Logo
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={!imageUrl}
            className="flex-1 px-4 py-2.5 text-white disabled:opacity-40 text-sm font-medium rounded-lg transition-colors"
            style={{ background: '#0034cc' }}
          >
            {withLogo ? '下载（含 Logo）' : '下载模板'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 12

function TemplatesContent() {
  const { user, logout } = useAuth()
  const [category, setCategory] = useState<Category>('全部')
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState<{ item: TemplateItem; initial: VariantData } | null>(null)

  const categories: Category[] = ['全部', '节日', '节气', '促销', '通用']
  const filtered = category === '全部' ? TEMPLATES : TEMPLATES.filter(t => t.category === category)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleCategoryChange(c: Category) {
    setCategory(c)
    setPage(1)
  }

  const handleCardClick = useCallback((item: TemplateItem, data: VariantData) => {
    setPreview({ item, initial: data })
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f7' }}>
      <header className="bigoffs-header px-3 md:px-6 flex items-center justify-between overflow-hidden flex-shrink-0" style={{ height: 60 }}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Logo />
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold text-white truncate">智能推广平台</h1>
            <p className="text-xs text-slate-400 truncate">模板社区</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {user && (
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <div className="text-right hidden sm:block min-w-0">
                <p className="text-sm text-white font-medium truncate">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">{ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}</p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#0034cc' }}>
                {user.name[0]}
              </div>
              <button onClick={logout} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors flex-shrink-0 whitespace-nowrap">退出</button>
            </div>
          )}
          <span className="hidden md:inline text-xs text-slate-400 ml-1 flex-shrink-0">{APP_VERSION}</span>
        </div>
      </header>

      <nav className="bigoffs-header border-b border-white/10 px-3 md:px-6 flex gap-1 flex-shrink-0 overflow-x-auto whitespace-nowrap">
        {[
          { label: '运营日历', href: '/calendar', icon: '📅' },
          { label: '模板社区', href: '/templates', icon: '🎨', active: true },
          { label: 'AI 换装', href: '/tryon', icon: '👗' },
          { label: 'AI 图片设计', href: '/image-design', icon: '✨' },
          { label: '我的图库', href: '/gallery', icon: '🖼️' },
        ].map(item => (
          <Link
            key={item.label}
            href={item.href}
            prefetch
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              item.active
                ? 'text-white'
                : 'border-transparent text-slate-400 hover:text-white hover:border-white/30'
            }`}
            style={item.active ? { borderBottomColor: '#fcea42', color: '#fcea42' } : {}}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">海报模板</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              共 {filtered.length} 套模板 · 由 AI 按需生成，免费商用
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-lg p-1 self-start sm:self-auto">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => handleCategoryChange(c)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  category === c ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
                style={category === c ? { background: '#0034cc' } : {}}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {paged.map(item => (
            <TemplateCard key={item.id} item={item} onClick={handleCardClick} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
                  n === page
                    ? 'text-white border-transparent'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                style={n === page ? { background: '#0034cc', borderColor: '#0034cc' } : {}}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </main>

      {preview && (
        <PreviewModal
          item={preview.item}
          initial={preview.initial}
          username={user?.username}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}

export default function TemplatesPage() {
  return <AuthGuard><TemplatesContent /></AuthGuard>
}
