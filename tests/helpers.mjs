import { readFileSync } from 'node:fs';
export const grade = g => JSON.parse(readFileSync(new URL(`../content/grade${g}.json`, import.meta.url), 'utf8'));
export const unit = (g, id) => grade(g).units.find(u => u.id === id);
export const allUnits = () => [5, 6, 7, 8].flatMap(g => grade(g).units);
// Every item id in a unit (what generated steps may point at).
export function unitItemIds(u) {
  const ids = new Set();
  for (const k of ['words', 'clues', 'halves', 'sentences', 'questions', 'gaps', 'repairs', 'misspellings']) for (const x of u[k] || []) ids.add(x.id);
  for (const c of u.contexts) for (const q of c.questions) ids.add(q.id);
  return ids;
}
