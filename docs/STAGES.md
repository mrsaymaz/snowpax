# Arena 1: Kasımpaşa (M3)

From Mr. Saymaz's fifth talk: **one outpost per arena**. Arena 1 is Kasımpaşa; later arenas (for
example İstiklal Street) are built the same way. The neighbourhood's places are no longer separate
outposts: they are all part of the Kasımpaşa outpost, each with its own English task in its own
scene, and there is no sled travel between them. That brings the arena from about 32 minutes to
about **9** (see Timing), with every task type still in it.

| Place | English task | Its task scene | On the carousel | On the sled ride in |
|---|---|---|---|---|
| Boulevard Park | Answer | the treehouse | the treehouse | a cinematic scene (to come) |
| Archery Ground | Sorting | the archers' lodge | the archers' lodge | **the sample cinematic scene** |
| Kızılay Square | Matching | the fountain | the fountain | a cinematic scene (to come) |
| Sururi Park | Builder | the snow castle | the snow castle | a cinematic scene (to come) |
| The Pier | Listening | the waterfront | the admiral's statue | a cinematic scene (to come) |

Part 1 is Boulevard Park and Archery Ground; Part 2 is Kızılay Square, Sururi Park and the Pier
(`parts` in `stages.mjs`, `PLACE_OF` for the names, `PLACE_ID` for the scenes).

## The carousel: the Kasımpaşa outpost

The outpost is a big wooden carousel at the north end of the field (`buildCarousel` in
`render/snowtown.js`). In the middle stands a ship's mast with a crow's nest, a big anchor at its
foot and the **KASIMPAŞA** sign hanging from the yard (tilted back so it reads from the game's
camera): Kasımpaşa grew up round the old naval shipyard. The outpost's flag flies at the
masthead. Round it, on a turning deck with a red-and-white skirt and brass poles, ride
**miniatures of the five places' landmarks** in task order (the real landmark models, built
aside and moved onto the deck).
- It turns slowly; while a place's task is played it turns that place to the front.
- When a place's task is done, its lamp on the deck and its little flag light up in the team's
  colour: two after Part 1, all five after Part 2.
- **Lit places help in the fights:** in turn, each lobs a snowball at the nearest rival snowman
  or kid (never the captain, never a word snowman), so Part 1 helps in "They strike back!" and
  all five help in the Final Showdown.

## The places on the way: cinematic scenes on the sled ride

The ride into Kasımpaşa passes each place in task order, and at each one the camera turns to a
scene of it, alive (`render/cinema.js`, about 7 s each). Archery Ground is built as the sample;
the other four follow the same pattern.
- **A clear stretch:** the track runs straight and flat, with no obstacles, words or letters; the
  sled slows to 60% and rides itself (no steering needed).
- **The camera:** it first turns its head from the track towards the place (a wide look at it),
  then glides into the scene's shots (cuts, like a film); for the last second it glides back
  behind the sled and turns forward.
- **Music** (synthesized in `audio.js`, no downloaded audio): the ride has a looping sleigh-ride
  tune (D major, sleigh bells, a soft drum, bass, warm chords, a toy-flute melody). Each place's
  scene has its own short theme over the ride's tune turned down; Archery Ground's is a saz-like
  tune in Hicaz over a drone with a frame drum (düm tek). The tune fades out on arrival. Letterbox bars come in; the run's buttons and counters fade.
- **The name card** at about 1 s ("SORTING · PART 1 / Archery Ground"), for 3.4 s, and the
  welcome read aloud ("Welcome to Archery Ground!"). "GET READY!" as the camera swings back.
- **Tap to skip** a scene already seen this session. With reduce motion: one held wide shot and
  cuts instead of swings.
- **Light:** the scene brings its own low sun with long shadows (shadows only while a scene shows).
- Each scene is built just before it is needed and thrown away after.

