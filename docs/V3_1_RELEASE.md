# ControlQuest 3.1 — guided study and living colonies

## Where to go

Only four destinations are primary: Today, Study, Island and Library. Today offers one next action: add question files, start a recommended session, or resume a saved round. Study explains the difference between recommended recall, mistakes, due reviews and concept lessons. Custom domain/question filters stay available in a disclosure. Library groups imports, deck management, mastery and lessons. More tools contains Guilds, live study, avatar/rewards, calendar, notes and settings.

New account setup asks for a display name, theme and daily goal. Help explains Recall → Understand → Grow. Completing the daily goal explicitly welcomes rest.

## Colony actions now have visible consequences

The colony guide selects an attainable next action and shows a button to do it. Every action reports its result or missing requirement in the world; resource changes are displayed and the eight most recent successful changes remain in the journal. Correct saved recall earns up to three focus. All saved answers advance plants and crew production, including useful mistakes.

Every three saved answers creates a supply crate. Collect crates for timber, starlight and seeds; landmark upgrades improve production. Gather and craft, fulfill continuing skyship orders, restore landmarks and found successive neighborhoods. Houses, workers, garden stages, crates, stockpiles, lights and landmark details change on the illustrated map. The loop continues after landmark upgrades reach their cap.

My colony belongs to your account. Guild colony belongs to the active Guild, with its own resources and structures. A notice explains ownership. The selected destination persists for that account/Guild and applies to study reviews and successful concept checks. Changing Guilds clears a pending study queue and returns to the personal colony. Existing version-1 world saves receive additive defaults; existing progress is preserved.

## Personal study missions

Optional connection settings are under More tools → Settings & connections. Enable personal shortcuts, paste an existing Todoist study task link and choose an Everstead destination. These fields stay in the private profile; Guild summaries do not include them.

Todoist app links open a reviewed task draft. A copyable draft supports the web app. The visitor presses Add in Todoist; ControlQuest does not claim that opening a draft created a task. Use one recurring task to avoid duplicates. Connect that same Todoist account in Everstead, explicitly complete the study task, then sync Everstead to receive its server-verified task rewards. No credentials or personal task IDs ship in the public app.

No direct study-event receiving API or cross-app wallet exists in Everstead at this release. ControlQuest exports a portable, question-free activity journal, while the functional habit/reward connection goes through Todoist. Everstead’s authenticated backend and ongoing source changes are preserved.

## Mobile, themes and reliability

Four touch-sized bottom tabs, readable choice/rating cards, vertical guides, safe-area padding, small-screen filter layouts, coherent day/night surfaces and reduced-motion support. Original inline SVG artwork avoids large downloads.

Island and review writes cannot overlap. World commands capture the account and Guild that initiated them, reject changed context after async operations, and tolerate same-Guild Firestore snapshot replacements. Failed personal world saves roll back only their own pending state. Repeated event IDs do not duplicate resources. Slow or rejected actions show feedback beside the game.

## Verification

Run `npm test`, `npm run build`, and `git diff --check`. The suite includes existing imports, shared library privacy, SRS scheduling, personal misses and mastery, plus guided empty/resume flows, world selection, colony production and resource costs, attainable missions, action idempotency, save failures, account/Guild switching, snapshot updates, navigation and optional task links.

Browser QA uses the no-account demo with original sample questions; it does not alter production user/Guild data. Real two-device Firebase sessions and installed Todoist native-app handlers need validation on the user’s devices. The task handoff does not bypass sign-in or Everstead verification.
