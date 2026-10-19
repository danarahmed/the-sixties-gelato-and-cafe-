import type { PhraseBook } from "./types";

/**
 * The café and the bakery on one till (round sixteen, 0074): the parts of the
 * menu, each category's part, what a branch sells, and each part's takings
 * and profit on Reports.
 */
const phrases: PhraseBook = {
  // Products & Recipes.
  "Café and bakery on one till": {
    ar: "المقهى والمخبز على صندوق واحد",
    ckb: "کافێ و نانەواخانە لەسەر یەک سندوق",
  },
  "Name the parts of your menu, such as Café and Bakery, and give each category its part. One till sells them all on one bill; the reports show each part's takings and profit; and a branch can sell only one part (Settings → Locations).":
    {
      ar: "سمِّ أقسام قائمتك، مثل المقهى والمخبز، وأعطِ كل فئة قسمها. يبيعها صندوق واحد كلها في فاتورة واحدة؛ وتُظهر التقارير مبيعات كل قسم وربحه؛ ويمكن لفرع أن يبيع قسمًا واحدًا فقط (الإعدادات ← المواقع).",
      ckb: "بەشەکانی مینیوەکەت ناو بنێ، وەک کافێ و نانەواخانە، و هەر پۆلێک بەشی خۆی پێ بدە. یەک سندوق هەموویان لە یەک وەسڵدا دەفرۆشێت؛ ڕاپۆرتەکان فرۆشتن و قازانجی هەر بەشێک پیشان دەدەن؛ و لقێک دەتوانێت تەنها یەک بەش بفرۆشێت (ڕێکخستنەکان ← شوێنەکان).",
    },
  "Add Café and Bakery": { ar: "أضف المقهى والمخبز", ckb: "کافێ و نانەواخانە زیاد بکە" },
  "or name your own below": { ar: "أو سمِّ أقسامك أدناه", ckb: "یان لە خوارەوە بەشی خۆت ناو بنێ" },
  "{name} in use": { ar: "{name} مستخدم", ckb: "{name} بەکاردێت" },
  "New part, e.g. Bakery": { ar: "قسم جديد، مثل المخبز", ckb: "بەشی نوێ، بۆ نموونە نانەواخانە" },
  "Each category's part": { ar: "قسم كل فئة", ckb: "بەشی هەر پۆلێک" },
  "{name}'s part": { ar: "قسم {name}", ckb: "بەشی {name}" },
  "Added Café and Bakery: now give each category its part.": {
    ar: "أُضيف المقهى والمخبز: الآن أعطِ كل فئة قسمها.",
    ckb: "کافێ و نانەواخانە زیاد کران: ئێستا هەر پۆلێک بەشی خۆی پێ بدە.",
  },
  // The till.
  "Sections of the menu": { ar: "أقسام القائمة", ckb: "بەشەکانی مینیو" },
  // Settings → Locations.
  "Sells everything": { ar: "يبيع كل شيء", ckb: "هەموو شتێک دەفرۆشێت" },
  "Sells only:": { ar: "يبيع فقط:", ckb: "تەنها دەفرۆشێت:" },
  // Reports.
  "Café and bakery": { ar: "المقهى والمخبز", ckb: "کافێ و نانەواخانە" },
  "Each part of the menu, {from} to {to}": {
    ar: "كل قسم من القائمة، من {from} إلى {to}",
    ckb: "هەر بەشێکی مینیو، لە {from} تا {to}",
  },
  "Part of the menu": { ar: "قسم القائمة", ckb: "بەشی مینیو" },
  "No section": { ar: "بلا قسم", ckb: "بێ بەش" },
  "Sales after discounts, less what refunds gave back; the cost is what those sales used. Rent, wages and other costs the parts share are in the profit and loss.":
    {
      ar: "المبيعات بعد الخصومات، مطروحًا منها ما أعادته المستردات؛ والكلفة هي ما استهلكته تلك المبيعات. الإيجار والأجور والتكاليف الأخرى المشتركة بين الأقسام في الأرباح والخسائر.",
      ckb: "فرۆشتن دوای داشکاندن، کەمکراوە لەوەی گەڕاندنەوەی پارە گەڕاندییەوە؛ تێچوو ئەوەیە کە ئەو فرۆشتنانە بەکاریان هێنا. کرێ و مووچە و تێچووە هاوبەشەکانی تری بەشەکان لە قازانج و زیاندان.",
    },
  // The forms.
  "a section": { ar: "قسمًا", ckb: "بەشێک" },
  "The section's name": { ar: "اسم القسم", ckb: "ناوی بەشەکە" },
};

export default phrases;
