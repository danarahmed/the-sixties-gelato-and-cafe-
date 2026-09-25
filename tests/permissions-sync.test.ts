/**
 * The permission matrix exists twice: in the domain module (which the app uses
 * to decide what to show) and in the database (role_permission, which the
 * posting functions use to decide what is allowed). If they drift, the screen
 * offers actions the database refuses, or hides ones it would allow.
 *
 * This reads the matrix straight out of the migrations (0015 sets it; later
 * ones add to it) and compares it, role by role, with ROLE_PERMISSIONS.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, type Role } from "../src/domain/auth/permissions.js";

/** Every role_permission row the migrations insert, in the order they run. */
function sqlMatrix(): Map<string, Set<string>> {
  const dir = join(__dirname, "../supabase/migrations");
  const matrix = new Map<string, Set<string>>();
  for (const file of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, file), "utf8");
    for (let at = sql.indexOf("insert into role_permission"); at >= 0;) {
      const end = sql.indexOf(") as v(r, p)", at);
      for (const [, role, permission] of sql
        .slice(at, end)
        .matchAll(/\('([a-z_]+)','([a-z._]+)'\)/g)) {
        if (!matrix.has(role!)) matrix.set(role!, new Set());
        matrix.get(role!)!.add(permission!);
      }
      at = sql.indexOf("insert into role_permission", end);
    }
  }
  return matrix;
}

describe("permission matrix", () => {
  const db = sqlMatrix();

  it("the database defines every role the app knows", () => {
    expect([...db.keys()].sort()).toEqual(Object.keys(ROLE_PERMISSIONS).sort());
  });

  for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
    it(`${role}: the app and the database grant exactly the same permissions`, () => {
      expect([...(db.get(role) ?? [])].sort()).toEqual([...ROLE_PERMISSIONS[role]].sort());
    });
  }

  it("only the owner may reopen a locked period", () => {
    const holders = [...db.entries()].filter(([, ps]) => ps.has("accounting.period.unlock"));
    expect(holders.map(([r]) => r)).toEqual(["owner"]);
  });
});
