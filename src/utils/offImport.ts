import { db } from '../db'
import type { OffProduct } from '../types'

const BATCH_SIZE = 5000

export interface ImportProgress {
  pagesLoaded: number
  totalPages: number
  recordCount: number
}

export async function importOFFFile(
  file: File,
  onProgress: (p: ImportProgress) => void
): Promise<number> {
  await db.offProducts.clear()

  const isGzip = file.name.endsWith('.gz')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream: ReadableStream = isGzip
    ? file.stream().pipeThrough(new DecompressionStream('gzip') as any)
    : file.stream()

  const reader = stream.getReader()
  const decoder = new TextDecoder()

  let buffer = ''
  let headers: string[] | null = null
  let colName = -1, colBrands = -1, colKcal = -1, colProt = -1, colCarbs = -1, colFat = -1
  let batch: OffProduct[] = []
  let recordCount = 0
  let linesRead = 0
  const totalSize = file.size

  async function flush() {
    if (batch.length === 0) return
    await db.offProducts.bulkPut(batch)
    recordCount += batch.length
    batch = []
    onProgress({ pagesLoaded: linesRead, totalPages: Math.round(totalSize / 500), recordCount })
  }

  function parseLine(line: string) {
    if (!line.trim()) return
    linesRead++
    const cols = line.split('\t')

    if (!headers) {
      headers = cols
      colName = headers.indexOf('product_name')
      colBrands = headers.indexOf('brands')
      colKcal = headers.indexOf('energy-kcal_100g')
      colProt = headers.indexOf('proteins_100g')
      colCarbs = headers.indexOf('carbohydrates_100g')
      colFat = headers.indexOf('fat_100g')
      return
    }

    const name = cols[colName]?.trim()
    if (!name || name.length < 2) return

    const calories = parseFloat(cols[colKcal]) || 0
    const proteins = parseFloat(cols[colProt]) || 0
    const carbs = parseFloat(cols[colCarbs]) || 0
    const fats = parseFloat(cols[colFat]) || 0

    if (calories === 0 && proteins === 0) return

    batch.push({
      name,
      nameLower: name.toLowerCase(),
      brands: cols[colBrands]?.trim() || undefined,
      calories: Math.round(calories),
      proteins: Math.round(proteins * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fats: Math.round(fats * 10) / 10,
    })
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value as Uint8Array, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        parseLine(buffer.slice(0, nl))
        buffer = buffer.slice(nl + 1)
        if (batch.length >= BATCH_SIZE) await flush()
      }
    }
    if (buffer.trim()) parseLine(buffer)
    await flush()
  } finally {
    reader.cancel()
  }

  return recordCount
}
