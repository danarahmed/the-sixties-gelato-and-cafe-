import type { PhraseBook } from "./types";

/** Packing at the till (0107): what each order goes out in, free to the customer. */
const phrases: PhraseBook = {
  "Packing item set": { ar: "ضُبط صنف تغليف", ckb: "کاڵایەکی پێچانەوە دانرا" },
  "A size's packing set": { ar: "ضُبط تغليف حجم", ckb: "پێچانەوەی قەبارەیەک دانرا" },
  "What the orders went out in, and what it cost the café: by day, by way of selling and by cashier, and the orders that took the most. Free to the customer; on 5500 Packaging.":
    {
      ar: "ما خرجت به الطلبات، وكم كلّف المقهى: حسب اليوم وطريقة البيع والكاشير، والطلبات التي أخذت أكثر. مجاني للزبون؛ على 5500 التغليف.",
      ckb: "ئەوەی داواکارییەکان پێی دەرچوون، و چەندی لەسەر کافێکە کەوت: بە پێی ڕۆژ و شێوەی فرۆشتن و کاشێر، و ئەو داواکاریانەی زۆرترینیان برد. بۆ کڕیار بەخۆڕاییە؛ لەسەر ٥٥٠٠ پێچانەوە.",
    },
  "No order went out in packing in these days": {
    ar: "لم يخرج أي طلب بتغليف في هذه الأيام",
    ckb: "لەم ڕۆژانەدا هیچ داواکارییەک بە پێچانەوە دەرنەچوو",
  },
  "on {n} orders · {per} an order": {
    ar: "على {n} طلبات · {per} للطلب",
    ckb: "لەسەر {n} داواکاری · {per} بۆ هەر داواکارییەک",
  },
  "By way of selling": { ar: "حسب طريقة البيع", ckb: "بە پێی شێوەی فرۆشتن" },
  "By cashier": { ar: "حسب الكاشير", ckb: "بە پێی کاشێر" },
  "By day": { ar: "حسب اليوم", ckb: "بە پێی ڕۆژ" },
  "The orders that took the most": {
    ar: "الطلبات التي أخذت أكثر",
    ckb: "ئەو داواکاریانەی زۆرترینیان برد",
  },
  "Way of selling": { ar: "طريقة البيع", ckb: "شێوەی فرۆشتن" },
  "What it went out in": { ar: "ما خرج به", ckb: "ئەوەی پێی دەرچوو" },
  "Packing: what the orders went out in, and what it cost →": {
    ar: "التغليف: ما خرجت به الطلبات وكم كلّف ←",
    ckb: "پێچانەوە: ئەوەی داواکارییەکان پێی دەرچوون و چەندی تێچوو ←",
  },
  "{n} packing items": { ar: "{n} أصناف تغليف", ckb: "{n} کاڵای پێچانەوە" },
  "None set up": { ar: "لا شيء مضبوط", ckb: "هیچ دانەنراوە" },
  "One fewer {name}": { ar: "{name} أقل بواحد", ckb: "یەک {name} کەمتر" },
  "One more {name}": { ar: "{name} أكثر بواحد", ckb: "یەک {name} زیاتر" },
  "Free to the customer, a cost to the café: what each order goes out in leaves stock at its average cost, to 5500 Packaging. Dine-in takes none. The till adds the defaults by itself; the cashier changes them with + and −.":
    {
      ar: "مجاني للزبون، وتكلفة على المقهى: ما يخرج به كل طلب يخرج من المخزون بمتوسط تكلفته، إلى 5500 التغليف. الأكل في المحل لا يأخذ شيئًا. الصندوق يضيف الافتراضي وحده؛ والكاشير يغيّره بـ + و −.",
      ckb: "بۆ کڕیار بەخۆڕاییە، و تێچوویەکە لەسەر کافێکە: ئەوەی هەر داواکارییەک پێی دەردەچێت بە تێکڕای تێچووەکەی لە کۆگا دەردەچێت، بۆ ٥٥٠٠ پێچانەوە. خواردن لە شوێنەکەدا هیچ نابات. سندوقەکە بنەڕەتییەکان خۆی زیاد دەکات؛ کاشێر بە + و − دەیانگۆڕێت.",
    },
  "To take away": { ar: "للأخذ", ckb: "بۆ بردن" },
  "For delivery": { ar: "للتوصيل", ckb: "بۆ گەیاندن" },
  "Stop using it": { ar: "توقف عن استخدامه", ckb: "بەکارهێنانی ڕابگرە" },
  "Use it again": { ar: "استخدمه مجددًا", ckb: "دووبارە بەکاری بهێنە" },
  "A stock item that is packing": { ar: "صنف مخزون للتغليف", ckb: "کاڵایەکی کۆگا کە پێچانەوەیە" },
  "Add as packing": { ar: "أضفه كتغليف", ckb: "وەک پێچانەوە زیادی بکە" },
  "What each size goes out in": {
    ar: "ما يخرج به كل حجم",
    ckb: "ئەوەی هەر قەبارەیەک پێی دەردەچێت",
  },
  "Product size": { ar: "حجم المنتج", ckb: "قەبارەی بەرهەم" },
  Bag: { ar: "كيس", ckb: "کیسە" },
  Cup: { ar: "كوب", ckb: "کوپ" },
  Lid: { ar: "غطاء", ckb: "سەرقاپ" },
  Box: { ar: "علبة", ckb: "قوتوو" },
  "Other packing": { ar: "تغليف آخر", ckb: "پێچانەوەی تر" },
  "An order takes from 0 to 20 of it by default": {
    ar: "الطلب يأخذ منه من 0 إلى 20 افتراضيًا",
    ckb: "داواکارییەک بە بنەڕەت لە ٠ تا ٢٠ی لێ دەبات",
  },
  "a stock item": { ar: "صنف مخزون", ckb: "کاڵایەکی کۆگا" },
  "a packing item": { ar: "صنف تغليف", ckb: "کاڵایەکی پێچانەوە" },
  "Choose what it is: a bag, a cup, a lid, a box or other packing": {
    ar: "اختر ما هو: كيس أو كوب أو غطاء أو علبة أو تغليف آخر",
    ckb: "هەڵبژێرە چییە: کیسە، کوپ، سەرقاپ، قوتوو یان پێچانەوەی تر",
  },
  "One sold takes from 1 to 10 of it": {
    ar: "الواحد المباع يأخذ منه من 1 إلى 10",
    ckb: "هەر دانەیەکی فرۆشراو لە ١ تا ١٠ی لێ دەبات",
  },
  "An order goes out in 0 to 100 of a packing item": {
    ar: "الطلب يخرج بـ 0 إلى 100 من صنف التغليف",
    ckb: "داواکارییەک بە ٠ تا ١٠٠ لە کاڵایەکی پێچانەوە دەردەچێت",
  },
  "Choose one of the café's stock items": {
    ar: "اختر أحد أصناف مخزون المقهى",
    ckb: "یەکێک لە کاڵاکانی کۆگای کافێکە هەڵبژێرە",
  },
  "Choose the packing": { ar: "اختر التغليف", ckb: "پێچانەوەکە هەڵبژێرە" },
  "Choose one of the café's packing items": {
    ar: "اختر أحد أصناف تغليف المقهى",
    ckb: "یەکێک لە کاڵاکانی پێچانەوەی کافێکە هەڵبژێرە",
  },
  "An order goes out in at most 100 of one packing item": {
    ar: "الطلب يخرج بـ 100 على الأكثر من صنف تغليف واحد",
    ckb: "داواکارییەک زۆرترین بە ١٠٠ لە یەک کاڵای پێچانەوە دەردەچێت",
  },
};

export default phrases;
