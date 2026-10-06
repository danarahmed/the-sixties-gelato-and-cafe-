import { getPhoneStatus } from "@/lib/db/clock";
import { readCode } from "@/lib/clock";
import { PhoneClock } from "@/components/clock/PhoneClock";

export const dynamic = "force-dynamic";

/**
 * The phone's clock (0068): opened by scanning the shop's code, which the
 * address carries. The key the phone keeps since a manager linked it says
 * whose phone it is; one press clocks them in or out. Open to a phone that is
 * not signed in: the key is what it is known by.
 */
export default async function ClockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = readCode(typeof sp.c === "string" ? sp.c : "");
  const status = await getPhoneStatus();
  return <PhoneClock status={status} scanned={code} />;
}
