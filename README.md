# SnowPax

SnowPax is a free English-practice snowball game by Mr. Saymaz for Grades 5–8 (CEFR A1–A2+). Static web game, deployed on Vercel. No ads, no accounts, no data collection.

**Version 0.3.0.** Three arenas (Kasımpaşa, The Golden Horn, Downtown), each a stage: a sled ride in, an outpost taken with English and snowball fights, a Final Showdown. Stages won with good English add **Ulti points** to the student's team in Mr. Saymaz's English League (see `docs/ENGLISH-LEAGUE.md`).

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install three.js and esbuild |
| `npm run build` | Check the content, then build `dist/` (fails on content problems or over 15 MB) |
| `npm run serve` | Build and serve on http://localhost:8080 |
| `npm test` | Unit tests (node) |
| `npm run import` | Re-import the lesson banks, then rewrite the coverage report and check the content |
| `npm run coverage` | Rewrite `content/COVERAGE.md` |
| `npm run check` | Content check only |

`npm run import` needs Mr. Saymaz's other repos next to this one (`../maxima`, `../towerswarm`, `../languini`, or `../mrsaymaz/<name>`), or pass `--maxima DIR --towerswarm DIR --languini DIR`. They are only read. The imported `content/` is committed, so Vercel builds without them.

## Layout

```
src/config.js            every setting: teams, colours, emblems, timings, difficulty, access code
public/config.js         settings changed without a build: the English League address (ultiApi; '' = off)
src/league.mjs           the English League client (Ulti points: start tickets, claims, outbox, pools) and the win rule
src/tasks/subtasks.mjs   the 5 task families and 23 sub-tasks (used by the game, the coverage report and the checker)
src/tasks/validate.mjs   checks each generated task step
src/tasks/layout.mjs     text budget for the 640 × 360 task card
src/rules/progress.mjs   rival draw, the 80% rule, unit progress, missed items
src/save.mjs             versioned localStorage save, migration, backup codes
src/main.js              M0 task preview page
tools/import-content.mjs builds content/grade5…8.json from the lesson banks
tools/coverage.mjs       writes content/COVERAGE.md
tools/check-content.mjs  content check (runs in npm run build)
tools/build-world.mjs    builds Arena 1 (Kasımpaşa): one purpose-built outpost field (no real map), public/arenas/arena1.json
content/                 imported lesson content, coverage report, import log
public/pictures/         licensed pictures copied from solMaxima and Tower Swarm, with licence
docs/                    proposals waiting for Mr. Saymaz's decisions
```

## English League (Ulti points)

Ulti points are not spent in the game: they live only in the English League. A stage won with 60% of its tasks right first time (Relaxed) or 2+ stars (Challenge) is claimed; the League decides the points. `public/config.js` holds the League address; set `ultiApi: ''` for a practice-only copy with no requests. The line to add to the League's Apps Script and everything the game sends are in `docs/ENGLISH-LEAGUE.md`.

## Release notes

- **0.3.0**: "Who are you?": students pick their class and name from the English League's class list once on a device (only their grade's classes and their team's names), a "Playing as" pill to change it, and every Ulti win says who earned it; nothing is played without the League's own list, and no names are in the code.
- **0.2.0**: Ulti points and the English League (team buttons show each team's live Ulti, a League panel, the win line on the results card); Mr. Saymaz's first-time guide; the new logo and icons; the snowball style chosen in the Snow Shop; your own kid stands out (a little bigger, violet, a gold ring); hits that land (hit-stop, splats, freezes that shatter).
- **0.1.0**: the three arenas, the sled rides and the task scenes.

## Deploying on Vercel

Import the repo in Vercel. `vercel.json` sets the build command (`npm run build`) and the output folder (`dist`). No environment variables are needed.

## Credits

- Lesson content: Mr. Saymaz's banks (solMaxima, Tower Swarm, Languini, Wordramp, Growbloom).
- Pictures: Fluent Emoji 3D by Microsoft (MIT licence, `public/pictures/emoji/LICENSE.txt`); pictograms from solMaxima.
- three.js (MIT).
