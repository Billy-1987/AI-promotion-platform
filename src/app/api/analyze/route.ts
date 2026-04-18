import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType } = await req.json()

  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const response = await client.chat.completions.create({
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

  const text = response.choices[0]?.message?.content ?? ''

  try {
    const json = JSON.parse(text.trim())
    return NextResponse.json(json)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      return NextResponse.json(JSON.parse(match[0]))
    }
    return NextResponse.json({ error: 'Parse failed', raw: text }, { status: 500 })
  }
}