**Archery Ground** (bright late afternoon): the record stones along the way (tall white marble,
gold bands, snow caps); the archers' lodge with its three lead domes, red-and-white arches, lit
windows and the golden bow; red and gold pennants snapping on tall poles; four kids in a row
throwing snowballs at three straw targets on easels, each hit a puff of snow and a wobble; the
coach beside the targets holding up the score; an old man sweeping the lodge steps, with a ginger
cat on the step swishing its tail; a salep stall with a purple-and-white awning, a copper urn and
steam; snow drifting off the domes; pines and houses behind. Shots: a low dolly along the record
stones, a slow push to the lodge, then behind the row down the range. **The moment:** the small
girl in the green coat hits the bullseye (a big puff and a golden sparkle, a fanfare), the row
jumps with their arms up, and the coach, laughing, flips the score from 8 to 10.

## Three symbols, one job each

The star used to mean four things. Now:
- **★ stars** only rate how well the stage went (3 at 90% right first time, 2 at 70%), on the
  results card and the arena card.
- **❄ snowflakes** are the Snow Shop's money. They are rare: the sled ride's golden word
  snowflakes, and every English answer right first time (the camp's children, Part 1, Part 2, the
  snowflake round).
- **⚪ snowballs** are the common thing on the sled track: the ride's score. A crash spills a few
  of them, never snowflakes.

Super start's icon is a comet (☄️) and its badge on the kid is a glowing snowball in a gold ring.
A right answer in a scene sends a little ❄ flying into the progress bar.

## The stage, start to finish

1. **The arena card:** "Arena 1 · Kasımpaşa", the stars for the stage (of 3) and the first-try
   score against the 80% goal.
2. **The sled ride in** (50 s of riding plus the places' scenes, `sledrun.js`, the Kasımpaşa
   theme: kiosks, plane trees, targets, snow castles; see "The places on the way" above). Swipe or use the arrow keys or the buttons: left and right steer, up jumps
   (buried cars, snowmen, crates with sleeping cats, fences), down ducks (laundry lines, branches,
   awnings, gulls); ramps give big jumps with snowballs up high. Collect **snowballs** (lots) and
   **5 golden word snowflakes**, spread along the track: each shows an English word with its
   Turkish meaning, reads it aloud and is **+1 ❄**. Every snowball rings a little bell, a step
   higher up the scale while a run of them goes on; a word snowflake plays a sparkling run. On the spelling letters (a word given in
   Turkish), spelling it right is +1 ❄ more. A crash costs a life. The first ride says "JUMP!" or
   "DUCK!" before each new kind of obstacle.
3. **The camp:** three neighbourhood children wait at the home end in plain beige coats. Walk up
   to one and the camera cuts to a **close-up, face to face** (`cards/talk.js`, like Languini's
   customer conversations): the child asks one of the unit's questions in a speech bubble, read
   aloud, and your three replies are chat bubbles. Right first time: "Yes! I'm on your team!", a
   puff of snow, out they come in your team's colour and puffer jacket, and **+1 ❄**. A miss: "Hmm…
   not quite! Try the glowing one.", and they ask again in a moment. No rivals on the field yet.
4. **The Snow Shop** (35 s at most, or tap Fight!; `cards/shop.js`): your own kid stands in the
   middle of a market stall looking at you, like a clothes shop in an open-world game. The four
   boosts are price tags on the parts they change: super start by the head, warm coat at the
   shoulder, big gloves and quick hands at the hands. **Every boost costs ❄ 5 and lasts the whole
   outpost.** Buy one and you see it on your kid at once (`render/gear.js`): big red mittens,
   glowing wristbands with a bolt, a fluffy collar and a longer coat, the super-snowball badge and
   a glow at the feet. Your kid wears the same gear in the fights. A slim bar shows your ❄, the
   time and Fight!. The "New rivals!" card says who you will meet.
5. **The opening round:** the rival team keeps coming back from its camp behind the fountain;
   freeze **12 rivals** to break the line (90 s at most, so nobody is stuck). Then "SEIZE IT!":
   run into the circle (or tap ▶ Seize; after 8 s the kid walks in).
6. **Part 1 of 2:** Boulevard Park (Answer), then Archery Ground (Sorting), about 4 items each,
   each in its own scene. Every right first try is **+1 ❄**.
7. **The Snow Shop** again.
8. **"They strike back!":** hold the circle for **50 s** (the clock stops while rivals stand in
   it alone).
