'use client'

import { useState, useCallback } from 'react'
import { TryOnState, TryOnResult, StyleTag, GeminiAnalysis } from '@/types'
import { analyzeClothing, suggestBackgrounds, generateTryOn } from '@/lib/mockAI'

export function useTryOn() {
  const [state, setState] = useState<TryOnState>({
    status: 'idle',
    modelPhotoFile: null,
    modelPhotoPreviewUrl: null,
    clothingFile: null,
    clothingPreviewUrl: null,
    detectedStyle: null,
    selectedBackground: null,
    resultUrl: null,
    tryOnResult: null,
    analysis: null,
  })

  const [suggestedBackgrounds, setSuggestedBackgrounds] = useState<string[]>([])

  const uploadClothing = useCallback(async (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setState(prev => ({
      ...prev,
      status: 'detecting',
      clothingFile: file,
      clothingPreviewUrl: previewUrl,
      analysis: null,
      resultUrl: null,
      tryOnResult: null,
    }))

    let analysis: GeminiAnalysis | null = null
    let style: StyleTag = 'womenswear'
    let productCategory: 'clothing' | 'shoes' = 'clothing'

    try {
      analysis = await analyzeClothing(file)
      style = analysis.style
      productCategory = analysis.productCategory ?? 'clothing'
    } catch {
      const tags: StyleTag[] = ['sport', 'outdoor', 'menswear', 'womenswear', 'kids', 'trendy', 'vintage', 'workwear']
      style = tags[Math.floor(Math.random() * tags.length)]
    }

    const backgrounds = suggestBackgrounds(style, productCategory)
    setSuggestedBackgrounds(backgrounds)

    setState(prev => ({
      ...prev,
      status: 'processing',
      detectedStyle: style,
      selectedBackground: backgrounds[0],
      analysis,
    }))

    try {
      const result: TryOnResult = await generateTryOn(file, backgrounds[0], null, style, productCategory)
      setState(prev => ({ ...prev, status: 'result', resultUrl: result.previewUrl, tryOnResult: result }))
    } catch {
      setState(prev => ({ ...prev, status: 'ready' }))
    }
  }, [])

  const selectBackground = useCallback((backgroundId: string) => {
    setState(prev => ({ ...prev, selectedBackground: backgroundId }))
  }, [])

  const selectStyle = useCallback((style: StyleTag) => {
    const productCategory = state.analysis?.productCategory ?? 'clothing'
    const backgrounds = suggestBackgrounds(style, productCategory)
    setSuggestedBackgrounds(backgrounds)
    setState(prev => ({ ...prev, detectedStyle: style, selectedBackground: backgrounds[0] }))
  }, [state.analysis])

  const generate = useCallback(async () => {
    if (!state.clothingFile || !state.selectedBackground) return
    setState(prev => ({ ...prev, status: 'processing' }))
    const productCategory = state.analysis?.productCategory ?? 'clothing'
    try {
      const result: TryOnResult = await generateTryOn(
        state.clothingFile!,
        state.selectedBackground!,
        null,
        state.detectedStyle,
        productCategory,
      )
      setState(prev => ({ ...prev, status: 'result', resultUrl: result.previewUrl, tryOnResult: result }))
    } catch {
      setState(prev => ({ ...prev, status: 'ready' }))
    }
  }, [state.clothingFile, state.selectedBackground, state.detectedStyle, state.analysis])

  const reset = useCallback(() => {
    if (state.clothingPreviewUrl) URL.revokeObjectURL(state.clothingPreviewUrl)
    setState({
      status: 'idle',
      modelPhotoFile: null,
      modelPhotoPreviewUrl: null,
      clothingFile: null,
      clothingPreviewUrl: null,
      detectedStyle: null,
      selectedBackground: null,
      resultUrl: null,
      tryOnResult: null,
      analysis: null,
    })
    setSuggestedBackgrounds([])
  }, [state.clothingPreviewUrl])

  return { state, suggestedBackgrounds, uploadClothing, selectBackground, selectStyle, generate, reset }
}
