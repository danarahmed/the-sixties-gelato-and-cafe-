import Link from "next/link";
import { notFound } from "next/navigation";
import { getMsg, getT } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/auth/session";
import { getDocumentRecord } from "@/lib/db/documents";
import {
  DOCUMENTS_PER_RECORD,
  DOCUMENT_HOME,
  DOCUMENT_KIND_LABEL,
  DOCUMENT_PERMISSIONS,
  isDocumentKind,
  sizeLabel,
  type KeptDocument,
} from "@/lib/documents";
import { fmtIQD } from "@/lib/format";
import { dateTimeIn } from "@/lib/dates";
import { AttachDocument } from "@/components/documents/AttachDocument";
import { DetachDocument } from "@/components/documents/DetachDocument";

export const dynamic = "force-dynamic";

/**
 * The documents kept with one record (0053): a delivery, a return, a bill, a
 * credit note or an expense. Whoever sees costs sees them; whoever may record
 * that kind of record attaches them, from a phone's camera or a file, and
 * takes one off saying why.
 */
export default async function RecordDocumentsPage({
  params,
}: {
  params: Promise<{ kind: string; record: string }>;
}) {
  const { kind, record } = await params;
  if (!isDocumentKind(kind) || !/^[0-9a-f-]{36}$/i.test(record)) notFound();
  const profile = await requirePermission("cost.view", ...DOCUMENT_PERMISSIONS[kind]);
  const [t, msg] = await Promise.all([getT(), getMsg()]);
  const r = await getDocumentRecord(kind, record);
  if (!r) notFound();

  const what = t(DOCUMENT_KIND_LABEL[kind]);
  const size = (d: KeptDocument) => {
    const s = sizeLabel(d.size);
    return t(s.phrase, { n: s.n });
  };
  const type = (d: KeptDocument) => (d.contentType === "application/pdf" ? "📄" : "🖼️");
  const back = DOCUMENT_HOME[kind];

  return (
    <div className="grid" style={{ gap: 16 }} data-testid="record-documents">
      <div className="phead">
        <h1>{t("Documents")}</h1>
        <span className="sc" data-testid="documents-record">
          {r.no ? `${what} ${r.no}` : what}
        </span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".9rem" }} data-testid="documents-about">
        {[
          r.supplier,
          r.date,
          r.amount !== null ? fmtIQD(r.amount) : null,
          r.text ? `“${r.text}”` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p style={{ margin: 0, fontSize: ".9rem" }}>
        <Link href={back}>{t("Back")}</Link>
      </p>

      <section className="panel">
        <div className="panel-h">
          <h3>{t("Kept with it")}</h3>
          <span className="muted" style={{ fontSize: ".74rem" }}>
            {t("{n} of {max}", { n: r.documents.length, max: DOCUMENTS_PER_RECORD })}
          </span>
        </div>
        {r.documents.length === 0 ? (
          <div className="panel-b">
            <p
              className="muted"
              style={{ margin: 0, fontSize: ".9rem" }}
              data-testid="documents-none"
            >
              {t("No documents kept with it yet")}
            </p>
          </div>
        ) : (
          <div className="tw">
            <table data-testid="documents-list">
              <thead>
                <tr>
                  <th>{t("Document")}</th>
                  <th>{t("Size")}</th>
                  <th>{t("Attached by")}</th>
                  <th>{t("Note")}</th>
                  {r.mayAttach && <th />}
                </tr>
              </thead>
              <tbody>
                {r.documents.map((d) => (
                  <tr key={d.id} data-testid="document-row" data-name={d.fileName}>
                    <td>
                      {type(d)}{" "}
                      <a
                        href={`/documents/file/${d.id}`}
                        target="_blank"
                        rel="noopener"
                        data-testid="document-open"
                      >
                        {d.fileName}
                      </a>{" "}
                      <a
                        href={`/documents/file/${d.id}?download=1`}
                        className="muted"
                        style={{ fontSize: ".8rem" }}
                        data-testid="document-download"
                      >
                        {t("Download")}
                      </a>
                    </td>
                    <td className="mono muted" style={{ fontSize: ".8rem" }}>
                      {size(d)}
                    </td>
                    <td className="muted" style={{ fontSize: ".8rem" }}>
                      {d.attachedBy ?? "—"} · {dateTimeIn(profile.timezone, d.attachedAt)}
                    </td>
                    <td style={{ fontSize: ".85rem" }}>{d.note ?? "—"}</td>
                    {r.mayAttach && (
                      <td>
                        <DetachDocument documentId={d.id} fileName={d.fileName} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {r.mayAttach ? (
        r.documents.length < DOCUMENTS_PER_RECORD ? (
          <section className="panel">
            <div className="panel-h">
              <h3>{t("Attach a document")}</h3>
            </div>
            <div className="panel-b grid" style={{ gap: 10 }}>
              <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
                {t(
                  "A photo or a PDF of the paper it came with: the delivery note, the supplier's bill or credit note, the return slip, or the receipt. A picture (JPEG, PNG or WebP) or a PDF, 10 MB at most; a large photo is made smaller before it is sent.",
                )}
              </p>
              <AttachDocument kind={kind} record={record} />
            </div>
          </section>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {msg("A record keeps at most 20 documents: take one off first")}
          </p>
        )
      ) : (
        <p
          className="muted"
          style={{ margin: 0, fontSize: ".85rem" }}
          data-testid="documents-read-only"
        >
          {t("Only those who may record it attach its documents.")}
        </p>
      )}

      {r.removed.length > 0 && (
        <section className="panel">
          <div className="panel-h">
            <h3>{t("Taken off")}</h3>
            <span className="muted" style={{ fontSize: ".74rem" }}>
              {t("Kept for the audit trail, with why")}
            </span>
          </div>
          <div className="tw">
            <table data-testid="documents-removed">
              <thead>
                <tr>
                  <th>{t("Document")}</th>
                  <th>{t("Attached by")}</th>
                  <th>{t("Taken off by")}</th>
                  <th>{t("Why")}</th>
                </tr>
              </thead>
              <tbody>
                {r.removed.map((d) => (
                  <tr key={d.id} data-testid="removed-row" data-name={d.fileName}>
                    <td>
                      {type(d)}{" "}
                      <a href={`/documents/file/${d.id}`} target="_blank" rel="noopener">
                        <s>{d.fileName}</s>
                      </a>
                    </td>
                    <td className="muted" style={{ fontSize: ".8rem" }}>
                      {d.attachedBy ?? "—"} · {dateTimeIn(profile.timezone, d.attachedAt)}
                    </td>
                    <td className="muted" style={{ fontSize: ".8rem" }}>
                      {d.removedBy ?? "—"} · {dateTimeIn(profile.timezone, d.removedAt)}
                    </td>
                    <td style={{ fontSize: ".85rem" }}>{d.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
