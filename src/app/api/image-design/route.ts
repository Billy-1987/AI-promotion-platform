import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { openrouter as client } from '@/lib/openrouter'

export const maxDuration = 120

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

async function generateImage(parts: ContentPart[], aspectRatio: string): Promise<string | null> {
  const params = {
    model: 'google/gemini-2.5-flash-image',
    messages: [{ role: 'user' as const, content: parts }],
    modalities: ['image', 'text'],
    image_config: { aspect_ratio: aspectRatio },
  }
  const response = await (client.chat.completions.create as (p: unknown) => Promise<unknown>)(params)
  const msg = (response as Record<string, unknown>)
  const choices = msg?.choices as Array<{ message: Record<string, unknown> }> | undefined
  const message = choices?.[0]?.message
  const images = message?.images as Array<{ image_url: { url: string } }> | undefined
  const url = images?.[0]?.image_url?.url ?? null
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    const b64 = Buffer.from(buf).toString('base64')
    return `data:${mime};base64,${b64}`
  } catch {
    return url
  }
}

export async function POST(req: NextRequest) {
  const { prompt, style, ratio, count, referenceImages } = await req.json()

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  const stylePrompts: Record<string, string> = {
    realistic:  'photorealistic, high quality, detailed, professional photography',
    anime:      'anime style, vibrant colors, detailed illustration, manga art',
    '3d':       '3D render, octane render, unreal engine, high quality CGI',
    oil:        'oil painting, artistic, textured brushstrokes, classical art style',
    watercolor: 'watercolor painting, soft colors, artistic, flowing paint',
  }

  const textPrompt = `${prompt}. Style: ${stylePrompts[style] || stylePrompts.realistic}. Fill the entire canvas edge to edge, no blank areas, no borders. Do NOT render any text or typography in the image.`

  const refs: Array<{ base64: string; mime: string }> = Array.isArray(referenceImages) ? referenceImages : []

  const parts: ContentPart[] = []
  if (refs.length > 0) {
    refs.forEach(img => {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${img.mime ?? 'image/jpeg'};base64,${img.base64}` },
      })
    })
    const refNote = refs.length > 1
      ? `Use the above ${refs.length} images as references for the subjects/outfits shown. `
      : 'Use the above image as a reference. '
    parts.push({ type: 'text', text: `${refNote}${textPrompt}` })
  } else {
    parts.push({ type: 'text', text: textPrompt })
  }

  const results = await Promise.allSettled(
    Array.from({ length: count }, () => generateImage(parts, ratio ?? '1:1'))
  )

  const images = results
    .map((r, i) => ({
      id: `img_${Date.now()}_${i}`,
      url: r.status === 'fulfilled' ? r.value : null,
    }))
    .filter(img => img.url !== null)

  return NextResponse.json({ images, texts: [] })
}
