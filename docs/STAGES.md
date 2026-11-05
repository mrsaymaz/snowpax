# Arena 1 as stages (M3)

Inspired by Growbloom's garden path, solMaxima's gates and Tower Swarm's waves. Arena 1 is six
stages played in order, nearest outpost first:

| # | Stage | Sled ride | Task family | New rival |
|---|---|---|---|---|
| 1 | Boulevard Park | 45 s, plane-tree avenue | Answer | snowmen (waddlers) |
| 2 | Archery Ground | 45 s, record stones and targets, spelling letters | Sorting | shield snowmen |
| 3 | Kızılay Square | 45 s, tiled kiosks and simit carts | Matching | sledder snowmen |
| 4 | Sururi Park | 45 s, snow castles and slides, spelling letters | Builder | lobber snowmen |
| 5 | Waterfront Park | 45 s, along the frozen Golden Horn | Listening | — (everything mixed) |
| 6 | Schoolyard Showdown | 45 s, home to Our School | all five | the rival captain |

## Look, time of day and dressing

The bold look (cartoon shading, outlines, glow, a build of only the stage area with a painted
backdrop beyond the snowbanks) is the default. `?look=v1` brings back the old diorama look, and
`?free` the free-roaming world.

Each stage has its own time of day (`STAGE_LIGHT` in `brawl.js`, presets in `DAYLIGHT` in
`render/village.js`, each with its own colour grade), so Arena 1 runs from morning to evening:

| Stage | Time of day | Dressing round the plaza (`DRESS` in `tools/build-world.mjs`) |
|---|---|---|
| Boulevard Park | crisp blue morning, long shadows | hedges, snow walls, benches, snowmen, lamps, plane trees; chestnut, çay and salep stalls |
| Archery Ground | bright white noon | fenced shooting lanes, snow walls, hedges, benches, a ring of spruces; salep and chestnut stalls |
| Kızılay Square | lavender afternoon | benches round the fountain, lamps, hedges, plane trees; simit, çay and roasted-corn stalls |
| Sururi Park | warm golden hour | a snowman park, snow forts, hedges, birches and rowans; salep and roasted-corn stalls |
| Waterfront Park | pink sunset, lamps coming on | railings, benches, lamps, spruces; fish-sandwich, simit and çay stalls |
| Schoolyard Showdown | evening, lamps and windows lit | the schoolyard with its five banners and the bell |

## Battlefields (Brawl-style principles, from the second play-test)

Inside the stage ring the town is replaced by a purpose-built battlefield (`ARENAS` in
`tools/build-world.mjs`, step 10). Boulevard Park is the first; the other outposts follow.
- **Layout:** two spawn sides (the team's on the fight-yard side, the rivals' opposite), the
  outpost in the middle, three lanes: the middle lane past crates, two side routes with L-shaped
  snow walls, bushes to hide in and an ice patch. It is symmetric, so neither side has better
  routes, and squared to the grid so walls run straight.
- **Environment kit** (`render/village.js`): rounded snow walls with a fat white cap, wooden
  barricades with snow along the top, bevelled crates, frosted bushes, glassy ice patches. All
  the same proportions, bevelled, with thick snow caps.
- **Colour:** the battlefield floor is lilac-tinted packed snow, so plain white means wall or out
  of bounds; ice is glassy blue.
- **Waves** come from the rivals' spawn. During a stand there are no blizzards or sun bursts, so
  the light stays steady; each stage keeps its own time of day.
- **Camera:** closer (bigger heroes), fixed angle and zoom, only a light haze; rivals just out of
  view show as arrows at the screen edge.

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
3. **Stand at the outpost** (since the play-test: a fight comes first)
   - **The fight yard:** every outpost has an open wedge of snow on its most open side, with two
     low snow walls for cover (`tools/build-world.mjs`, step 9). The team arrives at its far end.
   - **The opening fight:** the first wave walks into the yard and the team fights it there. When it is (nearly)
     cleared, after at least 6 s, or after 14 s at most, "SEIZE IT!": walk into the glowing circle (or tap ▶ Seize; after 8 s the kid walks in) and the
     station opens.
   - **Controls:** move with the stick on the left; tap a rival to throw at it, tap your own kid
     to throw at the nearest rival, or use the throw button (tap = nearest, drag = aim). (`stagerun.js`, `waves.mjs`).
   - **Arrival:** the team skids into the circle and the task card opens. A ring of snowbanks
     closes the stage, and the waves walk in from up to three entry points.
   - **Waves:**
     - Wave 1 comes on arrival.
     - Wave 2 comes after three answers, once wave 1 is nearly cleared (or after 30 s).
     - When the bar is full, the final wave "They want it back!" comes.
     - When the final wave is beaten (or after 8 s of it) the outpost is yours.
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
the rides and the moments between (arriving, the opening fight, the final wave, the station's
celebration, results). Arena 1 comes to about **11.9 minutes** for every Grade 5 unit:

| Stage | Ride | Tasks (items) | Between | Total |
|---|---|---|---|---|
| Boulevard | 28 s | 51 s (6) | 29 s | 1:48 |
| Archery | 28 s | 33 s (6) | 29 s | 1:30 |
| Kızılay | 30 s | 33 s (6) | 29 s | 1:32 |
| Sururi | 30 s | 81 s (6) | 29 s | 2:20 |
| Waterfront | 32 s | 63 s (6) | 29 s | 2:04 |
| Showdown | 24 s | 98 s (12) | 31 s | 2:33 |

After the first play-test the rides became 45 s and wind (curves, banked turns, gentle hills), and
every stand opens with a fight in the outpost's fight yard (about 10 s, plus about 3 s to walk
into the circle). That brings Arena 1 to about **13.9 minutes**, over the brief's 10–12; the
class play-test should decide what to trim. The table above is from before these changes. The test checks 10
seeds. Real play with students should confirm the per-item seconds.

**Test links:**
- `?free` brings back the free-roaming world.
- `?family=` changes the task type at every outpost.
- `?pace=challenge` turns on the timer.
