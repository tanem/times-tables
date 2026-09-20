# Glossary

- **Learner**: the one child who practises on an installed copy of the app. One learner per iPad: the app does not know who is using it, and the progress on a device is that learner's.
- **Fact**: one multiplication pair, such as 6 × 7. The pair is unordered: 6 × 7 and 7 × 6 are the same fact. The learner's answer to a fact is the product.
- **Presentation**: one showing of a fact in one ordering, either 6 × 7 or 7 × 6.
- **Table**: the set of facts sharing one number, from the 2s to the 12s, each running from 1 × that number to 12 × it. A fact belongs to the table of each of its two numbers: 3 × 7 is in the 3s and the 7s. There is no 1s table and no × 0.
- **Pool**: the facts a drill draws from: the union of the chosen tables, with a fact entering once however many of the chosen tables hold it.
- **Drill**: one sitting of practice, a sequence of presentations one at a time, drawn from the tables the learner chose.
- **Outcome**: the app's grade for one presentation: fast (right, at or near the learner's pace), slow (right, but well over the learner's pace), or missed (a wrong answer). While the learner has no pace yet, every right answer is fast.
- **Pace**: the learner's usual answer time: the median of the answer times of their own recent right answers, across all tables. The line between a fast and a slow outcome is set from it, and it moves as the learner improves. A learner has no pace until they have given enough right answers; the rule is in `docs/adr/0002-pace-rule.md`.
- **Answer time**: how long the learner took over one presentation, from the presentation appearing to the answer being entered. It includes the typing, so it is judged only against the same learner's earlier answer times, never against another learner's. It stops counting at a cap, so that time spent away from the iPad does not distort pace.
- **Level**: how well the learner knows a fact, from 0 (new or just missed) to 4. Outcomes move it.
- **Weighted repetition**: choosing the next fact so that facts at a low level appear more often.
- **Streak**: consecutive fast outcomes within a drill; a slow or missed outcome resets it. The best streak of a drill is shown on its end screen. Nothing accumulates across drills.
- **Band**: how big the end of a drill celebrates, from the fast count as a share of the drill's 20 presentations: top (75% or more), middle (40% to 74%) or low (below that, and any quit drill).
- **Progress**: everything the app remembers about the learner: each fact's level and outcome counts, the recent answer times that pace is worked out from, and the drill records.
- **Drill record**: the one entry a drill leaves in the progress: when it ran, which tables, how many fast, slow and missed outcomes, and whether it was quit early.
- **Start screen**: the app's opening screen, where the learner chooses tables and starts a drill. Not the iPad home screen, where the app's icon lives.
- **Parent view**: the screen reached from the Start screen where a parent reads the progress and can erase it. Headed "Progress" in the app.
