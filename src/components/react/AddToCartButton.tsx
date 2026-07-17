import { useState } from "react";
import { cartAdd, $userId } from "@lib/stores";
import { cartApi } from "@lib/api-client";
import { useStore } from "@nanostores/react";

interface Props {
  productId: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export default function AddToCartButton({
  productId,
  disabled,
  label = "Add to Cart",
  className = "btn-primary w-full",
}: Props) {
  const userId = useStore($userId);
  const [status, setStatus] = useState<"idle" | "loading" | "added">("idle");

  const handleClick = async () => {
    if (disabled) return;
    setStatus("loading");
    try {
      // optimistic local update
      cartAdd(productId, 1);
      window.dispatchEvent(new CustomEvent("cart:changed"));
      if (userId) {
        await cartApi.add(productId, 1);
      }
      setStatus("added");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("idle");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || status === "loading"}
      className={className}
    >
      {status === "added"
        ? "✓ Added"
        : status === "loading"
          ? "Adding…"
          : label}
    </button>
  );
}
