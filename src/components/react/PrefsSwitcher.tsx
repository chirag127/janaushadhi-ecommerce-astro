import { useStore } from "@nanostores/react";
import { $prefs } from "@lib/stores";
import { useEffect } from "react";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
];
const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax`;
}

export default function PrefsSwitcher() {
  const prefs = useStore($prefs);

  // Keep cookies in sync so SSR can read them.
  useEffect(() => {
    setCookie("ja_locale", prefs.locale);
    setCookie("ja_currency", prefs.currency);
  }, [prefs.locale, prefs.currency]);

  const changeLocale = (locale: string) => {
    $prefs.setKey("locale", locale);
    setCookie("ja_locale", locale);
    location.reload();
  };
  const changeCurrency = (currency: string) => {
    $prefs.setKey("currency", currency);
    setCookie("ja_currency", currency);
    location.reload();
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <select
        aria-label="Language"
        value={prefs.locale}
        onChange={(e) => changeLocale(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Currency"
        value={prefs.currency}
        onChange={(e) => changeCurrency(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
