# Personal study missions

ControlQuest can prepare a private study task from the current plan. Todoist's official app links open a prefilled task view; press Add in Todoist to create it. Mobile uses `todoist://addtask` and desktop uses `todoist://openquickadd`. The Todoist app must be installed. A copyable task and Todoist web link cover browsers without an app handler. Recurrence is opt-in and remains editable before adding.

Save the resulting Todoist task link in personal settings to return to the same task instead of creating another copy. Creating, opening or copying a draft is not a verified task creation or completion. ControlQuest never auto-completes Todoist tasks and never embeds account credentials in a link.

For Everstead, connect Todoist in Everstead's own Settings. Study in ControlQuest, explicitly complete the real task in Todoist or Everstead, then sync Todoist in Everstead. Everstead's server owns verified completion rewards and its currency; ControlQuest cannot mint them. Other site users can leave this optional connection off. The saved destination and task link belong to the signed-in profile and are not published to Guilds or public decks.

The existing Everstead `POST /api/todoist/create` is authenticated and rejects cross-origin changes. ControlQuest's static GitHub Pages frontend does not bypass that boundary or copy tokens. Everstead has no cross-app study-event ingestion endpoint at this release. A future automatic bridge needs an explicit authenticated, idempotent server contract. The current activity export is portable evidence, not a shared wallet integration.

Reference: [Todoist official API: URL schemes](https://developer.todoist.com/api/v1/#tag/Url-schemes). Parameters and desktop/mobile differences were checked against the official documentation on October 24, 2026.
