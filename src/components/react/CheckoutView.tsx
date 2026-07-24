import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { $cart, cartClear } from "@lib/stores";
import { fetchProductsByIds } from "@lib/api-client";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}
interface Props {
  currency?: string;
  defaultName?: string;
  defaultEmail?: string;
  razorpayKeyId?: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (evt: string, cb: (e: unknown) => void) => void;
    };
  }
}

function fmt(inr: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(inr);
  } catch {
    return `₹${inr.toFixed(2)}`;
  }
}

export default function CheckoutView({ currency = "INR" }: Props) {
  const cart = useStore($cart);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [coupon, setCoupon] = useState("");
  const [addr, setAddr] = useState({
    full_name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });

  const ids = Object.keys(cart).filter((id) => Number(cart[id]) > 0);

  useEffect(() => {
    let active = true;
    (async () => {
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      const data = await fetchProductsByIds(ids);
      if (!active) return;
      const map: Record<string, Product> = {};
      (data as Product[] | null)?.forEach((p) => (map[p.id] = p));
      setProducts(map);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  const lines = ids
    .map((id) => ({ id, qty: Number(cart[id]), product: products[id] }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const shipping = subtotal <= 0 ? 0 : subtotal >= 500 ? 0 : 40;
  const total = subtotal + shipping;

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.id, quantity: l.qty })),
          address: addr,
          couponCode: coupon.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        mode?: "razorpay" | "cod";
        orderId?: string;
        checkoutOptions?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok || !data.orderId) {
        throw new Error(data.error ?? "Could not start checkout");
      }

      const appOrderId = data.orderId;

      // ---- Cash-on-Delivery: order already placed + fulfilled server-side ----
      if (data.mode === "cod") {
        cartClear();
        location.assign(`/orders/${appOrderId}?placed=1`);
        return;
      }

      // ---- Razorpay online payment ----
      if (!data.checkoutOptions) {
        throw new Error("Could not start checkout");
      }
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Failed to load payment gateway");

      const options = {
        ...data.checkoutOptions,
        prefill: {
          name: addr.full_name,
          contact: addr.phone,
        },
        theme: { color: "#0c8365" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const vr = await fetch("/api/orders/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appOrderId, ...response }),
          });
          if (vr.ok) {
            cartClear();
            location.assign(`/orders/${appOrderId}?paid=1`);
          } else {
            location.assign(`/orders/${appOrderId}?failed=1`);
          }
        },
      };
      const rzp = new window.Razorpay!(options);
      rzp.on("payment.failed", () => {
        setError("Payment failed. Please try again.");
        setSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setSubmitting(false);
    }
  };

  if (loading)
    return <div className="card p-12 text-center text-slate-500">Loading…</div>;

  if (lines.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="mb-4 text-slate-500">Your cart is empty.</p>
        <a href="/products" className="btn-primary">
          Browse Medicines
        </a>
      </div>
    );
  }

  const field = (
    key: keyof typeof addr,
    label: string,
    required = true,
    type = "text",
  ) => (
    <div>
      <label className="label">
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        className="input"
        required={required}
        value={addr[key]}
        onChange={(e) => setAddr({ ...addr, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <form onSubmit={placeOrder} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="card space-y-4 p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white">
          Shipping Address
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("full_name", "Full Name")}
          {field("phone", "Phone", true, "tel")}
        </div>
        {field("line1", "Address Line 1")}
        {field("line2", "Address Line 2", false)}
        <div className="grid gap-4 sm:grid-cols-3">
          {field("city", "City")}
          {field("state", "State")}
          {field("pincode", "PIN Code")}
        </div>
        {field("country", "Country")}
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Order Summary
          </h2>
          <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
            {lines.map((l) => (
              <div key={l.id} className="flex justify-between gap-2">
                <span className="line-clamp-1 text-slate-600 dark:text-slate-300">
                  {l.product.name} × {l.qty}
                </span>
                <span className="shrink-0">
                  {fmt(l.product.price * l.qty, currency)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
            <span className="text-slate-500">Subtotal</span>
            <span>{fmt(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Shipping</span>
            <span>{shipping === 0 ? "FREE" : fmt(shipping, currency)}</span>
          </div>
          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <label
              htmlFor="coupon"
              className="mb-1 block text-xs font-medium text-slate-500"
            >
              Promo code
            </label>
            <input
              id="coupon"
              type="text"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase dark:border-slate-700 dark:bg-slate-900"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-slate-400">
              Discount applied at checkout after validation.
            </p>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 font-bold dark:border-slate-800">
            <span>Total (INR)</span>
            <span>{fmt(total, "INR")}</span>
          </div>
          {currency !== "INR" && (
            <p className="text-xs text-slate-400">
              Charged in INR. Displayed total: {fmt(total, currency)}
            </p>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Processing…" : "Place Order"}
          </button>
          <p className="text-center text-xs text-slate-400">
            Secure checkout — pay online via Razorpay or Cash on Delivery
          </p>
        </div>
      </aside>
    </form>
  );
}
