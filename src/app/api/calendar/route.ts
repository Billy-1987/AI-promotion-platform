import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import zlib from 'zlib'

const DATA_DIR = path.join(process.cwd(), 'data')
const EXCEL_PATH = path.join(DATA_DIR, 'calendar.xlsx')
const META_PATH = path.join(DATA_DIR, 'calendar-meta.json')
const IMAGES_DIR = path.join(DATA_DIR, 'images')

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    await mkdir(DATA_DIR, { recursive: true })
    await mkdir(IMAGES_DIR, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(EXCEL_PATH, buffer)

    const wb = XLSX.read(buffer, { type: 'buffer' })

    const calSheetName = wb.SheetNames.find(n => n.includes('运营日历'))
    const itemsSheetName = wb.SheetNames.find(n => n.includes('单款推荐'))

    // 解析运营日历 sheet
    const calWs = wb.Sheets[calSheetName ?? wb.SheetNames[0]]
    const calRows = XLSX.utils.sheet_to_json(calWs, { header: 1, defval: '' }) as unknown[][]
    const calHeaders = (calRows[1] as string[]).map(h => String(h).trim())
    const { summary, allRows, headers } = buildCalendarSummary(calHeaders, calRows.slice(2).filter(r => r[0]))

    // 解析单款推荐 sheet
    let items: RecommendItem[] = []
    if (itemsSheetName) {
      const sheetIndex = wb.SheetNames.indexOf(itemsSheetName)
      const itemsWs = wb.Sheets[itemsSheetName]
      const itemsRows = XLSX.utils.sheet_to_json(itemsWs, { header: 1, defval: '' }) as unknown[][]
      items = await parseRecommendItems(buffer, itemsRows, sheetIndex)
    }

    const existing = existsSync(META_PATH) ? JSON.parse(await readFile(META_PATH, 'utf-8')) : {}
    const weekNotes: Record<string, string> = existing.weekNotes ?? {}
    const meta = { filename: file.name, uploadedAt: new Date().toISOString(), summary, allRows, headers, items, weekNotes }
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

// ─── 每周提示备注（管理员设置）────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { weekNotes } = await req.json() as { weekNotes: Record<string, string> }
    if (!existsSync(META_PATH)) return NextResponse.json({ error: 'No calendar meta found' }, { status: 400 })
    const meta = JSON.parse(await readFile(META_PATH, 'utf-8'))
    meta.weekNotes = weekNotes ?? {}
    await writeFile(META_PATH, JSON.stringify(meta, null, 2))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[calendar PATCH error]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── 运营日历解析 ─────────────────────────────────────────────────────────────

interface BrandRow {
  week: string
  month: number
  weekTitle: string
  brand: string
  [key: string]: unknown
}

const HIDDEN_COLS = new Set(['图片', '覆盖率＜80%特殊申报\n列出店铺名称（系统名称）'])

// 拆分多品牌字符串，如"阿迪达斯、安德玛（防晒、速干）" -> ["阿迪达斯", "安德玛"]
function splitBrands(raw: string): string[] {
  // 先去掉括号内的说明文字
  const cleaned = raw.replace(/[（(][^）)]*[）)]/g, '').trim()
  // 按顿号、逗号、换行、冒号后内容拆分
  const parts = cleaned
    .split(/[、,，\n\r]+/)
    .map(s => s.replace(/^[^：:]*[：:]/, '').trim()) // 去掉"儿童节集合："这类前缀
    .filter(s => s.length > 0 && s.length <= 30)    // 过滤空值和过长的描述文字
  return parts.length > 0 ? parts : [raw.slice(0, 30)]
}

