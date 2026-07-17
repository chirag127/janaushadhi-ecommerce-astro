import { useEffect, useState } from "react";

interface Address {
  id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  is_default: boolean;
  created_at: string;
}

type FormState = Omit<Address, "id" | "created_at">;

const EMPTY_FORM: FormState = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  is_default: false,
};

export default function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAddresses = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/addresses");
      const data = (await res.json()) as { addresses?: Address[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load addresses");
      setAddresses(data.addresses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (addr: Address) => {
    setEditId(addr.id);
    setForm({
      full_name: addr.full_name,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 ?? "",
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      country: addr.country,
      is_default: addr.is_default,
    });
    setFormError("");
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const url = editId ? `/api/addresses/${editId}` : "/api/addresses";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          line2: form.line2 || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save address");
      await fetchAddresses();
      cancelForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this address?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (addr: Address) => {
    if (addr.is_default) return;
    try {
      const res = await fetch(`/api/addresses/${addr.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      await fetchAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Saved Addresses</h2>
        {!showForm && (
          <button onClick={openAdd} className="btn-primary text-sm">
            + Add Address
          </button>
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {/* Address form (add / edit) */}
      {showForm && (
        <div className="card p-5">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            {editId ? "Edit Address" : "Add New Address"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Address Line 1</label>
              <input
                className="input"
                name="line1"
                value={form.line1}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="label">Address Line 2 (optional)</label>
              <input
                className="input"
                name="line2"
                value={form.line2 ?? ""}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">City</label>
                <input
                  className="input"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="label">State</label>
                <input
                  className="input"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Pincode</label>
                <input
                  className="input"
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="label">Country</label>
                <input
                  className="input"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_default"
                checked={form.is_default}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              />
              <span className="text-slate-700 dark:text-slate-300">Set as default address</span>
            </label>
            {formError && <p className="text-sm text-rose-600">{formError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? "Saving…" : editId ? "Update Address" : "Save Address"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Address list */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading addresses…</p>
      ) : addresses.length === 0 ? (
        <p className="text-sm text-slate-500">No saved addresses yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`card relative p-4 ${addr.is_default ? "ring-2 ring-brand-500" : ""}`}
            >
              {addr.is_default && (
                <span className="mb-2 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                  Default
                </span>
              )}
              <p className="font-medium text-slate-900 dark:text-white">{addr.full_name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{addr.phone}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ""}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {addr.city}, {addr.state} {addr.pincode}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{addr.country}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => openEdit(addr)}
                  className="btn-ghost text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(addr.id)}
                  disabled={deleting === addr.id}
                  className="btn-ghost text-xs text-rose-500 hover:text-rose-700"
                >
                  {deleting === addr.id ? "Deleting…" : "Delete"}
                </button>
                {!addr.is_default && (
                  <button
                    onClick={() => handleSetDefault(addr)}
                    className="btn-ghost text-xs text-brand-600 hover:text-brand-800"
                  >
                    Set as Default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
