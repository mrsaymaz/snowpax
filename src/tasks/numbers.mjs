// British English number words 0–200 (from Languini's takeaway numbers):
// forty, hyphenated tens (twenty-one), and "and" after a hundred (one hundred and twelve).
const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numberWords(value) {
  if (!Number.isInteger(value) || value < 0 || value > 200) throw new RangeError('Numbers must be integers from 0 to 200.');
  if (value < 20) return small[value];
  if (value < 100) return tens[Math.floor(value / 10)] + (value % 10 ? '-' + small[value % 10] : '');
  const rest = value % 100;
  return small[Math.floor(value / 100)] + ' hundred' + (rest ? ' and ' + numberWords(rest) : '');
}
