"use client";
/**
 * The café's channels for the screens that sell or price (0031): the page
 * reads them once and every form under it names them in the reader's language.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { channelName, channelSet, type Channel, type ChannelSet } from "@/lib/channels";
import { useT } from "@/lib/i18n/I18nProvider";

const ChannelsContext = createContext<Channel[]>([]);

export function ChannelsProvider({
  channels,
  children,
}: {
  channels: Channel[];
  children: ReactNode;
}) {
  return <ChannelsContext.Provider value={channels}>{children}</ChannelsContext.Provider>;
}

export interface Channels {
  channels: Channel[];
  set: ChannelSet;
  /** A channel's name in the reader's language. */
  name: (code: string) => string;
}

export function useChannels(): Channels {
  const channels = useContext(ChannelsContext);
  const { locale } = useT();
  return useMemo(
    () => ({
      channels,
      set: channelSet(channels),
      name: (code: string) => channelName(channels, code, locale),
    }),
    [channels, locale],
  );
}
