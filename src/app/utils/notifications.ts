import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { arrayUnion } from 'firebase/firestore';
import { firebaseApp } from '../../firebase';
import { saveUserProfile } from './db';

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

export async function listenForForegroundNotifications(handler: ForegroundNotificationHandler) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, handler);
}
