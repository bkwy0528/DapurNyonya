import { readFileSync } from 'fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc } from 'firebase/firestore';
import { beforeAll, afterAll, afterEach, describe, it } from 'vitest';

const PROJECT_ID = 'dapurnyonya-rules-test';
const ADMIN_EMAIL = 'yikbryan0528work@gmail.com';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8089,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

const customer = (uid: string) => testEnv.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
const admin = () => testEnv.authenticatedContext('admin-uid', { email: ADMIN_EMAIL }).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

// Seeds a document by writing it with rules disabled — mirrors data an admin
// action or a prior valid client write would have already created, so tests
// can focus on the read/update/delete rule being exercised rather than setup.
async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe('products', () => {
  it('lets anyone, including unauthenticated visitors, read the catalog', async () => {
    await seed('products/1', { name: 'Dumplings' });
    await assertSucceeds(getDocs(collection(anon(), 'products')));
  });

  it('blocks a signed-in customer from writing a product', async () => {
    await assertFails(setDoc(doc(customer('cust-1'), 'products/1'), { name: 'Hacked' }));
  });

  it('lets the admin account write products', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'products/1'), { name: 'Dumplings', price: 25 }));
  });
});

describe('orders — create', () => {
  // Orders are created exclusively by the submitOrder Cloud Function (Admin
  // SDK, bypasses these rules), which recomputes prices from the real product
  // catalog and verifies payment server-side before writing anything — see
  // functions/src/index.ts. Direct client creates are blocked unconditionally,
  // closing what was previously a real gap: a client could set its own
  // total/items or write itself straight to a paid/"Order Received" status.
  // (These three replace what were previously two `it.fails` "known gap"
  // placeholders plus a now-obsolete "customer can create" test — the fix
  // flipped both to failures, which is exactly the signal that prompted
  // rewriting them here instead of leaving them red.)
  it('blocks a customer from creating an order directly, even with correct ownership and shape', async () => {
    await assertFails(setDoc(doc(customer('cust-1'), 'orders/o1'), {
      customerId: 'cust-1',
      status: 'Pending Approval',
      total: 25,
    }));
  });

  it('blocks a customer from creating an order under someone else\'s customerId', async () => {
    await assertFails(setDoc(doc(customer('cust-1'), 'orders/o1'), {
      customerId: 'cust-2',
      status: 'Pending Approval',
      total: 25,
    }));
  });

  it('blocks an unauthenticated visitor from creating an order', async () => {
    await assertFails(setDoc(doc(anon(), 'orders/o1'), {
      customerId: 'ghost',
      status: 'Pending Approval',
      total: 25,
    }));
  });

  it('blocks a client from creating an order with a mismatched total or a pre-set paid status', async () => {
    await assertFails(setDoc(doc(customer('cust-1'), 'orders/o1'), {
      customerId: 'cust-1',
      status: 'Pending Approval',
      items: [{ name: 'Dumplings', price: 25, quantity: 1 }],
      total: 0.01,
    }));
    await assertFails(setDoc(doc(customer('cust-1'), 'orders/o1'), {
      customerId: 'cust-1',
      status: 'Order Received',
      paymentStatus: 'paid',
      total: 25,
    }));
  });

  it('blocks the admin from creating an order directly too — even they go through submitOrder', async () => {
    await assertFails(setDoc(doc(admin(), 'orders/o1'), {
      customerId: 'cust-1',
      status: 'Pending Approval',
      total: 25,
    }));
  });
});

describe('paymentConfirmations', () => {
  it('blocks every client from reading or writing payment confirmations, admin included', async () => {
    await seed('paymentConfirmations/bill-1', { status: '1', amount: 2500 });
    await assertFails(getDoc(doc(customer('cust-1'), 'paymentConfirmations/bill-1')));
    await assertFails(getDoc(doc(admin(), 'paymentConfirmations/bill-1')));
    await assertFails(setDoc(doc(admin(), 'paymentConfirmations/bill-2'), { status: '1' }));
  });
});

describe('orders — read', () => {
  it('lets a customer read their own order', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Pending Approval' });
    await assertSucceeds(getDoc(doc(customer('cust-1'), 'orders/o1')));
  });

  it('blocks a customer from reading someone else\'s order', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Pending Approval' });
    await assertFails(getDoc(doc(customer('cust-2'), 'orders/o1')));
  });

  it('lets the admin read any order', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Pending Approval' });
    await assertSucceeds(getDoc(doc(admin(), 'orders/o1')));
  });
});

