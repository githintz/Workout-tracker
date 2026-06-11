export function Input({ label, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm text-[#777] font-medium">{label}</label>}
      <input
        className={`h-12 px-4 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-base
          placeholder:text-[#444] focus:outline-none focus:border-accent/50 transition-colors w-full ${className}`}
        {...props}
      />
    </div>
  )
}

export function NumberInput({ label, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm text-[#777] font-medium">{label}</label>}
      <input
        type="number"
        className={`h-12 px-4 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-base text-center
          placeholder:text-[#444] focus:outline-none focus:border-accent/50 transition-colors w-full ${className}`}
        {...props}
      />
    </div>
  )
}
