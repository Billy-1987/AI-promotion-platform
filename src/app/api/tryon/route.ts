import { NextRequest, NextResponse } from 'next/server'
import { openrouter as client } from '@/lib/openrouter'
import { makeLogger, formatBytes } from '@/lib/logger'

export const maxDuration = 300

type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

const STYLE_LABELS: Record<string, string> = {
  sport:    'athletic sportswear',
  outdoor:  'adventurous outdoor',
  trendy:   'fashion-forward streetwear',
  casual:   'relaxed casual everyday',
  preppy:   'preppy/Ivy League college',
  vintage:  'vintage retro',
  workwear: 'business professional',
}

const STYLE_ZH: Record<string, string> = {
  sport: '运动风', outdoor: '户外风', trendy: '潮流风', casual: '休闲风',
  preppy: '学院风', vintage: '复古风', workwear: '通勤风',
}

const AGE_DESC: Record<string, string> = {
  baby:   'infant/toddler (age 1-3)',
  child:  'child (age 4-10)',
  teen:   'teenager (age 13-17)',
  young:  'young adult (age 22-30)',
  middle: 'middle-aged adult (age 38-50)',
  senior: 'senior adult (age 60-72)',
}

// Compose model description from gender + age + style
function describeModel(gender: string, age: string, style: string): string {
  const isChildish = age === 'baby' || age === 'child'
  const genderWord = gender === 'male'
    ? (isChildish ? 'boy' : 'man')
    : (isChildish ? 'girl' : 'woman')
  const ageDesc = AGE_DESC[age] ?? AGE_DESC.young
  const styleLabel = STYLE_LABELS[style] ?? 'casual everyday'
  return `a Caucasian ${genderWord} model, ${ageDesc}, ${styleLabel} look, natural confident pose, professional fashion photography`
}

const BG_SCENES: Record<string, string> = {
  bg_sport1:  'a modern indoor sports gym with equipment, bright overhead lighting, polished floors',
  bg_sport2:  'an outdoor athletics running track with stadium stands, blue sky, natural sunlight',
  bg_outdoor1:'a lush mountain forest trail with dappled sunlight through tall trees, dense green foliage, mossy ground',
  bg_outdoor2:'a scenic rocky stream in nature with mossy boulders, crystal clear water, soft natural light',
  bg_men1:    'a sleek modern corporate lobby with marble floors, glass walls, and warm accent lighting',
  bg_men2:    'a vibrant urban city street with buildings, bokeh city lights, golden hour sunlight',
  bg_women1:  'a beautiful blooming garden courtyard with colorful flowers, soft natural light, warm tones',
  bg_women2:  'an upscale fashion boutique interior with elegant displays, warm spotlights, luxury feel',
  bg_kids1:   'a colorful amusement park with rides and balloons, bright cheerful atmosphere',
  bg_kids2:   'a bright modern classroom with colorful decorations, warm natural window light',
  bg_trendy1: 'a graffiti-covered street art district with bold murals, urban gritty atmosphere',
  bg_trendy2: 'a neon-lit night market with glowing signs, vibrant colors, atmospheric night scene',
  bg_vintage1:'a cozy vintage retro cafe with warm Edison bulbs, wooden furniture, nostalgic atmosphere',
  bg_vintage2:'a charming old town alley with brick walls, cobblestone street, warm afternoon light',
  bg_work1:   'a modern open-plan office with large windows, city view, clean minimalist design',
  bg_work2:   'a professional conference room with a long table, city skyline view, polished corporate feel',
  bg_shoe1:   'a warm natural wooden floor surface, soft side lighting, clean minimal studio feel',
  bg_shoe2:   'lush green outdoor grass lawn, natural daylight, fresh outdoor atmosphere',
  bg_shoe3:   'a busy urban city sidewalk with concrete pavement, street life in background, golden hour light',
  bg_shoe4:   'a clean white minimalist studio surface, soft diffused lighting, pure product photography setup',
  bg_shoe5:   'a rustic cobblestone stone pavement path, warm afternoon sunlight, vintage outdoor atmosphere',
  bg_shoe6:   'an outdoor sports court with court markings, bright natural sunlight, athletic environment',
}

