'use client'

import { useTryOn } from '@/hooks/useTryOn'
import { useAuth } from '@/lib/auth'
import UploadPanel from './UploadPanel'
import PreviewPanel from './PreviewPanel'
import Logo from './Logo'

const ROLE_LABEL = { hq: '总部市场部', regional: '区域运营' }

export default function TryOnStudio() {
  const { state, suggestedBackgrounds, uploadClothing, selectBackground, selectStyle, generate, reset } = useTryOn()
  const { user, logout } = useAuth()

  const isShoes = state.analysis?.productCategory === 'shoes'

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-lg font-bold text-white">智能推广平台</h1>
            <p className="text-xs text-zinc-400">AI 商品图背景替换</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {state.status !== 'idle' && (
            <button
              onClick={reset}
              className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800"
            >
              重新开始
            </button>
          )}

          {/* User info */}
          {user && (
            <div className="flex items-center gap-3 pl-4 border-l border-zinc-700">
              <div className="text-right">
                <p className="text-sm text-white font-medium">{user.name}</p>
                <p className="text-xs text-zinc-400">
                  {ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
                {user.name[0]}
              </div>
              <button
                onClick={logout}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
              >
                退出
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 flex gap-1">
        {[
          { label: '运营日历', href: '/calendar', icon: '📅' },
          { label: '模板社区', href: '/templates', icon: '🎨' },
          { label: 'AI 换装', href: '/tryon', icon: '👗', active: true },
          { label: 'AI 图片设计', href: '/image-design', icon: '✨' },
          { label: '我的图库', href: '/gallery', icon: '🖼️' },
        ].map(item => (
          <a
            key={item.label}
            href={item.href}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              item.active
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Main layout */}
      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[calc(100vh-65px)]">
        {/* Left: Upload */}
        <div className="bg-zinc-800/50 rounded-2xl p-6 flex flex-col">
          <UploadPanel
            previewUrl={state.clothingPreviewUrl}
            detectedStyle={state.detectedStyle}
            detecting={state.status === 'detecting'}
            isShoes={isShoes}
            onUpload={uploadClothing}
            onStyleSelect={selectStyle}
          />
        </div>

        {/* Right: Preview */}
        <div className="bg-zinc-800/50 rounded-2xl p-6 flex flex-col">
          <PreviewPanel
            status={state.status}
            resultUrl={state.resultUrl}
            tryOnResult={state.tryOnResult}
            selectedBackground={state.selectedBackground}
            suggestedBackgrounds={suggestedBackgrounds}
            analysis={state.analysis}
            isShoes={isShoes}
            onSelectBackground={selectBackground}
            onGenerate={generate}
          />
        </div>
      </main>
    </div>
  )
}
