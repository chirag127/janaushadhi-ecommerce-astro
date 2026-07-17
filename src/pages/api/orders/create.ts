import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";
import { createInsForgeAdmin } from "@lib/insforge/admin";
import { fulfillOrder } from "@lib/fulfillment";
import type { Product, ShippingAddress } from "@lib/types";
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
const RZP_ENV: "test" | "live" = TEST_MODE ? "test" : "live";

interface CheckoutBody {
  items: { productId: string; quantity: number }[];
  address: ShippingAddress;
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  if (!body?.items?.length) return json({ error: "Cart is empty" }, 400);
  if (!body.address?.pincode || !body.address?.line1) {
    return json({ error: "Shipping address is incomplete" }, 400);
  }

  const insforge = createInsForgeServer(cookies, locals);
  const uid = locals.user.id;

  // Re-price server-side against DB (never trust client prices).
  const ids = body.items.map((i) => i.productId);
  const { data: products } = await insforge.database
    .from("products")
    .select("id, name, price, stock, is_active")
    .in("id", ids);

  const productMap = new Map(
    ((products as Product[]) ?? []).map((p) => [p.id, p]),
  );

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
    const qty = Math.max(1, Math.min(item.quantity, p.stock || 1));
    if (p.stock < qty) {
      return json({ error: `Insufficient stock for ${p.name}` }, 400);
    }
    const line = p.price * qty;
    subtotal += line;
    lineItems.push({
      product_id: p.id,
      product_name: p.name,
      unit_price: p.price,
      quantity: qty,
      line_total: line,
    });
  }

  const shipping = computeShipping(subtotal);
  const total = Math.round((subtotal + shipping) * 100) / 100;
  const orderNumber = generateOrderNumber();

  // 1. Create the app-owned pending order.
  const { data: orderRow, error: orderErr } = await insforge.database
    .from("orders")
    .insert([
      {
        order_number: orderNumber,
        user_id: uid,
        status: "pending",
        payment_status: "created",
        subtotal,
        shipping,
        total,
        currency: "INR",
        shipping_address: body.address,
        is_test_payment: TEST_MODE,
      },
    ])
    .select()
    .single();

  if (orderErr || !orderRow) {
    return json({ error: orderErr?.message ?? "Failed to create order" }, 400);
  }
  const order = orderRow as { id: string; order_number: string };

  // 2. Create order items.
  const { error: itemsErr } = await insforge.database
    .from("order_items")
    .insert(lineItems.map((li) => ({ order_id: order.id, ...li })));
  if (itemsErr) {
    return json({ error: itemsErr.message }, 400);
  }

  // 3. Create the Razorpay order via InsForge managed payments.
  //
  // If Razorpay is NOT configured on the backend (see setup TODO below), this
  // call fails — we then gracefully fall back to a Cash-on-Delivery order so
  // checkout still works end-to-end. To enable online payments, the admin runs:
  //
  //   npx @insforge/cli payments razorpay configure \
  //     --environment test --key-id <RZP_KEY_ID> --key-secret <RZP_KEY_SECRET>
  //   npx @insforge/cli payments razorpay catalog --environment test
  //
  // then set PUBLIC_RAZORPAY_TEST_MODE appropriately and redeploy.
  const { data: rzp, error: rzpErr } =
    await insforge.payments.razorpay.createOrder(RZP_ENV, {
      amount: Math.round(total * 100), // paise
      currency: "INR",
      subject: { type: "user", id: uid },
      customerName: locals.user.name ?? null,
      customerEmail: (locals.user.email as string) ?? null,
      receipt: order.order_number.slice(0, 40),
      notes: { app_order_id: order.id, order_number: order.order_number },
    });

  // ---- Razorpay path ----
  if (!rzpErr && rzp?.checkoutOptions) {
    const rzpOrderId =
      (rzp.order as { id?: string } | undefined)?.id ??
      (rzp.checkoutOptions as { order_id?: string } | undefined)?.order_id ??
      null;
    await insforge.database
      .from("orders")
      .update({ razorpay_order_id: rzpOrderId, payment_status: "pending" })
      .eq("id", order.id);

    return json({
      mode: "razorpay",
      orderId: order.id,
      orderNumber: order.order_number,
      environment: RZP_ENV,
      checkoutOptions: rzp.checkoutOptions,
    });
  }

  // ---- Cash-on-Delivery fallback (Razorpay unconfigured / init failed) ----
  // Fulfill immediately: decrement stock + clear cart, idempotently, via the
  // admin client. The order is marked "processing" / payment "pending" and is
  // collected on delivery.
  const admin = createInsForgeAdmin(locals);
  await admin.database
    .from("orders")
    .update({
      shipping_address: { ...body.address, _payment_method: "cod" },
      is_test_payment: false,
    })
    .eq("id", order.id);

  await fulfillOrder(admin, {
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
    note: rzpErr?.message ?? "Online payments not configured; placed as COD.",
  });
};
