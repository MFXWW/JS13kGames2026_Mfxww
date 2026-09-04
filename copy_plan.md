# Fallen Rainbow — Copy Plan

> A single source of truth that splits the narrative draft (`game_description`, Ver 2.0 is canonical)
> into **Homepage copy** and **In-game copy**, with each in-game line mapped to the exact game-flow
> moment it fires in. English is used because it doubles as the submission/homepage text.
>
> Note from the draft: *the story text is exempt from the 13 KB budget* — so verbosity is not the
> constraint here; pacing and placement are.

---

## 1. Game-flow analysis (what actually happens, from the code)

Narrative anchors and the UI they land on. IDs/classes below match `src/index.html` + `src/js/copy.js`.

### 1.1 Boot / restart
- First launch only (cookie `mfxww_game_intro` unset) **and** after the true ending
  (`gameRestartAfterEnding`) show the full-screen `#introOverlay`:
  - `#introMessage .intro-title` → `COPY.introTitle` ("Fallen rainbow")
  - `#introMessage .intro-body` → `COPY.introBody` (multi-line, `\n` → `<br>`)
  - `#introMessage .intro-hint` → `COPY.introHint` (`[ SPACE ]`)
- `SPACE` → `gameIntroDismiss()` → first level (1-1).

### 1.2 The 32 normal levels (1-1 … 12-2)
- Each chapter has its own two-tone palette. Each level load shows `#transitionMessage`:
  `level-label` = chapter number (`COPY` via `gameLevelDisplayName`), `level-sub` = empty, `cycle-notice` = empty.
- Death → `#deathOverlay`: `#deathMessage` = reason from `DEATH_REASONS`
  (`FALLEN`/`SQUEEZED`/`SQUASHED`/`SUICIDE`/`SWALLOWED`), `#deathHint` = `[ SPACE to try again ]`.
- Finishing 12-2 (regular ending of a pass) wraps to 1-1 and flags a "new cycle".

### 1.3 Entering the hidden realm (The Abandoned Place)
- First time on 12-2 **without** the crown, the level is the forced-fall "void" build.
  Falling out of the bottom → `gameEnterHiddenRealm()` → `corridor` (dark interstitial, one screen):
  - `level-label` = `COPY.corridorLabel` (`...`), `level-sub` = `COPY.corridorSub` (`???`)
- Touching the destination in corridor → 13-1. The three hidden levels share the greyscale/black-white
  palette (the one place that never fades).
- Entering 13-1..13-3 (without crown): `level-label` = `COPY.hiddenLabel(n)` (`THE ABANDONED PLACE — n/3`),
  `level-sub` = `COPY.hiddenSub` (`Something stirs in the dark…`).
- 13-3 has **inverted gravity**: fall out of the **top** → win.

### 1.4 Getting the crown (first clear of 13-3)
- No crown yet → beat 13-3 → crown moment (player freezes ~0.8 s at spawn, arpeggio) →
  wrap back to 1-1 with `GAME_hasCrown = true`, `crownedKept = false`, `crownedCycles = 0`.
- On arriving at 1-1 the transition `cycle-notice` = `COPY.cycleCrowned`
  (`the crowned journey begins…`) plus an RGB glitch flash (`gamePlayGlitch`) — a strong "wrong" signal.

### 1.5 The crowned cycle (wearing the crown)
- Normal levels **desaturate progressively** (`desaturateColor`, fade = levelIndex / 34): colour bleeds
  toward grey the deeper you go. Only the hidden realm stays black/white.
- Permanent `deaths` counter appears top-right (cookie-persisted); every death message gets
  ` again.` appended ("Fallen again.", …).
- Finishing 12-2 while crowned → wraps to 1-1, `cycle-notice` = `COPY.cycleKept(n)`
  (`the colors have a keeper. cycle N.`) for N ≥ 2; BGM becomes the unsettling variant.
- Re-entering 13-1 while crowned: `level-sub` = `COPY.hiddenCrownedSub`
  (`When colors fade, black and white remain.`).

### 1.6 Crown choice & endings (reaching 13-3 while crowned)
- Beating 13-3 **while crowned** no longer grants a crown — it opens `#crownChoiceOverlay`:
  - `#crownChoiceMessage` = `COPY.choiceFirst` on the first decision, `COPY.choiceAgain`
    from the second cycle on (the more loops, the closer the text gets to the truth)
  - `#crownChoiceHint` = `[ LEFT ] let go   [ RIGHT ] keep it`
- **LEFT / A** → `gameCrownReturn()` — drop the crown → the transition screen becomes the
  **true ending**: `level-sub` = `COPY.endingSub`, `cycle-notice` = `COPY.endingCycle`
  (`The rainbow has fallen.`). Then `SPACE` → `gameRestartAfterEnding()` → back to 1-1 with the
  intro overlay again: *the loop is the ending.*
- **RIGHT / D** → `gameCrownKeep()` — keep the crown → `crownedKept = true`, `crownedCycles++`,
  wrap to 1-1 and keep looping (the "bad" loop that fades forever).

