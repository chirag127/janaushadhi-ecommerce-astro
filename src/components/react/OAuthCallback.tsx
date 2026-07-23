import { useEffect, useState } from "react";
import { getInsForge } from "@lib/insforge/browser";

/**
 * Client-side OAuth callback handler. The InsForge SSR browser client sets
 * detectOAuthCallback:false, and the PKCE verifier lives in sessionStorage
 * (client-only), so the code→session exchange MUST run in the browser here.
 * After exchange the SDK persists the session cookies; we then hard-navigate
 * to `next` so the SSR middleware picks up the new session.
 */
export default function OAuthCallback({ next = "/" }: { next?: string }) {
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("insforge_code");
      const oauthError = url.searchParams.get("error");
      if (oauthError) {
        setError("Sign-in was cancelled or failed.");
        return;
      }
      if (!code) {
        setError("Missing authorization code.");
        return;
      }
      try {
        const { error: exErr } = await getInsForge().auth.exchangeOAuthCode(code);
        if (exErr) {
          setError(exErr.message ?? "Could not complete sign-in.");
          return;
        }
        // Refresh SSR cookies, then navigate so middleware sees the session.
        window.location.assign(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      }
    })();
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
