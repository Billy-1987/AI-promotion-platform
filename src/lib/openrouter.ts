// Unified AI client. Switch provider via AI_PROVIDER env var:
//   AI_PROVIDER=openrouter  (default) — OpenAI SDK → openrouter.ai
//   AI_PROVIDER=modelverse            — Gemini-native fetch → api.modelverse.cn
//
// All route files use OpenAI-format params; the modelverse branch adapts them internally.

import OpenAI from 'openai'

const PROVIDER = process.env.AI_PROVIDER ?? 'openrouter'
const API_KEY = PROVIDER === 'modelverse'
  ? (process.env.MODELVERSE_API_KEY ?? process.env.OPENROUTER_API_KEY ?? 'dummy-build-key')
  : (process.env.OPENROUTER_API_KEY ?? 'dummy-build-key')

// ── Modelverse (Gemini-native) adapter ────────────────────────────────────────

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
  const imageConfig = params.image_config as { aspect_ratio?: string } | undefined

  const generationConfig: Record<string, unknown> = {}
  if (modalities?.some(m => m === 'image' || m === 'IMAGE')) {
    generationConfig.responseModalities = ['TEXT', 'IMAGE']
  }
  if (imageConfig?.aspect_ratio) {
    generationConfig.aspectRatio = imageConfig.aspect_ratio
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

// ── OpenRouter (OpenAI-compatible) client ─────────────────────────────────────

function createOpenRouterClient() {
  // 用 eval('require') 绕过 Turbopack 静态分析，避免生产构建报 Module not found
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (proxyUrl) {
    try {
      const dynamicRequire = eval('require') as NodeRequire
      const { HttpsProxyAgent } = dynamicRequire('https-proxy-agent')
      const agent = new HttpsProxyAgent(proxyUrl)
      return new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: API_KEY,
        httpAgent: agent,
        fetchOptions: { agent },
      } as ConstructorParameters<typeof OpenAI>[0])
    } catch (e) {
      console.warn('[openrouter] HTTPS_PROXY set but https-proxy-agent unavailable, ignoring proxy:', e)
    }
  }
  return new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: API_KEY })
}

// ── Export ────────────────────────────────────────────────────────────────────

// Modelverse: direct adapter object
// OpenRouter: lazy singleton proxy — defers initialization so build/SSR doesn't
//   fail when OPENROUTER_API_KEY isn't set at module load time
let _orClient: OpenAI | null = null

export const openrouter =
  PROVIDER === 'modelverse'
    ? {
        chat: {
          completions: {
            create: (params: unknown) => modelverseCreate(params as Record<string, unknown>),
          },
        },
      }
    : new Proxy({} as OpenAI, {
        get(_target, prop) {
          if (!_orClient) _orClient = createOpenRouterClient()
          const value = (_orClient as unknown as Record<string | symbol, unknown>)[prop as string]
          return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(_orClient) : value
        },
      })
