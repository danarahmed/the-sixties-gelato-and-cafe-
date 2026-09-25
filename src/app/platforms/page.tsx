import { getT } from "@/lib/i18n/server";
import { has, requirePermission } from "@/lib/auth/session";
import { getSalesOrders } from "@/lib/db/read";
import { getPlatformMoney } from "@/lib/db/settlements";
import { getChannelNames } from "@/lib/db/channels";
import { isPlatformChannel } from "@/lib/channels";
import { fmtIQD } from "@/lib/format";
import { businessToday, dateTimeIn } from "@/lib/dates";
import { owedByPlatform } from "@/lib/settlements";
import { EmptyState } from "@/components/ui";
import { ChannelsProvider } from "@/components/ChannelsProvider";
import { PlatformsManager } from "@/components/platforms/PlatformsManager";
import { StatementMatcher } from "@/components/platforms/StatementMatcher";
import { PlatformSettlements } from "@/components/platforms/PlatformSettlements";

export const dynamic = "force-dynamic";

export default async function PlatformsPage() {
  const profile = await requirePermission("cost.view");
  const t = await getT();
  const today = businessToday(profile.timezone);
  const [money, orders, channels] = await Promise.all([
    getPlatformMoney(),
    getSalesOrders(500),
    getChannelNames(),
  ]);
  // Each platform as the café named it, in the reader's language.
  const names = Object.fromEntries(money.platforms.map((p) => [p.code, channels.name(p.code)]));
  const owed = owedByPlatform(money.orders);
  const canPost = has(profile, "accounting.post");

  const platform = orders.filter((o) => isPlatformChannel(o.channel) && o.status === "completed");
  const net = platform.reduce((s, o) => s + o.net, 0);
  const margin = platform.reduce((s, o) => s + (o.net - o.cogs), 0);

  return (
    <ChannelsProvider channels={channels.channels}>
      <div className="grid" style={{ gap: 16 }}>
        <h1 style={{ margin: 0 }}>{t("nav.platforms")}</h1>
        <p className="muted" style={{ marginTop: 0, fontSize: ".9rem" }}>
          A delivery-platform order is platform-paid: the customer pays the platform, and the sale
          sits in <strong>1100 Platform receivable</strong> until the platform pays out. Each sale
          carries the order number from the platform&apos;s tablet, and the platform&apos;s
          statement is matched to the sales by it. Direct delivery is not a platform sale — it is
          taken as cash or card.
        </p>

        <section className="panel" id="manage">
          <div className="panel-h">
            <h3>{t("plat.manage.title")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("plat.manage.hint")}
            </span>
          </div>
          <PlatformsManager
            platforms={money.platforms}
            canManage={has(profile, "settings.manage")}
          />
        </section>

        <section className="panel" id="owed">
          <div className="panel-h">
            <h3>Owed by the Platforms</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Each order sold and not yet paid out, by its number
            </span>
          </div>
          <div className="panel-b">
            <div className="cards2">
              <div>
                <div className="sc">Waiting to be paid out</div>
                <div className="v" data-testid="platform-waiting">
                  {fmtIQD(money.waiting)}
                </div>
                <div className="m">{money.orders.length} order(s), at their price on the till</div>
              </div>
              <div>
                <div className="sc">1100 Platform receivable</div>
                <div className="v">{fmtIQD(money.receivable)}</div>
                <div className="m">what the books say the platforms owe</div>
              </div>
              <div>
                <div className="sc">Not explained by any order</div>
                <div
                  className="v"
                  style={{ color: money.unmatched !== 0 ? "var(--warn)" : undefined }}
                  data-testid="platform-unmatched"
                >
                  {fmtIQD(money.unmatched)}
                </div>
                <div className="m">
                  {money.unmatched === 0
                    ? "the receivable is exactly the orders waiting"
                    : money.unmatched > 0
                      ? "in the receivable with no order number: sales from before order numbers, or a hand journal"
                      : "paid out by hand, matched to no order: a journal to 1100 outside this screen"}
                </div>
              </div>
            </div>

            {owed.length > 0 && (
              <div className="grid" style={{ gap: 4, maxWidth: 620, marginBlockStart: 12 }}>
                {owed.map((p) => (
                  <div className="deduction-row" key={p.platform}>
                    <span>
                      <strong>{names[p.platform] ?? p.platform}</strong> · {p.count} order(s)
                      {p.oldest && (
                        <span className="muted">
                          {" "}
                          · the oldest {dateTimeIn(profile.timezone, p.oldest)}, {p.overDays} day(s)
                          ago
                        </span>
                      )}
                    </span>
                    <span className="mono">{fmtIQD(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {money.orders.length === 0 ? (
              <div style={{ marginBlockStart: 12 }}>
                <EmptyState
                  title="No platform order is waiting to be paid out"
                  hint="A delivery-platform sale rung up on the till waits here, by its order number, until a statement pays it."
                />
              </div>
            ) : (
              <div className="tw" style={{ marginBlockStart: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Order</th>
                      <th>Sold</th>
                      <th className="right">Days waiting</th>
                      <th className="right">Sold for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {money.orders.map((o) => (
                      <tr key={o.saleId} data-testid="platform-owed">
                        <td>{names[o.platform] ?? o.platform}</td>
                        <td className="mono">{o.orderNo}</td>
                        <td className="muted mono" style={{ fontSize: ".8rem" }}>
                          {dateTimeIn(profile.timezone, o.placedAt)}
                        </td>
                        <td className="right">{o.days}</td>
                        <td className="right money">{fmtIQD(o.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="panel" id="statement">
          <div className="panel-h">
            <h3>Match a Statement</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              The platform&apos;s statement against the orders waiting · nothing is posted until you
              say so
            </span>
          </div>
          <StatementMatcher
            platforms={money.platforms.map((p) => ({
              code: p.code,
              name: names[p.code] ?? p.name,
            }))}
            initialPlatform={[...owed].sort((a, b) => b.count - a.count)[0]?.platform ?? null}
            canPost={canPost}
            today={today}
            timezone={profile.timezone}
          />
        </section>

        {money.settlements.length > 0 && (
          <section className="panel">
            <div className="panel-h">
              <h3>Statements Posted</h3>
              <span className="muted" style={{ fontSize: ".74rem" }}>
                Newest first · a cancelled one is kept, marked
              </span>
            </div>
            <PlatformSettlements
              settlements={money.settlements}
              names={names}
              canCancel={canPost}
              timezone={profile.timezone}
            />
          </section>
        )}

        <section className="panel">
          <div className="panel-h">
            <h3>Platform Sales</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              Among the last 500 sales · margin before the platform&apos;s commission
            </span>
          </div>
          <div className="panel-b">
            <div className="cards2">
              <div>
                <div className="sc">Platform sales shown</div>
                <div className="v">{platform.length}</div>
              </div>
              <div>
                <div className="sc">Their net sales</div>
                <div className="v">{fmtIQD(net)}</div>
              </div>
              <div>
                <div className="sc">Before commission</div>
                <div className="v" style={{ color: "var(--ok)" }}>
                  {fmtIQD(margin)}
                </div>
              </div>
            </div>
            {platform.length === 0 ? (
              <div style={{ marginBlockStart: 12 }}>
                <EmptyState
                  title="No delivery-platform sales yet"
                  hint="Delivery-platform orders rung up on the till appear here."
                />
              </div>
            ) : (
              <div className="tw" style={{ marginBlockStart: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Sale</th>
                      <th>When</th>
                      <th>Platform</th>
                      <th>Items</th>
                      <th className="right">Net</th>
                      <th className="right">COGS</th>
                      <th className="right">Before commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platform.map((o) => (
                      <tr key={o.id}>
                        <td className="mono">{o.id.slice(0, 8)}</td>
                        <td className="muted mono" style={{ fontSize: ".8rem" }}>
                          {dateTimeIn(profile.timezone, o.placedAt)}
                        </td>
                        <td className="muted">{names[o.channel] ?? channels.name(o.channel)}</td>
                        <td>{o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}</td>
                        <td className="right mono">{fmtIQD(o.net)}</td>
                        <td className="right mono">{fmtIQD(o.cogs)}</td>
                        <td className="right mono">{fmtIQD(o.net - o.cogs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </ChannelsProvider>
  );
}
