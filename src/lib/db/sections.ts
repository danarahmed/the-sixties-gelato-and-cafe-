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
  const [secs, cats, places] = await Promise.all([
    c
      .from("menu_section")
      .select("id,name,name_ar,name_ckb,position,is_active")
      .order("position")
      .order("name"),
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
    sections: ((secs.data ?? []) as Row[]).map((r) => ({
      id: str(r.id),
      name: str(r.name),
      nameAr: strOrNull(r.name_ar),
      nameCkb: strOrNull(r.name_ckb),
      position: num(r.position),
      isActive: r.is_active === true,
    })),
    categorySection,
    placeSections,
  };
}