// ── Step 1: extract clothing description via vision model ─────────────────────
async function describeClothing(b64: string, mime: string, isShoes: boolean): Promise<string> {
  const prompt = isShoes
    ? 'Describe this shoe in 2-3 sentences for a product photographer: type, colors, materials, key design details. Plain text only.'
    : 'Describe this clothing item in 2-3 sentences for a fashion photographer: garment type, colors, fabric, fit, key design details. Focus on the clothing only, ignore any person. Plain text only.'

  const res = await client.chat.completions.create({
    model: 'google/gemini-2.5-flash',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
        { type: 'text', text: prompt },
      ] as ChatContentPart[],
    }],
  })
  return res.choices[0]?.message?.content?.trim() ?? ''
}

// ── Step 2: generate image with clothing image as reference ──────────────────
async function generateFromImageRef(
  clothingB64: string,
  clothingMime: string,
  textPrompt: string,
  model: string,
  aspectRatio: string,
): Promise<string | null> {
  const params: Record<string, unknown> = {
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${clothingMime};base64,${clothingB64}` } },
        { type: 'text', text: textPrompt },
      ],
    }],
    modalities: ['image', 'text'],
    image_config: { aspect_ratio: aspectRatio },
  }
  const response = await (client.chat.completions.create as (p: unknown) => Promise<unknown>)(params)
  const msg = response as Record<string, unknown>
  const images = (msg?.choices as Array<{ message: Record<string, unknown> }>)?.[0]
    ?.message?.images as Array<{ image_url: { url: string } }> | undefined
  const url = images?.[0]?.image_url?.url ?? null
  if (!url) return null
  if (url.startsWith('data:')) return url
  try {
    const r = await fetch(url)
    const buf = await r.arrayBuffer()
    const m = r.headers.get('content-type') ?? 'image/jpeg'
    return `data:${m};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return url
  }
}

const ANALYZE_PROMPT = `Analyze this product image. Return pure JSON only (no markdown):
{"style":"sport|outdoor|trendy|casual|preppy|vintage|workwear","productCategory":"shoes|clothing","colors":["color1"],"keywords":["kw1"]}`

