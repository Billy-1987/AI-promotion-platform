'use client'

import { useState, useCallback } from 'react'
import { TryOnState, TryOnResult, StyleTag, ModelGender, TryOnAspectRatio } from '@/types'
import { suggestBackgrounds, generateTryOn } from '@/lib/mockAI'

export function useTryOn() {
  const [state, setState] = useState<TryOnState>({
    status: 'idle',
    modelPhotoFile: null,
    modelPhotoPreviewUrl: null,
    clothingFile: null,
    clothingPreviewUrl: null,
    detectedStyle: null,
    modelGender: 'female',
    aspectRatio: '3:4',
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

  const selectGender = useCallback((gender: ModelGender) => {
    setState(prev => ({ ...prev, modelGender: gender }))
  }, [])

  const selectAspectRatio = useCallback((ratio: TryOnAspectRatio) => {
    setState(prev => ({ ...prev, aspectRatio: ratio }))
  }, [])

  const [generateError, setGenerateError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    if (!state.clothingFile || !state.selectedBackground) return
    setState(prev => ({ ...prev, status: 'processing' }))
    setGenerateError(null)
    const productCategory = state.analysis?.productCategory ?? 'clothing'
    try {
      const result: TryOnResult = await generateTryOn(
        state.clothingFile!,
        state.selectedBackground!,
        null,
        state.detectedStyle,
        productCategory,
        undefined,
        state.modelGender,
        state.aspectRatio,
      )
      setState(prev => ({ ...prev, status: 'result', resultUrl: result.previewUrl, tryOnResult: result }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成失败，请重试'
      setGenerateError(msg)
      setState(prev => ({ ...prev, status: 'ready' }))
    }
  }, [state.clothingFile, state.selectedBackground, state.detectedStyle, state.analysis, state.modelGender, state.aspectRatio])

  const reset = useCallback(() => {
    if (state.clothingPreviewUrl) URL.revokeObjectURL(state.clothingPreviewUrl)
    setState({
      status: 'idle',
      modelPhotoFile: null,
      modelPhotoPreviewUrl: null,
      clothingFile: null,
      clothingPreviewUrl: null,
      detectedStyle: null,
      modelGender: 'female',
      aspectRatio: '3:4',
      selectedBackground: null,
      resultUrl: null,
      tryOnResult: null,
      analysis: null,
    })
    setSuggestedBackgrounds([])
    setGenerateError(null)
  }, [state.clothingPreviewUrl])

  return { state, generateError, suggestedBackgrounds, uploadClothing, selectBackground, selectStyle, selectGender, selectAspectRatio, generate, reset }
}
