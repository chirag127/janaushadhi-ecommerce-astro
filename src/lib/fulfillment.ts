import type { createAdminClient } from "@insforge/sdk";

type Admin = ReturnType<typeof createAdminClient>;

interface LineItem {
  product_id: string;
  quantity: number;
}

// Order statuses that mean fulfillment has already run.
const FULFILLED_STATUSES = new Set([
  "paid",
  "processing",
  "shipped",
  "delivered",
]);

/**
 * Idempotent order fulfillment: decrement product stock and clear the buyer's
 * cart. Safe to call more than once — it keys off the order's `status`, so a
 * second call (e.g. webhook + client both firing) is a no-op.
 *
 * Runs with the admin client (bypasses RLS) and must only be invoked from
 * server code that has already authorized the caller / verified the payment.
 *
 * @returns true if this call performed fulfillment, false if already done.
 */
export async function fulfillOrder(
  admin: Admin,
  opts: {
    orderId: string;
    userId: string;
    items: LineItem[];
    /** New order status, e.g. "paid" (Razorpay) or "processing" (COD). */
    status: string;
    /** New payment_status, e.g. "captured" (Razorpay) or "pending" (COD). */
    paymentStatus: string;
    /** Optional extra order columns to set (e.g. razorpay_payment_id). */
    patch?: Record<string, unknown>;
  },
): Promise<boolean> {
  const { orderId, userId, items, status, paymentStatus, patch } = opts;

  // Idempotency guard: only fulfill an order still in the initial state.
  const { data: order } = await admin.database
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  const current = order as { status?: string } | null;
  if (!current) return false;
  if (current.status && FULFILLED_STATUSES.has(current.status)) return false;

  // Decrement stock per line item. No atomic RPC exists in the schema, so we
  // read-then-write with a floor at 0. Admin client bypasses RLS.
  for (const li of items) {
    const { data: prod } = await admin.database
      .from("products")
      .select("stock")
      .eq("id", li.product_id)
      .maybeSingle();
    const stock = (prod as { stock?: number } | null)?.stock ?? 0;
    const next = Math.max(0, stock - li.quantity);
    await admin.database
      .from("products")
      .update({ stock: next })
      .eq("id", li.product_id);
  }

  // Mark the order fulfilled.
  await admin.database
    .from("orders")
    .update({ status, payment_status: paymentStatus, ...(patch ?? {}) })
    .eq("id", orderId);

  // Clear the buyer's server-side cart.
  await admin.database.from("cart_items").delete().eq("user_id", userId);

  return true;
}
