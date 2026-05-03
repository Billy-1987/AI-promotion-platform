import { StyleTag, Background, GeminiAnalysis, TryOnResult } from '@/types'

const STYLE_TAGS: StyleTag[] = ['sport', 'outdoor', 'menswear', 'womenswear', 'kids', 'trendy', 'vintage', 'workwear']

export const BACKGROUNDS: Background[] = [
  { id: 'bg_sport1',   label: '运动场馆',   url: 'https://picsum.photos/seed/gym001/800/1000',      tags: ['sport'] },
  { id: 'bg_sport2',   label: '跑道赛场',   url: 'https://picsum.photos/seed/track01/800/1000',     tags: ['sport'] },
  { id: 'bg_outdoor1', label: '山野森林',   url: 'https://picsum.photos/seed/forest1/800/1000',     tags: ['outdoor'] },
  { id: 'bg_outdoor2', label: '溪流岩石',   url: 'https://picsum.photos/seed/river01/800/1000',     tags: ['outdoor'] },
  { id: 'bg_men1',     label: '商务大堂',   url: 'https://picsum.photos/seed/lobby01/800/1000',     tags: ['menswear', 'workwear'] },
  { id: 'bg_men2',     label: '城市街头',   url: 'https://picsum.photos/seed/city001/800/1000',     tags: ['menswear', 'trendy'] },
  { id: 'bg_women1',   label: '花园庭院',   url: 'https://picsum.photos/seed/garden1/800/1000',     tags: ['womenswear', 'vintage'] },
  { id: 'bg_women2',   label: '时尚橱窗',   url: 'https://picsum.photos/seed/window1/800/1000',     tags: ['womenswear', 'trendy'] },
  { id: 'bg_kids1',    label: '游乐园',     url: 'https://picsum.photos/seed/park001/800/1000',     tags: ['kids'] },
  { id: 'bg_kids2',    label: '彩色教室',   url: 'https://picsum.photos/seed/class01/800/1000',     tags: ['kids'] },
  { id: 'bg_trendy1',  label: '涂鸦街区',   url: 'https://picsum.photos/seed/grfti01/800/1000',     tags: ['trendy'] },
  { id: 'bg_trendy2',  label: '霓虹夜市',   url: 'https://picsum.photos/seed/neon001/800/1000',     tags: ['trendy'] },
  { id: 'bg_vintage1', label: '复古咖啡馆', url: 'https://picsum.photos/seed/cafe001/800/1000',     tags: ['vintage'] },
  { id: 'bg_vintage2', label: '老街弄堂',   url: 'https://picsum.photos/seed/alley01/800/1000',     tags: ['vintage'] },
  { id: 'bg_work1',    label: '现代办公室', url: 'https://picsum.photos/seed/office1/800/1000',     tags: ['workwear', 'menswear'] },
  { id: 'bg_work2',    label: '会议室',     url: 'https://picsum.photos/seed/meetng1/800/1000',     tags: ['workwear'] },
  // 鞋子专属背景
  { id: 'bg_shoe1',    label: '木质地板',   url: 'https://picsum.photos/seed/wood001/800/1000',     tags: ['sport', 'trendy'] },
  { id: 'bg_shoe2',    label: '户外草地',   url: 'https://picsum.photos/seed/grass01/800/1000',     tags: ['outdoor', 'sport'] },
  { id: 'bg_shoe3',    label: '城市街道',   url: 'https://picsum.photos/seed/street1/800/1000',     tags: ['trendy', 'menswear'] },
  { id: 'bg_shoe4',    label: '简约白台',   url: 'https://picsum.photos/seed/white01/800/1000',     tags: ['womenswear', 'workwear'] },
  { id: 'bg_shoe5',    label: '石板路面',   url: 'https://picsum.photos/seed/stone01/800/1000',     tags: ['vintage', 'outdoor'] },
  { id: 'bg_shoe6',    label: '运动场地',   url: 'https://picsum.photos/seed/court01/800/1000',     tags: ['sport', 'kids'] },
]

// 鞋子专属背景 ID 列表
export const SHOE_BACKGROUNDS = ['bg_shoe1', 'bg_shoe2', 'bg_shoe3', 'bg_shoe4', 'bg_shoe5', 'bg_shoe6']

