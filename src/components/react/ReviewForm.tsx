import { useState } from "react";
import { reviewApi } from "@lib/api-client";

interface Props {
  productId: string;
  isLoggedIn: boolean;
}

export default function ReviewForm({ productId, isLoggedIn }: Props) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState("");

  if (!isLoggedIn) {
    return (
      <p className="text-sm text-slate-500">
        Please{" "}
        <a href="/login" className="link">
          log in
        </a>{" "}
        to write a review.
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setMsg("");
    try {
      await reviewApi.submit(productId, rating, title, comment);
      setStatus("done");
      setMsg("Thanks! Your review was submitted.");
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Failed to submit review");
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <span className="label">Your Rating</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${s} star`}
              className="text-2xl leading-none"
            >
              <span
                className={
                  (hover || rating) >= s ? "text-amber-400" : "text-slate-300"
                }
              >
                ★
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Title</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
        />
      </div>
      <div>
        <label className="label">Review</label>
        <textarea
          className="input min-h-24"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share details about the product…"
        />
      </div>
      {msg && (
        <p
          className={
            status === "error" ? "text-sm text-rose-600" : "text-sm text-brand-600"
          }
        >
          {msg}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        className="btn-primary"
      >
        {status === "saving" ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}
