export const SUPPORTED_UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'nos', 'tbsp', 'tsp', 'packs', 'bottles', 'tubs'] as const;
export type Unit = typeof SUPPORTED_UNITS[number];

export interface Ingredient {
  id: string;
  name: string;
  unit: string; // one of SUPPORTED_UNITS, fixed at creation
  purchased?: number; // manually-managed running "bought" total, in `unit`
}

export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase();
}
