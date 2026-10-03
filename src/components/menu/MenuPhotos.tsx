"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setProductImageAction } from "@/lib/actions/menu";
import type { MenuProduct } from "@/lib/db/menu";
import { useT } from "@/lib/i18n/I18nProvider";
import { ProductThumb } from "@/components/pos/ProductPicker";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/ui";
import { shrinkPhoto } from "./photo";

/** A product's name in the reader's language, when it has one there. */
function nameIn(p: MenuProduct, locale: string): string {
  if (locale === "ar" && p.nameAr) return p.nameAr;
  if (locale === "ckb" && p.nameCkb) return p.nameCkb;
  return p.name;
}

/**
 * Every product the till offers, as the till shows it, each one tap from a
 * photo: those still without one first. The phone offers its camera or its
 * pictures; the photo is made small in the browser before it is sent, as on a
 * product's own setup, and the till shows it at once.
 */
export function MenuPhotos({ products }: { products: MenuProduct[] }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const forId = useRef<string | null>(null);

  const shown = products
    .filter((p) => p.isActive)
    .sort(
      (a, b) =>
        Number(Boolean(a.imageUrl)) - Number(Boolean(b.imageUrl)) ||
        nameIn(a, locale).localeCompare(nameIn(b, locale), locale),
    );
  if (shown.length === 0) return null;
  const withPhoto = shown.filter((p) => p.imageUrl).length;

  async function upload(f: File) {
    const id = forId.current;
    if (!id) return;
    setMsg(null);
    setBusy(id);
    try {
      const photo = await shrinkPhoto(f);
      const r = await setProductImageAction({ productId: id, ...photo });
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
      setBusy(null);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <details className="card menu-photos" data-testid="menu-photos">
      <summary>
        <Icon name="camera" /> {t("Photos for the till")}{" "}
        <span className="muted menu-photos-count">
          {t("{n} of {total} have one", { n: withPhoto, total: shown.length })}
        </span>
      </summary>
      <p className="muted" style={{ fontSize: ".85rem", margin: "10px 0" }}>
        {t(
          "Tap a product to give it a photo, or a new one: a phone offers its camera or its pictures. One with no photo shows its colour and its initials.",
        )}
      </p>
      <Notice msg={msg} />
      <ul className="photo-grid" aria-label={t("Photos for the till")}>
        {shown.map((p) => {
          const name = nameIn(p, locale);
          return (
            <li key={p.id}>
              <button
                type="button"
                className="photo-tile"
                data-product={p.name}
                disabled={busy !== null}
                onClick={() => {
                  forId.current = p.id;
                  file.current?.click();
                }}
              >
                {/* Named by what it says, as it is seen: the product, and what a tap does. */}
                <span className="photo-thumb" aria-hidden="true">
                  <ProductThumb name={name} imageUrl={p.imageUrl} seed={p.categoryId ?? p.id} />
                </span>
                <span className="photo-name" dir="auto">
                  {name}
                </span>
                <span className={`photo-act${p.imageUrl ? "" : " add"}`}>
                  <Icon name={p.imageUrl ? "camera" : "plus"} size={14} />{" "}
                  {busy === p.id ? "…" : p.imageUrl ? t("Change photo") : t("Add photo")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        hidden
        aria-label={t("Photo for the till")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
    </details>
  );
}
