// OneSignal Web SDK v16 service worker. Kept under /push/onesignal/ so its
// registration scope doesn't collide with the app's own PWA service worker
// (VitePWA, scope "/"). use-push.ts points OneSignal at this path/scope.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js");
