import "server-only";
/**
 * Card and platform money (0030, the audit's P1-9): the card takings waiting
 * to be settled, and what the delivery platforms owe, order by order. The
 * functions check the person's permission themselves.
 */
import { db, one } from "./client";
import {
  parseCardTakings,
  parsePlatformMoney,
  type CardTakings,
  type PlatformMoney,
} from "@/lib/settlements";

export async function getCardTakings(): Promise<CardTakings> {
  const c = await db();
  return parseCardTakings(one(await c.rpc("card_takings"), "the card takings"));
}

export async function getPlatformMoney(): Promise<PlatformMoney> {
  const c = await db();
  return parsePlatformMoney(one(await c.rpc("platform_money"), "what the platforms owe"));
}
