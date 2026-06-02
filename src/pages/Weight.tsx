import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import { db } from '../db'
import { today, formatDateShort } from '../utils'

// ── helpers ────────────────────────────────────────────────

function formatEntryDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }),
  }
  return d.toLocaleDateString('fr-FR', opts)
}

// Smooth cubic bezier path through a list of [x, y] points
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy] = pts[i]
    const mx = ((px + cx) / 2).toFixed(1)
    d += ` C ${mx} ${py.toFixed(1)}, ${mx} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`
  }
  return d
}

// ── chart ──────────────────────────────────────────────────

interface ChartProps {
  entries: { date: string; weight: number }[]
  targetWeight?: number
}

function WeightChart({ entries, targetWeight }: ChartProps) {
  if (entries.length < 2) return null

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const weights = sorted.map(e => e.weight)

  const allValues = targetWeight ? [...weights, targetWeight] : weights
  const rawMin = Math.min(...allValues)
  const rawMax = Math.max(...allValues)
  const spread = rawMax - rawMin || 2
  const yMin = rawMin - spread * 0.18
  const yMax = rawMax + spread * 0.22

  const W = 320, H = 150
  const PL = 38, PR = 10, PT = 22, PB = 28

  const cx = (i: number) => PL + (i / (sorted.length - 1)) * (W - PL - PR)
  const cy = (w: number) => PT + (1 - (w - yMin) / (yMax - yMin)) * (H - PT - PB)

  const pts = sorted.map((e, i) => [cx(i), cy(e.weight)] as [number, number])
  const line = smoothPath(pts)
  const bottomY = H - PB
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${bottomY} L ${pts[0][0].toFixed(1)} ${bottomY} Z`

  // Grid: 4 evenly spaced weight values
  const gridSteps = 4
  const gridVals = Array.from({ length: gridSteps + 1 }, (_, i) =>
    yMin + (i / gridSteps) * (yMax - yMin)
  )

  // X-axis labels: first (with year), year-change boundaries, last
  const xLabels: { i: number; text: string; anchor: 'start' | 'middle' | 'end' }[] = []
  sorted.forEach((e, i) => {
    const year = e.date.slice(0, 4)
    const prevYear = i > 0 ? sorted[i - 1].date.slice(0, 4) : null
    if (i === 0) {
      xLabels.push({ i, text: `${formatDateShort(e.date)} ${year}`, anchor: 'start' })
    } else if (i === sorted.length - 1) {
      const firstYear = sorted[0].date.slice(0, 4)
      const text = year !== firstYear
        ? `${formatDateShort(e.date)} ${year}`
        : formatDateShort(e.date)
      xLabels.push({ i, text, anchor: 'end' })
    } else if (prevYear && year !== prevYear) {
      xLabels.push({ i, text: year, anchor: 'middle' })
    }
  })

  const lastPt = pts[pts.length - 1]
  const lastWeight = sorted[sorted.length - 1].weight

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      <defs>
        <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridVals.map((w, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={cy(w)} y2={cy(w)} stroke="#f3f4f6" strokeWidth="1" />
          <text x={PL - 4} y={cy(w) + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">
            {w.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Goal line */}
      {targetWeight !== undefined && targetWeight >= yMin && targetWeight <= yMax && (
        <g>
          <line
            x1={PL} x2={W - PR} y1={cy(targetWeight)} y2={cy(targetWeight)}
            stroke="#fb923c" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.85"
          />
          <text x={W - PR} y={cy(targetWeight) - 4} textAnchor="end" fontSize="8" fill="#fb923c">
            objectif
          </text>
        </g>
      )}

      {/* Area fill */}
      <path d={area} fill="url(#wGrad)" />

      {/* Curve */}
      <path d={line} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {pts.map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r="3.5" fill="white" stroke="#22c55e" strokeWidth="2" />
      ))}

      {/* Last value callout */}
      <text
        x={lastPt[0]} y={lastPt[1] - 9}
        textAnchor={lastPt[0] > W * 0.7 ? 'end' : 'middle'}
        fontSize="11" fontWeight="700" fill="#15803d"
      >
        {lastWeight} kg
      </text>

      {/* X-axis labels */}
      {xLabels.map(({ i, text, anchor }) => (
        <text key={i} x={cx(i)} y={H - 4} textAnchor={anchor} fontSize="9" fill="#9ca3af">
          {text}
        </text>
      ))}
    </svg>
  )
}

// ── page ───────────────────────────────────────────────────

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
          className="flex items-center gap-1.5 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl"
        >
          <Plus size={16} /> Peser
        </button>
      </div>

      {/* Summary */}
      {latest && (
        <div className="card p-4">
          <div className="flex items-end justify-between mb-1">
            <div>
              <p className="text-sm text-gray-400">Dernier relevé</p>
              <p className="text-3xl font-bold text-gray-800">
                {latest.weight} <span className="text-lg font-normal text-gray-400">kg</span>
              </p>
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
        <div className="card p-4">
          <p className="text-sm font-semibold text-gray-600 mb-3">Évolution</p>
          <WeightChart entries={sorted} targetWeight={profile?.targetWeight} />
        </div>
      )}

      {/* List */}
      <div className="card overflow-hidden">
        {(entries ?? []).length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">Aucun relevé pour l'instant.</p>
        )}
        {(entries ?? []).map(e => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-500">{formatEntryDate(e.date)}</span>
            <span className="font-semibold text-gray-800">{e.weight} kg</span>
          </div>
        ))}
      </div>

      {/* Add sheet */}
      {showAdd && (
        <>
          <div className="backdrop" onClick={() => setShowAdd(false)} />
          <div className="sheet sm:max-w-xs">
            <div className="drag-handle">
              <div className="w-9 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex justify-between items-center px-4 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Ajouter un relevé</h2>
              <button onClick={() => setShowAdd(false)} className="p-2 -mr-2 text-gray-400 active:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <div className="flex items-center justify-center gap-4">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  placeholder="0.0"
                  className="w-36 border-2 border-gray-200 focus:border-green-400 rounded-2xl px-4 py-4 text-4xl font-bold text-center outline-none transition-colors"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <span className="text-gray-400 text-lg font-medium">kg</span>
              </div>
              <button onClick={handleAdd} className="btn-primary w-full">
                Enregistrer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
