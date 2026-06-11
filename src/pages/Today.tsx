import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useSwipe } from '../hooks/useSwipe'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, BookmarkCheck, Eraser, X, ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { db } from '../db'
import { today, formatDateLong, sumEntries, round, vibrate } from '../utils'
import SwipeableRow from '../components/SwipeableRow'
import { MEAL_META, MEAL_ORDER, type MealType, type MealEntry } from '../types'
import MacroProgress from '../components/MacroProgress'
import FoodSearch from '../components/FoodSearch'

export default function Today() {
  const location = useLocation()
  const [currentDate, setCurrentDate] = useState<string>(
    () => (location.state as { date?: string } | null)?.date ?? today()
  )
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null)
  const [saved, setSaved] = useState(false)
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editMeal, setEditMeal] = useState<MealType>('breakfast')
  const [replacingEntry, setReplacingEntry] = useState<MealEntry | null>(null)
  const [swipedId, setSwipedId] = useState<number | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const dateSwipe = useSwipe({
    onSwipeLeft: () => navigateDate(1),
    onSwipeRight: () => navigateDate(-1),
  })
  const editSwipe = useSwipe({ onSwipeRight: () => setEditingEntry(null) })

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
    vibrate()
  }

  async function handleCopyFromPrevious() {
    const prev = new Date(currentDate)
    prev.setDate(prev.getDate() - 1)
    const prevDate = prev.toISOString().slice(0, 10)
    const prevEntries = await db.mealEntries.where('date').equals(prevDate).toArray()
    if (!prevEntries.length) { alert('Aucun repas enregistré la veille.'); return }
    await db.mealEntries.bulkAdd(
      prevEntries.map(({ id: _id, date: _date, ...rest }) => ({ ...rest, date: currentDate }))
    )
    vibrate()
  }

  async function handleDelete(id: number) {
    await db.mealEntries.delete(id)
  }

  function openEdit(entry: MealEntry) {
    setEditingEntry(entry)
    setEditQty(String(entry.quantity))
    setEditMeal(entry.meal)
  }

  async function handleSaveEdit() {
    if (!editingEntry) return
    const qty = parseFloat(editQty)
    if (!qty || qty <= 0) return
    const factor = qty / editingEntry.quantity
    await db.mealEntries.update(editingEntry.id!, {
      quantity: qty,
      meal: editMeal,
      calories: round(editingEntry.calories * factor),
      proteins: round(editingEntry.proteins * factor),
      carbs:    round(editingEntry.carbs    * factor),
      fats:     round(editingEntry.fats     * factor),
    })
    setEditingEntry(null)
    vibrate()
  }

  async function handleReplaceEntry(old: MealEntry, data: Omit<MealEntry, 'id' | 'date' | 'meal'>) {
    await db.mealEntries.delete(old.id!)
    await db.mealEntries.add({ ...data, date: currentDate, meal: old.meal })
    setReplacingEntry(null)
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
      <div className="pt-2 flex items-center gap-2" {...dateSwipe}>
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
      <div className="card p-4">
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
          <div key={meal} className="card overflow-hidden">
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
              <SwipeableRow
                key={entry.id}
                isOpen={swipedId === entry.id}
                onOpen={() => setSwipedId(entry.id!)}
                onClose={() => setSwipedId(null)}
                onDelete={() => handleDelete(entry.id!)}
              >
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => { setSwipedId(null); openEdit(entry) }}
                >
                  <p className="text-sm text-gray-800 truncate">{entry.foodName}</p>
                  <p className="text-xs text-gray-400">
                    {entry.quantity}{entry.portionLabel ? ` ${entry.portionLabel}` : (entry.baseUnit === 1 ? 'u' : 'g')} · {Math.round(entry.calories)} kcal
                    {' · '}P:{entry.proteins}g G:{entry.carbs}g L:{entry.fats}g
                  </p>
                </button>
              </SwipeableRow>
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

      {/* Copy from previous day — shown only when day is empty */}
      {(entries ?? []).length === 0 && (
        <button
          onClick={handleCopyFromPrevious}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400 active:bg-gray-50 transition-colors"
        >
          <Copy size={16} />
          Copier les repas de la veille
        </button>
      )}

      {/* Day actions */}
      {(entries ?? []).length > 0 && (
        <div className="flex gap-2 pb-4">
          <button
            onClick={handleSaveHistory}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-semibold transition-colors ${
              saved
                ? 'bg-green-100 text-green-700'
                : 'bg-green-600 text-white active:bg-green-700'
            }`}
          >
            <BookmarkCheck size={16} />
            {saved ? 'Enregistré ✓' : "Enregistrer dans l'historique"}
          </button>
          <button
            onClick={handleClearToday}
            className="flex items-center justify-center gap-2 px-4 py-4 bg-gray-100 text-gray-500 active:bg-red-50 active:text-red-500 rounded-2xl text-sm font-semibold transition-colors"
          >
            <Eraser size={16} />
            Effacer
          </button>
        </div>
      )}

      {/* Edit entry modal */}
      {editingEntry && (
        <>
          <div className="backdrop" onClick={() => setEditingEntry(null)} />
          <div className="sheet sm:max-w-sm" {...editSwipe}>
            <div className="drag-handle">
              <div className="w-9 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
              <p className="flex-1 font-semibold text-gray-800 truncate">{editingEntry.foodName}</p>
              <button onClick={() => setEditingEntry(null)} className="p-2 -mr-2 text-gray-400 active:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <div className="flex items-center justify-center gap-4">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  className="w-36 border-2 border-gray-200 focus:border-green-400 rounded-2xl px-4 py-4 text-4xl font-bold text-center outline-none transition-colors"
                  value={editQty}
                  onChange={e => setEditQty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                />
                <span className="text-lg text-gray-400 font-medium shrink-0">
                  {editingEntry.portionLabel ?? (editingEntry.baseUnit === 1 ? 'u' : 'g')}
                </span>
              </div>
              {parseFloat(editQty) > 0 && (() => {
                const f = parseFloat(editQty) / editingEntry.quantity
                return (
                  <div className="bg-green-50 rounded-2xl p-4 grid grid-cols-4 gap-1 text-center">
                    {[
                      { val: Math.round(editingEntry.calories * f), label: 'kcal' },
                      { val: round(editingEntry.proteins * f), label: 'prot.' },
                      { val: round(editingEntry.carbs * f), label: 'gluc.' },
                      { val: round(editingEntry.fats * f), label: 'lip.' },
                    ].map(({ val, label }) => (
                      <div key={label}>
                        <p className="text-base font-bold text-gray-800">{val}</p>
                        <p className="text-[11px] text-gray-400">{label}</p>
                      </div>
                    ))}
                  </div>
                )
              })()}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Déplacer vers</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {MEAL_ORDER.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditMeal(m)}
                      className={`py-2.5 rounded-xl flex flex-col items-center gap-0.5 transition-colors ${
                        editMeal === m
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-50 text-gray-500 active:bg-gray-100'
                      }`}
                    >
                      <span className="text-base">{MEAL_META[m].icon}</span>
                      <span className="text-[10px] font-medium leading-tight text-center px-1">{MEAL_META[m].label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setReplacingEntry(editingEntry); setEditingEntry(null) }} className="btn-secondary flex-1">
                  Changer l'aliment
                </button>
                <button onClick={handleSaveEdit} className="btn-primary flex-1">
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
