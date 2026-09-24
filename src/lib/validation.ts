/**
 * Input rules shared by every form. Amounts and quantities are carried as
 * exact decimal STRINGS from the keyboard to the database, which does all the
 * arithmetic in NUMERIC — never through a JavaScript float (audit H-07).
 *
 * Staff type in English, Arabic and Kurdish; Arabic-Indic and Eastern
 * Arabic-Indic digits and separators are accepted and normalised.
 */
import { z } from "zod";

const ARABIC_INDIC = /[٠-٩]/g; // ٠١٢٣٤٥٦٧٨٩
const EASTERN_ARABIC_INDIC = /[۰-۹]/g; // ۰۱۲۳۴۵۶۷۸۹ (Kurdish, Persian)

export function normaliseNumber(input: unknown): string {
  return String(input ?? "")
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".") // Arabic decimal separator
    .replace(/[\s,٬،]/g, "") // spaces, commas, Arabic thousands separator
    .trim();
}

const DECIMAL = /^\d+(\.\d+)?$/;
const SIGNED_DECIMAL = /^-?\d+(\.\d+)?$/;

/** A decimal greater than zero, as an exact string. */
export const positive = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform(normaliseNumber)
    .refine((v) => DECIMAL.test(v) && Number(v) > 0, `${label} must be a number greater than zero`);

/** A decimal of zero or more, as an exact string (empty → "0"). */
export const nonNegative = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => normaliseNumber(v) || "0")
    .refine((v) => DECIMAL.test(v), `${label} must be a number of zero or more`);

/** An optional decimal of zero or more: null when left empty. */
export const optionalNonNegative = (label: string) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === null || v === undefined ? "" : normaliseNumber(v)))
    .refine((v) => v === "" || DECIMAL.test(v), `${label} must be a number of zero or more`)
    .transform((v) => (v === "" ? null : v));

/** A non-zero signed decimal, as an exact string. */
export const signedNonZero = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform(normaliseNumber)
    .refine(
      (v) => SIGNED_DECIMAL.test(v) && Number(v) !== 0,
      `${label} must be a number other than zero`,
    );

export const id = (label: string) => z.string().uuid(`Choose ${label}`);

/** A discount given as a percentage: more than 0 and no more than 100, or none (null). */
export const discountPercent = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v === null || v === undefined ? "" : normaliseNumber(v)))
  .refine(
    (v) => v === "" || (DECIMAL.test(v) && Number(v) > 0 && Number(v) <= 100),
    "A discount is more than 0% and no more than 100%",
  )
  .transform((v) => (v === "" ? null : v));

/** A discount given as an amount: more than zero, or none (null). */
export const discountAmount = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v === null || v === undefined ? "" : normaliseNumber(v)))
  .refine(
    (v) => v === "" || (DECIMAL.test(v) && Number(v) > 0),
    "A discount must be more than zero",
  )
  .transform((v) => (v === "" ? null : v));

export const day = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date`);

export const text = (label: string, max = 500) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, `${label} is required`)
    .refine((v) => v.length <= max, `${label} is too long`);

export const optionalText = (max = 500) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .refine((v) => v.length <= max, "Too long")
    .transform((v) => (v === "" ? null : v));

export const SALES_CHANNELS = [
  "dine_in",
  "takeaway",
  "direct_delivery",
  "talabat",
  "careem",
  "toters",
] as const;
export const salesChannel = z.enum(SALES_CHANNELS, { message: "Choose a channel" });
