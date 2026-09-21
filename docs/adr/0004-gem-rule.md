# A fact pays a gem the first time it reaches each level, and storage version 3 arrives by migration

Gems are the one thing that accumulates across drills: the total only goes up, is never spent, and unlocks characters. The rule that pays them has to be fair to learners at different stages and must not pay for repeating facts the learner already knows. A fact pays one gem the first time it reaches each level from 1 to 4, so the supply from facts is finite and cannot be earned twice. The progress document becomes version 3 to hold this, and a version 2 document is migrated: this is the first migration, because wiping levels in the release that starts paying for them would cost the learners more than the code does.

## The rule

- Each fact has a highest level reached. When a fast outcome takes a fact's level above it, the highest level becomes that level and the learner is paid one gem. Nothing else about an outcome pays. A fact pays at most 4 gems, and the 77 facts pay at most 308.
- A gem is paid at the answer and saved with it, as the level is, so a quit drill keeps the gems already paid.
- A finished drill that was faster than last time pays a bonus of 2 gems. Last time is the most recent finished drill with the same set of tables, in any order and however long ago. The drill is faster when its median answer time is under that drill's. Both drills need a median and at least 10 right answers, a tie does not pay, and a quit drill neither pays nor counts as last time. With no such earlier drill there is no comparison and no bonus. The comparison reads `median`, `tables`, `quit` and the outcome counts from the drill records, so it stores nothing new.
- The cat unlocks at 25 gems, the robot at 60, the owl at 110, the unicorn at 170 and the monster at 240. The dragon is there from the start. A drill pays at most 22, which is less than every gap between unlocks and less than the first, so at most one character unlocks in a drill.
- A character is unlocked when the gem total is at least its unlock total. The total never falls, so an unlock is never lost, and unlocked characters are not stored. The end screen works out a new unlock from the gem total at the start and the end of the drill.
- Once every character is unlocked and every fact has paid, nothing new happens. The total stays on the Start screen and rises only through the bonus.
- Erasing progress on the Parent view clears everything: a fresh document, no gems, the dragon chosen.

## Storage version 3

- The document stays flat and gains `gems`, a whole number from 0, and `character`, one of the six, the dragon in a fresh document. Each entry in `facts` gains `best`, its highest level reached, from 0 to 4. An absent fact has a `best` of 0.
- Validation stays strict. `best` is at least `level`. `gems` is at least the sum of every `best`; it can be more, by the bonuses. `character` is one that `gems` has unlocked.
- The app reads version 3, and migrates a version 2 document that passes version 2's validation: each fact's `best` is set to its `level`, `gems` to the sum of those levels, and `character` to the dragon. Everything else is copied as it is. The migrated document is written back as version 3. The characters the back-pay affords show as unlocked on the Start screen, with no dialog.
- A version 1 document, a version 2 document that fails validation, and anything else the app cannot read still take the path for a corrupt document: copied to the backup key, and the app starts fresh.
- A document with a version higher than the build knows is not corrupt. The build leaves it and the backup key untouched, starts no drill, and shows one screen saying the app needs an update and to close and reopen it. The version 2 builds already installed do not have this rule, so ADR 0003's policy still covers this release: it is never rolled back, and a fault is fixed forward.

## Considered options

- **A gem for every fast answer.** The rule the prototype made up. A learner who drills only tables they know earns 20 a drill for ever.
- **A gem whenever a fact moves up a level.** A learner who misses a level 4 fact on purpose is paid for its four fast answers back up, without limit, and ordinary slow-then-fast churn pays again too.
- **A gem when pace improves on a table.** ADR 0002 rejected a pace per table and nothing stores one, and slowing down on purpose then speeding up would be paid.
- **Comparing a drill with the last finished drill whatever its tables, or with the pace as the drill started.** With any tables, alternating the 12s and the 2s pays the bonus every second drill. Against pace, "Faster than last time!" is no longer what was compared. With the same tables, a learner who changes tables every drill rarely sees the race; that is accepted.
- **A bonus of 5 gems, or 1.** The bonus is the only source without a ceiling, and a slow drill followed by a fast one earns it on purpose. At 5 it is most of what a late drill pays and that trick earns a character every few weeks. At 1 the race on the end screen pays a let-down. At 2 the trick costs 40 presentations for 2 gems, and lowers levels on the way.
- **The prototype's unlock totals, 25, 60, 120, 200 and 300.** 300 sits 8 gems under what the facts can pay, and the last levels come slowly.
- **Hiding the total once everything is unlocked, or specifying more unlocks now.** Hiding takes away something the learner earned. More unlocks are more art before any learner has reached the end; they can be a later release.
- **Version 3 by wiping again.** No migration code, through the path ADR 0003 used. It wipes every learner's levels in the release that starts paying for them, and the progress built up since the version 2 wipe is now worth the migration and its tests.
- **A separate storage key for gems, the character and the highest levels.** No wipe and no migration, but the learner's part is split across two keys against ADR 0003's flat document, and erase has to clear both.
- **No back-pay at the migration.** The highest level a fact ever reached is not known, only its level now. Starting `gems` at 0 with `best` at the level now takes those gems out of a finite supply for good, so the learners who practised most could earn least. Back-pay by the level now can underpay a fact that has dropped since; it then pays again as it climbs past its level at the migration.
- **Announcing the back-paid characters in a dialog.** A screen that exists only for the few installs that migrate.
- **Erase keeping gems and characters.** Keeping gems while levels and highest levels reset would pay for every fact a second time. Keeping the highest levels too leaves an erased learner who can earn nothing.
- **Storing the unlocked characters, or the gems each drill paid.** A list of unlocks is a second source of truth that validation must keep in step with `gems`; its one use is changing the unlock totals later without locking a character again. Nothing reads the gems a drill paid.
- **A newer document running fresh in memory without saving, or leaving the never-write rule out.** Running fresh lets the learner practise with levels and gems that vanish on close with no sign why. Leaving the rule out means a rollback backs up the newer document and starts fresh, which costs the learner's progress.

## Consequences

The rule was run as a simulation: drills of 20 presentations with the app's draw weights, fixed chances of each outcome, averaged over 200 runs, without the bonus. The results show the shape of the behaviour, not exact figures.

- **A good learner with every table on** (85% fast) reaches the five unlock totals after about 2, 4, 7, 11 and 17 drills.
- **An average learner with every table on** (60% fast) reaches them after about 3, 6, 11, 19 and 35 drills, under three weeks at two drills a day.
- **A struggling learner with every table on** (45% fast) reaches them after about 3, 8, 16, 32 and 72 drills, about five weeks.
- **A learner with three tables on** has 33 facts, which pay at most 132, and earns little after about 25 drills. The unicorn and the monster need more tables switched on.
- What a drill pays falls as fewer facts have a level left to reach for the first time. The average learner's drill pays about 12 gems at first, about 6 by the twentieth drill and about 2 by the fortieth; the good learner's pays about 17 at first and almost nothing by the fortieth.

The unlock totals and the bonus are the values to retune first. Raising an unlock total can lock a character a learner already has, and if that character is the chosen one the document fails validation, so a change to the totals needs its own decision.
