"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setVariantBarcodeAction } from "@/lib/actions/menu";
import { internalEan13 } from "@/lib/barcode";
import { useT } from "@/lib/i18n/I18nProvider";
import { OperationStatus, useOperation } from "@/components/useOperation";

/**
 * Barcodes (round twenty, 0078): the code printed on what is bought in, typed
 * or scanned into the box; or one the café makes for its own labels. A size
 * sold by weight takes the short code its scale prints (four or five digits).
 */
export function BarcodeSizes({
  sizes,
  canEdit,
}: {
  sizes: { id: string; name: string; barcode: string | null; weighed: boolean }[];
  canEdit: boolean;
}) {
  const { t, msg } = useT();
  const router = useRouter();
  const op = useOperation();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>(
    Object.fromEntries(sizes.map((s) => [s.id, s.barcode ?? ""])),
  );

  function save(variantId: string, barcode: string) {
    setError(null);
    setTyped((m) => ({ ...m, [variantId]: barcode }));
    start(async () => {
      const r = await op.run(`barcode:${variantId}:${barcode}`, (key) =>
        setVariantBarcodeAction({ variantId, barcode }, key),
      );
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="card grid barcode-sizes" style={{ gap: 6 }} data-testid="barcode-sizes">
      <strong>{t("Barcodes")}</strong>
      <p className="muted" style={{ margin: 0, fontSize: ".85rem" }}>
        {t(
          "Scan or type the barcode on what is bought in, or make one for the café's own labels. At the till a scan adds it.",
        )}
      </p>
      {sizes.map((s) => (
        <div key={s.id} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span dir="auto" style={{ minWidth: 90 }}>
            {s.name}
          </span>
          <input
            dir="ltr"
            value={typed[s.id] ?? ""}
            maxLength={32}
            disabled={!canEdit || pending}
            aria-label={t("Barcode of {size}", { size: s.name })}
            placeholder={s.weighed ? t("The scale's code") : "6261…"}
            onChange={(e) => setTyped((m) => ({ ...m, [s.id]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save(s.id, (typed[s.id] ?? "").trim());
              }
            }}
            data-testid="barcode-input"
            data-size={s.name}
            style={{ minHeight: 40, flex: 1, minWidth: 160 }}
          />
          <button
            type="button"
            disabled={!canEdit || pending || (typed[s.id] ?? "").trim() === (s.barcode ?? "")}
            onClick={() => save(s.id, (typed[s.id] ?? "").trim())}
            data-testid="barcode-save"
          >
            {t("Save")}
          </button>
          {!s.barcode && !s.weighed && (
            <button
              type="button"
              disabled={!canEdit || pending}
              onClick={() => save(s.id, internalEan13(Math.floor(Math.random() * 1e10)))}
              data-testid="barcode-make"
            >
              {t("Make one")}
            </button>
          )}
          {s.barcode && (
            <Link href={`/products/labels?size=${s.id}`} className="linklike">
              {t("Print labels")}
            </Link>
          )}
        </div>
      ))}
      {error && <p className="red">{msg(error)}</p>}
      <OperationStatus op={op} />
    </div>
  );
}
