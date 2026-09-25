"use client";
/**
 * The café's delivery platforms (0031), each with its names, whether it is in
 * use, how many products the till can sell on it and how many of its orders
 * wait to be paid out. The owner or the general manager adds one, with its
 * packaging (and prices) copied from a channel it works like, renames it,
 * takes it out of use and brings it back.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPlatformAction,
  copyPlatformSetupAction,
  updatePlatformAction,
} from "@/lib/actions/platforms";
import type { PlatformInfo } from "@/lib/settlements";
import { useT } from "@/lib/i18n/I18nProvider";
import { useChannels } from "@/components/ChannelsProvider";
import { Field, Notice, inputStyle } from "@/components/ui";

type Msg = { ok: boolean; text: string } | null;
type Names = Record<string, string>;

/** The channel a new platform most likely works like: Talabat, else takeaway. */
function likeDefault(inUse: string[]): string {
  return inUse.includes("talabat") ? "talabat" : inUse.includes("takeaway") ? "takeaway" : "";
}

export function PlatformsManager({
  platforms,
  canManage,
}: {
  platforms: PlatformInfo[];
  /** settings.manage: the owner and the general manager. */
  canManage: boolean;
}) {
  const { t } = useT();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <div className="panel-b grid" style={{ gap: 12 }}>
      <Notice msg={msg} />
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>{t("plat.col.platform")}</th>
              <th>{t("plat.col.status")}</th>
              <th className="right">{t("plat.col.priced")}</th>
              <th className="right">{t("plat.col.waiting")}</th>
            </tr>
          </thead>
          <tbody>
            {platforms.map((p) => (
              <PlatformRow key={p.code} platform={p} canManage={canManage} onDone={setMsg} />
            ))}
          </tbody>
        </table>
      </div>
      {canManage ? (
        <AddPlatform onDone={setMsg} />
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
          {t("plat.onlyOwner")}
        </p>
      )}
    </div>
  );
}

function OtherNames({
  names,
  onChange,
  disabled,
}: {
  names: Names;
  onChange: (n: Names) => void;
  disabled: boolean;
}) {
  // Every language of the café's but English: the one its customers know it by.
  const { t, languages } = useT();
  return (
    <>
      {languages
        .filter((l) => l.code !== "en")
        .map((l) => (
          <Field key={l.code} label={t("plat.form.nameIn", { language: l.label })}>
            <input
              style={inputStyle}
              dir={l.dir}
              lang={l.code}
              value={names[l.code] ?? ""}
              maxLength={60}
              disabled={disabled}
              onChange={(e) => onChange({ ...names, [l.code]: e.target.value })}
            />
          </Field>
        ))}
    </>
  );
}

