export const dynamic = 'force-dynamic'

import AuthGuard from '@/components/AuthGuard'
import TryOnStudio from '@/components/TryOnStudio'

export default function TryOnPage() {
  return (
    <AuthGuard>
      <TryOnStudio />
    </AuthGuard>
  )
}
