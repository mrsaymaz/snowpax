# Arena 1 as stages (M3)

Inspired by Growbloom's garden path, solMaxima's gates and Tower Swarm's waves. Arena 1 is six
stages played in order:

| # | Stage | Sled ride | Task family | New rival |
|---|---|---|---|---|
| 1 | Boulevard Park | 45 s, plane-tree avenue | Answer | snowmen (waddlers) |
| 2 | Archery Ground | 45 s, record stones and targets, spelling letters | Sorting | shield snowmen |
| 3 | Kızılay Square | 45 s, tiled kiosks and simit carts | Matching | sledder snowmen |
| 4 | Sururi Park | 45 s, snow castles and slides, spelling letters | Builder | lobber snowmen |
| 5 | Waterfront Park | 45 s, along the frozen Golden Horn | Listening | — (everything mixed) |
| 6 | Schoolyard Showdown | 45 s, home to Our School | all five | the rival captain |

## Look, time of day and dressing

There is no real map and there are no real streets. Arena 1 is six purpose-built fields
(`tools/build-world.mjs`), one per stage, and only the look of the neighbourhood is kept round each
one: a cobbled lane with old lamps, snowed-in houses with lit windows and tea on the sills, buried
roofs, the stage's own trees and street stalls (and the frozen Golden Horn with a ferry and a pier
by the waterfront). Beyond that is a painted backdrop.

The bold look (cartoon shading, outlines, glow, a build of only the stage's field) is the
default. `?look=v1` brings back the old diorama look.

Each stage has its own time of day (`STAGE_LIGHT` in `brawl.js`, presets in `DAYLIGHT` in
`render/village.js`, each with its own colour grade), so Arena 1 runs from morning to evening:

| Stage | Time of day | Field and frame (`ARENAS` and `PLACES` in `tools/build-world.mjs`) |
|---|---|---|
| Boulevard Park | crisp blue morning, long shadows | park hedges down the sides and in the middle lane, L-shaped snow walls; plane trees; chestnut, çay and salep stalls |
| Archery Ground | bright white noon | a wooden practice ground: long barricades and crates, a long open middle; spruces and birches; salep and chestnut stalls |
| Kızılay Square | lavender afternoon | a town square: snow-wall corners, wall stubs from the edges, a wide bush in the middle; birches and plane trees; simit, çay and roasted-corn stalls |
| Sururi Park | warm golden hour | snow ramparts, a pillar in the middle lane, an icy middle; rowans and spruces; salep and roasted-corn stalls |
| Waterfront Park | pink sunset, lamps coming on | the quay: cargo crates and wide ice; the frozen Golden Horn behind the outpost; fish-sandwich, simit and çay stalls |
| Schoolyard Showdown | evening, lamps and windows lit | the playground: low walls, benches, a snowman; Our School behind the circle, five banners and the bell |

## Battlefields (Brawl-style principles, from the second play-test)

Every stage is played on a purpose-built field (`ARENAS` in `tools/build-world.mjs`), each with
its own layout.
- **The rivals hold the outpost.** Its landmark stands at the north end of the field, behind the
  rival team; our team spawns at the south end. The team has to beat the rival team in the open
  field first (frozen rivals go back to their camp; after 45 s the ones still standing run back
  too, so nobody is stuck), then run up and seize the outpost with English. Until then the circle
  shows the rivals' colour. Later waves come round the outpost from the camp behind it.
- **Size, from 3v3 brawler maps:** those are about 21 × 33 tiles, with heroes running about 2.5
  tiles/s and throwing 3–10 tiles. Our kids run 3.4 tiles/s and throw 5–7.5 tiles, so the same
  footprint gives the same rhythm: the field is **22 × 34 tiles** (the old ring was 25 across
  with the outpost in the middle: 377 tiles to move in; the field has 642). About 6 s from
  spawn to the first fight, room to dodge sideways, cover every 4–6 tiles, about 12% of the
  field covered (walls, barricades, crates, bushes).
- **Layout:** the long axis runs up the screen (portrait-first). Three lanes, cover between them
  (something in the middle lane, so nobody throws spawn to spawn), a wall or barricade shielding
  the home spawn, cover on the rival line to fight from. Mirrored left–right, so neither flank is
  the better route. The test checks every field: the fence closes it, both teams can walk from
  their end to the outpost, and the spots the waves use are open.
- **Six fields, apart:** the fields sit side by side in the world file with nothing between them;
  a stage builds and shows only its own field and frame.
- **Rival team AI:** the defenders hold their line in front of the outpost and come out to meet
  anyone within 11 m of it; the snowmen walk out to the middle of the field.
- **Camera:** on a battlefield the camera pulls back 10% and looks a little ahead, up the field;
  rivals just out of view show as arrows at the screen edge (now within 30 m).
- **Environment kit** (`render/village.js`): rounded snow walls with a fat white cap, wooden
  barricades with snow along the top, bevelled crates, frosted bushes, glassy ice patches. All
  the same proportions, bevelled, with thick snow caps.
- **Colour:** the battlefield floor is lilac-tinted packed snow, so plain white means wall or out
  of bounds; ice is glassy blue.
- During a stand there are no blizzards or sun bursts, so the light stays steady; each stage
  keeps its own time of day.

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
   - **The field:** the team arrives at the south end; the rival team holds the north end, in front
     of the outpost.
   - **The opening fight:** beat the rival team (see Battlefields above). Then "SEIZE IT!": run up
     to the glowing circle (or tap ▶ Seize; after 8 s the kid walks in) and the station opens.
   - **Controls:** move with the stick on the left; tap a rival to throw at it, tap your own kid
     to throw at the nearest rival, or use the throw button (tap = nearest, drag = aim). (`stagerun.js`, `waves.mjs`).
   - **Arrival:** snowbanks close the field all round. Later waves come round the outpost from
     the rivals' camp behind it.
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
2. **The schoolyard field:** the rivals have taken the schoolyard. Our School stands at the north
   end behind the circle; the team arrives at the south end and has to beat the rival team first,
   like at the outposts. Five banner poles stand behind the circle, one per outpost won, and the
   school bell hangs on its frame.
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
every stand opens with a fight. Since the second play-test that fight is on a full field against
the whole rival team (about 21 s: the run up the field and the fight, plus about 3 s to walk into
the circle). That brings Arena 1 to about **15 minutes**, over the brief's 10–12; the
class play-test should decide what to trim. The table above is from before these changes. The test checks 10
seeds. Real play with students should confirm the per-item seconds.

**Test links:**
- `?family=` changes the task type at every outpost.
- `?pace=challenge` turns on the timer.