9. **Part 2 of 2:** Kızılay Square (Matching), Sururi Park (Builder), the Pier (Listening), +1 ❄
   for each right first try.
10. **The Snow Shop** again, with the rival captain's card.
11. **The Final Showdown** (80 s): the rival captain comes with the whole rival team. **Only your
    own snowballs really freeze the captain** (your team's count for a little: they keep the
    others busy), and the captain warms up again after 2.5 s without a hit, so it takes steady
    throwing: this is where the boosts count. Freeze the captain and the rivals give up: bells,
    fireworks, the outpost is yours. If the time runs out: "The captain holds on!", a short
    **snowflake round** (4 tasks from the five places, +1 ❄ each), the shop, and the Showdown
    again (straight back in if every boost is already yours). The captain is a little more tired
    on each try (20% less warmth), so nobody is ever stuck.
12. **Results:** ★ for the stage, right first time (this stage and the unit, against the 80% goal),
    snowballs, snowflakes earned and the time. Play again, or back to the arena card.

**Being frozen in a fight never costs a life:** the kid goes back to the spawn for a moment. With
no lives left (sled crashes) the stage starts again; English answers already given still count.
The friends go home after the stage, and the boosts too.

### The money: why the English decides the Showdown

| When | ❄ you can have | What it buys |
|---|---|---|
| Shop 1 | the sled's 5 word snowflakes (+1 for spelling) and the camp's 3 children: up to 9 | one boost |
| Shop 2 | Part 1: about 8–10 items, +1 each right first time | one more if it went well |
| Shop 3 | Part 2: about 12–14 items | two more |

