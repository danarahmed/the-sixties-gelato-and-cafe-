// The guide's pictures (scripts/guide/shots.mjs). "page-<route>" is each
// screen as first opened, by the role that uses it most; the guide shows it
// with the screen's entry when the entry names no picture of its own.
// A step's `then(page)` brings the screen to the state the picture shows.
export const pageName = (path) =>
  "page-" + (String(path).replace(/\[[^\]]+\]/g, "x").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home");

const P = (path, role, extra = {}) => ({ name: pageName(path), path: extra.at || path, role, ...extra });

export const SHOTS = [
  // Getting around and setting up
  P("/login", "owner", { then: async (page) => { await page.context().clearCookies(); await page.goto(page.url().replace(/\/[^/]*$/, "/login")); } }),
  P("/dashboard", "owner"),
  P("/settings", "owner"),
  P("/settings/rules", "owner"),
  P("/settings/languages", "owner"),
  P("/setup", "owner"),
  P("/start-of-day", "manager"),
  P("/end-of-day", "manager"),
  // Selling
  P("/pos", "cashier"),
  P("/orders", "owner"),
  P("/sales", "owner"),
  P("/sales/sessions", "owner"),
  P("/sales/sessions/[id]", "owner", { at: (ids) => `/sales/sessions/${ids.session()}` }),
  P("/platforms", "owner"),
  P("/customers", "owner"),
  // Kitchen and stock
  P("/production", "manager"),
  P("/production/batches/[id]", "manager", { at: (ids) => `/production/batches/${ids.batch()}` }),
  P("/inventory", "manager"),
  P("/inventory/[itemId]", "manager", { at: (ids) => `/inventory/${ids.item()}` }),
  P("/inventory/transfers", "manager"),
  P("/inventory/usage", "owner"),
  P("/count", "counter"),
  P("/products", "owner"),
  P("/products/labels", "manager"),
  // Buying and spending
  P("/purchasing", "manager"),
  P("/purchasing/buying-list", "manager"),
  P("/purchasing/orders/[id]", "manager", { at: (ids) => `/purchasing/orders/${ids.po()}` }),
  P("/vendors", "owner"),
  P("/vendors/[id]/statement", "owner", { at: (ids) => `/vendors/${ids.supplier()}/statement` }),
  P("/expenses", "owner"),
  // People and pay
  P("/staff", "owner"),
  P("/payroll", "owner"),
  P("/payroll/[id]", "owner", { at: (ids) => `/payroll/${ids.payroll()}` }),
  P("/clock", "cashier"),
  P("/clock/screen", "manager"),
  P("/clock/link", "cashier"),
  P("/account", "owner"),
  P("/devices", "manager"),
  // The books and checks
  P("/accounting", "owner"),
  P("/accounting/bank", "owner"),
  P("/journals", "owner"),
  P("/documents/[kind]/[record]", "manager", { at: (ids) => `/documents/goods_receipt/${ids.receipt()}` }),
  P("/approvals", "owner"),
  P("/audit", "owner"),
  P("/problems", "owner"),
  // Reports
  P("/reports", "owner"),
  P("/reports/sales", "owner"),
  P("/reports/week", "owner"),
  P("/reports/month", "owner"),
  P("/reports/menu", "owner"),
  P("/reports/prices", "owner"),
  P("/reports/stock", "owner"),
  P("/reports/waste", "owner"),
  P("/reports/staffing", "owner"),
  P("/reports/statements", "owner"),
  P("/reports/cash-ahead", "owner"),
  P("/reports/watch", "owner"),
  // On a phone
  P("/dashboard", "owner", { name: "phone-dashboard", phone: true }),
  P("/pos", "cashier", { name: "phone-pos", phone: true }),
  P("/count", "counter", { name: "phone-count", phone: true }),
];
