import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Search } from 'lucide-react'
import { db } from '../db'
import { calcNutrition, round } from '../utils'
import type { Food, Recipe } from '../types'

type FoodItem = { type: 'food'; data: Food } | { type: 'recipe'; data: Recipe }

interface Props {
  onAdd: (entry: {
    foodId?: number
    recipeId?: number
    foodName: string
    quantity: number
    baseUnit: number
    proteins: number
    fats: number
    carbs: number
    calories: number
  }) => void
  onClose: () => void
}

export default function FoodSearch({ onAdd, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [quantity, setQuantity] = useState('')

  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return []
    const q = query.toLowerCase()
    const foodResults: FoodItem[] = (foods ?? [])
      .filter(f => f.name.toLowerCase().includes(q))
      .slice(0, 15)
      .map(f => ({ type: 'food', data: f }))
    const recipeResults: FoodItem[] = (recipes ?? [])
      .filter(r => r.name.toLowerCase().includes(q))
      .map(r => ({ type: 'recipe', data: r }))
    return [...recipeResults, ...foodResults]
  }, [query, foods, recipes])

  function handleSelect(item: FoodItem) {
    setSelected(item)
    const defaultQty = item.type === 'food' ? item.data.unit : 100
    setQuantity(String(defaultQty))
  }

  function handleAdd() {
    if (!selected || !quantity) return
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) return

    if (selected.type === 'food') {
      const nutrition = calcNutrition(selected.data, qty)
      onAdd({
        foodId: selected.data.id,
        foodName: selected.data.name,
        quantity: qty,
        baseUnit: selected.data.unit,
        ...nutrition,
      })
    } else {
      // Recipe: per 100g values
      const r = selected.data
      const ratio = qty / 100
      onAdd({
        recipeId: r.id,
        foodName: r.name,
        quantity: qty,
        baseUnit: 100,
        proteins: round(r.per100g.proteins * ratio),
        fats: round(r.per100g.fats * ratio),
        carbs: round(r.per100g.carbs * ratio),
        calories: round(r.per100g.calories * ratio),
      })
    }
    onClose()
  }

  const unitLabel = selected?.type === 'food'
    ? (selected.data.unit === 1 ? 'unité(s)' : 'g')
    : 'g'

  const preview = useMemo(() => {
    if (!selected || !quantity) return null
    const qty = parseFloat(quantity)
    if (!qty) return null
    if (selected.type === 'food') return calcNutrition(selected.data, qty)
    const r = selected.data
    const ratio = qty / 100
    return {
      proteins: round(r.per100g.proteins * ratio),
      fats: round(r.per100g.fats * ratio),
      carbs: round(r.per100g.carbs * ratio),
      calories: round(r.per100g.calories * ratio),
    }
  }, [selected, quantity])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center">
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl sm:rounded-2xl max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-100">
          <Search size={18} className="text-gray-400" />
          <input
            autoFocus
            type="text"
            placeholder="Rechercher un aliment ou une recette…"
            className="flex-1 outline-none text-sm"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null) }}
          />
          <button onClick={onClose} className="text-gray-400 p-1"><X size={20} /></button>
        </div>

        {/* Results or quantity input */}
        {selected ? (
          <div className="p-4 space-y-4">
            <div>
              <p className="font-semibold text-gray-800">{selected.type === 'food' ? selected.data.name : selected.data.name}</p>
              <p className="text-xs text-gray-400">
                {selected.type === 'food'
                  ? `Référence : ${selected.data.calories} kcal / ${selected.data.unit}${selected.data.unit === 1 ? ' unité' : 'g'}`
                  : 'Recette – référence pour 100g'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 shrink-0">Quantité</label>
              <input
                type="number"
                inputMode="decimal"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-center text-lg font-semibold"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
              <span className="text-sm text-gray-500 shrink-0">{unitLabel}</span>
            </div>
            {preview && (
              <div className="bg-green-50 rounded-xl p-3 text-sm text-gray-700 flex justify-between">
                <span><strong>{Math.round(preview.calories)}</strong> kcal</span>
                <span>P: <strong>{preview.proteins}g</strong></span>
                <span>G: <strong>{preview.carbs}g</strong></span>
                <span>L: <strong>{preview.fats}g</strong></span>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
              >
                Retour
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold"
              >
                Ajouter
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {results.length === 0 && query.length >= 2 && (
              <p className="text-center text-sm text-gray-400 py-8">Aucun résultat pour « {query} »</p>
            )}
            {results.length === 0 && query.length < 2 && (
              <p className="text-center text-sm text-gray-400 py-8">Tapez au moins 2 caractères…</p>
            )}
            {results.map((item, i) => {
              const isRecipe = item.type === 'recipe'
              const name = isRecipe ? item.data.name : item.data.name
              const cal = isRecipe
                ? `${item.data.per100g.calories} kcal/100g`
                : `${item.data.calories} kcal/${item.data.unit}${item.data.unit === 1 ? 'u' : 'g'}`
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(item)}
                  className="w-full flex justify-between items-center px-4 py-3 border-b border-gray-50 hover:bg-gray-50 text-left"
                >
                  <div>
                    <span className="text-sm text-gray-800">{name}</span>
                    {isRecipe && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">recette</span>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">{cal}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
