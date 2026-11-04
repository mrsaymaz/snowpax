# Arena 1 as stages (M3)

Inspired by Growbloom's garden path, solMaxima's gates and Tower Swarm's waves. Arena 1 is six
stages played in order, nearest outpost first:

| # | Stage | Sled ride | Task family | New rival |
|---|---|---|---|---|
| 1 | Boulevard Park | 36 s, plane-tree avenue | Answer | snowmen (waddlers) |
| 2 | Archery Ground | 38 s, record stones and targets, spelling letters | Sorting | shield snowmen |
| 3 | Kızılay Square | 38 s, tiled kiosks and simit carts | Matching | sledder snowmen |
| 4 | Sururi Park | 40 s, snow castles and slides, spelling letters | Builder | lobber snowmen |
| 5 | Waterfront Park | 42 s, along the frozen Golden Horn | Listening | — (everything mixed) |
| 6 | Schoolyard Showdown | 30 s, home to Our School | all five | the rival captain |

## A stage

1. **Stage map.** Six stops showing locked, open or done with stars, plus the first-try score
   against the 80% target. Finished stages can be replayed for more stars.
2. **Sled journey** (`sledrun.js`).
   - **Controls:** the sled runs by itself in three lanes. Swipe or use the arrow keys or the
     buttons: left and right steer, up jumps, down ducks.
   - **Jump over:** buried cars, snowmen, crates with sleeping cats, fences.
   - **Duck under:** frozen laundry lines, low branches, shop awnings, gulls.
   - **Ramps:** these give big jumps with snowflakes up high.
   - **Collect:**
     - snowflakes
     - golden word snowflakes, which show the English word with its Turkish meaning and read it
       aloud
     - on spelling rides, the letters of a word of the unit, given in Turkish (practice only,
       never counted toward the 80%)
   - **Crashes:** a crash costs a life and drops 3 snowflakes.
   - **First ride:** the first ride says "JUMP!" or "DUCK!" before each new kind of obstacle.
3. **Stand at the outpost** (`stagerun.js`, `waves.mjs`).
   - **Arrival:** the team skids into the circle and the task card opens. A ring of snowbanks
     closes the stage, and the waves walk in from up to three entry points.
   - **Waves:**
     - Wave 1 comes on arrival.
     - Wave 2 comes after three answers, once wave 1 is nearly cleared (or after 30 s).
     - When the bar is full, the final wave "They want it back!" comes.
     - When the final wave is beaten (or after 10 s of it) the outpost is yours.
   - **Banners:** WAVE and WAVE CLEAR banners, and a "New rivals!" card with a tip.
   - **Answers:** each right answer fires the landmark's attack, snowballs arcing from the top of
     the landmark onto the nearest rivals.
   - **Lives:** being frozen at the outpost costs a life. Answering a card never does.
4. **Results.** Stars (3 at 90% or more, 2 at 70% or more), right first time, snowflakes and time.
   Then the next stage, or the stage map.

## The Schoolyard Showdown (stage 6)

1. **The ride home** to Our School (spelling letters on the way).
2. **The schoolyard circle:** the most open spot near Our School (`schoolyardSpot` in `waves.mjs`),
   closed by snowbanks like the outposts. Five banner poles stand behind it, one per outpost won,
   and the school bell hangs on its frame.
3. **Raise the banners:** one mixed task card takes about two items from each family in turn:
   Boulevard (answer), Archery (sorting), Kızılay (matching), Sururi (builder), Waterfront
   (listening). Each family done raises its banner, and the banner fires a volley at the rivals.
   Right answers still fire snowballs too.
4. **Waves come with the banners:** "The last stand" on arrival, "The rival captain!" after two
   banners, "Everyone at once!" after four.
5. **The giant snowball:** with all five banners up, a giant snowball rolls out at the captain and
   freezes everything in its path. The rivals give up, the school bell rings, fireworks.
6. **Arena results:** stars for all six stages, right first time across Arena 1 against the 80%
   goal, snowflakes and the arena time.

**Lives:** three per stage. With none left the stage starts again from the ride. English answers
already given still count.

**Saves:** progress is stored per unit (`arenas[0].stages`). Outposts from finished stages stay
held on the map.

**Rival snowmen** (`MINIONS` in `sim.mjs`):

| Type | What it does |
|---|---|
| Waddler | Slow; throws |
| Shield | A dustbin lid blocks straight shots from the front |
| Sledder | Fast, short range |
| Lobber | Throws over walls |
| Captain | Big, tough, with a crown (the Showdown) |

Frozen snowmen melt away. Each one wears the rival team's colours and has a ring in that colour.

**Timing:** `arenaTime()` in `timing.mjs` times the real tasks each stage deals (from the unit),
using what a Grade 5 student needs per item on the Relaxed pace (choice 7 s, listening 9 s,
spelling or ordering 12 s, a match pair or sort card 5 s, plus 1.5 s of feedback per step), plus
the rides and the moments between (arriving, the final wave, results). Arena 1 comes to about
**11.8 minutes** for every Grade 5 unit:

| Stage | Ride | Tasks (items) | Between | Total |
|---|---|---|---|---|
| Boulevard | 36 s | 51 s (6) | 19 s | 1:46 |
| Archery | 38 s | 33 s (6) | 19 s | 1:30 |
| Kızılay | 38 s | 33 s (6) | 19 s | 1:30 |
| Sururi | 40 s | 81 s (6) | 19 s | 2:20 |
| Waterfront | 42 s | 63 s (6) | 19 s | 2:04 |
| Showdown | 30 s | 98 s (12) | 19 s | 2:27 |

To fit 10–12 minutes, the rides were shortened by about a fifth and the stage stands lost their
refill round. The test checks 10 seeds. Real play with students should confirm the per-item
seconds; if they are slower, the rides are the first thing to shorten.

**Test links:**
- `?free` brings back the free-roaming world.
- `?family=` changes the task type at every outpost.
- `?pace=challenge` turns on the timer.
