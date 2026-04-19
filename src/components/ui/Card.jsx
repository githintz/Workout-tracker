export function Card({ children, className = '', onClick, ...props }) {
  const clickable = onClick ? 'cursor-pointer hover:border-[#3e3e3e] active:scale-[0.99] transition-all' : ''
  return (
    <div
      className={`bg-[#141414] border border-[#2e2e2e] rounded-3xl p-4 ${clickable} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

export function Sheet({ children, className = '' }) {
  return (
    <div className={`bg-[#0f0f0f] border-t border-[#2e2e2e] rounded-t-3xl p-5 ${className}`}>
      {children}
    </div>
  )
}
