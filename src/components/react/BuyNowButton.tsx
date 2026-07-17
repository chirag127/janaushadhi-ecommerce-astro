import { cartAdd, $userId } from "@lib/stores";
import { cartApi } from "@lib/api-client";
import { useStore } from "@nanostores/react";
import { useState } from "react";

interface Props {
  productId: string;
  disabled?: boolean;
}

export default function BuyNowButton({ productId, disabled }: Props) {
  const userId = useStore($userId);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (disabled) return;
    setLoading(true);
    cartAdd(productId, 1);
    window.dispatchEvent(new CustomEvent("cart:changed"));
    try {
      if (userId) await cartApi.add(productId, 1);
    } catch {
      /* ignore */
    }
    location.assign("/checkout");
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled || loading}
      className="btn-secondary w-full"
    >
      {loading ? "…" : "Buy Now"}
    </button>
  );
}
