import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Search, Plus, ChevronLeft, Loader2 } from 'lucide-react'
import { db } from '../db'
import { calcNutrition, round } from '../utils'
import type { Food, Recipe } from '../types'

type FoodItem = { type: 'food'; data: Food } | { type: 'recipe'; data: Recipe }
type Mode = 'search' | 'quantity' | 'manual' | 'off'

interface OFFProduct {
  product_name: string
  brands?: string
  nutriments: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
  }
}

interface ManualForm {
  name: string
  calories: number
  proteins: number
  carbs: number
  fats: number
}

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

async function searchOFF(query: string): Promise<OFFProduct[]> {
  const url =
    `https://world.openfoodfacts.net/api/v2/search` +
    `?q=${encodeURIComponent(query)}&page_size=10` +
    `&fields=product_name,brands,nutriments`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  const data = await res.json()
  return (data.products ?? []).filter(
    (p: OFFProduct) =>
      p.product_name?.trim() &&
      ((p.nutriments?.['energy-kcal_100g'] ?? 0) > 0 ||
       (p.nutriments?.proteins_100g ?? 0) > 0)
  )
}

export default function FoodSearch({ onAdd, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [quantity, setQuantity] = useState('')
  const [mode, setMode] = useState<Mode>('search')
  const [manual, setManual] = useState<ManualForm>({ name: '', calories: 0, proteins: 0, carbs: 0, fats: 0 })
  const [manualQty, setManualQty] = useState('100')
  const [offResults, setOffResults] = useState<OFFProduct[]>([])
  const [offLoading, setOffLoading] = useState(false)
  const [offError, setOffError] = useState<string | null>(null)

  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return []
    const q = query.toLowerCase()
    const foodResults: FoodItem[] = (foods ?? [])
      .filter(f => f.name.toLowerCase().includes(q))
      .slice(0, 15)
      .map(f => ({ type: 'food' as const, data: f }))
    const recipeResults: FoodItem[] = (recipes ?? [])
      .filter(r => r.name.toLowerCase().includes(q))
      .map(r => ({ type: 'recipe' as const, data: r }))
    return [...recipeResults, ...foodResults]
  }, [query, foods, recipes])

  // ── handlers ──────────────────────────────────────────────

  function handleSelect(item: FoodItem) {
    setSelected(item)
    setQuantity(String(item.type === 'food' ? item.data.unit : 100))
    setMode('quantity')
  }

  function handleAddSelected() {
    if (!selected) return
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) return
    if (selected.type === 'food') {
      onAdd({ foodId: selected.data.id, foodName: selected.data.name, quantity: qty, baseUnit: selected.data.unit, ...calcNutrition(selected.data, qty) })
    } else {
      const r = selected.data
      const ratio = qty / 100
      onAdd({ recipeId: r.id, foodName: r.name, quantity: qty, baseUnit: 100, proteins: round(r.per100g.proteins * ratio), fats: round(r.per100g.fats * ratio), carbs: round(r.per100g.carbs * ratio), calories: round(r.per100g.calories * ratio) })
    }
    onClose()
  }

  function openManual() {
    setManual({ name: query, calories: 0, proteins: 0, carbs: 0, fats: 0 })
    setManualQty('100')
    setMode('manual')
  }

  async function handleOFFSearch() {
    if (!manual.name.trim()) return
    setOffLoading(true)
    setOffError(null)
    setOffResults([])
    setMode('off')
    try {
      setOffResults(await searchOFF(manual.name))
    } catch (e) {
      setOffError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setOffLoading(false)
    }
  }

  function applyOFF(p: OFFProduct) {
    const n = p.nutriments
    setManual({
      name: p.product_name,
      calories: Math.round(n['energy-kcal_100g'] ?? 0),
      proteins: round(n.proteins_100g ?? 0),
      carbs: round(n.carbohydrates_100g ?? 0),
      fats: round(n.fat_100g ?? 0),
    })
    setMode('manual')
  }

  function handleAddManual() {
    const qty = parseFloat(manualQty) || 100
    const ratio = qty / 100
    onAdd({
      foodName: manual.name.trim() || 'Aliment personnalisé',
      quantity: qty,
      baseUnit: 100,
      calories: round(manual.calories * ratio),
      proteins: round(manual.proteins * ratio),
      carbs: round(manual.carbs * ratio),
      fats: round(manual.fats * ratio),
    })
    onClose()
  }

  // ── preview for quantity mode ──────────────────────────────

  const preview = useMemo(() => {
    if (!selected || !quantity) return null
    const qty = parseFloat(quantity)
    if (!qty) return null
    if (selected.type === 'food') return calcNutrition(selected.data, qty)
    const r = selected.data
    const ratio = qty / 100
    return { proteins: round(r.per100g.proteins * ratio), fats: round(r.per100g.fats * ratio), carbs: round(r.per100g.carbs * ratio), calories: round(r.per100g.calories * ratio) }
  }, [selected, quantity])

  const manualPreview = useMemo(() => {
    const qty = parseFloat(manualQty) || 100
    const ratio = qty / 100
    return { calories: round(manual.calories * ratio), proteins: round(manual.proteins * ratio), carbs: round(manual.carbs * ratio), fats: round(manual.fats * ratio) }
  }, [manual, manualQty])

  const unitLabel = selected?.type === 'food' ? (selected.data.unit === 1 ? 'unité(s)' : 'g') : 'g'

  // ── render ─────────────────────────────────────────────────

  return (
    <>
    {/* Backdrop — inset-0 dims the page; z-[55] sits above NavBar (z-50) */}
    <div className="fixed inset-0 z-[55] bg-black/50" onClick={onClose} />

    {/* Sheet — fixed bottom-0 so iOS pushes it above the keyboard like the NavBar */}
    <div className={[
      'fixed bottom-0 left-0 right-0 z-[60]',
      'bg-white rounded-t-2xl',
      'max-h-[85dvh] flex flex-col overflow-hidden',
      // desktop: centered dialog
      'sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2',
      'sm:-translate-x-1/2 sm:-translate-y-1/2',
      'sm:w-full sm:max-w-lg sm:rounded-2xl sm:shadow-xl sm:max-h-[90dvh]',
    ].join(' ')}>

        {/* ── SEARCH ── */}
        {mode === 'search' && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Rechercher un aliment…"
                className="flex-1 outline-none text-sm min-w-0"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button onClick={onClose} className="text-gray-400 p-1 shrink-0"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {query.length < 2 && (
                <p className="text-center text-sm text-gray-400 py-8">Tapez au moins 2 caractères…</p>
              )}
              {query.length >= 2 && results.length === 0 && (
                <div className="py-8 px-4 text-center space-y-3">
                  <p className="text-sm text-gray-400">Aucun résultat pour « {query} »</p>
                  <button onClick={openManual}
                    className="flex items-center gap-2 mx-auto bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
                    <Plus size={15} /> Saisir manuellement
                  </button>
                </div>
              )}
              {results.map((item, i) => {
                const isRecipe = item.type === 'recipe'
                const cal = isRecipe
                  ? `${item.data.per100g.calories} kcal/100g`
                  : `${item.data.calories} kcal/${item.data.unit === 1 ? 'unité' : `${item.data.unit}g`}`
                return (
                  <button key={i} onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 text-left">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{item.data.name}</p>
                      <p className="text-xs text-gray-400">{cal}</p>
                    </div>
                    {isRecipe && <span className="shrink-0 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">recette</span>}
                  </button>
                )
              })}
              {results.length > 0 && (
                <button onClick={openManual}
                  className="w-full flex items-center gap-1.5 justify-center px-4 py-3 text-xs text-gray-400 hover:bg-gray-50 border-t border-gray-100">
                  <Plus size={13} /> Saisir un aliment non listé
                </button>
              )}
            </div>
          </>
        )}

        {/* ── QUANTITY ── */}
        {mode === 'quantity' && selected && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
              <button onClick={() => setMode('search')} className="text-gray-400 p-1 -ml-1"><ChevronLeft size={20} /></button>
              <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{selected.data.name}</span>
              <button onClick={onClose} className="text-gray-400 p-1 shrink-0"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-gray-400">
                {selected.type === 'food'
                  ? `Valeurs pour ${selected.data.unit}${selected.data.unit === 1 ? ' unité' : 'g'} : ${selected.data.calories} kcal · P:${selected.data.proteins}g G:${selected.data.carbs}g L:${selected.data.fats}g`
                  : `Valeurs pour 100g : ${selected.data.per100g.calories} kcal · P:${selected.data.per100g.proteins}g G:${selected.data.per100g.carbs}g L:${selected.data.per100g.fats}g`}
              </p>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 shrink-0">Quantité</label>
                <input autoFocus type="number" inputMode="decimal"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-center text-xl font-bold"
                  value={quantity} onChange={e => setQuantity(e.target.value)} />
                <span className="text-sm text-gray-500 shrink-0">{unitLabel}</span>
              </div>
              {preview && (
                <div className="bg-green-50 rounded-xl p-3 flex justify-between text-sm text-gray-700">
                  <span><strong>{Math.round(preview.calories)}</strong> kcal</span>
                  <span>P:<strong>{preview.proteins}g</strong></span>
                  <span>G:<strong>{preview.carbs}g</strong></span>
                  <span>L:<strong>{preview.fats}g</strong></span>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setMode('search')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Retour</button>
                <button onClick={handleAddSelected} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold">Ajouter</button>
              </div>
            </div>
          </>
        )}

        {/* ── MANUAL ── */}
        {mode === 'manual' && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
              <button onClick={() => setMode('search')} className="text-gray-400 p-1 -ml-1"><ChevronLeft size={20} /></button>
              <span className="text-sm font-semibold text-gray-800 flex-1">Saisie manuelle</span>
              <button onClick={onClose} className="text-gray-400 p-1 shrink-0"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500">Nom de l'aliment</label>
                <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
                  value={manual.name} onChange={e => setManual(m => ({ ...m, name: e.target.value }))} />
              </div>
              <button onClick={handleOFFSearch}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-green-300 rounded-xl text-sm text-green-700 hover:bg-green-50">
                <Search size={14} /> Rechercher sur Open Food Facts
              </button>
              <p className="text-xs text-gray-400 text-center -mt-1">Valeurs nutritionnelles pour 100g</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'calories' as const, label: 'Calories', unit: 'kcal' },
                  { key: 'proteins' as const, label: 'Protéines', unit: 'g' },
                  { key: 'carbs' as const, label: 'Glucides', unit: 'g' },
                  { key: 'fats' as const, label: 'Lipides', unit: 'g' },
                ].map(({ key, label, unit }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500">{label}</label>
                    <div className="flex items-center gap-1 mt-1">
                      <input type="number" inputMode="decimal"
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center min-w-0"
                        value={manual[key] || ''}
                        onChange={e => setManual(m => ({ ...m, [key]: parseFloat(e.target.value) || 0 }))} />
                      <span className="text-xs text-gray-400 shrink-0">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500">Quantité à ajouter</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="number" inputMode="decimal"
                    className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center"
                    value={manualQty} onChange={e => setManualQty(e.target.value)} />
                  <span className="text-sm text-gray-500">g</span>
                </div>
              </div>
              {(manual.calories > 0 || manual.proteins > 0) && (
                <div className="bg-green-50 rounded-xl p-3 flex justify-between text-sm text-gray-700">
                  <span><strong>{Math.round(manualPreview.calories)}</strong> kcal</span>
                  <span>P:<strong>{manualPreview.proteins}g</strong></span>
                  <span>G:<strong>{manualPreview.carbs}g</strong></span>
                  <span>L:<strong>{manualPreview.fats}g</strong></span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setMode('search')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Retour</button>
                <button onClick={handleAddManual} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold">Ajouter</button>
              </div>
            </div>
          </>
        )}

        {/* ── OPEN FOOD FACTS ── */}
        {mode === 'off' && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
              <button onClick={() => setMode('manual')} className="text-gray-400 p-1 -ml-1"><ChevronLeft size={20} /></button>
              <span className="text-sm font-semibold text-gray-800 flex-1">Open Food Facts</span>
              <button onClick={onClose} className="text-gray-400 p-1 shrink-0"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {offLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Recherche en cours…</span>
                </div>
              )}
              {!offLoading && offError && (
                <div className="text-center py-8 px-4 space-y-3">
                  <p className="text-sm text-red-500">Impossible de contacter Open Food Facts.</p>
                  <p className="text-xs text-gray-400">{offError}</p>
                  <button onClick={() => setMode('manual')} className="text-sm text-green-600 font-medium">← Saisir manuellement</button>
                </div>
              )}
              {!offLoading && !offError && offResults.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-gray-400">Aucun produit trouvé.</p>
                  <button onClick={() => setMode('manual')} className="text-sm text-green-600 font-medium">← Saisir manuellement</button>
                </div>
              )}
              {offResults.map((p, i) => {
                const n = p.nutriments
                const cal = Math.round(n['energy-kcal_100g'] ?? 0)
                const prot = round(n.proteins_100g ?? 0)
                const carbs = round(n.carbohydrates_100g ?? 0)
                const fats = round(n.fat_100g ?? 0)
                return (
                  <button key={i} onClick={() => applyOFF(p)}
                    className="w-full px-4 py-3 border-b border-gray-50 hover:bg-gray-50 text-left">
                    <p className="text-sm text-gray-800 truncate">
                      {p.product_name}{p.brands ? <span className="text-gray-400"> — {p.brands}</span> : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      {cal} kcal · P:{prot}g · G:{carbs}g · L:{fats}g <span className="text-gray-300">/ 100g</span>
                    </p>
                  </button>
                )
              })}
            </div>
          </>
        )}

    </div>
    </>
  )
}
