"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export interface AuthFormState {
  ok: boolean;
  message: string | null;
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter your email address"),
  password: z.string().min(8, "Passwords are at least 8 characters"),
});

/** Only ever continue to a path inside this app. */
function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      message: /confirm/i.test(error.message)
        ? "Confirm your email first — the link is in the message we sent you."
        : "That email and password do not match.",
    };
  }
  redirect(safeNext(form.get("next")));
}

/**
 * Staff create their own login with the email the owner invited them with.
 * The login is linked to their place in the business only once the email is
 * confirmed, so nobody can claim someone else's address.
 */
export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await origin()}/auth/confirm?next=/` },
  });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    message:
      "Check your email and open the confirmation link. If the owner invited this address, you can then sign in.",
  };
}

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { ok: false, message: "Enter your email address" };
  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await origin()}/auth/confirm?next=/account`,
  });
  // The same answer whether or not the address has a login.
  return {
    ok: true,
    message: "If that address has a login, a link to set a new password is on its way.",
  };
}

export async function updatePasswordAction(
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const password = z.string().min(8, "Use at least 8 characters").safeParse(form.get("password"));
  if (!password.success)
    return { ok: false, message: password.error.issues[0]?.message ?? "Too short" };
  if (form.get("password") !== form.get("confirm"))
    return { ok: false, message: "The two passwords differ" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Your password is changed." };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
