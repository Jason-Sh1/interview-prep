import type { DebugTask } from "../types";

// A small checkout service: cart totals, coupons and sales tax, in cents.
// Three bugs are seeded: a coupon's minimum spend is checked with > instead
// of >=, tax is charged on the pre-discount subtotal, and line totals ignore
// quantity for bundled items.

const CART = String.raw`// Line items and the cart subtotal. Prices are integer cents.
//
// An item is { sku, priceCents, qty } or a bundle:
// { sku, priceCents, qty, bundle: { size, priceCents } }, where every full
// group of bundle.size units costs bundle.priceCents instead.

function lineTotal(item) {
  if (!Number.isInteger(item.qty) || item.qty < 0) throw new Error("bad quantity for " + item.sku);
  if (!item.bundle) return item.priceCents * item.qty;
  const groups = Math.floor(item.qty / item.bundle.size);
  const rest = item.qty % item.bundle.size;
  return groups * item.bundle.priceCents + rest;
}

function subtotal(items) {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

module.exports = { lineTotal, subtotal };
`;

const COUPONS = String.raw`// Coupons. A coupon is one of:
//   { code, kind: "percent", percent, minSpendCents? }
//   { code, kind: "fixed", amountCents, minSpendCents? }
// Discounts round down to whole cents and never exceed the subtotal.

const CATALOG = {
  SAVE10: { code: "SAVE10", kind: "percent", percent: 10 },
  BIG20: { code: "BIG20", kind: "percent", percent: 20, minSpendCents: 10000 },
  FIVEOFF: { code: "FIVEOFF", kind: "fixed", amountCents: 500, minSpendCents: 2500 },
};

function findCoupon(code) {
  if (!code) return null;
  return CATALOG[String(code).trim().toUpperCase()] || null;
}

/** The discount in cents a coupon gives on a subtotal, and why if it gives none. */
function discountFor(coupon, subtotalCents) {
  if (!coupon) return { cents: 0, reason: "no coupon" };
  if (coupon.minSpendCents && !(subtotalCents > coupon.minSpendCents)) {
    return { cents: 0, reason: "minimum spend not met" };
  }
  const raw = coupon.kind === "percent" ? Math.floor((subtotalCents * coupon.percent) / 100) : coupon.amountCents;
  return { cents: Math.min(raw, subtotalCents), reason: null };
}

module.exports = { findCoupon, discountFor, CATALOG };
`;

const TAX = String.raw`// Sales tax by region, in basis points (1 bp = 0.01%). Rounded half up to the cent.
const RATES_BP = { CA: 725, NY: 400, OR: 0, TX: 625 };

function taxFor(region, taxableCents) {
  const bp = RATES_BP[region];
  if (bp === undefined) throw new Error("unknown region " + region);
  return Math.floor((taxableCents * bp + 5000) / 10000);
}

module.exports = { taxFor, RATES_BP };
`;

const CHECKOUT = String.raw`// Puts it together: checkout(cart) -> the receipt.
// cart = { items, region, couponCode? }
const { subtotal } = require("./cart");
const { findCoupon, discountFor } = require("./coupons");
const { taxFor } = require("./tax");

function checkout(cart) {
  const sub = subtotal(cart.items);
  const coupon = findCoupon(cart.couponCode);
  const discount = discountFor(coupon, sub);
  // Tax is charged on what the customer actually pays for the goods.
  const tax = taxFor(cart.region, sub);
  return {
    subtotalCents: sub,
    discountCents: discount.cents,
    couponNote: coupon && discount.reason ? coupon.code + ": " + discount.reason : null,
    taxCents: tax,
    totalCents: sub - discount.cents + tax,
  };
}

module.exports = { checkout };
`;

const VISIBLE_TESTS = String.raw`const { subtotal } = require("../src/cart");
const { discountFor, findCoupon } = require("../src/coupons");
const { taxFor } = require("../src/tax");
const { checkout } = require("../src/checkout");

describe("cart", () => {
  test("adds plain line items", () => {
    expect(subtotal([{ sku: "pen", priceCents: 250, qty: 4 }, { sku: "pad", priceCents: 399, qty: 1 }])).toBe(1399);
  });
  test("prices full bundle groups at the bundle price", () => {
    expect(subtotal([{ sku: "sock", priceCents: 500, qty: 3, bundle: { size: 3, priceCents: 1200 } }])).toBe(1200);
  });
});

describe("coupons", () => {
  test("looks codes up case-insensitively", () => {
    expect(findCoupon(" save10 ").code).toBe("SAVE10");
    expect(findCoupon("NOPE")).toBeNull();
  });
  test("percent coupons round down", () => {
    expect(discountFor(findCoupon("SAVE10"), 1999).cents).toBe(199);
  });
});

describe("tax", () => {
  test("rounds half up", () => {
    expect(taxFor("CA", 1000)).toBe(73);
  });
});

describe("checkout", () => {
  test("no coupon", () => {
    const r = checkout({ items: [{ sku: "pen", priceCents: 1000, qty: 2 }], region: "NY" });
    expect(r).toEqual({ subtotalCents: 2000, discountCents: 0, couponNote: null, taxCents: 80, totalCents: 2080 });
  });
  test("tax is charged after the discount", () => {
    const r = checkout({ items: [{ sku: "pen", priceCents: 1000, qty: 2 }], region: "NY", couponCode: "SAVE10" });
    expect(r.discountCents).toBe(200);
    expect(r.taxCents).toBe(72);
    expect(r.totalCents).toBe(1872);
  });
});
`;

