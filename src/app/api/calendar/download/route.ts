import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const EXCEL_PATH = path.join(process.cwd(), 'data', 'calendar.xlsx')
const META_PATH = path.join(process.cwd(), 'data', 'calendar-meta.json')

export async function GET() {
  if (!existsSync(EXCEL_PATH)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 404 })
  }
  let filename = 'calendar.xlsx'
  try {
    if (existsSync(META_PATH)) {
      const meta = JSON.parse(await readFile(META_PATH, 'utf-8'))
      if (typeof meta?.filename === 'string' && meta.filename) filename = meta.filename
    }
  } catch { /* fall back to default */ }

  const buffer = await readFile(EXCEL_PATH)
  // RFC 5987: filename* lets non-ASCII (中文) survive on mobile Safari/Chrome,
  // which often ignores the <a download> attribute.
  const encoded = encodeURIComponent(filename).replace(/'/g, '%27')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="calendar.xlsx"; filename*=UTF-8''${encoded}`,
    },
  })
}
