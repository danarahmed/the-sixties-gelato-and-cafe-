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
  | "recipe.edit"
  | "cost.view"
  | "profit.view"
  | "inventory.count"
  | "inventory.count.view_expected"
  | "inventory.adjust.approve"
  | "waste.record"
  | "waste.approve"
  | "purchase.create"
  | "purchase.receive"
  | "accounting.post"
  | "accounting.period.lock"
  | "platform.reconcile"
  | "ai.view"
  | "audit.view"
  | "settings.manage";

const ALL: Permission[] = [
  "sale.create",
  "sale.refund",
  "sale.void",
  "discount.apply",
  "recipe.edit",
  "cost.view",
  "profit.view",
  "inventory.count",
  "inventory.count.view_expected",
  "inventory.adjust.approve",
  "waste.record",
  "waste.approve",
  "purchase.create",
  "purchase.receive",
  "accounting.post",
  "accounting.period.lock",
  "platform.reconcile",
  "ai.view",
  "audit.view",
  "settings.manage",
];

/** Role → granted permissions. Owner has everything. */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(ALL),
  general_manager: new Set(ALL),
  branch_manager: new Set<Permission>([
    "sale.create",
    "sale.refund",
    "sale.void",
    "discount.apply",
    "cost.view",
    "profit.view",
    "inventory.count",
    "inventory.count.view_expected",
    "inventory.adjust.approve",
    "waste.record",
    "waste.approve",
    "purchase.create",
    "purchase.receive",
    "platform.reconcile",
    "ai.view",
    "audit.view",
  ]),
  cashier: new Set<Permission>(["sale.create", "discount.apply"]),
  barista: new Set<Permission>(["sale.create", "waste.record"]),
  inventory_counter: new Set<Permission>(["inventory.count"]),
  purchasing: new Set<Permission>(["purchase.create", "purchase.receive", "cost.view"]),
  accountant: new Set<Permission>([
    "cost.view",
    "profit.view",
    "accounting.post",
    "accounting.period.lock",
    "platform.reconcile",
    "audit.view",
  ]),
  auditor: new Set<Permission>(["cost.view", "profit.view", "audit.view"]),
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
