# SnowPax · Ulti points and the English League

Ulti points live only in Mr. Saymaz's English League (the tally system). A stage won with good
English adds Ulti points to the student's **(grade, team)** pool in the League's Battle Arena, where
stronger teams hit harder. The League decides every point value, how long points last and the daily
limits; SnowPax only says which win it claims. It never sends a points value and holds no key or
secret. This game's League id is **`snowpax`**.

Ulti points are not a currency in the game: they cannot be spent, and nothing about them is kept in
the browser except the League's last reply (to show it offline), the start tickets of runs in
progress and an outbox of wins waiting to be sent. The ❄ snowflakes stay the game's own money for
the Snow Shop.

## Which wins are claimed

- **A stage won**: its outpost held after the Final Showdown (Kasımpaşa, The Golden Horn or
  Downtown), with real English in that stage:
  - **Relaxed: at least 60%** of the stage's tasks right first time.
  - **Challenge: 2 or more stars**, which means at least 70% right first time.
- Never claimed: a run lost to zero lives (the next try is a new run with a new ticket), an
  abandoned run, a stage without a team. A win below the rule says why on the results card, in one
  line ("Ulti points need 60% right first time (you got 52%). Try again for your team!").
- Replays of a stage won before count again (the League's daily limits decide how many).
- Stars, snowflakes, boosts and arena unlocks are separate from Ulti points, saved in the browser as
  before.

## Configuration

`public/config.js` sets
`window.SNOWPAX_CONFIG = { ultiApi: 'https://mrsaymaz.netlify.app/api/ulti' }`.
It is not bundled, so it can be changed on the server without building the game again. With
`ultiApi: ''` the copy is practice-only: no Ulti on the team buttons, no League button, no Ulti line
on the results card or the map, no network requests at all. If `config.js` is missing, the League
URL is used.

## Requests (all POST JSON, 8-second timeout)

A reply is ok when it is 2xx with `status: 'success'`; a 4xx or any other refusal is final; a network
error, the timeout, a 5xx or `retry: true` means "try again later".

- **Start**, when a stage begins (from the arena map, "Next", "Play again" or "Try again"):
  `{action:'start', game:'snowpax', grade, team, arena, pace, unit, device}`.
  - `arena`: 0 Kasımpaşa, 1 The Golden Horn, 2 Downtown. `pace`: `relaxed` or `challenge`.
    `unit`: the lesson id (for example `g5u1`); `grade` comes from it.
  - The ticket is kept in this browser under the run, so a paused or reloaded game can still claim.
    If the device is offline at the start, it asks again at the next checkpoint: the camp, each
    Snow Shop, the opening fight and the strike-back. Tickets older than 48 hours are dropped, and a
    run that was not won drops its ticket when the next run starts.
- **Claim**, only after a win that counts: `{action:'claim', ticket, device}`.
  - A network failure, a 5xx or `retry: true` keeps the ticket in an outbox, resent on the next
    launch and after the next win; outbox items older than 47 hours are dropped.
  - A 400 refusal (`too-fast`, `expired` or any other) is final.
  - The reply's `grade` and `team` (League v11.7.0), when present, are what the result line names.
- **Pools**: `{action:'pools', grade}` when the start screen opens (and when the lesson changes) and
  when the League panel opens. The last reply (settings and pools) is kept in this browser.
- **Device**: a random 24-character id (`A-Z a-z 0-9`), made once and kept in localStorage.
- **Roster** ("Who are you?", League v11.7.0): `{action:'roster', grade}`, public, no key or PIN,
  when the picker opens. Entries whose id (`/^[A-Za-z0-9:_-]{1,100}$/`), class (`/^[5-8]-[A-Z]$/`, of
  the requested grade) or team is not valid, or whose name is empty, are dropped; only id, name,
  class and team are kept. The last good list per grade is kept in this browser and shown at once;
  the fresh one replaces it in the background. The names come from the League at play time: none
  are in SnowPax's code.
- **Student**: once a student has chosen their name, every start also carries
  `student: '5-A:slytherin:0'`, their League Student ID, sent only if it matches
  `/^[A-Za-z0-9:_-]{1,100}$/`. Without it the start is exactly as before. The claim reply's `grade`
  and `team` (for a named student: their own class grade and League team) are what the win line
  names.

## What students see

- **Who are you?** With the League on, the first Play on a device (once the team and the lesson
  are chosen) asks the student to tap their class and name: only the lesson's grade's classes, and
  only the chosen team's names, sorted in Turkish order, two columns of big buttons on a phone. A
  grade with one class for that team (6-C, 7-A and 8-B are one-class grades) goes straight to the
  names. Then "Are you Zeynep?" with the class and team and "Your wins add Ulti to Grade 5
  Slytherin.", and "No, go back" / "Yes, that's me!". Two small links on every screen: "Not here?
  Show everyone" (grade tabs 5–8, every team) and "Not on the list? Play without a name" (plays as
  before, remembered). × or Escape goes back to the start screen; Play asks again next time. If
  the class list can't be loaded and nothing is cached: "The class list can't be loaded right now"
  and Try again; play never waits for the League. The choice is kept on this device.
