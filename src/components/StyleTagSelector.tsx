'use client'

import { StyleTag } from '@/types'

const TAGS: { value: StyleTag; label: string; emoji: string }[] = [
  { value: 'sport',     label: '运动', emoji: '🏃' },
  { value: 'outdoor',   label: '户外', emoji: '🏕️' },
  { value: 'menswear',  label: '男装', emoji: '👔' },
  { value: 'womenswear',label: '女装', emoji: '👗' },
  { value: 'kids',      label: '儿童', emoji: '🧒' },
  { value: 'trendy',    label: '潮流', emoji: '🧢' },
  { value: 'vintage',   label: '复古', emoji: '🎩' },
  { value: 'workwear',  label: '上班通勤', emoji: '💼' },
]

interface Props {
  selected: StyleTag | null
  detecting: boolean
  onSelect: (tag: StyleTag) => void
}

export default function StyleTagSelector({ selected, detecting, onSelect }: Props) {
  return (
    <div className="mt-4">
      <p className="text-xs text-slate-500 mb-2">
        {detecting ? '正在识别服装风格...' : '服装风格'}
      </p>
      <div className="flex flex-wrap gap-2">
        {TAGS.map(tag => (
          <button
            key={tag.value}
            onClick={() => onSelect(tag.value)}
            disabled={detecting}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              selected === tag.value
                ? 'text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            style={selected === tag.value ? { background: '#0034cc' } : {}}
          >
            {detecting && selected === tag.value ? (
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
            ) : null}
            {tag.emoji} {tag.label}
          </button>
        ))}
      </div>
    </div>
  )
}
