/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly PUBLIC_RAZORPAY_TEST_MODE: string;
  readonly PUBLIC_APP_URL: string;
  readonly SITE_URL: string;
  // Neon Managed Better Auth (oriz-accounts hub)
  readonly NEON_AUTH_BASE_URL: string;
  readonly NEON_AUTH_COOKIE_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type AppUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  [key: string]: unknown;
};

declare namespace App {
  interface Locals {
    user: AppUser | null;
    isAdmin: boolean;
    locale: "en" | "hi";
    currency: "INR" | "USD" | "EUR" | "GBP";
  }
}
