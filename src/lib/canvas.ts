/**
 * Crisp downscaling via successive halving (mipmap-style).
 *
 * When `ctx.drawImage(src, dx, dy, dw, dh)` is asked to scale down by more
 * than ~2× in one shot, even with `imageSmoothingQuality: 'high'` the
 * browser's bicubic resampler aliases thin strokes and tight kerning. A
 * 3863-px-wide brand logo dropped onto a 450-px slot on the AI poster ends
 * up with visible "pixelation" on letterforms.
 *
 * This helper halves the source into successive off-screen canvases until
 * the next halving would undershoot the destination, then performs the
 * final < 2× draw. The repeated 2-tap bicubic filtering closely
 * approximates Lanczos, producing visibly sharper edges.
 *
 * When the source is already ≤ 2× the destination, it short-circuits to a
 * plain drawImage — the off-screen canvas overhead is pointless there.
 */
export function drawImageCrisp(
  destCtx: CanvasRenderingContext2D,
  src: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const srcW = 'naturalWidth' in src ? src.naturalWidth : src.width
  const srcH = 'naturalHeight' in src ? src.naturalHeight : src.height

  // Round dest dimensions so the halving comparison is consistent
  const targetW = Math.max(1, Math.round(dw))
  const targetH = Math.max(1, Math.round(dh))

  if (srcW <= targetW * 2 && srcH <= targetH * 2) {
    destCtx.drawImage(src, dx, dy, dw, dh)
    return
  }

  // Halve into off-screen canvases until next halving would go below target
  let curCanvas: HTMLCanvasElement = document.createElement('canvas')
  curCanvas.width = srcW
  curCanvas.height = srcH
  let curCtx = curCanvas.getContext('2d')!
  curCtx.imageSmoothingEnabled = true
  curCtx.imageSmoothingQuality = 'high'
  curCtx.drawImage(src, 0, 0)
  let curW = srcW
  let curH = srcH

  while (Math.floor(curW * 0.5) >= targetW && Math.floor(curH * 0.5) >= targetH) {
    const nextW = Math.floor(curW * 0.5)
    const nextH = Math.floor(curH * 0.5)
    const nextCanvas = document.createElement('canvas')
    nextCanvas.width = nextW
    nextCanvas.height = nextH
    const nextCtx = nextCanvas.getContext('2d')!
    nextCtx.imageSmoothingEnabled = true
    nextCtx.imageSmoothingQuality = 'high'
    nextCtx.drawImage(curCanvas, 0, 0, nextW, nextH)
    curCanvas = nextCanvas
    curCtx = nextCtx
    curW = nextW
    curH = nextH
  }

  destCtx.drawImage(curCanvas, dx, dy, dw, dh)
}
