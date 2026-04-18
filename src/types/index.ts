export type StyleTag = 'sport' | 'outdoor' | 'menswear' | 'womenswear' | 'kids' | 'trendy' | 'vintage' | 'workwear'

export type ProductCategory = 'clothing' | 'shoes'

export type TryOnStatus = 'idle' | 'detecting' | 'ready' | 'processing' | 'result'

export type UserRole = 'hq' | 'regional'

export interface User {
  username: string
  name: string
  role: UserRole
  region?: string
}

export interface Background {
  id: string
  label: string
  url: string
  tags: StyleTag[]
}

export interface GeminiAnalysis {
  style: StyleTag
  colors: string[]
  category: string
  productCategory: ProductCategory
  keywords: string[]
  backgroundSuggestion: string
  productDescription: string
}

export interface TryOnResult {
  description: string
  fitScore: number
  styleMatch: string
  occasion: string
  previewUrl: string
}

export interface TryOnState {
  status: TryOnStatus
  modelPhotoFile: File | null
  modelPhotoPreviewUrl: string | null
  clothingFile: File | null
  clothingPreviewUrl: string | null
  detectedStyle: StyleTag | null
  selectedBackground: string | null
  resultUrl: string | null
  tryOnResult: TryOnResult | null
  analysis: GeminiAnalysis | null
}
