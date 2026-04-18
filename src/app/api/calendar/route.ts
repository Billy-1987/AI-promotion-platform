import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'

const DATA_DIR = path.join(process.cwd(), 'data')
const EXCEL_PATH = path.join(DATA_DIR, 'calendar.xlsx')
const META_PATH = path.join(DATA_DIR, 'calendar-meta.json')

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(EXCEL_PATH, buffer)

    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const summary = buildSummary(rows.slice(2).filter((r) => r[0]))

    const meta = { filename: file.name, uploadedAt: new Date().toISOString(), summary }
    await writeFile(META_PATH, JSON.stringify(meta, null, 2))

    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    console.error('[calendar upload error]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  if (!existsSync(META_PATH)) return NextResponse.json({ uploaded: false })
  const meta = JSON.parse(await readFile(META_PATH, 'utf-8'))
  return NextResponse.json({ uploaded: true, ...meta })
}

function buildSummary(rows: unknown[][]) {
  const weekMap = new Map<string, { month: number; title: string; brands: Map<string, number> }>()
  for (const row of rows) {
    const week = String(row[0]).trim()
    const month = Number(row[1])
    const title = String(row[2]).trim()
    const brand = String(row[3]).trim()
    if (!week || !brand) continue
    if (!weekMap.has(week)) weekMap.set(week, { month, title, brands: new Map() })
    const entry = weekMap.get(week)!
    entry.brands.set(brand, (entry.brands.get(brand) ?? 0) + 1)
  }
  return Array.from(weekMap.entries()).map(([week, v]) => ({
    week,
    month: v.month,
    title: v.title,
    brands: Array.from(v.brands.entries()).map(([name, count]) => ({ name, count })),
  }))
}