> Summary table — see section 3 for the recommended copy at each node.

| # | Node | Fires when | UI target | Keys |
|---|------|-----------|-----------|------|
| N1 | Intro / opening | first launch or after true ending | `#introOverlay` | SPACE |
| N2 | Level card | every normal level load | `#transitionMessage` | auto |
| N3 | Death | every death | `#deathOverlay` | SPACE |
| N4 | Corridor card | falling into the void from 12-2 | `#transitionMessage` | auto |
| N5 | Hidden-chapter card | entering 13-1…13-3 | `#transitionMessage` | auto |
| N6 | Cycle notice | wrap back to 1-1 (crowned) | `#transitionMessage` cycle-notice | auto |
| N7 | Crown choice | beating 13-3 while crowned | `#crownChoiceOverlay` | LEFT/RIGHT |
| N8 | True ending | dropping the crown | `#transitionMessage` | SPACE |

---

## 2. Homepage section

**Where it goes:** the game's homepage / entry page / itch- or js13k-style blurb shown *before* or
*instead of* launching — the text a stranger reads to decide whether to press start.

**Recommended homepage copy** (short, controls included, matches the in-game "I" voice of Ver 2.0):

```text
Fallen Rainbow

Fall. Die. Rise. Repeat.

I wake. My colours are gone — and my memories with them.
Somewhere past twelve chapters of colour lies a crown that
promises to give them back. But a crown that glows this bright
feeds on what it takes. Black and white are all I truly am.

Drift left or right with A / D / ← / →, leap with W / Space / ↑.
Find the fall. Choose: to keep it, or to let it go.
```

**Placement notes**

- Keep it above the fold; the tagline "Fall. Die. Rise. Repeat." can double as the page `<title>`/
  og description.
- On the page, the controls line and the two key verbs — *find the fall*, *keep it / let it go* —
  are the practical hooks; the poetic lines set mood. Trim the middle stanza if the layout is tight.
- If the homepage is the in-game `#introOverlay` (N1) rather than an external page, use the N1 copy
  in section 3 instead — it is the same voice but shaped for one screen + a start key.

### Appendix — full copy (attached at the end of the homepage section)

