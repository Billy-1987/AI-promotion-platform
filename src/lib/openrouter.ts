// AI client → Modelverse (Gemini-native). All route files use OpenAI-format
// chat.completions.create params; this adapter translates to/from Gemini.

const API_KEY = process.env.MODELVERSE_API_KEY ?? 'dummy-build-key'
const MODELVERSE_BASE = 'https://api.modelverse.cn'

const MODEL_MAP: Record<string, string> = {
  'google/gemini-2.5-flash':               'gemini-2.5-flash',
  'google/gemini-2.5-flash-image':         'gemini-2.5-flash-image',
  'google/gemini-2.5-flash-image-preview': 'gemini-2.5-flash-image',
  'google/gemini-3.1-flash-image-preview': 'gemini-3-pro-image-preview',
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

type OAIPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

function toGeminiContents(messages: Array<{ role: string; content: string | OAIPart[] }>) {
  return messages.map(msg => {
    const parts: GeminiPart[] = []
    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content })
    } else {
      for (const p of msg.content) {
        if (p.type === 'text') {
          parts.push({ text: p.text })
        } else if (p.type === 'image_url') {
          const m = p.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
          if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } })
        }
      }
    }
    return { role: msg.role === 'assistant' ? 'model' : 'user', parts }
  })
}

function toOAIResponse(gemini: Record<string, unknown>) {
  const parts = (
    ((gemini.candidates as Array<Record<string, unknown>>)?.[0]
      ?.content as Record<string, unknown>)
      ?.parts ?? []
  ) as Array<Record<string, unknown>>

  let text = ''
  const images: Array<{ image_url: { url: string } }> = []

  for (const p of parts) {
    if (typeof p.text === 'string') text += p.text
    else if (p.inlineData) {
      const d = p.inlineData as { mimeType: string; data: string }
      images.push({ image_url: { url: `data:${d.mimeType};base64,${d.data}` } })
    }
  }

  return {
    choices: [{
      message: {
        content: text || null,
        ...(images.length > 0 && { images }),
      },
    }],
  }
}

async function modelverseCreate(params: Record<string, unknown>) {
  const model = MODEL_MAP[params.model as string] ?? (params.model as string).replace(/^google\//, '')
  const messages = params.messages as Array<{ role: string; content: string | OAIPart[] }>
  const modalities = params.modalities as string[] | undefined
  const imageConfig = params.image_config as { aspect_ratio?: string; image_size?: string } | undefined

  const generationConfig: Record<string, unknown> = {}
  const wantsImage = modalities?.some(m => m === 'image' || m === 'IMAGE')
  if (wantsImage) {
    generationConfig.responseModalities = ['TEXT', 'IMAGE']
    // Gemini expects nested generationConfig.imageConfig.{aspectRatio,imageSize};
    // a flat aspectRatio field is silently ignored and the model defaults to ~1:1.
    // Default imageSize to '2K' (≈1080p) — HD quality, ~2× cost of 1K, well below 4K's bandwidth/time hit.
    generationConfig.imageConfig = {
      imageSize: imageConfig?.image_size ?? '2K',
      ...(imageConfig?.aspect_ratio && { aspectRatio: imageConfig.aspect_ratio }),
    }
  }

  const res = await fetch(`${MODELVERSE_BASE}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({
      contents: toGeminiContents(messages),
      ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
    }),
    signal: AbortSignal.timeout(300000),
  })

  if (!res.ok) throw new Error(`Modelverse ${model} ${res.status}: ${await res.text()}`)
  return toOAIResponse(await res.json() as Record<string, unknown>)
}

export const openrouter = {
  chat: {
    completions: {
      create: (params: unknown) => modelverseCreate(params as Record<string, unknown>),
    },
  },
}
