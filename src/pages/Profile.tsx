import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Save, Download, Upload } from 'lucide-react'
import { db } from '../db'
import { exportJSON } from '../utils'
import type { UserProfile } from '../types'

const ACTIVITY_OPTIONS = [
  { value: 1.37, label: 'Sédentaire' },
  { value: 1.55, label: 'Légèrement actif (sport 1-2x/sem)' },
  { value: 1.7, label: 'Modérément actif (sport 3-4x/sem)' },
  { value: 1.9, label: 'Très actif (sport tous les jours)' },
]

function calcGoals(profile: Partial<UserProfile>) {
  const { birthDate, gender, currentWeight, height, activityLevel } = profile
  if (!birthDate || !currentWeight || !height || !activityLevel) return null
  const age = new Date().getFullYear() - new Date(birthDate).getFullYear()
  // Harris-Benedict
  const bmr = gender === 'male'
    ? 88.362 + 13.397 * currentWeight + 4.799 * height - 5.677 * age
    : 447.593 + 9.247 * currentWeight + 3.098 * height - 4.330 * age
  const calories = Math.round(bmr * activityLevel)
  const proteins = Math.round(currentWeight * 1.2)
  const fats = Math.round((calories * 0.3) / 9)
  const carbs = Math.round((calories - proteins * 4 - fats * 9) / 4)
  return { calories, proteins, fats, carbs }
}

export default function Profile() {
  const profile = useLiveQuery(() => db.profile.get(1))
  const [form, setForm] = useState<Partial<UserProfile>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) setForm(profile)
  }, [profile])

  const computed = calcGoals(form)

  function update(patch: Partial<UserProfile>) {
    setForm(f => ({ ...f, ...patch }))
  }

  async function handleSave() {
    const goals = form.goals ?? computed ?? { calories: 2542, proteins: 95, fats: 99, carbs: 318 }
    await db.profile.put({ ...form, id: 1, goals } as UserProfile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleExport() {
    const [foods, recipes, mealEntries, history, weightEntries, profileData] = await Promise.all([
      db.foods.toArray(),
      db.recipes.toArray(),
      db.mealEntries.toArray(),
      db.history.toArray(),
      db.weightEntries.toArray(),
      db.profile.toArray(),
    ])
    const date = new Date().toISOString().split('T')[0]
    exportJSON({ foods, recipes, mealEntries, history, weightEntries, profile: profileData }, `manger-backup-${date}.json`)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const data = JSON.parse(text)
    await db.transaction('rw', [db.foods, db.recipes, db.mealEntries, db.history, db.weightEntries, db.profile], async () => {
      if (data.foods?.length) { await db.foods.clear(); await db.foods.bulkPut(data.foods) }
      if (data.recipes?.length) { await db.recipes.clear(); await db.recipes.bulkPut(data.recipes) }
      if (data.mealEntries?.length) { await db.mealEntries.clear(); await db.mealEntries.bulkPut(data.mealEntries) }
      if (data.history?.length) { await db.history.clear(); await db.history.bulkPut(data.history) }
      if (data.weightEntries?.length) { await db.weightEntries.clear(); await db.weightEntries.bulkPut(data.weightEntries) }
      if (data.profile?.length) { await db.profile.clear(); await db.profile.bulkPut(data.profile) }
    })
    e.target.value = ''
    alert('Données importées avec succès !')
  }

  if (!profile) return <div className="p-4 text-gray-400">Chargement…</div>

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-800 pt-2">Mon profil</h1>

      {/* Profile form */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Informations</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Poids actuel (kg)</label>
            <input
              type="number" inputMode="decimal"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.currentWeight ?? ''}
              onChange={e => update({ currentWeight: parseFloat(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Objectif (kg)</label>
            <input
              type="number" inputMode="decimal"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.targetWeight ?? ''}
              onChange={e => update({ targetWeight: parseFloat(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Taille (cm)</label>
            <input
              type="number" inputMode="numeric"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.height ?? ''}
              onChange={e => update({ height: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Date de naissance</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.birthDate ?? ''}
              onChange={e => update({ birthDate: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">Activité physique</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
            value={form.activityLevel ?? 1.55}
            onChange={e => update({ activityLevel: parseFloat(e.target.value) })}
          >
            {ACTIVITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Goals */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Objectifs journaliers</h2>
          {computed && (
            <button
              onClick={() => update({ goals: computed })}
              className="text-xs text-green-600 font-medium"
            >
              Recalculer
            </button>
          )}
        </div>
        {computed && (
          <p className="text-xs text-gray-400">
            Calculé : {computed.calories} kcal · P:{computed.proteins}g G:{computed.carbs}g L:{computed.fats}g
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {(['calories', 'proteins', 'carbs', 'fats'] as const).map(key => (
            <div key={key}>
              <label className="text-xs text-gray-500 capitalize">
                {key === 'calories' ? 'Calories (kcal)' : key === 'proteins' ? 'Protéines (g)' : key === 'carbs' ? 'Glucides (g)' : 'Lipides (g)'}
              </label>
              <input
                type="number" inputMode="numeric"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.goals?.[key] ?? ''}
                onChange={e => update({ goals: { ...form.goals!, [key]: parseInt(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
          saved ? 'bg-green-100 text-green-700' : 'bg-green-600 text-white'
        }`}
      >
        <Save size={16} />
        {saved ? 'Enregistré !' : 'Enregistrer'}
      </button>

      {/* Sync */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Sauvegarde Google Drive</h2>
        <p className="text-xs text-gray-400">
          Exporte toutes tes données en JSON, puis glisse le fichier dans Google Drive.
          Pour restaurer, importe le fichier depuis Drive.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700"
          >
            <Download size={15} /> Exporter
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 cursor-pointer">
            <Upload size={15} /> Importer
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>
    </div>
  )
}
