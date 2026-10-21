/**
 * Photos added many at once (E8), each matched to a product by its file's
 * name: "latte.jpg" → Latte, "iced-latte_2.png" → Iced Latte, "لاتيه.jpg" →
 * the product of that Arabic name. A name that is a product's own, in any of
 * its languages, wins; failing that, the one product whose name holds it (or
 * is held by it). Two photos for one product: the first is taken. A name that
 * fits none, or several equally, is left for the owner to place by hand.
 */
export interface Nameable {
  id: string;
  names: string[];
}

export interface PhotoMatch<F> {
  matched: { file: F; productId: string }[];
  /** Files no product was found for, or that found several. */
  unmatched: F[];
  /** Files for a product another file already took. */
  repeated: F[];
}

/** A name as it is compared: small letters, no marks, words by one space. */
export function foldName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
    .toLowerCase()
    .replace(/[_\-.+]+/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A file's name without its extension or a trailing copy number ("latte (2)", "latte_2"). */
export function fileStem(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]{2,5}$/i, "");
  return foldName(base)
    .replace(/ ?\(\d+\)$/, "")
    .replace(/ \d{1,2}$/, "")
    .trim();
}

export function matchPhotos<F extends { name: string }>(
  files: F[],
  products: Nameable[],
): PhotoMatch<F> {
  const folded = products.map((p) => ({
    id: p.id,
    names: [...new Set(p.names.filter(Boolean).map(foldName))].filter(Boolean),
  }));
  const out: PhotoMatch<F> = { matched: [], unmatched: [], repeated: [] };
  const taken = new Set<string>();
  for (const file of files) {
    const stem = fileStem(file.name);
    let found: string | null = null;
    if (stem) {
      const exact = folded.filter((p) => p.names.includes(stem));
      if (exact.length === 1) found = exact[0]!.id;
      else if (exact.length === 0) {
        const near = folded.filter((p) =>
          p.names.some((n) => (n.includes(stem) || stem.includes(n)) && n.length >= 3),
        );
        if (near.length === 1) found = near[0]!.id;
      }
    }
    if (!found) out.unmatched.push(file);
    else if (taken.has(found)) out.repeated.push(file);
    else {
      taken.add(found);
      out.matched.push({ file, productId: found });
    }
  }
  return out;
}