- **The pill** beside LEAGUE in the team row: "Playing as Zeynep · 5-A  Change" (on a phone just
  "Zeynep · 5-A  Change", and LEAGUE without the grade, which is on the lesson card), or "Who are
  you?  Choose" before a choice. A tap opens the picker, so students sharing a tablet can switch.
  The start screen is no taller for it.
- **Team buttons** on the start screen: each shows its team's live Ulti for the lesson's grade
  (hidden until the League has answered at least once; the last known values offline).
- **LEAGUE · G5 ›** beside "Your team": the four team pools for the grade, each with its live points
  (entries newer than the League's `hours`) out of `capacity`, a bar, and its strength in the Battle
  Arena, `1 + (maxStrength − 1) × √(min(points, capacity) / capacity)`; the student's team is
  marked YOU. The rules underneath come only from the League's settings: points per arena on each
  pace, the daily wins per device, how long points last, and the win rule. If the League has not
  switched SnowPax on yet, the panel says so instead of showing numbers.
- **The arena map**: "Win it with good English: +8 Ulti for Grade 5 Hufflepuff" under the next
  stage, once the League's settings are known.
- **The results card**: "Sending your win to the English League…", then "+N Ulti for Grade g Team!",
  or one line for each other outcome: the team's daily limit (counted N of M), the device's daily
  wins used, Ulti switched off, already counted, too fast, an expired ticket, a win queued while
  offline, a stage that never got a ticket.
- **Mr. Saymaz's welcome guide** (and How to play) has a card about Ulti points.

## The League line

For the `games` section of the ULTI block in the Apps Script:

```
snowpax: { points: { relaxed: [6, 8, 10], challenge: [9, 11, 13] }, deviceDailyWins: 4, minSeconds: 240 },
```

- **points**: one value per arena, in order Kasımpaşa, The Golden Horn, Downtown. A SnowPax stage is
  a long round (the sled ride in, the camp, three Snow Shop visits, the opening fight, two parts of
  English, the strike-back and the Final Showdown: about 10 minutes, 7–13 by the game's own time
  check), about twice a Wordramp race (2/4/6, 5/7/9), so the values sit a little above Wordramp's;
  later arenas ask for more English (the 80% unlock rule) and are worth more; Challenge (a timer and
  2 stars needed) is worth 3 more on each arena.
- **deviceDailyWins: 4**: four stage wins a day count on one device, about 40 minutes of play.
- **minSeconds: 240**: see "The shortest honest win" below.
- **How long Ulti last** is the League's `hours` setting (the panel reads it from the League).

Every value is read from the League, so changes in the spreadsheet take effect without a new build.

## The shortest honest win

All three arenas are built the same way (a 72-second sled ride with five places' scenes, 24 tasks,
an opening fight to 12 freezes, a 50-second strike-back hold, the Final Showdown), so the shortest
arena is any of them; Kasımpaşa was measured.

A scripted player went through Kasımpaşa on Relaxed in the real game, with a clock counting the
game's own time: the sled ride played out in full, every task answered the moment it appeared, the
three Snow Shops left at once, the strike-back hold on its own clock. Only the opening fight and the
captain were skipped (they need real throwing), and the kids at the camp were reached instantly.

| Part | Game time |
|---|---|
| Sled ride in (with the five scenes) and the arrival | 127.6 s |
| Camp (three children's questions, no walking) | 14.7 s |
| First shop, Part 1 of the English | 30.4 s |
| Second shop, strike-back hold | 55.4 s |
| Part 2 of the English, the last shop | 29.4 s |
| **Start ticket to the results card** | **258 s** |

A real perfect player also has to freeze 12 rivals in the opening fight (at least about 30 s, with
the team's help), freeze the captain (at least about 10 s) and walk to the three children (about
6 s): about **300 s**. On a replay in the same session the five scenes can be skipped (about 28 s
less): about **275 s** at the very fastest. `minSeconds: 240` leaves a margin of about 35 seconds
under that, and refuses anything faster than the ride, the hold and the English alone allow. The
start ticket is asked for when the stage begins (before the ride), so the League's clock covers
the whole stage.

## Anything else on the League side

Nothing else needs to change: SnowPax uses the same protocol as Wordramp and solMaxima (start,
claim, pools, roster; League v11.7.0 or later). Adding the line above switches it on. The "Who are
you?" picker needs nothing more in the Apps Script.
