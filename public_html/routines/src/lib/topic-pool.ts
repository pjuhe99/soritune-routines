import { CATEGORIES, type Category } from "./categories";

export function nextCategoryAfter(last: string | null): Category {
  if (last === null) return CATEGORIES[0];
  const idx = (CATEGORIES as readonly string[]).indexOf(last);
  if (idx === -1) return CATEGORIES[0];
  return CATEGORIES[(idx + 1) % CATEGORIES.length];
}
