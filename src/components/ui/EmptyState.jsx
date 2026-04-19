export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4 px-6">
      {icon && <div className="text-5xl opacity-30">{icon}</div>}
      <div>
        <p className="text-white font-semibold text-lg">{title}</p>
        {subtitle && <p className="text-[#777] text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
