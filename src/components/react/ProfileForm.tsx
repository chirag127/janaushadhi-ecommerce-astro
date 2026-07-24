import { useState } from "react";

interface Props {
  initialName: string;
  initialPhone: string;
}

export default function ProfileForm({ initialName, initialPhone }: Props) {
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setMsg("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setStatus("done");
      setMsg("Profile updated.");
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="label">Full Name</label>
        <input
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Phone</label>
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {msg && (
        <p className={status === "error" ? "text-sm text-rose-600" : "text-sm text-brand-600"}>
          {msg}
        </p>
      )}
      <button type="submit" disabled={status === "saving"} className="btn-primary">
        {status === "saving" ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
