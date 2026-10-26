# Focus audio: evidence, licensing, and delivery

The app includes 12 complete recorded instrumental tracks (47 minutes 53 seconds total), bundled as local MP3 files, about 23.0 MB combined. They are recordings by Kevin MacLeod, downloaded from the artist’s official Incompetech site on October 25, 2026. They are not generated oscillators, synthetic background-noise loops, third-party streaming embeds, previews, or track excerpts. Each file is transcoded from the original full recording to 64 kbps stereo MP3 at 24 kHz for smaller mobile downloads. There are no musical edits. Audio downloads only when the user starts playback. Individual recordings can be downloaded through the player.

The catalog offers chill instrumental beats, ambient music, flowing piano, classical piano, and light acoustic music. “Lo-fi” is not a clinical intervention and these specific tracks have not been tested in a controlled flashcard study. No focus or memory improvement is promised.

## Evidence used

- Souza & Barbosa (2023), *Should We Turn off the Music? Music with Lyrics Interferes with Cognitive Tasks*, Journal of Cognition. DOI: https://doi.org/10.5334/joc.273 . Open manuscript: https://pmc.ncbi.nlm.nih.gov/articles/PMC10162369/ . In their controlled comparison, lyrics impaired several cognitive tasks; instrumental hip-hop lo-fi did not credibly help or hinder performance compared with silence. This informs the lyric-free catalog and equally prominent silence control.
- Cheah, Wong, Spitzer & Coutinho (2022), *Background Music and Cognitive Task Performance: A Systematic Review of Task, Music, and Population Impact*. DOI: https://doi.org/10.1177/20592043221134392 . The literature varies by task, music, and listener. The review reports detrimental effects of lyrics in verbal-memory tasks and some language-task costs even from instrumental music. This informs the optional, user-controlled approach rather than an asserted “best study music.”
- Cooke and colleagues (2025), *From Mozart to Fleetwood Mac: music listening is not detrimental to reading comprehension in university students*. DOI: https://doi.org/10.1080/02699931.2025.2517810 . PubMed: https://pubmed.ncbi.nlm.nih.gov/40549986/ . In 279 participants accustomed to studying with music, reading comprehension did not differ across selected music, noise, and silence; music maintained positive emotion. This supports personal preference as a comfort choice, not a guaranteed learning benefit.

Product decision: off by default, explicit Play, 20% initial volume, no lyrics, continuous playlist or repeat, and one-click Silence. No countdown, tracking credit, or reward depends on listening. A saved playback position is available after reload but playback always requires a new user action. Playing audio survives in-app screen rerenders through one shared controller; unsubscribe view listeners when replacing UI.

## License and attribution

All bundled recordings are licensed Creative Commons Attribution 4.0 International by the artist’s current official track pages. Verification: https://incompetech.com/music/royalty-free/licenses/ and the individual track links in `assets/audio/credits.txt`. License: https://creativecommons.org/licenses/by/4.0/ . The two Gymnopédies were composed by Erik Satie; the Kevin MacLeod recordings have their own CC BY license.

Each track has visible title, artist, source link, license link, and download in the player. The player credits disclosure explains transcoding. `assets/audio/credits.txt` is also shipped, linked in the UI, and accessible without logging in. `assets/audio/catalog.json` records full source URLs, ISRC, actual decoded duration, byte length, and SHA-256 hashes for original and bundled files. We do not rely on the app being noncommercial: CC BY allows redistribution with attribution, and those conditions are honored. No artist endorsement is implied.

## Integration

```js
import {renderFocusAudio,bindFocusAudio,stopFocusAudio} from './focus-audio.js';
// Insert renderFocusAudio() into a persistent study tools section.
const dispose = bindFocusAudio(container);
// Call dispose() when replacing that view. It intentionally does not stop audio.
// Call stopFocusAudio() on sign-out if desired.
```

Load `css/focus-audio.css`. The build already copies `assets`, `js`, and `css`, so no hosting dependency is introduced. Personal playlist/volume/position preferences stay on the device. The audio player never writes question answers, scores, or profile fields.
