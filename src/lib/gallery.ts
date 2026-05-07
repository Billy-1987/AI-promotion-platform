export interface GalleryItem {
  id: string
  dataUrl: string
  filename: string
  source: 'tryon' | 'template' | 'image-design'
  createdAt: number
}

interface GalleryMeta {
  id: string
  filename: string
  source: GalleryItem['source']
  createdAt: number
}

const IDB_NAME = 'aipp_gallery_db'
const IDB_STORE = 'images'
const GALLERY_MAX = 200

function metaKey(username?: string) {
  return username ? `aipp_gallery_meta_${username}` : 'aipp_gallery_meta'
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(id: string, dataUrl: string) {
  const db = await openIDB()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  tx.objectStore(IDB_STORE).put(dataUrl, id)
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
  db.close()
}

async function idbGet(id: string): Promise<string | null> {
  const db = await openIDB()
  const tx = db.transaction(IDB_STORE, 'readonly')
  const result = await new Promise<string | null>((res, rej) => {
    const req = tx.objectStore(IDB_STORE).get(id)
    req.onsuccess = () => res(req.result ?? null)
    req.onerror = () => rej(req.error)
  })
  db.close()
  return result
}

async function idbDeleteMany(ids: string[]) {
  if (!ids.length) return
  const db = await openIDB()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  ids.forEach(id => tx.objectStore(IDB_STORE).delete(id))
  db.close()
}

function loadMeta(username?: string): GalleryMeta[] {
  if (typeof window === 'undefined') return []
  try {
    // Migrate old localStorage gallery data into new meta format
    const key = metaKey(username)
    const existing = localStorage.getItem(key)
    if (existing) return JSON.parse(existing)

    // Try migrating from old full-data key
    const oldKey = username ? `aipp_gallery_${username}` : 'aipp_gallery'
    const old = localStorage.getItem(oldKey)
    if (old) {
      const items: GalleryItem[] = JSON.parse(old)
      const metas: GalleryMeta[] = items.map(({ id, filename, source, createdAt }) => ({ id, filename, source, createdAt }))
      localStorage.setItem(key, JSON.stringify(metas))
      // Migrate dataUrls to IndexedDB in background
      items.forEach(item => { idbPut(item.id, item.dataUrl).catch(() => {}) })
      localStorage.removeItem(oldKey)
      return metas
    }
    return []
  } catch { return [] }
}

function saveMeta(metas: GalleryMeta[], username?: string) {
  try {
    localStorage.setItem(metaKey(username), JSON.stringify(metas.slice(0, GALLERY_MAX)))
    // Notify same-tab listeners (storage event only fires for other tabs)
    window.dispatchEvent(new Event('gallery-updated'))
  } catch { /* quota exceeded — skip */ }
}

export function getGallery(username?: string): GalleryItem[] {
  const metas = loadMeta(username)
  // Return items with empty dataUrl — caller must use getGalleryItem to get full data
  return metas.map(m => ({ ...m, dataUrl: '' }))
}

export async function getGalleryItem(id: string): Promise<string | null> {
  try { return await idbGet(id) } catch { return null }
}

export async function saveToGallery(
  item: Omit<GalleryItem, 'id' | 'createdAt'>,
  username?: string,
): Promise<GalleryItem> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const newItem: GalleryItem = { ...item, id, createdAt: Date.now() }
  // Store image in IndexedDB
  await idbPut(id, item.dataUrl)
  // Store metadata in localStorage
  const metas = loadMeta(username)
  const newMeta: GalleryMeta = { id, filename: item.filename, source: item.source, createdAt: newItem.createdAt }
  saveMeta([newMeta, ...metas], username)
  return newItem
}

export function deleteFromGallery(ids: string[], username?: string) {
  const metas = loadMeta(username).filter(m => !ids.includes(m.id))
  saveMeta(metas, username)
  idbDeleteMany(ids).catch(() => {})
}

export async function urlToDataUrl(url: string): Promise<string> {
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
