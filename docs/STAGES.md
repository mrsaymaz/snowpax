# Arena 1 as stages (M3)

Inspired by Growbloom's garden path, solMaxima's gates and Tower Swarm's waves. Arena 1 is six
stages played in order, nearest outpost first:

| # | Stage | Sled ride | Task family | New rival |
|---|---|---|---|---|
| 1 | Boulevard Park | 46 s, plane-tree avenue | Answer | snowmen (waddlers) |
| 2 | Archery Ground | 50 s, record stones and targets, spelling letters | Sorting | shield snowmen |
| 3 | Kızılay Square | 50 s, tiled kiosks and simit carts | Matching | sledder snowmen |
| 4 | Sururi Park | 52 s, snow castles and slides, spelling letters | Builder | lobber snowmen |
| 5 | Waterfront Park | 56 s, along the frozen Golden Horn | Listening | — (everything mixed) |
| 6 | Schoolyard Showdown | 40 s, home to Our School | all five | the rival captain |

Stage 6, the Schoolyard Showdown, is the next step. For now it shows a "coming next" card.

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
     - After the final wave is cleared (or after 20 s), the short refill round opens.
   - **Banners:** WAVE and WAVE CLEAR banners, and a "New rivals!" card with a tip.
   - **Answers:** each right answer fires the landmark's attack, snowballs arcing from the top of
     the landmark onto the nearest rivals.
   - **Lives:** being frozen at the outpost costs a life. Answering a card never does.
4. **Results.** Stars (3 at 90% or more, 2 at 70% or more), right first time, snowflakes and time.
   Then the next stage, or the stage map.

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

**Timing:** the plan comes to about 11.9 minutes (`plannedMinutes()` in `stages.mjs`). It is to be
checked with real play once the Showdown is in.

**Test links:**
- `?free` brings back the free-roaming world.
- `?family=` changes the task type at every outpost.
- `?pace=challenge` turns on the timer.
