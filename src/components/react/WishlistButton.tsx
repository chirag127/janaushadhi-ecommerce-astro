import { useState } from "react";
import { wishlistToggle, wishlistHas, $userId } from "@lib/stores";
import { wishlistApi } from "@lib/api-client";
import { useStore } from "@nanostores/react";

interface Props {
  productId: string;
  initiallyActive?: boolean;
}

export default function WishlistButton({ productId, initiallyActive }: Props) {
  const userId = useStore($userId);
  const [active, setActive] = useState(
    initiallyActive ?? wishlistHas(productId),
  );

  const handleClick = async () => {
    const nowActive = wishlistToggle(productId);
    setActive(nowActive);
    window.dispatchEvent(new CustomEvent("wishlist:changed"));
    try {
      if (userId) await wishlistApi.toggle(productId);
    } catch {
      /* keep optimistic state */
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white/90 text-slate-500 backdrop-blur transition-colors hover:text-rose-500 dark:border-slate-700 dark:bg-slate-900/90"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill={active ? "#f43f5e" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
    </button>
  );
}
