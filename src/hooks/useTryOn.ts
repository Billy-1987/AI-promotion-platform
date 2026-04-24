'use client'

import { useState, useCallback } from 'react'
import { TryOnState, TryOnResult, StyleTag } from '@/types'
import { suggestBackgrounds, generateTryOn } from '@/lib/mockAI'

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
    const defaultStyle: StyleTag = 'womenswear'
    const defaultCategory: 'clothing' | 'shoes' = 'clothing'
    const backgrounds = suggestBackgrounds(defaultStyle, defaultCategory)
    setSuggestedBackgrounds(backgrounds)

    // 上传后直接进入 ready，不自动分析，等用户选好风格和场景后再生成
    setState(prev => ({
      ...prev,
      status: 'ready',
      clothingFile: file,
      clothingPreviewUrl: previewUrl,
      analysis: null,
      resultUrl: null,
      tryOnResult: null,
      detectedStyle: defaultStyle,
      selectedBackground: backgrounds[0],
    }))
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
