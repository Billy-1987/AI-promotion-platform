'use client'

interface Props {
  resultUrl: string | null
}

export default function ExportButton({ resultUrl }: Props) {
  const handleDownload = () => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `tryon-result-${Date.now()}.jpg`
    a.target = '_blank'
    a.click()
  }

  return (
    <button
      onClick={handleDownload}
      disabled={!resultUrl}
      className="w-full mt-3 py-2.5 rounded-lg font-medium text-sm transition-all bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed"
    >
      ⬇ 下载结果图
    </button>
  )
}
