import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, ExternalLink, BookmarkCheck, Eraser, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../db'
import { today, formatDateLong, sumEntries, round } from '../utils'
import { MEAL_META, MEAL_ORDER, type MealType, type MealEntry } from '../types'
import MacroProgress from '../components/MacroProgress'
import FoodSearch from '../components/FoodSearch'

export default function Today() {
  const [currentDate, setCurrentDate] = useState(today)
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null)
  const [saved, setSaved] = useState(false)
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null)
  const [editQty, setEditQty] = useState('')
  const [replacingEntry, setReplacingEntry] = useState<MealEntry | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const profile = useLiveQuery(() => db.profile.get(1))
  const entries = useLiveQuery(() => db.mealEntries.where('date').equals(currentDate).toArray(), [currentDate])

  const totals = sumEntries(entries ?? [])
  const goals = profile?.goals ?? { calories: 2542, proteins: 95, fats: 99, carbs: 318 }

  function navigateDate(delta: number) {
    setCurrentDate(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + delta)
      return d.toISOString().slice(0, 10)
    })
  }

  async function handleAddEntry(meal: MealType, data: Omit<MealEntry, 'id' | 'date' | 'meal'>) {
    await db.mealEntries.add({ ...data, date: currentDate, meal })
    setAddingMeal(null)
  }

  async function handleDelete(id: number) {
    await db.mealEntries.delete(id)
  }

  function openEdit(entry: MealEntry) {
    setEditingEntry(entry)
    setEditQty(String(entry.quantity))
  }

  async function handleSaveEdit() {
    if (!editingEntry) return
    const qty = parseFloat(editQty)
    if (!qty || qty <= 0) return
    const factor = qty / editingEntry.quantity
    await db.mealEntries.update(editingEntry.id!, {
      quantity: qty,
      calories: round(editingEntry.calories * factor),
      proteins: round(editingEntry.proteins * factor),
      carbs:    round(editingEntry.carbs    * factor),
      fats:     round(editingEntry.fats     * factor),
    })
    setEditingEntry(null)
  }

  async function handleReplaceEntry(old: MealEntry, data: Omit<MealEntry, 'id' | 'date' | 'meal'>) {
    await db.mealEntries.delete(old.id!)
    await db.mealEntries.add({ ...data, date: currentDate, meal: old.meal })
    setReplacingEntry(null)
  }

  async function toggleExternal(entry: MealEntry) {
    await db.mealEntries.update(entry.id!, { isExternal: !entry.isExternal })
  }

  async function handleSaveHistory() {
    if (!entries?.length) return
    const t = sumEntries(entries)
    const existing = await db.history.where('date').equals(currentDate).first()
    if (existing) {
      await db.history.update(existing.id!, t)
    } else {
      await db.history.add({ date: currentDate, ...t })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleClearToday() {
    if (!window.confirm('Effacer tous les aliments du jour ?')) return
    const ids = (entries ?? []).map(e => e.id!)
    await db.mealEntries.bulkDelete(ids)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="pt-2 flex items-center gap-2">
        <button
          onClick={() => navigateDate(-1)}
          className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          className="flex-1 text-left"
          onClick={() => dateInputRef.current?.showPicker()}
        >
          <h1 className="text-xl font-bold text-gray-800 capitalize">{formatDateLong(currentDate)}</h1>
        </button>
        <input
          ref={dateInputRef}
          type="date"
          className="sr-only"
          value={currentDate}
          onChange={e => e.target.value && setCurrentDate(e.target.value)}
        />
        <button
          onClick={() => navigateDate(1)}
          className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
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
                <button className="flex-1 min-w-0 text-left" onClick={() => openEdit(entry)}>
                  <p className="text-sm text-gray-800 truncate">{entry.foodName}</p>
                  <p className="text-xs text-gray-400">
                    {entry.quantity}{entry.baseUnit === 1 ? 'u' : 'g'} · {Math.round(entry.calories)} kcal
                    {' · '}P:{entry.proteins}g G:{entry.carbs}g L:{entry.fats}g
                  </p>
                </button>
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

      {/* Day actions */}
      {(entries ?? []).length > 0 && (
        <div className="flex gap-2 pb-4">
          <button
            onClick={handleSaveHistory}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-colors ${
              saved
                ? 'bg-green-100 text-green-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <BookmarkCheck size={16} />
            {saved ? 'Enregistré ✓' : "Enregistrer dans l'historique"}
          </button>
          <button
            onClick={handleClearToday}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-2xl text-sm font-semibold transition-colors"
          >
            <Eraser size={16} />
            Effacer
          </button>
        </div>
      )}

      {/* Edit entry modal */}
      {editingEntry && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/50" onClick={() => setEditingEntry(null)} />
          <div className="fixed inset-0 z-[60] bg-white flex flex-col sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-80 sm:rounded-2xl sm:shadow-xl">
            <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100 shrink-0">
              <p className="flex-1 font-semibold text-gray-800 truncate">{editingEntry.foodName}</p>
              <button onClick={() => setEditingEntry(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 shrink-0">Quantité</label>
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-xl font-bold text-center"
                  value={editQty}
                  onChange={e => setEditQty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                />
                <span className="text-gray-400 shrink-0">{editingEntry.baseUnit === 1 ? 'u' : 'g'}</span>
              </div>
              {parseFloat(editQty) > 0 && (() => {
                const f = parseFloat(editQty) / editingEntry.quantity
                return (
                  <div className="bg-green-50 rounded-xl p-3 flex justify-between text-sm text-gray-700">
                    <span><strong>{Math.round(editingEntry.calories * f)}</strong> kcal</span>
                    <span>P:<strong>{round(editingEntry.proteins * f)}g</strong></span>
                    <span>G:<strong>{round(editingEntry.carbs * f)}g</strong></span>
                    <span>L:<strong>{round(editingEntry.fats * f)}g</strong></span>
                  </div>
                )
              })()}
              <div className="flex gap-3">
                <button
                  onClick={() => { setReplacingEntry(editingEntry); setEditingEntry(null) }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
                >
                  Changer l'aliment
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {(addingMeal || replacingEntry) && (
        <FoodSearch
          onAdd={data => replacingEntry
            ? handleReplaceEntry(replacingEntry, data)
            : handleAddEntry(addingMeal!, data)
          }
          onClose={() => { setAddingMeal(null); setReplacingEntry(null) }}
        />
      )}
    </div>
  )
}
