import { pct } from '../utils'

interface Props {
  proteins: number
  fats: number
  carbs: number
  calories: number
  goals: { proteins: number; fats: number; carbs: number; calories: number }
}

const RING_SIZE = 118
const RING_STROKE = 9

/* Circular calorie gauge — white on the gradient hero */
function CalorieRing({ calories, goal }: { calories: number; goal: number }) {
  const p = Math.min(pct(calories, goal), 100)
  const over = calories > goal
  const r = (RING_SIZE - RING_STROKE) / 2
  const c = 2 * Math.PI * r
  const remaining = Math.round(goal - calories)

  return (
    <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r}
          fill="none" stroke={over ? '#fcd34d' : '#ffffff'} strokeWidth={RING_STROKE}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-2xl font-bold leading-none">{Math.abs(remaining)}</span>
        <span className="text-[10px] text-white/75 mt-1">
          {remaining >= 0 ? 'kcal restantes' : 'kcal dépassées'}
        </span>
      </div>
    </div>
  )
}

interface BarProps {
  label: string
  value: number
  goal: number
  color: string
}

function MacroBar({ label, value, goal, color }: BarProps) {
  const p = Math.min(pct(value, goal), 100)
  const over = value > goal
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] font-medium text-white/80">{label}</span>
        <span className="text-[11px] font-semibold text-white">
          {value}<span className="text-white/60 font-normal"> / {goal} g</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${p}%`, backgroundColor: over ? '#fcd34d' : color }}
        />
      </div>
    </div>
  )
}

export default function MacroProgress({ proteins, fats, carbs, calories, goals }: Props) {
  return (
    <div>
      <div className="flex items-center gap-5">
        <CalorieRing calories={calories} goal={goals.calories} />
        <div className="flex-1 space-y-2.5 min-w-0">
          <MacroBar label="Protéines" value={proteins} goal={goals.proteins} color="#7dd3fc" />
          <MacroBar label="Glucides" value={carbs} goal={goals.carbs} color="#fde68a" />
          <MacroBar label="Lipides" value={fats} goal={goals.fats} color="#fda4af" />
        </div>
      </div>
      <p className="text-center text-[11px] text-white/70 mt-3">
        {Math.round(calories)} kcal consommées · objectif {goals.calories} kcal
      </p>
    </div>
  )
}
