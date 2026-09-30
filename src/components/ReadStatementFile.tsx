"use client";
/**
 * A statement read from the file it comes in: a delivery platform's report,
 * or the bank's statement, as Excel (.xlsx), CSV or text. The file is read
 * here, in the browser, and nothing is sent: what it holds is handed on as
 * the text of its table, where the person sees it before anything is posted.
 */
import { useRef, useState } from "react";
import { FILE_MAX, readStatementFile } from "@/lib/sheet";
import { useT } from "@/lib/i18n/I18nProvider";

const ACCEPT = [
  ".xlsx",
  ".csv",
  ".tsv",
  ".txt",
  ".xls",
  ".htm",
  ".html",
  ".xml",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
].join(",");

export function ReadStatementFile({
  onRead,
  testId,
}: {
  /** The file's table as tab-separated text, and the file's name. */
  onRead: (text: string, name: string) => void;
  testId?: string;
}) {
  const { t, msg: say } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  async function read(file: File) {
    setSaid(null);
    if (file.size > FILE_MAX) {
      setSaid({ ok: false, text: t("The file is over 10 MB: a statement's own file is smaller.") });
      return;
    }
    setBusy(true);
    try {
      const r = await readStatementFile(new Uint8Array(await file.arrayBuffer()));
      if (!r.ok) return setSaid({ ok: false, text: say(r.error) });
      onRead(r.text, file.name);
      setSaid({ ok: true, text: t("Read from {file}", { file: file.name }) });
    } catch {
      setSaid({
        ok: false,
        text: t("The file could not be read: save it again as .xlsx or CSV, and choose that."),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "…" : t("Read it from its file…")}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        aria-label={t("Read it from its file…")}
        data-testid={testId}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void read(f);
          e.target.value = "";
        }}
      />
      {said &&
        (said.ok ? (
          <span className="muted" style={{ fontSize: ".8rem" }} data-testid="file-read">
            {said.text}
          </span>
        ) : (
          <span className="red" style={{ fontSize: ".85rem" }} role="alert">
            {said.text}
          </span>
        ))}
    </span>
  );
}
