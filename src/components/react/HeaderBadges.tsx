import { useStore } from "@nanostores/react";
import { $cart, $wishlist } from "@lib/stores";

export function CartBadge() {
  const cart = useStore($cart);
  const count = Object.values(cart).reduce(
    (s, q) => s + parseInt(q ?? "0", 10),
    0,
  );
  if (!count) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function WishlistBadge() {
  const wishlist = useStore($wishlist);
  const count = Object.keys(wishlist).filter((k) => wishlist[k]).length;
  if (!count) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
