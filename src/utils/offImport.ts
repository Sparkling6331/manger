import { db } from '../db'
import type { OffProduct } from '../types'

const PAGE_SIZE = 1000
const MAX_PAGES = 100  // 100 000 produits max

export interface ImportProgress {
  pagesLoaded: number
  totalPages: number
  recordCount: number
}

export async function importOFFDatabase(
  onProgress: (p: ImportProgress) => void
): Promise<number> {
  await db.offProducts.clear()

  let recordCount = 0
  let totalPages = MAX_PAGES

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl` +
      `?action=process&json=1` +
      `&page_size=${PAGE_SIZE}&page=${page}` +
      `&tagtype_0=countries&tag_contains_0=contains&tag_0=france` +
      `&fields=product_name,brands,nutriments`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    if (page === 1 && data.count) {
      totalPages = Math.min(MAX_PAGES, Math.ceil(data.count / PAGE_SIZE))
    }

    const products: Array<{
      product_name?: string
      brands?: string
      nutriments?: {
        'energy-kcal_100g'?: number
        proteins_100g?: number
        carbohydrates_100g?: number
        fat_100g?: number
      }
    }> = data.products ?? []

    if (products.length === 0) break

    const batch: OffProduct[] = products
      .filter(p => {
        const name = p.product_name?.trim()
        if (!name || name.length < 2) return false
        const n = p.nutriments ?? {}
        return (n['energy-kcal_100g'] ?? 0) > 0 || (n.proteins_100g ?? 0) > 0
      })
      .map(p => {
        const n = p.nutriments ?? {}
        const name = p.product_name!.trim()
        return {
          name,
          nameLower: name.toLowerCase(),
          brands: p.brands?.trim() || undefined,
          calories: Math.round(n['energy-kcal_100g'] ?? 0),
          proteins: Math.round((n.proteins_100g ?? 0) * 10) / 10,
          carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
          fats: Math.round((n.fat_100g ?? 0) * 10) / 10,
        }
      })

    if (batch.length > 0) {
      await db.offProducts.bulkPut(batch)
      recordCount += batch.length
    }

    onProgress({ pagesLoaded: page, totalPages, recordCount })

    if (products.length < PAGE_SIZE) break
  }

  return recordCount
}
