import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatDateShort, sumEntries, pct } from '../utils'
import type { HistoryEntry } from '../types'

export default function History() {
  const profile = useLiveQuery(() => db.profile.get(1))
  const seedHistory = useLiveQuery(() => db.history.orderBy('date').reverse().toArray(), [])
  const allEntries = useLiveQuery(() => db.mealEntries.orderBy('date').toArray(), [])

  const goals = profile?.goals ?? { calories: 2542, proteins: 95, fats: 99, carbs: 318 }

  // Group meal entries by date and compute daily totals
  const liveHistory = (() => {
    if (!allEntries) return []
    const byDate = new Map<string, typeof allEntries>()
    allEntries.forEach(e => {
      if (!byDate.has(e.date)) byDate.set(e.date, [])
      byDate.get(e.date)!.push(e)
    })
    return Array.from(byDate.entries())
      .map(([date, entries]) => {
        const t = sumEntries(entries)
        return { date, ...t, notes: undefined } as HistoryEntry
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  })()

  // Merge seed history + live history, deduplicate by date (live wins)
  const liveDates = new Set(liveHistory.map(h => h.date))
  const seedFiltered = (seedHistory ?? []).filter(h => !liveDates.has(h.date))
  const merged = [...liveHistory, ...seedFiltered].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-800 pt-2">Historique</h1>

      {merged.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>Aucune entrée pour l'instant.</p>
          <p className="text-sm">Commence à saisir tes repas dans l'onglet Aujourd'hui.</p>
        </div>
      )}

      <div className="space-y-2">
        {merged.map(entry => {
          const calPct = pct(entry.calories, goals.calories)
          const over = calPct > 100
          return (
            <div key={entry.date} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-gray-700 capitalize">
                  {formatDateShort(entry.date)}
                </span>
                <span className={`text-sm font-bold ${over ? 'text-orange-500' : 'text-green-600'}`}>
                  {Math.round(entry.calories)} kcal
                  <span className="text-xs font-normal text-gray-400 ml-1">/ {goals.calories}</span>
                </span>
              </div>
              {/* Calories bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                <div
                  className={`h-full rounded-full ${over ? 'bg-orange-400' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(calPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>P: <span className="font-medium text-gray-700">{entry.proteins}g</span></span>
                <span>G: <span className="font-medium text-gray-700">{entry.carbs}g</span></span>
                <span>L: <span className="font-medium text-gray-700">{entry.fats}g</span></span>
                {entry.notes && <span className="text-gray-400 truncate max-w-24">{entry.notes}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
