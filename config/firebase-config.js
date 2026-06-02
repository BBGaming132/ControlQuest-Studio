// Paste your working Firebase config here and keep enabled: true.
export const firebaseConfig = {
  enabled: false,
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// Optional Google Calendar integration.
// 1. Create an OAuth Web Client in Google Cloud.
// 2. Add your GitHub Pages domain to Authorized JavaScript Origins.
// 3. Enable Google Calendar API.
// 4. Paste the client ID below.
export const googleCalendarConfig = {
  enabled: false,
  clientId: "PASTE_GOOGLE_OAUTH_CLIENT_ID_HERE"
};