function buildCalendarSummary(headers: string[], rows: unknown[][]) {
  const weekMap = new Map<string, { month: number; title: string; brands: Map<string, number> }>()
  const allRows: BrandRow[] = []

  // 按表头名动态定位关键列，兼容不同月份文件列顺序差异
  const colWeek   = headers.findIndex(h => h.includes('主推周'))
  const colMonth  = headers.findIndex(h => h.includes('主推月'))
  const colTitle  = headers.findIndex(h => h.includes('活动开始时间') || h.includes('活动时间'))
  const colBrand  = headers.findIndex(h => h.includes('主推品牌'))
  // 找不到时回退到固定索引（兼容旧文件）
  const iWeek  = colWeek  >= 0 ? colWeek  : 0
  const iMonth = colMonth >= 0 ? colMonth : 1
  const iTitle = colTitle >= 0 ? colTitle : 2
  const iBrand = colBrand >= 0 ? colBrand : 3
  // 动态列从品牌列之后开始，跳过前几个固定列
  const fixedCols = new Set([iWeek, iMonth, iTitle, iBrand])

  for (const row of rows) {
    const week  = String(row[iWeek]  ?? '').trim()
    const month = Number(row[iMonth] ?? 0)
    const title = String(row[iTitle] ?? '').trim()
    const brandRaw = String(row[iBrand] ?? '').trim()
    if (!week || !brandRaw) continue

    // 拆分多品牌：按顿号、逗号、换行分割，去掉括号内的说明文字
    const brands = splitBrands(brandRaw)

    const rowData: BrandRow = { week, month, weekTitle: title, brand: brandRaw }
    for (let i = 0; i < row.length; i++) {
      if (fixedCols.has(i)) continue
      const colName = headers[i] || `列${i + 1}`
      if (HIDDEN_COLS.has(colName)) continue
      rowData[colName] = row[i]
    }
    allRows.push(rowData)

    if (!weekMap.has(week)) weekMap.set(week, { month, title, brands: new Map() })
    const entry = weekMap.get(week)!
    for (const brand of brands) {
      entry.brands.set(brand, (entry.brands.get(brand) ?? 0) + 1)
    }
  }

  // 动态列表头：排除固定列和隐藏列
  const dynamicHeaders = headers.filter((h, i) =>
    h && !fixedCols.has(i) && !HIDDEN_COLS.has(h) && !/^列\d+$/.test(h)
  )

  return {
    summary: Array.from(weekMap.entries()).map(([week, v]) => ({
      week,
      month: v.month,
      title: v.title,
      brands: Array.from(v.brands.entries()).map(([name, count]) => ({ name, count })),
    })),
    allRows,
    headers: dynamicHeaders,
  }
}

// ─── 单款推荐解析 ─────────────────────────────────────────────────────────────

export interface RecommendItem {
  week: string
  month: number
  title: string
  brand: string
  spu: string
  itemNo: string
  tagPrice: number
  salePrice: number
  coverage: number
  sellingPoints: string
  remark: string
  imageUrl: string | null
}

async function parseRecommendItems(
  xlsxBuffer: Buffer,
  rows: unknown[][],
  sheetIndex: number,
): Promise<RecommendItem[]> {
  const dataRows = rows.slice(2) // row0=大标题, row1=表头

  const zipFiles = readZip(xlsxBuffer)
  const rowToImage = extractImageMap(zipFiles, sheetIndex)

  // 保存图片到 data/images/（去重）
  const saved = new Set<string>()
  for (const imgFile of Object.values(rowToImage)) {
    if (saved.has(imgFile)) continue
    const entry = zipFiles[`xl/media/${imgFile}`]
    if (entry) {
      await writeFile(path.join(IMAGES_DIR, imgFile), entry)
      saved.add(imgFile)
    }
  }

  return dataRows
    .map((row, i) => {
      const week = String(row[0] ?? '').trim()
      if (!week) return null
      const imgFile = rowToImage[i]
      const coverage = row[9]
      return {
        week,
        month: Number(row[1] ?? 0),
        title: String(row[2] ?? '').trim(),
        brand: String(row[3] ?? '').trim(),
        spu: String(row[4] ?? '').trim(),
        itemNo: String(row[5] ?? '').trim(),
        tagPrice: Number(row[7] ?? 0),
        salePrice: Number(row[8] ?? 0),
        coverage: typeof coverage === 'number' ? coverage : parseFloat(String(coverage)) || 0,
        sellingPoints: String(row[11] ?? '').trim(),
        remark: String(row[14] ?? '').trim(),
        imageUrl: imgFile ? `/api/calendar/image?file=${encodeURIComponent(imgFile)}` : null,
      } satisfies RecommendItem
    })
    .filter((x): x is RecommendItem => x !== null)
}

// ─── ZIP 解析（Node 内置 zlib，无外部依赖）────────────────────────────────────

