import { pct } from '../utils'

interface Props {
  proteins: number
  fats: number
  carbs: number
  calories: number
  goals: { proteins: number; fats: number; carbs: number; calories: number }
  compact?: boolean
}

interface BarProps {
  label: string
  value: number
  goal: number
  color: string
}

function Bar({ label, value, goal, color }: BarProps) {
  const p = pct(value, goal)
  const over = p >= 100
  const displayPct = goal > 0 ? Math.round((value / goal) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-orange-400' : color}`}
          style={{ width: `${Math.min(p, 100)}%` }}
        />
      </div>
      <div className="w-24 text-right shrink-0">
        <span className={`text-xs font-bold ${over ? 'text-orange-500' : 'text-gray-700'}`}>{displayPct}%</span>
        <span className="text-xs text-gray-400 ml-1">{value}/{goal}g</span>
      </div>
    </div>
  )
}

export default function MacroProgress({ proteins, fats, carbs, calories, goals, compact }: Props) {
  const calPct = pct(calories, goals.calories)
  const calDisplayPct = goals.calories > 0 ? Math.round((calories / goals.calories) * 100) : 0
  const calOver = calPct >= 100

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-gray-700">Calories</span>
        <span className={`text-lg font-bold ${calOver ? 'text-orange-500' : 'text-green-600'}`}>
          {Math.round(calories)}
          <span className="text-sm font-normal text-gray-400"> / {goals.calories} kcal</span>
          <span className={`text-sm font-semibold ml-2 ${calOver ? 'text-orange-500' : 'text-green-600'}`}>
            · {calDisplayPct}%
          </span>
        </span>
      </div>
      {!compact && (
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${calOver ? 'bg-orange-400' : 'bg-green-500'}`}
            style={{ width: `${Math.min(calPct, 100)}%` }}
          />
        </div>
      )}
      <div className="space-y-1.5 pt-1">
        <Bar label="Protéines" value={proteins} goal={goals.proteins} color="bg-blue-400" />
        <Bar label="Glucides" value={carbs} goal={goals.carbs} color="bg-yellow-400" />
        <Bar label="Lipides" value={fats} goal={goals.fats} color="bg-red-400" />
      </div>
    </div>
  )
}
