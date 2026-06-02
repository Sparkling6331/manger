import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, ChevronLeft, Pencil, Search } from 'lucide-react'
import { db } from '../db'
import { useNavigate } from 'react-router-dom'
import type { Food } from '../types'

type View = 'list' | 'form'
type UnitMode = '100g' | 'portion'

interface FoodForm {
  name: string
  category: string
  unitMode: UnitMode
  portionLabel: string
  calories: string
  proteins: string
  carbs: string
  fats: string
}

const EMPTY_FORM: FoodForm = {
  name: '',
  category: 'local',
  unitMode: '100g',
  portionLabel: '',
  calories: '',
  proteins: '',
  carbs: '',
  fats: '',
}

const CATEGORY_COLORS: Record<string, string> = {
  local: 'bg-blue-50 text-blue-600',
  off:   'bg-orange-50 text-orange-600',
  recipe:'bg-green-50 text-green-700',
}

export default function Foods() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingFood, setEditingFood] = useState<Food | null>(null)
  const [form, setForm] = useState<FoodForm>(EMPTY_FORM)

  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), [])

  const filtered = useMemo(() => {
    if (!foods) return []
    if (!searchQuery.trim()) return foods
    const q = searchQuery.toLowerCase()
    return foods.filter(f => f.name.toLowerCase().includes(q))
  }, [foods, searchQuery])

  function openCreate() {
    setEditingFood(null)
    setForm(EMPTY_FORM)
    setView('form')
  }

  function openEdit(food: Food) {
    setEditingFood(food)
    setForm({
      name: food.name,
      category: food.category,
      unitMode: food.unit === 1 ? 'portion' : '100g',
      portionLabel: food.portionLabel ?? '',
      calories: String(food.calories),
      proteins: String(food.proteins),
      carbs: String(food.carbs),
      fats: String(food.fats),
    })
    setView('form')
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) return

    const unit = form.unitMode === 'portion' ? 1 : 100
    const portionLabel = form.unitMode === 'portion' ? (form.portionLabel.trim() || 'portion') : undefined
    const foodData = {
      name,
      unit,
      portionLabel,
      category: form.category.trim() || 'local',
      calories: parseFloat(form.calories) || 0,
      proteins: parseFloat(form.proteins) || 0,
      carbs: parseFloat(form.carbs) || 0,
      fats: parseFloat(form.fats) || 0,
    }

    if (editingFood) {
      await db.foods.update(editingFood.id, foodData)
    } else {
      await db.foods.add({ id: Date.now(), ...foodData })
    }

    setView('list')
  }

  async function handleDelete(food: Food) {
    if (!window.confirm(`Supprimer « ${food.name} » de l'index ?`)) return
    await db.foods.delete(food.id)
  }

  function perUnitLabel(food: Food) {
    if (food.portionLabel) return `/${food.portionLabel}`
    return food.unit === 1 ? '/u' : '/100g'
  }

  if (view === 'form') {
    const perLabel = form.unitMode === 'portion'
      ? `par ${form.portionLabel.trim() || 'portion'}`
      : 'pour 100g'

    return (
      <div className="flex flex-col min-h-dvh bg-green-50">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setView('list')}
            className="p-2 -ml-2 text-gray-400 active:bg-gray-100 rounded-xl"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="flex-1 text-base font-semibold text-gray-800">
            {editingFood ? "Modifier l'aliment" : 'Nouvel aliment'}
          </h1>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-40 active:bg-green-700"
          >
            Enregistrer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 pb-8">
          <div className="card p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Nom
              </label>
              <input
                autoFocus
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-green-400 transition-colors"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                Catégorie
              </label>
              <div className="flex gap-2 flex-wrap">
                {['local', 'off', 'recipe'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.category === cat
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Type de portion
              </label>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, unitMode: '100g' }))}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${form.unitMode === '100g' ? 'bg-green-600 text-white' : 'text-gray-600 active:bg-gray-50'}`}
                >
                  Pour 100g
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, unitMode: 'portion' }))}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${form.unitMode === 'portion' ? 'bg-green-600 text-white' : 'text-gray-600 active:bg-gray-50'}`}
                >
                  Par portion
                </button>
              </div>
            </div>

            {form.unitMode === 'portion' && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Nom de la portion
                </label>
                <input
                  type="text"
                  placeholder="part, tranche, biscuit…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-green-400 transition-colors"
                  value={form.portionLabel}
                  onChange={e => setForm(f => ({ ...f, portionLabel: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Valeurs <span className="normal-case font-normal text-gray-400">{perLabel}</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'calories', label: 'Calories', unit: 'kcal' },
                  { key: 'proteins', label: 'Protéines', unit: 'g' },
                  { key: 'carbs',    label: 'Glucides',  unit: 'g' },
                  { key: 'fats',     label: 'Lipides',   unit: 'g' },
                ] as const).map(({ key, label, unit }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500">{label}</label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        className="flex-1 border border-gray-200 rounded-xl px-2 py-3 text-base text-center min-w-0"
                        value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      />
                      <span className="text-xs text-gray-400 shrink-0 w-7">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => navigate('/profile')}
          className="p-2 -ml-2 text-gray-400 active:bg-gray-100 rounded-xl"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="flex-1 text-xl font-bold text-gray-800">Index des aliments</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl active:bg-green-700"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Rechercher dans l'index…"
          className="w-full bg-white border border-gray-200 rounded-2xl pl-9 pr-4 py-3 text-base outline-none focus:border-green-400 transition-colors shadow-sm"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {foods !== undefined && (
        <p className="text-xs text-gray-400">
          {filtered.length} aliment{filtered.length !== 1 ? 's' : ''}
          {searchQuery && foods.length !== filtered.length ? ` sur ${foods.length}` : ''}
        </p>
      )}

      {foods?.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🥗</p>
          <p>Index vide.</p>
          <p className="text-sm">Ajoute tes premiers aliments.</p>
        </div>
      )}

      <div className="space-y-1.5">
        {filtered.map(food => (
          <div key={food.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-gray-800 truncate">{food.name}</p>
                <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${CATEGORY_COLORS[food.category] ?? 'bg-gray-100 text-gray-500'}`}>
                  {food.category}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {food.calories} kcal · P:{food.proteins}g G:{food.carbs}g L:{food.fats}g
                <span className="text-gray-300 ml-1">{perUnitLabel(food)}</span>
              </p>
            </div>
            <button
              onClick={() => openEdit(food)}
              className="p-2 text-gray-300 hover:text-blue-400 rounded-xl shrink-0"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => handleDelete(food)}
              className="p-2 text-gray-300 hover:text-red-400 rounded-xl shrink-0"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
