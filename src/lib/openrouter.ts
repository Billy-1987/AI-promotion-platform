import OpenAI from 'openai'

function createClient() {
  const baseURL = 'https://openrouter.ai/api/v1'
  const apiKey = process.env.OPENROUTER_API_KEY

  // 开发环境：通过 HTTPS_PROXY 环境变量走本地代理
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (proxyUrl) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { HttpsProxyAgent } = require('https-proxy-agent')
    const agent = new HttpsProxyAgent(proxyUrl)
    return new OpenAI({
      baseURL,
      apiKey,
      httpAgent: agent,
      fetchOptions: { agent },
    } as ConstructorParameters<typeof OpenAI>[0])
  }

  return new OpenAI({ baseURL, apiKey })
}

export const openrouter = createClient()
