'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { User, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  ready: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
}

export const TEST_ACCOUNTS: Array<User & { password: string }> = [
  { username: 'hq_admin', password: 'hq123', name: '张同学', role: 'hq' as UserRole },
  { username: 'hq_market', password: 'hq123', name: '李同学', role: 'hq' as UserRole },
  { username: 'region_east', password: 'reg123', name: '王运营', role: 'regional' as UserRole, region: '华东区' },
  { username: 'region_south', password: 'reg123', name: '陈运营', role: 'regional' as UserRole, region: '华南区' },
  { username: 'region_north', password: 'reg123', name: '刘运营', role: 'regional' as UserRole, region: '华北区' },
]

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('aipp_user')
      if (saved) {
        const parsed = JSON.parse(saved)
        // 兼容 BigOffs 登录用户和硬编码账号用户
        setUser({
          username: parsed.username,
          name: parsed.name,
          role: (parsed.role as UserRole) ?? 'regional',
          region: parsed.region,
        })
      }
    } catch {}
    setReady(true)
  }, [])

  const login = useCallback((username: string, password: string): boolean => {
    const account = TEST_ACCOUNTS.find(
      a => a.username === username && a.password === password
    )
    if (!account) return false
    const { password: _, ...userInfo } = account
    setUser(userInfo)
    sessionStorage.setItem('aipp_user', JSON.stringify(userInfo))
    return true
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    sessionStorage.removeItem('aipp_user')
  }, [])

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    return {
      user: null,
      ready: false,
      login: () => false,
      logout: () => {},
    } as AuthContextType
  }
  return ctx
}
