import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Save, Download, Upload, Check } from 'lucide-react'
import { db } from '../db'
import { exportJSON } from '../utils'
import type { UserProfile } from '../types'

const ACTIVITY_OPTIONS = [
  { value: 1.37, label: "Pas d'activité physique / emploi sédentaire" },
  { value: 1.55, label: 'Sport 1 à 2 fois par semaine' },
  { value: 1.70, label: 'Sport 3 à 4 fois par semaine' },
  { value: 1.90, label: 'Sport tous les jours' },
]

function calcAge(birthDate: string): number {
  return new Date().getFullYear() - new Date(birthDate + 'T00:00:00').getFullYear()
}

function mifflin(weight: number, height: number, age: number, gender: 'male' | 'female'): number {
  return 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161)
}

function calcNeeds(weight: number, height: number, age: number, gender: 'male' | 'female', activity: number, split: { p: number; c: number; f: number }) {
  const bmr = mifflin(weight, height, age, gender)
  const tdee = Math.round(bmr * activity)
  const proteins = Math.round((tdee * split.p) / 4)
  const carbs = Math.round((tdee * split.c) / 4)
  const fats = Math.round((tdee * split.f) / 9)
  const imc = weight / Math.pow(height / 100, 2)
  return { bmr: Math.round(bmr), tdee, proteins, carbs, fats, imc: Math.round(imc * 10) / 10 }
}

// Actual weight: 15% P / 55% G / 30% L
const SPLIT_ACTUAL = { p: 0.15, c: 0.55, f: 0.30 }
// Lean mass: 15% P / 50% G / 35% L
const SPLIT_LEAN = { p: 0.15, c: 0.50, f: 0.35 }

interface ResultColProps {
  label: string
  needs: ReturnType<typeof calcNeeds>
  onApply: () => void
  active: boolean
}

