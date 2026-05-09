import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { openrouter as client } from '@/lib/openrouter'
import { makeLogger, formatBytes } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const log = makeLogger('analyze')
  const t0 = Date.now()
  const contentLength = req.headers.get('content-length')
  log.info('POST received — host:', req.headers.get('host'), 'content-length:', contentLength ? formatBytes(parseInt(contentLength, 10)) : 'unknown')

  let body: { imageBase64?: string; mimeType?: string }
  try {
    body = await req.json()
  } catch (e) {
    log.error('failed to parse JSON body:', (e as Error)?.message)
    return NextResponse.json({ error: 'Invalid JSON body', detail: (e as Error)?.message }, { status: 400 })
  }
  const { imageBase64, mimeType } = body
  log.info('parsed body — imageBase64Bytes:', formatBytes(imageBase64?.length ?? 0), 'mime:', mimeType)

  if (!imageBase64) {
    log.warn('missing imageBase64 — rejecting')
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  let response
  try {
    response = await client.chat.completions.create({
    model: 'google/gemini-2.5-flash',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}` },
          },
          {
            type: 'text',
            text: `分析这张商品图片，返回 JSON 格式（不要 markdown 代码块，只返回纯 JSON）：
{
  "style": "sport|outdoor|menswear|womenswear|kids|trendy|vintage|workwear",
  "colors": ["主色1", "主色2"],
  "category": "上衣|裤子|裙子|外套|连衣裙|套装|运动服|童装|鞋子|运动鞋|皮鞋|靴子|凉鞋|拖鞋",
  "productCategory": "shoes|clothing",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "backgroundSuggestion": "根据商品风格推荐最合适的背景场景，用一句话描述",
  "productDescription": "用50字以内写一段吸引买家的商品描述"
}
productCategory 判断规则：图片主体是鞋子（运动鞋/皮鞋/靴子/凉鞋/拖鞋等任何鞋类）则返回 "shoes"，否则返回 "clothing"。
style 枚举说明：sport=运动，outdoor=户外，menswear=男装，womenswear=女装，kids=儿童，trendy=潮流，vintage=复古，workwear=上班通勤`,
          },
        ],
      },
    ],
  })
  } catch (e) {
    log.error('AI call failed:', (e as Error)?.message, '\n', (e as Error)?.stack)
    return NextResponse.json({ error: 'AI call failed', detail: (e as Error)?.message }, { status: 500 })
  }

  log.info('AI call returned in', Date.now() - t0, 'ms')
  const text = response.choices[0]?.message?.content ?? ''

  try {
    const json = JSON.parse(text.trim())
    log.info('done in', Date.now() - t0, 'ms')
    return NextResponse.json(json)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      log.info('done (fallback parse) in', Date.now() - t0, 'ms')
      return NextResponse.json(JSON.parse(match[0]))
    }
    log.error('parse failed — raw text first 200:', text.slice(0, 200))
    return NextResponse.json({ error: 'Parse failed', raw: text }, { status: 500 })
  }
}
