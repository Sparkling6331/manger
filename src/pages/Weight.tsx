import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import { db } from '../db'
import { today, formatDateShort } from '../utils'

function WeightChart({ entries }: { entries: { date: string; weight: number }[] }) {
  if (entries.length < 2) return null

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const weights = sorted.map(e => e.weight)
  const minW = Math.min(...weights) - 1
  const maxW = Math.max(...weights) + 1
  const W = 320, H = 100, PAD = 30

  const x = (i: number) => PAD + (i / (sorted.length - 1)) * (W - PAD * 2)
  const y = (w: number) => PAD / 2 + (1 - (w - minW) / (maxW - minW)) * (H - PAD)

  const points = sorted.map((e, i) => `${x(i)},${y(e.weight)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      {/* Grid lines */}
      {[minW + 1, (minW + maxW) / 2, maxW - 1].map(w => (
        <g key={w}>
          <line x1={PAD} x2={W - PAD} y1={y(w)} y2={y(w)} stroke="#e5e7eb" strokeWidth="1" />
          <text x={PAD - 4} y={y(w) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{w.toFixed(1)}</text>
        </g>
      ))}
      <polyline points={points} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {sorted.map((e, i) => (
        <circle key={i} cx={x(i)} cy={y(e.weight)} r="3.5" fill="white" stroke="#22c55e" strokeWidth="2" />
      ))}
      {/* First and last labels */}
      {[0, sorted.length - 1].map(i => (
        <text key={i} x={x(i)} y={H - 2} textAnchor="middle" fontSize="9" fill="#9ca3af">
          {formatDateShort(sorted[i].date)}
        </text>
      ))}
    </svg>
  )
}

export default function Weight() {
  const [showAdd, setShowAdd] = useState(false)
  const [weightInput, setWeightInput] = useState('')

  const entries = useLiveQuery(() => db.weightEntries.orderBy('date').reverse().toArray(), [])
  const profile = useLiveQuery(() => db.profile.get(1))

  const sorted = [...(entries ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const diff = latest && prev ? (latest.weight - prev.weight).toFixed(1) : null

  async function handleAdd() {
    const w = parseFloat(weightInput)
    if (!w || w < 20 || w > 300) return
    await db.weightEntries.add({ date: today(), weight: w })
    await db.profile.update(1, { currentWeight: w })
    setWeightInput('')
    setShowAdd(false)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-gray-800">Poids</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-xl"
        >
          <Plus size={16} /> Peser
        </button>
      </div>

      {/* Summary card */}
      {latest && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-end justify-between mb-1">
            <div>
              <p className="text-sm text-gray-400">Dernier relevé</p>
              <p className="text-3xl font-bold text-gray-800">{latest.weight} <span className="text-lg font-normal text-gray-400">kg</span></p>
            </div>
            {diff !== null && (
              <p className={`text-sm font-semibold ${parseFloat(diff) < 0 ? 'text-green-500' : 'text-red-400'}`}>
                {parseFloat(diff) > 0 ? '+' : ''}{diff} kg
              </p>
            )}
          </div>
          {profile?.targetWeight && (
            <p className="text-xs text-gray-400">
              Objectif : {profile.targetWeight} kg
              {' · '}Reste : <span className="font-medium">{(latest.weight - profile.targetWeight).toFixed(1)} kg</span>
            </p>
          )}
        </div>
      )}

      {/* Chart */}
      {sorted.length >= 2 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-600 mb-2">Évolution</p>
          <WeightChart entries={sorted} />
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {(entries ?? []).length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">Aucun relevé pour l'instant.</p>
        )}
        {(entries ?? []).map(e => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-500">{formatDateShort(e.date)}</span>
            <span className="font-semibold text-gray-800">{e.weight} kg</span>
          </div>
        ))}
      </div>

      {/* Add modal */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/50" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-0 z-[60] bg-white flex flex-col sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-80 sm:rounded-2xl sm:shadow-xl">
            <div className="flex justify-between items-center px-4 py-4 border-b border-gray-100 shrink-0">
              <h2 className="font-semibold text-gray-800">Ajouter un relevé</h2>
              <button onClick={() => setShowAdd(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  placeholder="0.0"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-2xl font-bold text-center"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <span className="text-gray-400 text-lg">kg</span>
              </div>
              <button
                onClick={handleAdd}
                className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
