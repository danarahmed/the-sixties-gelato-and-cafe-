"use client";
/**
 * Settings → Languages (0032): the café's languages — the three built in and
 * any the owner added, each renamed, taken out of use or brought back — a
 * language added, and the words of one language, phrase by phrase: typed on
 * screen, or downloaded as a CSV for a translator and uploaded again.
 */
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveLanguageAction, savePhrasesAction } from "@/lib/actions/languages";
import { useT } from "@/lib/i18n/I18nProvider";
import { parseCsv, toCsv } from "@/lib/csv";
import { Field, Notice, inputStyle } from "@/components/ui";

type Msg = { ok: boolean; text: string } | null;

export interface LanguageRow {
  code: string;
  /** Its name, written in itself. */
  name: string;
  dir: "ltr" | "rtl";
  builtIn: boolean;
  isActive: boolean;
  /** How many phrases have the café's own words in it. */
  ownWords: number;
}

/** A phrase: its key, its English when the key is not the English, its built-in words. */
interface Entry {
  k: string;
  e?: string;
  b?: string;
}

const PAGE = 40;

export function LanguagesManager({
  languages,
  editing,
  entries,
  own,
}: {
  languages: LanguageRow[];
  editing: string;
  entries: Entry[];
  own: Record<string, string>;
}) {
  const { t } = useT();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <>
      <div className="card grid" style={{ gap: 12 }}>
        <h3 style={{ margin: 0 }}>{t("The café's languages")}</h3>
        <Notice msg={msg} />
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>{t("Language")}</th>
                <th>{t("Code")}</th>
                <th>{t("Written")}</th>
                <th>{t("Status")}</th>
                <th className="right">{t("The café's own words")}</th>
              </tr>
            </thead>
            <tbody>
              {languages.map((l) => (
                <LanguageLine key={l.code} language={l} editing={editing} onDone={setMsg} />
              ))}
            </tbody>
          </table>
        </div>
        <AddLanguage onDone={setMsg} />
      </div>
      <Words key={editing} languages={languages} editing={editing} entries={entries} own={own} />
    </>
  );
}

function LanguageLine({
  language: l,
  editing,
  onDone,
}: {
  language: LanguageRow;
  editing: string;
  onDone: (m: Msg) => void;
}) {
  const { t, msg } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(l.name);
  const [dir, setDir] = useState(l.dir);

  const save = (active: boolean, next = { name, dir }) =>
    start(async () => {
      const r = await saveLanguageAction({ code: l.code, name: next.name, dir: next.dir, active });
      if (!r.ok) return onDone({ ok: false, text: msg(r.error) });
      setOpen(false);
      onDone({
        ok: true,
        text: active
          ? t("{language} is saved.", { language: next.name })
          : t("{language} is out of use: it leaves the language menu, and its words are kept.", {
              language: next.name,
            }),
      });
      router.refresh();
    });

  return (
    <tr data-testid={`language-${l.code}`}>
      <td>
        <strong dir={l.dir} lang={l.code}>
          {l.name}
        </strong>
        {!l.builtIn && l.isActive && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            <button disabled={busy} onClick={() => setOpen(!open)}>
              {t("Edit…")}
            </button>
            <button disabled={busy} onClick={() => save(false)}>
              {t("Take out of use")}
            </button>
          </div>
        )}
        {!l.builtIn && !l.isActive && (
          <div style={{ marginTop: 6 }}>
            <button disabled={busy} onClick={() => save(true)}>
              {t("Bring back")}
            </button>
          </div>
        )}
        {open && (
          <div className="grid" style={{ gap: 8, marginTop: 8, maxWidth: 360 }}>
            <Field label={t("Name, as its speakers write it")}>
              <input
                style={inputStyle}
                dir={dir}
                lang={l.code}
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label={t("Written")}>
              <select
                style={inputStyle}
                value={dir}
                onChange={(e) => setDir(e.target.value === "rtl" ? "rtl" : "ltr")}
              >
                <option value="ltr">{t("Left to right")}</option>
                <option value="rtl">{t("Right to left")}</option>
              </select>
            </Field>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" disabled={busy} onClick={() => save(true)}>
                {busy ? t("Saving…") : t("Save")}
              </button>
              <button disabled={busy} onClick={() => setOpen(false)}>
                {t("Cancel")}
              </button>
            </div>
          </div>
        )}
      </td>
      <td>
        <code>{l.code}</code>
      </td>
      <td>{l.dir === "rtl" ? t("Right to left") : t("Left to right")}</td>
      <td>
        {l.builtIn ? (
          <span className="badge">{t("Built in")}</span>
        ) : l.isActive ? (
          <span className="badge ok">{t("In use")}</span>
        ) : (
          <span className="badge">{t("Not in use")}</span>
        )}
      </td>
      <td className="right">
        {l.isActive && l.code !== editing ? (
          <Link href={`/settings/languages?lang=${l.code}#words`}>{l.ownWords}</Link>
        ) : (
          l.ownWords
        )}
      </td>
    </tr>
  );
}

