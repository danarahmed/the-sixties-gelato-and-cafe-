import "server-only";
/**
 * Documents kept with the records (0053): read as the signed-in person, whose
 * permission the database checks, and the files in Storage reached through
 * links that last a minute, made for someone Storage lets read them.
 */
import { db, one } from "./client";
import {
  documentCountsFrom,
  documentRecordFrom,
  type DocumentKind,
  type DocumentRecord,
} from "@/lib/documents";

/** A record and its documents; null when there is no such record. */
export async function getDocumentRecord(
  kind: DocumentKind,
  record: string,
): Promise<DocumentRecord | null> {
  const c = await db();
  const res = await c.rpc("document_record", { p_kind: kind, p_record: record });
  if (res.error && /The record was not found/.test(res.error.message)) return null;
  return documentRecordFrom(one(res, "the record's documents"));
}

/** How many documents each of these records keeps: { record id: count }. */
export async function getDocumentCounts(
  kind: DocumentKind,
  records: string[],
): Promise<Record<string, number>> {
  if (records.length === 0) return {};
  const c = await db();
  return documentCountsFrom(
    one(await c.rpc("document_counts", { p_kind: kind, p_records: records }), "the documents"),
  );
}

/**
 * A link to a document's file that lasts a minute, or null when the person may
 * not read it (row-level security hides the row) or it is not there.
 */
export async function documentLink(id: string, download: boolean): Promise<string | null> {
  const c = await db();
  const row = one<{ storage_path: string; file_name: string }>(
    await c.from("document_attachment").select("storage_path,file_name").eq("id", id).maybeSingle(),
    "the document",
  );
  if (!row) return null;
  const { data, error } = await c.storage
    .from("documents")
    .createSignedUrl(row.storage_path, 60, download ? { download: row.file_name } : undefined);
  return error || !data ? null : data.signedUrl;
}
