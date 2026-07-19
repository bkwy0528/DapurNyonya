import { describe, it, expect, beforeAll } from 'vitest';
import { getEmulatorDb } from '../../functions/src/emulatorAdmin';
import { deductIngredientsForOrderCore, shouldDeductIngredients } from '../../functions/src/ingredientDeduction';

type Firestore = ReturnType<typeof getEmulatorDb>;

// Exercises the REAL onOrderStatusChange deduction logic (extracted into
// functions/src/ingredientDeduction.ts so it can be exercised directly)
// against the Firestore emulator through the same Admin SDK the deployed
// function uses. Run via `npm run test:integration`.

let db: Firestore;

beforeAll(() => {
  db = getEmulatorDb('dapurnyonya-9b752');
});

describe('shouldDeductIngredients', () => {
  it('deducts on the transition from a needs-preparation status into a just-fulfilled one', () => {
    expect(shouldDeductIngredients('In Preparation', 'Ready for Pickup')).toBe(true);
    expect(shouldDeductIngredients('In Preparation', 'Out for Delivery')).toBe(true);
    expect(shouldDeductIngredients('Order Received', 'Ready for Pickup')).toBe(true);
  });

  it('does not deduct for a status change that is not into a just-fulfilled status', () => {
    expect(shouldDeductIngredients('Order Received', 'In Preparation')).toBe(false);
    expect(shouldDeductIngredients('Ready for Pickup', 'Delivered')).toBe(false); // already deducted at the earlier transition
    expect(shouldDeductIngredients('In Preparation', 'Cancelled')).toBe(false); // nothing was cooked
    expect(shouldDeductIngredients('In Preparation', 'Rejected')).toBe(false);
  });
});

describe('deductIngredientsForOrderCore', () => {
  it('subtracts each recipe ingredient (scaled by item quantity) from Purchased', async () => {
    await db.collection('ingredients').doc('flour').set({ id: 'flour', name: 'Flour', unit: 'kg', purchased: 10 });
    await db.collection('ingredients').doc('sugar').set({ id: 'sugar', name: 'Sugar', unit: 'kg', purchased: 5 });
    await db.collection('products').doc('cake').set({
      id: 'cake', name: 'Cake',
      ingredients: [
        { ingredientId: 'flour', name: 'Flour', unit: 'kg', quantity: 2 },
        { ingredientId: 'sugar', name: 'Sugar', unit: 'kg', quantity: 1 },
      ],
    });

    await deductIngredientsForOrderCore(db, [{ productId: 'cake', quantity: 3 }]);

    expect((await db.collection('ingredients').doc('flour').get()).data()!.purchased).toBe(4); // 10 - 2*3
    expect((await db.collection('ingredients').doc('sugar').get()).data()!.purchased).toBe(2); // 5 - 1*3
  });

  it('clamps at 0 instead of going negative when Purchased under-records the actual stock', async () => {
    await db.collection('ingredients').doc('butter').set({ id: 'butter', name: 'Butter', unit: 'kg', purchased: 1 });
    await db.collection('products').doc('cookie').set({
      id: 'cookie', name: 'Cookie',
      ingredients: [{ ingredientId: 'butter', name: 'Butter', unit: 'kg', quantity: 5 }],
    });

    await deductIngredientsForOrderCore(db, [{ productId: 'cookie', quantity: 1 }]);

    expect((await db.collection('ingredients').doc('butter').get()).data()!.purchased).toBe(0);
  });

  it('skips legacy recipe rows that have no ingredientId', async () => {
    await db.collection('products').doc('legacy-product').set({
      id: 'legacy-product', name: 'Legacy Product',
      ingredients: [{ name: 'Untracked Spice', unit: 'g', quantity: 10 }],
    });

    // Should resolve without throwing and without writing anything.
    await expect(deductIngredientsForOrderCore(db, [{ productId: 'legacy-product', quantity: 2 }])).resolves.toBeUndefined();
  });

  it('is a no-op when the product no longer exists', async () => {
    await expect(deductIngredientsForOrderCore(db, [{ productId: 'does-not-exist', quantity: 1 }])).resolves.toBeUndefined();
  });
});
