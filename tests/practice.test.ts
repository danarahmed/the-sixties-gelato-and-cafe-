import { describe, expect, it } from "vitest";
import {
  PRACTICE_TASKS,
  isReady,
  nextTask,
  practiceStateFrom,
  practiceTeamFrom,
} from "@/lib/practice";
import { readFileSync } from "node:fs";

describe("practice", () => {
  it("knows every task the database lists, each with where it is done", () => {
    const sql = readFileSync("supabase/migrations/0096_practice.sql", "utf8");
    const listed = [...sql.matchAll(/\('([a-z_]+)', '[a-z.]+', \d+\)/g)].map((m) => m[1]);
    expect(listed.length).toBeGreaterThan(10);
    expect(listed.filter((k) => !(k! in PRACTICE_TASKS))).toEqual([]);
    expect(Object.keys(PRACTICE_TASKS).filter((k) => !listed.includes(k))).toEqual([]);
    for (const info of Object.values(PRACTICE_TASKS)) expect(info.href).toMatch(/^\//);
  });

  it("reads the tasks, the next one, and ready", () => {
    const s = practiceStateFrom({
      started: true,
      started_at: "2026-11-04T08:00:00Z",
      tasks: [
        { task: "open_drawer", done_at: "2026-11-04T08:05:00Z" },
        { task: "sell_card", done_at: null },
        { task: "unknown_one", done_at: null },
      ],
    });
    expect(s.tasks.map((t) => t.task)).toEqual(["open_drawer", "sell_card"]);
    expect(nextTask(s)?.task).toBe("sell_card");
    expect(isReady(s)).toBe(false);
    expect(isReady({ tasks: [{ task: "count", doneAt: "x" }] })).toBe(true);
    expect(isReady({ tasks: [] })).toBe(false);
    expect(practiceStateFrom(null).started).toBe(false);
  });

  it("reads the team", () => {
    const [p] = practiceTeamFrom([{ id: "1", name: "Ana", roles: ["cashier"], tasks: 6, done: 2 }]);
    expect(p).toMatchObject({ name: "Ana", tasks: 6, done: 2, startedAt: null });
    expect(practiceTeamFrom("nope")).toEqual([]);
  });
});
