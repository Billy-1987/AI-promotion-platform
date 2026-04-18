'use client'

import { BACKGROUNDS } from '@/lib/mockAI'

interface Props {
  selectedId: string | null
  suggestedOrder: string[]
  onSelect: (id: string) => void
}

export default function BackgroundSelector({ selectedId, suggestedOrder, onSelect }: Props) {
  const ordered = suggestedOrder.length > 0
    ? suggestedOrder.map(id => BACKGROUNDS.find(b => b.id === id)!).filter(Boolean)
    : BACKGROUNDS

  return (
    <div className="mt-4">
      <p className="text-xs text-zinc-400 mb-2">选择背景</p>
      <div className="grid grid-cols-4 gap-2">
        {ordered.map(bg => (
          <button
            key={bg.id}
            onClick={() => onSelect(bg.id)}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              selectedId === bg.id
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white'
            }`}
          >
            {bg.label}
          </button>
        ))}
      </div>
    </div>
  )
}
