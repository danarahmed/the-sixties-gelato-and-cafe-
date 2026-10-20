import "server-only";
/** What each branch holds and owes (0084); null before it is applied, or for those who do not see it. */
import { db } from "./client";
import { branchPositionFrom, type BranchPosition } from "@/lib/branchPosition";

export async function getBranchPosition(): Promise<BranchPosition | null> {
  const c = await db();
  const { data, error } = await c.rpc("branch_position");
  if (error) return null;
  return branchPositionFrom(data);
}