The test checks these numbers (`tests/fights.test.mjs`). In a headless trial of the Showdown (a
simple scripted player who keeps just out of the captain's reach and throws), the captain was
frozen in time in 1 of 12 tries without boosts and in 4 to 6 of 12 with boosts. Real students
should settle the numbers: `showdown` in `FIGHT_PLANS.long` (`seconds`, `captainWarmth`,
`regenDelay`, `regenRate`, `others`, `tired`).

| Friends who join at the camp (3 at most) | Boosts in the Snow Shop (❄ 5 each, for the whole outpost) |
|---|---|
| ❄️ Quick thrower: fast snowballs, runs in | 🧤 Big gloves: 4 snowballs instead of 3 |
| 🌨️ Lobber: throws over walls | ⚡ Quick hands: snowballs come back faster |
| 💨 Sprayer: three snowballs up close | ☄️ Super start: every fight starts with half a super |
| | 🧥 Warm coat: the first hit in each fight does not count |

Only neighbourhood children join (first names like Elif, Can, Zeynep, Emir), girls and boys. Each
friend is a bot that follows the student, and a team seat a classmate could take one day.

## Look, time of day and dressing

There is no real map and there are no real streets. The arena is one purpose-built field
(`tools/build-world.mjs`), and only the look of the neighbourhood is kept round it: a cobbled lane
with old lamps, snowed-in houses with lit windows and tea on the sills, buried roofs, trees and
street stalls (chestnut, simit, çay, salep). Beyond that is a painted backdrop.

The bold look (cartoon shading, outlines, glow, a build of only the field) is the default.
`?look=v1` brings back the old diorama look.

Kasımpaşa is played in a lavender afternoon (`STAGE_LIGHT` in `brawl.js`, presets in `DAYLIGHT` in
`render/village.js`). The field (`ARENAS.kasimpasa`) is a neighbourhood square: an eyebrow wall
shielding the spawn, barricades at the heads of the side lanes, L-shaped snow walls, a crate and a
bush in the middle lane, ice on the flanks, cover on the rival line.

## The battlefield (Brawl-style principles, from the second play-test)

- **The rivals hold the outpost.** Its landmark stands at the north end of the field, behind the
  rival team; our team spawns at the south end. Until it is seized the circle shows the rivals'
  colour. Later waves come round the outpost from the camp behind it.
- **Size, from 3v3 brawler maps:** those are about 21 × 33 tiles, with heroes running about 2.5
  tiles/s and throwing 3–10 tiles. Our kids run 3.4 tiles/s and throw 5–7.5 tiles, so the same
  footprint gives the same rhythm: the field is **22 × 34 tiles**. About 6 s from spawn to the
  first fight, room to dodge sideways, cover every 4–6 tiles, about 12% of the field covered
  (walls, barricades, crates, bushes).
- **Layout:** the long axis runs up the screen (portrait-first). Three lanes, cover between them
  (something in the middle lane, so nobody throws spawn to spawn), a wall shielding the home
  spawn, cover on the rival line to fight from. Mirrored left–right, so neither flank is the
  better route. The test checks the field: the fence closes it, both teams can walk from their
  end to the outpost, and the spots the waves use are open.
- **One field per arena:** a stage builds and shows only its field and the frame round it. Later
  arenas add their own field to the world builder (one `PLACES` entry each).
- **Rival team AI:** the defenders hold their line in front of the outpost and come out to meet
  anyone within 11 m of it; the snowmen walk out to the middle of the field.
- **Camera:** the camera pulls back 10% and looks a little ahead, up the field; rivals just out of
  view show as arrows at the screen edge.
- **Environment kit** (`render/village.js`): rounded snow walls with a fat white cap, wooden
  barricades with snow along the top, bevelled crates, frosted bushes, glassy ice patches.
- **Colour:** the battlefield floor is lilac-tinted packed snow, so plain white means wall or out
  of bounds; ice is glassy blue.
- During the stage there are no blizzards or sun bursts, so the light stays steady.

## Task scenes on a phone

The answers, tiles and bricks in a task's 3D scene are labels pinned to things in it. On a narrow
screen the pinned spots can be closer than the labels are wide, so every frame the labels are
pushed apart (along the shorter way, keeping their order), kept below the task card and above
the caption at the bottom, and shrunk a little when the screen is crowded (`tick` in
`render/worldtask.js`). The castle's ice letters are as wide as their labels.

## Calm fights

From the fourth play-test: during a fight the screen shows what you need to play, and little
else. Mr. Saymaz says each line at most once and not more often than every 12 s (the HUD line
already says what to do); there is no list of who froze whom; floating numbers and "FROZEN!" only
for your own hits; no wave banners (the phase banners say it); "RIGHT WORD!" is a word at the
snowman, not a banner; at most 3 arrows at the screen edge. While a close-up is open, the game's
other panels hide.

**Word snowmen** stay in the fights, but tidy: three snowmen walk out together in a row, side by
side, slowly, in their own lanes, and never throw. The top of the screen shows a Turkish word with
its picture; freeze the snowman with the right English word ("RIGHT WORD!", +2 toward the 12, a
boost for the super). Teammates leave them to the student. Practice only.

**Rival snowmen** (`MINIONS` in `sim.mjs`):

| Type | What it does |
|---|---|
| Waddler | Slow; throws |
| Shield | A dustbin lid blocks straight shots from the front |
| Sledder | Fast, short range |
| Lobber | Throws over walls |
| Captain | Big, tough, with a crown; in the Final Showdown it warms up again after a moment without a hit |

Frozen snowmen melt away. Each one wears the rival team's colours and has a ring in that colour.

**Saves:** progress is stored per unit (`arenas[0].stages`).

## Timing

`arenaTime()` in `timing.mjs` times the real tasks the outpost deals (from the unit), using what a
Grade 5 student needs per item on the Relaxed pace (choice 7 s, listening 9 s, spelling or ordering
12 s, a match pair or sort card 5 s, plus 1.5 s of feedback per step), plus the sled ride, the camp
(35 s), three shop visits (12 s each), the opening round (60 s), the strike-back (50 s), the Final
Showdown won first time (60 s), the five places' scenes on the ride (about 9 s each) and the
moments between. For Grade 5 Unit 1 that is about **9.3 minutes** (the ride 95 s, the English
196 s for 24 items, the rest 260 s); five outposts and a Showdown came to about 32. The test keeps it between 7 and 13 minutes. Real play with students
should confirm the per-item seconds.

**Test links:**
- `?family=` changes the task type everywhere.
- `?pace=challenge` turns on the timer.
