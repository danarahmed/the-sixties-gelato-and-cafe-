"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { OperationStatus, useOperation } from "@/components/useOperation";
import { attachDocumentAction, prepareDocumentAction } from "@/lib/actions/documents";
import {
  DOCUMENT_NOTE_MAX,
  DOCUMENT_TYPES,
  SHRINK,
  fileProblem,
  shouldShrink,
  shrunkSize,
  sizeLabel,
  type DocumentKind,
} from "@/lib/documents";

/**
 * A picture over 1.5 MB, made smaller in the browser before it is sent: its
 * longer side at most 2,000 pixels, as a JPEG. Null when the browser cannot
 * open it.
 */
async function shrink(file: File): Promise<Blob | null> {
  try {
    const picture = await createImageBitmap(file);
    const { width, height } = shrunkSize(picture.width, picture.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(picture, 0, 0, width, height);
    picture.close();
    return await new Promise((done) => canvas.toBlob(done, "image/jpeg", SHRINK.quality));
  } catch {
    return null;
  }
}

/**
 * A photo taken there and then, or a picture or a PDF chosen, attached to the
 * record: it goes straight to Storage through a link made for this person, and
 * is then attached, once, however the connection behaves.
 */
export function AttachDocument({ kind, record }: { kind: DocumentKind; record: string }) {
  const { t } = useT();
  const router = useRouter();
  const op = useOperation();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  // A file already sent whose attaching had no answer: pressed again, it is
  // attached with the same key, not sent a second time.
  const sent = useRef<{ file: File; path: string } | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const chooser = useRef<HTMLInputElement>(null);

  function choose(f: File | undefined) {
    setNotice(null);
    setFile(f ?? null);
    if (f && !name.trim()) setName(f.name);
  }

  async function send(f: File): Promise<string | null> {
    if (sent.current?.file === f) return sent.current.path;
    let body: Blob = f;
    let type = f.type;
    if (shouldShrink(type, f.size)) {
      const smaller = await shrink(f);
      if (smaller && smaller.size < f.size) {
        body = smaller;
        type = "image/jpeg";
      } else if (!smaller && f.size > 10 * 1024 * 1024) {
        setNotice({ ok: false, text: t("That file is not a picture this browser can open.") });
        return null;
      }
    }
    const problem = fileProblem(type, body.size);
    if (problem) {
      setNotice({ ok: false, text: problem });
      return null;
    }
    const link = await prepareDocumentAction(kind, record, type, body.size);
    if (!link.ok) {
      setNotice({ ok: false, text: link.error });
      return null;
    }
    const put = await fetch(link.data.url, {
      method: "PUT",
      body,
      headers: {
        apikey: link.data.apikey,
        "content-type": type,
        "cache-control": "max-age=3600",
        "x-upsert": "false",
      },
    }).catch(() => null);
    if (!put?.ok) {
      setNotice({ ok: false, text: t("The file could not be sent: try again") });
      return null;
    }
    sent.current = { file: f, path: link.data.path };
    return link.data.path;
  }

  async function attach() {
    if (!file) {
      setNotice({ ok: false, text: t("Take a photo or choose a file first") });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const path = await send(file);
      if (!path) return;
      const r = await op.run("attach", (key) =>
        attachDocumentAction({ kind, record, path, fileName: file.name, typed: name, note }, key),
      );
      if (!r.ok) {
        setNotice({ ok: false, text: r.error });
        return;
      }
      sent.current = null;
      setFile(null);
      setName("");
      setNote("");
      if (camera.current) camera.current.value = "";
      if (chooser.current) chooser.current.value = "";
      setNotice({ ok: true, text: t("Attached: {name}", { name: r.data.fileName }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const size = file ? sizeLabel(file.size) : null;
  return (
    <div className="grid" style={{ gap: 12, maxWidth: 560 }} data-testid="attach-document">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* On a phone the first opens the camera; on a computer both choose a file. */}
        <button type="button" onClick={() => camera.current?.click()} disabled={busy}>
          📷 {t("Take a photo")}
        </button>
        <button type="button" onClick={() => chooser.current?.click()} disabled={busy}>
          📄 {t("Choose a picture or a PDF")}
        </button>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          aria-label={t("Take a photo")}
          onChange={(e) => choose(e.target.files?.[0])}
          data-testid="document-camera"
        />
        <input
          ref={chooser}
          type="file"
          accept={DOCUMENT_TYPES.join(",")}
          hidden
          aria-label={t("Choose a picture or a PDF")}
          onChange={(e) => choose(e.target.files?.[0])}
          data-testid="document-file"
        />
      </div>
      {file && size && (
        <p
          className="muted"
          style={{ margin: 0, fontSize: ".85rem" }}
          data-testid="document-chosen"
        >
          {file.name} · {t(size.phrase, { n: size.n })}
        </p>
      )}
      <Field label={t("Name")}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          style={inputStyle}
          data-testid="document-name"
        />
      </Field>
      <Field label={t("Note (optional)")}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={DOCUMENT_NOTE_MAX}
          style={inputStyle}
          data-testid="document-note"
        />
      </Field>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={attach}
          disabled={busy || !file}
          data-testid="document-attach"
        >
          {busy ? t("Sending…") : t("Attach")}
        </button>
        <OperationStatus op={op} />
      </div>
      <Notice msg={notice} />
    </div>
  );
}
