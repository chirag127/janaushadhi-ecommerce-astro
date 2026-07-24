import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { $cart, cartSet, cartRemove, $userId } from "@lib/stores";
import { cartApi, fetchProductsByIds } from "@lib/api-client";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  mrp: number;
  image_url: string | null;
  stock: number;
  unit_size: string | null;
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

export default function CartView({ currency = "INR" }: { currency?: string }) {
  const cart = useStore($cart);
  const userId = useStore($userId);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);

  const ids = Object.keys(cart).filter((id) => Number(cart[id]) > 0);

  useEffect(() => {
    let active = true;
    (async () => {
      if (ids.length === 0) {
        setProducts({});
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await fetchProductsByIds(ids);
      if (!active) return;
      const map: Record<string, Product> = {};
      (data as Product[]).forEach((p) => (map[p.id] = p));
      setProducts(map);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  const updateQty = (id: string, qty: number) => {
    cartSet(id, qty);
    if (userId) {
      if (qty <= 0) cartApi.remove(id).catch(() => {});
      else cartApi.update(id, qty).catch(() => {});
    }
  };
  const remove = (id: string) => {
    cartRemove(id);
    if (userId) cartApi.remove(id).catch(() => {});
  };

  const lines = ids
    .map((id) => ({ id, qty: Number(cart[id]), product: products[id] }))
    .filter((l) => l.product);

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const shipping = subtotal <= 0 ? 0 : subtotal >= 500 ? 0 : 40;
  const total = subtotal + shipping;

  if (loading) {
    return <div className="card p-12 text-center text-slate-500">Loading…</div>;
  }

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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {lines.map((l) => (
          <div key={l.id} className="card flex gap-4 p-4">
            <a
              href={`/products/${l.product.slug}`}
              className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-800"
            >
              {l.product.image_url ? (
                <img
                  src={l.product.image_url}
                  alt={l.product.name}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <span className="text-brand-300 text-3xl">💊</span>
              )}
            </a>
            <div className="flex flex-1 flex-col">
              <a
                href={`/products/${l.product.slug}`}
                className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-brand-600 dark:text-white"
              >
                {l.product.name}
              </a>
              {l.product.unit_size && (
                <span className="text-xs text-slate-500">
                  Pack: {l.product.unit_size}
                </span>
              )}
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700">
                  <button
                    onClick={() => updateQty(l.id, l.qty - 1)}
                    className="px-2.5 py-1 text-lg"
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm">{l.qty}</span>
                  <button
                    onClick={() =>
                      updateQty(l.id, Math.min(l.qty + 1, l.product.stock))
                    }
                    className="px-2.5 py-1 text-lg"
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {fmt(l.product.price * l.qty, currency)}
                </span>
              </div>
            </div>
            <button
              onClick={() => remove(l.id)}
              className="self-start text-slate-400 hover:text-rose-500"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Order Summary
          </h2>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span>{fmt(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Shipping</span>
            <span>{shipping === 0 ? "FREE" : fmt(shipping, currency)}</span>
          </div>
          {subtotal < 500 && (
            <p className="text-xs text-brand-600">
              Add {fmt(500 - subtotal, currency)} more for free shipping.
            </p>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-3 font-bold dark:border-slate-800">
            <span>Total</span>
            <span>{fmt(total, currency)}</span>
          </div>
          <a href="/checkout" className="btn-primary w-full">
            Proceed to Checkout
          </a>
        </div>
      </aside>
    </div>
  );
}
