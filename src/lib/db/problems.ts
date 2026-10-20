import "server-only";
/** "Something's wrong" (0083); null before it is applied, or for those who do not see it. */
import { db } from "./client";
import { problemList, type ProblemList } from "@/lib/problems";

export async function getProblems(): Promise<ProblemList | null> {
  const c = await db();
  const { data, error } = await c.rpc("problem_reports");
  if (error) return null;
  return problemList(data);
}
