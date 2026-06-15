import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { firebaseApp } from '../../firebase';

export type ForegroundNotificationHandler = (payload: unknown) => void;

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

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

  return getToken(messaging, { vapidKey });
}

export async function listenForForegroundNotifications(handler: ForegroundNotificationHandler) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, handler);
}
