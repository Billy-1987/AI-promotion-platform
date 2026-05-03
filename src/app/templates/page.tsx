'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import Logo from '@/components/Logo'
import AuthGuard from '@/components/AuthGuard'
import { saveToGallery, urlToDataUrl } from '@/lib/gallery'

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

// Client-side image URL cache
const imageCache: Record<string, string | null> = {}

function TemplateCard({
  item,
  onClick,
}: {
  item: TemplateItem
  onClick: (item: TemplateItem, imageUrl: string | null) => void
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const cached = imageCache[item.searchTopic]
      if (cached !== undefined) {
        setImageUrl(cached)
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/templates?topic=${encodeURIComponent(item.searchTopic)}`)
        const data = await res.json()
        const url: string | null = data.url ?? null
        if (!cancelled) {
          imageCache[item.searchTopic] = url
          setImageUrl(url)
        }
      } catch {
        if (!cancelled) setImageUrl(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [item.searchTopic])

  const colorClass = CATEGORY_COLORS[item.category]

  return (
    <div
      className="group bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col"
      onClick={() => onClick(item, imageUrl)}
    >
      <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
            <span className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs">AI 生成中...</span>
          </div>
        ) : imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-lg">
                点击预览
              </span>
            </div>
          </>
        ) : (
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
      </div>
    </div>
  )
}

function PreviewModal({
  item,
  imageUrl,
  onClose,
}: {
  item: TemplateItem
  imageUrl: string | null
  onClose: () => void
}) {
  const [withLogo, setWithLogo] = useState(false)
  const [compositing, setCompositing] = useState(false)
  const [compositedUrl, setCompositedUrl] = useState<string | null>(null)
  const [logoPos, setLogoPos] = useState({ x: 0.5, y: 0.92 }) // 相对位置 (0-1)
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const posterImgRef = useRef<HTMLImageElement | null>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      if (src.startsWith('http://') || src.startsWith('https://')) {
        img.crossOrigin = 'anonymous'
      }
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
    if (!imageUrl) return
    setCompositing(true)
    try {
      const [poster, logo] = await Promise.all([
        loadImage(imageUrl),
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
    setCompositedUrl(null)
    setWithLogo(false)
    posterImgRef.current = null
    logoImgRef.current = null
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!withLogo) return
    setDragging(true)
    updateLogoPos(e.clientX, e.clientY)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragging) return
    updateLogoPos(e.clientX, e.clientY)
  }

  function handleMouseUp() {
    setDragging(false)
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (!withLogo || e.touches.length !== 1) return
    setDragging(true)
    const touch = e.touches[0]
    updateLogoPos(touch.clientX, touch.clientY)
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!dragging || e.touches.length !== 1) return
    e.preventDefault()
    const touch = e.touches[0]
    updateLogoPos(touch.clientX, touch.clientY)
  }

  function handleTouchEnd() {
    setDragging(false)
  }

  function updateLogoPos(clientX: number, clientY: number) {
    const preview = previewRef.current
    if (!preview) return
    const rect = preview.getBoundingClientRect()
    let x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    let y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    // 吸附：距中心 3% 以内自动对齐
    if (Math.abs(x - 0.5) < 0.03) x = 0.5
    if (Math.abs(y - 0.5) < 0.03) y = 0.5
    setLogoPos({ x, y })
  }

  // 位置改变时重绘
  useEffect(() => {
    if (withLogo && posterImgRef.current && logoImgRef.current) {
      redrawCanvas()
    }
  }, [logoPos, withLogo])

  async function handleDownload() {
    if (!imageUrl) return
    const isLogoVersion = withLogo && compositedUrl
    const src = isLogoVersion ? compositedUrl! : imageUrl
    const filename = isLogoVersion ? `${item.title}-BIGOFFS.jpg` : `${item.title}.png`

    // 触发浏览器下载
    const a = document.createElement('a')
    a.href = src
    a.download = filename
    a.click()

    // 同步存入图库
    try {
      const dataUrl = await urlToDataUrl(src)
      saveToGallery({ dataUrl, filename, source: 'template' })
    } catch (e) {
      console.error('Gallery save failed', e)
    }
  }

  const displaySrc = withLogo && compositedUrl ? compositedUrl : imageUrl

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded text-white font-medium ${CATEGORY_COLORS[item.category]}`}>
              {item.category}
            </span>
            <h3 className="text-lg font-bold text-slate-800">{item.title}</h3>
            {item.date && <span className="text-sm text-slate-500">{item.date}</span>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        {/* Main image */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-50">
          {displaySrc ? (
            <div className="relative">
              <div
                ref={previewRef}
                className={`relative ${withLogo ? 'cursor-move' : ''}`}
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
                  alt={item.title}
                  className="max-h-[52vh] w-auto rounded-lg shadow-2xl object-contain select-none"
                  draggable={false}
                />
                {/* 拖动时显示居中辅助线 */}
                {dragging && (
                  <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
                    {/* 垂直中线 */}
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px w-px border-l-2 border-dashed border-white/60" />
                    {/* 水平中线 */}
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-px h-px border-t-2 border-dashed border-white/60" />
                    {/* 中心交叉点 */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white/80 bg-white/20" />
                    {/* 吸附时高亮提示 */}
                    {logoPos.x === 0.5 && (
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px w-px border-l-2 border-solid border-yellow-400/90" />
                    )}
                    {logoPos.y === 0.5 && (
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-px h-px border-t-2 border-solid border-yellow-400/90" />
                    )}
                  </div>
                )}
              </div>
              {withLogo && (
                <span className="absolute top-2 right-2 bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                  {dragging ? '拖动中...' : '已添加 Logo · 可拖动'}
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
                : <><img src="/bigoffs-logo.png" alt="" className="h-4 w-auto" />一键添加 Logo</>
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

function TemplatesContent() {
  const { user, logout } = useAuth()
  const [category, setCategory] = useState<Category>('全部')
  const [preview, setPreview] = useState<{ item: TemplateItem; imageUrl: string | null } | null>(null)

  const categories: Category[] = ['全部', '节日', '节气', '促销', '通用']
  const filtered = category === '全部' ? TEMPLATES : TEMPLATES.filter(t => t.category === category)

  const handleCardClick = useCallback((item: TemplateItem, imageUrl: string | null) => {
    setPreview({ item, imageUrl })
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f7' }}>
      <header className="bigoffs-header px-6 flex items-center justify-between" style={{ height: 60 }}>
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-lg font-bold text-white">智能推广平台</h1>
            <p className="text-xs text-slate-400">模板社区</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-3">
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
        </div>
      </header>

      <nav className="bigoffs-header border-b border-white/10 px-6 flex gap-1">
        {[
          { label: '运营日历', href: '/calendar', icon: '📅' },
          { label: '模板社区', href: '/templates', icon: '🎨', active: true },
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
                onClick={() => setCategory(c)}
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

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map(item => (
            <TemplateCard key={item.id} item={item} onClick={handleCardClick} />
          ))}
        </div>
      </main>

      {preview && (
        <PreviewModal
          item={preview.item}
          imageUrl={preview.imageUrl}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}

export default function TemplatesPage() {
  return <AuthGuard><TemplatesContent /></AuthGuard>
}
