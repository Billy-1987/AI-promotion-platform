import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { openrouter as client } from '@/lib/openrouter'

export const maxDuration = 120

const STYLE_LABELS: Record<string, string> = {
  sport: 'sportswear', outdoor: 'outdoor', menswear: "men's fashion",
  womenswear: "women's fashion", kids: "children's fashion",
  trendy: 'streetwear trendy', vintage: 'vintage retro', workwear: 'business workwear',
}

const STYLE_ZH: Record<string, string> = {
  sport: '运动', outdoor: '户外', menswear: '男装', womenswear: '女装',
  kids: '儿童', trendy: '潮流', vintage: '复古', workwear: '上班通勤',
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

const MODEL_BY_GENDER: Record<string, Record<string, string>> = {
  female: {
    sport:     'a fit athletic young European female model (age 22-28), energetic sporty pose',
    outdoor:   'a sporty young Caucasian female model (age 22-28), adventurous outdoor look',
    menswear:  'a stylish young European female model (age 22-28), confident pose',
    womenswear:'a beautiful young European female model (age 22-28), slender figure, sweet charming smile',
    kids:      'a cute Western girl child model (age 6-12)',
    trendy:    'a cool young Caucasian female streetwear model (age 20-26), urban attitude',
    vintage:   'a stylish young European female model (age 22-28), vintage charm, warm smile',
    workwear:  'a polished young Caucasian professional female model (age 25-32), confident business look',
  },
  male: {
    sport:     'a fit athletic young Caucasian male model (age 22-28), energetic sporty pose',
    outdoor:   'a handsome young Caucasian male model (age 22-28), adventurous outdoor look',
    menswear:  'a handsome young Caucasian male model (age 22-28), sharp jawline, confident smile, athletic build',
    womenswear:'a handsome young Caucasian male model (age 22-28), confident pose',
    kids:      'a cute Western boy child model (age 6-12)',
    trendy:    'a cool young Caucasian male streetwear model (age 20-26), urban attitude',
    vintage:   'a stylish young European male model (age 22-28), vintage charm, warm smile',
    workwear:  'a polished young Caucasian professional male model (age 25-32), confident business look',
  },
  kids: {
    sport:     'a cute Western child model (age 6-10), energetic playful pose',
    outdoor:   'a cute Western child model (age 6-10), adventurous outdoor look',
    menswear:  'a cute Western boy child model (age 6-12)',
    womenswear:'a cute Western girl child model (age 6-12)',
    kids:      'a cute Western child model (age 4-10)',
    trendy:    'a cute Western child model (age 8-12), stylish urban look',
    vintage:   'a cute Western child model (age 6-12), vintage charm',
    workwear:  'a cute Western child model (age 8-12)',
  },
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
      ] as OpenAI.Chat.ChatCompletionContentPart[],
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
{"style":"sport|outdoor|menswear|womenswear|kids|trendy|vintage|workwear","productCategory":"shoes|clothing","colors":["color1"],"keywords":["kw1"]}`

export async function POST(req: NextRequest) {
  const {
    clothingBase64, clothingMime,
    style: inputStyle, backgroundId,
    productCategory: inputCategory, skipAnalyze,
    modelGender = 'female',
    aspectRatio = '3:4',
  } = await req.json()

  if (!clothingBase64) {
    return NextResponse.json({ error: 'No clothing image provided' }, { status: 400 })
  }

  const mime = clothingMime ?? 'image/jpeg'
  const isShoes = inputCategory === 'shoes'
  const styleKey = inputStyle ?? 'womenswear'
  const styleLabel = STYLE_LABELS[styleKey] ?? 'fashion'
  const styleZhLabel = STYLE_ZH[styleKey] ?? '时尚'
  const bgScene = BG_SCENES[backgroundId] ?? 'a clean studio with soft white lighting'
  const modelDesc = (MODEL_BY_GENDER[modelGender] ?? MODEL_BY_GENDER.female)[styleKey]
    ?? MODEL_BY_GENDER.female.womenswear

  console.log('[tryon] start — style:', styleKey, 'shoes:', isShoes, 'gender:', modelGender, 'ratio:', aspectRatio)

  // ── Run all three in parallel: describe, analyze, text-analysis ───────────
  const [clothingDesc, analyzeRes, textRes] = await Promise.all([
    // 1. Describe clothing for image gen prompt
    describeClothing(clothingBase64, mime, isShoes).catch(e => {
      console.error('[tryon] describe failed:', e?.message)
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
        ] as OpenAI.Chat.ChatCompletionContentPart[],
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
        ] as OpenAI.Chat.ChatCompletionContentPart[],
      }],
    }).catch(() => null),
  ])

  console.log('[tryon] describe result:', clothingDesc.slice(0, 80))

  // ── Build image gen prompt ────────────────────────────────────────────────
  const desc = clothingDesc || (isShoes ? 'a stylish shoe' : `a ${styleLabel} clothing item`)
  const imagePrompt = isShoes
    ? `Professional product photography. The input image shows the exact shoe to photograph — reproduce its design, colors, materials, and branding EXACTLY with no changes. Setting: ${bgScene}. No person, no body parts. Slightly angled view, professional lighting, soft shadows. High-end retail catalog style. Photorealistic.`
    : `Professional ${styleLabel} fashion photo. ${modelDesc}. The model is wearing EXACTLY the clothing item shown in the input image — same garment type, same colors, same cut, same patterns, same logos, same details. Do NOT change or substitute any part of the clothing. Background: ${bgScene}. Full-body or 3/4 shot. High-end fashion campaign, photorealistic, sharp focus.`

  console.log('[tryon] image prompt (first 120):', imagePrompt.slice(0, 120))

  // ── Generate image (race two models, both receive the clothing image) ──────
  const generatedImageUrl = await Promise.race([
    generateFromImageRef(clothingBase64, mime, imagePrompt, 'google/gemini-2.5-flash-image', aspectRatio),
    generateFromImageRef(clothingBase64, mime, imagePrompt, 'google/gemini-3.1-flash-image-preview', aspectRatio),
  ]).catch(e => { console.error('[tryon] image gen failed:', e?.message); return null })

  console.log('[tryon] done — has image:', !!generatedImageUrl)

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

  return NextResponse.json({ ...analysis, generatedImageUrl, analyzeData })
}
