/**
 * The docs keep up with the code (the August audit's M-14). The runbook and
 * the data model are read by whoever applies a migration or looks for where
 * something is kept: a migration or a table they do not name is one they
 * cannot find. So:
 *  - every migration is named in the runbook and in the data model, by its
 *    number or inside a range of them (`0014`–`0017`, `0001`…`0013`);
 *  - every table a migration creates, and no later one drops, is named in
 *    the data model.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migrations = readdirSync(join(root, "supabase/migrations"))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

/** The migration numbers a document names, one by one or in a range. */
function named(doc: string): Set<number> {
  const out = new Set<number>();
  for (const m of doc.matchAll(/`(\d{4})`\s*(?:[–-]|…|\.\.\.)\s*`(\d{4})`/g))
    for (let n = Number(m[1]); n <= Number(m[2]); n++) out.add(n);
  for (const m of doc.matchAll(/`(\d{4})`/g)) out.add(Number(m[1]));
  return out;
}

const missing = (doc: string) => {
  const has = named(doc);
  return migrations.filter((f) => !has.has(Number(f.slice(0, 4))));
};

describe("the docs keep up with the code", () => {
  it("name every migration: the runbook and the data model", () => {
    expect(missing(read("docs/guides/deployment.md"))).toEqual([]);
    expect(missing(read("docs/DATA_MODEL.md"))).toEqual([]);
  });

  it("name every table in the data model", () => {
    const made = new Set<string>();
    const dropped = new Set<string>();
    for (const f of migrations) {
      const sql = read(`supabase/migrations/${f}`);
      for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_0-9]+)/g))
        made.add(m[1]!);
      for (const m of sql.matchAll(/drop table (?:if exists )?(?:public\.)?([a-z_0-9]+)/g))
        dropped.add(m[1]!);
    }
    const model = read("docs/DATA_MODEL.md");
    const tables = [...made].filter((t) => !dropped.has(t));
    expect(tables.length).toBeGreaterThan(100);
    expect(tables.filter((t) => !new RegExp(`\\b${t}\\b`).test(model))).toEqual([]);
  });
});
