# Gems split into earned and balance, a finished drill pays by its band, and storage version 4 arrives by migration

Learners have unlocked every character, and ADR 0004 leaves them nothing to aim for: the facts pay at most 308 gems once, the bonus pays 2 a drill, and the total is never spent. This release lets gems be spent in a Shop without losing anything ADR 0004 guarantees. The gem total splits into earned, which never falls and still drives the unlocks, and balance, which the Shop draws on. A finished drill pays by its band so that a learner whose facts have all paid still earns. The progress document becomes version 4 by migration, and a version 3 learner's whole earned total becomes their balance.

## The rule

- **Earned** is what ADR 0004's total was: the sum of the facts' highest levels, the bonuses, and now band pay and badge pay. It only goes up. A character is unlocked when earned is at least its unlock total, so an unlock is never lost and unlocked characters are still not stored.
- **Balance** is what is left of earned after the purchases so far. It is what the Start screen shows and what the Shop spends. A purchase needs a balance at least the price, takes the price off the balance and adds the item to the owned list. Nothing is sold back.
- **Band pay**: a finished drill pays 3 gems in the top band, 1 in the middle band and 0 in the low band. A quit drill pays nothing. It is paid with the drill record, as the bonus is, and bounded per drill, so it rewards how a drill went rather than how many are run.
- **Badge pay**: the answer that first gives every fact of a table a highest level of 4 pays 10 gems for that table, with the fact's own gem. It is paid at the answer, as a fact's gem is (ADR 0004), so that a drill left without a record, by a quit or by closing the app, loses none of it. A badge is derived from the highest levels, as an unlock is from earned, and needs no storing; recording a drill finds the badges it earned by comparing the document as it began with the one at its end, as it finds unlocks, and the end screen shows them.
- **Unlocks are a list.** Facts pay at most 20 a drill, band pay 3, the bonus 2 and each badge 10, so a drill's pay can exceed a gap between unlock totals. Under today's totals no drill crosses two: a drill that completes tables needs their facts' highest levels already paid into earned, which puts earned past the lower total first. The lookup still returns every character crossed, in order, and the end screen shows a dialog for each, so that a later change to the totals or the pay needs no code change.
- **Prices**: hats 40, colour variants 25, themes 60, the extra pose 100. The crown has no price: owning all six hats earns it. The prices assume an income of about 3 gems a drill for a learner whose facts have paid, so a hat is a week or two and the set about two months, and a migrated balance of about 300 buys two or three items on the first day.
- **Bond** counts the finished drills done with each character. It is stored, since the drill records do not hold the character.
- **Erasing progress** clears everything, the owned items, worn hat, colours, theme and bond included.

## Storage version 4

- The document stays flat. `gems` becomes `earned`, and the document gains `balance`; `owned`, the list of item ids without repeats; `hat`, an owned hat or none; `colours`, each character's chosen colour, its own or an owned variant of that character; `theme`, the default or an owned theme; and `bond`, a count per character.
- Validation stays strict. `earned` is at least the sum of every `best`. `balance` is a whole number from 0 to `earned`. It is stored rather than worked out from the prices of `owned`, so that a later price change moves no learner's balance: the price is paid at the purchase and the document holds the result. The crown is owned only when every hat of the set is. `character` is one that `earned` has unlocked. `hat`, each colour and `theme` are owned or the default.
- The app reads version 4 and migrates a version 3 document that passes version 3's validation: `earned` and `balance` are both set from `gems`, nothing is owned, no hat is worn, every character has its own colour, the theme is the default and every bond is 0. A version 2 document is no longer migrated: it takes the corrupt path, as ADR 0004's newer-document and corrupt rules still stand.

## Considered options

- **Buying characters, or moving unlocks onto the balance.** Every learner already has them, and a balance that can fall would relock a character in use. Unlocks stay on earned, and the split exists so that spending cannot touch them.
- **Starting the balance at zero, or at a fixed allowance.** The gems were earned under a rule that promised nothing further, and the learners who finished are the ones asking. Pricing absorbs the windfall instead.
- **A gem per fast answer.** Rejected in ADR 0004 as unlimited on known tables. Band pay is bounded per drill and pays for the drill's quality, and now that gems buy things rather than unlock them an income that never ends is the point rather than a flaw.
- **A universal palette bought once for every character.** Fewer drawings, but recolouring six characters by one rule constrains how each is drawn, and two cheap items empty the shelf in a day.
- **Badges that come and go with the level now.** Honest about mastery, but a badge that can be lost stops being aimed at. Highest level reached matches how unlocks and purchases behave.
- **Storing the badges, or the unlocked characters.** Both derive from what is stored, and a stored copy is a second source of truth validation must keep in step.
- **Keeping the version 2 migration.** No installed copy has been on version 2 since ADR 0004 shipped, and each migration kept is a path to test for ever.

## Consequences

- The Start screen shows the balance, not the earned total. The Parent view shows both.
- A price change after release touches no stored balance, and a learner who paid the old price keeps the item. Validation cannot tie `balance` to `owned` for the same reason, so a document with a balance too high for what it owns still passes.
- The end screen gains a line for band pay and a line per badge, beside the bonus line, and may show more than one unlock dialog.
