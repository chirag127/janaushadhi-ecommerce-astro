import { useState } from "react";

interface Props {
  mode: "login" | "register";
  next?: string;
}

export default function AuthForm({ mode, next = "/" }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const endpoint =
        mode === "login" ? "/api/auth/signin" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const data = (await res.json()) as {
        error?: string;
        user?: unknown;
        requiresVerification?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      if (mode === "register" && data.requiresVerification) {
        setInfo(
          "Account created! Please check your email to verify, then log in.",
        );
        return;
      }
      location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "register" && (
        <div>
          <label className="label">Full Name</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
      )}
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {info && <p className="text-sm text-brand-600">{info}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading
          ? "Please wait…"
          : mode === "login"
            ? "Login"
            : "Create Account"}
      </button>
    </form>
  );
}
