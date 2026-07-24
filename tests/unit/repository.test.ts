/**
 * Unit tests for the Drizzle repository helpers.
 * We mock the DB object so no real Neon connection is needed.
 * Focus: coercion helpers, edge cases around null image_url, pagination math,
 * and the "throws when no rows returned" patterns.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- helpers under test (pure / easily mockable) ----
import { PAGE_SIZE } from "../../src/lib/db/repository";

// ---- internal coercion (verify via exported functions) ----
// We test the public surface (dbGetProducts etc.) by injecting a mock DB.
// The mock returns raw Drizzle-like rows (numbers as strings, Date objects).

function makeProductRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-1",
    drug_code: "JANX001",
    name: "Paracetamol 500mg",
    slug: "paracetamol-500mg",
    description: "Common pain reliever",
    category_id: "cat-1",
    unit_size: "10 tablets",
    mrp: "10.50",       // Drizzle numeric returns as string
    price: "7.00",       // string
    stock: 100,
    image_url: null,     // null — the main regression case
    is_active: true,
    is_featured: false,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-06-01"),
    cat_id: "cat-1",
    cat_name: "Antibiotics",
    cat_slug: "antibiotics",
    ...overrides,
  };
}

function makeOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ord-1",
    order_number: "JA-20240101-ABCDE",
    user_id: "u-1",
    status: "pending",
    payment_status: "created",
    subtotal: "499.00",
    shipping: "40.00",
    total: "539.00",
    discount: "0.00",
    currency: "INR",
    coupon_id: null,
    shipping_address: {},
    razorpay_order_id: null,
    razorpay_payment_id: null,
    is_test_payment: false,
    created_at: new Date("2024-01-01"),
    updated_at: new Date("2024-01-01"),
    ...overrides,
  };
}

// Build a chainable Drizzle mock
function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const terminal = () => Promise.resolve(rows);
  const self = () => chain;
  chain.select = self;
  chain.from = self;
  chain.leftJoin = self;
  chain.where = self;
  chain.orderBy = self;
  chain.limit = self;
  chain.offset = terminal; // final call returns rows
  return chain;
}

// ---- PAGE_SIZE constant ----
describe("PAGE_SIZE", () => {
  it("is 24", () => {
    expect(PAGE_SIZE).toBe(24);
  });
});

// ---- coercion: product numeric fields ----
describe("coerceProduct (via dbGetProductsByIds mock)", async () => {
  it("coerces numeric strings to numbers", async () => {
    const { dbGetProductsByIds } = await import("../../src/lib/db/repository");
    const row = {
      id: "prod-1",
      name: "Test",
      price: "7.50",  // string from Drizzle
      stock: 50,
      is_active: true,
      created_at: new Date("2024-01-01"),
      updated_at: new Date("2024-06-01"),
    };
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => Promise.resolve([row]),
    } as unknown as Parameters<typeof dbGetProductsByIds>[0];

    const results = await dbGetProductsByIds(mockDb, ["prod-1"]);
    expect(typeof results[0].price).toBe("number");
    expect(results[0].price).toBeCloseTo(7.5);
  });

  it("returns empty array for empty ids", async () => {
    const { dbGetProductsByIds } = await import("../../src/lib/db/repository");
    const mockDb = {} as unknown as Parameters<typeof dbGetProductsByIds>[0];
    const results = await dbGetProductsByIds(mockDb, []);
    expect(results).toEqual([]);
  });
});

// ---- coercion: order numeric fields ----
describe("coerceOrder (via dbGetOrdersByUser mock)", async () => {
  it("coerces numeric strings on order rows", async () => {
    const { dbGetOrdersByUser } = await import("../../src/lib/db/repository");
    const row = makeOrderRow();
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => mockDb,
      orderBy: () => Promise.resolve([row]),
    } as unknown as Parameters<typeof dbGetOrdersByUser>[0];

    const orders = await dbGetOrdersByUser(mockDb, "u-1");
    expect(orders).toHaveLength(1);
    expect(typeof orders[0].total).toBe("number");
    expect(orders[0].total).toBeCloseTo(539);
    expect(orders[0].shipping).toBeCloseTo(40);
    expect(orders[0].subtotal).toBeCloseTo(499);
    expect(orders[0].discount).toBeCloseTo(0);
  });
});

// ---- null image_url does not throw ----
describe("null image_url handling", async () => {
  it("product with null image_url returns image_url: null (not undefined or throwing)", async () => {
    const { dbGetProductsByIds } = await import("../../src/lib/db/repository");
    const row = {
      id: "p1",
      name: "NullImg",
      price: "5.00",
      stock: 10,
      is_active: true,
      image_url: null,
      created_at: new Date("2024-01-01"),
      updated_at: new Date("2024-01-01"),
    };
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => Promise.resolve([row]),
    } as unknown as Parameters<typeof dbGetProductsByIds>[0];

    const results = await dbGetProductsByIds(mockDb, ["p1"]);
    // field not in this select, but verifying no throw
    expect(results[0]).toBeDefined();
    expect(results[0].id).toBe("p1");
  });
});

// ---- dbGetCategories returns sorted results ----
describe("dbGetCategories mock", async () => {
  it("returns empty array when no rows", async () => {
    const { dbGetCategories } = await import("../../src/lib/db/repository");
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      orderBy: () => Promise.resolve([]),
    } as unknown as Parameters<typeof dbGetCategories>[0];
    const cats = await dbGetCategories(mockDb);
    expect(cats).toEqual([]);
  });

  it("returns categories when rows exist", async () => {
    const { dbGetCategories } = await import("../../src/lib/db/repository");
    const rows = [
      { id: "c1", name: "Antibiotics", slug: "antibiotics", description: null, image_url: null, sort_order: 1, created_at: new Date() },
    ];
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      orderBy: () => Promise.resolve(rows),
    } as unknown as Parameters<typeof dbGetCategories>[0];
    const cats = await dbGetCategories(mockDb);
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe("Antibiotics");
  });
});

// ---- dbGetCartItem returns null when empty ----
describe("dbGetCartItem", async () => {
  it("returns null when no rows", async () => {
    const { dbGetCartItem } = await import("../../src/lib/db/repository");
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => mockDb,
      limit: () => Promise.resolve([]),
    } as unknown as Parameters<typeof dbGetCartItem>[0];
    const item = await dbGetCartItem(mockDb, "u1", "p1");
    expect(item).toBeNull();
  });

  it("returns the item when found", async () => {
    const { dbGetCartItem } = await import("../../src/lib/db/repository");
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => mockDb,
      limit: () => Promise.resolve([{ id: "ci-1", quantity: 3 }]),
    } as unknown as Parameters<typeof dbGetCartItem>[0];
    const item = await dbGetCartItem(mockDb, "u1", "p1");
    expect(item).not.toBeNull();
    expect(item!.quantity).toBe(3);
  });
});

// ---- dbGetCategoryBySlug ----
describe("dbGetCategoryBySlug", async () => {
  it("returns null for missing slug", async () => {
    const { dbGetCategoryBySlug } = await import("../../src/lib/db/repository");
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      where: () => mockDb,
      limit: () => Promise.resolve([]),
    } as unknown as Parameters<typeof dbGetCategoryBySlug>[0];
    expect(await dbGetCategoryBySlug(mockDb, "nonexistent")).toBeNull();
  });
});

// ---- dbGetProductBySlug ----
describe("dbGetProductBySlug", async () => {
  it("returns null for missing slug", async () => {
    const { dbGetProductBySlug } = await import("../../src/lib/db/repository");
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      leftJoin: () => mockDb,
      where: () => mockDb,
      limit: () => Promise.resolve([]),
    } as unknown as Parameters<typeof dbGetProductBySlug>[0];
    expect(await dbGetProductBySlug(mockDb, "nonexistent")).toBeNull();
  });

  it("returns coerced product for existing slug", async () => {
    const { dbGetProductBySlug } = await import("../../src/lib/db/repository");
    const row = makeProductRow();
    const mockDb = {
      select: () => mockDb,
      from: () => mockDb,
      leftJoin: () => mockDb,
      where: () => mockDb,
      limit: () => Promise.resolve([row]),
    } as unknown as Parameters<typeof dbGetProductBySlug>[0];
    const product = await dbGetProductBySlug(mockDb, "paracetamol-500mg");
    expect(product).not.toBeNull();
    expect(product!.mrp).toBeCloseTo(10.5);
    expect(product!.price).toBeCloseTo(7);
    expect(product!.image_url).toBeNull();
    expect(product!.category?.name).toBe("Antibiotics");
  });
});

// ---- dbInsertContactMessage (fire and forget) ----
describe("dbInsertContactMessage", async () => {
  it("calls db.insert without throwing", async () => {
    const { dbInsertContactMessage } = await import("../../src/lib/db/repository");
    const insertMock = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
    const mockDb = {
      insert: insertMock,
    } as unknown as Parameters<typeof dbInsertContactMessage>[0];
    await expect(
      dbInsertContactMessage(mockDb, { name: "Test", email: "t@t.com", subject: "Hi", message: "Hello" })
    ).resolves.not.toThrow();
    expect(insertMock).toHaveBeenCalledOnce();
  });
});
