import { NextRequest, NextResponse } from 'next/server'
import { openrouter as client } from '@/lib/openrouter'
import { makeLogger, formatBytes } from '@/lib/logger'

export const maxDuration = 60

type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

const ANALYZE_PROMPT = `分析这张参考图，提取 3 个维度的描述用于后续 AI 生图。返回纯 JSON（不要 markdown 代码块）：
{
  "lighting": "用 15 字内描述图的环境光影氛围（例：黄金时段柔和阳光、霓虹冷光夜景、室内暖灯）",
  "pose": "用 15 字内描述图中人物或主体的姿势动作（例：全身正面站立微笑、侧身回眸、动感跑步）。无人物时描述主体的呈现方式（例：俯拍商品摆放、特写镜头）",
  "composition": "用 15 字内描述构图与质感滤镜（例：胶片颗粒中景、对称中心构图、浅景深虚化背景、暖色调）"
}
要求：每段 15 字以内，纯描述短语，不要主语和句号。`

export async function POST(req: NextRequest) {
  const log = makeLogger('analyze-ref')
  const t0 = Date.now()

  let body: { imageBase64?: string; mimeType?: string }
  try {
    body = await req.json()
  } catch (e) {
    log.error('failed to parse JSON body:', (e as Error)?.message)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { imageBase64, mimeType } = body
  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }
  log.info('start — bytes:', formatBytes(imageBase64.length), 'mime:', mimeType)

  let response: unknown
  try {
    response = await client.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}` } },
          { type: 'text', text: ANALYZE_PROMPT },
        ] as ChatContentPart[],
      }],
    })
  } catch (e) {
    log.error('AI call failed:', (e as Error)?.message)
    return NextResponse.json({ error: 'AI call failed', detail: (e as Error)?.message }, { status: 500 })
  }

  const text = ((response as Record<string, unknown>)?.choices as Array<{ message: { content?: string } }>)?.[0]?.message?.content ?? ''
  log.info('AI returned in', Date.now() - t0, 'ms — raw (first 200):', text.slice(0, 200))

  // Strip ```json fences if present
  const cleaned = text.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim()
  let parsed: { lighting?: string; pose?: string; composition?: string }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    log.warn('JSON parse failed, returning empty')
    return NextResponse.json({ lighting: '', pose: '', composition: '' })
  }

  return NextResponse.json({
    lighting: typeof parsed.lighting === 'string' ? parsed.lighting.trim() : '',
    pose: typeof parsed.pose === 'string' ? parsed.pose.trim() : '',
    composition: typeof parsed.composition === 'string' ? parsed.composition.trim() : '',
  })
}
