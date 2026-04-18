import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const maxDuration = 120

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

type ContentPart = { type: 'image_url'; image_url: { url: string } } | { type: 'text'; text: string }

async function generateImage(parts: ContentPart[], model: string): Promise<string | null> {
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: parts as OpenAI.Chat.ChatCompletionContentPart[] }],
  })
  const msg = response.choices[0]?.message as unknown as Record<string, unknown>
  const images = msg?.images as Array<{ image_url: { url: string } }> | undefined
  return images?.[0]?.image_url?.url ?? null
}

export async function POST(req: NextRequest) {
  const { prompt, negativePrompt, style, ratio, count, steps, cfgScale, seed, sampler } = await req.json()

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  const [width, height] = ratio === '1:1' ? [1024, 1024] : ratio === '16:9' ? [1344, 768] : ratio === '9:16' ? [768, 1344] : [1024, 1024]

  const stylePrompts: Record<string, string> = {
    realistic: 'photorealistic, high quality, detailed, professional photography',
    anime: 'anime style, vibrant colors, detailed illustration, manga art',
    '3d': '3D render, octane render, unreal engine, high quality CGI',
    oil: 'oil painting, artistic, textured brushstrokes, classical art style',
    watercolor: 'watercolor painting, soft colors, artistic, flowing paint',
  }

  const fullPrompt = `${prompt}. ${stylePrompts[style] || stylePrompts.realistic}. Image dimensions: ${width}x${height}.`
  const finalPrompt = negativePrompt
    ? `${fullPrompt}\n\nAvoid: ${negativePrompt}`
    : fullPrompt

  const seedInfo = seed ? `Use seed: ${seed}` : ''
  const samplerInfo = sampler ? `Sampler: ${sampler}` : ''
  const stepsInfo = steps ? `Steps: ${steps}` : ''
  const cfgInfo = cfgScale ? `CFG Scale: ${cfgScale}` : ''

  const technicalParams = [seedInfo, samplerInfo, stepsInfo, cfgInfo].filter(Boolean).join(', ')
  const promptWithParams = technicalParams ? `${finalPrompt}\n\nTechnical parameters: ${technicalParams}` : finalPrompt

  const results = await Promise.allSettled(
    Array.from({ length: count }, () =>
      generateImage(
        [{ type: 'text', text: promptWithParams }],
        'google/gemini-2.5-flash-image'
      )
    )
  )

  const images = results
    .map((r, i) => ({
      id: `img_${Date.now()}_${i}`,
      url: r.status === 'fulfilled' ? r.value : null,
    }))
    .filter(img => img.url !== null)

  return NextResponse.json({ images })
}