function ResultCol({ label, needs, onApply, active }: ResultColProps) {
  return (
    <div className={`flex-1 rounded-xl p-3 border-2 transition-colors ${active ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
      <p className="text-xs font-semibold text-gray-500 mb-2 text-center">{label}</p>
      <div className="space-y-1.5 text-sm">
        <Row label="IMC" value={`${needs.imc}`} />
        <Row label="BMR" value={`${needs.bmr} kcal`} />
        <Row label="Objectif" value={`${needs.tdee} kcal`} highlight />
        <Row label="Protéines" value={`${needs.proteins} g`} />
        <Row label="Glucides" value={`${needs.carbs} g`} />
        <Row label="Lipides" value={`${needs.fats} g`} />
      </div>
      <button
        onClick={onApply}
        className={`w-full mt-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
          active ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
        }`}
      >
        {active && <Check size={13} />}
        {active ? 'Objectifs actifs' : 'Utiliser ces objectifs'}
      </button>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`font-semibold text-xs ${highlight ? 'text-green-700' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}

export default function Profile() {
  const profile = useLiveQuery(() => db.profile.get(1))
  const [form, setForm] = useState<Partial<UserProfile>>({})
  const [saved, setSaved] = useState(false)
  const [activeCol, setActiveCol] = useState<'actual' | 'lean'>('lean')

  useEffect(() => {
    if (profile) {
      setForm(profile)
      if (profile.goals) {
        const age = calcAge(profile.birthDate)
        const needsLean = calcNeeds(
          profile.targetWeight ?? profile.currentWeight,
          profile.height, age, profile.gender, profile.activityLevel, SPLIT_LEAN
        )
        setActiveCol(profile.goals.calories === needsLean.tdee ? 'lean' : 'actual')
      }
    }
  }, [profile])

  function update(patch: Partial<UserProfile>) {
    setForm(f => ({ ...f, ...patch }))
  }

  const age = form.birthDate ? calcAge(form.birthDate) : 0
  const w = form.currentWeight ?? 0
  const wLean = form.targetWeight ?? w
  const h = form.height ?? 0
  const g = form.gender ?? 'male'
  const a = form.activityLevel ?? 1.55

  const needsActual = w && h && age ? calcNeeds(w, h, age, g, a, SPLIT_ACTUAL) : null
  const needsLean = wLean && h && age ? calcNeeds(wLean, h, age, g, a, SPLIT_LEAN) : null

  function applyGoals(col: 'actual' | 'lean') {
    const needs = col === 'actual' ? needsActual : needsLean
    if (!needs) return
    setActiveCol(col)
    setForm(f => ({
      ...f,
      goals: {
        calories: needs.tdee,
        proteins: needs.proteins,
        carbs: needs.carbs,
        fats: needs.fats,
      },
    }))
  }

  async function handleSave() {
    const goals = form.goals ?? (needsLean ? {
      calories: needsLean.tdee, proteins: needsLean.proteins, carbs: needsLean.carbs, fats: needsLean.fats,
    } : { calories: 2542, proteins: 95, fats: 99, carbs: 318 })
    await db.profile.put({ ...form, id: 1, goals } as UserProfile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleExport() {
    const [foods, recipes, mealEntries, history, weightEntries, profileData] = await Promise.all([
      db.foods.toArray(), db.recipes.toArray(), db.mealEntries.toArray(),
      db.history.toArray(), db.weightEntries.toArray(), db.profile.toArray(),
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
    <div className="p-4 space-y-4 pb-8">
      <h1 className="text-xl font-bold text-gray-800 pt-2">Mes besoins énergétiques</h1>

      {/* Personal data */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Données personnelles</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Date de naissance</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.birthDate ?? ''} onChange={e => update({ birthDate: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Genre</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.gender ?? 'male'} onChange={e => update({ gender: e.target.value as 'male' | 'female' })}>
              <option value="male">Homme</option>
              <option value="female">Femme</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Poids actuel (kg)</label>
            <input type="number" inputMode="decimal" className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.currentWeight ?? ''} onChange={e => update({ currentWeight: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Poids de référence (kg)</label>
            <input type="number" inputMode="decimal" placeholder="masse maigre" className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.targetWeight ?? ''} onChange={e => update({ targetWeight: parseFloat(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Taille (cm)</label>
            <input type="number" inputMode="numeric" className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.height ?? ''} onChange={e => update({ height: parseInt(e.target.value) })} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">Activité physique</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
            value={form.activityLevel ?? 1.55} onChange={e => update({ activityLevel: parseFloat(e.target.value) })}>
            {ACTIVITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
            ))}
          </select>
        </div>

        {age > 0 && <p className="text-xs text-gray-400">Âge calculé : {age} ans</p>}
      </div>

      {/* Results */}
      {needsActual && needsLean && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Besoins calculés</h2>
          <p className="text-xs text-gray-400">
            Formule Mifflin-St Jeor × coefficient activité · P 15% · G 55/50% · L 30/35%
          </p>
          <div className="flex gap-3">
            <ResultCol
              label={`Poids réel (${w} kg)`}
              needs={needsActual}
              active={activeCol === 'actual'}
              onApply={() => applyGoals('actual')}
            />
            <ResultCol
              label={`Référence (${wLean} kg)`}
              needs={needsLean}
              active={activeCol === 'lean'}
              onApply={() => applyGoals('lean')}
            />
          </div>
        </div>
      )}

      {/* Manual goals override */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Objectifs journaliers (modifiables)</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['calories', 'proteins', 'carbs', 'fats'] as const).map(key => (
            <div key={key}>
              <label className="text-xs text-gray-500">
                {key === 'calories' ? 'Calories (kcal)' : key === 'proteins' ? 'Protéines (g)' : key === 'carbs' ? 'Glucides (g)' : 'Lipides (g)'}
              </label>
              <input type="number" inputMode="numeric"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.goals?.[key] ?? ''}
                onChange={e => update({ goals: { ...form.goals!, [key]: parseInt(e.target.value) } })} />
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
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sauvegarde Google Drive</h2>
        <p className="text-xs text-gray-400">
          Exporte toutes les données en JSON → dépose dans Google Drive. Importe pour restaurer.
        </p>
        <div className="flex gap-3">
          <button onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700">
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
