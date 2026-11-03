// Text fitting estimate for the 640 × 360 task card.
// Greedy word wrap that never splits a word: a word longer than a line does not fit.
// The Playwright screenshots check the real layout; this keeps content inside the budget.
import { CONFIG } from '../config.js';

export function wrapLines(text, charsPerLine) {
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (word.length > charsPerLine) return null; // cannot wrap without splitting a word
      if (!line) line = word;
      else if (line.length + 1 + word.length <= charsPerLine) line += ' ' + word;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

export function fits(text, budget) {
  const lines = wrapLines(text, budget.charsPerLine);
  return lines !== null && lines.length <= budget.lines;
}

const L = CONFIG.layout;
export const BUDGET = {
  prompt: { charsPerLine: L.card.charsPerLine, lines: L.card.promptLines },
  option: { charsPerLine: L.card.charsPerLine, lines: L.card.optionLines },
  tile: L.matchTile,
  wideTile: L.matchTileWide,
  block: L.block,
};

export const fitsPrompt = t => fits(t, BUDGET.prompt);
export const fitsOption = t => fits(t, BUDGET.option);
export const fitsTile = t => fits(t, BUDGET.tile);
export const fitsWideTile = t => fits(t, BUDGET.wideTile);
export const fitsBlock = t => fits(t, BUDGET.block);
