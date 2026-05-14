// Mobile-safe image download helper.
//
// Why this exists:
//   canvas.toDataURL() → data:image/jpeg;base64,... can be 1-3 MB long.
//   Mobile browsers (esp. WeChat WebView and iOS Safari) handle these poorly:
//   - WeChat in-app browser: shows "可在浏览器打开此网页来下载文件" prompt
//   - External browser after redirect: data URL gets truncated → "网站暂时无法打开"
//   - iOS Safari: <a download> on data: URL often opens in-tab instead of saving
//
// Strategy (in priority order):
//   1. Web Share API with files (iOS 16+, Android Chrome) — native share sheet,
//      user picks "Save to Photos / Files / WeChat".
//   2. Blob Object URL + <a download> appended to DOM (more compatible than data URL).
//   3. As ultimate fallback, open the blob URL in a new tab (user long-presses to save).

export async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  // Step 1: dataURL → Blob (more shareable, smaller in-memory than the long string)
  const blob = await dataUrlToBlob(dataUrl)

  // Step 2: Try Web Share API with a File
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
        return
      }
    } catch (e) {
      // User cancelled or share failed → fall through to anchor download
      const err = e as Error
      if (err?.name === 'AbortError') return // user cancelled — not an error
      console.warn('Web Share failed, falling back to anchor download:', err?.message)
    }
  }

  // Step 3: Blob URL anchor download
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    // Safari requires the element to be in the DOM for click() to work reliably
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (e) {
    console.error('Anchor download failed:', e)
    // Ultimate fallback: open in new tab; user can long-press to save
    window.open(url, '_blank')
  } finally {
    // Delay revoke — some mobile browsers process the click asynchronously
    // and revoking too soon kills the download.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  // Modern browsers support fetch(dataUrl).blob()
  // It's simpler and faster than manual base64 decode.
  const res = await fetch(dataUrl)
  return await res.blob()
}
