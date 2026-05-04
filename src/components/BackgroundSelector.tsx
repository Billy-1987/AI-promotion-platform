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
      <p className="text-xs text-slate-500 mb-2">选择背景</p>
      <div className="grid grid-cols-4 gap-2">
        {ordered.map(bg => (
          <button
            key={bg.id}
            onClick={() => onSelect(bg.id)}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              selectedId === bg.id
                ? 'text-white ring-2'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-800'
            }`}
            style={selectedId === bg.id ? { background: '#0034cc', boxShadow: '0 0 0 2px rgba(0,52,204,0.3)' } : {}}
          >
            {bg.label}
          </button>
        ))}
      </div>
    </div>
  )
}