Ver 2.0 is the canonical full draft (kept verbatim, including the author's closing riddle):

```text
I wake.
Go forth to seek my hues. This is my destiny.

A / D / Arrow Left / Arrow Right — Drift left or drift right
W / Arrow Up / Space — Leap aloft

Joy fills my breast. At last I have found it.
The crown glows with resplendent radiance. Surely this is my long-lost treasure.
…
Yet why do my memories dissolve away?
…
Colours bleed and fade before my very eyes.
…
Ah, it is this dazzling crown that brings it all to pass.
Perhaps it feeds upon what it devours, and so grows ever more magnificent.
…
Once more I return. For my vanished hues, for my dwindling memories, I stand here again.

[ LEFT to cling, or RIGHT to release ]. The hour of choice draws near.
I strove to mend what was broken, yet time has slipped away. I am slipping into oblivion…
Now I understand why this place is called the Abandoned Place… *I once knew the truth, yet I cast it aside.*

When all colours sink like a dying sunset, only black and white shall endure.
And they are where my true belonging lies.
Black and White… Dark and Bright… an endless cycle spins onward…

Then I awake.

I believe my destiny is to reclaim my colours, for I find myself shrouded in blackness.
So go forth, and seek my hues. This is my destiny.

(Do you know why left is to keep the crown? because "left" is not "right" — yet this "right" is not always what is truly right.)
```

> Ver 1.0 of the draft is intentionally *not* migrated here — it is an earlier pass of the same
> text and is kept archived in `game_description` for reference.

---

## 3. In-game copy section (how each line is used)

All strings below live in `src/js/copy.js` (the single editable source; UI ids/classes come from
`src/js/ui.js`). The existing terse lines already ship; **bold additions** are the moments where the
Ver 2.0 full copy can be fed in with pacing instead of a wall of text.

### N1 — Intro / opening overlay (`#introOverlay`)
- **Fires:** first launch only (cookie), and again after the true ending → looping.
- **How to use:** the one screen that *can* carry real prose. Render it as 2–3 short pages that
  advance on SPACE (a typewriter feel fits the pixel art), rather than one block:
  - Page 1 — the mission: `I wake. Go forth to seek my hues. This is my destiny.`
  - Page 2 — the admission: `I believe my destiny is to reclaim my colours, for I find myself
    shrouded in blackness. So go forth, and seek my hues. This is my destiny.`
  - Current single-block fallback (already in `COPY.introBody`) is fine if pages are not built:
    `I've forgotten... \n\tNope. The truth is, my colors are lost.\nIt's time to find them...`
- **Control:** SPACE dismisses; store the seen-cookie so returning players skip it.

### N2 — Normal level cards (`#transitionMessage`)
- **Fires:** every normal chapter load (1-1…12-2).
- **How to use:** keep it **minimal** — the level number only. No prose here; the palette *is* the
  storytelling (each chapter = a colour mood). Text would break the rhythm of 32 hops.
- Hint text never changes: `level-sub` stays empty.

### N3 — Death (`#deathOverlay`)
- **Fires:** every death; `#deathMessage` = one terse reason.
- **How to use:** keep the terse reasons — *"Hit the bottom." / "Squeezed." / "Squashed." /
  "Gave up." / "Swallowed."*. Death must be instant to read; long prose would punish the core loop.
- **Crowned twist (already in code):** append ` again.` so every death echoes the loop theme
  ("Fallen again.", "Squeezed again."…). This single suffix is the recurring "die/rise/repeat" motif.

### N4 — Corridor card (falling into the void from 12-2)
- **Fires:** first crowned-less 12-2 forced fall (and any 12-2 fall-out while crowned).
- **How to use:** current `label …` / `sub ???` is deliberately cryptic and *correct* — do not
  explain the hidden realm here. This is the "fall" beat; the reveal belongs to N5. Optionally swap
  the sub to one line only on the **first-ever** entry: `I am slipping into oblivion…`
- Keep `corridorLabel`/`corridorSub` as-is otherwise.

### N5 — Hidden-chapter card (The Abandoned Place)
- **Fires:** entering 13-1…13-3 (label = `THE ABANDONED PLACE — n/3`).
- **How to use:** the name-reveal moment — feed in the truth line once, when first entering 13-1:
  - Plain entry: `Something stirs in the dark…` (existing) — keep.
  - **First-ever 13-1 entry, add one beat:** `Now I understand why this place is called the
    Abandoned Place… *I once knew the truth, yet I cast it aside.*`
  - 13-2 / 13-3 keep it minimal (just the part counter).
- **Crowned re-entry (13-1):** `level-sub` already becomes `When colors fade, black and white
  remain.` (`hiddenCrownedSub`) — keep; it is the perfect capped payoff for a player who knows.

### N6 — Cycle notice (wrap back to 1-1)
- **Fires:** finishing the last normal level of a pass wraps to 1-1 and prints a cycle line.
- **How to use:** escalate by loop count — the existing ladder already does this:
  1. First crowned wrap: `the crowned journey begins…` (`cycleCrowned`) + RGB glitch (do not add text
     here — the glitch is the message).
  2. Kept-crown wraps (N ≥ 2): `the colors have a keeper. cycle N.` (`cycleKept`).
  3. Un-crowned plain wrap: `Another cycle. The end…?` (`cyclePlain`).
- If you want the full-copy motif audible, fade in the two **bold** lines here instead of N1 page 2:
  `When all colours sink like a dying sunset, only black and white shall endure.` then
  `Black and White… Dark and Bright… an endless cycle spins onward…` — but only from cycle 2, so it
  reads as earned knowledge, not opening exposition.

### N7 — Crown choice (`#crownChoiceOverlay`)
- **Fires:** beating 13-3 while crowned (not the crown-granting run). Pauses the game.
- **How to use:** this is the moral fork, so the copy must name the cost — existing escalation is
  already on-theme and should be kept:
  - First decision (`choiceFirst`): `Wow, It's heavy...\nBut I can feel it sucking my colors,\nMaybe
    that's why it becomes heavier.`
  - Later decisions (`choiceAgain`): `Too heavy.\nIt eats my colors and memories.\nPut it back...`
  - **Optional 2nd-cycle upgrade** with the Ver 2.0 voice: add the crown's confession as a fading
    line above the choice: `Ah, it is this dazzling crown that brings it all to pass. Perhaps it
    feeds upon what it devours, and so grows ever more magnificent.`
- Hint stays `[ LEFT ] let go   [ RIGHT ] keep it` — LEFT (A) returns the crown, RIGHT (D) keeps it.

### N8 — True ending (dropping the crown)
- **Fires:** LEFT at N7 → `gameCrownReturn()` → transition screen shows the ending; SPACE → loop.
- **How to use:** the biggest single prose allowance, since the loop is over:
  - `level-sub` = `COPY.endingSub`: `I remember now.\nWhat I forgot was that I forget.\nThe colors are
    my memories...`
  - `cycle-notice` = `COPY.endingCycle`: `The rainbow has fallen.`
  - **Optional full-copy closer** (same screen, below the sub): `When all colours sink like a dying
    sunset, only black and white shall endure. And they are where my true belonging lies.` — lands
    perfectly because the crown is finally gone and the world is black/white again.
  - Then SPACE → intro (N1) → the game literally loops; no "thanks for playing" text needed.

---

## 4. One-line rules (keep these sacred)

1. **Death = terse.** Prose belongs to pause-screens, never to the loop.
2. **Name the cost at the fork.** N7 must say *why* the crown is dangerous before asking keep/let-go.
3. **Escalate by loop.** Cycle 1 hints, cycle 2 explains, the ending confesses.
4. **The glitch and the fade say it visually.** Don't stack words on top of the RGB glitch or the
   desaturation — let them breathe.
5. **Black & White lines are the finale.** Reserve the "only black and white shall endure" stanza for
   the crowned endgame (N6 cycle ≥ 2 / N8), never the opening.
