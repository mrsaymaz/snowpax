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

## Phase 2: with M3

- Gentle slopes down to the Golden Horn, with sled lanes as fast routes between outposts, and
  sled trails in the snow.
- Things to collect along the paths (glowing snowflakes, hot-chocolate cups), saved with the
  progress.
- Snow sliding off roofs and branches when a snowball hits them.
- Wind gusts that blow sheets of powder across the open snow.
- Weather events during a match: a short blizzard (harder to see, better hiding), a burst of
  sunshine.
