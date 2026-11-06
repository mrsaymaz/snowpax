# Arena 2: The Golden Horn (Haliç)

Mr. Saymaz's choice after Kasımpaşa: the second arena runs up the Golden Horn from its mouth.
It opens when Kasımpaşa is won (for the unit being played). It plays exactly like Arena 1 (see
`docs/STAGES.md`): the sled ride in with a cinematic view at each place, the camp, three shops,
the opening round, Part 1, "They strike back!", Part 2, the Final Showdown, results.

| Part | Place | Task | On the outpost and on the ride |
|---|---|---|---|
| 1 | Karaköy Bridge and Pier | Listening | the bridge on stone piers with its row of fishermen's rods and buckets, the ferry pier hall with its clock, a ferry at the quay (a clear blue morning) |
| 1 | Bankalar Caddesi | Sorting | the street of grand old banks: the great stone bank building (today Salt Galata, shown without its sign), rusticated ground floor, columns, lit arched windows, the bronze door, a balustrade under snow (bright noon) |
| 2 | Tersane İstanbul | Builder | the old shipyard and its new open-air promenade: the restored brick workshop with tall arched windows and its chimney, a dry dock with a ship, a crane, a glass canopy over a café terrace and a lit shop front, string lights (golden afternoon); shops never carry real names |
| 2 | Aynalıkavak Pavilion | Answer | the waterside pavilion on its stone base, wide eaves, rows of mirror-bright windows, cypresses, a pool, lamps at the steps (pink sunset) |
| 2 | Miniatürk | Matching | the park of little models on snowy lawns: an old stone tower, a tower on a rock in the sea, a clock tower, a little bridge, the big sign at the back; no models of places of worship (dusk, the lamps lit) |

**The outpost: the Golden Horn itself** (`buildHorn` in `render/snowtown.js`). A big stone table
with a model of the Golden Horn: the frozen water winding inland from its mouth at the front left,
ice floes, a little ferry going up and down, the five places as miniatures along its shores in
task order, and across the mouth **the great chain** hanging between two stone towers (the
Byzantines closed the Golden Horn with a chain), the outpost's flag on the north tower, the
"HALİÇ · The Golden Horn" sign at the front. It works like Arena 1's carousel: the ferry sails to
the place being played, a place lights up in the team's colour when its task is done, lit places
lob snowballs at the rivals in the fights, and with all five lit the chain glows.

**The field** (`ARENAS['golden-horn']` in `tools/build-world.mjs`): the quay, with cargo crates,
mooring barricades, wide ice and stone bollard blocks; the frozen water north of the field with a
ferry and a pier; fish, simit, tea and chestnut stalls behind the home spawn. Its own sled theme
(`goldenhorn`: bollards, lamps and houses along the frozen water) and waves (lobbers from the quay;
the Final Showdown with the captain, two shield snowmen and three rival kids). Played in golden
light.

## The task scenes (`cards/golden.js`)

Each place's English task opens in its own staged 3D set, scored exactly like the flat card (one
item per question, pair or card; right first time or not; a miss glows the right one):

| Place | Task | The scene |
|---|---|---|
| Karaköy Bridge and Pier | Listening | Under the bridge on the frozen Golden Horn (its railing, lamps and the row of fishermen's rods above, the ferry in the ice, the pier hall, the far shore). Fish peek out of holes in the ice, each with a word. Hear the word ("Hear it again" sits high, clear of the holes), cast your line to that fish: it leaps out onto the ice in a sparkle; the wrong one dives with a splash. |
| Bankalar Caddesi | Sorting | In front of the great stone bank (columns, lit arched windows, the bronze door, plane trees, lamps). Round steel vault doors with brass wheels stand on legs, one per category. Pick a card, then its vault: a gold coin spins in and the wheel turns; a wrong one clinks off the rim. |
| Tersane İstanbul | Builder | The old shipyard: a ship in the dry dock (red bottom, navy hull, portholes, a mast with the team's flag), the brick workshop with its arched windows and chimney, two cranes, the promenade's glass canopy and café tables. The sentence is built onto the deck plank by plank; spelling lays ice letters the same way. |
| Aynalıkavak Pavilion | Answer | The pavilion's front at sunset: stone base, wide eaves on brackets, cypresses, the pool. The answers are on its mirror-bright windows: snowball the right one and it flashes like a mirror in the sun; a wrong one gets a splat of snow. |
| Miniatürk | Matching | A snowy lawn inside a hedge among the models (a round stone tower, a tower on a rock in a pond, a clock tower, a little suspension bridge, the big sign): the matching game on little cream signs, a golden path between each pair. |

The flow uses a place's own scene when it has one (`places` on the stage, `WORLD_SCENES` in
`cards/scenes.js`), otherwise the task family's first-arena scene.

**Still to come:** the places' music borrows the first arena's themes.
