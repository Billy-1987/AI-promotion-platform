export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
  return (
    <span className={`font-black tracking-tight ${cls}`}>
      <span className="text-yellow-400">BIG</span>
      <span className="text-blue-400">OFFS</span>
    </span>
  )
}
