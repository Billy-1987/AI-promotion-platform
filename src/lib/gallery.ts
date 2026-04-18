export interface GalleryItem {
  id: string
  dataUrl: string       // base64 图片数据
  filename: string
  source: 'tryon' | 'template' | 'image-design'  // 来源
  createdAt: number
}

const KEY = 'aipp_gallery'

export function getGallery(): GalleryItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveToGallery(item: Omit<GalleryItem, 'id' | 'createdAt'>) {
  const items = getGallery()
  const newItem: GalleryItem = {
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  }
  // 最多保留 200 张，防止 localStorage 溢出
  const updated = [newItem, ...items].slice(0, 200)
  localStorage.setItem(KEY, JSON.stringify(updated))
  return newItem
}

export function deleteFromGallery(ids: string[]) {
  const items = getGallery().filter(i => !ids.includes(i.id))
  localStorage.setItem(KEY, JSON.stringify(items))
}

// 把任意 URL / blob URL 转成 base64 dataURL
export async function urlToDataUrl(url: string): Promise<string> {
  // 已经是 base64
  if (url.startsWith('data:')) return url
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
