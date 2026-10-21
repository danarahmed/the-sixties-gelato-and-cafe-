import "server-only";
/**
 * The café's and the bakery's products on one till (0074): the sections of
 * the menu, each category's, and the sections each branch sells. Null before
 * the owner applies 0074: the screens then show nothing of it.
 */
import { db, num, str, strOrNull, type Row } from "./client";

export interface MenuSection {
  id: string;
  name: string;
  nameAr: string | null;
  nameCkb: string | null;
  position: number;
  isActive: boolean;
  /** Shown at the till only in these hours (0089); null: always. */
  shownFrom: string | null;
  shownUntil: string | null;
}

export interface SectionSetup {
  sections: MenuSection[];
  /** Each category's section, by the category's id. */
  categorySection: Record<string, string>;
  /** The sections each branch sells, by the branch's id; a branch not here sells everything. */
  placeSections: Record<string, string[]>;
}

export async function getSectionSetup(): Promise<SectionSetup | null> {
  const c = await db();
  const read = (cols: string) =>
    c.from("menu_section").select(cols).order("position").order("name");
  // The hours a section is shown (0089); before it, the columns are not there.
  let secs = await read("id,name,name_ar,name_ckb,position,is_active,shown_from,shown_until");
  if (secs.error) secs = await read("id,name,name_ar,name_ckb,position,is_active");
  const [cats, places] = await Promise.all([
    c.from("product_category").select("id,section_id"),
    c.from("location_section").select("location_id,section_id"),
  ]);
  // Before 0074 the tables and the column are not there.
  if (secs.error || cats.error || places.error) return null;
  const categorySection: Record<string, string> = {};
  for (const r of (cats.data ?? []) as Row[])
    if (r.section_id) categorySection[str(r.id)] = str(r.section_id);
  const placeSections: Record<string, string[]> = {};
  for (const r of (places.data ?? []) as Row[])
    (placeSections[str(r.location_id)] ??= []).push(str(r.section_id));
  return {
    sections: ((secs.data ?? []) as unknown as Row[]).map((r) => ({
      id: str(r.id),
      name: str(r.name),
      nameAr: strOrNull(r.name_ar),
      nameCkb: strOrNull(r.name_ckb),
      position: num(r.position),
      isActive: r.is_active === true,
      shownFrom: typeof r.shown_from === "string" ? r.shown_from.slice(0, 5) : null,
      shownUntil: typeof r.shown_until === "string" ? r.shown_until.slice(0, 5) : null,
    })),
    categorySection,
    placeSections,
  };
}
