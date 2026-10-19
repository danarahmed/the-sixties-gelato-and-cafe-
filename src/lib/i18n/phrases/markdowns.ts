import type { PhraseBook } from "./types";

/**
 * End-of-day markdowns (round twenty-one, 0079): what must be sold today,
 * sold off cheaper before it is thrown away.
 */
const phrases: PhraseBook = {
  "Sell it before it goes": { ar: "بِعه قبل أن يتلف", ckb: "پێش ئەوەی خراپ ببێت بیفرۆشە" },
  "What must be sold today, with some left. Marked down, it sells for less until the day ends; the till shows by how much.":
    {
      ar: "ما يجب بيعه اليوم وبقي منه شيء. بعد التخفيض يُباع بأقل حتى نهاية اليوم؛ ويُظهر الصندوق مقدار التخفيض.",
      ckb: "ئەوەی دەبێت ئەمڕۆ بفرۆشرێت و هێشتا ماوە. دوای داشکاندن تا کۆتایی ڕۆژ بە کەمتر دەفرۆشرێت؛ سندوق نیشانی دەدات چەندە.",
    },
  "{left} left, use by {time}": {
    ar: "بقي {left}، يُستخدم قبل {time}",
    ckb: "{left} ماوە، تا {time} بەکاری بهێنە",
  },
  "No size on the menu sells it.": {
    ar: "لا يوجد حجم في القائمة يبيعه.",
    ckb: "هیچ قەبارەیەک لە لیستەکە نایفرۆشێت.",
  },
  "{n} to sell": { ar: "{n} للبيع", ckb: "{n} بۆ فرۆشتن" },
  "{percent}% off": { ar: "خصم {percent}%", ckb: "{percent}% داشکاندن" },
  Stop: { ar: "أوقف", ckb: "ڕایبگرە" },
  "Marked down now": { ar: "مخفّض الآن", ckb: "ئێستا داشکێنراوە" },
  "until {time}": { ar: "حتى {time}", ckb: "تا {time}" },
  "Marked down": { ar: "تم التخفيض", ckb: "داشکێنرا" },
  "Markdown stopped": { ar: "أُوقف التخفيض", ckb: "داشکاندن وەستێنرا" },
  "A markdown is from 5% to 90% off, in whole percent": {
    ar: "التخفيض من 5% إلى 90%، بنسب صحيحة",
    ckb: "داشکاندن لە 5% تا 90%ە، بە ڕێژەی تەواو",
  },
  "Choose what to mark down": {
    ar: "اختر ما تريد تخفيضه",
    ckb: "ئەوە هەڵبژێرە کە دەتەوێت دایبشکێنیت",
  },
  "A markdown ends later than now": {
    ar: "ينتهي التخفيض بعد الآن",
    ckb: "داشکاندن دوای ئێستا کۆتایی دێت",
  },
  "Markdown not found": { ar: "التخفيض غير موجود", ckb: "داشکاندنەکە نەدۆزرایەوە" },
  "a markdown": { ar: "تخفيضًا", ckb: "داشکاندنێک" },
};

export default phrases;