function AddLanguage({ onDone }: { onDone: (m: Msg) => void }) {
  const { t, msg } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");

  const add = () =>
    start(async () => {
      const r = await saveLanguageAction({ code, name, dir, active: true });
      if (!r.ok) return onDone({ ok: false, text: msg(r.error) });
      onDone({
        ok: true,
        text: t(
          "{language} is added: it is in the language menu now. Give its words below; a phrase with none shows in English.",
          { language: name.trim() },
        ),
      });
      setCode("");
      setName("");
      setDir("ltr");
      router.push(`/settings/languages?lang=${r.data.code}#words`);
      router.refresh();
    });

  return (
    <div
      className="grid"
      data-testid="add-language"
      style={{ gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}
    >
      <h4 style={{ margin: 0 }}>{t("Add a language")}</h4>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "The code is the language's short international name: tr for Turkish, fa for Persian, kmr for Kurmanji Kurdish.",
        )}
      </p>
      <div
        className="grid"
        style={{ gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
      >
        <Field label={t("Code")}>
          <input
            style={inputStyle}
            dir="ltr"
            value={code}
            maxLength={12}
            placeholder="tr" // i18n-ignore: a language code is written the same in every language
            aria-label={t("Code")}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <Field label={t("Name, as its speakers write it")}>
          <input
            style={inputStyle}
            dir={dir}
            value={name}
            maxLength={40}
            placeholder="Türkçe" // i18n-ignore: a language's own name
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t("Written")}>
          <select
            style={inputStyle}
            value={dir}
            onChange={(e) => setDir(e.target.value === "rtl" ? "rtl" : "ltr")}
          >
            <option value="ltr">{t("Left to right")}</option>
            <option value="rtl">{t("Right to left")}</option>
          </select>
        </Field>
      </div>
      <div>
        <button
          className="btn-primary"
          disabled={busy || !code.trim() || !name.trim()}
          onClick={add}
        >
          {busy ? t("Saving…") : t("Add the language")}
        </button>
      </div>
    </div>
  );
}

type Show = "all" | "missing" | "own";

