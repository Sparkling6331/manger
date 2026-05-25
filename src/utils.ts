import type { MealEntry } from './types';

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function sumEntries(entries: MealEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      proteins: round(acc.proteins + e.proteins),
      fats: round(acc.fats + e.fats),
      carbs: round(acc.carbs + e.carbs),
      calories: round(acc.calories + e.calories),
    }),
    { proteins: 0, fats: 0, carbs: 0, calories: 0 }
  );
}

export function calcNutrition(
  food: { proteins: number; fats: number; carbs: number; calories: number; unit: number },
  quantity: number
) {
  const ratio = quantity / food.unit;
  return {
    proteins: round(food.proteins * ratio),
    fats: round(food.fats * ratio),
    carbs: round(food.carbs * ratio),
    calories: round(food.calories * ratio),
  };
}

export function round(n: number, dec = 1): number {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}

export function pct(value: number, goal: number): number {
  if (!goal) return 0;
  return Math.min(Math.round((value / goal) * 100), 150);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function exportJSON(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
