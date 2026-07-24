/**
 * Data-access repository: thin wrappers over Drizzle that replace every
 * InsForge .database.from(...) call. Exported functions are the seam that
 * lets the rest of the app stay backend-portable.
 *
 * All numeric columns returned from Drizzle come back as strings (Drizzle's
 * postgres numeric type). Helpers below coerce them to numbers where the app
 * expects numbers, matching the old InsForge types exactly.
 */
import {
  eq,
  and,
  or,
  ne,
  ilike,
  gte,
  lte,
  gt,
  inArray,
  desc,
  asc,
  count as drizzleCount,
  sql,
} from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  products as productsT,
  categories as categoriesT,
  cartItems as cartItemsT,
  wishlistItems as wishlistItemsT,
  orders as ordersT,
  orderItems as orderItemsT,
  reviews as reviewsT,
  blogPosts as blogPostsT,
  contactMessages as contactMessagesT,
  coupons as couponsT,
  couponRedemptions as couponRedemptionsT,
  addresses as addressesT,
  profiles as profilesT,
} from "./schema";
import type {
  Category,
  Product,
  Order,
  OrderItem,
  Review,
  BlogPost,
  Address,
  Profile,
} from "../types";

type DB = NeonHttpDatabase;

// ---- helpers ----
function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}
function coerceProduct(row: Record<string, unknown>): Product {
  return {
    ...row,
    mrp: num(row.mrp as string),
    price: num(row.price as string),
    stock: row.stock as number,
  } as unknown as Product;
}
function coerceOrder(row: Record<string, unknown>): Order {
  return {
    ...row,
    subtotal: num(row.subtotal as string),
    shipping: num(row.shipping as string),
    total: num(row.total as string),
    discount: num(row.discount as string),
  } as unknown as Order;
}
function coerceOrderItem(row: Record<string, unknown>): OrderItem {
  return {
    ...row,
    unit_price: num(row.unit_price as string),
    line_total: num(row.line_total as string),
  } as unknown as OrderItem;
}

// ----------------------------------------------------------------
// Categories
// ----------------------------------------------------------------
export async function dbGetCategories(db: DB): Promise<Category[]> {
  const rows = await db
    .select()
    .from(categoriesT)
    .orderBy(asc(categoriesT.sort_order));
  return rows as unknown as Category[];
}

export async function dbGetCategoryBySlug(
  db: DB,
  slug: string,
): Promise<Category | null> {
  const rows = await db
    .select()
    .from(categoriesT)
    .where(eq(categoriesT.slug, slug))
    .limit(1);
  return (rows[0] as unknown as Category) ?? null;
}

// ----------------------------------------------------------------
// Products
// ----------------------------------------------------------------
export const PAGE_SIZE = 24;

export interface ProductQuery {
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "name";
  page?: number;
  featuredOnly?: boolean;
  excludeOnRequest?: boolean;
}

