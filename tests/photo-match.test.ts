import { describe, expect, it } from "vitest";
import { fileStem, foldName, matchPhotos } from "@/lib/photoMatch";

const products = [
  { id: "latte", names: ["Latte", "لاتيه", "لاتێ"] },
  { id: "iced", names: ["Iced Latte", "", ""] },
  { id: "pist", names: ["Pistachio Gelato", "جيلاتو فستق", ""] },
  { id: "crois", names: ["Croissant", "", ""] },
  { id: "choc1", names: ["Chocolate Cake", "", ""] },
  { id: "choc2", names: ["Chocolate Gelato", "", ""] },
];
const f = (name: string) => ({ name });

describe("photos matched to products by their file's name (E8)", () => {
  it("reads a file's name as a product's", () => {
    expect(fileStem("Latte.JPG")).toBe("latte");
    expect(fileStem("iced-latte_2.png")).toBe("iced latte");
    expect(fileStem("C:\\pics\\Croissant (3).webp")).toBe("croissant");
    expect(foldName("Café  Crème")).toBe("cafe creme");
  });

  it("a product's own name wins over one that holds it", () => {
    const r = matchPhotos([f("latte.jpg"), f("Iced_Latte.jpeg")], products);
    expect(r.matched.map((m) => [m.file.name, m.productId])).toEqual([
      ["latte.jpg", "latte"],
      ["Iced_Latte.jpeg", "iced"],
    ]);
  });

  it("in Arabic and Kurdish too, and by part of a name when only one fits", () => {
    const r = matchPhotos([f("لاتيه.jpg"), f("pistachio.png"), f("croissants.jpg")], products);
    expect(r.matched.map((m) => m.productId)).toEqual(["latte", "pist", "crois"]);
  });

  it("leaves what fits none, or several, and takes one photo per product", () => {
    const r = matchPhotos(
      [f("chocolate.jpg"), f("tea.jpg"), f("latte.jpg"), f("latte (2).jpg"), f("IMG_2041.jpg")],
      products,
    );
    expect(r.matched.map((m) => m.productId)).toEqual(["latte"]);
    expect(r.unmatched.map((u) => u.name)).toEqual(["chocolate.jpg", "tea.jpg", "IMG_2041.jpg"]);
    expect(r.repeated.map((u) => u.name)).toEqual(["latte (2).jpg"]);
  });
});
