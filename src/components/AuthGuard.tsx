'use client'

import { useAuth } from '@/lib/auth'
import LoginPage from './LoginPage'
import { ReactNode } from 'react'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <LoginPage />
  return <>{children}</>
}
