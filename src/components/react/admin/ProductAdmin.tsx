import { useEffect, useState, useCallback } from "react";
import { getInsForge } from "@lib/insforge/browser";

interface Cat {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  slug: string;
  drug_code: string | null;
  description: string | null;
  category_id: string | null;
  unit_size: string | null;
  mrp: number;
  price: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
}
interface Props {
  categories: Cat[];
}

const PAGE = 20;
const empty: Partial<Product> = {
  name: "",
  drug_code: "",
  description: "",
  category_id: null,
  unit_size: "",
  mrp: 0,
  price: 0,
  stock: 0,
  image_url: null,
  is_active: true,
  is_featured: false,
};

export default function ProductAdmin({ categories }: Props) {
  const insforge = getInsForge();
  const [rows, setRows] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let query = insforge.database
      .from("products")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
    const { data, count } = await query;
    setRows((data as Product[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [insforge, page, q]);

  useEffect(() => {
    load();
  }, [load]);

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "—";

  async function save() {
    if (!editing?.name) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    const isNew = !editing.id;
    const res = await fetch("/api/admin/products", {
      method: isNew ? "POST" : "PUT",
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
    if (!confirm("Delete this product? This cannot be undone.")) return;
    const res = await fetch("/api/admin/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await load();
  }

  async function uploadImage(file: File) {
    setError("");
    const { data, error: upErr } = await insforge.storage
      .from("product-images")
      .uploadAuto(file);
    if (upErr || !data) {
      setError(upErr?.message ?? "Upload failed");
      return;
    }
    // Persist the public URL on the form (bucket is public).
    const url =
      (data as { url?: string }).url ?? (data as { publicUrl?: string }).publicUrl ?? null;
    setEditing((e) => ({ ...(e ?? {}), image_url: url }));
  }

  const pages = Math.ceil(total / PAGE);
  const inr = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => {
            setPage(0);
            setQ(e.target.value);
          }}
          placeholder="Search products…"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          onClick={() => {
            setError("");
            setEditing({ ...empty });
          }}
          className="btn-primary text-sm"
        >
          + New Product
        </button>
        <span className="ml-auto text-sm text-slate-500">{total} products</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3">Flags</th>
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
              rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="p-3">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {p.name}
                    </span>
                    {p.drug_code && (
                      <span className="ml-2 text-xs text-slate-400">
                        #{p.drug_code}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500">{catName(p.category_id)}</td>
                  <td className="p-3 text-right">{inr(p.price)}</td>
                  <td
                    className={`p-3 text-right ${p.stock <= 5 ? "font-semibold text-amber-600" : ""}`}
                  >
                    {p.stock}
                  </td>
                  <td className="p-3">
                    {!p.is_active && (
                      <span className="badge bg-slate-100 text-slate-500">hidden</span>
                    )}
                    {p.is_featured && (
                      <span className="badge bg-brand-50 text-brand-700">featured</span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setError("");
                        setEditing(p);
                      }}
                      className="text-brand-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(p.id)}
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
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="btn-ghost disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-slate-500">
            Page {page + 1} / {pages}
          </span>
          <button
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="btn-ghost disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {editing && (
        <ProductForm
          editing={editing}
          setEditing={setEditing}
          categories={categories}
          onSave={save}
          onUpload={uploadImage}
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
}

function ProductForm({
  editing,
  setEditing,
  categories,
  onSave,
  onUpload,
  saving,
  error,
}: {
  editing: Partial<Product>;
  setEditing: (e: Partial<Product> | null) => void;
  categories: Cat[];
  onSave: () => void;
  onUpload: (f: File) => void;
  saving: boolean;
  error: string;
}) {
  const set = (patch: Partial<Product>) => setEditing({ ...editing, ...patch });
  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={() => setEditing(null)}
    >
      <div
        className="card mt-8 w-full max-w-lg space-y-3 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {editing.id ? "Edit Product" : "New Product"}
        </h2>
        <div>
          <label className="text-xs text-slate-500">Name *</label>
          <input
            className={input}
            value={editing.name ?? ""}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-500">Drug code</label>
            <input
              className={input}
              value={editing.drug_code ?? ""}
              onChange={(e) => set({ drug_code: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Unit size</label>
            <input
              className={input}
              value={editing.unit_size ?? ""}
              onChange={(e) => set({ unit_size: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Category</label>
          <select
            className={input}
            value={editing.category_id ?? ""}
            onChange={(e) => set({ category_id: e.target.value || null })}
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-slate-500">MRP (₹)</label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={editing.mrp ?? 0}
              onChange={(e) => set({ mrp: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Price (₹)</label>
            <input
              type="number"
              step="0.01"
              className={input}
              value={editing.price ?? 0}
              onChange={(e) => set({ price: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Stock</label>
            <input
              type="number"
              className={input}
              value={editing.stock ?? 0}
              onChange={(e) => set({ stock: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Description</label>
          <textarea
            className={input}
            rows={3}
            value={editing.description ?? ""}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Product image</label>
          <div className="flex items-center gap-3">
            {editing.image_url && (
              <img
                src={editing.image_url}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            )}
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.is_active ?? true}
              onChange={(e) => set({ is_active: e.target.checked })}
            />
            Active (visible)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.is_featured ?? false}
              onChange={(e) => set({ is_featured: e.target.checked })}
            />
            Featured
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={() => setEditing(null)}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
