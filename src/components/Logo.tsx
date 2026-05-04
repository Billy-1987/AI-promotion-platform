export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const textCls = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-2xl'
  const dotCls = size === 'lg' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
  return (
    <span className={`inline-flex items-center gap-1 font-black tracking-tight ${textCls}`}>
      <span className="text-white">BIG</span>
      <span
        className={`${dotCls} rounded-full inline-block`}
        style={{
          backgroundColor: '#fcea42',
          boxShadow: '0 0 8px rgba(252, 234, 66, 0.6)',
        }}
      />
      <span className="text-white">OFFS</span>
    </span>
  )
}
