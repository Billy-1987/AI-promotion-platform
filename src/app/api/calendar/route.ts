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
    // 第一行是表头，第二行起是数据（跳过第二行的副标题/空行）
    // 第1行是大标题，第2行是表头，第3行起是数据
    const colHeaders = (rows[1] as string[]).map(h => String(h).trim())
    const { summary, allRows, headers } = buildSummary(colHeaders, rows.slice(2).filter((r) => r[0]))

    const meta = { filename: file.name, uploadedAt: new Date().toISOString(), summary, allRows, headers }
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

interface BrandRow {
  week: string
  month: number
  weekTitle: string
  brand: string
  [key: string]: unknown // 其他列
}

const HIDDEN_COLS = new Set(['图片', '覆盖率＜80%特殊申报\n列出店铺名称（系统名称）'])

function buildSummary(headers: string[], rows: unknown[][]) {
  const weekMap = new Map<string, { month: number; title: string; brands: Map<string, number> }>()
  const allRows: BrandRow[] = []

  for (const row of rows) {
    const week = String(row[0]).trim()
    const month = Number(row[1])
    const title = String(row[2]).trim()
    const brand = String(row[3]).trim()
    if (!week || !brand) continue

    // 保存完整行数据
    const rowData: BrandRow = {
      week,
      month,
      weekTitle: title,
      brand,
    }
    // 保存其他列（从第5列开始，索引4+），使用真实表头名，跳过隐藏列
    for (let i = 4; i < row.length; i++) {
      const colName = headers[i] || `列${i + 1}`
      if (HIDDEN_COLS.has(colName)) continue
      rowData[colName] = row[i]
    }
    allRows.push(rowData)

    if (!weekMap.has(week)) weekMap.set(week, { month, title, brands: new Map() })
    const entry = weekMap.get(week)!
    entry.brands.set(brand, (entry.brands.get(brand) ?? 0) + 1)
  }

  return {
    summary: Array.from(weekMap.entries()).map(([week, v]) => ({
      week,
      month: v.month,
      title: v.title,
      brands: Array.from(v.brands.entries()).map(([name, count]) => ({ name, count })),
    })),
    allRows,
    headers: headers.slice(4).filter(h => h && !HIDDEN_COLS.has(h) && !/^列\d+$/.test(h)),
  }
}
