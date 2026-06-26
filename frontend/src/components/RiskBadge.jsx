const MAP = {
  red: ['#FEF2F2', '#E11D48', 'High risk'],
  amber: ['#FFFBEB', '#D97706', 'Some risk'],
  green: ['#E6F7F5', '#0EA5A0', 'Looks fair']
}

export default function RiskBadge({ level, score }) {
  const [bg, color, label] = MAP[level] || MAP.green
  return (
    <span className="chip" style={{ background: bg, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}{typeof score === 'number' ? ` · ${Math.round(score * 100)}%` : ''}
    </span>
  )
}
