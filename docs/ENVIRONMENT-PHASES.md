# Making the snow world eye-catching: two phases

Agreed with Mr. Saymaz. Phase 1 is look and atmosphere (no change to the rules); Phase 2 changes
how the game plays, so it lands with M3.

## Phase 1: done

- **Late afternoon to dusk.** The light starts as a low warm sun with long blue shadows and slides
  to dusk over the first five minutes of a match. Windows, lamps and lanterns grow brighter.
  (`?dusk=0..1` previews it.)
- **Street lamps.** About 60 old lamps stick up out of the snow along the paths, each with a
  warm pool of light.
- **Istanbul life.**
  - Seagulls perch on roofs, lamps, the pier and the ferry, and fly off when a kid comes close.
  - Street cats sit by warm chimneys and turn to watch you pass.
  - Frozen, colourful laundry hangs on lines.
  - A simit cart stands at Kızılay Square, a bakery (Fırın) glows near Our School, and tea
    glasses steam on window sills.
  - A few animals near the player stand in for many: far-away gulls fly in and far-away cats
    move to chimneys out of view.
- **Footprints and powder.** Kids leave trails that fade after 14 s. Running on open snow kicks
  up powder, and a freeze bursts it.
- **Who holds each outpost.**
  - A ring of lantern strings round every plaza is warm amber while the outpost is free.
  - It flashes in the holder's colour when taken, then stays that colour.
  - Chimney smoke nearby and the snow round the plaza take the holder's colour too.
- **Painted skyline.** The start screen is dusk over the frozen Golden Horn: the far shore's
  domes and minarets, Galata Tower, a ferry in the ice, snowy rooftops, laundry, gulls and a cat
  (`tools/build-skyline.mjs` makes `public/skyline.svg`).
- **Map fixes.**
  - The Waterfront pier now runs from the plaza out onto the ice, with the ferry alongside.
  - The map reaches further south, so the outpost isn't squeezed against the edge.
  - Snow and ice carry on past the edge of the map.

## Phase 2: done

- **Hills and sled runs.** There are three round snow hills with one-way sled runs down them:
  - **Archery Hill:** from the Archery Ground down to Our School.
  - **Boulevard Run:** from Boulevard Park down the valley to Kızılay Square.
  - **Sururi Run:** from Sururi Park down to Kızılay Square.

  Step onto the start pad heading downhill (or wait on it) and the sled takes you down fast.
  - You can still throw on the way down, but getting frozen knocks you off.
  - Bots use the runs too, when riding is quicker.
  - Each run has a packed track with grooves, snow banks, red marker poles, a start gate with
    English signs ("SLED RUN", "to Our School") and a soft pile at the bottom.
- **Things to collect.**
  - About 40 glowing snowflakes lie along the paths. Only the student collects them, and the
    all-time total is kept in the save (the ❄ counter at the top right).
  - About 10 hot-cocoa cups give anyone +40 warmth and come back after 25 s.
- **Snow sliding off.** A snowball that hits a roof, a tree or a lamp brings its snow down on
  rivals standing below: a little cold (-6) and slow for a second. A small pile stays for a while.
- **Poyraz wind.** Every 25–45 s a north-east gust blows for 6 s. It pushes snowballs sideways
  and sends streaks of powder across the snow. Banner: "POYRAZ!".
- **Weather.**
  - **Blizzard (18 s):** you can't see rivals more than 7 steps away, the world goes white and
    the snow falls heavier.
  - **Sunshine (15 s):** you warm up 1.6× faster, in brighter, warmer light.
  - Each comes with an English coach line.
- **Previews:** `?at=archery-run` (or another run id) starts at a hilltop.
  `?weather=blizzard|sun|gust` forces the weather.
- All of this happens only in the Arena 1 world; the small feel-test arena stays calm.
