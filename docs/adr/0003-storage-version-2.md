# Storage version 2 wipes version 1 progress, with no migration

Round two changes what the progress holds: answer times for the pace rule, three figures in each drill record for the Parent view trend, and no speed run. The progress document becomes version 2, and a version 1 document is not migrated: the app starts fresh. The app is early and has few learners, each with little progress, so a one-off reset costs less than migration code and the tests that would have to prove it never loses a level. Migrations are reconsidered when there are more learners.

## The rule

- The app reads version 2 only. Anything else, a version 1 document included, takes the path that already exists for a corrupt document: its text is copied to the backup key, overwriting any earlier backup, and the app starts fresh. There is no code that knows about version 1.
- The document is flat: `version`, `tables`, `facts`, `times` and `records`. Everything beside `version` belongs to the learner. Anything that belongs to the device goes under its own storage key, so a later profiles version can move the learner's part into a profile without rewriting it.
- `tables` is any of the 2s to the 12s, without repeats, and may be empty. `facts` accepts the keys of all 77 facts. Both are wider than the first round-two release offers, which still shows only the 6s, 8s and 12s and switches those three on in a fresh document. The release that widens the tables then needs no new version.
- `times` is the answer times that count towards pace (ADR 0002): at most 60, oldest first, each a whole number of milliseconds from 0 to under 20,000. A fresh document has none.
- A drill record holds when the drill ran, its tables, its fast, slow and missed counts and whether it was quit, as before. It gains `pace`, the pace at the end of the drill in milliseconds, or null while there is no pace; `known`, the number of facts at level 4 at the end of the drill; and `median`, the median answer time of the drill's right answers under the cap in milliseconds, or null when there are none. A quit drill holds the same values as they stood when it was quit. The speed run's `mode` and `time` are gone.
- Drill records are not capped.
- Validation stays strict: a document that breaks any of this is corrupt.

## Considered options

- **Migrating version 1.** Levels, counts and the table selection would copy across as they are, so the step itself is short. It was set aside because it brings the scaffolding for ordered migration steps and a test against a captured version 1 document, all to keep a small amount of progress on a few iPads. The first migration is written when there is progress worth that.
- **Deleting the version 1 document instead of backing it up.** This needs a special case for version 1 beside the rule for unreadable documents. One rule with no exceptions is simpler, the copy is a few kilobytes that nothing reads, and it leaves a wipe recoverable by hand. Erasing progress in the Parent view removes it.
- **A new storage key for version 2, or a build that never writes over a newer document.** An old build meets a newer document only when a release is rolled back, because a new service worker replaces the old build before the new one runs. The version 1 build is already installed and would back up a version 2 document and start fresh. Both protections were set aside for a policy: a release that changes the version is never rolled back, and a fault is fixed forward. The never-write rule is worth adding with the first migration.
- **Widening the tables in a later version.** With no migration, a later version would wipe the progress built up in between, or force the first migration early. The shape does not change when the tables widen, only the accepted values, so version 2 accepts them from the start.
- **Answer times per table or per fact.** Nothing reads them: ADR 0002 rejected a pace per table or per fact, and the Parent view trend rejected a trend per table.
- **Dropping `median`, which nothing shows yet.** It cannot be worked out afterwards for drills already done, and it costs about 15 bytes a drill.
- **A cap on drill records.** A drill record is about 145 bytes. At two drills a day the document is about 110 KB after a year and about 1.1 MB after ten, against a localStorage limit of roughly 2.5 million characters. The longest span the Parent view reads is twelve weeks, but a cap is code that deletes a learner's history to solve a problem the app does not have. A later version can add one.
- **Nesting the learner's part now, as `{ version, learner }`.** Every reader would change for profiles, which are out of scope. A flat document wraps mechanically as long as nothing that belongs to the device is mixed in.

## Consequences

- Every installed copy loses its levels, counts, drill records and table selection once, when the first build that reads version 2 arrives. The facts a learner knows come round as new until their levels climb back.
- The version 2 shape lands complete in one change, because a later change to it means another version and another wipe. The first round-two release ships in this order: the speed run is removed; then storage version 2; then the keypad card and the pace rule; then the Parent view trend. Between the second and third steps the app still grades against the 3-second limit, so `times` stays empty and `pace` and `median` are null; `known` is filled in from the start. The second and third steps land close together.
- ADR 0002 carries existing levels into the pace rule as they are. That still holds, but the levels it carries are those earned since the wipe.
- Any later change to the stored shape needs a decision made again: wipe once more, or write the first migration.
