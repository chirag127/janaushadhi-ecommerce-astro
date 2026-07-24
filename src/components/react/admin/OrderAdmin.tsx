import { useEffect, useState, useCallback } from "react";

interface OrderItem {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}
interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  status: string;
  payment_status: string;
  total: number;
  currency: string;
  created_at: string;
  shipping_address: Record<string, unknown> | null;
  order_items?: OrderItem[];
}

const STATUSES = ["pending","paid","processing","shipped","delivered","cancelled","refunded"];
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
const fdate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });

export default function OrderAdmin() {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<Order | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    const res = await fetch(`/api/admin/orders/list${params}`);
    if (res.ok) {
      const data = (await res.json()) as { orders: Order[] };
      setRows(data.orders ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const res = await fetch("/api/admin/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusy("");
    if (res.ok) {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
      setOpen((o) => (o && o.id === id ? { ...o, status } : o));
    }
  }

  const addr = (o: Order) => (o.shipping_address as { full_name?: string; line1?: string; city?: string; state?: string; pincode?: string; phone?: string; _payment_method?: string } | null) ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto text-sm text-slate-500">{rows.length} orders</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
            <tr>
              <th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Payment</th>
              <th className="p-3 text-right">Total</th><th className="p-3">Status</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && rows.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="p-3 font-medium">{o.order_number}</td>
                <td className="p-3 text-slate-500">{fdate(o.created_at)}</td>
                <td className="p-3 capitalize text-slate-500">{addr(o)?._payment_method === "cod" ? "COD" : o.payment_status}</td>
                <td className="p-3 text-right font-semibold">{inr(o.total)}</td>
                <td className="p-3">
                  <select value={o.status} disabled={busy === o.id} onChange={(e) => setStatus(o.id, e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs capitalize dark:border-slate-700 dark:bg-slate-900">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3 text-right"><button onClick={() => setOpen(o)} className="text-brand-600 hover:underline">View</button></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">No orders.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setOpen(null)}>
          <div className="card mt-8 w-full max-w-lg space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{open.order_number}</h2>
              <span className="text-sm text-slate-500">{fdate(open.created_at)}</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {(open.order_items ?? []).map((it) => (
                <div key={it.id} className="flex justify-between py-2 text-sm">
                  <span>{it.product_name} <span className="text-slate-400">× {it.quantity}</span></span>
                  <span className="font-medium">{inr(it.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-800"><span>Total</span><span>{inr(open.total)}</span></div>
            {addr(open) && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                <p className="font-medium">{addr(open)?.full_name}</p>
                <p className="text-slate-500">{addr(open)?.line1}, {addr(open)?.city}, {addr(open)?.state} {addr(open)?.pincode}</p>
                <p className="text-slate-500">📞 {addr(open)?.phone}</p>
                <p className="mt-1 text-slate-500">Payment: {addr(open)?._payment_method === "cod" ? "Cash on Delivery" : "Razorpay (online)"}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <select value={open.status} onChange={(e) => setStatus(open.id, e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize dark:border-slate-700 dark:bg-slate-900">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-ghost" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
