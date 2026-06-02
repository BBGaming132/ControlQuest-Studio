# ControlQuest Studio v2.4.1 Hotfix

This hotfix fixes the loading screen issue by adding startup diagnostics and a Firebase initialization timeout. It also restores the prior Ollie-style logo mark so the app does not unexpectedly change the visual identity.

## Upgrade Notes

Copy the files into your GitHub Pages repo, but preserve your working `config/firebase-config.js` if it already has your real Firebase values.

If the app gets stuck again, the loading screen will now display a diagnostic message instead of sitting forever. Check browser DevTools → Console for the first red error.

## Common Causes Of The Loading Screen

- `config/firebase-config.js` was overwritten with the placeholder version.
- `enabled` is not set to `true`.
- GitHub Pages did not upload `js/app.js`, `js/firebase-service.js`, or `css/styles.css`.
- Browser cache is serving an old file. Hard refresh with `Ctrl + Shift + R`.
- Network blocks Firebase CDN imports from `gstatic.com`.
