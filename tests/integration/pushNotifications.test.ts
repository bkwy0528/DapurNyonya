import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getEmulatorDb } from '../../functions/src/emulatorAdmin';
import { sendPushToUserCore, sendPushToUsersCore } from '../../functions/src/pushNotifications';

type Firestore = ReturnType<typeof getEmulatorDb>;

// Exercises the real send/prune logic against the Firestore emulator (for the
// token read/write side) with a FAKE `messaging` — there is no FCM emulator,
// so a real push is never sent in tests. Run via `npm run test:integration`.

let db: Firestore;

beforeAll(() => {
  db = getEmulatorDb('dapurnyonya-9b752');
});

const seedUser = async (id: string, fcmTokens: string[]) => {
  await db.collection('users').doc(id).set({ id, name: 'Test User', fcmTokens });
};

// Builds a fake Messaging whose sendEachForMulticast returns one result per
// token, in order, per the caller-supplied outcome map (default: success).
function fakeMessaging(outcomes: Record<string, { success: boolean; code?: string }>) {
  const sendEachForMulticast = vi.fn(async ({ tokens }: { tokens: string[] }) => {
    const responses = tokens.map((t) => {
      const outcome = outcomes[t] ?? { success: true };
      return outcome.success
        ? { success: true }
        : { success: false, error: { code: outcome.code } };
    });
    return {
      responses,
      successCount: responses.filter((r) => r.success).length,
      failureCount: responses.filter((r) => !r.success).length,
    };
  });
  return { sendEachForMulticast } as any;
}

describe('sendPushToUserCore', () => {
  it('returns sent: 0 without calling messaging when the user has no tokens', async () => {
    await seedUser('u-none', []);
    const messaging = fakeMessaging({});
    const result = await sendPushToUserCore(db, messaging, 'u-none', { title: 't', body: 'b' });
    expect(result).toEqual({ sent: 0, pruned: 0 });
    expect(messaging.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends to every stored token and reports the success count', async () => {
    await seedUser('u-live', ['tok-a', 'tok-b']);
    const messaging = fakeMessaging({});
    const result = await sendPushToUserCore(db, messaging, 'u-live', { title: 'Hi', body: 'There', url: '/x' });
    expect(result).toEqual({ sent: 2, pruned: 0 });
    expect(messaging.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['tok-a', 'tok-b'],
        notification: { title: 'Hi', body: 'There' },
        webpush: { fcmOptions: { link: '/x' } },
      })
    );
  });

  it('prunes dead tokens (invalid/not-registered) but keeps live ones', async () => {
    await seedUser('u-mixed', ['tok-good', 'tok-invalid', 'tok-unregistered']);
    const messaging = fakeMessaging({
      'tok-invalid': { success: false, code: 'messaging/invalid-registration-token' },
      'tok-unregistered': { success: false, code: 'messaging/registration-token-not-registered' },
    });
    const result = await sendPushToUserCore(db, messaging, 'u-mixed', { title: 't', body: 'b' });
    expect(result).toEqual({ sent: 1, pruned: 2 });

    const after = (await db.collection('users').doc('u-mixed').get()).data()!;
    expect(after.fcmTokens).toEqual(['tok-good']);
  });

  it('does not prune a token that failed for a reason other than an invalid/dead token', async () => {
    await seedUser('u-transient', ['tok-flaky']);
    const messaging = fakeMessaging({
      'tok-flaky': { success: false, code: 'messaging/internal-error' },
    });
    const result = await sendPushToUserCore(db, messaging, 'u-transient', { title: 't', body: 'b' });
    expect(result).toEqual({ sent: 0, pruned: 0 });

    const after = (await db.collection('users').doc('u-transient').get()).data()!;
    expect(after.fcmTokens).toEqual(['tok-flaky']);
  });
});

describe('sendPushToUsersCore', () => {
  it('sends to each user independently — one user with no tokens does not block the others', async () => {
    await seedUser('u-fan-1', ['tok-1']);
    await seedUser('u-fan-2', []);
    await seedUser('u-fan-3', ['tok-3']);
    const messaging = fakeMessaging({});

    await sendPushToUsersCore(db, messaging, ['u-fan-1', 'u-fan-2', 'u-fan-3'], { title: 't', body: 'b' });

    // Called once per user that actually has tokens (u-fan-2 is skipped before ever calling messaging).
    expect(messaging.sendEachForMulticast).toHaveBeenCalledTimes(2);
  });
});