export async function dbGetProducts(
  db: DB,
  q: ProductQuery = {},
): Promise<{ products: Product[]; total: number }> {
  const page = Math.max(1, q.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const filters = [eq(productsT.is_active, true)];
  if (q.categoryId) filters.push(eq(productsT.category_id, q.categoryId));
  if (q.featuredOnly) filters.push(eq(productsT.is_featured, true));
  if (q.search) filters.push(ilike(productsT.name, `%${q.search}%`));
  if (typeof q.minPrice === "number")
    filters.push(gte(productsT.price, String(q.minPrice)));
  if (typeof q.maxPrice === "number")
    filters.push(lte(productsT.price, String(q.maxPrice)));
  if (q.excludeOnRequest) filters.push(gt(productsT.price, "0"));

  const orderBy =
    q.sort === "price_asc"
      ? asc(productsT.price)
      : q.sort === "price_desc"
        ? desc(productsT.price)
        : q.sort === "name"
          ? asc(productsT.name)
          : desc(productsT.created_at);

  // Fetch products with category join
  const rows = await db
    .select({
      id: productsT.id,
      drug_code: productsT.drug_code,
      name: productsT.name,
      slug: productsT.slug,
      description: productsT.description,
      category_id: productsT.category_id,
      unit_size: productsT.unit_size,
      mrp: productsT.mrp,
      price: productsT.price,
      stock: productsT.stock,
      image_url: productsT.image_url,
      is_active: productsT.is_active,
      is_featured: productsT.is_featured,
      created_at: productsT.created_at,
      updated_at: productsT.updated_at,
      cat_id: categoriesT.id,
      cat_name: categoriesT.name,
      cat_slug: categoriesT.slug,
    })
    .from(productsT)
    .leftJoin(categoriesT, eq(productsT.category_id, categoriesT.id))
    .where(and(...filters))
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset(offset);

  // Count
  const countRows = await db
    .select({ c: drizzleCount() })
    .from(productsT)
    .where(and(...filters));
  const total = Number(countRows[0]?.c ?? 0);

  const ps: Product[] = rows.map((r) =>
    coerceProduct({
      id: r.id,
      drug_code: r.drug_code,
      name: r.name,
      slug: r.slug,
      description: r.description,
      category_id: r.category_id,
      unit_size: r.unit_size,
      mrp: r.mrp,
      price: r.price,
      stock: r.stock,
      image_url: r.image_url,
      is_active: r.is_active,
      is_featured: r.is_featured,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
      category:
        r.cat_id
          ? { id: r.cat_id, name: r.cat_name!, slug: r.cat_slug! }
          : null,
    }),
  );

  return { products: ps, total };
}

export async function dbGetProductBySlug(
  db: DB,
  slug: string,
): Promise<Product | null> {
  const rows = await db
    .select({
      id: productsT.id,
      drug_code: productsT.drug_code,
      name: productsT.name,
      slug: productsT.slug,
      description: productsT.description,
      category_id: productsT.category_id,
      unit_size: productsT.unit_size,
      mrp: productsT.mrp,
      price: productsT.price,
      stock: productsT.stock,
      image_url: productsT.image_url,
      is_active: productsT.is_active,
      is_featured: productsT.is_featured,
      created_at: productsT.created_at,
      updated_at: productsT.updated_at,
      cat_id: categoriesT.id,
      cat_name: categoriesT.name,
      cat_slug: categoriesT.slug,
    })
    .from(productsT)
    .leftJoin(categoriesT, eq(productsT.category_id, categoriesT.id))
    .where(eq(productsT.slug, slug))
    .limit(1);

  if (!rows[0]) return null;
  const r = rows[0];
  return coerceProduct({
    ...r,
    created_at: (r.created_at as Date).toISOString(),
    updated_at: (r.updated_at as Date).toISOString(),
    category: r.cat_id ? { id: r.cat_id, name: r.cat_name!, slug: r.cat_slug! } : null,
  });
}

export async function dbGetProductsByIds(
  db: DB,
  ids: string[],
): Promise<Product[]> {
  if (!ids.length) return [];
  // Select only the needed columns dynamically
  const rows = await db
    .select()
    .from(productsT)
    .where(inArray(productsT.id, ids));
  return rows.map((r) =>
    coerceProduct({
      ...r,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
    }),
  );
}

export async function dbGetRelatedProducts(
  db: DB,
  categoryId: string | null,
  excludeId: string,
  limit = 8,
): Promise<Product[]> {
  if (!categoryId) return [];
  const rows = await db
    .select()
    .from(productsT)
    .where(
      and(
        eq(productsT.category_id, categoryId),
        eq(productsT.is_active, true),
        ne(productsT.id, excludeId),
      ),
    )
    .limit(limit);
  return rows.map((r) =>
    coerceProduct({
      ...r,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
    }),
  );
}

export async function dbGetFeaturedProducts(
  db: DB,
  limit = 8,
): Promise<Product[]> {
  const rows = await db
    .select({
      id: productsT.id,
      drug_code: productsT.drug_code,
      name: productsT.name,
      slug: productsT.slug,
      description: productsT.description,
      category_id: productsT.category_id,
      unit_size: productsT.unit_size,
      mrp: productsT.mrp,
      price: productsT.price,
      stock: productsT.stock,
      image_url: productsT.image_url,
      is_active: productsT.is_active,
      is_featured: productsT.is_featured,
      created_at: productsT.created_at,
      updated_at: productsT.updated_at,
      cat_id: categoriesT.id,
      cat_name: categoriesT.name,
      cat_slug: categoriesT.slug,
    })
    .from(productsT)
    .leftJoin(categoriesT, eq(productsT.category_id, categoriesT.id))
    .where(and(eq(productsT.is_active, true), eq(productsT.is_featured, true)))
    .limit(limit);
  return rows.map((r) =>
    coerceProduct({
      ...r,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
      category: r.cat_id ? { id: r.cat_id, name: r.cat_name!, slug: r.cat_slug! } : null,
    }),
  );
}

// ----------------------------------------------------------------
// Reviews
// ----------------------------------------------------------------
export async function dbGetReviews(db: DB, productId: string): Promise<Review[]> {
  const rows = await db
    .select({
      id: reviewsT.id,
      product_id: reviewsT.product_id,
      user_id: reviewsT.user_id,
      rating: reviewsT.rating,
      title: reviewsT.title,
      comment: reviewsT.comment,
      created_at: reviewsT.created_at,
      full_name: profilesT.full_name,
    })
    .from(reviewsT)
    .leftJoin(profilesT, eq(reviewsT.user_id, profilesT.id))
    .where(eq(reviewsT.product_id, productId))
    .orderBy(desc(reviewsT.created_at));

  return rows.map((r) => ({
    id: r.id,
    product_id: r.product_id,
    user_id: r.user_id,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    created_at: (r.created_at as Date).toISOString(),
    profile: { full_name: r.full_name ?? null },
  })) as Review[];
}

// ----------------------------------------------------------------
// Blog
// ----------------------------------------------------------------
export async function dbGetBlogPosts(db: DB, limit = 12): Promise<BlogPost[]> {
  const rows = await db
    .select()
    .from(blogPostsT)
    .where(eq(blogPostsT.is_published, true))
    .orderBy(desc(blogPostsT.published_at))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    created_at: (r.created_at as Date).toISOString(),
    published_at: r.published_at ? (r.published_at as Date).toISOString() : null,
  })) as BlogPost[];
}

