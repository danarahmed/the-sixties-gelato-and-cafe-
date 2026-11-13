import { getT } from "@/lib/i18n/server";
import { getPublicMenu } from "@/lib/db/publicMenu";
import { PhoneMenu } from "@/components/menu/PhoneMenu";

export const dynamic = "force-dynamic";

/**
 * The café's menu on the customer's phone (0118), opened by the QR on the
 * table; nobody signs in. The order is shown as a QR for the waiter.
 */
export default async function PhoneMenuPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getT();
  const menu = await getPublicMenu(token);
  if (!menu)
    return (
      <p
        className="muted"
        style={{ textAlign: "center", marginTop: 40 }}
        data-testid="phone-menu-off"
      >
        {t("This menu is not available")}
      </p>
    );
  return <PhoneMenu menu={menu} token={token} />;
}
