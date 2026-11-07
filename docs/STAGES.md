# Arena 1: Kasımpaşa (M3)

(Arena 2, the Golden Horn, and Arena 3, Downtown, are built the same way: see `docs/ARENA-2-GOLDEN-HORN.md` and `docs/ARENA-3-DOWNTOWN.md`.)

From Mr. Saymaz's fifth talk: **one outpost per arena**. Arena 1 is Kasımpaşa; later arenas (for
example İstiklal Street) are built the same way. The neighbourhood's places are no longer separate
outposts: they are all part of the Kasımpaşa outpost, each with its own English task in its own
scene, and there is no sled travel between them. That brings the arena from about 32 minutes to
about **9** (see Timing), with every task type still in it.

| Place | English task | Its task scene | On the carousel | On the sled ride in |
|---|---|---|---|---|
| Boulevard Park | Answer | the treehouse | the treehouse | a cinematic view |
| Archery Ground | Sorting | the archers' lodge | the archers' lodge | a cinematic view |
| Kızılay Square | Matching | the fountain | the fountain | a cinematic view |
| Sururi Park | Builder | the snow castle | the snow castle | a cinematic view |
| The Pier | Listening | the waterfront | the admiral's statue | a cinematic view |

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

## The sled ride: the rules

Each ride is about two minutes (`seconds: 72` of riding plus the views, measured about 125 s) and
is built from one seed by `plan()` in `sledrun.js`, so the same rules hold in every arena.
- **Sections:** the track is cut into sections, one more than there are views: section, view,
  section, view … section. Each section opens with the thing it introduces and keeps everything
  met before it: 1) snowball trails and lane changes, 2) jumps over fences and high snowballs,
  3) ducks under lines and branches, 4) ramps, 5) pairs (two lanes blocked at once). One section
  in the middle is the letter section and is longer.
- **Beats:** things that need a move come one beat apart, and a beat is always enough time to react
  at full speed: 1.5 s (relaxed) or 1.15 s (Challenge), a little random, plus a bit more when the
  move changes (a jump after a duck). Every fourth beat is a breather with only snowballs.
- **Snowballs are where the moves are,** not only in the safe lane: trails to steer along, arcs over
  fences (jump to get them), low ones under lines and branches (duck to get them), lines held high
  (jump), and big arcs after a ramp. Fifteen in a row without a crash: "Streak 15! +2".
- **Word flakes** (the purple snowflake with the word on a tag): one per section from the second,
  always at the top of an arc, so getting one is a little reward for a jump or a ramp. Never two
  within 45 m of each other. Every one can be caught: a ramp's arc is planned for the section's
  speed and fitted again at take-off to where the sled will really fly (`fitArc`), and a snowflake
  has a little more reach than a snowball. An autopilot test rides each arena and catches all five.
- **Letters:** the first letter is given on the spell panel. A row of three letters every three
  seconds, the right one and two different wrong ones; the sled goes 15% slower in this section.
- **Ramps:** a blue plank rising ahead with yellow rails, chevrons and a flag on a snow mound, so it
  never looks like an obstacle. Riding up it throws the sled high (a short slow motion at the top)
  and the first time "RAMP! Ride up it" shows. In the air, a tap (or swipe up, the up button, T or
  Enter) spins the sled: "Spin! +3" if it lands round.
- **Roller-coaster:** every section without letters has a dip and a rise (about 3.4 m); the ground
  before a view is flat and straight.
- **Pace:** 3.5% faster each section (up to four), faster downhill, 6% faster tucked (ducking);
  speed lines when tucked or flying.
- **Bonuses:** "Close! +1" for changing out of a lane just before its obstacle, "Perfect section! +5"
  for a section without a crash. A crash ends the streak.
