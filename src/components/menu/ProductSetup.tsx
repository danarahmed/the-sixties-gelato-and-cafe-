"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearProductImageAction,
  setProductDetailsAction,
  setProductImageAction,
} from "@/lib/actions/menu";
import type { MenuCategory, MenuProduct } from "@/lib/db/menu";
import { useT } from "@/lib/i18n/I18nProvider";
import { ProductThumb } from "@/components/pos/ProductPicker";
import { Notice } from "@/components/ui";
import { shrinkPhoto } from "./photo";

/**
 * How a product appears on the till: its photo, its names in the three
 * languages, its category, whether the till offers it at all, and whether
 * it is one of the favourites the till shows first.
 */
export function ProductSetup({
  product,
  categories,
  canEdit,
}: {
  product: MenuProduct;
  categories: MenuCategory[];
  canEdit: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [d, setD] = useState({
    name: product.name,
    nameAr: product.nameAr ?? "",
    nameCkb: product.nameCkb ?? "",
    categoryId: product.categoryId ?? "",
    isActive: product.isActive,
    isFavourite: product.isFavourite,
  });
  const dirty =
    d.name !== product.name ||
    d.nameAr !== (product.nameAr ?? "") ||
    d.nameCkb !== (product.nameCkb ?? "") ||
    d.categoryId !== (product.categoryId ?? "") ||
    d.isActive !== product.isActive ||
    d.isFavourite !== product.isFavourite;
  const busy = pending || photoBusy;

  function save() {
    setMsg(null);
    start(async () => {
      const r = await setProductDetailsAction({
        productId: product.id,
        name: d.name,
        nameAr: d.nameAr || null,
        nameCkb: d.nameCkb || null,
        categoryId: d.categoryId || null,
        isActive: d.isActive,
        isFavourite: d.isFavourite,
      });
      setMsg(r.ok ? { ok: true, text: t("Saved.") } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  async function upload(f: File) {
    setMsg(null);
    setPhotoBusy(true);
    try {
      const photo = await shrinkPhoto(f);
      const r = await setProductImageAction({ productId: product.id, ...photo });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: t("Photo saved: the till shows it now.") });
        router.refresh();
      }
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof Error ? e.message : t("The picture could not be prepared."),
      });
    } finally {
      setPhotoBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  function removePhoto() {
    setMsg(null);
    start(async () => {
      const r = await clearProductImageAction({ productId: product.id });
      setMsg(r.ok ? { ok: true, text: t("Photo removed.") } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="product-setup">
      <div className="setup-photo">
        <ProductThumb
          name={product.name}
          imageUrl={product.imageUrl}
          seed={product.categoryId ?? product.id}
        />
        {canEdit && (
          <>
            <button onClick={() => file.current?.click()} disabled={busy}>
              {photoBusy ? "…" : product.imageUrl ? t("Change photo") : t("Add photo")}
            </button>
            {product.imageUrl && (
              <button className="linklike" onClick={removePhoto} disabled={busy}>
                {t("Remove photo")}
              </button>
            )}
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              hidden
              aria-label={t("Photo of {name}", { name: product.name })}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
          </>
        )}
      </div>
      <div className="grid" style={{ gap: 8 }}>
        <div className="setup-fields">
          <label>
            <span className="muted">{t("Name")}</span>
            <input
              value={d.name}
              maxLength={120}
              disabled={!canEdit}
              onChange={(e) => setD({ ...d, name: e.target.value })}
            />
          </label>
          <label>
            <span className="muted">العربية</span>
            <input
              dir="rtl"
              value={d.nameAr}
              maxLength={120}
              disabled={!canEdit}
              onChange={(e) => setD({ ...d, nameAr: e.target.value })}
            />
          </label>
          <label>
            <span className="muted">کوردی</span>
            <input
              dir="rtl"
              value={d.nameCkb}
              maxLength={120}
              disabled={!canEdit}
              onChange={(e) => setD({ ...d, nameCkb: e.target.value })}
            />
          </label>
          <label>
            <span className="muted">{t("Category")}</span>
            <select
              value={d.categoryId}
              disabled={!canEdit}
              onChange={(e) => setD({ ...d, categoryId: e.target.value })}
            >
              <option value="">{t("— none —")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isActive ? c.name : t("{name} (hidden)", { name: c.name })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="setup-flags">
          <label>
            <input
              type="checkbox"
              className="check"
              checked={d.isActive}
              disabled={!canEdit}
              onChange={(e) => setD({ ...d, isActive: e.target.checked })}
            />
            {t("On the till")}
          </label>
          <label>
            <input
              type="checkbox"
              className="check"
              checked={d.isFavourite}
              disabled={!canEdit}
              onChange={(e) => setD({ ...d, isFavourite: e.target.checked })}
            />
            {t("★ Favourite (shown first)")}
          </label>
          {canEdit && (
            <button
              className="btn-primary"
              onClick={save}
              disabled={busy || !dirty || !d.name.trim()}
            >
              {pending ? "…" : t("Save")}
            </button>
          )}
        </div>
        <Notice msg={msg} />
      </div>
    </div>
  );
}
