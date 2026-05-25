export interface Food {
  id: number;
  name: string;
  unit: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  category: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  proteins: number;
  fats: number;
  carbs: number;
  calories: number;
}

export interface Recipe {
  id?: number;
  name: string;
  servings?: number;
  totalWeight?: number;
  ingredients: RecipeIngredient[];
  per100g: { proteins: number; fats: number; carbs: number; calories: number };
}

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export const MEAL_META: Record<MealType, { icon: string; label: string }> = {
  breakfast: { icon: '🌅', label: 'Petit-déjeuner' },
  lunch: { icon: '☀️', label: 'Déjeuner' },
  snack: { icon: '🍎', label: 'Collation' },
  dinner: { icon: '🌙', label: 'Dîner' },
};

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export interface MealEntry {
  id?: number;
  date: string;
  meal: MealType;
  foodId?: number;
  recipeId?: number;
  foodName: string;
  quantity: number;
  baseUnit: number;
  proteins: number;
  fats: number;
  carbs: number;
  calories: number;
  isExternal?: boolean;
}

export interface HistoryEntry {
  id?: number;
  date: string;
  proteins: number;
  fats: number;
  carbs: number;
  calories: number;
  notes?: string;
}

export interface WeightEntry {
  id?: number;
  date: string;
  weight: number;
}

export interface UserProfile {
  id?: number;
  birthDate: string;
  gender: 'male' | 'female';
  currentWeight: number;
  height: number;
  activityLevel: number;
  targetWeight?: number;
  goals: {
    calories: number;
    proteins: number;
    fats: number;
    carbs: number;
  };
}
