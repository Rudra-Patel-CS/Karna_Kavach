// Dummy file for Vite compile-time resolution.
// At runtime, the Express server will intercept requests to /firebase-config.js
// and inject the live environment variables from Render.
window.FIREBASE_CONFIG = {};
