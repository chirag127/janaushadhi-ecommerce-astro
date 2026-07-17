import { useState, useEffect } from "react";
import { getInsForge } from "@lib/insforge/browser";

export default function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"ready" | "error" | "loading">("loading");
  const [statusError, setStatusError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // InsForge link reset flow appends ?token=...&insforge_status=ready&insforge_type=reset_password
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    const s = params.get("insforge_status");
    const e = params.get("insforge_error");

    if (s === "error" || e) {
      setStatusError(e ?? "The reset link is invalid or has expired.");
      setStatus("error");
      return;
    }
    if (s === "ready" && t) {
      setToken(t);
      setStatus("ready");
      return;
    }
    // No recognised params — show guidance
    setStatusError("No valid reset token found. Please request a new password reset link.");
    setStatus("error");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const insforge = getInsForge();
      const { error: resetError } = await insforge.auth.resetPassword({
        newPassword: password,
        otp: token!,
      });
      if (resetError) throw new Error(resetError.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return <p className="text-center text-sm text-slate-500">Loading…</p>;
  }

  if (status === "error") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-rose-50 px-4 py-4 text-center dark:bg-rose-950">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
            {statusError}
          </p>
        </div>
        <a href="/forgot-password" className="btn-primary block w-full text-center">
          Request New Reset Link
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-brand-50 px-4 py-4 text-center dark:bg-brand-950">
          <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
            Password updated successfully!
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            You can now log in with your new password.
          </p>
        </div>
        <a href="/login" className="btn-primary block w-full text-center">
          Go to Login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">New Password</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="label">Confirm New Password</label>
        <input
          type="password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}
