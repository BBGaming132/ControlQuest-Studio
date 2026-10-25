# ControlQuest Studio 3.2

Blue skies, a playable island and question-powered adventures. Start a study round from Today, explore Island on foot, or choose a challenge in Games. Your saved answers grow crops, deliver materials and send the crew to work on construction. Guild members build one shared island; independent explorers use their own saved world.

- [Playable island release notes](docs/V3_2_RELEASE.md)


A guided CISA study companion with personal spaced recall, shared lesson libraries and a study-powered colony.

Start on **Today**, then follow **Study → understand the answer → grow your Island**. **Library** holds decks, batch imports, short lessons and progress. Specialist tools and account settings live under **More tools**.

This release adds clear next-step guidance, a persistent choice between your own colony and your active Guild’s colony, visible crop/building/resource changes, crew supply crates, skyship deliveries and continuing neighborhood expansion. It refreshes light/dark styling and phone navigation while preserving your existing questions and recall history.

- [Release notes and verification](docs/V3_1_RELEASE.md)
- [Personal Todoist / Everstead study missions](docs/STUDY_MISSIONS.md)
- [Study engine, imports and lesson sources](docs/V3_RELEASE.md)


A mobile-friendly CISA study adventure with QAE Word imports, honest spaced-repetition progress, short concept lessons and a persistent solo/cooperative island.

## The daily loop

Open Today → start a Pocket Quest → answer and read the rationale → rate recall → take an island action → continue. A saved queue resumes after refresh. The daily target counts distinct questions practiced, and recommendations prioritize unresolved misses and due reviews.

- Batch Import: multiple Word/text files, editable lesson matches, per-file sharing, retry/cancel/resume.
- Mastery Atlas: unique questions, unresolved misses, unseen cards, due reviews and durable mastery in each exam domain.
- Concept Trails: 60 original micro-lessons, scenarios, retrieval prompts, spoken audio and checkpoint questions.
- Lantern Isles: illustrated solo/Guild world with planting, harvesting, crafting, landmarks and rotating quests powered by study.
- Existing libraries, public lesson aggregation, avatars, Guild sessions, calendar and study history remain available.
- Optional local AI: desktop Ollama or an explicitly downloaded WebGPU browser model. Core study planning needs no AI service.
- Wayforge activity bridge: recent event export with unique IDs; a receiving/verification API still needs to be built.

[Release guide and deployment notes](docs/V3_RELEASE.md) · [Verified CISA and AI sources](docs/CISA_SOURCES.md) · [Existing lesson/public library guide](docs/LESSON_LIBRARY_GUIDE.md)

## Try it without an account

Choose Explore the island on the login screen, or append `?demo=1` to the site URL. The demo uses original sample questions and a separate local save; it does not read or change production Firebase data.

## Develop and verify

Node 22+:

```sh
npm ci
npm test
npm run build
```

The app remains buildless at the repository root for GitHub Pages. `dist/` provides an equivalent static output for other hosts. Keep the existing `config/firebase-config.js`. Deploy the included `firebase.rules` if the earlier public-library rules have not already been deployed. No hosting migration is required for this release.

The scheduler is transparent spaced repetition, not a claim to reproduce Anki/FSRS. Mastery is a conservative statement about your imported question bank, not a predicted exam score. The island is a turn-based cooperative study game, not a full MMO or an anti-cheat economy. Local AI inference and live cross-account Firebase behavior still require device/account-specific validation.

## Earlier releases

[v2.8 notes](README_V2_8.md) · [v2.7 notes](README_V2_7.md)
