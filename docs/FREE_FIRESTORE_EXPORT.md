# Export ControlQuest without enabling billing

Use Google Cloud Shell signed into the Google account that owns `controlquest-studio-18ba7`. This tool uses ordinary Firestore REST reads with the existing account's OAuth credentials. It does not enable billing, change IAM, install packages, write database records, or download a service-account key. Reads consume the project's existing quota; an exhausted allowance still blocks the export.

## Before exporting

Have every learner sync pending device work, then pause studying. Keep browser data intact. The activity command shows recent server-recorded work, not live presence or unsynced device work. Absence of events does not prove someone is offline. This exporter does not include Firebase Authentication accounts/passwords, Cloud Storage objects, deployed functions, or browser queues. It captures the Firestore database only.

Open https://console.cloud.google.com/ and select the ControlQuest project. Click Activate Cloud Shell (`>_`) and authorize the shell using your existing Google account when prompted. Do not activate a paid trial or enable billing.

Download the script:

```sh
curl -fL https://raw.githubusercontent.com/BBGaming132/ControlQuest-Studio/main/scripts/migration/export-firestore.py -o export-firestore.py
python3 export-firestore.py --help
```

Run these commands in order:

```sh
python3 export-firestore.py list-users
python3 export-firestore.py activity --uid 'PASTE_TYS_UID_HERE'
python3 export-firestore.py export --output controlquest-export
```

Replace `PASTE_TYS_UID_HERE` with Ty’s exact UID from the first command. The final command creates `controlquest-export.zip` only on success. In Cloud Shell, use the three-dot menu → Download → enter `controlquest-export.zip`, then attach that ZIP in chat. If rerunning, use a new output name; existing directories are deliberately not overwritten.

The default safety limits are 20,000 documents and 45,000 API requests. These are stop limits, not a guarantee that the daily read allowance is sufficient. If a limit is reached, retain the incomplete files and report the message rather than increasing it blindly.
 Match Ty by his displayed name and confirm the UID; never assume the first account is his. The activity report deliberately excludes question/answer text.

Run the activity check again after a few minutes. New saved events show continued activity. Ask Ty to confirm he has synced and paused even if the report is unchanged.

## Export guarantees and limits

The export walks all collections and subcollections, including subcollections below missing parent documents. It preserves Firestore's typed REST values, full document paths, timestamps and profile chunks without lossy JSON conversion. A fixed read time is used throughout; the operation must finish within the supported historical-read window. It stops on errors and never labels a partial export complete. Successful output includes data, a manifest and a ZIP containing only export artifacts, not shell credentials.

Upload only the ZIP from a successful export here. Keep another private copy. Do not upload OAuth tokens, Cloud Shell credentials, service-account keys or password exports. Do not commit actual database exports to this public repository.

A successful database backup is not permission to switch providers immediately. We will decode and validate the raw typed data, hydrate profile chunks, reconcile separate homework records, preserve original user/event IDs, and account for late device queues before any cutover. The existing staging validator expects a different decoded envelope; this raw ZIP must be transformed first.

## If it fails

- Quota/resource exhausted: stop; wait for the next reset rather than repeatedly restarting a full export.
- Permission denied: confirm you selected the owning Google account and correct project. Do not weaken Firestore rules.
- Snapshot too old: retain the partial files for diagnosis; they are not a complete backup. A larger export needs a planned bounded/resumable method.
- Authentication expired: sign in again through Google's normal flow. Never paste tokens into chat.

References: https://firebase.google.com/docs/firestore/use-rest-api and https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/listCollectionIds
