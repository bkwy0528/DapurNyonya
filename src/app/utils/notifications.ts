import { getMessaging, getToken, deleteToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { arrayUnion, arrayRemove } from 'firebase/firestore';
import { firebaseApp } from '../../firebase';
import { getUserProfile, saveUserProfile } from './db';

export type ForegroundNotificationHandler = (payload: unknown) => void;

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

// Registered at a scope separate from the Workbox PWA service worker
// (public/firebase-messaging-sw.js is never auto-registered by
// vite-plugin-pwa) so the two never fight over control of '/'.
const PUSH_SW_URL = '/firebase-messaging-sw.js';
const PUSH_SW_SCOPE = '/firebase-cloud-messaging-push-scope/';

export async function getNotificationSupport() {
  return 'Notification' in window && 'serviceWorker' in navigator && await isSupported();
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!await getNotificationSupport()) {
    return null;
  }
  return getMessaging(firebaseApp);
}

export async function requestNotificationToken() {
  if (!vapidKey) {
    throw new Error('Missing VITE_FIREBASE_VAPID_KEY. Add a Firebase Web Push certificate before enabling notifications.');
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return null;
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: PUSH_SW_SCOPE });
  return getToken(messaging, { vapidKey, serviceWorkerRegistration });
}

// Ties together permission request -> token -> saving it on the user's
// profile. Returns true if a token was obtained and saved, false if the
// browser doesn't support push or the user declined the permission prompt.
export async function registerForPush(uid: string): Promise<boolean> {
  const token = await requestNotificationToken();
  if (!token) {
    return false;
  }
  await saveUserProfile(uid, { fcmTokens: arrayUnion(token) });
  return true;
}

// Reads back the token already registered for this browser, without
// prompting for permission (assumes permission is already granted).
async function getExistingToken(): Promise<string | null> {
  if (!vapidKey || !('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return null;
  }
  try {
    const serviceWorkerRegistration = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: PUSH_SW_SCOPE });
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  } catch {
    return null;
  }
}

// Whether this device currently has an active, saved subscription — distinct
// from browser Notification permission, which stays 'granted' forever once
// given and can't be revoked from JS. This is what the on/off toggle reflects.
export async function isPushRegistered(uid: string): Promise<boolean> {
  const token = await getExistingToken();
  if (!token) {
    return false;
  }
  const profile = await getUserProfile(uid);
  const tokens: string[] = profile?.fcmTokens || [];
  return tokens.includes(token);
}

// Counterpart to registerForPush: invalidates this device's token and drops
// it from the user's profile so the server stops sending to it. Browser
// permission itself is untouched (can't be revoked from JS) — re-enabling
// later just registers a fresh token, no re-prompt needed.
export async function unregisterForPush(uid: string): Promise<void> {
  const token = await getExistingToken();
  const messaging = await getFirebaseMessaging();
  if (messaging) {
    try {
      await deleteToken(messaging);
    } catch {
      // best-effort: still remove the token from Firestore below
    }
  }
  if (token) {
    await saveUserProfile(uid, { fcmTokens: arrayRemove(token) });
  }
}

export async function listenForForegroundNotifications(handler: ForegroundNotificationHandler) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, handler);
}
