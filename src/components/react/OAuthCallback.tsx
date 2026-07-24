import { useEffect, useState } from "react";

/**
 * OAuth callback handler for Better Auth.
 * Better Auth handles the code exchange server-side via the /api/auth/callback/:provider route.
 * This component just waits briefly then navigates to `next` — the session cookie
 * is already set by the hub before the browser lands here.
 */
export default function OAuthCallback({ next = "/" }: { next?: string }) {
  const [error, setError] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      setError("Sign-in was cancelled or failed.");
      return;
    }
    // Better Auth sets the session cookie server-side. Navigate to destination.
    window.location.assign(next);
  }, [next]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      {error ? (
        <>
          <p className="mb-4 text-rose-600">{error}</p>
          <a href="/login" className="btn-primary">Back to login</a>
        </>
      ) : (
        <p className="text-slate-500">Completing sign-in…</p>
      )}
    </div>
  );
}
