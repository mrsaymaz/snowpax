# Task scenes

## Task stations (inspired by Languini)

Each outpost plays its own task family as a **station**: a staged 3D set of its own fills the
screen, like Languini's stations, and a snow flurry covers the cut in and out.

- **The fight** goes on in slow motion (a quarter speed) meanwhile, and rival hits never chill the
  bar while a station is open.
- **The card becomes a slim strip along the top:** title, coach line, progress, timer, read-aloud,
  Step out. The prompt and then the answer show in a caption at the bottom.
- **Words sit on 3D things** as HTML labels pinned to them every frame (`render/worldtask.js`),
  so they stay sharp, tappable and readable aloud.
- **Stations work anywhere,** including the Showdown, where each banner opens its own outpost's
  station.
- **The flat card** is still used for cocoa questions and any other kind of step, in the card
  lab, and with `?scenes=basic`.

(An earlier version played the tasks on the real landmark in the arena, with the camera swooping
in. It was removed in favour of the stations.)

**The stations, one per outpost and its task family** (`cards/castle3d.js`, `cards/stations.js`,
shared pieces in `cards/stationkit.js`):

| Outpost · family | Station |
|---|---|
| Treehouse · Answer | Birdhouses hang from a snowy branch, each with an answer sign. Tap one and a snowball flies at it: the right one bursts into confetti, a wrong one swings. |
| Archers' Lodge · Sorting | Category titles over archery targets, in front of a log lodge. Pick an arrow card from the rack, then a target. The arrow flies and sticks, and the word joins the list under the target. A wrong target and the arrow bounces off. |
| Kızılay Fountain · Matching | Ice tiles on the frozen fountain. Tap a word, then its match, and a golden skate trail carves across the ice and the tiles turn mosaic colours. A wrong pair leaves a red trail that fades. |
| Snow Castle · Builder | Snow bricks onto the castle wall, which grows a course with every sentence (above). |
| Admiral's Bell · Listening | A pier on the frozen Golden Horn, a ferry and the far shore. Ring the bell to hear the word. Gulls carry the answers; the right gull flies to the bell and rings it. |

**Polish shared by every station:**
- **Your own kid:** the player's girl or boy in their team jacket and kit hat stands in the station.
  They throw the snowball, shoot the arrow, toss the brick, ring the bell, cheer on a right answer
  and shrug on a wrong one.
- **The look:** a painted distance behind every set (snowy hills, pines and the Istanbul skyline),
  snow that sparkles, a warm sun with a cool rim light, falling snow.
- **Right answers:** a gold star flies from what you tapped into the progress bar, and the camera
  nudges in a little.
- **Faces:** the kid turns round to look at you with a joyful face (eyes squeezed into smiles,
  a big open smile) when they cheer, and a surprised one (wide eyes, raised brows, an O mouth)
  on a miss, then turns back. `setKidMood(kid, 'happy' | 'joy' | 'surprised')` in `kids2.js`.
- **Sounds:** a swish on every throw or toss, a splat when a snowball lands, a thunk when an
  arrow sticks, gull calls now and then on the pier and when the right gull flies, a fanfare and
  firework pops at the end. All synthesized in `audio.js`, so nothing is downloaded.