const HIDDEN_TESTS = String.raw`const { subtotal, lineTotal } = require("../src/cart");
const { discountFor, findCoupon } = require("../src/coupons");
const { checkout } = require("../src/checkout");

describe("hidden: cart", () => {
  test("bundle leftovers are charged per unit", () => {
    expect(lineTotal({ sku: "sock", priceCents: 500, qty: 5, bundle: { size: 3, priceCents: 1200 } })).toBe(2200);
  });
  test("bundle smaller than one group", () => {
    expect(lineTotal({ sku: "sock", priceCents: 500, qty: 2, bundle: { size: 3, priceCents: 1200 } })).toBe(1000);
  });
  test("zero quantity", () => {
    expect(subtotal([{ sku: "pen", priceCents: 250, qty: 0 }])).toBe(0);
  });
  test("rejects negative quantities", () => {
    expect(() => lineTotal({ sku: "pen", priceCents: 250, qty: -1 })).toThrow();
  });
});

describe("hidden: coupons", () => {
  test("minimum spend is inclusive", () => {
    expect(discountFor(findCoupon("FIVEOFF"), 2500).cents).toBe(500);
    expect(discountFor(findCoupon("BIG20"), 10000).cents).toBe(2000);
  });
  test("below the minimum gives nothing", () => {
    expect(discountFor(findCoupon("FIVEOFF"), 2499)).toEqual({ cents: 0, reason: "minimum spend not met" });
  });
  test("a fixed coupon never exceeds the subtotal", () => {
    expect(discountFor({ code: "X", kind: "fixed", amountCents: 900 }, 600).cents).toBe(600);
  });
});

describe("hidden: checkout", () => {
  test("tax on the discounted amount, with a bundle", () => {
    const r = checkout({
      items: [{ sku: "sock", priceCents: 500, qty: 4, bundle: { size: 3, priceCents: 1200 } }],
      region: "TX",
      couponCode: "FIVEOFF",
    });
    expect(r).toEqual({ subtotalCents: 1700, discountCents: 0, couponNote: "FIVEOFF: minimum spend not met", taxCents: 106, totalCents: 1806 });
  });
  test("tax after a percent coupon", () => {
    const r = checkout({ items: [{ sku: "lamp", priceCents: 12000, qty: 1 }], region: "CA", couponCode: "big20" });
    expect(r.discountCents).toBe(2400);
    expect(r.taxCents).toBe(696);
    expect(r.totalCents).toBe(10296);
  });
  test("tax-free region", () => {
    expect(checkout({ items: [{ sku: "pen", priceCents: 999, qty: 1 }], region: "OR" }).totalCents).toBe(999);
  });
});
`;