function readUInt16LE(buf: Buffer, offset: number) {
  return buf[offset] | (buf[offset + 1] << 8)
}
function readUInt32LE(buf: Buffer, offset: number) {
  return ((buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0)
}

function readZip(buf: Buffer): Record<string, Buffer> {
  // Find End of Central Directory
  let eocdOffset = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) return {}

  const cdOffset = readUInt32LE(buf, eocdOffset + 16)
  const numEntries = readUInt16LE(buf, eocdOffset + 10)

  // Parse central directory to get local file offsets
  const entries: Record<string, { localOffset: number; compression: number; compSize: number }> = {}
  let pos = cdOffset
  for (let i = 0; i < numEntries; i++) {
    if (readUInt32LE(buf, pos) !== 0x02014b50) break
    const compression = readUInt16LE(buf, pos + 10)
    const compSize = readUInt32LE(buf, pos + 20)
    const fnLen = readUInt16LE(buf, pos + 28)
    const extraLen = readUInt16LE(buf, pos + 30)
    const commentLen = readUInt16LE(buf, pos + 32)
    const localOffset = readUInt32LE(buf, pos + 42)
    const filename = buf.slice(pos + 46, pos + 46 + fnLen).toString('utf8')
    entries[filename] = { localOffset, compression, compSize }
    pos += 46 + fnLen + extraLen + commentLen
  }

  // Read file contents
  const files: Record<string, Buffer> = {}
  for (const [filename, entry] of Object.entries(entries)) {
    const lp = entry.localOffset
    if (readUInt32LE(buf, lp) !== 0x04034b50) continue
    const localFnLen = readUInt16LE(buf, lp + 26)
    const localExtraLen = readUInt16LE(buf, lp + 28)
    const dataStart = lp + 30 + localFnLen + localExtraLen
    const compData = buf.slice(dataStart, dataStart + entry.compSize)
    try {
      files[filename] = entry.compression === 0 ? compData : zlib.inflateRawSync(compData)
    } catch {
      // skip corrupt entries
    }
  }
  return files
}

// ─── Drawing XML 解析（手写，无 xml2js 依赖）─────────────────────────────────

function extractImageMap(
  zipFiles: Record<string, Buffer>,
  sheetIndex: number,
): Record<number, string> {
  try {
    // 1. 从 sheet rels 找 drawing 文件名
    const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`
    const sheetRelsBuf = zipFiles[sheetRelsPath]
    if (!sheetRelsBuf) return {}

    const sheetRelsXml = sheetRelsBuf.toString('utf8')
    const drawingTarget = extractAttr(sheetRelsXml, /Type="[^"]*drawing[^"]*"[^>]*Target="([^"]+)"/)
    if (!drawingTarget) return {}

    // Target 形如 "../drawings/drawing1.xml"
    const drawingPath = drawingTarget.replace(/^\.\.\//, 'xl/')
    const drawingRelsPath = drawingPath.replace('xl/drawings/', 'xl/drawings/_rels/') + '.rels'

    const drawingBuf = zipFiles[drawingPath]
    const drawingRelsBuf = zipFiles[drawingRelsPath]
    if (!drawingBuf || !drawingRelsBuf) return {}

    // 2. 解析 drawing rels: rId -> image filename
    const drawingRelsXml = drawingRelsBuf.toString('utf8')
    const ridToFile: Record<string, string> = {}
    const relRegex = /Id="(rId\d+)"[^>]*Target="([^"]+)"/g
    let m: RegExpExecArray | null
    while ((m = relRegex.exec(drawingRelsXml)) !== null) {
      const fname = m[2].split('/').pop() ?? ''
      ridToFile[m[1]] = fname
    }

    // 3. 解析 drawing XML: row -> rId
    const drawingXml = drawingBuf.toString('utf8')
    const rowToImage: Record<number, string> = {}

    // Each anchor: <xdr:oneCellAnchor>...<xdr:row>N</xdr:row>...<a:blip r:embed="rIdX"/>
    const anchorRegex = /<xdr:(?:oneCellAnchor|twoCellAnchor)>([\s\S]*?)<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g
    while ((m = anchorRegex.exec(drawingXml)) !== null) {
      const block = m[1]
      const rowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
      const ridMatch = block.match(/r:embed="(rId\d+)"/)
      if (rowMatch && ridMatch) {
        const drawingRow = parseInt(rowMatch[1], 10)
        const rid = ridMatch[1]
        const dataIndex = drawingRow - 2 // row0=title, row1=header, row2=first data
        if (dataIndex >= 0 && ridToFile[rid]) {
          rowToImage[dataIndex] = ridToFile[rid]
        }
      }
    }

    return rowToImage
  } catch (e) {
    console.error('[extractImageMap]', e)
    return {}
  }
}

function extractAttr(xml: string, pattern: RegExp): string | null {
  return xml.match(pattern)?.[1] ?? null
}
