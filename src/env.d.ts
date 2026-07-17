/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_INSFORGE_URL: string;
  readonly PUBLIC_INSFORGE_ANON_KEY: string;
  readonly INSFORGE_URL: string;
  readonly INSFORGE_API_KEY: string;
  readonly PUBLIC_RAZORPAY_TEST_MODE: string;
  readonly PUBLIC_APP_URL: string;
  readonly SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type InsForgeUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  [key: string]: unknown;
};

declare namespace App {
  interface Locals {
    user: InsForgeUser | null;
    isAdmin: boolean;
    locale: "en" | "hi";
    currency: "INR" | "USD" | "EUR" | "GBP";
  }
}
