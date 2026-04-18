'use client'

import { useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import ImageDesignStudio from '@/components/ImageDesignStudio'

export default function ImageDesignPage() {
  return (
    <AuthGuard>
      <ImageDesignStudio />
    </AuthGuard>
  )
}
