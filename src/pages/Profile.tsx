import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Save, Download, Upload, Check, Database, RefreshCw } from 'lucide-react'
import { db } from '../db'
import { exportJSON } from '../utils'
import { importOFFFile, type ImportProgress } from '../utils/offImport'
import type { UserProfile } from '../types'

const OFF_META_KEY = 'offLastSync'
export const OFF_LIMIT_KEY = 'offResultsLimit'
export const OFF_LIMIT_DEFAULT = 10
interface OffMeta { date: string; count: number }
function loadOffMeta(): OffMeta | null {
  try { return JSON.parse(localStorage.getItem(OFF_META_KEY) ?? 'null') } catch { return null }
}
function saveOffMeta(m: OffMeta) { localStorage.setItem(OFF_META_KEY, JSON.stringify(m)) }

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
  const [offMeta, setOffMeta] = useState<OffMeta | null>(loadOffMeta)
  const [offLimit, setOffLimit] = useState(() => parseInt(localStorage.getItem(OFF_LIMIT_KEY) ?? String(OFF_LIMIT_DEFAULT)))
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setForm(profile)
      // Detect which column is currently active based on saved goals
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

  async function handleImportOFF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportError(null)
    setImportProgress({ pagesLoaded: 0, totalPages: 0, recordCount: 0 })
    try {
      const count = await importOFFFile(file, p => setImportProgress({ ...p }))
      const meta: OffMeta = { date: new Date().toLocaleDateString('fr-FR'), count }
      saveOffMeta(meta)
      setOffMeta(meta)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setImporting(false)
      setImportProgress(null)
    }
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
    exportJSON({ version: 1, exportDate: date, foods, recipes, mealEntries, history, weightEntries, profile: profileData }, `manger-${date}.json`)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!window.confirm('Remplacer toutes les données locales par le fichier importé ?')) {
      e.target.value = ''
      return
    }
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
    alert('Importé avec succès !')
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

      {/* OFF local database */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Base Open Food Facts locale</h2>
        {offMeta ? (
          <p className="text-xs text-gray-400">
            {offMeta.count.toLocaleString('fr-FR')} produits · mis à jour le {offMeta.date}
          </p>
        ) : (
          <p className="text-xs text-gray-400">Base non importée — la recherche utilisera l'API internet.</p>
        )}
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 shrink-0">Résultats affichés</label>
          <input
            type="number" inputMode="numeric" min="5" max="50"
            className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center"
            value={offLimit}
            onChange={e => {
              const v = Math.min(50, Math.max(5, parseInt(e.target.value) || OFF_LIMIT_DEFAULT))
              setOffLimit(v)
              localStorage.setItem(OFF_LIMIT_KEY, String(v))
            }}
          />
        </div>
        <ol className="text-xs text-gray-400 list-decimal list-inside space-y-0.5">
          <li>Allez sur <strong className="text-gray-600">fr.openfoodfacts.org/data</strong></li>
          <li>Téléchargez le fichier <strong className="text-gray-600">.csv.gz</strong> (liste des produits)</li>
          <li>Sélectionnez-le ci-dessous</li>
        </ol>
        {importing && importProgress && (
          <div className="space-y-1.5">
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: importProgress.totalPages > 0
                    ? `${Math.min(100, Math.round(importProgress.pagesLoaded / importProgress.totalPages * 100))}%`
                    : '10%',
                }}
              />
            </div>
            <p className="text-xs text-gray-400 text-center">
              {importProgress.recordCount.toLocaleString('fr-FR')} produits importés…
            </p>
          </div>
        )}
        {importError && <p className="text-xs text-red-500">{importError}</p>}
        {!importing && (
          <label className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer">
            {offMeta ? <RefreshCw size={15} /> : <Database size={15} />}
            {offMeta ? 'Mettre à jour la base' : 'Importer le fichier OFF'}
            <input type="file" accept=".gz,.csv" className="hidden" onChange={handleImportOFF} />
          </label>
        )}
      </div>

      {/* Sync */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Synchronisation Mac ↔ iPhone</h2>
        <p className="text-xs text-gray-400">
          Toutes les données sont exportées (aliments, repas, historique, poids, profil).
        </p>
        <ol className="text-xs text-gray-400 list-decimal list-inside space-y-0.5">
          <li>Sur l’appareil source → <strong className="text-gray-600">Exporter</strong> → sauvegarder dans iCloud Drive</li>
          <li>Sur l’autre appareil → <strong className="text-gray-600">Importer</strong> → sélectionner le fichier</li>
        </ol>
        <div className="flex gap-3">
          <button onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-100 transition-colors">
            <Download size={15} /> Exporter
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
            <Upload size={15} /> Importer
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>
    </div>
  )
}
