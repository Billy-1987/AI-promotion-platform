import { NextRequest, NextResponse } from 'next/server'

const TOKEN_URL = 'https://oapi.bigoffs.com/oauth/token'
const USER_INFO_URL = 'https://oapi.bigoffs.com/oauth/api/userInfo'

export async function POST(req: NextRequest) {
  const { code, redirect_uri } = await req.json()
  if (!code || !redirect_uri) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  // 换 token
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.BIGOFFS_CLIENT_ID!,
      client_secret: process.env.BIGOFFS_CLIENT_SECRET!,
      code,
      redirect_uri,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'login_failed', detail: tokenData }, { status: 400 })
  }

  // 拉用户信息
  const userRes = await fetch(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userInfo = await userRes.json()

  return NextResponse.json({ ...userInfo, _token_expires_at: Date.now() + (tokenData.expires_in ?? 7200) * 1000 })
}