function PlatformRow({
  platform: p,
  canManage,
  onDone,
}: {
  platform: PlatformInfo;
  canManage: boolean;
  onDone: (m: Msg) => void;
}) {
  const { t } = useT();
  const { set, name: channelName } = useChannels();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState<"edit" | "retire" | "copy" | null>(null);
  const [name, setName] = useState(p.name);
  const [names, setNames] = useState<Names>(p.names);
  const likes = set.inUse.filter((c) => c !== p.code);
  const [like, setLike] = useState(likeDefault(likes));
  const [copyPrices, setCopyPrices] = useState(true);
  const shown = channelName(p.code);
  const also = [p.name, ...Object.values(p.names)].filter(
    (n, i, all) => n !== shown && all.indexOf(n) === i,
  );

  /** Saved as edited, or as it is, taken out of use or brought back. */
  function update(change: { name: string; names: Names; active: boolean }, done: string) {
    onDone(null);
    start(async () => {
      const r = await updatePlatformAction({ code: p.code, ...change });
      if (!r.ok) return onDone({ ok: false, text: r.error });
      onDone({ ok: true, text: done });
      setOpen(null);
      router.refresh();
    });
  }

  function copy() {
    onDone(null);
    start(async () => {
      const r = await copyPlatformSetupAction({ code: p.code, like, copyPrices });
      if (!r.ok) return onDone({ ok: false, text: r.error });
      onDone({
        ok: true,
        text: t("plat.copied")
          .replace("{prices}", String(r.data.prices))
          .replace("{lines}", String(r.data.lines)),
      });
      setOpen(null);
      router.refresh();
    });
  }

  return (
    <tr
      data-testid="platform-row"
      data-code={p.code}
      style={p.active ? undefined : { opacity: 0.7 }}
    >
      <td>
        <strong>{shown}</strong>{" "}
        <span className="muted mono" style={{ fontSize: ".75rem" }}>
          {p.code}
        </span>
        {also.length > 0 && (
          <div className="muted" style={{ fontSize: ".8rem" }}>
            {also.join(" · ")}
          </div>
        )}
        {canManage && open === null && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBlockStart: 6 }}>
            <button
              disabled={busy}
              onClick={() => {
                setName(p.name);
                setNames(p.names);
                setOpen("edit");
              }}
            >
              {t("plat.edit")}
            </button>
            {p.active ? (
              <>
                <button disabled={busy || likes.length === 0} onClick={() => setOpen("copy")}>
                  {t("plat.copy")}
                </button>
                <button disabled={busy} onClick={() => setOpen("retire")}>
                  {t("plat.retire")}
                </button>
              </>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  update(
                    { name: p.name, names: p.names, active: true },
                    t("plat.restored").replace("{name}", shown),
                  )
                }
              >
                {t("plat.restore")}
              </button>
            )}
          </div>
        )}
        {open === "edit" && (
          <div className="grid" style={{ gap: 8, marginBlockStart: 8, maxWidth: 420 }}>
            <Field label={t("plat.form.name")}>
              <input
                style={inputStyle}
                value={name}
                maxLength={60}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <OtherNames names={names} onChange={setNames} disabled={busy} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn-primary"
                disabled={busy || !name.trim()}
                onClick={() => update({ name, names, active: p.active }, t("plat.saved"))}
              >
                {t("plat.save")}
              </button>
              <button disabled={busy} onClick={() => setOpen(null)}>
                {t("plat.cancel")}
              </button>
            </div>
          </div>
        )}
        {open === "retire" && (
          <div className="grid" style={{ gap: 8, marginBlockStart: 8, maxWidth: 420 }}>
            <span style={{ fontSize: ".85rem" }}>
              {t("plat.retire.confirm").replace("{name}", shown)}
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                disabled={busy}
                onClick={() =>
                  update(
                    { name: p.name, names: p.names, active: false },
                    t("plat.retired").replace("{name}", shown),
                  )
                }
              >
                {t("plat.retire.do")}
              </button>
              <button disabled={busy} onClick={() => setOpen(null)}>
                {t("plat.keep")}
              </button>
            </div>
          </div>
        )}
        {open === "copy" && (
          <div className="grid" style={{ gap: 8, marginBlockStart: 8, maxWidth: 420 }}>
            <Field label={t("plat.form.like")}>
              <select
                style={inputStyle}
                value={like}
                disabled={busy}
                onChange={(e) => setLike(e.target.value)}
              >
                {likes.map((c) => (
                  <option key={c} value={c}>
                    {channelName(c)}
                  </option>
                ))}
              </select>
            </Field>
            <label style={{ fontSize: ".85rem", display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                className="check"
                checked={copyPrices}
                disabled={busy}
                onChange={(e) => setCopyPrices(e.target.checked)}
              />
              {t("plat.form.copyPrices")}
            </label>
            <span className="muted" style={{ fontSize: ".8rem" }}>
              {t("plat.copy.hint")}
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-primary" disabled={busy || !like} onClick={copy}>
                {t("plat.copy.do")}
              </button>
              <button disabled={busy} onClick={() => setOpen(null)}>
                {t("plat.cancel")}
              </button>
            </div>
          </div>
        )}
      </td>
      <td>
        <span className={`badge ${p.active ? "ok" : ""}`}>
          {p.active ? t("plat.inUse") : t("plat.notInUse")}
        </span>
      </td>
      <td className="right">
        <span className="mono" data-testid="platform-priced">
          {p.priced}
        </span>
        {p.active && p.priced === 0 && (
          <div className="muted" style={{ fontSize: ".75rem" }}>
            {t("plat.noPrices")}
          </div>
        )}
      </td>
      <td className="right mono">{p.waiting}</td>
    </tr>
  );
}

