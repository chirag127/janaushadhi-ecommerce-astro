import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { $wishlist, wishlistToggle, cartAdd, $userId } from "@lib/stores";
import { wishlistApi, cartApi } from "@lib/api-client";
import { getInsForge } from "@lib/insforge/browser";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  mrp: number;
  image_url: string | null;
  stock: number;
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

export default function WishlistView({ currency = "INR" }: { currency?: string }) {
  const wishlist = useStore($wishlist);
  const userId = useStore($userId);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const ids = Object.keys(wishlist).filter((id) => wishlist[id]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (ids.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      const insforge = getInsForge();
      const { data } = await insforge.database
        .from("products")
        .select("id,name,slug,price,mrp,image_url,stock")
        .in("id", ids);
      if (!active) return;
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  const removeItem = (id: string) => {
    wishlistToggle(id);
    if (userId) wishlistApi.toggle(id).catch(() => {});
  };
  const addToCart = (id: string) => {
    cartAdd(id, 1);
    window.dispatchEvent(new CustomEvent("cart:changed"));
    if (userId) cartApi.add(id, 1).catch(() => {});
  };

  if (loading)
    return <div className="card p-12 text-center text-slate-500">Loading…</div>;

  if (products.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="mb-4 text-slate-500">Your wishlist is empty.</p>
        <a href="/products" className="btn-primary">
          Browse Medicines
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <div key={p.id} className="card flex flex-col overflow-hidden">
          <a
            href={`/products/${p.slug}`}
            className="grid aspect-square place-items-center bg-slate-50 dark:bg-slate-800"
          >
            {p.image_url ? (
              <img
                src={p.image_url}
                alt={p.name}
                className="h-full w-full object-contain p-4"
              />
            ) : (
              <span className="text-4xl text-brand-300">💊</span>
            )}
          </a>
          <div className="flex flex-1 flex-col p-3">
            <a
              href={`/products/${p.slug}`}
              className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-brand-600 dark:text-white"
            >
              {p.name}
            </a>
            <span className="my-2 font-bold text-slate-900 dark:text-white">
              {fmt(p.price, currency)}
            </span>
            <div className="mt-auto flex gap-2">
              <button
                onClick={() => addToCart(p.id)}
                disabled={p.stock <= 0}
                className="btn-primary flex-1 text-xs"
              >
                {p.stock <= 0 ? "Out of Stock" : "Add to Cart"}
              </button>
              <button
                onClick={() => removeItem(p.id)}
                className="btn-ghost !px-2 text-rose-500"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
