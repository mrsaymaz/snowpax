# Task scenes

## 3D actions on the landmarks (inspired by Languini)

Where a landmark has a world scene, the English task is played as a 3D action on the real landmark
in the arena, not on a card:

- **Camera:** it swoops in to the landmark and back when the task ends.
- **The fight goes on in slow motion around it,** at a quarter speed. While the task is on, rival
  hits never chill the bar, and teammates standing in front of the landmark fade out of the way.
- **The card becomes a slim strip along the top:** title, coach line, progress, timer, read-aloud,
  Step out. The prompt and the answer show in a caption at the bottom.
- **Words sit on 3D things** as HTML labels pinned to them every frame
  (`render/worldtask.js`), so they stay sharp, tappable and readable aloud.
- **Fallback:** the flat card scene is used when the student is not at that landmark (for example
  a Showdown banner far from the castle), in the card lab, and with `?scenes=basic`.

**The Snow Castle (Sururi Park, `cards/castle3d.js`):**
- A wooden scaffold beam spans the castle front, with ghost bricks showing where the new course
  goes.
- Snow bricks carrying the sentence blocks lie on the snow in front. Tap them in sentence order:
  each flies up onto the beam with a rising bell note and a puff of snow.
- A wrong brick hops and wobbles, and the right one glows.
- The finished sentence raises the flag, and the course drops into a snow wall in front of the
  castle that grows with every sentence of the visit.
- Spelling lays ice letters the same way.

A world scene is a scene function that also gets `ctx.world` (a session):

| | |
|---|---|
| `frame(eye, look)` | the camera pose, in the landmark's local space |
| `step`, `persist` | groups for this step's things / things that stay for the whole visit |
| `label(html, { obj, at, onTap })` | an HTML label pinned to a 3D object |
| `measure(el)`, `pxPerMeter()` | to size 3D things to their words |
| `fly(obj, to)`, `wobble(obj)`, `puff(obj)` | arcs, wrong-answer hops, snow puffs |
| `say(html)` | the caption at the bottom |

Register it in `WORLD_SCENES` (`cards/scenes.js`).

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

## Next scenes (to become 3D actions too)

| Outpost · family | Scene |
|---|---|
| Treehouse · Answer | snowball the right birdhouse |
| Archers' Lodge · Sorting | arrows into category targets |
| Kızılay Fountain · Matching | skate trails on the frozen fountain |
| Admiral's Bell · Listening | gulls carry the words to the bell |
| Hot cocoa | pour into the right mug |
