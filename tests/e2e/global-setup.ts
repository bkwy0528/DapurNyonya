import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, terminate } from 'firebase/firestore';

// Must match src/app/utils/db.ts's ADMIN_EMAIL — duplicated rather than
// imported, since this script runs directly under Node (not Vite), so
// importing anything that pulls in src/firebase.ts here would skip the
// emulator wiring (which is gated on import.meta.env, a Vite-only construct)
// and try to reach real production Firebase.
export const ADMIN_EMAIL = 'yikbryan0528work@gmail.com';
export const ADMIN_PASSWORD = 'AdminTest123!';

// Mirrors utils/db.ts's seedDefaultProducts() — kept independent (rather than
// imported) for the same Node-vs-Vite reason above.
const DEFAULT_PRODUCTS = [
  {
    id: '1',
    name: 'Traditional Dumplings',
    description: 'Handmade with premium ingredients, perfect for festive celebrations',
    price: 25.0,
    image: 'https://images.unsplash.com/photo-1766309416197-5982d32f4ce0',
    unit: 'pack (12 pieces)',
    prepDays: 3,
    available: true,
  },
  {
    id: '2',
    name: 'Festive Cookies',
    description: 'Assorted cookies with traditional flavors and decorations',
    price: 18.0,
    image: 'https://images.unsplash.com/photo-1627373369962-42fd4fde6504',
    unit: 'box (20 cookies)',
    prepDays: 2,
    available: true,
  },
];

// Runs once before the whole e2e suite (see playwright.config.ts). Provisions
// the admin account and the product catalog directly against the emulator,
// the same real project ID the app itself uses in emulator mode — so every
// spec file can assume both already exist rather than each re-deriving them.
export default async function globalSetup() {
  const app = initializeApp({ projectId: 'dapurnyonya-9b752', apiKey: 'test-api-key' }, 'e2e-global-setup');
  const auth = getAuth(app);
  const db = getFirestore(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8089);

  await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  await Promise.all(DEFAULT_PRODUCTS.map((p) => setDoc(doc(db, 'products', p.id), p)));

  // General-product ordering is closed until the admin opens a date window
  // (see openOrderRanges in src/app/utils/business.ts) — seed one covering the
  // whole test run so specs that complete checkout don't need to configure it
  // themselves.
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 1);
  await setDoc(doc(db, 'settings', 'business'), {
    openOrderRanges: [{ start: '2020-01-01', end: farFuture.toISOString().slice(0, 10) }],
  });

  await terminate(db);
  await deleteApp(app);
}
