import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images')

function detectMime(buf: Buffer): string {
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  // GIF: 47 49 46
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp'
  // fallback by extension
  return 'image/png'
}

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get('file')
  if (!file || file.includes('..') || file.includes('/')) {
    return new NextResponse('Bad request', { status: 400 })
  }

  const filepath = path.join(IMAGES_DIR, file)
  if (!existsSync(filepath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const buf = await readFile(filepath)
  const mime = detectMime(buf)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
