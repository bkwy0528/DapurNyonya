import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

const PROJECT_ID = 'dapurnyonya-9b752'; // must match the app's project so it sees the docs
const FIRESTORE_HOST = { host: '127.0.0.1', port: 8089 };

// Reads a users/{uid} doc directly (rules disabled) so a test can assert on
// server-side state the UI doesn't surface — e.g. whether a push token
// actually got saved.
export async function readUserByEmail(email: string): Promise<any> {
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE_HOST });
  try {
    let data: any = null;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
      if (!snap.empty) data = snap.docs[0].data();
    });
    return data;
  } finally {
    await env.cleanup();
  }
}

export async function readUser(uid: string): Promise<any> {
  const env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: FIRESTORE_HOST });
  try {
    let data: any = null;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), 'users', uid));
      data = snap.exists() ? snap.data() : null;
    });
    return data;
  } finally {
    await env.cleanup();
  }
}