export async function dbGetBlogPostBySlug(
  db: DB,
  slug: string,
): Promise<BlogPost | null> {
  const rows = await db
    .select()
    .from(blogPostsT)
    .where(eq(blogPostsT.slug, slug))
    .limit(1);
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    ...r,
    created_at: (r.created_at as Date).toISOString(),
    published_at: r.published_at ? (r.published_at as Date).toISOString() : null,
  } as BlogPost;
}

// ----------------------------------------------------------------
// Cart
// ----------------------------------------------------------------
export async function dbGetCartItem(
  db: DB,
  userId: string,
  productId: string,
) {
  const rows = await db
    .select({ id: cartItemsT.id, quantity: cartItemsT.quantity })
    .from(cartItemsT)
    .where(
      and(eq(cartItemsT.user_id, userId), eq(cartItemsT.product_id, productId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function dbUpsertCartItem(
  db: DB,
  userId: string,
  productId: string,
  quantity: number,
) {
  await db
    .insert(cartItemsT)
    .values({ user_id: userId, product_id: productId, quantity })
    .onConflictDoUpdate({
      target: [cartItemsT.user_id, cartItemsT.product_id],
      set: { quantity: sql`cart_items.quantity + ${quantity}` },
    });
}

export async function dbUpdateCartItemQty(
  db: DB,
  userId: string,
  productId: string,
  quantity: number,
) {
  await db
    .update(cartItemsT)
    .set({ quantity })
    .where(
      and(eq(cartItemsT.user_id, userId), eq(cartItemsT.product_id, productId)),
    );
}

export async function dbDeleteCartItem(
  db: DB,
  userId: string,
  productId: string,
) {
  await db
    .delete(cartItemsT)
    .where(
      and(eq(cartItemsT.user_id, userId), eq(cartItemsT.product_id, productId)),
    );
}

export async function dbClearCart(db: DB, userId: string) {
  await db.delete(cartItemsT).where(eq(cartItemsT.user_id, userId));
}

// ----------------------------------------------------------------
// Wishlist
// ----------------------------------------------------------------
export async function dbGetWishlistItem(
  db: DB,
  userId: string,
  productId: string,
) {
  const rows = await db
    .select({ id: wishlistItemsT.id })
    .from(wishlistItemsT)
    .where(
      and(
        eq(wishlistItemsT.user_id, userId),
        eq(wishlistItemsT.product_id, productId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function dbAddWishlistItem(
  db: DB,
  userId: string,
  productId: string,
) {
  await db
    .insert(wishlistItemsT)
    .values({ user_id: userId, product_id: productId })
    .onConflictDoNothing();
}

export async function dbDeleteWishlistItem(
  db: DB,
  userId: string,
  productId: string,
) {
  await db
    .delete(wishlistItemsT)
    .where(
      and(
        eq(wishlistItemsT.user_id, userId),
        eq(wishlistItemsT.product_id, productId),
      ),
    );
}

// ----------------------------------------------------------------
// Orders
// ----------------------------------------------------------------
export async function dbGetOrdersByUser(db: DB, userId: string): Promise<Order[]> {
  const rows = await db
    .select()
    .from(ordersT)
    .where(eq(ordersT.user_id, userId))
    .orderBy(desc(ordersT.created_at));
  return rows.map((r) =>
    coerceOrder({
      ...r,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
    }),
  );
}

export async function dbGetOrderWithItems(
  db: DB,
  orderId: string,
  userId: string,
): Promise<(Order & { order_items: OrderItem[] }) | null> {
  const orderRows = await db
    .select()
    .from(ordersT)
    .where(and(eq(ordersT.id, orderId), eq(ordersT.user_id, userId)))
    .limit(1);
  if (!orderRows[0]) return null;
  const order = coerceOrder({
    ...orderRows[0],
    created_at: (orderRows[0].created_at as Date).toISOString(),
    updated_at: (orderRows[0].updated_at as Date).toISOString(),
  }) as Order;

  const itemRows = await db
    .select()
    .from(orderItemsT)
    .where(eq(orderItemsT.order_id, orderId));
  const items = itemRows.map((i) =>
    coerceOrderItem({
      ...i,
    }),
  );
  return { ...order, order_items: items };
}

export async function dbInsertOrder(
  db: DB,
  data: {
    order_number: string;
    user_id: string;
    status: string;
    payment_status: string;
    subtotal: number;
    shipping: number;
    total: number;
    discount: number;
    coupon_id: string | null;
    currency: string;
    shipping_address: unknown;
    is_test_payment: boolean;
  },
): Promise<{ id: string; order_number: string }> {
  const rows = await db
    .insert(ordersT)
    .values({
      order_number: data.order_number,
      user_id: data.user_id,
      status: data.status as "pending",
      payment_status: data.payment_status as "created",
      subtotal: String(data.subtotal),
      shipping: String(data.shipping),
      total: String(data.total),
      discount: String(data.discount),
      coupon_id: data.coupon_id,
      currency: data.currency,
      shipping_address: data.shipping_address as Record<string, unknown>,
      is_test_payment: data.is_test_payment,
    })
    .returning({ id: ordersT.id, order_number: ordersT.order_number });
  return rows[0];
}

export async function dbUpdateOrder(
  db: DB,
  orderId: string,
  patch: Record<string, unknown>,
) {
  await db.update(ordersT).set(patch as Partial<typeof ordersT.$inferInsert>).where(eq(ordersT.id, orderId));
}

export async function dbInsertOrderItems(
  db: DB,
  items: {
    order_id: string;
    product_id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[],
) {
  await db.insert(orderItemsT).values(
    items.map((i) => ({
      ...i,
      unit_price: String(i.unit_price),
      line_total: String(i.line_total),
    })),
  );
}

export async function dbGetOrderById(
  db: DB,
  orderId: string,
): Promise<{ id: string; status: string; user_id: string | null } | null> {
  const rows = await db
    .select({ id: ordersT.id, status: ordersT.status, user_id: ordersT.user_id })
    .from(ordersT)
    .where(eq(ordersT.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

export async function dbGetOrderItemsByOrderId(
  db: DB,
  orderId: string,
): Promise<{ product_id: string | null; quantity: number }[]> {
  return db
    .select({ product_id: orderItemsT.product_id, quantity: orderItemsT.quantity })
    .from(orderItemsT)
    .where(eq(orderItemsT.order_id, orderId));
}

// ----------------------------------------------------------------
// Coupons
// ----------------------------------------------------------------
export async function dbGetCouponByCode(
  db: DB,
  code: string,
) {
  const rows = await db
    .select()
    .from(couponsT)
    .where(and(eq(couponsT.code, code), eq(couponsT.is_active, true)))
    .limit(1);
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    ...r,
    discount_value: num(r.discount_value),
    min_order_amount: num(r.min_order_amount),
    max_discount_amount: r.max_discount_amount != null ? num(r.max_discount_amount) : null,
    starts_at: r.starts_at ? (r.starts_at as Date).toISOString() : null,
    expires_at: r.expires_at ? (r.expires_at as Date).toISOString() : null,
    created_at: (r.created_at as Date).toISOString(),
  };
}

export async function dbCountCouponRedemptions(
  db: DB,
  couponId: string,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ c: drizzleCount() })
    .from(couponRedemptionsT)
    .where(
      and(
        eq(couponRedemptionsT.coupon_id, couponId),
        eq(couponRedemptionsT.user_id, userId),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}

export async function dbInsertCouponRedemption(
  db: DB,
  data: { coupon_id: string; user_id: string; order_id: string; amount: number },
) {
  await db.insert(couponRedemptionsT).values({
    ...data,
    amount: String(data.amount),
  });
}

export async function dbIncrementCouponUsed(db: DB, couponId: string) {
  await db
    .update(couponsT)
    .set({ used_count: sql`${couponsT.used_count} + 1` })
    .where(eq(couponsT.id, couponId));
}

// ----------------------------------------------------------------
// Addresses
// ----------------------------------------------------------------
export async function dbGetAddressesByUser(
  db: DB,
  userId: string,
): Promise<Address[]> {
  const rows = await db
    .select()
    .from(addressesT)
    .where(eq(addressesT.user_id, userId))
    .orderBy(desc(addressesT.created_at));
  return rows.map((r) => ({
    ...r,
    created_at: (r.created_at as Date).toISOString(),
  })) as Address[];
}

export async function dbInsertAddress(
  db: DB,
  data: Omit<typeof addressesT.$inferInsert, "id" | "created_at">,
): Promise<Address> {
  const rows = await db.insert(addressesT).values(data).returning();
  const r = rows[0];
  return { ...r, created_at: (r.created_at as Date).toISOString() } as Address;
}

export async function dbUpdateAddress(
  db: DB,
  id: string,
  userId: string,
  patch: Partial<typeof addressesT.$inferInsert>,
): Promise<Address | null> {
  const rows = await db
    .update(addressesT)
    .set(patch)
    .where(and(eq(addressesT.id, id), eq(addressesT.user_id, userId)))
    .returning();
  if (!rows[0]) return null;
  return { ...rows[0], created_at: (rows[0].created_at as Date).toISOString() } as Address;
}

export async function dbDeleteAddress(
  db: DB,
  id: string,
  userId: string,
) {
  await db
    .delete(addressesT)
    .where(and(eq(addressesT.id, id), eq(addressesT.user_id, userId)));
}

export async function dbClearDefaultAddresses(db: DB, userId: string) {
  await db
    .update(addressesT)
    .set({ is_default: false })
    .where(eq(addressesT.user_id, userId));
}

// ----------------------------------------------------------------
// Profiles
// ----------------------------------------------------------------
export async function dbGetProfile(
  db: DB,
  userId: string,
): Promise<Pick<Profile, "full_name" | "phone" | "role"> | null> {
  const rows = await db
    .select({ full_name: profilesT.full_name, phone: profilesT.phone, role: profilesT.role })
    .from(profilesT)
    .where(eq(profilesT.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function dbGetProfiles(
  db: DB,
  limit = 500,
) {
  const rows = await db
    .select({
      id: profilesT.id,
      full_name: profilesT.full_name,
      phone: profilesT.phone,
      role: profilesT.role,
      created_at: profilesT.created_at,
    })
    .from(profilesT)
    .orderBy(desc(profilesT.created_at))
    .limit(limit);
  return rows.map((r) => ({ ...r, created_at: (r.created_at as Date).toISOString() }));
}

export async function dbUpdateProfile(
  db: DB,
  userId: string,
  patch: { full_name?: string | null; phone?: string | null },
) {
  await db.update(profilesT).set(patch).where(eq(profilesT.id, userId));
}

// ----------------------------------------------------------------
// Admin helpers (count, products with stock, order management)
// ----------------------------------------------------------------
export async function dbCountTable(db: DB, table: string): Promise<number> {
  const result = await db.execute(
    sql.raw(`SELECT COUNT(*)::int AS c FROM public.${table}`),
  );
  const rows = (result as unknown as { rows: { c: number }[] }).rows;
  return Number(rows[0]?.c ?? 0);
}

export async function dbCountLowStock(db: DB, maxStock = 5): Promise<number> {
  const rows = await db
    .select({ c: drizzleCount() })
    .from(productsT)
    .where(and(lte(productsT.stock, maxStock), eq(productsT.is_active, true)));
  return Number(rows[0]?.c ?? 0);
}

export async function dbGetRecentOrders(
  db: DB,
  limit = 200,
): Promise<Order[]> {
  const rows = await db
    .select()
    .from(ordersT)
    .orderBy(desc(ordersT.created_at))
    .limit(limit);
  return rows.map((r) =>
    coerceOrder({
      ...r,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
    }),
  );
}

export async function dbGetOrdersByStatus(
  db: DB,
  status: string | null,
  limit = 200,
): Promise<Order[]> {
  const base = db
    .select()
    .from(ordersT)
    .orderBy(desc(ordersT.created_at))
    .limit(limit);
  const rows = status
    ? await base.where(eq(ordersT.status, status as "pending"))
    : await base;
  return rows.map((r) =>
    coerceOrder({
      ...r,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
    }),
  );
}

export async function dbGetOrdersWithItems(
  db: DB,
  limit = 200,
): Promise<(Order & { order_items: OrderItem[] })[]> {
  const orderRows = await db
    .select()
    .from(ordersT)
    .orderBy(desc(ordersT.created_at))
    .limit(limit);

  if (!orderRows.length) return [];

  const orderIds = orderRows.map((o) => o.id);
  const itemRows = await db
    .select()
    .from(orderItemsT)
    .where(inArray(orderItemsT.order_id, orderIds));

  return orderRows.map((o) => {
    const items = itemRows
      .filter((i) => i.order_id === o.id)
      .map((i) => coerceOrderItem({ ...i }));
    return {
      ...coerceOrder({
        ...o,
        created_at: (o.created_at as Date).toISOString(),
        updated_at: (o.updated_at as Date).toISOString(),
      }),
      order_items: items,
    };
  });
}

export async function dbGetOrdersAndItems(
  db: DB,
  statusFilter: string | null,
  limit = 200,
): Promise<(Order & { order_items: OrderItem[] })[]> {
  const base = db.select().from(ordersT).orderBy(desc(ordersT.created_at)).limit(limit);
  const orderRows = statusFilter
    ? await base.where(eq(ordersT.status, statusFilter as "pending"))
    : await base;

  if (!orderRows.length) return [];
  const orderIds = orderRows.map((o) => o.id);
  const itemRows = await db
    .select()
    .from(orderItemsT)
    .where(inArray(orderItemsT.order_id, orderIds));

  return orderRows.map((o) => ({
    ...coerceOrder({
      ...o,
      created_at: (o.created_at as Date).toISOString(),
      updated_at: (o.updated_at as Date).toISOString(),
    }),
    order_items: itemRows
      .filter((i) => i.order_id === o.id)
      .map((i) => coerceOrderItem({ ...i })),
  }));
}

export async function dbGetLowStockProducts(
  db: DB,
  maxStock = 10,
  limit = 200,
) {
  const rows = await db
    .select({
      id: productsT.id,
      name: productsT.name,
      drug_code: productsT.drug_code,
      price: productsT.price,
      stock: productsT.stock,
      is_active: productsT.is_active,
      mrp: productsT.mrp,
      slug: productsT.slug,
      description: productsT.description,
      category_id: productsT.category_id,
      unit_size: productsT.unit_size,
      image_url: productsT.image_url,
      is_featured: productsT.is_featured,
      created_at: productsT.created_at,
      updated_at: productsT.updated_at,
    })
    .from(productsT)
    .where(lte(productsT.stock, maxStock))
    .orderBy(asc(productsT.stock))
    .limit(limit);
  return rows.map((r) =>
    coerceProduct({
      ...r,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
    }),
  );
}

export async function dbCountProductsWithStock(
  db: DB,
  stock: number,
): Promise<number> {
  const rows = await db
    .select({ c: drizzleCount() })
    .from(productsT)
    .where(eq(productsT.stock, stock));
  return Number(rows[0]?.c ?? 0);
}

export async function dbGetAnalyticsOrders(db: DB, limit = 1000) {
  const rows = await db
    .select({
      id: ordersT.id,
      total: ordersT.total,
      status: ordersT.status,
      created_at: ordersT.created_at,
    })
    .from(ordersT)
    .orderBy(desc(ordersT.created_at))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    total: num(r.total),
    created_at: (r.created_at as Date).toISOString(),
  }));
}

export async function dbGetAnalyticsOrderItems(db: DB, limit = 2000) {
  const rows = await db
    .select({
      product_name: orderItemsT.product_name,
      quantity: orderItemsT.quantity,
      line_total: orderItemsT.line_total,
    })
    .from(orderItemsT)
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    line_total: num(r.line_total),
  }));
}

// ----------------------------------------------------------------
// Fulfillment: stock decrement + order patch + cart clear
// ----------------------------------------------------------------
export async function dbDecrementStock(
  db: DB,
  productId: string,
  qty: number,
) {
  await db
    .update(productsT)
    .set({ stock: sql`GREATEST(0, ${productsT.stock} - ${qty})` })
    .where(eq(productsT.id, productId));
}

// ----------------------------------------------------------------
// Admin product/category/coupon CRUD
// ----------------------------------------------------------------
export async function dbInsertProduct(
  db: DB,
  data: Omit<typeof productsT.$inferInsert, "id" | "created_at" | "updated_at">,
): Promise<Product> {
  const rows = await db.insert(productsT).values(data).returning();
  return coerceProduct({
    ...rows[0],
    created_at: (rows[0].created_at as Date).toISOString(),
    updated_at: (rows[0].updated_at as Date).toISOString(),
  });
}

export async function dbUpdateProduct(
  db: DB,
  id: string,
  patch: Partial<typeof productsT.$inferInsert>,
): Promise<Product | null> {
  const rows = await db
    .update(productsT)
    .set(patch)
    .where(eq(productsT.id, id))
    .returning();
  if (!rows[0]) return null;
  return coerceProduct({
    ...rows[0],
    created_at: (rows[0].created_at as Date).toISOString(),
    updated_at: (rows[0].updated_at as Date).toISOString(),
  });
}

export async function dbDeleteProduct(db: DB, id: string) {
  await db.delete(productsT).where(eq(productsT.id, id));
}

export async function dbInsertCategory(
  db: DB,
  data: Omit<typeof categoriesT.$inferInsert, "id" | "created_at">,
): Promise<Category> {
  const rows = await db.insert(categoriesT).values(data).returning();
  return {
    ...rows[0],
    created_at: (rows[0].created_at as Date).toISOString(),
  } as Category;
}

export async function dbUpdateCategory(
  db: DB,
  id: string,
  patch: Partial<typeof categoriesT.$inferInsert>,
): Promise<Category | null> {
  const rows = await db
    .update(categoriesT)
    .set(patch)
    .where(eq(categoriesT.id, id))
    .returning();
  if (!rows[0]) return null;
  return { ...rows[0], created_at: (rows[0].created_at as Date).toISOString() } as Category;
}

export async function dbDeleteCategory(db: DB, id: string) {
  await db.delete(categoriesT).where(eq(categoriesT.id, id));
}

export async function dbGetAllCoupons(db: DB) {
  const rows = await db
    .select()
    .from(couponsT)
    .orderBy(desc(couponsT.created_at));
  return rows.map((r) => ({
    ...r,
    discount_value: num(r.discount_value),
    min_order_amount: num(r.min_order_amount),
    max_discount_amount: r.max_discount_amount != null ? num(r.max_discount_amount) : null,
    starts_at: r.starts_at ? (r.starts_at as Date).toISOString() : null,
    expires_at: r.expires_at ? (r.expires_at as Date).toISOString() : null,
    created_at: (r.created_at as Date).toISOString(),
  }));
}

export async function dbInsertCoupon(
  db: DB,
  data: Omit<typeof couponsT.$inferInsert, "id" | "created_at" | "used_count">,
) {
  const rows = await db
    .insert(couponsT)
    .values({ ...data, used_count: 0 })
    .returning();
  const r = rows[0];
  return {
    ...r,
    discount_value: num(r.discount_value),
    created_at: (r.created_at as Date).toISOString(),
  };
}

export async function dbUpdateCoupon(
  db: DB,
  id: string,
  patch: Partial<typeof couponsT.$inferInsert>,
) {
  const rows = await db
    .update(couponsT)
    .set(patch)
    .where(eq(couponsT.id, id))
    .returning();
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    ...r,
    discount_value: num(r.discount_value),
    created_at: (r.created_at as Date).toISOString(),
  };
}

export async function dbDeleteCoupon(db: DB, id: string) {
  await db.delete(couponsT).where(eq(couponsT.id, id));
}

// ----------------------------------------------------------------
// Contact messages
// ----------------------------------------------------------------
export async function dbInsertContactMessage(
  db: DB,
  data: { name: string; email: string; subject: string | null; message: string },
) {
  await db.insert(contactMessagesT).values(data);
}

// ----------------------------------------------------------------
// Admin orders list with user info
// ----------------------------------------------------------------
export async function dbGetCustomerOrders(db: DB, limit = 1000) {
  const rows = await db
    .select({
      user_id: ordersT.user_id,
      total: ordersT.total,
      status: ordersT.status,
    })
    .from(ordersT)
    .limit(limit);
  return rows.map((r) => ({ ...r, total: num(r.total) }));
}

// ----------------------------------------------------------------
// Razorpay verification needs to update order payment fields
// ----------------------------------------------------------------
export async function dbUpdateOrderPayment(
  db: DB,
  orderId: string,
  patch: {
    payment_status?: string;
    status?: string;
    razorpay_order_id?: string | null;
    razorpay_payment_id?: string | null;
    shipping_address?: unknown;
    is_test_payment?: boolean;
  },
) {
  await db
    .update(ordersT)
    .set(patch as Partial<typeof ordersT.$inferInsert>)
    .where(eq(ordersT.id, orderId));
}

// ----------------------------------------------------------------
// Products by IDs (for cart/checkout server-side re-price)
// ----------------------------------------------------------------
export async function dbGetProductsById(
  db: DB,
  ids: string[],
): Promise<Pick<Product, "id" | "name" | "price" | "stock" | "is_active">[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({
      id: productsT.id,
      name: productsT.name,
      price: productsT.price,
      stock: productsT.stock,
      is_active: productsT.is_active,
    })
    .from(productsT)
    .where(inArray(productsT.id, ids));
  return rows.map((r) => ({ ...r, price: num(r.price) }));
}
