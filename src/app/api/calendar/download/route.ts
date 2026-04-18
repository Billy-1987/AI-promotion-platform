import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const EXCEL_PATH = path.join(process.cwd(), 'data', 'calendar.xlsx')

export async function GET() {
  if (!existsSync(EXCEL_PATH)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 404 })
  }
  const buffer = await readFile(EXCEL_PATH)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="calendar.xlsx"',
    },
  })
}
