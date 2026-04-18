'use client'

import { useRef, DragEvent } from 'react'
import StyleTagSelector from './StyleTagSelector'
import { StyleTag } from '@/types'

interface Props {
  previewUrl: string | null
  detectedStyle: StyleTag | null
  detecting: boolean
  isShoes: boolean
  onUpload: (file: File) => void
  onStyleSelect: (tag: StyleTag) => void
}

export default function UploadPanel({ previewUrl, detectedStyle, detecting, isShoes, onUpload, onStyleSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onUpload(file)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-white">AI 换装</h2>
        <p className="text-xs text-zinc-500 mt-1">
          {isShoes
            ? '上传鞋子图，AI 自动生成场景展示效果'
            : '上传商品图，AI 自动生成虚拟模特上身效果'}
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="h-72 border-2 border-dashed border-zinc-600 hover:border-indigo-400 rounded-xl transition-colors cursor-pointer bg-zinc-800/50 flex items-center justify-center overflow-hidden mb-3"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="商品图" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center px-6">
            <div className="text-5xl mb-3">{isShoes ? '👟' : '📦'}</div>
            <p className="text-zinc-200 font-medium mb-2">拖拽商品图到此处</p>
            <p className="text-zinc-500 text-sm mb-4">或点击选择文件 · JPG / PNG</p>
            <div className="flex flex-wrap justify-center gap-2">
              {(isShoes
                ? ['运动鞋', '皮鞋 / 靴子', '凉鞋 / 拖鞋']
                : ['白底商品图', '模特上身图', '实拍场景图']
              ).map(t => (
                <span key={t} className="px-2.5 py-1 bg-zinc-700/60 text-zinc-400 text-xs rounded-full border border-zinc-600/50">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
        className="hidden"
      />

      {/* 鞋子模式下隐藏风格选择器，因为不需要模特风格 */}
      {!isShoes && (
        <StyleTagSelector selected={detectedStyle} detecting={detecting} onSelect={onStyleSelect} />
      )}

      {/* 鞋子模式提示 */}
      {isShoes && detectedStyle && !detecting && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-indigo-900/30 border border-indigo-700/40 rounded-lg">
          <span className="text-lg">👟</span>
          <p className="text-xs text-indigo-300">已识别为鞋类商品，将生成无模特场景展示图</p>
        </div>
      )}
    </div>
  )
}
