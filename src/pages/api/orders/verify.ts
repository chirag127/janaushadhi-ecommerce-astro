import type { APIRoute } from "astro";
import { createInsForgeServer } from "@lib/insforge/server";
import { createInsForgeAdmin } from "@lib/insforge/admin";
import { fulfillOrder } from "@lib/fulfillment";

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

interface VerifyBody {
  appOrderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
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

  const insforge = createInsForgeServer(cookies, locals);

  // InsForge verifies the signature server-side against the stored key secret.
  const { data, error } = await insforge.payments.razorpay.verifyOrder(RZP_ENV, {
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });

  const verified =
    !error &&
    ((data as { verified?: boolean } | null)?.verified ?? Boolean(data));

  if (!verified) {
    await insforge.database
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", body.appOrderId)
      .eq("user_id", locals.user.id);
    return json({ error: error?.message ?? "Verification failed" }, 400);
  }

  // Payment authentic — fulfill idempotently (decrement stock, clear cart,
  // mark paid). Durable fulfillment ALSO comes from the Razorpay webhook ->
  // payments.webhook_events trigger; fulfillOrder's status guard makes the
  // double-fire a no-op. Uses the admin client since it must own the order row
  // regardless of the caller's RLS scope. We still scope reads to this user.
  const admin = createInsForgeAdmin(locals);

  // Load line items for this order (scoped to the authenticated user's order).
  const { data: orderRow } = await admin.database
    .from("orders")
    .select("id, user_id")
    .eq("id", body.appOrderId)
    .maybeSingle();
  const owner = (orderRow as { user_id?: string } | null)?.user_id;
  if (!owner || owner !== locals.user.id) {
    return json({ error: "Order not found" }, 404);
  }

  const { data: items } = await admin.database
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", body.appOrderId);

  await fulfillOrder(admin, {
    orderId: body.appOrderId,
    userId: locals.user.id,
    items: (items as { product_id: string; quantity: number }[]) ?? [],
    status: "paid",
    paymentStatus: "captured",
    patch: { razorpay_payment_id: body.razorpay_payment_id },
  });

  return json({ ok: true, orderId: body.appOrderId });
};
