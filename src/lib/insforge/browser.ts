/**
 * Browser auth stub — replaces InsForge browser client.
 * OAuth / reset-password flows need a real auth provider wired here.
 */

export interface BrowserAuthStub {
  auth: {
    signInWithOAuth(provider: string, opts?: unknown): Promise<void>;
    exchangeOAuthCode(code: string): Promise<{ error: { message: string } | null }>;
    resetPassword(opts: { newPassword: string; otp: string }): Promise<{ error: { message: string } | null }>;
    getCurrentUser(): Promise<{ data: { user: { id: string } | null } }>;
  };
}

let _stub: BrowserAuthStub | null = null;

export function getInsForge(): BrowserAuthStub {
  if (_stub) return _stub;
  _stub = {
    auth: {
      async signInWithOAuth() {},
      async exchangeOAuthCode() {
        return { error: { message: "OAuth not yet configured" } };
      },
      async resetPassword() {
        return { error: { message: "Auth not yet configured" } };
      },
      async getCurrentUser() {
        return { data: { user: null } };
      },
    },
  };
  return _stub;
}
