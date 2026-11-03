// Arena 1 feel test: "Schoolyard Snow Day". Hand-made, compact, inspired by the real places:
// Our School's yard at the bottom (home side), a street with parked cars across the middle,
// the rivals' snow fort at the top, the mosque fenced off as scenery on the right of the street.
//
// Legend
//   .  snow            _  cleared street (faster)   Y  schoolyard
//   #  snow wall (cover)   b  bench (cover)   c  parked car (cover)   n  snowman (cover)
//   t  tree   L  street lamp   F  fence   B  snowy hedge (walk in to hide)
//   H  house (edge)   S  Our School   K  rivals' snow fort   M  mosque grounds (scenery, quiet zone)
//   d  snowdrift (refills snowballs)   i  ice (slippery)
//   O  the outpost lodge (centre of the capture zone)   f  fire barrel (cover)
//   h  home start   r  rival start
// The rival half is mirrored to make the bottom half, so both sides are fair.
const TOP = [
  'HHHHHHHHHKKKKKKKKHHHHHHHHH', // 0
  'H...t....K..r...K....t...H', // 1
  'H.BB.....K......K.....BB.H', // 2
  'H.BB......d....d......BB.H', // 3
  'H....##............##....H', // 4
  'H....##...bbbbbb...##....H', // 5
  'H........................H', // 6
  'H..t...BBB......BBB...t..H', // 7
  'H......BBB..##..BBB......H', // 8
  'H.##........##........##.H', // 9
  'H.##..n............n..##.H', // 10
  'H.......d........d.......H', // 11
  'H...t.....bb..bb.....t...H', // 12
  'H.FFFF..............FFFF.H', // 13
  'H........................H', // 14
  'H..L......f....f......L..H', // 15
];
const STREET = [
  'H______c___________c___FMM', // 16
  'H_______ii__OO_________FMM', // 17
  'H_______ii__OO_________FMM', // 18
  'H___c___________c______FMM', // 19
];
// Bottom rows replaced by Our School and its yard (instead of the mirrored fort).
const SCHOOL = {
  32: 'H.BB..YYYYYYhYYYYYYY..BB.H',
  33: 'H.BB..YdYYYYYYYYYYdY..BB.H',
  34: 'H....tSSSSSSSSSSSSSSt....H',
  35: 'HHHHHHSSSSSSSSSSSSSSHHHHHH',
};

export function schoolyardRows() {
  const rows = [...TOP, ...STREET];
  for (let i = TOP.length - 1; i >= 0; i--) rows.push(TOP[i].replace(/r/g, 'h').replace(/K/g, 'H'));
  for (const [i, row] of Object.entries(SCHOOL)) rows[Number(i)] = row;
  // the mirrored home start from the fort row is not used: keep only the yard start
  rows.forEach((r, i) => { if (i !== 32) rows[i] = r.replace(/h/g, '.'); });
  return rows;
}

export const SCHOOLYARD = {
  id: 'schoolyard',
  name: 'Schoolyard Snow Day',
  theme: 'home-turf',
  rows: schoolyardRows(),
  zoneRadius: 3.4,
};