- **First ride:** a short hint the first time each thing comes ("JUMP! Swipe up", "DUCK! Swipe
  down", "RAMP! Ride up it", "TAP to spin!"); on a touch screen it starts with "SWIPE ← → TO STEER".
- **No buttons on a touch screen:** swipes and taps only, so nothing covers the track (the arrow
  buttons stay for a mouse).
- **On screen:** remarks, hints and bonuses use Fredoka (self-hosted, `public/fonts/`), in their own
  spot in the ride's display, below the spell panel on short landscape screens.

## The places on the way: cinematic views on the sled ride

The ride into Kasımpaşa passes each place in task order, and at each one the camera turns, for
about 7 seconds, to a grand view of it (`render/cinema.js`): the landmark in its own little
neighbourhood under its own sky and light. They are views, not tasks: no people, nothing to do.
- **The neighbourhood** is a purpose-built tile layout drawn by the game's own village renderer,
  so it looks like the arena and uses the same landmark models as the carousel: a square plaza
  round the landmark, a lane with old lamps (never between the camera and the place), snowed-in
  houses with lit windows closing the back and the sides, trees, stalls, buried roofs; the side
  towards the track stays open so the camera can look in. The landmark's flag flies in the
  place's colour.
- **The town beyond** (`townscape` in `render/cinema.js`): the ground round the place is flat;
  beyond it the land rises into rolling snowy hills, and Istanbul-style neighbourhoods climb the
  slopes: hundreds of pastel houses with snowy roofs facing the place, their windows lit more and
  more as the ride goes from afternoon to dusk, with gaps between the neighbourhoods. Groves of
  snowy pines, tall dark cypresses and round trees; an old stone tower with a balcony and a
  conical cap on a far hill, off to one side. At the Pier the frozen Golden Horn stretches north
  to a far shore covered in houses. Far things take on the colour of the haze, so the hills step
  back into the distance; nothing stands by the track.
- **The sky:** a gradient with a glowing sun, a haze along the horizon, soft clouds lit by the
  hour, gulls circling, falling snow, the scene's own low sun with long shadows.
- **Three shots:** a reveal (in along an avenue, past the record stones, across the square), a
  slow orbit round the landmark, then a rising pull-back over the neighbourhood and the town.
- **The light warms along the ride:** Boulevard Park a clear blue afternoon, Archery Ground bright
  late afternoon, Kızılay Square lavender with the lamps coming on, Sururi Park golden hour, the
  Pier sunset with the lamps lit.
- **Each place has its own short theme** over the ride's sleigh-ride tune, turned down
  (`audio.js`): Boulevard Park a music box, Archery Ground a saz-like tune in Hicaz with a frame
  drum, Kızılay Square a café tune in Nihavend with a tambourine, Sururi Park a bouncy xylophone
  with claps, the Pier a ferry's horn then warm chords and a slow bell tune.
- **On the ride:** the views are joined to the ride, not cut in. The ground never changes: about
  2.6 s ahead the lanes empty, a roadside sign ("← Look left!") stands by the track and "LOOK TO
  THE LEFT! ←" shows on screen; the sled slows to 60% and rides itself; the camera turns its head
  to the left over about 1.2 s, glides through the shots, and glides back for the last 1.4 s
  ("GET READY!"). No black bars (a soft vignette instead), the name card on screen for 3.4 s, and
  no names read aloud: the place is seen on its sign, not heard. After a view there are always
  three seconds of empty lanes before the next thing to dodge. A tap skips a view already seen
  this session (straight to its turn back); with reduce motion, one held wide shot.
- The five views are built when the ride starts (under a second on a laptop), shown only near
  their stretch, and their geometry is freed after.

| Place | The view |
|---|---|
| Boulevard Park | down an avenue of old plane trees to the treehouse fort; up and round to the fort; back over the park |
| Archery Ground | up past the white marble record stones; round the lodge's porch with the low sun behind; the ground and the town beyond |
| Kızılay Square | across the square to the tiled fountain kiosk, simit, tea and corn stalls; round the kiosk; up over the square |
| Sururi Park | in past the slide to the snow castle, swings and the giant snowman; round the towers; high over the park |
| The Pier | the admiral and his lion against the sunset, signal flags on their ropes; round the statue; out over the frozen Golden Horn, the ferry in the ice and the far shore |

### The finale: arriving at the carousel

When the ride ends, the camera arrives over the real Kasımpaşa field before the student takes
over (`startIntro` in `brawl.js`, about 8 s): a soft vignette (no black bars), the name card ("ARENA 1 · THE
OUTPOST / Kasımpaşa") for about 4 s, and Mr. Saymaz's line as a subtitle only, not read aloud:
"Welcome to Kasımpaşa! Let's take it back!".
- **0–3 s:** high over the field and the rooftops, coming in from the south: the snowbank fence,
  the cover, the camp's children waiting, and at the far end the carousel ringed in the rivals'
  colour, the rival team lined up in front of it.
- **3–6.4 s:** low round the carousel as it turns faster than usual, its five landmarks passing
  the camera in task order under the KASIMPAŞA sign.
- **The last 2 s:** the camera glides down into the game's own view behind the team at the south
  end; a cheer, and the stage begins (the camp's coach line and the banner wait until then).
- **Music:** a cheeky fairground waltz in D minor on a little organ (oom-pah-pah).
- Nothing in the fight moves meanwhile; health bars, rings, the HUD and the town's gulls (on the
  low arc) stay out of the shot. The rival team goes back to its camp afterwards (no rivals on the
  field during the camp). A tap skips to the last 2 s once it has been seen this session; with
  reduce motion, one held wide shot.

## The stage, start to finish

1. **The arena card:** "Arena 1 · Kasımpaşa", the stars for the stage (of 3) and the first-try
   score against the 80% goal.
2. **The sled ride in** (50 s of riding plus the places' scenes, `sledrun.js`, the Kasımpaşa
   theme: kiosks, plane trees, targets, snow castles; see "The places on the way" above), ending
   with the arrival at the carousel (see "The finale" above). Swipe or use the arrow keys or the buttons: left and right steer, up jumps
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
- **Words beside their things, not on them:** a scene marks the things the words must not cover
  (`keepClear`: the Pier's gulls, Cihangir's cats, Tophane's clock faces) and the labels are pushed
  off them, so each word sits next to its thing and the thing stays in view. Tophane's words sit to
  the right of a column of clock faces (portrait) or under a row of them (landscape).
- **The action shows:** when the answer's little scene plays (the gull catches the simit and flies to
  the bell, two cats curl up together, the clock face lights up), the step's words fade out of its
  way (`hush`).

## The fight's HUD on a phone

Nothing sits on top of anything else (portrait): the mini-map, the score with the objective on one
line (no place name: in a stage there is only one place) and pause along the top; under the map the
Map button and the hearts side by side; down the right the shop's ❄ and the flakes; Mr. Saymaz in
a slim strip under the top row (three lines at most), hidden while you are frozen, because the screen
already says "Frozen! Back in 3…". The arrival at the carousel has no black bars either, only a soft
vignette.

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
moments between, and the arrival at the carousel (about 8 s). For Grade 5 Unit 1 that is about **9.5 minutes** (the ride 95 s, the English
196 s for 24 items, the rest 260 s); five outposts and a Showdown came to about 32. The test keeps it between 7 and 13 minutes. Real play with students
should confirm the per-item seconds.

**Test links:**
- `?family=` changes the task type everywhere.
- `?pace=challenge` turns on the timer.


## The cinematic layer (all three arenas)

Every view on the sled ride shares one layer that makes it a picture:
- **Framing:** a longer lens in landscape, so the landmark fills the frame and its skyline draws close behind it (portrait keeps the wider lens so tall landmarks fit). A soft vignette and a slight warm grade sit over the views and the arrival at an outpost, and the camera has a gentle handheld drift.
- **Light:** warm pools of lamplight on the snow, halos round the strung bulbs, a soft floodlight on the landmark at dusk (Istanbul lights its monuments) or a warm bounce by day, stars over the evening and night views, and soft shafts of light from a low sun at golden hour.
- **Life in the snow:** chimney smoke drifting up from the town, drifts banked round the square, sled tracks and footprints leading in to the place, and glitter in the foreground snow.

## Smooth on phones: the ride made ready ahead

The sled ride and its places' scenes used to stutter on phones as a place came near. That was not downloading, since everything is drawn in code. It was the GPU compiling shaders and receiving shapes and pictures mid-ride. Now:
- **Prepared on the map:** while the stage map is shown, the next stage's ride and its five scenes are built, one scene per frame so the map stays smooth. If the player taps the arena before it is ready, "Getting the sleds ready…" shows until it is.
- **Warmed up:** once built, every shader is compiled and every shape and picture is handed to the GPU in one hidden draw (with nothing culled and the ride's hidden things shown for that draw). So nothing compiles or uploads during the ride. Measured on Downtown: 91 shaders and about 250 pictures used to load mid-ride; now none do.
- **Fixed lights:** the ride's lights never change. The sun always casts shadows, but on the track its shadow camera looks at nothing and is not redrawn. Two lamps wait at zero for each place's floodlights. The neighbourhood's own lamps are left out of the scenes. A light or shadow switched on or off would make every shader recompile.
- **Fewer draws:** each scene's still pieces are merged into one mesh per look, and the moving ones (cats' tails, pigeons, flags, pennants, gulls) stay separate. The string lights twinkle by their colours rather than their sizes, and their glow is one cloud of points. One of each obstacle, each word's tag and each spelling letter are made before the ride, not as they come into view.

## The snowball style, in the Snow Shop

The style (Quick Thrower, Lobber, Sprayer) is chosen in the Snow Shop, before and after each fight,
not on the start screen: three slim buttons in the shop's bar, with Fight! under them in the bottom left corner (on a short landscape screen the whole bar sits in the bottom left corner, clear of your kid). Picking one changes your kid's
hat at once (beanie, earmuffs, cap) and plays a short show while the price tags step aside and
the camera pulls back: the Quick Thrower throws three fast straight snowballs at a snowman, the
Lobber lobs two high over a snow wall, the Sprayer throws three at once in a fan, twice. The choice
is saved and used for the rest of the game.

## The start screen on a phone

Nothing scrolls, on small phones or with large text: the arena cards are one picture each with the
name on the sky (the carousel with its ship's mast and anchor for Kasımpaşa; the great chain across
the Golden Horn at sunset with an old sailing ship; Galata Tower and the red nostalgic tram for
Downtown, drawn for the game), Girl / Boy, the lesson and the pace are slimmer, and on a narrow
screen the pace is one button that switches between Relaxed and Challenge.

## Mr. Saymaz's guide (first-time players)

The first time a player meets each part of the game, Mr. Saymaz steps in from the side (`guide.js`,
his pictures in `public/img/saymaz/`: presenting, thumbs up, pointing, cheering, thinking, and his
portrait on the card) with a speech card: a title, one short idea in simple English, a small moving
picture of the gesture (swipe, swipe up and down, tap, drag, the thumb stick) and a spotlight on the
button he talks about. The game holds still meanwhile (a task scene stays on screen). Next / Skip,
dots for the cards; each guide shows once on this device (`save.guides`), and **How to play** in the
pause menu shows the main cards again.

| When | What he says |
|---|---|
| The first map | hello and the story; English gives ❄ (more when right first time); how a stage goes |
| The first sled ride | steer (swipe or ← →); jump and duck; ramps, purple snowflakes, spin; spell the word (first letter given); look to the left |
| The first camp | walk (thumb on the left half, or the map); walk up to the kids and answer them |
| The first Snow Shop | your ❄; tap a price tag; try the snowball styles; Fight! |
| The first fight | move; tap to throw, drag to aim; the super; freeze rivals (frozen is fine) |
| The first task | read at the top, tap the answer in the scene; mistakes are fine, the right answer glows |
| Holding the circle, the captain | one card each |

He never stands on the button he points at: for a button at the bottom left he steps over to the
right, for a wide row at the bottom he stands on top of it, and the card moves out of the way.
Mr. Saymaz's coach strip stays quiet while he is talking. Automated test browsers skip the guides
(they cannot press Next) unless the address has `?guides=on`.

## The logo and the icons

- **Logo** (`public/img/logo.webp`, from the artwork Mr. Saymaz chose: him with a snowball beside
  SNOWPAX and "by Mr. Saymaz"): cut out of its white background (the navy outline makes a clean
  edge), shown at the top of the start screen in place of the 3D kid, with a little drop-in and a
  slow float (still with reduce motion).
- **Icons** (`public/icons/`, from his portrait with a snowball on purple): the iPhone home-screen
  icon (180 px), 192 and 512 px icons and a maskable 512 px one (the picture at 82% on its own
  purple, so round masks keep the snowball) in `manifest.webmanifest` (name, colours, standalone);
  the browser tab uses a close crop of his face (16, 32 px), which still reads when tiny.

## Your own kid stands out

Teammates and rivals show their side by their team colour; the student's own kid has its own marks:
- **A little bigger** (×1.12), with the same hit area (that lives in the simulation).
- **Violet**, which no team wears: a big violet pom-pom (a violet band and earmuffs for the
  Lobber, a violet pom-pom on the cap for the Sprayer), a violet scarf and tie, seen from the high
  camera whichever way the kid faces. The Lobber's scarf is apricot now, so violet is the student's alone.
- **A bold gold ring** with a navy edge round the feet, breathing a little, and a gold arrowhead
  on it pointing the way the kid faces. Only the student's kid has a ring.
- **Seen through walls**: wherever a wall, a tree or a roof stands in front of the kid, a light
  silhouette in the team's colour shows through (drawn against the world only, before the kid, so
  the kid's own arms never show through it).

## Hits that land

- **Hit-stop**: when the student hits someone or is hit, everything holds for a moment (45 ms; a
  freeze 110 ms).
- **Splats** on the snow where snowballs land (bigger for lobs and the super), fading after 5–7 s.
- **A freeze shatters**: a burst of icy-blue shards that spin and bounce on the snow, a frosty ring
  rolling out, and splats round it; a freeze the student makes leans the camera in a little.
- **A hit wobbles** the kid it lands on, on top of the squash and flash.
- With reduce motion: fewer shards, no ring, no camera lean and no wobble.
