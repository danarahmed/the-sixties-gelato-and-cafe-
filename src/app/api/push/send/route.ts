import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { supabaseConfig } from "@/lib/supabase/config";
import { pushRound, waitingFrom } from "@/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Warnings on your phone (0072): the database calls this address, with its
 * own secret, when warnings wait to be sent. No one is signed in: the secret
 * is passed on to the database, which gives the queue and the keys only for
 * it. Each warning goes to its phone in the phone's language; the database is
 * told what went and which phones are gone.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const key = request.headers.get("x-push-key") ?? "";
  const cfg = supabaseConfig();
  if (!cfg || key.length < 32 || key.length > 200) {
    return NextResponse.json({ ok: false }, { status: 403, headers });
  }
  const db = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const result = await pushRound({
      take: async () => {
        const r = await db.rpc("push_take", { p_key: key });
        if (r.error) throw Object.assign(new Error("refused"), { refused: true });
        const v = (r.data ?? {}) as Record<string, unknown>;
        return {
          subject: String(v.subject ?? ""),
          publicKey: String(v.public_key ?? ""),
          privateKey: String(v.private_key ?? ""),
          messages: waitingFrom(v.messages),
        };
      },
      send: async (m, payload, keys) => {
        await webpush.sendNotification(
          { endpoint: m.endpoint, keys: { p256dh: m.p256dh, auth: m.auth } },
          JSON.stringify(payload),
          {
            vapidDetails: {
              // A push service asks who sends: the app's own address.
              subject: keys.subject.startsWith("https://")
                ? keys.subject
                : "mailto:warnings@localhost",
              publicKey: keys.publicKey,
              privateKey: keys.privateKey,
            },
            TTL: 6 * 60 * 60,
            // A push service that does not answer is tried again on the next round.
            timeout: 10_000,
            urgency: payload.urgent ? "high" : "normal",
            topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
          },
        );
      },
      done: async (sent, gone) => {
        await db.rpc("push_done", { p_key: key, p_sent: sent, p_gone: gone });
      },
    });
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (e) {
    const refused = (e as { refused?: boolean } | null)?.refused === true;
    return NextResponse.json({ ok: false }, { status: refused ? 403 : 503, headers });
  }
}
