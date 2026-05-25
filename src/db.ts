import Dexie, { type Table } from 'dexie';
import type { Food, Recipe, MealEntry, HistoryEntry, WeightEntry, UserProfile } from './types';

class MangerDB extends Dexie {
  foods!: Table<Food, number>;
  recipes!: Table<Recipe, number>;
  mealEntries!: Table<MealEntry, number>;
  history!: Table<HistoryEntry, number>;
  weightEntries!: Table<WeightEntry, number>;
  profile!: Table<UserProfile, number>;

  constructor() {
    super('MangerDB');
    this.version(1).stores({
      foods: 'id, name, category',
      recipes: '++id, name',
      mealEntries: '++id, date, meal',
      history: '++id, &date',
      weightEntries: '++id, date',
      profile: '++id',
    });
  }
}

export const db = new MangerDB();