function AddPlatform({ onDone }: { onDone: (m: Msg) => void }) {
  const { t } = useT();
  const { set, name: channelName } = useChannels();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [names, setNames] = useState<Names>({});
  const [code, setCode] = useState("");
  const [like, setLike] = useState(likeDefault(set.inUse));
  const [copyPrices, setCopyPrices] = useState(true);

  function add() {
    onDone(null);
    start(async () => {
      const r = await addPlatformAction({ name, names, code, like: like || null, copyPrices });
      if (!r.ok) return onDone({ ok: false, text: r.error });
      const d = r.data;
      const parts = [t("plat.added").replace("{name}", d.name)];
      if (d.setupError) parts.push(t("plat.setupFailed").replace("{error}", d.setupError));
      else if (like)
        parts.push(
          t("plat.copied")
            .replace("{prices}", String(d.prices))
            .replace("{lines}", String(d.lines)),
        );
      onDone({ ok: d.setupError === null, text: parts.join(" ") });
      setName("");
      setNames({});
      setCode("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        className="btn-primary"
        style={{ justifySelf: "start" }}
        onClick={() => setOpen(true)}
      >
        {t("plat.add")}
      </button>
    );
  }
  return (
    <div className="card grid" style={{ gap: 10, maxWidth: 560 }} data-testid="add-platform">
      <strong>{t("plat.add.title")}</strong>
      <Field label={t("plat.form.name")}>
        <input
          style={inputStyle}
          value={name}
          maxLength={60}
          placeholder="Lezzoo" // i18n-ignore: an example name
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <OtherNames names={names} onChange={setNames} disabled={busy} />
      <Field label={t("plat.form.like")}>
        <select
          style={inputStyle}
          value={like}
          disabled={busy}
          onChange={(e) => setLike(e.target.value)}
        >
          {set.inUse.map((c) => (
            <option key={c} value={c}>
              {channelName(c)}
            </option>
          ))}
          <option value="">{t("plat.form.likeNone")}</option>
        </select>
      </Field>
      {like && (
        <label style={{ fontSize: ".85rem", display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            className="check"
            checked={copyPrices}
            disabled={busy}
            onChange={(e) => setCopyPrices(e.target.checked)}
          />
          {t("plat.form.copyPrices")}
        </label>
      )}
      <details>
        <summary className="muted" style={{ fontSize: ".85rem" }}>
          {t("plat.form.code")}
        </summary>
        <div className="grid" style={{ gap: 4, marginBlockStart: 6 }}>
          <input
            aria-label={t("plat.form.code")}
            style={{ ...inputStyle, maxWidth: 240 }}
            className="mono"
            dir="ltr"
            value={code}
            maxLength={30}
            placeholder="lezzoo" // i18n-ignore: an example code
            disabled={busy}
            onChange={(e) => setCode(e.target.value)}
          />
          <span className="muted" style={{ fontSize: ".8rem" }}>
            {t("plat.form.codeHint")}
          </span>
        </div>
      </details>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn-primary" disabled={busy || !name.trim()} onClick={add}>
          {busy ? "…" : t("plat.add.do")}
        </button>
        <button disabled={busy} onClick={() => setOpen(false)}>
          {t("plat.cancel")}
        </button>
      </div>
    </div>
  );
}
