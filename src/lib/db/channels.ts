import "server-only";
/** The café's ways of selling, in order: its own three, then its delivery platforms (0031). */
import { db, rows } from "./client";
import { channelName, parseChannels, type Channel } from "@/lib/channels";
import { getLocale, getT } from "@/lib/i18n/server";

export async function getChannels(): Promise<Channel[]> {
  const c = await db();
  return parseChannels(rows(await c.rpc("sales_channels"), "the channels the café sells through"));
}

/** The channels, and each one's name in the reader's language. */
export async function getChannelNames(): Promise<{
  channels: Channel[];
  name: (code: string) => string;
}> {
  const [channels, locale, t] = await Promise.all([getChannels(), getLocale(), getT()]);
  return { channels, name: (code) => channelName(channels, code, locale, t) };
}