describe('orders — customer self-cancel', () => {
  it('lets a customer cancel their own order while Pending Approval', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Pending Approval', total: 25 });
    await assertSucceeds(updateDoc(doc(customer('cust-1'), 'orders/o1'), {
      status: 'Cancelled',
      cancelledAt: '2026-07-09T00:00:00.000Z',
    }));
  });

  it('blocks cancelling an order that has moved past Pending Approval', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Order Received', total: 25 });
    await assertFails(updateDoc(doc(customer('cust-1'), 'orders/o1'), {
      status: 'Cancelled',
      cancelledAt: '2026-07-09T00:00:00.000Z',
    }));
  });

  it('blocks a customer from changing any field other than status/cancelledAt while cancelling', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Pending Approval', total: 25 });
    await assertFails(updateDoc(doc(customer('cust-1'), 'orders/o1'), {
      status: 'Cancelled',
      cancelledAt: '2026-07-09T00:00:00.000Z',
      total: 0, // sneaking in an unrelated field change alongside a legal cancel
    }));
  });

  it('blocks a customer from cancelling someone else\'s order', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Pending Approval', total: 25 });
    await assertFails(updateDoc(doc(customer('cust-2'), 'orders/o1'), {
      status: 'Cancelled',
      cancelledAt: '2026-07-09T00:00:00.000Z',
    }));
  });

  it('lets the admin update an order to any status at any stage', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Order Received', total: 25 });
    await assertSucceeds(updateDoc(doc(admin(), 'orders/o1'), { status: 'In Preparation' }));
  });
});

describe('orders — delete', () => {
  it('blocks a customer from deleting an order', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Pending Approval' });
    await assertFails(deleteDoc(doc(customer('cust-1'), 'orders/o1')));
  });

  it('lets the admin delete an order', async () => {
    await seed('orders/o1', { customerId: 'cust-1', status: 'Pending Approval' });
    await assertSucceeds(deleteDoc(doc(admin(), 'orders/o1')));
  });
});

describe('orderCounts', () => {
  it('lets anyone read capacity counts, including unauthenticated visitors', async () => {
    await seed('orderCounts/2026-07-09', { count: 3 });
    await assertSucceeds(getDoc(doc(anon(), 'orderCounts/2026-07-09')));
  });

  it('blocks an unauthenticated visitor from writing a capacity count', async () => {
    await assertFails(setDoc(doc(anon(), 'orderCounts/2026-07-09'), { count: 1 }));
  });

  it('lets any signed-in customer write a capacity count', async () => {
    await assertSucceeds(setDoc(doc(customer('cust-1'), 'orderCounts/2026-07-09'), { count: 1 }));
  });
});

describe('users', () => {
  it('lets a customer read and write their own profile', async () => {
    await assertSucceeds(setDoc(doc(customer('cust-1'), 'users/cust-1'), { name: 'Alice' }));
    await assertSucceeds(getDoc(doc(customer('cust-1'), 'users/cust-1')));
  });

  it('blocks a customer from reading someone else\'s profile', async () => {
    await seed('users/cust-2', { name: 'Bob' });
    await assertFails(getDoc(doc(customer('cust-1'), 'users/cust-2')));
  });

  it('blocks a customer from writing to someone else\'s profile', async () => {
    await assertFails(setDoc(doc(customer('cust-1'), 'users/cust-2'), { name: 'Hacked' }));
  });

  it('lets the admin read (but not write) another user\'s profile', async () => {
    await seed('users/cust-1', { name: 'Alice' });
    await assertSucceeds(getDoc(doc(admin(), 'users/cust-1')));
    await assertFails(setDoc(doc(admin(), 'users/cust-1'), { name: 'Overwritten by admin' }));
  });
});

describe('adminProfile', () => {
  it('blocks a customer from reading the admin profile', async () => {
    await seed('adminProfile/main', { name: 'Admin' });
    await assertFails(getDoc(doc(customer('cust-1'), 'adminProfile/main')));
  });

  it('lets the admin read and write their own profile document', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'adminProfile/main'), { name: 'Admin' }));
    await assertSucceeds(getDoc(doc(admin(), 'adminProfile/main')));
  });
});

describe('settings and dailyLimits', () => {
  it('lets anyone read business settings and daily limits', async () => {
    await seed('settings/business', { businessName: 'DapurNyonya' });
    await seed('dailyLimits/2026-07-09', { limit: 10 });
    await assertSucceeds(getDoc(doc(anon(), 'settings/business')));
    await assertSucceeds(getDoc(doc(anon(), 'dailyLimits/2026-07-09')));
  });

  it('blocks a customer from writing business settings or daily limits', async () => {
    await assertFails(setDoc(doc(customer('cust-1'), 'settings/business'), { businessName: 'Hacked' }));
    await assertFails(setDoc(doc(customer('cust-1'), 'dailyLimits/2026-07-09'), { limit: 999 }));
  });

  it('lets the admin write business settings and daily limits', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'settings/business'), { businessName: 'DapurNyonya' }));
    await assertSucceeds(setDoc(doc(admin(), 'dailyLimits/2026-07-09'), { limit: 10 }));
  });
});

describe('counters', () => {
  it('lets any signed-in user read and write the daily order-number counter', async () => {
    await assertSucceeds(setDoc(doc(customer('cust-1'), 'counters/orders-260709'), { count: 1 }));
    await assertSucceeds(getDoc(doc(customer('cust-1'), 'counters/orders-260709')));
  });

  it('blocks an unauthenticated visitor from writing the counter', async () => {
    await assertFails(setDoc(doc(anon(), 'counters/orders-260709'), { count: 1 }));
  });
});
