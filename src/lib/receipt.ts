/**
 * The café's own receipt (0091), as the screens and the printer read it: its
 * logo, its name in the three languages, a thank-you line in each, its pages,
 * its Wi-Fi, a QR code to its menu or its reviews, and a line at the foot.
 */
type Row = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);

export type ReceiptQr = "none" | "menu" | "review";

export interface ReceiptSetup {
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  thanksEn: string | null;
  thanksAr: string | null;
  thanksCkb: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
  qr: ReceiptQr;
  menuUrl: string | null;
  reviewUrl: string | null;
  footer: string | null;
  /** A data address, so a till prints it with no connection. */
  logo: string | null;
}

export function receiptSetupFrom(d: unknown): ReceiptSetup {
  const r = (d ?? {}) as Row;
  const qr = r.qr === "menu" || r.qr === "review" ? r.qr : "none";
  return {
    name: text(r.name) ?? "",
    nameAr: text(r.name_ar),
    nameCkb: text(r.name_ckb),
    thanksEn: text(r.thanks_en),
    thanksAr: text(r.thanks_ar),
    thanksCkb: text(r.thanks_ckb),
    instagram: text(r.instagram),
    facebook: text(r.facebook),
    tiktok: text(r.tiktok),
    wifiName: text(r.wifi_name),
    wifiPassword: text(r.wifi_password),
    qr,
    menuUrl: text(r.menu_url),
    reviewUrl: text(r.review_url),
    footer: text(r.footer),
    logo: typeof r.logo === "string" && r.logo.startsWith("data:image/") ? r.logo : null,
  };
}

/** Where the receipt's QR code leads, or nowhere. */
export function receiptQrLink(r: ReceiptSetup | null | undefined): string | null {
  if (!r) return null;
  if (r.qr === "menu") return r.menuUrl;
  if (r.qr === "review") return r.reviewUrl;
  return null;
}

/** The thank-you lines to print, in the three languages; none set: none (the app's own is printed). */
export function receiptThanks(r: ReceiptSetup | null | undefined): string[] {
  if (!r) return [];
  return [r.thanksEn, r.thanksAr, r.thanksCkb].filter((x): x is string => !!x);
}

/** The café's names besides its own, each once. */
export function receiptOtherNames(r: ReceiptSetup | null | undefined): string[] {
  if (!r) return [];
  return [r.nameAr, r.nameCkb].filter(
    (x, i, all): x is string => !!x && x !== r.name && all.indexOf(x) === i,
  );
}

/** The form's fields as the database takes them. */
export function receiptSetupToDb(r: Omit<ReceiptSetup, "name" | "logo">): Record<string, string> {
  return {
    name_ar: r.nameAr ?? "",
    name_ckb: r.nameCkb ?? "",
    thanks_en: r.thanksEn ?? "",
    thanks_ar: r.thanksAr ?? "",
    thanks_ckb: r.thanksCkb ?? "",
    instagram: r.instagram ?? "",
    facebook: r.facebook ?? "",
    tiktok: r.tiktok ?? "",
    wifi_name: r.wifiName ?? "",
    wifi_password: r.wifiPassword ?? "",
    qr: r.qr,
    menu_url: r.menuUrl ?? "",
    review_url: r.reviewUrl ?? "",
    footer: r.footer ?? "",
  };
}