- **The round is done:** fireworks in the team's colours burst over the landmark, the kid does a
  long cheer, the bell rings at the Waterfront, and the caption says "Outpost seized!" (or "All
  five banners are up!" in the Showdown). It lasts 1.8 s before the camera goes back to the fight.
  The arena time model counts it, and comes to 12.0 minutes.
- **First time at a station:** a finger visits every option in turn, the same way for each,
  so it shows how to answer, never which answer. It stops as soon as you tap.

Inside a station, the coach bubble and the "New rivals!" card stay hidden (the strip carries the
coaching), and so do the arena's damage numbers. Cocoa questions and any other kind keep the card.

A station scene is a scene function that also gets `ctx.world` (a session):

| | |
|---|---|
| `frame(eye, look)` | the camera pose, in the station's space |
| `step`, `persist` | groups for this step's things / things that stay for the whole visit |
| `label(html, { obj, at, onTap })` | an HTML label pinned to a 3D object |
| `measure(el)`, `pxPerMeter()` | to size 3D things to their words |
| `fly(obj, to)`, `wobble(obj)`, `puff(obj)` | arcs, wrong-answer hops, snow puffs |
| `say(html)` | the caption at the bottom |

Register it in `WORLD_SCENES` (`cards/scenes.js`), and its set builder in the `stations` map in
`brawl.js`.

## Card scenes

The task card is a **shell** with a **scene** in it (inspired by Growbloom's garden tasks and
Wordramp's road tasks: the English item stays the same, answering it is an action in the place).

- **Shell** (`src/game/taskcard.js`): header, progress bar, Challenge timer, read-aloud, coach
  line, Step out, and the scoring. Every item is still reported once, right first time or not,
  so the 80% rule is unchanged.
- **Scenes** (`src/game/cards/`): what sits in the card's body for one step.
  - `basic.js`: the default layout for each step kind (choice, listen, match, sort, order, spell).
    It is always the fallback.
  - `castle.js`: the Snow Castle (Sururi Park, Builder).
  - `scenes.js`: the registry. `sceneFor(kind, theme)` picks the landmark scene for the card's
    theme, or the default.
- **Showdown:** each banner's tasks use the scene of the outpost the banner belongs to.

## Writing a scene

A scene is a function `scene(ctx)`. It may set `scene.cls` (a class for the card body) and may
return a clean-up function. `ctx` gives it:

| | |
|---|---|
| `step`, `body`, `theme`, `rng` | the step, the element to draw in, the landmark, the random source |
| `item(id, rightFirstTry)` | report one item (exactly once per item) |
| `finish(delay)` | the step is done |
| `reveal(text, tr)`, `coach(text)`, `note(text)` | the answer line, the coach line, a small note |
| `onTimeUp(fn)` | what to do when the Challenge timer runs out (finish the step, show the answer) |
| `later(fn, ms)` | a timer that is cleared when the step ends |
| `sound(name, opt)` | a sound (`'note'` with `{ freq }` for bell notes) |
| `speech`, `busy`, `reduceMotion` | the voice, whether the card is finishing, the motion setting |

Rules every scene keeps (from Wordramp):
- Tapping always works, as well as any dragging or flicking.
- The scenery never hints at the answer. A glow shows the right piece only after a miss.
- Wrong answers never cost lives; they lose first-try credit and the task goes on.
- Reduced motion turns off the flying and wobbling.
- It fits a 640×360 phone.

Register it in `LANDMARK_SCENES` under the outpost's theme and the step kinds it handles.

## The Snow Castle (Sururi Park · Builder)

- **Put the blocks in order:** the sentence blocks are snow bricks. Tap them in sentence order.
  Each right brick flies onto the castle wall with a rising bell note.
- **Spell the word:** ice letters drop into the mould over the gate the same way.
- **Finished:** the castle's flag rises, the sentence or word is read aloud and the answer shows
  with its Turkish meaning.
- **A wrong brick** wobbles and stays in the pile, and the right one glows. The item is no longer
  right first time.
- **Time up:** the rest of the bricks lay themselves.

## Card lab

`cards.html` shows any task family in any landmark's scene, outside the game:
`cards.html?family=build&theme=sururi&unit=g5u1&seed=3`. In the game, `?scenes=basic` shows the
plain cards everywhere, to compare.

## Card scenes still to make (the flat fallback)

| Outpost · family | Scene |
|---|---|
| Treehouse · Answer | snowball the right birdhouse |
| Archers' Lodge · Sorting | arrows into category targets |
| Kızılay Fountain · Matching | skate trails on the frozen fountain |
| Admiral's Bell · Listening | gulls carry the words to the bell |
| Hot cocoa | pour into the right mug |
