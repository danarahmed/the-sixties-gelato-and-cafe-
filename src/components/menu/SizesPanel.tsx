"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SalesChannel } from "@domain/sales/recipe.js";
import { addSizeAction, renameSizeAction, retireSizeAction } from "@/lib/actions/menu";
import type { MenuProduct, MenuVariant } from "@/lib/db/menu";
import { useT } from "@/lib/i18n/I18nProvider";
import { Field, Notice, inputStyle } from "@/components/ui";
import { useChannels } from "@/components/ChannelsProvider";
import {
  NoCostYet,
  RecipeLinesEditor,
  ServingCost,
  filledLines,
  halfFilled,
  newLine,
  type ItemOpt,
  type LineDraft,
} from "@/components/menu/RecipeLines";
import { OperationStatus, useOperation } from "@/components/useOperation";

type Msg = { ok: boolean; text: string } | null;

/** One size: renamed in the three languages, or taken off the till with a reason and brought back. */
function SizeRow({
  size,
  onlyOnSale,
  canEdit,
}: {
  size: MenuVariant;
  onlyOnSale: boolean;
  canEdit: boolean;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [mode, setMode] = useState<"none" | "rename" | "retire">("none");
  const [names, setNames] = useState({
    name: size.name,
    ar: size.nameAr ?? "",
    ckb: size.nameCkb ?? "",
  });
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function rename() {
    setMsg(null);
    start(async () => {
      const r = await op.run(`renameSize:${size.id}`, (key) =>
        renameSizeAction(
          { variantId: size.id, name: names.name, nameAr: names.ar, nameCkb: names.ckb },
          key,
        ),
      );
      if (r.ok) {
        setMode("none");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  function retire(retire: boolean) {
    setMsg(null);
    start(async () => {
      const r = await op.run(`retireSize:${size.id}`, (key) =>
        retireSizeAction({ variantId: size.id, retire, reason: retire ? reason : null }, key),
      );
      if (r.ok) {
        setMode("none");
        setReason("");
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <li className="size-row" data-testid="size-row" data-size={size.name}>
      <span className="size-name">
        <strong>{size.name}</strong>
        {(size.nameAr || size.nameCkb) && (
          <span className="muted">
            {" "}
            · {[size.nameAr, size.nameCkb].filter(Boolean).join(" · ")}
          </span>
        )}
        {!size.isActive && <span className="badge warn"> {t("Retired")}</span>}
      </span>
      {canEdit && mode === "none" && (
        <span className="size-actions">
          <button className="linklike" onClick={() => setMode("rename")} disabled={busy}>
            {t("Rename…")}
          </button>
          {size.isActive ? (
            !onlyOnSale && (
              <button className="linklike" onClick={() => setMode("retire")} disabled={busy}>
                {t("Retire…")}
              </button>
            )
          ) : (
            <button className="linklike" onClick={() => retire(false)} disabled={busy}>
              {t("Bring it back")}
            </button>
          )}
        </span>
      )}
      {mode === "rename" && (
        <span className="size-edit">
          <input
            aria-label={t("The size's name")}
            style={inputStyle}
            value={names.name}
            onChange={(e) => setNames({ ...names, name: e.target.value })}
          />
          <input
            aria-label="الاسم"
            style={inputStyle}
            dir="rtl"
            value={names.ar}
            onChange={(e) => setNames({ ...names, ar: e.target.value })}
          />
          <input
            aria-label="ناو"
            style={inputStyle}
            dir="rtl"
            value={names.ckb}
            onChange={(e) => setNames({ ...names, ckb: e.target.value })}
          />
          <button className="btn-primary" onClick={rename} disabled={busy}>
            {t("Save")}
          </button>
          <button onClick={() => setMode("none")} disabled={busy}>
            {t("Cancel")}
          </button>
        </span>
      )}
      {mode === "retire" && (
        <span className="size-edit">
          <input
            aria-label={t("Why it is retired")}
            style={inputStyle}
            value={reason}
            maxLength={300}
            placeholder={t("Why it is retired")}
            onChange={(e) => setReason(e.target.value)}
          />
          <button className="btn-primary" onClick={() => retire(true)} disabled={busy}>
            {t("Retire it")}
          </button>
          <button onClick={() => setMode("none")} disabled={busy}>
            {t("Cancel")}
          </button>
        </span>
      )}
      <OperationStatus op={op} />
      <Notice msg={msg} />
    </li>
  );
}

/**
 * A product's sizes (0041): each one renamed, retired or brought back, and a
 * new one added with its prices and what one serving uses — another size's
 * recipe copied, its own, or why it uses none. A retired size stays on the
 * sales it was in.
 */
export function SizesPanel({
  product,
  items,
  decimals,
  canEdit,
}: {
  product: MenuProduct;
  items: ItemOpt[];
  decimals: number;
  canEdit: boolean;
}) {
  const op = useOperation();
  const { t } = useT();
  const router = useRouter();
  const { set, name: channelName } = useChannels();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const onSale = product.variants.filter((v) => v.isActive);
  const soldAsBought = product.variants.some((v) => v.soldAsBought);
  // The one size, named like the product: it gets a name of its own as the second is added.
  const namesFirst = onSale.length === 1 && onSale[0]!.name === product.name;
  const [first, setFirst] = useState("");
  const [names, setNames] = useState({ name: "", ar: "", ckb: "" });
  const [prices, setPrices] = useState<Record<SalesChannel, string>>({});
  const [how, setHow] = useState<"copy" | "own" | "none">("copy");
  const [copyFrom, setCopyFrom] = useState(onSale[0]?.id ?? "");
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [noStock, setNoStock] = useState("");

  function begin() {
    setFirst(namesFirst ? t("Regular") : "");
    setNames({ name: "", ar: "", ckb: "" });
    setPrices({});
    setHow("copy");
    setCopyFrom(onSale[0]?.id ?? "");
    setLines([newLine()]);
    setNoStock("");
    setMsg(null);
    setOpen(true);
  }

  function save() {
    setMsg(null);
    if (how === "own") {
      const half = halfFilled(lines);
      if (half >= 0) {
        setMsg({
          ok: false,
          text: t("Line {n}: choose the ingredient and its quantity, or remove the line.", {
            n: half + 1,
          }),
        });
        return;
      }
    }
    start(async () => {
      const r = await op.run(`addSize:${product.id}`, (key) =>
        addSizeAction(
          {
            productId: product.id,
            name: names.name,
            nameAr: names.ar,
            nameCkb: names.ckb,
            prices: Object.fromEntries(
              set.inUse.map((c) => [c, (prices[c] ?? "").trim()]).filter(([, p]) => p !== ""),
            ),
            recipe: how === "own" ? filledLines(lines, set) : [],
            copyFrom: how === "copy" ? copyFrom || null : null,
            noStockReason: how === "none" ? noStock : null,
            renameExisting: namesFirst ? first : null,
          },
          key,
        ),
      );
      if (r.ok) {
        setOpen(false);
        setMsg({ ok: true, text: t("Added the size “{name}”.", { name: names.name.trim() }) });
        router.refresh();
      } else setMsg({ ok: false, text: r.error });
    });
  }

  return (
    <div className="sizes-panel" data-testid="sizes-panel">
      <h4 className="muted" style={{ margin: "0 0 6px" }}>
        {t("Sizes")}
      </h4>
      <ul className="size-list">
        {product.variants.map((v) => (
          <SizeRow
            key={v.id}
            size={v}
            onlyOnSale={v.isActive && onSale.length === 1}
            canEdit={canEdit}
          />
        ))}
      </ul>
      {!canEdit ? null : soldAsBought ? (
        <p className="pf-hint">
          {t("Sold as bought: another size is a product of its own, with its own stock item.")}
        </p>
      ) : !open ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={begin} data-testid="size-add" style={{ fontSize: ".85rem" }}>
            {t("+ Add a size")}
          </button>
          <OperationStatus op={op} />
          <Notice msg={msg} />
        </div>
      ) : (
        <div className="pf-change grid" style={{ gap: 10 }} data-testid="size-form">
          {namesFirst && (
            <Field label={t("The size sold now is called")}>
              <input
                style={inputStyle}
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                aria-label={t("The size sold now is called")}
              />
            </Field>
          )}
          <div className="pf-names">
            <Field label={t("New size (English)")}>
              <input
                style={inputStyle}
                value={names.name}
                placeholder={t("e.g. Large")}
                onChange={(e) => setNames({ ...names, name: e.target.value })}
                aria-label={t("New size (English)")}
              />
            </Field>
            <Field label="الاسم">
              <input
                style={inputStyle}
                dir="rtl"
                value={names.ar}
                onChange={(e) => setNames({ ...names, ar: e.target.value })}
              />
            </Field>
            <Field label="ناو">
              <input
                style={inputStyle}
                dir="rtl"
                value={names.ckb}
                onChange={(e) => setNames({ ...names, ckb: e.target.value })}
              />
            </Field>
          </div>
          <div className="muted" style={{ fontSize: ".85rem" }}>
            {t("Prices (IQD)")}
          </div>
          <div className="pf-prices">
            {set.inUse.map((c) => (
              <Field key={c} label={channelName(c)}>
                <input
                  style={inputStyle}
                  inputMode="decimal"
                  value={prices[c] ?? ""}
                  aria-label={`${t("Price")} · ${channelName(c)}`}
                  onChange={(e) => setPrices({ ...prices, [c]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <fieldset className="size-recipe">
            <legend className="muted">{t("What one serving of the size uses")}</legend>
            <label>
              <input type="radio" checked={how === "copy"} onChange={() => setHow("copy")} />{" "}
              {t("The recipe of")}{" "}
              <select
                aria-label={t("The recipe of")}
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                disabled={how !== "copy"}
              >
                {onSale.map((v) => (
                  <option key={v.id} value={v.id}>
                    {namesFirst && v.name === product.name && first.trim() ? first.trim() : v.name}
                  </option>
                ))}
              </select>{" "}
              <span className="muted">{t("(change it afterwards, below)")}</span>
            </label>
            <label>
              <input type="radio" checked={how === "own"} onChange={() => setHow("own")} />{" "}
              {t("Its own recipe")}
            </label>
            {how === "own" && (
              <>
                <RecipeLinesEditor
                  items={items}
                  lines={lines}
                  onChange={setLines}
                  decimals={decimals}
                  channels
                />
                <ServingCost lines={lines} items={items} decimals={decimals} />
                <NoCostYet lines={lines} items={items} />
              </>
            )}
            <label>
              <input type="radio" checked={how === "none"} onChange={() => setHow("none")} />{" "}
              {t("It uses no stock, because")}{" "}
              <input
                aria-label={t("Why it uses no stock")}
                value={noStock}
                maxLength={200}
                disabled={how !== "none"}
                onChange={(e) => setNoStock(e.target.value)}
              />
            </label>
          </fieldset>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={save} disabled={busy} data-testid="size-save">
              {busy ? t("Saving…") : t("Add the size")}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy}>
              {t("Cancel")}
            </button>
            <OperationStatus op={op} />
            <Notice msg={msg} />
          </div>
        </div>
      )}
    </div>
  );
}