export async function analyzeClothing(file: File): Promise<GeminiAnalysis> {
  const base64 = await fileToBase64(file)
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
  })
  if (!res.ok) throw new Error('Analysis failed')
  const data = await res.json()
  if (!STYLE_TAGS.includes(data.style)) data.style = 'womenswear'
  if (!data.productCategory) data.productCategory = 'clothing'
  return data as GeminiAnalysis
}

export async function generateTryOn(
  clothingFile: File | null,
  backgroundId: string,
  modelFile?: File | null,
  style?: StyleTag | null,
  productCategory?: 'clothing' | 'shoes',
  skipAnalyze?: boolean,
  modelGender?: string,
  aspectRatio?: string,
): Promise<TryOnResult> {
  const clothingBase64 = clothingFile ? await fileToBase64(clothingFile) : undefined
  const modelBase64 = modelFile ? await fileToBase64(modelFile) : undefined

  const res = await fetch('/api/tryon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clothingBase64,
      clothingMime: clothingFile?.type,
      modelBase64,
      modelMime: modelFile?.type,
      style: style ?? undefined,
      backgroundId,
      productCategory: productCategory ?? undefined,
      skipAnalyze: skipAnalyze ?? (style != null && productCategory != null),
      modelGender: modelGender ?? 'female',
      aspectRatio: aspectRatio ?? '3:4',
    }),
  })
  if (!res.ok) throw new Error('Try-on generation failed')
  const data = await res.json()

  let previewUrl: string
  if (data.generatedImageUrl) {
    previewUrl = data.generatedImageUrl
  } else {
    const subjectFile = modelFile ?? clothingFile!
    const bg = BACKGROUNDS.find(b => b.id === backgroundId)
    const subjectUrl = URL.createObjectURL(subjectFile)
    previewUrl = await compositePreview(subjectUrl, bg?.url ?? BACKGROUNDS[0].url)
    URL.revokeObjectURL(subjectUrl)
  }

  return { ...data, previewUrl }
}

export function suggestBackgrounds(style: StyleTag, productCategory?: 'clothing' | 'shoes'): string[] {
  if (productCategory === 'shoes') {
    // 鞋子优先推荐鞋子专属背景，再补充通用背景
    const others = BACKGROUNDS
      .filter(bg => !SHOE_BACKGROUNDS.includes(bg.id) && bg.tags.includes(style))
      .map(bg => bg.id)
    return [...SHOE_BACKGROUNDS, ...others]
  }
  const matched = BACKGROUNDS.filter(bg => bg.tags.includes(style)).map(bg => bg.id)
  const others = BACKGROUNDS.filter(bg => !bg.tags.includes(style)).map(bg => bg.id)
  return [...matched, ...others]
}

// 压缩图片到最大边 1024px，JPEG quality 0.85，避免 payload 过大
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = reject
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
        // strip the data:image/...;base64, prefix
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function compositePreview(subjectUrl: string, bgUrl: string): Promise<string> {
  const W = 600
  const H = 900
  const [subjectImg, bgImg] = await Promise.all([loadImage(subjectUrl), loadImage(bgUrl)])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.filter = 'blur(3px) brightness(0.75)'
  ctx.drawImage(bgImg, -12, -12, W + 24, H + 24)
  ctx.filter = 'none'

  const vignette = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.15, W / 2, H * 0.55, H * 0.75)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)

  const scale = Math.min(W / subjectImg.width, H / subjectImg.height) * 0.92
  const sw = subjectImg.width * scale
  const sh = subjectImg.height * scale
  const sx = (W - sw) / 2
  const sy = (H - sh) / 2

  ctx.save()
  const pad = 28
  roundedRectPath(ctx, sx + pad, sy + pad, sw - pad * 2, sh - pad * 2, 24)
  ctx.clip()
  ctx.drawImage(subjectImg, sx, sy, sw, sh)
  ctx.restore()

  ctx.globalAlpha = 0.18
  ctx.drawImage(subjectImg, sx, sy, sw, sh)
  ctx.globalAlpha = 1

  ctx.globalCompositeOperation = 'soft-light'
  ctx.globalAlpha = 0.12
  ctx.drawImage(bgImg, 0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1

  return canvas.toDataURL('image/jpeg', 0.93)
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
