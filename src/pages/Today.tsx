import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { db } from '../db'
import { today, formatDateLong, sumEntries } from '../utils'
import { MEAL_META, MEAL_ORDER, type MealType, type MealEntry } from '../types'
import MacroProgress from '../components/MacroProgress'
import FoodSearch from '../components/FoodSearch'

const DATE = today()

export default function Today() {
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null)

  const profile = useLiveQuery(() => db.profile.get(1))
  const entries = useLiveQuery(() => db.mealEntries.where('date').equals(DATE).toArray(), [])

  const totals = sumEntries(entries ?? [])
  const goals = profile?.goals ?? { calories: 2542, proteins: 95, fats: 99, carbs: 318 }

  async function handleAddEntry(meal: MealType, data: Omit<MealEntry, 'id' | 'date' | 'meal'>) {
    await db.mealEntries.add({ ...data, date: DATE, meal })
    setAddingMeal(null)
  }

  async function handleDelete(id: number) {
    await db.mealEntries.delete(id)
  }

  async function toggleExternal(entry: MealEntry) {
    await db.mealEntries.update(entry.id!, { isExternal: !entry.isExternal })
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-gray-800 capitalize">{formatDateLong(DATE)}</h1>
      </div>

      {/* Macro summary */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <MacroProgress
          proteins={totals.proteins}
          fats={totals.fats}
          carbs={totals.carbs}
          calories={totals.calories}
          goals={goals}
        />
      </div>

      {/* Meal sections */}
      {MEAL_ORDER.map(meal => {
        const meta = MEAL_META[meal]
        const mealEntries = (entries ?? []).filter(e => e.meal === meal)
        const mealCal = mealEntries.reduce((s, e) => s + e.calories, 0)

        return (
          <div key={meal} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-lg">{meta.icon}</span>
                <span className="font-semibold text-gray-700">{meta.label}</span>
              </div>
              <span className="text-sm text-gray-400">
                {mealCal > 0 ? `${Math.round(mealCal)} kcal` : '—'}
              </span>
            </div>

            {mealEntries.map(entry => (
              <div key={entry.id} className="flex items-center px-4 py-2.5 border-b border-gray-50 last:border-0 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{entry.foodName}</p>
                  <p className="text-xs text-gray-400">
                    {entry.quantity}{entry.baseUnit === 1 ? 'u' : 'g'} · {Math.round(entry.calories)} kcal
                    {' · '}P:{entry.proteins}g G:{entry.carbs}g L:{entry.fats}g
                  </p>
                </div>
                <button
                  onClick={() => toggleExternal(entry)}
                  className={`p-1 rounded-lg ${entry.isExternal ? 'text-orange-400' : 'text-gray-200'}`}
                  title="Repas extérieur"
                >
                  <ExternalLink size={14} />
                </button>
                <button
                  onClick={() => handleDelete(entry.id!)}
                  className="p-1 text-gray-300 hover:text-red-400 rounded-lg"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              onClick={() => setAddingMeal(meal)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-green-600 hover:bg-green-50 transition-colors"
            >
              <Plus size={16} />
              Ajouter un aliment
            </button>
          </div>
        )
      })}

      {addingMeal && (
        <FoodSearch
          onAdd={data => handleAddEntry(addingMeal, data)}
          onClose={() => setAddingMeal(null)}
        />
      )}
    </div>
  )
}