function Words({
  languages,
  editing,
  entries,
  own,
}: {
  languages: LanguageRow[];
  editing: string;
  entries: Entry[];
  own: Record<string, string>;
}) {
  const { t, msg } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [notice, setNotice] = useState<Msg>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [page, setPage] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const lang = languages.find((l) => l.code === editing)!;
  const hasBuiltIn = editing === "ar" || editing === "ckb";

  const current = (k: string) => edited[k] ?? own[k] ?? "";
  const english = (x: Entry) => x.e ?? x.k;
  const changes = Object.entries(edited).filter(([k, v]) => v.trim() !== (own[k] ?? ""));
  const translated = entries.filter((x) => own[x.k] || x.b).length;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((x) => {
      const words = edited[x.k] ?? own[x.k] ?? "";
      if (show === "own" && !own[x.k] && !edited[x.k]) return false;
      if (show === "missing" && (words.trim() || x.b)) return false;
      if (!q) return true;
      return [x.k, x.e ?? "", x.b ?? "", words].some((s) => s.toLowerCase().includes(q));
    });
  }, [entries, own, edited, query, show]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = list.slice(at * PAGE, at * PAGE + PAGE);

  const save = () =>
    start(async () => {
      let set = 0;
      let cleared = 0;
      const all = changes;
      for (let i = 0; i < all.length; i += 2000) {
        const r = await savePhrasesAction(editing, Object.fromEntries(all.slice(i, i + 2000)));
        if (!r.ok) return setNotice({ ok: false, text: msg(r.error) });
        set += r.data.set;
        cleared += r.data.cleared;
      }
      setEdited({});
      setNotice({
        ok: true,
        text: t("Saved: {set} phrase(s) with new words, {cleared} back to the built-in words.", {
          set,
          cleared,
        }),
      });
      router.refresh();
    });

  const download = () => {
    const rows = entries.map((x) => [x.k, english(x), x.b ?? "", current(x.k)]);
    // i18n-ignore: the columns of the file, read back by name on upload
    const blob = new Blob([toCsv(["key", "english", "built_in", "words"], rows)], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `words-${editing}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (f: File) => {
    const rows = parseCsv(await f.text());
    const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
    const keyAt = head.indexOf("key");
    const wordsAt = head.indexOf("words");
    if (keyAt < 0 || wordsAt < 0)
      return setNotice({
        ok: false,
        text: t("The file needs a key column and a words column, as the downloaded file has."),
      });
    const known = new Set(entries.map((x) => x.k));
    const next: Record<string, string> = { ...edited };
    let read = 0;
    for (const r of rows.slice(1)) {
      const k = r[keyAt] ?? "";
      if (!known.has(k)) continue;
      const w = (r[wordsAt] ?? "").trim();
      if (w === (own[k] ?? "")) continue;
      next[k] = w;
      read++;
    }
    setEdited(next);
    setShow("all");
    setPage(0);
    setNotice({
      ok: true,
      text: t("Read {n} phrase(s) with new words from the file. Check them, then save.", {
        n: read,
      }),
    });
  };

  return (
    <div className="card grid" id="words" style={{ gap: 12 }}>
      <h3 style={{ margin: 0 }}>{t("Words in {language}", { language: lang.name })}</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {languages
          .filter((l) => l.isActive)
          .map((l) =>
            l.code === editing ? (
              <span key={l.code} className="badge ok">
                {l.name}
              </span>
            ) : (
              <Link
                key={l.code}
                className="badge"
                href={`/settings/languages?lang=${l.code}#words`}
              >
                {l.name}
              </Link>
            ),
          )}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {editing === "en"
          ? t(
              "The English is each phrase itself; words given here are shown instead of it, to every reader in English.",
            )
          : hasBuiltIn
            ? t(
                "{language} is built in: {own} phrase(s) have the café's own words instead of the built-in ones.",
                { language: lang.name, own: Object.keys(own).length },
              )
            : t("{done} of {total} phrases have words in {language}; the rest show in English.", {
                done: translated,
                total: entries.length,
                language: lang.name,
              })}
      </p>
      <Notice msg={notice} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
        <Field label={t("Search")} style={{ flex: "1 1 220px" }}>
          <input
            style={inputStyle}
            value={query}
            placeholder={t("The English, or the words")}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </Field>
        <Field label={t("Show")} style={{ flex: "0 1 220px" }}>
          <select
            style={inputStyle}
            value={show}
            onChange={(e) => {
              setShow(e.target.value as Show);
              setPage(0);
            }}
          >
            <option value="all">{t("Every phrase")}</option>
            {editing !== "en" && <option value="missing">{t("Phrases with no words yet")}</option>}
            <option value="own">{t("The café's own words")}</option>
          </select>
        </Field>
        <button type="button" onClick={download}>
          {t("Download CSV")}
        </button>
        <button type="button" onClick={() => file.current?.click()}>
          {t("Upload CSV")}
        </button>
        <input
          ref={file}
          type="file"
          accept=".csv,text/csv"
          hidden
          aria-label={t("Upload CSV")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <button className="btn-primary" disabled={busy || changes.length === 0} onClick={save}>
          {busy ? t("Saving…") : t("Save {n} change(s)", { n: changes.length })}
        </button>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th style={{ width: hasBuiltIn ? "34%" : "45%" }}>{t("English")}</th>
              {hasBuiltIn && <th style={{ width: "30%" }}>{t("Built in")}</th>}
              <th>{t("The café's words")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.k}>
                <td dir="ltr" lang="en" style={{ whiteSpace: "pre-wrap" }}>
                  {english(x)}
                  {x.e !== undefined && (
                    <div className="muted" style={{ fontSize: ".75rem" }}>
                      <code>{x.k}</code>
                    </div>
                  )}
                </td>
                {hasBuiltIn && (
                  <td dir={lang.dir} lang={editing} style={{ whiteSpace: "pre-wrap" }}>
                    {x.b ?? "—"}
                  </td>
                )}
                <td>
                  <textarea
                    style={{ ...inputStyle, minHeight: 44, paddingTop: 10, resize: "vertical" }}
                    dir={lang.dir}
                    lang={editing}
                    rows={1}
                    value={current(x.k)}
                    placeholder={x.b ?? english(x)}
                    aria-label={t("Words for: {phrase}", { phrase: english(x) })}
                    onChange={(e) => setEdited({ ...edited, [x.k]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button disabled={at === 0} onClick={() => setPage(at - 1)}>
          {t("Previous")}
        </button>
        <span className="muted" style={{ fontSize: ".85rem" }}>
          {t("Page {page} of {pages} · {n} phrase(s)", { page: at + 1, pages, n: list.length })}
        </span>
        <button disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>
          {t("Next")}
        </button>
      </div>
    </div>
  );
}
