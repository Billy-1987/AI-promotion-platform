import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { openrouter as client } from '@/lib/openrouter'
import { makeLogger, formatBytes } from '@/lib/logger'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// Increase body size limit for reference image uploads
export const fetchCache = 'force-no-store'

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

async function generateImage(
  parts: ContentPart[],
  aspectRatio: string,
  log: ReturnType<typeof makeLogger>,
): Promise<string | null> {
  const params = {
    model: 'google/gemini-3.1-flash-image-preview',
    messages: [{ role: 'user' as const, content: parts }],
    modalities: ['image', 'text'],
    image_config: { aspect_ratio: aspectRatio },
  }
  const t0 = Date.now()
  log.info('calling model, parts count:', parts.length, 'ratio:', aspectRatio)
  const response = await (client.chat.completions.create as (p: unknown) => Promise<unknown>)(params)
  log.info('model returned in', Date.now() - t0, 'ms')
  const msg = (response as Record<string, unknown>)
  const choices = msg?.choices as Array<{ message: Record<string, unknown> }> | undefined
  const message = choices?.[0]?.message
  log.info('message keys:', Object.keys(message ?? {}))
  const images = message?.images as Array<{ image_url: { url: string } }> | undefined
  const url = images?.[0]?.image_url?.url ?? null
  log.info('image url present:', !!url)
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    const b64 = Buffer.from(buf).toString('base64')
    return `data:${mime};base64,${b64}`
  } catch (e) {
    log.warn('image fetch failed, returning original url:', (e as Error)?.message)
    return url
  }
}

export async function POST(req: NextRequest) {
  const log = makeLogger('image-design')
  const t0 = Date.now()
  const contentLength = req.headers.get('content-length')
  const host = req.headers.get('host')
  log.info('POST received — host:', host, 'content-length:', contentLength ? formatBytes(parseInt(contentLength, 10)) : 'unknown')

  let body: { prompt?: string; style?: string; ratio?: string; count?: number; referenceImages?: Array<{ base64: string; mime: string }> }
  try {
    body = await req.json()
  } catch (e) {
    log.error('failed to parse JSON body:', (e as Error)?.message)
    return NextResponse.json({ error: 'Invalid JSON body', detail: (e as Error)?.message }, { status: 400 })
  }
  const { prompt, style, ratio, count, referenceImages } = body
  const refCount = Array.isArray(referenceImages) ? referenceImages.length : 0
  const refBytes = Array.isArray(referenceImages) ? referenceImages.reduce((s, r) => s + (r.base64?.length ?? 0), 0) : 0
  log.info('parsed body — promptLen:', (prompt ?? '').length, 'style:', style, 'ratio:', ratio, 'count:', count, 'refImages:', refCount, 'refBase64Bytes:', formatBytes(refBytes))

  if (!prompt) {
    log.warn('missing prompt — rejecting')
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  const stylePrompts: Record<string, string> = {
    realistic:  'photorealistic, high quality, detailed, professional photography',
    anime:      'anime style, vibrant colors, detailed illustration, manga art',
    '3d':       '3D render, octane render, unreal engine, high quality CGI',
    oil:        'oil painting, artistic, textured brushstrokes, classical art style',
    watercolor: 'watercolor painting, soft colors, artistic, flowing paint',
  }

  const textPrompt = `${prompt}. Style: ${(style && stylePrompts[style]) || stylePrompts.realistic}. Fill the entire canvas edge to edge, no blank areas, no borders. Do NOT render any text or typography in the image.`

  const refs: Array<{ base64: string; mime: string }> = Array.isArray(referenceImages) ? referenceImages : []

  const parts: ContentPart[] = []
  if (refs.length > 0) {
    refs.forEach(img => {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${img.mime ?? 'image/jpeg'};base64,${img.base64}` },
      })
    })
    const refInstruction = refs.length > 1
      ? `The above ${refs.length} images are references. You MUST reproduce the exact clothing items, colors, patterns, textures, and design details shown — do NOT substitute or invent any visual elements. `
      : `The above image is a reference. You MUST reproduce the exact clothing item, colors, patterns, textures, and design details shown — do NOT substitute or invent any visual elements. `
    parts.push({ type: 'text', text: refInstruction + textPrompt })
  } else {
    parts.push({ type: 'text', text: textPrompt })
  }

  const targetCount = Math.max(1, Math.min(4, count ?? 1))
  log.info('starting generation — targetCount:', targetCount)
  const results = await Promise.allSettled(
    Array.from({ length: targetCount }, () => generateImage(parts, ratio ?? '1:1', log))
  )

  results.forEach((r, i) => {
    if (r.status === 'rejected') log.error('generation', i, 'failed:', (r.reason as Error)?.message ?? r.reason, '\n', (r.reason as Error)?.stack)
  })

  const images = results
    .map((r, i) => ({
      id: `img_${Date.now()}_${i}`,
      url: r.status === 'fulfilled' ? r.value : null,
    }))
    .filter(img => img.url !== null)

  log.info('done in', Date.now() - t0, 'ms — produced', images.length, '/', targetCount, 'images')
  return NextResponse.json({ images, texts: [] })
}