export async function POST(req: NextRequest) {
  const log = makeLogger('tryon')
  const t0 = Date.now()
  const contentLength = req.headers.get('content-length')
  const host = req.headers.get('host')
  log.info('POST received — host:', host, 'content-length:', contentLength ? formatBytes(parseInt(contentLength, 10)) : 'unknown')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (e) {
    log.error('failed to parse JSON body:', (e as Error)?.message)
    return NextResponse.json({ error: 'Invalid JSON body', detail: (e as Error)?.message }, { status: 400 })
  }
  const {
    clothingBase64, clothingMime,
    style: inputStyle, backgroundId,
    productCategory: inputCategory, skipAnalyze,
    modelGender = 'female',
    modelAge = 'young',
    aspectRatio = '3:4',
  } = body as {
    clothingBase64?: string
    clothingMime?: string
    style?: string
    backgroundId?: string
    productCategory?: 'clothing' | 'shoes'
    skipAnalyze?: boolean
    modelGender?: string
    modelAge?: string
    aspectRatio?: string
  }
  log.info('parsed body — clothingBase64Bytes:', formatBytes(clothingBase64?.length ?? 0), 'mime:', clothingMime, 'style:', inputStyle, 'bg:', backgroundId, 'category:', inputCategory)

  if (!clothingBase64) {
    log.warn('missing clothingBase64 — rejecting')
    return NextResponse.json({ error: 'No clothing image provided' }, { status: 400 })
  }

  const mime = clothingMime ?? 'image/jpeg'
  const isShoes = inputCategory === 'shoes'
  const styleKey = inputStyle ?? 'casual'
  const styleLabel = STYLE_LABELS[styleKey] ?? 'casual everyday'
  const styleZhLabel = STYLE_ZH[styleKey] ?? '休闲风'
  const bgScene = (backgroundId && BG_SCENES[backgroundId]) ?? 'a clean studio with soft white lighting'
  const modelDesc = describeModel(modelGender, modelAge, styleKey)

  log.info('start AI calls — style:', styleKey, 'shoes:', isShoes, 'gender:', modelGender, 'age:', modelAge, 'ratio:', aspectRatio)

  // ── Run all three in parallel: describe, analyze, text-analysis ───────────
  const [clothingDesc, analyzeRes, textRes] = await Promise.all([
    // 1. Describe clothing for image gen prompt
    describeClothing(clothingBase64, mime, isShoes).catch(e => {
      log.error('describe failed:', (e as Error)?.message, '\n', (e as Error)?.stack)
      return ''
    }),

    // 2. Analyze style/category (skip if already known)
    skipAnalyze ? Promise.resolve(null) : client.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${clothingBase64}` } },
          { type: 'text', text: ANALYZE_PROMPT },
        ] as ChatContentPart[],
      }],
    }).catch(() => null),

    // 3. Generate text description for UI
    client.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${clothingBase64}` } },
          {
            type: 'text',
            text: isShoes
              ? `分析这双鞋的设计特点和适合场景。返回纯JSON（无markdown）：{"description":"80字内专业描述","fitScore":85,"styleMatch":"风格特点","occasion":"适合场合"}`
              : `分析这件${styleZhLabel}服装的版型特点和适合人群。返回纯JSON（无markdown）：{"description":"80字内专业描述","fitScore":85,"styleMatch":"风格特点","occasion":"适合场合"}`,
          },
        ] as ChatContentPart[],
      }],
    }).catch(() => null),
  ])

  log.info('describe result (first 80):', clothingDesc.slice(0, 80))

  // ── Build image gen prompt ────────────────────────────────────────────────
  const desc = clothingDesc || (isShoes ? 'a stylish shoe' : `a ${styleLabel} clothing item`)
  const imagePrompt = isShoes
    ? `Professional product photography. The input image shows the exact shoe to photograph — reproduce its design, colors, materials, and branding EXACTLY with no changes. Setting: ${bgScene}. No person, no body parts. Slightly angled view, professional lighting, soft shadows. High-end retail catalog style. Photorealistic.`
    : `Professional ${styleLabel} fashion photo. ${modelDesc}. The model is wearing EXACTLY the clothing item shown in the input image — same garment type, same colors, same cut, same patterns, same logos, same details. Do NOT change or substitute any part of the clothing. Background: ${bgScene}. Full-body or 3/4 shot. High-end fashion campaign, photorealistic, sharp focus.`

  log.info('image prompt (first 120):', imagePrompt.slice(0, 120))

  // ── Generate image: gemini-2.5-flash-image only (faster, ~half the cost) ────
  const generatedImageUrl = await generateFromImageRef(
    clothingBase64, mime, imagePrompt, 'google/gemini-2.5-flash-image-preview', aspectRatio,
  ).catch(e => {
    log.error('image gen failed:', (e as Error)?.message, '\n', (e as Error)?.stack)
    return null
  })

  log.info('image gen finished — has image:', !!generatedImageUrl, 'total ms so far:', Date.now() - t0)

  // ── Parse analyze result ──────────────────────────────────────────────────
  let analyzeData: Record<string, unknown> | null = null
  if (analyzeRes) {
    const text = analyzeRes.choices[0]?.message?.content ?? ''
    try { analyzeData = JSON.parse(text.trim()) } catch {
      const m = text.match(/\{[\s\S]*?\}/)
      if (m) try { analyzeData = JSON.parse(m[0]) } catch { /* ignore */ }
    }
  }

  // ── Parse text description ────────────────────────────────────────────────
  let analysis = { description: '', fitScore: 80, styleMatch: '', occasion: '' }
  if (textRes) {
    const text = textRes.choices[0]?.message?.content ?? ''
    try { analysis = { ...analysis, ...JSON.parse(text.trim()) } } catch {
      const m = text.match(/\{[\s\S]*?\}/)
      if (m) try { analysis = { ...analysis, ...JSON.parse(m[0]) } } catch {
        analysis.description = text.slice(0, 200)
      }
    }
  }

  if (!generatedImageUrl) {
    log.error('no image — returning 503')
    return NextResponse.json(
      { error: '图片生成失败，当前网络环境不支持该 AI 模型，请在服务器环境下使用' },
      { status: 503 }
    )
  }

  log.info('done in', Date.now() - t0, 'ms')
  return NextResponse.json({ ...analysis, generatedImageUrl, analyzeData })
}
