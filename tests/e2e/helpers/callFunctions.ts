import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

// Calls the real submitBatchOrderPayment callable in the Functions emulator as
// a signed-in customer — from Node, outside the browser — so its server-side
// integrity checks (ownership, status, payment confirmation) can be exercised
// directly. The browser flow can't reach them in the emulator because the
// step before (paying on ToyyibPay's hosted page) is a real external gateway.
export async function callSubmitBatchOrderPayment(
  email: string,
  password: string,
  payload: { batchOrderId: string; billCode: string; paymentMethod: 'tng' | 'fpx'; paymentNote?: string },
): Promise<{ ok: boolean; code?: string; data?: any }> {
  const app = initializeApp(
    { projectId: 'dapurnyonya-9b752', apiKey: 'test-api-key' },
    `call-fn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  );
  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    await signInWithEmailAndPassword(auth, email, password);
    const fns = getFunctions(app, 'asia-southeast1');
    connectFunctionsEmulator(fns, '127.0.0.1', 5001);
    const result = await httpsCallable(fns, 'submitBatchOrderPayment')(payload);
    return { ok: true, data: result.data };
  } catch (err: any) {
    return { ok: false, code: err?.code };
  } finally {
    await deleteApp(app);
  }
}