export const checkoutTask: DebugTask = {
  id: "checkout-bugs",
  title: "Checkout totals",
  summary: "A small checkout service with carts, coupons and sales tax. Customers report wrong totals: find out why.",
  modeledOn: "Google's code comprehension round, and debugging rounds at Stripe and Shopify",
  brief: `You've joined the team that owns this checkout service. Support says some customers are charged the wrong amount, and a couple of tests are failing.

1. **Read the code** in \`src/\` until you can explain how a receipt is built.
2. **Find and fix the bugs.** There are a few, and not all of them have a failing test yet. Keep the existing behavior that's correct.
3. **Finish** by answering a few questions about the code and writing up each bug: what was wrong, the root cause, and how you fixed and checked it.

Talk yourself through it as you would with an interviewer. Prices are integer cents throughout.`,
  files: {
    "src/cart.js": CART,
    "src/coupons.js": COUPONS,
    "src/tax.js": TAX,
    "src/checkout.js": CHECKOUT,
    "tests/checkout.test.js": VISIBLE_TESTS,
  },
  entry: "src/checkout.js",
  visibleTests: ["tests/checkout.test.js"],
  hiddenTests: { "tests/hidden.test.js": HIDDEN_TESTS },
  bugs: [
    {
      id: "bundle-rest",
      file: "src/cart.js",
      description: "Units left over after the full bundle groups were added as a count, not priced: `rest` instead of `rest * item.priceCents`, so 5 socks in bundles of 3 cost $12.02 instead of $22.00.",
      fix: { from: "return groups * item.bundle.priceCents + rest;", to: "return groups * item.bundle.priceCents + rest * item.priceCents;" },
      tests: ["hidden: cart > bundle leftovers are charged per unit", "hidden: cart > bundle smaller than one group", "hidden: checkout > tax on the discounted amount, with a bundle"],
      keywords: [["bundle", "leftover", "remainder", "rest"], ["price", "pricecents", "per unit", "unit price", "multiply"]],
    },
    {
      id: "min-spend",
      file: "src/coupons.js",
      description: "The minimum spend check used `>` instead of `>=`, so a subtotal exactly at the minimum didn't get the coupon.",
      fix: { from: "!(subtotalCents > coupon.minSpendCents)", to: "!(subtotalCents >= coupon.minSpendCents)" },
      tests: ["hidden: coupons > minimum spend is inclusive"],
      keywords: [["minimum", "min spend", "minspend", "threshold"], [">=", "inclusive", "exactly", "equal", "boundary", "off by one", "off-by-one"]],
    },
    {
      id: "tax-base",
      file: "src/checkout.js",
      description: "Tax was charged on the subtotal before the discount instead of on what the customer pays (`sub - discount.cents`), overcharging every order with a coupon.",
      fix: { from: "const tax = taxFor(cart.region, sub);", to: "const tax = taxFor(cart.region, sub - discount.cents);" },
      tests: ["checkout > tax is charged after the discount", "hidden: checkout > tax after a percent coupon"],
      keywords: [["tax"], ["discount", "after", "discounted", "before"]],
    },
  ],
  questions: [
    {
      id: "flow",
      prompt: "Walk through what checkout() does with a cart, in order.",
      answer:
        "It sums the line items (bundles priced per full group), looks up the coupon by its normalized code, works out the discount (which needs the minimum spend and is capped at the subtotal), charges tax on the discounted amount by region, and returns the subtotal, discount, any coupon note, tax and total.",
      keywords: [["subtotal", "sum", "line"], ["coupon", "discount"], ["tax"], ["total", "receipt", "returns"]],
    },
    {
      id: "rounding",
      prompt: "How does the service handle money and rounding, and why does that matter?",
      answer:
        "Everything is integer cents, so there are no floating-point errors. Percent discounts round down (in the customer's disfavor by at most a cent); tax rounds half up using basis points: (cents × bp + 5000) / 10000, floored.",
      keywords: [["cent", "cents", "integer"], ["float", "floating", "precision", "decimal"], ["round", "floor", "half"]],
    },
    {
      id: "change",
      prompt: "Product wants a coupon that only applies to one SKU. Where would you change the code, and what would you watch out for?",
      answer:
        "discountFor only sees the subtotal, so it would need the items (or the matching line total): checkout passes cart.items through, the coupon gets a sku field, and the percent is applied to that SKU's line total. Watch the minimum-spend rule (whole cart or the SKU?), bundles, the cap, and that tax still applies after the discount; add tests for each.",
      keywords: [["discountfor", "coupons.js", "coupon"], ["items", "line", "sku"], ["test", "tests"], ["minimum", "bundle", "cap", "tax"]],
    },
  ],
  topics: [
    {
      keywords: ["overview", "explain", "structure", "how does", "walk", "what does"],
      reply:
        "The repo has four modules. `cart.js` prices line items (bundles price each full group at the bundle price). `coupons.js` looks up a coupon and computes its discount. `tax.js` turns a taxable amount into tax with basis-point rates. `checkout.js` wires them together into a receipt. Reading `checkout.js` first, then each module it calls, is a good order.",
    },
    {
      keywords: ["bundle", "cart", "linetotal", "line total"],
      reply:
        "`lineTotal` handles plain items as `priceCents * qty`. For bundles it splits the quantity into full groups (`Math.floor(qty / size)`) and a remainder (`qty % size`), and adds the bundle price per group plus the remainder. It's worth checking what each of those terms is measured in.",
    },
    {
      keywords: ["coupon", "discount", "minimum", "min spend"],
      reply:
        "`discountFor` returns `{ cents, reason }`. It first checks the coupon's minimum spend, then computes a percent (rounded down) or fixed amount, capped at the subtotal. A good next step is to write down what should happen exactly at the minimum, and compare with the comparison in the code.",
    },
    {
      keywords: ["tax", "rate", "region"],
      reply:
        "`taxFor(region, taxableCents)` uses rates in basis points and rounds half up. Which amount should be taxable is decided in `checkout.js`; the comment there says what it intends. Check that the code matches the comment.",
    },
    {
      keywords: ["test", "failing", "fail", "error"],
      reply:
        "Run the visible tests and read the first failure closely: the expected and actual values usually tell you which module is off and by how much. Then write a small extra test for the boundary you suspect, before changing code.",
    },
  ],
};
