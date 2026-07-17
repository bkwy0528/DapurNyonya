import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';

// Core logic extracted from the trigger call sites (same reasoning as
// batchLifecycle.ts) so it can be unit-tested with an injected fake
// `messaging` — there is no FCM emulator, so tests never send a real push.

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface PushResult {
  sent: number;
  pruned: number;
}

// Best-effort by design: the caller decides whether to swallow errors, but
// a push send never throws on a per-token delivery failure — only dead
// tokens are pruned from the user's doc so they stop being tried.
export async function sendPushToUserCore(
  db: Firestore,
  messaging: Messaging,
  userId: string,
  payload: PushPayload
): Promise<PushResult> {
  const userSnap = await db.collection('users').doc(userId).get();
  const tokens: string[] = (userSnap.exists && (userSnap.data() as any).fcmTokens) || [];
  if (tokens.length === 0) {
    return { sent: 0, pruned: 0 };
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    webpush: payload.url ? { fcmOptions: { link: payload.url } } : undefined,
  });

  const deadTokens: string[] = [];
  response.responses.forEach((result, i) => {
    if (!result.success) {
      const code = result.error?.code;
      if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
        deadTokens.push(tokens[i]);
      }
    }
  });

  if (deadTokens.length > 0) {
    await db.collection('users').doc(userId).set(
      { fcmTokens: FieldValue.arrayRemove(...deadTokens) },
      { merge: true }
    );
  }

  return { sent: response.successCount, pruned: deadTokens.length };
}

// Fans the same payload out to several customers (e.g. every pre-order
// still 'waiting' when a batch confirms). Each send is independent — one
// customer having no tokens or a dead token never affects the others.
export async function sendPushToUsersCore(
  db: Firestore,
  messaging: Messaging,
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  await Promise.all(userIds.map((userId) => sendPushToUserCore(db, messaging, userId, payload)));
}
