# Task scenes

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

## Next scenes

| Outpost · family | Scene |
|---|---|
| Treehouse · Answer | snowball the right birdhouse |
| Archers' Lodge · Sorting | arrows into category targets |
| Kızılay Fountain · Matching | skate trails on the frozen fountain |
| Admiral's Bell · Listening | gulls carry the words to the bell |
| Hot cocoa | pour into the right mug |
