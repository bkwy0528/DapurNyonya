import type { Firestore } from 'firebase-admin/firestore';

// Mirrors IngredientEstimationPage.tsx's NEEDS_PREPARATION list — an order's
// items only count toward the "Required" total while its status is one of
// these. The transition out of this set and into a "just finished cooking"
// status is also the point at which those quantities should come off
// "Purchased" (the admin's manually-topped-up running stock count), so the
// two figures never drift apart without a manual reset.
const NEEDS_PREPARATION_STATUSES = new Set(['Pending Approval', 'Order Received', 'In Preparation']);

// Reaching either of these means prep just finished for this order — the one
// point in the fulfilment flow where consumption is known to have happened,
// as opposed to Cancelled/Rejected (nothing was cooked) or a later status
// change out of these two (already deducted once, see the `before` guard).
const JUST_FULFILLED_STATUSES = new Set(['Ready for Pickup', 'Out for Delivery']);

export function shouldDeductIngredients(beforeStatus: string, afterStatus: string): boolean {
  return NEEDS_PREPARATION_STATUSES.has(beforeStatus) && JUST_FULFILLED_STATUSES.has(afterStatus);
}

interface OrderItem {
  productId: string;
  quantity: number;
}

// Deducts the ingredients an order's items actually consumed from each
// ingredient's running `purchased` stock count. Only recipe rows that carry
// an `ingredientId` (i.e. already migrated to the shared ingredient master
// list) participate — legacy free-text rows were never trackable as stock to
// begin with (see IngredientEstimationPage.tsx's migration banner). Clamped
// at 0 rather than allowed to go negative: a shortfall here means the admin
// under-recorded a purchase, not that stock is owed.
export async function deductIngredientsForOrderCore(db: Firestore, items: OrderItem[]): Promise<void> {
  const productSnaps = await Promise.all(
    items.map((item) => db.collection('products').doc(item.productId).get())
  );

  const neededByIngredientId = new Map<string, number>();
  productSnaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const recipe = ((snap.data() as any).ingredients || []) as Array<{ ingredientId?: string; quantity: number }>;
    const quantity = items[i].quantity;
    recipe.forEach((ing) => {
      if (!ing.ingredientId) return;
      neededByIngredientId.set(ing.ingredientId, (neededByIngredientId.get(ing.ingredientId) || 0) + ing.quantity * quantity);
    });
  });

  if (neededByIngredientId.size === 0) return;

  const ingredientIds = Array.from(neededByIngredientId.keys());
  const ingredientRefs = ingredientIds.map((id) => db.collection('ingredients').doc(id));

  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(ingredientRefs.map((ref) => tx.get(ref)));
    snaps.forEach((snap, i) => {
      if (!snap.exists) return;
      const current = Number((snap.data() as any).purchased) || 0;
      const needed = neededByIngredientId.get(ingredientIds[i])!;
      tx.update(ingredientRefs[i], { purchased: Math.max(0, current - needed) });
    });
  });
}
