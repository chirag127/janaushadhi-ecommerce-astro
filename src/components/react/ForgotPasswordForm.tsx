import { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-brand-50 px-4 py-4 text-center dark:bg-brand-950">
          <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
            Check your email!
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            If an account exists for <strong>{email}</strong>, a password reset
            link has been sent. Please check your inbox (and spam folder).
          </p>
        </div>
        <a href="/login" className="btn-primary block w-full text-center">
          Back to Login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Email address</label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Sending…" : "Send Reset Link"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Remembered your password?{" "}
        <a href="/login" className="link">
          Back to Login
        </a>
      </p>
    </form>
  );
}
