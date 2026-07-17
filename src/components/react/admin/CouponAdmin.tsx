import { useEffect, useState, useCallback } from "react";
import { getInsForge } from "@lib/insforge/browser";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

const empty: Partial<Coupon> = {
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  is_active: true,
};

export default function CouponAdmin() {
  const insforge = getInsForge();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await insforge.database
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Coupon[]) ?? []);
    setLoading(false);
  }, [insforge]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing?.code) {
      setError("Code is required");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/coupons", {
      method: editing.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    const res = await fetch("/api/admin/coupons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await load();
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";
  const val = (c: Coupon) =>
    c.discount_type === "percent" ? `${c.discount_value}%` : `₹${c.discount_value}`;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => {
            setError("");
            setEditing({ ...empty });
          }}
          className="btn-primary text-sm"
        >
          + New Coupon
        </button>
        <span className="ml-auto text-sm text-slate-500">{rows.length} coupons</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Discount</th>
              <th className="p-3">Min order</th>
              <th className="p-3">Used</th>
              <th className="p-3">Active</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="p-3 font-mono font-medium">{c.code}</td>
                  <td className="p-3">{val(c)}</td>
                  <td className="p-3 text-slate-500">
                    {c.min_order_amount ? `₹${c.min_order_amount}` : "—"}
                  </td>
                  <td className="p-3 text-slate-500">
                    {c.used_count ?? 0}
                    {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                  </td>
                  <td className="p-3">
                    {c.is_active ? (
                      <span className="badge bg-brand-50 text-brand-700">yes</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">no</span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setError("");
                        setEditing(c);
                      }}
                      className="text-brand-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="ml-3 text-rose-500 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No coupons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="card mt-8 w-full max-w-md space-y-3 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editing.id ? "Edit Coupon" : "New Coupon"}
            </h2>
            <div>
              <label className="text-xs text-slate-500">Code *</label>
              <input
                className={`${input} font-mono uppercase`}
                value={editing.code ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, code: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Description</label>
              <input
                className={input}
                value={editing.description ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500">Type</label>
                <select
                  className={input}
                  value={editing.discount_type ?? "percent"}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      discount_type: e.target.value as "percent" | "fixed",
                    })
                  }
                >
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Value</label>
                <input
                  type="number"
                  step="0.01"
                  className={input}
                  value={editing.discount_value ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing, discount_value: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500">Min order (₹)</label>
                <input
                  type="number"
                  className={input}
                  value={editing.min_order_amount ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      min_order_amount: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Max discount (₹)</label>
                <input
                  type="number"
                  className={input}
                  value={editing.max_discount_amount ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      max_discount_amount: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500">Usage limit</label>
                <input
                  type="number"
                  className={input}
                  value={editing.usage_limit ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      usage_limit: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Per-user limit</label>
                <input
                  type="number"
                  className={input}
                  value={editing.per_user_limit ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      per_user_limit: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500">Starts at</label>
                <input
                  type="datetime-local"
                  className={input}
                  value={editing.starts_at ? editing.starts_at.slice(0, 16) : ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      starts_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Expires at</label>
                <input
                  type="datetime-local"
                  className={input}
                  value={editing.expires_at ? editing.expires_at.slice(0, 16) : ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      expires_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              Active
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
