import OpenAI from 'openai'

function createClient() {
  const baseURL = 'https://openrouter.ai/api/v1'
  // 用 dummy key 占位避免 OpenAI SDK 在模块加载时抛 Missing credentials
  // 真实 key 来自 OPENROUTER_API_KEY，缺失时实际请求会在运行时失败（不是 build 时）
  const apiKey = process.env.OPENROUTER_API_KEY || 'dummy-build-key'

  // 开发环境：通过 HTTPS_PROXY 环境变量走本地代理
  // 用 eval('require') 绕过 Turbopack 静态分析，避免生产构建报 Module not found
  // （https-proxy-agent 是 devDependencies，生产环境没装也没关系）
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (proxyUrl) {
    try {
      const dynamicRequire = eval('require') as NodeRequire
      const { HttpsProxyAgent } = dynamicRequire('https-proxy-agent')
      const agent = new HttpsProxyAgent(proxyUrl)
      return new OpenAI({
        baseURL,
        apiKey,
        httpAgent: agent,
        fetchOptions: { agent },
      } as ConstructorParameters<typeof OpenAI>[0])
    } catch (e) {
      console.warn('[openrouter] HTTPS_PROXY set but https-proxy-agent unavailable, ignoring proxy:', e)
    }
  }

  return new OpenAI({ baseURL, apiKey })
}

// Lazy singleton — defer initialization to first access so build/SSR doesn't
// fail when OPENROUTER_API_KEY isn't set at module load time
let _client: OpenAI | null = null
export const openrouter: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    if (!_client) _client = createClient()
    const value = (_client as unknown as Record<string | symbol, unknown>)[prop as string]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(_client) : value
  },
})
