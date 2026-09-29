/**
 * Role-based permissions (least privilege).
 *
 * This is the single source of truth for what each role may do. The database
 * enforces the same model via row-level security and server-side checks; this
 * module makes the policy explicit and unit-testable, and is used by the UI to
 * show/hide controls. UI hiding is never the only guard — the server re-checks.
 */

export type Role =
  | "owner"
  | "general_manager"
  | "branch_manager"
  | "cashier"
  | "barista"
  | "inventory_counter"
  | "purchasing"
  | "accountant"
  | "auditor";

export type Permission =
  | "sale.create"
  | "sale.refund"
  | "sale.void"
  | "discount.apply"
  | "discount.approve"
  | "recipe.edit"
  | "cost.view"
  | "profit.view"
  | "inventory.count"
  | "inventory.count.view_expected"
  | "inventory.adjust.approve"
  | "waste.record"
  | "waste.approve"
  | "production.record"
  | "stock.transfer"
  | "purchase.create"
  | "purchase.receive"
  | "purchase.approve"
  | "expense.record"
  | "day.close"
  | "cash.session"
  | "cash.view_expected"
  | "cash.session.force"
  | "fx.rate"
  | "accounting.post"
  | "accounting.period.lock"
  | "accounting.period.unlock"
  | "platform.reconcile"
  | "ai.view"
  | "audit.view"
  | "settings.manage"
  | "staff.manage"
  | "attendance.edit"
  | "payroll.view"
  | "payroll.run"
  | "customer.edit"
  | "customer.view"
  | "loyalty.adjust";

const ALL: Permission[] = [
  "sale.create",
  "sale.refund",
  "sale.void",
  "discount.apply",
  "discount.approve",
  "recipe.edit",
  "cost.view",
  "profit.view",
  "inventory.count",
  "inventory.count.view_expected",
  "inventory.adjust.approve",
  "waste.record",
  "waste.approve",
  "production.record",
  "stock.transfer",
  "purchase.create",
  "purchase.receive",
  "purchase.approve",
  "expense.record",
  "day.close",
  "cash.session",
  "cash.view_expected",
  "cash.session.force",
  "fx.rate",
  "accounting.post",
  "accounting.period.lock",
  "accounting.period.unlock",
  "platform.reconcile",
  "ai.view",
  "audit.view",
  "settings.manage",
  "staff.manage",
  "attendance.edit",
  "payroll.view",
  "payroll.run",
  "customer.edit",
  "customer.view",
  "loyalty.adjust",
];

/**
 * Role → granted permissions. The owner has everything; the general manager
 * has everything except reopening a locked period, which is the owner's alone.
 *
 * The database enforces the same matrix (role_permission, migration 0015).
 * tests/permissions-sync.test.ts fails if the two ever differ.
 */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(ALL),
  general_manager: new Set(ALL.filter((p) => p !== "accounting.period.unlock")),
  branch_manager: new Set<Permission>([
    "sale.create",
    "sale.refund",
    "sale.void",
    "discount.apply",
    "discount.approve",
    "cost.view",
    "profit.view",
    "inventory.count",
    "inventory.count.view_expected",
    "inventory.adjust.approve",
    "waste.record",
    "waste.approve",
    "production.record",
    "stock.transfer",
    "purchase.create",
    "purchase.receive",
    "purchase.approve",
    "expense.record",
    "day.close",
    "cash.session",
    "cash.session.force",
    "fx.rate",
    "platform.reconcile",
    "ai.view",
    "audit.view",
    "staff.manage",
    "attendance.edit",
    "customer.edit",
    "customer.view",
    "loyalty.adjust",
  ]),
  cashier: new Set<Permission>(["sale.create", "discount.apply", "cash.session", "customer.edit"]),
  barista: new Set<Permission>([
    "sale.create",
    "waste.record",
    "production.record",
    "cash.session",
    "customer.edit",
  ]),
  inventory_counter: new Set<Permission>(["inventory.count"]),
  purchasing: new Set<Permission>([
    "purchase.create",
    "purchase.receive",
    "cost.view",
    "stock.transfer",
  ]),
  accountant: new Set<Permission>([
    "cost.view",
    "profit.view",
    "expense.record",
    "accounting.post",
    "accounting.period.lock",
    "platform.reconcile",
    "audit.view",
    "cash.view_expected",
    "payroll.view",
    "payroll.run",
    "customer.view",
  ]),
  auditor: new Set<Permission>([
    "cost.view",
    "profit.view",
    "audit.view",
    "cash.view_expected",
    "payroll.view",
    "customer.view",
  ]),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Assert a role has a permission, throwing a clear authorization error if not. */
export function authorize(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new Error(`Role "${role}" is not authorized to "${permission}"`);
  }
}
