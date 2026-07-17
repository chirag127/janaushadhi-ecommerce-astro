#!/usr/bin/env python3
"""Generate idempotent seed SQL from meds.csv for the shared InsForge DB.

- Normalizes the free-text "Group Name" column into a canonical category set.
- Emits categories + products as INSERT ... ON CONFLICT (slug) DO UPDATE.
- Jan Aushadhi sells at MRP (generic, government-subsidised), so price = MRP.
- Default stock is a deterministic pseudo value derived from drug_code.
"""
import csv
import re
import sys
from pathlib import Path

CSV = Path(__file__).resolve().parent.parent / "meds.csv"
OUT = Path(__file__).resolve().parent.parent / "migrations" / "seed_data.sql"

# Canonical category map: normalized-key -> (display name, slug, sort_order)
# Keys are lowercased/space-collapsed group names. Variants fold into one.
CANON = {
    "surgical & medical consumables": ("Surgical & Medical Consumables", "surgical-medical-consumables", 100),
    "cardiovascular system (cvs)": ("Cardiovascular System (CVS)", "cardiovascular-cvs", 20),
    "central nervous system (cns)": ("Central Nervous System (CNS)", "central-nervous-system-cns", 30),
    "antibiotics": ("Antibiotics", "antibiotics", 40),
    "anti-diabetic": ("Anti-Diabetic", "anti-diabetic", 50),
    "gastrointestinal (git)": ("Gastrointestinal (GIT)", "gastrointestinal-git", 60),
    "respiratory": ("Respiratory", "respiratory", 70),
    "supplement/vitamin/mineral": ("Supplement / Vitamin / Mineral", "supplement-vitamin-mineral", 80),
    "analgesic/antipyretic/anti-inflammatory": ("Analgesic / Antipyretic / Anti-Inflammatory", "analgesic-antipyretic-anti-inflammatory", 10),
    "oncology": ("Oncology", "oncology", 90),
    "dermatology/topical/external": ("Dermatology / Topical / External", "dermatology-topical-external", 15),
    "derma care": ("Dermatology / Topical / External", "dermatology-topical-external", 15),
    "footcare cream": ("Dermatology / Topical / External", "dermatology-topical-external", 15),
    "opthalmic/otic": ("Ophthalmic / Otic", "ophthalmic-otic", 110),
    "ophthalmic/otic": ("Ophthalmic / Otic", "ophthalmic-otic", 110),
    "urology": ("Urology", "urology", 120),
    "nutraceuticals": ("Nutraceuticals", "nutraceuticals", 130),
    "ortho": ("Orthopaedic", "orthopaedic", 140),
    "gynaecology": ("Gynaecology", "gynaecology", 150),
    "anti-histaminic": ("Anti-Histaminic", "anti-histaminic", 160),
    "anti-fungal": ("Anti-Fungal", "anti-fungal", 170),
}


def norm_key(g: str) -> str:
    return re.sub(r"\s+", " ", g.strip().lower())


def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"(^-|-$)", "", s)[:120]


def sql_str(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def stock_for(drug_code: str) -> int:
    # Deterministic pseudo-stock 25..225 so demo looks stocked.
    h = 0
    for ch in drug_code:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return 25 + (h % 200)


def main():
    rows = []
    groups_seen = {}
    with CSV.open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            name = (r.get("Generic Name") or "").strip()
            if not name:
                continue
            g = (r.get("Group Name") or "").strip()
            k = norm_key(g)
            display, slug, order = CANON.get(k, (g.title(), slugify(g) or "misc", 500))
            groups_seen[slug] = (display, slug, order)
            rows.append({
                "drug_code": (r.get("Drug Code") or "").strip(),
                "name": name,
                "unit_size": (r.get("Unit Size") or "").strip(),
                "mrp": (r.get("MRP") or "0").strip() or "0",
                "cat_slug": slug,
            })

    lines = []
    lines.append("-- Auto-generated seed. Idempotent (ON CONFLICT on slug/drug_code).")
    lines.append("-- Jan Aushadhi: price = MRP (generic subsidised pricing).")
    lines.append("begin;")

    # Categories
    lines.append("insert into public.categories (name, slug, description, sort_order) values")
    cat_vals = []
    for display, slug, order in sorted(groups_seen.values(), key=lambda x: (x[2], x[0])):
        desc = f"Generic medicines in the {display} group."
        cat_vals.append(f"  ({sql_str(display)}, {sql_str(slug)}, {sql_str(desc)}, {order})")
    lines.append(",\n".join(cat_vals))
    lines.append("on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;")
    lines.append("")

    # Products - dedupe slug by appending drug_code when collision
    seen_slugs = {}
    prod_vals = []
    featured_codes = set()
    # Feature the first product of each category for the homepage
    feat_by_cat = {}
    for row in rows:
        base = slugify(row["name"])
        if not base:
            base = "product"
        slug = base
        if slug in seen_slugs:
            slug = f"{base}-{row['drug_code']}"
        seen_slugs[slug] = True
        row["slug"] = slug
        if row["cat_slug"] not in feat_by_cat:
            feat_by_cat[row["cat_slug"]] = row["drug_code"]
            featured_codes.add(row["drug_code"])

    for row in rows:
        try:
            mrp = float(row["mrp"])
        except ValueError:
            mrp = 0.0
        stock = stock_for(row["drug_code"] or row["slug"])
        featured = "true" if row["drug_code"] in featured_codes else "false"
        desc = f"{row['name']} — Unit size {row['unit_size']}. Genuine generic medicine sold at MRP through Jan Aushadhi."
        prod_vals.append(
            f"  ({sql_str(row['drug_code'])}, {sql_str(row['name'])}, {sql_str(row['slug'])}, "
            f"{sql_str(desc)}, (select id from public.categories where slug={sql_str(row['cat_slug'])}), "
            f"{sql_str(row['unit_size'])}, {mrp:.2f}, {mrp:.2f}, {stock}, true, {featured})"
        )

    # Chunk product inserts to keep statements reasonable
    CHUNK = 300
    cols = "(drug_code, name, slug, description, category_id, unit_size, mrp, price, stock, is_active, is_featured)"
    for i in range(0, len(prod_vals), CHUNK):
        chunk = prod_vals[i:i + CHUNK]
        lines.append(f"insert into public.products {cols} values")
        lines.append(",\n".join(chunk))
        lines.append("on conflict (slug) do update set mrp = excluded.mrp, price = excluded.price, "
                     "unit_size = excluded.unit_size, category_id = excluded.category_id, is_active = true;")
        lines.append("")

    lines.append("commit;")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Categories: {len(groups_seen)}  Products: {len(prod_vals)}")


if __name__ == "__main__":
    main()
