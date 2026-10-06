import { getPhoneStatus } from "@/lib/db/clock";
import { LinkPhone } from "@/components/clock/LinkPhone";

export const dynamic = "force-dynamic";

/**
 * A phone made someone's (0068): opened from the square a manager shows on
 * Staff. Nothing happens until the person presses the button, so a link that
 * a chat app looks at first is not used up by it.
 */
export default async function LinkPhonePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = await getPhoneStatus();
  return (
    <LinkPhone
      linkKey={typeof sp.k === "string" ? sp.k : ""}
      already={status?.linked ? status.name : null}
    />
  );
}
