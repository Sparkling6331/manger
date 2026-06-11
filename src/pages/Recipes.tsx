import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, ChevronLeft, Pencil } from 'lucide-react'
import { db } from '../db'
import { round } from '../utils'
import FoodSearch from '../components/FoodSearch'
import type { Recipe, RecipeIngredient } from '../types'

type View = 'list' | 'create'
type PortionMode = 'servings' | 'weight'

interface DraftIngredient extends RecipeIngredient {
  baseUnit: number
  portionLabel?: string
}

export default function Recipes() {
  const [view, setView] = useState<View>('list')
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [recipeName, setRecipeName] = useState('')
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([])
  const [portionMode, setPortionMode] = useState<PortionMode>('servings')
  const [servings, setServings] = useState('1')
  const [totalWeight, setTotalWeight] = useState('')
  const [addingIngredient, setAddingIngredient] = useState(false)

  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), [])

  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      proteins: acc.proteins + ing.proteins,
      carbs: acc.carbs + ing.carbs,
      fats: acc.fats + ing.fats,
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )

  function startCreate() {
    setEditingRecipe(null)
    setRecipeName('')
    setIngredients([])
    setPortionMode('servings')
    setServings('1')
    setTotalWeight('')
    setView('create')
  }

  function startEdit(recipe: Recipe) {
    setEditingRecipe(recipe)
    setRecipeName(recipe.name)
    const isServings = recipe.servings !== undefined && !recipe.totalWeight
    setPortionMode(isServings ? 'servings' : 'weight')
    setServings(String(recipe.servings ?? 1))
    setTotalWeight(String(recipe.totalWeight ?? ''))
    setIngredients(recipe.ingredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
      baseUnit: 100,
      proteins: ing.proteins,
      fats: ing.fats,
      carbs: ing.carbs,
      calories: ing.calories,
    })))
    setView('create')
  }

  function resetCreate() {
    setEditingRecipe(null)
    setRecipeName('')
    setIngredients([])
    setPortionMode('servings')
    setServings('1')
    setTotalWeight('')
    setView('list')
  }

  function handleAddIngredient(data: {
    foodName: string
    quantity: number
    baseUnit: number
    portionLabel?: string
    proteins: number
    fats: number
    carbs: number
    calories: number
  }) {
    setIngredients(prev => [...prev, {
      name: data.foodName,
      quantity: data.quantity,
      baseUnit: data.baseUnit,
      portionLabel: data.portionLabel,
      proteins: data.proteins,
      fats: data.fats,
      carbs: data.carbs,
      calories: data.calories,
    }])
    setAddingIngredient(false)
  }

  async function handleSave() {
    const name = recipeName.trim()
    if (!name || ingredients.length === 0) return

    const isServings = portionMode === 'servings'
    const n = isServings ? (parseFloat(servings) || 1) : null
    const w = !isServings ? (parseFloat(totalWeight) || 100) : null

    const perUnit = isServings
      ? {
          calories: round(totals.calories / n!),
          proteins: round(totals.proteins / n!),
          carbs: round(totals.carbs / n!),
          fats: round(totals.fats / n!),
        }
      : {
          calories: round(totals.calories * 100 / w!),
          proteins: round(totals.proteins * 100 / w!),
          carbs: round(totals.carbs * 100 / w!),
          fats: round(totals.fats * 100 / w!),
        }

    const recipeIngredients: RecipeIngredient[] = ingredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
      proteins: ing.proteins,
      fats: ing.fats,
      carbs: ing.carbs,
      calories: ing.calories,
    }))

    const recipeData = {
      name,
      servings: isServings ? n! : undefined,
      totalWeight: !isServings ? w! : undefined,
      ingredients: recipeIngredients,
      per100g: perUnit,
    }

    const foodData = {
      name,
      unit: isServings ? 1 : 100,
      portionLabel: isServings ? 'part' : undefined,
      calories: perUnit.calories,
      proteins: perUnit.proteins,
      carbs: perUnit.carbs,
      fats: perUnit.fats,
      category: 'recipe' as const,
    }

    if (editingRecipe?.id) {
      await db.recipes.update(editingRecipe.id, recipeData)
      const food = await db.foods.where('name').equals(editingRecipe.name).and(f => f.category === 'recipe').first()
      if (food?.id) {
        await db.foods.update(food.id, foodData)
      } else {
        await db.foods.add({ id: Date.now(), ...foodData })
      }
    } else {
      await db.recipes.add(recipeData)
      await db.foods.add({ id: Date.now(), ...foodData })
    }

    resetCreate()
  }

  async function handleDelete(recipe: Recipe) {
    if (!window.confirm(`Supprimer la recette « ${recipe.name} » ?`)) return
    if (recipe.id) await db.recipes.delete(recipe.id)
    const food = await db.foods.where('name').equals(recipe.name).and(f => f.category === 'recipe').first()
    if (food?.id) await db.foods.delete(food.id)
  }

  if (view === 'create') {
    return (
      <div className="flex flex-col min-h-dvh bg-green-50">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={resetCreate}
            className="p-2 -ml-2 text-gray-400 active:bg-gray-100 rounded-xl"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="flex-1 text-base font-semibold text-gray-800">
            {editingRecipe ? 'Modifier la recette' : 'Nouvelle recette'}
          </h1>
          <button
            onClick={handleSave}
            disabled={!recipeName.trim() || ingredients.length === 0}
            className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-40 active:bg-green-700"
          >
            Enregistrer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 pb-8">
          <div className="card p-4">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
              Nom de la recette
            </label>
            <input
              autoFocus
              type="text"
              placeholder="Ex : Poulet rôti aux légumes"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base outline-none focus:border-green-400 transition-colors"
              value={recipeName}
              onChange={e => setRecipeName(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <span className="font-semibold text-gray-700">Ingrédients</span>
              {ingredients.length > 0 && (
                <span className="text-sm text-gray-400">{ingredients.length}</span>
              )}
            </div>

            {ingredients.map((ing, i) => (
              <div key={i} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{ing.name}</p>
                  <p className="text-xs text-gray-400">
                    {ing.quantity}{ing.portionLabel ? ` ${ing.portionLabel}` : (ing.baseUnit === 1 ? 'u' : 'g')}
                    {' · '}{Math.round(ing.calories)} kcal
                    {' · '}P:{ing.proteins}g G:{ing.carbs}g L:{ing.fats}g
                  </p>
                </div>
                <button
                  onClick={() => setIngredients(prev => prev.filter((_, j) => j !== i))}
                  className="p-2 text-gray-300 hover:text-red-400 rounded-xl"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <button
              onClick={() => setAddingIngredient(true)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-green-600 hover:bg-green-50 transition-colors"
            >
              <Plus size={16} />
              Ajouter un ingrédient
            </button>
          </div>

          {ingredients.length > 0 && (
            <div className="card p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Totaux recette</p>
              <div className="bg-green-50 rounded-2xl p-4 grid grid-cols-4 gap-1 text-center">
                {[
                  { val: Math.round(totals.calories), label: 'kcal' },
                  { val: round(totals.proteins), label: 'prot.' },
                  { val: round(totals.carbs), label: 'gluc.' },
                  { val: round(totals.fats), label: 'lip.' },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <p className="text-base font-bold text-gray-800">{val}</p>
                    <p className="text-[11px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Découpage</p>
                <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-3">
                  <button
                    type="button"
                    onClick={() => setPortionMode('servings')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${portionMode === 'servings' ? 'bg-green-600 text-white' : 'text-gray-600 active:bg-gray-50'}`}
                  >
                    Nombre de parts
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortionMode('weight')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${portionMode === 'weight' ? 'bg-green-600 text-white' : 'text-gray-600 active:bg-gray-50'}`}
                  >
                    Poids total (g)
                  </button>
                </div>

                {portionMode === 'servings' && (
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      className="w-24 border border-gray-200 rounded-xl px-3 py-3 text-base text-center"
                      value={servings}
                      onChange={e => setServings(e.target.value)}
                    />
                    <div>
                      <p className="text-sm text-gray-700 font-medium">parts</p>
                      {parseFloat(servings) > 0 && (
                        <p className="text-xs text-gray-400">
                          {round(totals.calories / parseFloat(servings))} kcal · P:{round(totals.proteins / parseFloat(servings))}g
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {portionMode === 'weight' && (
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="ex : 600"
                      className="w-24 border border-gray-200 rounded-xl px-3 py-3 text-base text-center"
                      value={totalWeight}
                      onChange={e => setTotalWeight(e.target.value)}
                    />
                    <div>
                      <p className="text-sm text-gray-700 font-medium">g au total</p>
                      {parseFloat(totalWeight) > 0 && (
                        <p className="text-xs text-gray-400">
                          {round(totals.calories * 100 / parseFloat(totalWeight))} kcal/100g · P:{round(totals.proteins * 100 / parseFloat(totalWeight))}g
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {addingIngredient && (
          <FoodSearch
            onAdd={handleAddIngredient}
            onClose={() => setAddingIngredient(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-gray-800">Recettes</h1>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl active:bg-green-700"
        >
          <Plus size={16} />
          Nouvelle
        </button>
      </div>

      {(!recipes || recipes.length === 0) && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">👨‍🍳</p>
          <p>Aucune recette pour l'instant.</p>
          <p className="text-sm">Crée ta première recette personnelle.</p>
        </div>
      )}

      <div className="space-y-2">
        {(recipes ?? []).map(recipe => {
          const isServings = recipe.servings !== undefined && !recipe.totalWeight
          return (
            <div key={recipe.id} className="card p-4">
              <div className="flex items-start gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{recipe.name}</p>
                  <p className="text-sm text-gray-400">
                    {isServings
                      ? `${recipe.servings} part${recipe.servings! > 1 ? 's' : ''} · ${recipe.per100g.calories} kcal/part`
                      : `${recipe.totalWeight}g · ${recipe.per100g.calories} kcal/100g`}
                  </p>
                </div>
                <button
                  onClick={() => startEdit(recipe)}
                  className="p-2 text-gray-300 hover:text-blue-400 rounded-xl shrink-0"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(recipe)}
                  className="p-2 text-gray-300 hover:text-red-400 rounded-xl shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex gap-3 text-xs text-gray-500">
                <span>P: <span className="font-medium text-gray-700">{recipe.per100g.proteins}g</span></span>
                <span>G: <span className="font-medium text-gray-700">{recipe.per100g.carbs}g</span></span>
                <span>L: <span className="font-medium text-gray-700">{recipe.per100g.fats}g</span></span>
                <span className="text-gray-300">{isServings ? 'par part' : '/100g'}</span>
              </div>
              {recipe.ingredients.length > 0 && (
                <p className="text-xs text-gray-300 mt-1.5 truncate">
                  {recipe.ingredients.map(i => i.name).join(', ')}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
