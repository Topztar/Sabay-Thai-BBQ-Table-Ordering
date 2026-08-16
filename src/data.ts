import { Language } from './types';

// Declare types for data that will be fetched dynamically
export let TRANSLATIONS: { [key: string]: { [lang in Language]: string } } = {};
export let CAT_NAMES: { [key: string]: { [lang in Language]: string } } = {};
export let INITIAL_CATEGORIES: any[] = [];
export let INITIAL_MENU: any[] = [];
export let INITIAL_INGREDIENTS: any[] = [];
export let INGREDIENT_RECIPE_MAP: { [foodId: string]: { ingredientId: string; amount: number }[] } = {};

export async function loadData() {
  const response = await fetch('/data.json');
  const data = await response.json();
  TRANSLATIONS = data.TRANSLATIONS;
  CAT_NAMES = data.CAT_NAMES;
  INITIAL_CATEGORIES = data.INITIAL_CATEGORIES;
  INITIAL_MENU = data.INITIAL_MENU;
  INITIAL_INGREDIENTS = data.INITIAL_INGREDIENTS;
  INGREDIENT_RECIPE_MAP = data.INGREDIENT_RECIPE_MAP;
}
