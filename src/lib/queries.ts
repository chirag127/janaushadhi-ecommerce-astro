/**
 * Re-exports from the Drizzle repository as drop-in replacements for the
 * old InsForge-backed queries. Call sites pass `db = getDb()` instead of
 * an InsForge client.
 */
export { PAGE_SIZE, type ProductQuery } from "./db/repository";

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  dbGetCategories,
  dbGetCategoryBySlug,
  dbGetProducts,
  dbGetProductBySlug,
  dbGetRelatedProducts,
  dbGetFeaturedProducts,
  dbGetReviews,
  dbGetBlogPosts,
  dbGetBlogPostBySlug,
  type ProductQuery,
} from "./db/repository";
import type { Category, Product, Review, BlogPost } from "./types";

type DB = NeonHttpDatabase;

export async function getCategories(db: DB): Promise<Category[]> {
  return dbGetCategories(db);
}

export async function getCategoryBySlug(db: DB, slug: string): Promise<Category | null> {
  return dbGetCategoryBySlug(db, slug);
}

export async function getProducts(
  db: DB,
  q: ProductQuery = {},
): Promise<{ products: Product[]; total: number }> {
  return dbGetProducts(db, q);
}

export async function getProductBySlug(db: DB, slug: string): Promise<Product | null> {
  return dbGetProductBySlug(db, slug);
}

export async function getRelatedProducts(
  db: DB,
  categoryId: string | null,
  excludeId: string,
  limit = 8,
): Promise<Product[]> {
  return dbGetRelatedProducts(db, categoryId, excludeId, limit);
}

export async function getFeaturedProducts(db: DB, limit = 8): Promise<Product[]> {
  return dbGetFeaturedProducts(db, limit);
}

export async function getReviews(db: DB, productId: string): Promise<Review[]> {
  return dbGetReviews(db, productId);
}

export function averageRating(reviews: Review[]): number {
  if (!reviews.length) return 0;
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export async function getBlogPosts(db: DB, limit = 12): Promise<BlogPost[]> {
  return dbGetBlogPosts(db, limit);
}

export async function getBlogPostBySlug(db: DB, slug: string): Promise<BlogPost | null> {
  return dbGetBlogPostBySlug(db, slug);
}
