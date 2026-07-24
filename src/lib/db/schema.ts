/**
 * Drizzle schema mirroring the 14-table janaushadhi Neon DB.
 * Types: uuid -> string, numeric -> number, jsonb -> unknown, timestamptz -> string
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ---- enums ----
export const orderStatusEnum = pgEnum("order_status", [
  "pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "created", "pending", "captured", "failed", "refunded",
]);
export const userRoleEnum = pgEnum("user_role", ["customer", "admin"]);
export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed"]);

// ---- users (local mirror of Better Auth subjects) ----
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  email_verified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- profiles ----
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  full_name: text("full_name"),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("customer"),
  preferred_locale: text("preferred_locale").default("en"),
  preferred_currency: text("preferred_currency").default("INR"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- addresses ----
export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  full_name: text("full_name").notNull(),
  phone: text("phone").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  country: text("country").notNull().default("India"),
  is_default: boolean("is_default").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- categories ----
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  image_url: text("image_url"),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- products ----
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  drug_code: text("drug_code").unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  category_id: uuid("category_id"),
  unit_size: text("unit_size"),
  mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull().default("0"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  stock: integer("stock").notNull().default(0),
  image_url: text("image_url"),
  is_active: boolean("is_active").notNull().default(true),
  is_featured: boolean("is_featured").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("products_category_idx").on(t.category_id),
  index("products_active_idx").on(t.is_active),
]);

// ---- cart_items ----
export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  product_id: uuid("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.user_id, t.product_id)]);

// ---- wishlist_items ----
export const wishlistItems = pgTable("wishlist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  product_id: uuid("product_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.user_id, t.product_id)]);

// ---- orders ----
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  order_number: text("order_number").notNull().unique(),
  user_id: uuid("user_id"),
  status: orderStatusEnum("status").notNull().default("pending"),
  payment_status: paymentStatusEnum("payment_status").notNull().default("created"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  shipping: numeric("shipping", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("INR"),
  shipping_address: jsonb("shipping_address"),
  razorpay_order_id: text("razorpay_order_id"),
  razorpay_payment_id: text("razorpay_payment_id"),
  is_test_payment: boolean("is_test_payment").notNull().default(true),
  coupon_id: uuid("coupon_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("orders_user_idx").on(t.user_id),
  index("orders_status_idx").on(t.status),
]);

// ---- order_items ----
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  order_id: uuid("order_id").notNull(),
  product_id: uuid("product_id"),
  product_name: text("product_name").notNull(),
  unit_price: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  line_total: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
}, (t) => [index("order_items_order_idx").on(t.order_id)]);

// ---- reviews ----
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  product_id: uuid("product_id").notNull(),
  user_id: uuid("user_id").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  comment: text("comment"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("reviews_product_idx").on(t.product_id),
  unique().on(t.product_id, t.user_id),
]);

// ---- blog_posts ----
export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content"),
  cover_image_url: text("cover_image_url"),
  author: text("author").default("Jan Aushadhi Team"),
  is_published: boolean("is_published").notNull().default(false),
  published_at: timestamp("published_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- contact_messages ----
export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- coupons ----
export const coupons = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discount_type: discountTypeEnum("discount_type").notNull().default("percent"),
  discount_value: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  min_order_amount: numeric("min_order_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  max_discount_amount: numeric("max_discount_amount", { precision: 10, scale: 2 }),
  usage_limit: integer("usage_limit"),
  used_count: integer("used_count").notNull().default(0),
  per_user_limit: integer("per_user_limit"),
  starts_at: timestamp("starts_at", { withTimezone: true }),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- coupon_redemptions ----
export const couponRedemptions = pgTable("coupon_redemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  coupon_id: uuid("coupon_id").notNull(),
  user_id: uuid("user_id"),
  order_id: uuid("order_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
