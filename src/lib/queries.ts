import type { InsForgeClient } from "@insforge/sdk";
import type { Product, Category, Review, BlogPost } from "./types";

export const PAGE_SIZE = 24;

type DB = { database: InsForgeClient["database"] };

export async function getCategories(db: DB): Promise<Category[]> {
  const { data } = await db.database
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data as Category[]) ?? [];
}

export async function getCategoryBySlug(
  db: DB,
  slug: string,
): Promise<Category | null> {
  const { data } = await db.database
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Category) ?? null;
}

export interface ProductQuery {
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "name";
  page?: number;
  featuredOnly?: boolean;
}

export async function getProducts(
  db: DB,
  q: ProductQuery = {},
): Promise<{ products: Product[]; total: number }> {
  const page = Math.max(1, q.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = db.database
    .from("products")
    .select("*, category:categories(id,name,slug)", { count: "exact" })
    .eq("is_active", true);

  if (q.categoryId) query = query.eq("category_id", q.categoryId);
  if (q.featuredOnly) query = query.eq("is_featured", true);
  if (q.search) query = query.ilike("name", `%${q.search}%`);
  if (typeof q.minPrice === "number") query = query.gte("price", q.minPrice);
  if (typeof q.maxPrice === "number") query = query.lte("price", q.maxPrice);

  switch (q.sort) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, count } = await query.range(from, to);
  return { products: (data as Product[]) ?? [], total: count ?? 0 };
}

export async function getProductBySlug(
  db: DB,
  slug: string,
): Promise<Product | null> {
  const { data } = await db.database
    .from("products")
    .select("*, category:categories(id,name,slug)")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Product) ?? null;
}

export async function getRelatedProducts(
  db: DB,
  categoryId: string | null,
  excludeId: string,
  limit = 8,
): Promise<Product[]> {
  if (!categoryId) return [];
  const { data } = await db.database
    .from("products")
    .select("*")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .neq("id", excludeId)
    .limit(limit);
  return (data as Product[]) ?? [];
}

export async function getFeaturedProducts(
  db: DB,
  limit = 8,
): Promise<Product[]> {
  const { data } = await db.database
    .from("products")
    .select("*, category:categories(id,name,slug)")
    .eq("is_active", true)
    .eq("is_featured", true)
    .limit(limit);
  return (data as Product[]) ?? [];
}

export async function getReviews(
  db: DB,
  productId: string,
): Promise<Review[]> {
  const { data } = await db.database
    .from("reviews")
    .select("*, profile:profiles(full_name)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  return (data as Review[]) ?? [];
}

export function averageRating(reviews: Review[]): number {
  if (!reviews.length) return 0;
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export async function getBlogPosts(
  db: DB,
  limit = 12,
): Promise<BlogPost[]> {
  const { data } = await db.database
    .from("blog_posts")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data as BlogPost[]) ?? [];
}

export async function getBlogPostBySlug(
  db: DB,
  slug: string,
): Promise<BlogPost | null> {
  const { data } = await db.database
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as BlogPost) ?? null;
}
