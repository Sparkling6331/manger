import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Search, Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { db } from '../db'
import { calcNutrition, round } from '../utils'
import { OFF_LIMIT_KEY, OFF_LIMIT_DEFAULT } from '../pages/Profile'
import type { Food, Recipe } from '../types'

type FoodItem = { type: 'food'; data: Food } | { type: 'recipe'; data: Recipe }
type Mode = 'search' | 'quantity' | 'manual' | 'off'
type ManualUnit = '100g' | 'portion'

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
    portionLabel?: string
    proteins: number
    fats: number
    carbs: number
    calories: number
  }) => void
  onClose: () => void
}

async function searchOFF(query: string, limit: number): Promise<OFFProduct[]> {
  const q = query.trim()
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(q + '*')}` +
    `&search_simple=1&action=process&json=1` +
    `&page_size=${limit}&fields=product_name,brands,nutriments`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  const data = await res.json()
  return (data.products ?? [])
    .filter(
      (p: OFFProduct) =>
        p.product_name &&
        ((p.nutriments?.['energy-kcal_100g'] ?? 0) > 0 ||
         (p.nutriments?.proteins_100g ?? 0) > 0)
    )
    .slice(0, limit)
}

export default function FoodSearch({ onAdd, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [quantity, setQuantity] = useState('')
  const [mode, setMode] = useState<Mode>('search')
  const [manual, setManual] = useState<ManualForm>({ name: '', calories: 0, proteins: 0, carbs: 0, fats: 0 })
  const [manualQty, setManualQty] = useState('100')
  const [manualUnit, setManualUnit] = useState<ManualUnit>('100g')
  const [portionLabel, setPortionLabel] = useState('portion')
  const [portionWeight, setPortionWeight] = useState('')
  const [offResults, setOffResults] = useState<OFFProduct[]>([])
  const [offLoading, setOffLoading] = useState(false)
  const [offError, setOffError] = useState<string | null>(null)
  const [fromOFF, setFromOFF] = useState(false)

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

  // ── handlers ──────────────────────────────────────────

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
      onAdd({
        foodId: selected.data.id,
        foodName: selected.data.name,
        quantity: qty,
        baseUnit: selected.data.unit,
        portionLabel: selected.data.portionLabel,
        ...calcNutrition(selected.data, qty),
      })
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
    setManualUnit('100g')
    setPortionLabel('portion')
    setPortionWeight('')
    setFromOFF(false)
    setMode('manual')
  }

  async function handleOFFSearch() {
    if (!manual.name.trim()) return
    setOffLoading(true)
    setOffError(null)
    setOffResults([])
    setMode('off')
    try {
      const limit = parseInt(localStorage.getItem(OFF_LIMIT_KEY) ?? String(OFF_LIMIT_DEFAULT))
      const localCount = await db.offProducts.count()
      if (localCount > 0) {
        const q = manual.name.trim().toLowerCase()
        const local = await db.offProducts
          .where('nameLower')
          .startsWith(q)
          .limit(limit)
          .toArray()
        setOffResults(local.map(p => ({
          product_name: p.name,
          brands: p.brands,
          nutriments: {
            'energy-kcal_100g': p.calories,
            proteins_100g: p.proteins,
            carbohydrates_100g: p.carbs,
            fat_100g: p.fats,
          },
        })))
      } else {
        setOffResults(await searchOFF(manual.name, limit))
      }
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
    setFromOFF(true)
    setMode('manual')
  }

  async function handleAddManual() {
    const isPortion = manualUnit === 'portion'
    const pLabel = isPortion ? (portionLabel.trim() || 'portion') : undefined
    const pWeight = isPortion ? (parseFloat(portionWeight) || 100) : 100

    let qty: number
    let baseUnit: number
    let ratio: number

    if (isPortion) {
      qty = parseFloat(manualQty) || 1
      baseUnit = 1
      ratio = (qty * pWeight) / 100
    } else {
      qty = parseFloat(manualQty) || 100
      baseUnit = 100
      ratio = qty / 100
    }

    if (fromOFF && manual.name.trim()) {
      const name = manual.name.trim()
      const existing = await db.foods.where('name').equals(name).count()
      if (existing === 0) {
        const portionRatio = pWeight / 100
        await db.foods.add({
          id: Date.now(),
          name,
          unit: isPortion ? 1 : 100,
          portionLabel: pLabel,
          calories: isPortion ? round(manual.calories * portionRatio) : manual.calories,
          proteins: isPortion ? round(manual.proteins * portionRatio) : manual.proteins,
          carbs: isPortion ? round(manual.carbs * portionRatio) : manual.carbs,
          fats: isPortion ? round(manual.fats * portionRatio) : manual.fats,
          category: 'off',
        })
      }
    }

    onAdd({
      foodName: manual.name.trim() || 'Aliment personnalisé',
      quantity: qty,
      baseUnit,
      portionLabel: pLabel,
      calories: round(manual.calories * ratio),
      proteins: round(manual.proteins * ratio),
      carbs: round(manual.carbs * ratio),
      fats: round(manual.fats * ratio),
    })
    onClose()
  }

  // ── previews ───────────────────────────────────────────

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
    if (manualUnit === 'portion') {
      const portions = parseFloat(manualQty) || 1
      const pGrams = parseFloat(portionWeight) || 100
      const ratio = (portions * pGrams) / 100
      return { calories: round(manual.calories * ratio), proteins: round(manual.proteins * ratio), carbs: round(manual.carbs * ratio), fats: round(manual.fats * ratio) }
    }
    const qty = parseFloat(manualQty) || 100
    const ratio = qty / 100
    return { calories: round(manual.calories * ratio), proteins: round(manual.proteins * ratio), carbs: round(manual.carbs * ratio), fats: round(manual.fats * ratio) }
  }, [manual, manualQty, manualUnit, portionWeight])

  function foodUnitLabel(food: Food): string {
    if (food.portionLabel) return food.portionLabel
    return food.unit === 1 ? 'unité(s)' : 'g'
  }

  function foodRefLabel(food: Food): string {
    if (food.portionLabel) return `1 ${food.portionLabel}`
    return food.unit === 1 ? '1 unité' : `${food.unit}g`
  }

  function foodCalLabel(food: Food): string {
    if (food.portionLabel) return food.portionLabel
    return food.unit === 1 ? 'unité' : `${food.unit}g`
  }

  // ── shared sub-components ──────────────────────────────

  function MacroGrid({ cal, prot, carbs, fats }: { cal: number; prot: number; carbs: number; fats: number }) {
    return (
      <div className="bg-green-50 rounded-2xl p-4 grid grid-cols-4 gap-1 text-center">
        {[
          { val: Math.round(cal), label: 'kcal' },
          { val: prot, label: 'prot.' },
          { val: carbs, label: 'gluc.' },
          { val: fats, label: 'lip.' },
        ].map(({ val, label }) => (
          <div key={label}>
            <p className="text-base font-bold text-gray-800">{val}</p>
            <p className="text-[11px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    )
  }

  function ActionBar({ onBack, onConfirm }: { onBack: () => void; onConfirm: () => void }) {
    return (
      <div
        className="shrink-0 px-4 pt-3 border-t border-gray-100 flex gap-3 bg-white"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={onBack}
          className="px-5 py-4 rounded-2xl border border-gray-200 text-sm text-gray-600 font-medium active:bg-gray-50"
        >
          Retour
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-4 rounded-2xl bg-green-600 active:bg-green-700 text-white text-base font-semibold"
        >
          Ajouter
        </button>
      </div>
    )
  }

  function SheetHeader({ onBack, title }: { onBack: () => void; title?: string }) {
    return (
      <div className="flex items-center gap-1 px-3 py-2.5 border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="text-gray-400 p-2 active:bg-gray-100 rounded-xl">
          <ChevronLeft size={22} />
        </button>
        {title && <span className="text-base font-semibold text-gray-800 flex-1 truncate">{title}</span>}
        <button onClick={onClose} className="text-gray-400 p-2 active:bg-gray-100 rounded-xl">
          <X size={20} />
        </button>
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[55] bg-black/40" onClick={onClose} />

      {/* Bottom sheet on mobile, centered modal on desktop */}
      <div className={[
        'fixed z-[60] bg-white flex flex-col overflow-hidden',
        'bottom-0 inset-x-0 rounded-t-3xl h-[92dvh]',
        'shadow-[0_-2px_24px_rgba(0,0,0,0.12)]',
        'sm:inset-auto sm:top-1/2 sm:left-1/2',
        'sm:-translate-x-1/2 sm:-translate-y-1/2',
        'sm:w-full sm:max-w-lg sm:rounded-2xl sm:shadow-xl',
        'sm:h-auto sm:max-h-[90dvh]',
      ].join(' ')}>

        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 shrink-0 sm:hidden">
          <div className="w-9 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* ── SEARCH ── */}
        {mode === 'search' && (
          <>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 shrink-0">
              <Search size={19} className="text-gray-400 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Rechercher un aliment…"
                className="flex-1 outline-none text-base min-w-0"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button onClick={onClose} className="text-gray-400 p-2 -mr-1 active:bg-gray-100 rounded-xl shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {query.length < 2 && (
                <p className="text-center text-sm text-gray-400 py-12">Tapez au moins 2 caractères…</p>
              )}
              {query.length >= 2 && results.length === 0 && (
                <div className="py-12 px-6 text-center space-y-5">
                  <p className="text-sm text-gray-400">Aucun résultat pour « {query} »</p>
                  <button
                    onClick={openManual}
                    className="flex items-center gap-2 mx-auto bg-green-600 text-white text-sm font-semibold px-5 py-3.5 rounded-2xl"
                  >
                    <Plus size={16} /> Saisir manuellement
                  </button>
                </div>
              )}

              {results.map((item, i) => {
                const isRecipe = item.type === 'recipe'
                const cal = isRecipe
                  ? `${item.data.per100g.calories} kcal/100g`
                  : `${(item.data as Food).calories} kcal/${foodCalLabel(item.data as Food)}`
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-50 active:bg-gray-50 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-gray-800 truncate">{item.data.name}</p>
                      <p className="text-sm text-gray-400 mt-0.5">{cal}</p>
                    </div>
                    {isRecipe
                      ? <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">recette</span>
                      : <ChevronRight size={17} className="text-gray-300 shrink-0" />
                    }
                  </button>
                )
              })}

              {results.length > 0 && (
                <button
                  onClick={openManual}
                  className="w-full flex items-center gap-2 justify-center px-5 py-4 text-sm text-gray-400 active:bg-gray-50 border-t border-gray-100"
                >
                  <Plus size={14} /> Saisir un aliment non listé
                </button>
              )}
            </div>
          </>
        )}

        {/* ── QUANTITY ── */}
        {mode === 'quantity' && selected && (
          <>
            <SheetHeader onBack={() => setMode('search')} title={selected.data.name} />

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <p className="text-sm text-gray-400 text-center leading-relaxed">
                {selected.type === 'food'
                  ? `${foodRefLabel(selected.data)} : ${selected.data.calories} kcal · P:${selected.data.proteins}g G:${selected.data.carbs}g L:${selected.data.fats}g`
                  : `100g : ${selected.data.per100g.calories} kcal · P:${selected.data.per100g.proteins}g G:${selected.data.per100g.carbs}g L:${selected.data.per100g.fats}g`
                }
              </p>

              <div className="flex items-center justify-center gap-4">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  className="w-36 border-2 border-gray-200 focus:border-green-400 rounded-2xl px-4 py-4 text-center text-4xl font-bold outline-none transition-colors"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
                <span className="text-lg text-gray-500 font-medium">
                  {selected.type === 'food' ? foodUnitLabel(selected.data) : 'g'}
                </span>
              </div>

              {preview && (
                <MacroGrid cal={preview.calories} prot={preview.proteins} carbs={preview.carbs} fats={preview.fats} />
              )}
            </div>

            <ActionBar onBack={() => setMode('search')} onConfirm={handleAddSelected} />
          </>
        )}

        {/* ── MANUAL ── */}
        {mode === 'manual' && (
          <>
            <SheetHeader onBack={() => setMode('search')} title="Saisie manuelle" />

            <div className="overflow-y-auto flex-1 px-4 py-5 space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nom</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3.5 mt-1.5 text-base"
                  value={manual.name}
                  onChange={e => setManual(m => ({ ...m, name: e.target.value }))}
                />
              </div>

              <button
                onClick={handleOFFSearch}
                className="w-full flex items-center justify-center gap-2 py-3.5 border border-dashed border-green-300 rounded-2xl text-sm text-green-700 active:bg-green-50 font-medium"
              >
                <Search size={15} /> Rechercher sur Open Food Facts
              </button>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Valeurs pour 100g
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'calories' as const, label: 'Calories', unit: 'kcal' },
                    { key: 'proteins' as const, label: 'Protéines', unit: 'g' },
                    { key: 'carbs' as const, label: 'Glucides', unit: 'g' },
                    { key: 'fats' as const, label: 'Lipides', unit: 'g' },
                  ].map(({ key, label, unit }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500">{label}</label>
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          className="flex-1 border border-gray-200 rounded-xl px-2 py-3 text-base text-center min-w-0"
                          value={manual[key] || ''}
                          onChange={e => setManual(m => ({ ...m, [key]: parseFloat(e.target.value) || 0 }))}
                        />
                        <span className="text-xs text-gray-400 shrink-0 w-7">{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Type de portion
                </label>
                <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setManualUnit('100g'); setManualQty('100') }}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${manualUnit === '100g' ? 'bg-green-600 text-white' : 'text-gray-600 active:bg-gray-50'}`}
                  >
                    Pour 100g
                  </button>
                  <button
                    type="button"
                    onClick={() => { setManualUnit('portion'); setManualQty('1') }}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${manualUnit === 'portion' ? 'bg-green-600 text-white' : 'text-gray-600 active:bg-gray-50'}`}
                  >
                    Par portion
                  </button>
                </div>
              </div>

              {manualUnit === 'portion' && (
                <div className="grid grid-cols-2 gap-3 bg-green-50 rounded-2xl p-4">
                  <div>
                    <label className="text-xs text-gray-500">Nom de la portion</label>
                    <input
                      type="text"
                      placeholder="part, tranche…"
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 mt-1 text-base bg-white"
                      value={portionLabel}
                      onChange={e => setPortionLabel(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Poids (g)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="ex : 150"
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 mt-1 text-base bg-white text-center"
                      value={portionWeight}
                      onChange={e => setPortionWeight(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quantité à ajouter</label>
                <div className="flex items-center gap-3 mt-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-28 border border-gray-200 rounded-xl px-3 py-3 text-base text-center"
                    value={manualQty}
                    onChange={e => setManualQty(e.target.value)}
                  />
                  <span className="text-base text-gray-500">
                    {manualUnit === 'portion' ? (portionLabel.trim() || 'portion') : 'g'}
                  </span>
                </div>
              </div>

              {(manual.calories > 0 || manual.proteins > 0) && (
                <MacroGrid cal={manualPreview.calories} prot={manualPreview.proteins} carbs={manualPreview.carbs} fats={manualPreview.fats} />
              )}
            </div>

            <ActionBar onBack={() => setMode('search')} onConfirm={handleAddManual} />
          </>
        )}

        {/* ── OPEN FOOD FACTS ── */}
        {mode === 'off' && (
          <>
            <SheetHeader onBack={() => setMode('manual')} title="Open Food Facts" />

            <div className="overflow-y-auto flex-1">
              {offLoading && (
                <div className="flex items-center justify-center gap-2 py-14 text-gray-400">
                  <Loader2 size={22} className="animate-spin" />
                  <span className="text-sm">Recherche en cours…</span>
                </div>
              )}
              {!offLoading && offError && (
                <div className="text-center py-12 px-6 space-y-4">
                  <p className="text-sm text-red-500">Impossible de contacter Open Food Facts.</p>
                  <p className="text-xs text-gray-400">{offError}</p>
                  <button onClick={() => setMode('manual')} className="text-sm text-green-600 font-medium py-2">
                    ← Saisir manuellement
                  </button>
                </div>
              )}
              {!offLoading && !offError && offResults.length === 0 && (
                <div className="text-center py-12 space-y-4">
                  <p className="text-sm text-gray-400">Aucun produit trouvé.</p>
                  <button onClick={() => setMode('manual')} className="text-sm text-green-600 font-medium py-2">
                    ← Saisir manuellement
                  </button>
                </div>
              )}
              {offResults.map((p, i) => {
                const n = p.nutriments
                const cal = Math.round(n['energy-kcal_100g'] ?? 0)
                const prot = round(n.proteins_100g ?? 0)
                const carbs = round(n.carbohydrates_100g ?? 0)
                const fats = round(n.fat_100g ?? 0)
                return (
                  <button
                    key={i}
                    onClick={() => applyOFF(p)}
                    className="w-full px-5 py-4 border-b border-gray-50 active:bg-gray-50 text-left"
                  >
                    <p className="text-[15px] font-medium text-gray-800 truncate">
                      {p.product_name}
                      {p.brands && <span className="font-normal text-gray-400"> — {p.brands}</span>}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">
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
