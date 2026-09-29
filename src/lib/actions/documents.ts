"use server";
/**
 * Documents kept with the records (0053). A file goes straight from the
 * person's phone or computer to Storage, through a link made here for them
 * alone, which Storage gives only to someone who may keep that kind of record;
 * then it is attached to the record by one database function, which checks the
 * permission again, the file's kind and size as Storage kept them, and puts it
 * on the audit trail. Taken off with a reason, by another.
 */
import { z } from "zod";
import { badKey, callRpc, parse, refresh, type ActionResult } from "@/lib/db/rpc";
import { getSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  DOCUMENT_HOME,
  DOCUMENT_KINDS,
  DOCUMENT_NOTE_MAX,
  documentName,
  documentPath,
  fileProblem,
  isDocumentKind,
  type DocumentKind,
  type DocumentType,
} from "@/lib/documents";
import { id, optionalText, text } from "@/lib/validation";

const pagesOf = (kind: DocumentKind, record: string) => [
  `/documents/${kind}/${record}`,
  DOCUMENT_HOME[kind],
];

/**
 * Where to put one file for a record, and the link that lets this person put
 * it there once: Storage refuses the link to anyone who may not keep that kind
 * of record.
 */
export async function prepareDocumentAction(
  kind: string,
  record: string,
  type: string,
  size: number,
): Promise<ActionResult<{ path: string; url: string; apikey: string }>> {
  if (!isDocumentKind(kind)) return { ok: false, error: "Choose what the document goes with" };
  const v = parse(id("the record"), record);
  if (!v.ok) return v;
  const problem = fileProblem(type, size);
  if (problem) return { ok: false, error: problem };
  const cfg = supabaseConfig();
  const session = await getSession();
  if (!cfg || !session.profile) return { ok: false, error: "Sign in first" };
  const path = documentPath(
    session.profile.businessId,
    kind,
    v.data,
    crypto.randomUUID(),
    type as DocumentType,
  );
  try {
    const c = await createServerSupabase();
    const { data, error } = await c.storage.from("documents").createSignedUploadUrl(path);
    if (error || !data) {
      return {
        ok: false,
        error: /row-level security|unauthori[sz]ed|403/i.test(`${error?.message} ${error?.name}`)
          ? "You do not have permission to do that."
          : "The file could not be sent: try again",
      };
    }
    return { ok: true, data: { path, url: data.signedUrl, apikey: cfg.anonKey } };
  } catch {
    return { ok: false, error: "The file could not be sent: try again" };
  }
}

const attachInput = z.object({
  kind: z.enum(DOCUMENT_KINDS, { message: "Choose what the document goes with" }),
  record: id("the record"),
  path: text("The file", 400),
  fileName: text("The document's name", 400),
  typed: z.string().max(400).optional(),
  note: optionalText(DOCUMENT_NOTE_MAX),
});

/** The file put in Storage, attached to its record. */
export async function attachDocumentAction(
  input: z.input<typeof attachInput>,
  key: string,
): Promise<ActionResult<{ documentId: string; fileName: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(attachInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("attach_document", {
    p_kind: v.data.kind,
    p_record: v.data.record,
    p_path: v.data.path,
    p_file_name: documentName(v.data.typed ?? "", v.data.fileName),
    p_note: v.data.note,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  refresh(...pagesOf(v.data.kind, v.data.record));
  return {
    ok: true,
    data: {
      documentId: String(r.data.document_id ?? ""),
      fileName: String(r.data.file_name ?? ""),
    },
  };
}

const detachInput = z.object({
  documentId: id("the document"),
  reason: text("Why", 500),
});

/** A document taken off its record, saying why: the file and its record stay. */
export async function detachDocumentAction(
  input: z.input<typeof detachInput>,
  key: string,
): Promise<ActionResult<{ fileName: string }>> {
  const bad = badKey(key);
  if (bad) return bad;
  const v = parse(detachInput, input);
  if (!v.ok) return v;
  const r = await callRpc<Record<string, unknown>>("detach_document", {
    p_document: v.data.documentId,
    p_reason: v.data.reason,
    p_idempotency_key: key,
  });
  if (!r.ok) return r;
  const kind = String(r.data.kind ?? "");
  if (isDocumentKind(kind)) refresh(...pagesOf(kind, String(r.data.record_id ?? "")));
  return { ok: true, data: { fileName: String(r.data.file_name ?? "") } };
}
