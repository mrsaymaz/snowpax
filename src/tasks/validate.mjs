// Checks one generated task step: the right answer is offered exactly once, no wrong option
// equals it, every text fits its place on the 640 × 360 card. Returns a list of problems.
import { fitsPrompt, fitsOption, fitsTile, fitsWideTile, fitsBlock } from './layout.mjs';
import { norm } from './subtasks.mjs';

const unique = arr => new Set(arr.map(norm)).size === arr.length;

export function validateStep(step) {
  const p = [];
  const need = (cond, msg) => { if (!cond) p.push(msg); };
  switch (step.kind) {
    case 'choice': case 'listen': {
      need(Array.isArray(step.options) && step.options.length >= 3, 'needs at least 3 options');
      need(unique(step.options), 'options repeat (the answer may appear twice)');
      need(step.options[step.answer] === step.answerText, 'answer index does not point at the answer');
      need(step.options.filter(o => norm(o) === norm(step.answerText)).length === 1, 'answer offered more than once');
      for (const o of step.options) need(fitsOption(o), `option too long: "${o}"`);
      const prompt = [step.context, step.prompt].filter(Boolean).join('\n');
      need(prompt && fitsPrompt(prompt), `prompt too long: "${prompt.slice(0, 60)}…"`);
      if (step.kind === 'listen') need(step.speak && norm(step.speak) === norm(step.answerText), 'spoken word is not the answer');
      break;
    }
    case 'match': {
      need(step.left.length === step.right.length && step.left.length >= 3, 'board needs 3 pairs');
      const rightIds = Object.values(step.pairs);
      need(new Set(rightIds).size === rightIds.length && rightIds.every(id => step.right.some(r => r.id === id)), 'pairs are not one-to-one');
      const texts = side => side.map(t => t.text ?? t.speak ?? t.pic);
      need(unique(texts(step.left)) && unique(texts(step.right)), 'two tiles look the same');
      for (const t of [...step.left, ...step.right]) if (t.text) need((t.wide ? fitsWideTile : fitsTile)(t.text), `tile text too long: "${t.text}"`);
      need(fitsPrompt(step.prompt), 'prompt too long');
      break;
    }
    case 'sort': {
      need(step.cards.length >= 3 && unique(step.cards.map(c => c.text)), 'sort needs 3 different cards');
      need(step.cards.every(c => c.cat >= 0 && c.cat < step.categories.length), 'card points at a missing group');
      need(new Set(step.cards.map(c => c.cat)).size >= Math.min(2, step.categories.length), 'every board must use at least two groups');
      for (const c of step.cards) need(fitsTile(c.text), `card too long: "${c.text}"`);
      for (const c of step.categories) need(fitsWideTile(c.title), `group title too long: "${c.title}"`);
      break;
    }
    case 'fix': {
      need(step.tokens[step.wrong] !== undefined, 'wrong word index missing');
      need(step.options.filter(o => norm(o) === norm(step.answerText)).length === 1, 'repair answer offered once');
      need(norm(step.tokens[step.wrong]) !== norm(step.answerText), 'the wrong word is already right');
      need(step.options.length >= 2 && unique(step.options), 'needs 2+ different repairs');
      need(fitsPrompt(step.tokens.join(' ')), 'sentence too long');
      break;
    }
    case 'order': {
      need(step.blocks.length >= 3, 'needs 3+ blocks');
      const sorted = [...step.blocks].sort((a, b) => Number(a.id.split('#').pop()) - Number(b.id.split('#').pop()));
      need(sorted.map(b => b.text).join(' ') === step.text, 'blocks do not rebuild the sentence');
      for (const b of step.blocks) need(fitsBlock(b.text), `block too long: "${b.text}"`);
      break;
    }
    case 'order-pair':
      for (const s of step.steps) p.push(...validateStep(s));
      break;
    case 'spell': {
      need([step.given, ...step.tiles].join('').split('').sort().join('') === step.answerText.split('').sort().join(''), 'tiles do not spell the word');
      need(/^[a-z]+$/.test(step.answerText), 'English letters only');
      need(fitsPrompt(step.prompt), 'prompt too long');
      break;
    }
    case 'multi': case 'sequence': {
      const answers = step.answers || step.answer;
      need(unique(step.options), 'options repeat');
      need(Array.isArray(answers) && new Set(answers).size === answers.length && answers.every(i => i >= 0 && i < step.options.length), 'answers must be different options');
      for (const o of step.options) need(fitsOption(o), `option too long: "${o}"`);
      need(fitsPrompt(step.prompt), `prompt too long: "${step.prompt}"`);
      break;
    }
    default: p.push(`unknown step kind ${step.kind}`);
  }
  return p;
}
