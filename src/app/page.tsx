import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/routes";

export const dynamic = "force-dynamic";

/** Everyone starts where their work starts, or on the screen they chose (E6). */
export default async function Home() {
  const profile = await requireMember();
  redirect(homeFor(profile.permissions, profile.firstScreen));
}
