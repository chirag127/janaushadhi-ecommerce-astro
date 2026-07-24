import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  dbGetOrderById,
  dbDecrementStock,
  dbUpdateOrder,
  dbClearCart,
} from "./db/repository";

type DB = NeonHttpDatabase;

const FULFILLED_STATUSES = new Set([
  "paid",
  "processing",
  "shipped",
  "delivered",
]);

/**
 * Idempotent order fulfillment: decrement stock, patch order status, clear cart.
 * Safe to call more than once — keys off order status.
 */
export async function fulfillOrder(
  db: DB,
  opts: {
    orderId: string;
    userId: string;
    items: { product_id: string; quantity: number }[];
    status: string;
    paymentStatus: string;
    patch?: Record<string, unknown>;
  },
): Promise<boolean> {
  const { orderId, userId, items, status, paymentStatus, patch } = opts;

  const order = await dbGetOrderById(db, orderId);
  if (!order) return false;
  if (order.status && FULFILLED_STATUSES.has(order.status)) return false;

  for (const li of items) {
    await dbDecrementStock(db, li.product_id, li.quantity);
  }

  await dbUpdateOrder(db, orderId, {
    status,
    payment_status: paymentStatus,
    ...(patch ?? {}),
  });

  await dbClearCart(db, userId);
  return true;
}
