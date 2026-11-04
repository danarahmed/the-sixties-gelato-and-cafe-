"use server";
/** Where people get stuck (0097): a screen's help opened, noted for the owner. */
import { callRpc } from "@/lib/db/rpc";

export async function noteHelpOpenedAction(path: string): Promise<void> {
  if (typeof path !== "string" || !/^\/[A-Za-z0-9/_-]{0,80}$/.test(path)) return;
  await callRpc("note_stuck", { p_path: path, p_kind: "help" });
}
