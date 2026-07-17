import { useEffect, useState, useCallback } from "react";
import { getInsForge } from "@lib/insforge/browser";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
}

const empty: Partial<Category> = {
  name: "",
  description: "",
  sort_order: 0,
};

export default function CategoryAdmin() {
  const insforge = getInsForge();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await insforge.database
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });
    setRows((data as Category[]) ?? []);
    setLoading(false);
  }, [insforge]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing?.name) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/categories", {
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
    if (!confirm("Delete this category? Products keep their data but lose the link."))
      return;
    const res = await fetch("/api/admin/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await load();
  }

  const input =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";

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
          + New Category
        </button>
        <span className="ml-auto text-sm text-slate-500">{rows.length} categories</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Name</th>
              <th className="p-3">Slug</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
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
                  <td className="p-3 text-slate-500">{c.sort_order}</td>
                  <td className="p-3 font-medium text-slate-900 dark:text-white">
                    {c.name}
                  </td>
                  <td className="p-3 text-slate-500">{c.slug}</td>
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
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  No categories.
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
            className="card mt-12 w-full max-w-md space-y-3 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editing.id ? "Edit Category" : "New Category"}
            </h2>
            <div>
              <label className="text-xs text-slate-500">Name *</label>
              <input
                className={input}
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">
                Slug (auto if blank)
              </label>
              <input
                className={input}
                value={editing.slug ?? ""}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Description</label>
              <textarea
                className={input}
                rows={2}
                value={editing.description ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Sort order</label>
              <input
                type="number"
                className={input}
                value={editing.sort_order ?? 0}
                onChange={(e) =>
                  setEditing({ ...editing, sort_order: Number(e.target.value) })
                }
              />
            </div>
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
