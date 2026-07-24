import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import {
  dbGetProductsById,
  dbGetCouponByCode,
  dbCountCouponRedemptions,
  dbInsertOrder,
  dbInsertOrderItems,
  dbInsertCouponRedemption,
  dbIncrementCouponUsed,
  dbUpdateOrderPayment,
} from "@lib/db/repository";
import { fulfillOrder } from "@lib/fulfillment";
import type { ShippingAddress } from "@lib/types";
import { computeShipping, generateOrderNumber } from "@lib/utils";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const TEST_MODE =
  (import.meta.env.PUBLIC_RAZORPAY_TEST_MODE ?? "true") !== "false";

interface CheckoutBody {
  items: { productId: string; quantity: number }[];
  address: ShippingAddress;
  couponCode?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  if (!body?.items?.length) return json({ error: "Cart is empty" }, 400);
  if (!body.address?.pincode || !body.address?.line1) {
    return json({ error: "Shipping address is incomplete" }, 400);
  }

  const db = getDb();
  const uid = locals.user.id;

  // Server-side re-price
  const ids = body.items.map((i) => i.productId);
  const dbProducts = await dbGetProductsById(db, ids);  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  let subtotal = 0;
  const lineItems: {
    product_id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[] = [];

  for (const item of body.items) {
    const p = productMap.get(item.productId);
    if (!p || !p.is_active) {
      return json({ error: `Product unavailable: ${item.productId}` }, 400);
    }
    if (!p.price || p.price <= 0) {
      return json(
        { error: `${(p as { name: string }).name} is available on request only — contact us to order.` },
        400,
      );
    }
    const qty = Math.max(1, Math.min(item.quantity, p.stock || 1));
    if (p.stock < qty) {
      return json({ error: `Insufficient stock for ${(p as { name: string }).name}` }, 400);
    }
    const line = p.price * qty;
    subtotal += line;
    lineItems.push({
      product_id: p.id,
      product_name: (p as { name: string }).name,
      unit_price: p.price,
      quantity: qty,
      line_total: line,
    });
  }

  const shipping = computeShipping(subtotal);

  // Coupon validation
  let discount = 0;
  let couponId: string | null = null;
  const code = body.couponCode?.trim().toUpperCase();
  if (code) {
    const coupon = await dbGetCouponByCode(db, code);
    if (!coupon) return json({ error: "Invalid coupon code" }, 400);
    const now = Date.now();
    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
      return json({ error: "Coupon is not active yet" }, 400);
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
      return json({ error: "Coupon has expired" }, 400);
    }
    if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
      return json({ error: `Order must be at least ₹${coupon.min_order_amount}` }, 400);
    }
    if (coupon.usage_limit != null && (coupon.used_count ?? 0) >= coupon.usage_limit) {
      return json({ error: "Coupon usage limit reached" }, 400);
    }
    if (coupon.per_user_limit != null) {
      const cnt = await dbCountCouponRedemptions(db, coupon.id, uid);
      if (cnt >= coupon.per_user_limit) {
        return json({ error: "You have already used this coupon" }, 400);
      }
    }
    discount =
      coupon.discount_type === "percent"
        ? (subtotal * coupon.discount_value) / 100
        : coupon.discount_value;
    if (coupon.max_discount_amount) {
      discount = Math.min(discount, coupon.max_discount_amount);
    }
    discount = Math.min(Math.round(discount * 100) / 100, subtotal);
    couponId = coupon.id;
  }

  const total = Math.round((subtotal - discount + shipping) * 100) / 100;
  const orderNumber = generateOrderNumber();

  // 1. Create pending order
  let order: { id: string; order_number: string };
  try {
    order = await dbInsertOrder(db, {
      order_number: orderNumber,
      user_id: uid,
      status: "pending",
      payment_status: "created",
      subtotal,
      shipping,
      total,
      discount,
      coupon_id: couponId,
      currency: "INR",
      shipping_address: body.address,
      is_test_payment: TEST_MODE,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  // 2. Insert order items
  try {
    await dbInsertOrderItems(
      db,
      lineItems.map((li) => ({ order_id: order.id, ...li })),
    );
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  // Record coupon redemption
  if (couponId && discount > 0) {
    await dbInsertCouponRedemption(db, {
      coupon_id: couponId,
      user_id: uid,
      order_id: order.id,
      amount: discount,
    }).catch(() => {});
    await dbIncrementCouponUsed(db, couponId).catch(() => {});
  }

  // 3. Razorpay — not available without InsForge managed payments.
  // Fall through to Cash-on-Delivery immediately (Razorpay wiring is a separate lane).
  await dbUpdateOrderPayment(db, order.id, {
    shipping_address: { ...(body.address as unknown as Record<string, unknown>), _payment_method: "cod" },
    is_test_payment: false,
  });

  await fulfillOrder(db, {
    orderId: order.id,
    userId: uid,
    items: lineItems.map((li) => ({
      product_id: li.product_id,
      quantity: li.quantity,
    })),
    status: "processing",
    paymentStatus: "pending",
  });

  return json({
    mode: "cod",
    orderId: order.id,
    orderNumber: order.order_number,
    note: "Online payments via Razorpay require separate wiring; placed as COD.",
  });
};
