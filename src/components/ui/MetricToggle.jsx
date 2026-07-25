// Reps vs. time — planks and dead hangs are measured in seconds, not reps.
export function MetricToggle({ value = 'reps', onChange, size = 'md' }) {
  const opts = [
    { key: 'reps', label: 'Reps' },
    { key: 'time', label: 'Time (s)' },
  ]
  const h = size === 'sm' ? 'h-7 text-xs px-2.5' : 'h-10 text-sm px-4'
  return (
    <div className="flex gap-1.5">
      {opts.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`${h} rounded-full font-medium transition-all active:scale-95 ${
            value === o.key
              ? 'bg-accent text-black'
              : 'bg-[#1e1e1e] border border-[#2e2e2e] text-[#777]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
