'use client'

import { useRef, DragEvent } from 'react'
import StyleTagSelector from './StyleTagSelector'
import { StyleTag, ModelGender, TryOnAspectRatio } from '@/types'

interface Props {
  previewUrl: string | null
  detectedStyle: StyleTag | null
  detecting: boolean
  isShoes: boolean
  modelGender: ModelGender
  aspectRatio: TryOnAspectRatio
  onUpload: (file: File) => void
  onStyleSelect: (tag: StyleTag) => void
  onGenderSelect: (gender: ModelGender) => void
  onAspectRatioSelect: (ratio: TryOnAspectRatio) => void
}

const GENDER_OPTIONS: { value: ModelGender; label: string; emoji: string }[] = [
  { value: 'female', label: '成人女', emoji: '👩' },
  { value: 'male',   label: '成人男', emoji: '👨' },
  { value: 'kids',   label: '儿童',   emoji: '🧒' },
]

const RATIO_OPTIONS: { value: TryOnAspectRatio; label: string; w: number; h: number }[] = [
  { value: '3:4',  label: '3:4',  w: 3, h: 4 },
  { value: '1:1',  label: '1:1',  w: 1, h: 1 },
  { value: '4:3',  label: '4:3',  w: 4, h: 3 },
  { value: '9:16', label: '9:16', w: 9, h: 16 },
]

export default function UploadPanel({
  previewUrl, detectedStyle, detecting, isShoes,
  modelGender, aspectRatio,
  onUpload, onStyleSelect, onGenderSelect, onAspectRatioSelect,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onUpload(file)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-slate-800">AI 换装</h2>
        <p className="text-xs text-slate-500 mt-1">
          {isShoes
            ? '上传鞋子图，AI 自动生成场景展示效果'
            : '上传商品图，AI 自动生成虚拟模特上身效果'}
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="h-64 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl transition-colors cursor-pointer bg-slate-50 flex items-center justify-center overflow-hidden mb-3"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="商品图" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center px-6">
            <div className="text-5xl mb-3">{isShoes ? '👟' : '📦'}</div>
            <p className="text-slate-700 font-medium mb-2">拖拽商品图到此处</p>
            <p className="text-slate-400 text-sm mb-4">或点击选择文件 · JPG / PNG</p>
            <div className="flex flex-wrap justify-center gap-2">
              {(isShoes
                ? ['运动鞋', '皮鞋 / 靴子', '凉鞋 / 拖鞋']
                : ['白底商品图', '模特上身图', '实拍场景图']
              ).map(t => (
                <span key={t} className="px-2.5 py-1 bg-white text-slate-500 text-xs rounded-full border border-slate-200">
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

      {/* 性别/年龄选择 — 仅服装模式 */}
      {!isShoes && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-2">模特性别 / 年龄</p>
          <div className="flex gap-2">
            {GENDER_OPTIONS.map(g => (
              <button
                key={g.value}
                onClick={() => onGenderSelect(g.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  modelGender === g.value
                    ? 'text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
                style={modelGender === g.value ? { background: '#0034cc' } : {}}
              >
                <span>{g.emoji}</span>
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 图片比例选择 */}
      <div className="mb-3">
        <p className="text-xs text-slate-500 mb-2">输出比例</p>
        <div className="flex gap-2">
          {RATIO_OPTIONS.map(r => (
            <button
              key={r.value}
              onClick={() => onAspectRatioSelect(r.value)}
              className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                aspectRatio === r.value
                  ? 'text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              style={aspectRatio === r.value ? { background: '#0034cc' } : {}}
            >
              <span
                className="border-2 border-current"
                style={{
                  width: `${Math.round(16 * (r.w / Math.max(r.w, r.h)))}px`,
                  height: `${Math.round(16 * (r.h / Math.max(r.w, r.h)))}px`,
                  minWidth: '8px',
                  minHeight: '8px',
                }}
              />
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 风格选择 — 仅服装模式 */}
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
