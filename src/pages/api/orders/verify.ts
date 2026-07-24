import type { APIRoute } from "astro";
import { getDb } from "@lib/db/client";
import {
  dbGetOrderById,
  dbGetOrderItemsByOrderId,
  dbUpdateOrderPayment,
} from "@lib/db/repository";
import { fulfillOrder } from "@lib/fulfillment";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface VerifyBody {
  appOrderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return json({ error: "Not authenticated" }, 401);
  const body = (await request.json().catch(() => null)) as VerifyBody | null;
  if (
    !body?.appOrderId ||
    !body.razorpay_order_id ||
    !body.razorpay_payment_id ||
    !body.razorpay_signature
  ) {
    return json({ error: "Missing verification fields" }, 400);
  }

  // Razorpay signature verification requires the key secret from env.
  // This is a direct integration (no InsForge managed payments proxy).
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!razorpayKeySecret) {
    return json({ error: "Razorpay not configured" }, 400);
  }

  // Verify HMAC-SHA256 signature
  let verified = false;
  try {
    const message = `${body.razorpay_order_id}|${body.razorpay_payment_id}`;
    const { createHmac } = await import("node:crypto");
    const digest = createHmac("sha256", razorpayKeySecret)
      .update(message)
      .digest("hex");
    verified = digest === body.razorpay_signature;
  } catch {
    verified = false;
  }

  const db = getDb();

  if (!verified) {
    await dbUpdateOrderPayment(db, body.appOrderId, { payment_status: "failed" });
    return json({ error: "Verification failed" }, 400);
  }

  const orderRow = await dbGetOrderById(db, body.appOrderId);
  if (!orderRow || orderRow.user_id !== locals.user.id) {
    return json({ error: "Order not found" }, 404);
  }

  const items = await dbGetOrderItemsByOrderId(db, body.appOrderId);

  await fulfillOrder(db, {
    orderId: body.appOrderId,
    userId: locals.user.id,
    items: items.map((i) => ({
      product_id: i.product_id ?? "",
      quantity: i.quantity,
    })),
    status: "paid",
    paymentStatus: "captured",
    patch: { razorpay_payment_id: body.razorpay_payment_id },
  });

  return json({ ok: true, orderId: body.appOrderId });
};
