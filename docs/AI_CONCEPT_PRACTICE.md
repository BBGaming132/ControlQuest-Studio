# Concept practice service

The static website includes the authenticated generation client and setup UI. `backend/concept-practice` contains an independently deployable Firebase HTTPS function. Publishing GitHub Pages does **not** deploy this function or activate AI generation. An unconfigured service leaves normal lessons and missed-question practice available.

## Activation

An authorized Firebase project owner runs these commands from `backend/concept-practice` with Node 22 and the Firebase CLI installed:

```sh
npm install
firebase login
firebase functions:secrets:set OPENAI_API_KEY --project controlquest-studio-18ba7
firebase deploy --only functions:conceptPractice --project controlquest-studio-18ba7
```

Enter the provider key in the secret prompt, never in chat, a browser field, committed code, or a GitHub Pages environment variable. Firebase Functions requires the project's applicable billing plan. Deployment asks for `PRACTICE_ORIGIN` (default `https://bbgaming132.github.io`) and `PRACTICE_MODEL` (default `gpt-4.1-mini`, which can be changed to a supported structured-output model). Copy the resulting HTTPS function URL into Settings → Concept practice service. Only configure a trusted endpoint: it receives the Firebase sign-in token and selected concept names. Regular progress is not sent to the provider.

## Storage and permissions

The backend uses Admin SDK access; browser clients need no access to `aiPracticeCatalog` or `aiPracticeQuota`. Ensure Firestore rules do **not** grant broad client writes or reads to these server collections. Explicit deny rules cannot override another broader matching allow rule, so inspect the complete active rules before deployment. Existing `users/{uid}` permissions are unrelated and must remain intact.

Each generated set is one bounded document, capped at 140 KB, in `aiPracticeCatalog/{sha256}`. The key includes model, schema version, lesson, sorted concept names, and count. Repeated requests across users reuse the same saved set. Records store generic concepts, model/version, timestamps, explanations, and `reviewStatus: unverified`; they contain no UID, responses, tokens, or private answer histories. Request quota documents are separate and restricted to the server. Remove old quota documents with a scheduled retention policy if necessary.

Original generated practice stays labeled as AI-generated, not official ISACA content, and is excluded from initial lesson completion requirements. Structural validation does not certify subject-matter correctness. There are no scraped exam banks or third-party repository questions in this implementation. A future external question source needs explicit license and provenance review.

## Integration contract

`renderPracticeSetup(endpoint)` and `bindPracticeSetup({root,save,toast})` provide Settings controls. Save the endpoint per signed-in account.

`requestConceptPractice({endpoint,getToken,lessonId,concepts,missCount})` sends a Firebase ID token from `currentUser.getIdToken()` and generic missed-concept tags. Never supply the provider key. It requests 10–15 questions, validates exact question count, answer identity, distinct options, unique questions and explanations for all choices, and requires a server catalog ID. It has a 60-second timeout; the provider call has a 45-second timeout. Failure leaves lesson progress unchanged.

Then call `catalogPracticeSet(result,{uid})` to retain a browser copy, followed by `practiceCards(cataloged,uid)` to produce personal supplemental cards. Add those cards through the existing personal-card persistence path before opening a practice session. Question and choice shuffling remains the study runner's job, preserving the correct answer identity.

POST body: `{version:1,lessonId,concepts:["audit evidence"],count:10,requestKey:"..."}`. Server recomputes its own key rather than trusting `requestKey`. Successful response: `{catalogId,model,reused,questions:[{question,concept,choices:{A,B,C,D},correctAnswer:"B",justifications:{A,B,C,D}}]}`.

The backend checks origin and revoked Firebase ID tokens, validates inputs, permits at most 20 requests per user per UTC day, uses only a server-managed provider secret, limits instances, and validates generated output again before writing. CORS alone is not authentication. Quota counts cache hits as well as new generations. Simultaneous first requests for the same uncached set can each incur provider cost, but transactions keep one catalog record; exact single-flight generation can be added if usage warrants it.

## Verification

```sh
node tests/concept-practice.test.mjs
node --test backend/concept-practice/core.test.js
node --check backend/concept-practice/index.js
```

These checks validate the client contract, key stability, schema bounds, authentication headers, duplicate rejection, local persistence and supplemental-card flags. A real deployment also needs: successful authenticated generation and catalog reuse; rejected unauthenticated/cross-origin requests; quota enforcement; provider failure handling; generated-card study/reload on mobile; and inspection of the saved Firestore document. Live provider, Firebase and paid deployment checks require actual configured infrastructure and are not claimed by the local tests.

References: [Firebase secrets](https://firebase.google.com/docs/functions/config-env), [HTTP Functions](https://firebase.google.com/docs/functions/http-events), [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
