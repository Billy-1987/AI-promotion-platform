'use client'

import { useTryOn } from '@/hooks/useTryOn'
import { useAuth } from '@/lib/auth'
import UploadPanel from './UploadPanel'
import PreviewPanel from './PreviewPanel'
import Logo from './Logo'

const ROLE_LABEL = { hq: '总部市场部', regional: '区域运营' }

export default function TryOnStudio() {
  const { state, generateError, suggestedBackgrounds, uploadClothing, selectBackground, selectStyle, selectGender, selectAspectRatio, generate, reset } = useTryOn()
  const { user, logout } = useAuth()

  const isShoes = state.analysis?.productCategory === 'shoes'

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f7' }}>
      {/* Header */}
      <header className="bigoffs-header px-6 flex items-center justify-between" style={{ height: 60 }}>
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-lg font-bold text-white">智能推广平台</h1>
            <p className="text-xs text-slate-400">AI 商品图背景替换</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {state.status !== 'idle' && (
            <button
              onClick={reset}
              className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              重新开始
            </button>
          )}

          {/* User info */}
          {user && (
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right">
                <p className="text-sm text-white font-medium">{user.name}</p>
                <p className="text-xs text-slate-400">
                  {ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#0034cc' }}>
                {user.name[0]}
              </div>
              <button
                onClick={logout}
                className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
              >
                退出
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Nav */}
      <nav className="bigoffs-header border-b border-white/10 px-6 flex gap-1">
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
                ? 'text-white'
                : 'border-transparent text-slate-400 hover:text-white hover:border-white/30'
            }`}
            style={item.active ? { borderBottomColor: '#fcea42', color: '#fcea42' } : {}}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Main layout */}
      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[calc(100vh-65px)]">
        {/* Left: Upload */}
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <UploadPanel
            previewUrl={state.clothingPreviewUrl}
            detectedStyle={state.detectedStyle}
            detecting={state.status === 'detecting'}
            isShoes={isShoes}
            modelGender={state.modelGender}
            aspectRatio={state.aspectRatio}
            onUpload={uploadClothing}
            onStyleSelect={selectStyle}
            onGenderSelect={selectGender}
            onAspectRatioSelect={selectAspectRatio}
          />
        </div>

        {/* Right: Preview */}
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          {generateError && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{generateError}</span>
            </div>
          )}
          <PreviewPanel
            status={state.status}
            resultUrl={state.resultUrl}
            tryOnResult={state.tryOnResult}
            selectedBackground={state.selectedBackground}
            suggestedBackgrounds={suggestedBackgrounds}
            analysis={state.analysis}
            isShoes={isShoes}
            username={user?.username}
            onSelectBackground={selectBackground}
            onGenerate={generate}
          />
        </div>
      </main>
    </div>
  )
}
