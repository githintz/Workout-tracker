const COLORS = {
  Chest:      '#ff6b6b', Back:      '#4fa8ff', Shoulders: '#ff8c42',
  Biceps:     '#c084fc', Triceps:   '#a78bfa', Legs:      '#4fdf7c',
  Glutes:     '#fb7185', Core:      '#fbbf24', 'Full Body':'#e8ff47',
  Cardio:     '#22d3ee', default:   '#555',
}

export function MuscleChip({ group, active, onClick }) {
  const color = COLORS[group] || COLORS.default
  const base = 'inline-flex items-center px-3 h-8 rounded-full text-sm font-medium transition-all select-none'
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${base} cursor-pointer active:scale-95`}
        style={active
          ? { background: color + '22', color, border: `1px solid ${color}55` }
          : { background: '#1e1e1e', color: '#555', border: '1px solid #2e2e2e' }
        }
      >
        {group}
      </button>
    )
  }
  return (
    <span
      className={base}
      style={{ background: color + '22', color, border: `1px solid ${color}44` }}
    >
      {group}
    </span>
  )
}
