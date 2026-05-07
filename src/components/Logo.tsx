export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const textCls = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-2xl'
  return (
    <span className={`inline-flex items-center font-black tracking-tight ${textCls}`}>
      <span style={{ color: '#fcea42' }}>BIG</span>
      <span style={{ color: '#60a5fa' }}>OFFS</span>
    </span>
  )
}
