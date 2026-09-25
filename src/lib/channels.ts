/**
 * The ways the café sells (0031): its own three (at a table, to take away,
 * delivered by its own driver) and the delivery platforms, which the owner
 * adds, names in each language and takes out of use on Delivery Platforms.
 * The database lists them (sales_channels()); nothing here names a platform.
 */
import { translate, type Locale } from "@/lib/i18n/dictionaries";

export type ChannelKind = "dine_in" | "takeaway" | "delivery" | "platform";

export interface Channel {
  code: string;
  /** As the café named it: a platform's name as its customers know it. */
  name: string;
  /** A platform's name in other languages, by language code ("ar", "ckb"). */
  names: Record<string, string>;
  kind: ChannelKind;
  /** A platform out of use sells nothing more; the shop's own three are always in use. */
  active: boolean;
}

/** The shop's own ways of selling. Every other channel is a delivery platform. */
export const SHOP_CHANNELS = ["dine_in", "takeaway", "direct_delivery"] as const;

/** A channel's code as the database keeps it: small Latin letters, digits and _. */
export const CHANNEL_CODE = /^[a-z][a-z0-9_]{1,29}$/;

/** A delivery platform's order is paid through the platform, with the number from its tablet. */
export function isPlatformChannel(code: string): boolean {
  return !(SHOP_CHANNELS as readonly string[]).includes(code);
}

export interface ChannelSet {
  /** Every channel, in order, in use or not. */
  all: string[];
  /** The channels in use: what the till sells through, and the forms offer prices for. */
  inUse: string[];
  /** Every channel in use but a table: where the cup, lid and bag go. */
  toGo: string[];
}

export function channelSet(channels: readonly Channel[]): ChannelSet {
  const inUse = channels.filter((c) => c.active).map((c) => c.code);
  return {
    all: channels.map((c) => c.code),
    inUse,
    toGo: inUse.filter((c) => c !== "dine_in"),
  };
}

/** For recipes that are not sold (a batch): no channels to tell apart. */
export const NO_CHANNELS: ChannelSet = { all: [], inUse: [], toGo: [] };

/**
 * A channel's name in a language: the shop's own three as the dictionary has
 * them; a platform as the café named it in that language, else as it named it.
 */
export function channelName(
  channels: readonly Channel[],
  code: string,
  locale: Locale = "en",
): string {
  const c = channels.find((x) => x.code === code);
  if (c?.kind === "platform") return c.names[locale]?.trim() || c.name;
  const key = `pos.channel.${code}`;
  const word = translate(locale, key);
  if (word !== key) return word;
  return c?.name ?? code.replace(/_/g, " ").replace(/^./, (m) => m.toUpperCase());
}

const KINDS: ChannelKind[] = ["dine_in", "takeaway", "delivery", "platform"];

/** The rows of sales_channels(), in its order. */
export function parseChannels(raw: unknown): Channel[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: Record<string, unknown>) => {
    const names: Record<string, string> = {};
    if (r.names && typeof r.names === "object" && !Array.isArray(r.names)) {
      for (const [k, v] of Object.entries(r.names as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) names[k] = v;
      }
    }
    const kind = KINDS.includes(r.kind as ChannelKind) ? (r.kind as ChannelKind) : "platform";
    return {
      code: String(r.code),
      name: String(r.name ?? r.code),
      names,
      kind,
      active: r.is_active !== false,
    };
  });
}
