# Pace is one median per learner, and slow is over 1.5 times it

The 3-second limit went when typed answers replaced answers said aloud, so a fast outcome and a slow one are split by the learner's own pace. Pace is one number per learner, the median of their recent right answers' answer times, and a right answer is slow when it is well over that. One pace across all tables makes slow mean "slower than this learner usually is", which is what weighted repetition needs to find the facts a learner hesitates on.

## The rule

- The answer times that count towards pace are those of right answers, from every presentation and every table, that are under the cap. The app keeps the last 60 of them.
- Pace is the median of the answer times kept. There is no pace until 20 are kept; from 20 to 60 it is the median of what there is.
- A wrong answer is missed whatever its answer time.
- A right answer is slow when its answer time is over 1.5 × pace and is at least 3 seconds. Otherwise it is fast.
- While there is no pace, every right answer is fast. Those answer times count towards pace like any other; they are how a pace starts.
- An answer time is capped at 20 seconds. A presentation during which the app went to the background has an answer time of 20 seconds whatever the clock says. An answer at the cap gets its outcome by the same rule, so it is slow whenever pace is under about 13 seconds, since 20 seconds is then over 1.5 × pace, and it does not count towards pace.
- An answer is graded against the pace as it stood before that answer, and pace is worked out afresh after each right answer.
- The levels, the level changes and the weights of weighted repetition are unchanged. Levels earned under the 3-second self-graded rule are carried as they are. Progress from before storage version 2 is wiped first (ADR 0003), so the levels carried are those earned since.

## Considered options

- **One pace per table, per fact, or per answer length.** Per table and per fact compare a hesitant fact only with itself: a new table sets a slow pace and then grades its own slow answers fast, so levels reach 4 while the learner still hesitates. The cost of one pace is typing, since a three-digit product takes more key presses. Pace per answer length (1, 2 or 3 digits) is the fallback if three-digit facts stick at slow in practice; it was set aside because only 7 facts have a three-digit product, so that pace would be slow to start and slow to follow the learner.
- **All answers, or only the first presentation of a fact in a drill.** A wrong answer's time says nothing about recall speed, and quick guesses would lower pace. Repeats within a drill stay in because a drill already keeps the facts shown last out of the next draw, which spaces them.
- **Mean, or a lower percentile.** The mean is dragged up by long pauses. A lower percentile only trades against the margin. The median is the least affected by odd answers.
- **A margin of 2 × pace, pace plus a fixed number of seconds, or the slowest share of recent answers.** At 2 × a fact worked out on fingers grades fast. A fixed number of seconds is wide for a quick learner and tight for a slow typist. A fixed share grades that share slow for ever, so levels could never settle at 4. With a typical spread of answer times, 1.5 × grades roughly 1 in 5 right answers slow for a learner with a mix of known and hesitant facts, and roughly 1 in 20 for a learner who knows the pool evenly.
- **No floor, or a minimum gap of pace plus 1 second.** Under a pace of 2 seconds, 1.5 × pace falls below 3 seconds and ordinary variation breaks streaks for the learner doing best. The 3-second floor is not the old limit: it is never shown and never makes an answer slow; it only stops the relative line from dropping below what counts as knowing a fact cold.
- **Keeping 20, 200, or a number of days.** At 20, pace follows the choice of tables in the last drill rather than the learner. At 200, a learner improving over two weeks is graded against who they were. A number of days empties over a holiday. 60 is three to four drills.
- **A stand-in limit before there is a pace, or a pace from 5 answers.** A stand-in is a fixed limit at the moment it fits worst, while the learner is finding the keys, and would drop carried levels on the first day. A median of 5 is noisy. All-fast lasts about one drill, a missed outcome still sets the level to 0, and a level gained in it is given back by the first slow outcome.
- **Softening or resetting carried levels.** This rule reaches existing installs before the tables widen beyond the 6s, 8s and 12s, so carried levels sit in the pool they were earned in and their facts come round as often as before; a missed or slow outcome corrects an inflated one. Softening would show the learner, and the parent in the Parent view, progress lost overnight with no practice behind it. Storage version 2 later wiped version 1 progress ahead of this rule, to avoid writing a migration (ADR 0003), so this now covers only the levels earned since that wipe.
- **No cap, or discarding a long presentation.** The median tolerates a few long answer times, but the clock is unreliable across backgrounding in both directions, and an answer time that reads short could earn a fast outcome. Discarding would add a presentation that does not count to the drill and its drill record.
- **Pace fixed at the start of each drill.** Most first drills give fewer than 20 right answers, so the first pace would usually wait for the third drill. With 60 answer times kept, pace moves little within a drill.

## Consequences

The rule was run against three simulated learners with invented answer times (recall plus typing, with random variation). The results show the shape of the behaviour, not exact figures.

- **A learner who knows some tables cold and starts new ones.** The known facts set the pace, so the new facts grade slow, stay at low levels and come round more often. Pace rises while drills are full of new facts and falls back as they are learnt, and no fact reaches a high level while its recall is still long.
- **A learner who types slowly but knows the facts.** Pace is high, the margin scales with it, and nearly every fact settles at level 4. Facts with a three-digit product draw more slow outcomes than the rest and sit at level 2 or 3 for longer, without sticking at the bottom.
- **A learner who improves quickly over two weeks.** Pace falls steadily from drill to drill and the rule keeps up with it. This learner starts equally slow on every fact, so almost nothing is slow relative to their pace, and their levels reach 3 and 4 while their answers are still slow in absolute terms. This follows from judging a learner only against themselves: a high level means "right, and no slower than this learner usually is". Their improvement shows as a falling pace rather than in slow outcomes. Making a level mean an absolute speed would need the fixed limit back.

The rule adds one thing to the progress: the last 60 answer times that count towards pace. What a trend over time needs is decided separately.

1.5 and 60 are the values to retune first if levels look wrong in practice.
