# SnowPax

SnowPax is a free English-practice snowball game by Mr. Saymaz for Grades 5–8 (CEFR A1–A2+). Static web game, deployed on Vercel. No ads, no accounts, no data collection.

**Status: M0 (setup and content).** The deployed page is a task preview for checking the content. The isometric game starts in M1.

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
src/config.js            every setting: teams, colours, emblems, timings, difficulty, League endpoint, access code
src/tasks/subtasks.mjs   the 5 task families and 23 sub-tasks (used by the game, the coverage report and the checker)
src/tasks/validate.mjs   checks each generated task step
src/tasks/layout.mjs     text budget for the 640 × 360 task card
src/rules/progress.mjs   rival draw, the 80% rule, unit progress, missed items
src/save.mjs             versioned localStorage save, migration, backup codes
src/main.js              M0 task preview page
tools/import-content.mjs builds content/grade5…8.json from the lesson banks
tools/coverage.mjs       writes content/COVERAGE.md
tools/check-content.mjs  content check (runs in npm run build)
tools/build-world.mjs    builds Arena 1: six purpose-built stage fields (no real map), public/arenas/arena1.json
content/                 imported lesson content, coverage report, import log
public/pictures/         licensed pictures copied from solMaxima and Tower Swarm, with licence
docs/                    proposals waiting for Mr. Saymaz's decisions
```

## Deploying on Vercel

Import the repo in Vercel. `vercel.json` sets the build command (`npm run build`) and the output folder (`dist`). No environment variables are needed.

## Credits

- Lesson content: Mr. Saymaz's banks (solMaxima, Tower Swarm, Languini, Wordramp, Growbloom).
- Pictures: Fluent Emoji 3D by Microsoft (MIT licence, `public/pictures/emoji/LICENSE.txt`); pictograms from solMaxima.
- three.js (MIT).
