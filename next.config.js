/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Extend server-side HTTP timeout for long-running AI generation routes (Docker/self-hosted)
  serverExternalPackages: [],
  httpAgentOptions: { keepAlive: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      { protocol: 'https', hostname: 'pixabay.com' },
      { protocol: 'https', hostname: 'cdn.pixabay.com' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
