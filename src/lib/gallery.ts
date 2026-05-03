export interface GalleryItem {
  id: string
  dataUrl: string       // base64 图片数据
  filename: string
  source: 'tryon' | 'template' | 'image-design'  // 来源
  createdAt: number
}

// 按账号隔离：同一账号在任何设备/浏览器下载的图片都归到同一个 key
function galleryKey(username?: string) {
  return username ? `aipp_gallery_${username}` : 'aipp_gallery'
}

export function getGallery(username?: string): GalleryItem[] {
  if (typeof window === 'undefined') return []
  try {
    // 兼容旧数据：如果有账号 key 就用账号 key，否则回退到通用 key
    const key = galleryKey(username)
    const data = localStorage.getItem(key)
    if (data) return JSON.parse(data)
    // 迁移旧数据
    const legacy = localStorage.getItem('aipp_gallery')
    if (legacy && username) {
      localStorage.setItem(key, legacy)
      localStorage.removeItem('aipp_gallery')
      return JSON.parse(legacy)
    }
    return JSON.parse(legacy ?? '[]')
  } catch {
    return []
  }
}

export function saveToGallery(item: Omit<GalleryItem, 'id' | 'createdAt'>, username?: string) {
  const key = galleryKey(username)
  const items = getGallery(username)
  const newItem: GalleryItem = {
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  }
  // 最多保留 200 张，防止 localStorage 溢出
  const updated = [newItem, ...items].slice(0, 200)
  localStorage.setItem(key, JSON.stringify(updated))
  return newItem
}

export function deleteFromGallery(ids: string[], username?: string) {
  const key = galleryKey(username)
  const items = getGallery(username).filter(i => !ids.includes(i.id))
  localStorage.setItem(key, JSON.stringify(items))
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
