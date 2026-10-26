# Flashcard workflow and scheduling research

Research checked against primary documentation on October 25, 2026. ControlQuest now uses the real FSRS-6 algorithm through a pinned, locally served MIT-licensed `ts-fsrs` 5.4.2 module. It is a custom CISA study app; it is not Anki, an AnkiWeb client, or a claim of complete Anki feature parity.

## What the answer buttons mean

[Anki studying guide](https://docs.ankiweb.net/manual/studying): Again means a failed recall. Hard is a correct answer that was difficult to retrieve; it must not be used as a softer version of Again. Good is a successful recall with some effort; Easy is effortless recall. The app's grading descriptions and four interval previews follow those meanings. Correct multiple-choice guesses should be treated as failures of recall. Existing safeguards force a wrong selected answer to Again.

## Learning versus sustained retention

[Anki deck options](https://docs.ankiweb.net/manual/deck-options): short learning steps precede longer review intervals. ControlQuest defaults to 1 minute and 10 minutes for learning and 10 minutes for relearning; old all-day learning steps fall back to these short defaults. Hard averages the first two steps initially and repeats the current step thereafter. Due learning is prioritized ahead of the review backlog and new cards.

Desired retention now feeds FSRS's actual interval calculation, defaulting to 90%. Supported values are clamped to 70–97% to avoid invalid parameters and extreme workloads. Maximum interval is also bounded. Fuzz is disabled in this integration so previews match saved outcomes exactly. These are documented product choices; Anki itself applies fuzz.

[Anki statistics](https://docs.ankiweb.net/manual/stats): a mature interval is at least 21 days; that classification is not a guarantee of knowledge. ControlQuest uses a stricter product label: at least three successful scheduled recalls, a review interval of at least 21 days, 80% recorded accuracy, and two consecutive Good/Easy responses. Legacy aggregate correct counts are no longer accepted as proof of scheduled recalls. Same-day assignment completion is a separate measure and never changes a card into long-term Mastered by itself.

## FSRS integration and limitations

[Upstream scheduler](https://github.com/open-spaced-repetition/ts-fsrs) provides the published algorithm, parameters, and library license. The vendored package identifies its implementation as FSRS-6.0. `js/vendor/ts-fsrs/PROVENANCE.md` records version, origin, hashes and license. No question, answer, or review data is sent to an external scheduler.

FSRS tracks stability and difficulty and uses elapsed time to produce future schedules. The adapter saves the full scheduler state with each card's existing progress. Existing cards retain their dates until reviewed; at that review, old intervals seed memory conservatively and future real reviews update it. This is an approximate legacy migration, not fitted historical model optimization. There is no optimizer or prediction of an exam result. A future version could replay a complete, verified review log and optimize parameters; partial historical logs must not silently masquerade as complete training data.

## Free practice, resets and review tools

[Anki filtered decks](https://docs.ankiweb.net/manual/filtered-decks): extra practice and scheduled review are distinct. ControlQuest allows correct ahead-of-schedule attempts to record activity without extending future due dates or increasing validated scheduled recall counts. A forgotten answer still starts relearning. This is a conservative ControlQuest rule, not an exact reproduction of Anki's early-review algorithm.

[Anki reset guidance](https://docs.ankiweb.net/faqs/resetting-progress-in-a-deck): forgetting a card makes it new without deleting its review history. ControlQuest's reset helper starts a fresh scheduling epoch and optionally clears current accuracy counters; the old review ledger remains historical. A reset timestamp prevents old missed answers or duplicate copies in another scope from reviving pre-reset mastery. Resetting is useful for inaccurate self-grades, but it should not be required merely to recover from a backlog.

[Anki leeches](https://docs.ankiweb.net/manual/leeches): repeatedly failed review cards need closer attention. ControlQuest marks a leech at eight review lapses by default. Default action is a tag, preserving access to assigned coursework. Optional suspension and temporary burying exclude a card from scheduled queues without deleting it. The study browser can still list those cards for repair and reactivation. Anki's default may suspend automatically; ControlQuest's default deliberately does not.

## Scope of this release

Implemented: FSRS-6 scheduling, four grade previews, learning/relearning, due ordering, conservative early practice, per-card memory state, leech tagging, availability controls and reset-aware analytics. The rest of the app supplies cloud progress, lesson assignments, imports, quiz attempts and review history.

Not claimed: Anki package/APKG or AnkiWeb interoperability, cloze/template editor parity, the Anki add-on ecosystem, parameter optimization, every Anki deck preset, or equivalent scientific validation of ControlQuest's homework completion thresholds.

## Verification

`tests/fsrs-workflow.test.mjs` verifies known published-scheduler outcomes, all four previews, immutable progress, learning/relearning, retention effects, 120 successive mixed-grade reviews, migration, early-practice protection, suspension/burying, leech thresholds and resets across duplicate scopes. `tests/study-intelligence.test.mjs` verifies personal miss isolation, resolved misses, earned mastery and analytics. Existing parser and persistence contracts stay intact.
