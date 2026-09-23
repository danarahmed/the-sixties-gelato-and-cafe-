import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/routes";

export const dynamic = "force-dynamic";

/** Everyone starts where their work starts: the till, the count, the books. */
export default async function Home() {
  const profile = await requireMember();
  redirect(homeFor(profile.permissions));
}
