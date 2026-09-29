/**
 * Documents kept with the records (0053, release AA): a photo or a PDF of the
 * paper a record came with — a delivery note, a supplier's bill or credit
 * note, a return slip, the receipt for an expense. Pure: what the kinds are,
 * who keeps them, where a file goes in the bucket, what may be sent, and the
 * records as the database gives them.
 */
import type { Permission } from "@domain/auth/permissions.js";

/** The records that keep documents, as the database names them. */
export const DOCUMENT_KINDS = [
  "goods_receipt",
  "supplier_return",
  "purchase_invoice",
  "supplier_credit",
  "expense",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function isDocumentKind(v: unknown): v is DocumentKind {
  return typeof v === "string" && (DOCUMENT_KINDS as readonly string[]).includes(v);
}

/** What each record is called (each a phrase). */
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  goods_receipt: "Delivery",
  supplier_return: "Return",
  purchase_invoice: "Bill",
  supplier_credit: "Credit note",
  expense: "Expense",
};

/**
 * Who attaches a record's documents: whoever may record it, as the database's
 * document_permissions says. Whoever sees costs sees them too.
 */
export const DOCUMENT_PERMISSIONS: Record<DocumentKind, Permission[]> = {
  goods_receipt: ["purchase.receive"],
  supplier_return: ["purchase.receive", "purchase.create"],
  purchase_invoice: ["purchase.create", "accounting.post"],
  supplier_credit: ["purchase.create", "accounting.post"],
  expense: ["expense.record"],
};

/** Where each kind of record is listed: the page a record's documents lead back to. */
export const DOCUMENT_HOME: Record<DocumentKind, string> = {
  goods_receipt: "/purchasing",
  supplier_return: "/purchasing",
  purchase_invoice: "/vendors",
  supplier_credit: "/vendors",
  expense: "/expenses",
};

/** What a document may be: a picture or a PDF, as the bucket takes them. */
export const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENTS_PER_RECORD = 20;
export const DOCUMENT_NAME_MAX = 200;
export const DOCUMENT_NOTE_MAX = 500;

export function isDocumentType(v: unknown): v is DocumentType {
  return typeof v === "string" && (DOCUMENT_TYPES as readonly string[]).includes(v);
}

const EXTENSION: Record<DocumentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Where a file is kept in the bucket: under the café, the kind of record and
 * the record, by a name of its own. The name a person gave it is kept apart:
 * Storage takes only plain letters in a path.
 */
export function documentPath(
  business: string,
  kind: DocumentKind,
  record: string,
  fileId: string,
  type: DocumentType,
): string {
  return `${business}/${kind}/${record}/${fileId}.${EXTENSION[type]}`;
}

/** The name a document is kept by: as typed, or else the file's own; 200 letters at most. */
export function documentName(typed: string, fileName: string): string {
  const name = (typed.trim() || fileName.trim()).replace(/\s+/g, " ");
  return [...name].slice(0, DOCUMENT_NAME_MAX).join("");
}

/** Why a file cannot be kept (a phrase), or null when it can. */
export function fileProblem(type: string, size: number): string | null {
  if (!isDocumentType(type)) return "A document is a picture (JPEG, PNG or WebP) or a PDF";
  if (size <= 0) return "That file is empty";
  if (size > DOCUMENT_MAX_BYTES) return "A document is at most 10 MB";
  return null;
}

/**
 * A picture is made smaller before it is sent when it is over 1.5 MB: its
 * longer side at most 2,000 pixels, as a JPEG. A phone's photo of a delivery
 * note stays readable at a fraction of the size.
 */
export const SHRINK = { over: 1.5 * 1024 * 1024, side: 2000, quality: 0.82 } as const;

export function shouldShrink(type: string, size: number): boolean {
  return type.startsWith("image/") && size > SHRINK.over;
}

/** A picture's size once its longer side is at most `side`; never made bigger. */
export function shrunkSize(
  width: number,
  height: number,
  side: number = SHRINK.side,
): { width: number; height: number } {
  const longer = Math.max(width, height);
  if (longer <= side || longer <= 0) return { width, height };
  const k = side / longer;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** A file's size as a person reads it: "820 bytes", "340 KB", "2.4 MB". */
export function sizeLabel(bytes: number): { phrase: string; n: string } {
  if (bytes < 1024) return { phrase: "{n} bytes", n: String(bytes) };
  if (bytes < 1024 * 1024) return { phrase: "{n} KB", n: String(Math.round(bytes / 1024)) };
  return { phrase: "{n} MB", n: (bytes / (1024 * 1024)).toFixed(1) };
}

/** A document kept with a record. */
export interface KeptDocument {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  note: string | null;
  attachedAt: string;
  attachedBy: string | null;
}

/** One taken off: who took it off, when and why. */
export interface RemovedDocument extends KeptDocument {
  removedAt: string;
  removedBy: string | null;
  reason: string;
}

/** A record, for the page its documents are kept on (document_record). */
export interface DocumentRecord {
  kind: DocumentKind;
  recordId: string;
  /** Its number: a delivery's, a return's, a bill's or a credit's. */
  no: string | null;
  supplier: string | null;
  date: string | null;
  amount: number | null;
  /** What it says: a delivery's note, why goods went back, an expense's narration. */
  text: string | null;
  mayAttach: boolean;
  documents: KeptDocument[];
  removed: RemovedDocument[];
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function keptFrom(d: Obj): KeptDocument {
  return {
    id: str(d.id),
    fileName: str(d.file_name),
    contentType: str(d.content_type),
    size: numOrNull(d.size) ?? 0,
    note: strOrNull(d.note),
    attachedAt: str(d.attached_at),
    attachedBy: strOrNull(d.attached_by),
  };
}

export function documentRecordFrom(v: unknown): DocumentRecord | null {
  const o = obj(v);
  if (!isDocumentKind(o.kind) || !o.record_id) return null;
  return {
    kind: o.kind,
    recordId: str(o.record_id),
    no: strOrNull(o.no),
    supplier: strOrNull(o.supplier),
    date: strOrNull(o.date),
    amount: numOrNull(o.amount),
    text: strOrNull(o.text),
    mayAttach: o.may_attach === true,
    documents: list(o.documents).map(keptFrom),
    removed: list(o.removed).map((d) => ({
      ...keptFrom(d),
      removedAt: str(d.removed_at),
      removedBy: strOrNull(d.removed_by),
      reason: str(d.removed_reason),
    })),
  };
}

/** How many documents each record keeps (document_counts): { record id: count }. */
export function documentCountsFrom(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(obj(v))) {
    const c = numOrNull(n);
    if (c !== null && c > 0) out[k] = c;
  }
  return out;
}

/** Every word this file gives the screens, for the check that each is translated. */
export const DOCUMENT_PHRASES: readonly string[] = [
  ...Object.values(DOCUMENT_KIND_LABEL),
  "That file is empty",
  "{n} bytes",
  "{n} KB",
  "{n} MB",
];
