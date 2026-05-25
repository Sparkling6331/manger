import { db } from './db';
import seedData from './data/seed.json';
import type { Food, Recipe, WeightEntry, HistoryEntry } from './types';

export async function seedIfEmpty() {
  const count = await db.foods.count();
  if (count > 0) return;

  await db.transaction('rw', [db.foods, db.recipes, db.weightEntries, db.history, db.profile], async () => {
    await db.foods.bulkPut(seedData.foods as Food[]);

    const recipes = seedData.recipes.map((r, i) => ({ ...r, id: i + 1 })) as Recipe[];
    await db.recipes.bulkPut(recipes);

    const weights = seedData.weights.map((w, i) => ({ ...w, id: i + 1 })) as WeightEntry[];
    await db.weightEntries.bulkPut(weights);

    const history = seedData.history.map((h, i) => ({ ...h, id: i + 1 })) as HistoryEntry[];
    await db.history.bulkPut(history);

    await db.profile.put({
      id: 1,
      birthDate: seedData.profile.birthDate,
      gender: 'male',
      currentWeight: 97.4,
      height: seedData.profile.height,
      activityLevel: seedData.profile.activityLevel,
      targetWeight: 78,
      goals: seedData.profile.goals,
    });
  });
}
