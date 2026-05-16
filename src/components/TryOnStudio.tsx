'use client'

import Link from 'next/link'
import { useTryOn } from '@/hooks/useTryOn'
import { useAuth } from '@/lib/auth'
import UploadPanel from './UploadPanel'
import PreviewPanel from './PreviewPanel'
import Logo from './Logo'
import { APP_VERSION } from '@/lib/version'

const ROLE_LABEL = { hq: '总部市场部', regional: '区域运营' }

export default function TryOnStudio() {
  const { user, logout } = useAuth()
  const { state, generateError, suggestedBackgrounds, uploadClothing, selectBackground, selectStyle, selectGender, selectAge, selectAspectRatio, generate, reset } = useTryOn(user?.username)

  const isShoes = state.analysis?.productCategory === 'shoes'

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f7' }}>
      {/* Header */}
      <header className="bigoffs-header px-2 md:px-6 flex items-center justify-between overflow-hidden flex-shrink-0 gap-2" style={{ height: 60 }}>
        <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
          <div className="md:hidden"><Logo size="sm" /></div>
          <div className="hidden md:block"><Logo /></div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-lg font-bold text-white truncate leading-tight">智能推广平台</h1>
            <p className="text-[10px] md:text-xs text-slate-400 truncate leading-tight">AI 换装</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
          {state.status !== 'idle' && (
            <button
              onClick={reset}
              title="重新开始"
              className="text-xs md:text-sm text-slate-300 hover:text-white transition-colors px-2 md:px-3 py-1.5 rounded-lg hover:bg-white/10 flex-shrink-0 whitespace-nowrap flex items-center"
            >
              <svg className="w-4 h-4 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden md:inline">重新开始</span>
            </button>
          )}

          {/* User info */}
          {user && (
            <div className="flex items-center gap-2 md:gap-3 md:pl-4 md:border-l md:border-white/10 flex-shrink-0">
              <div className="text-right hidden sm:block min-w-0">
                <p className="text-sm text-white font-medium truncate">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">
                  {ROLE_LABEL[user.role]}{user.region ? ` · ${user.region}` : ''}
                </p>
              </div>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold text-white flex-shrink-0" style={{ background: '#0034cc' }}>
                {user.name[0]}
              </div>
              <button
                onClick={logout}
                className="text-xs text-slate-400 hover:text-white transition-colors px-1.5 md:px-2 py-1 rounded hover:bg-white/10 flex-shrink-0 whitespace-nowrap"
              >
                退出
              </button>
            </div>
          )}
          <span className="hidden md:inline text-xs text-slate-400 ml-1 flex-shrink-0">{APP_VERSION}</span>
        </div>
      </header>

      {/* Nav */}
      <nav className="bigoffs-header border-b border-white/10 px-3 md:px-6 flex gap-1 flex-shrink-0 overflow-x-auto whitespace-nowrap">
        {[
          { label: '运营日历', href: '/calendar', icon: '📅' },
          { label: '模板社区', href: '/templates', icon: '🎨' },
          { label: 'AI 换装', href: '/tryon', icon: '👗', active: true },
          { label: 'AI 图片设计', href: '/image-design', icon: '✨' },
          { label: '我的图库', href: '/gallery', icon: '🖼️' },
        ].map(item => (
          <Link
            key={item.label}
            href={item.href}
            prefetch
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              item.active
                ? 'text-white'
                : 'border-transparent text-slate-400 hover:text-white hover:border-white/30'
            }`}
            style={item.active ? { borderBottomColor: '#fcea42', color: '#fcea42' } : {}}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Main layout */}
      <main className="max-w-6xl mx-auto px-3 md:px-6 py-3 md:py-8 grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-8 min-h-[calc(100vh-65px)]">
        {/* Left: Upload */}
        <div className="glass-card rounded-2xl p-3 md:p-6 flex flex-col">
          <UploadPanel
            previewUrl={state.clothingPreviewUrl}
            detectedStyle={state.detectedStyle}
            detecting={state.status === 'detecting'}
            isShoes={isShoes}
            modelGender={state.modelGender}
            modelAge={state.modelAge}
            aspectRatio={state.aspectRatio}
            onUpload={uploadClothing}
            onStyleSelect={selectStyle}
            onGenderSelect={selectGender}
            onAgeSelect={selectAge}
            onAspectRatioSelect={selectAspectRatio}
          />
        </div>

        {/* Right: Preview */}
        <div className="glass-card rounded-2xl p-3 md:p-6 flex flex-col">
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
