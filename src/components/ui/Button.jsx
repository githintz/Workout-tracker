export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-2xl transition-all active:scale-95 select-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none'

  const variants = {
    primary:   'bg-accent text-black hover:bg-[#d4eb30]',
    secondary: 'bg-[#1e1e1e] text-white border border-[#2e2e2e] hover:bg-[#2a2a2a]',
    ghost:     'text-white hover:bg-[#1e1e1e]',
    danger:    'bg-[#ff4f4f]/10 text-[#ff4f4f] border border-[#ff4f4f]/20 hover:bg-[#ff4f4f]/20',
    accent:    'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20',
  }

  const sizes = {
    sm:  'h-9  px-4 text-sm gap-1.5',
    md:  'h-12 px-5 text-base gap-2',
    lg:  'h-14 px-6 text-lg gap-2',
    xl:  'h-16 px-7 text-xl gap-2.5',
    icon:'h-12 w-12 p-0',
    'icon-sm': 'h-9 w-9 p-0',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
