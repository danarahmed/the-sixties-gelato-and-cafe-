import type { PhraseBook } from "./types";

/**
 * Reports on paper and the documents kept with the records (release AA): a
 * report printed or saved as a PDF, and the pictures and PDFs of the papers a
 * record came with.
 */
const phrases: PhraseBook = {
  "Print or save as PDF": {
    ar: "اطبع أو احفظ بصيغة PDF",
    ckb: "چاپی بکە یان وەک PDF پاشەکەوتی بکە",
  },
  "As of {when}": { ar: "بتاريخ {when}", ckb: "بە بەرواری {when}" },

  // A record's documents (0053): its page, the way to it from a list, and the
  // audit trail.
  Documents: { ar: "المستندات", ckb: "بەڵگەنامەکان" },
  Document: { ar: "المستند", ckb: "بەڵگەنامە" },
  "Kept with it": { ar: "المحفوظة معه", ckb: "لەگەڵیدا هەڵگیراون" },
  "{n} of {max}": { ar: "{n} من {max}", ckb: "{n} لە {max}" },
  "No documents kept with it yet": {
    ar: "لا مستندات محفوظة معه بعد",
    ckb: "هێشتا هیچ بەڵگەنامەیەک لەگەڵیدا هەڵنەگیراوە",
  },
  "Documents kept with it: {n}": {
    ar: "المستندات المحفوظة معه: {n}",
    ckb: "بەڵگەنامە هەڵگیراوەکان لەگەڵیدا: {n}",
  },
  Download: { ar: "تنزيل", ckb: "داگرتن" },
  "Attached by": { ar: "أرفقه", ckb: "هاوپێچی کرد" },
  "Attach a document": { ar: "أرفق مستندًا", ckb: "بەڵگەنامەیەک هاوپێچ بکە" },
  "A photo or a PDF of the paper it came with: the delivery note, the supplier's bill or credit note, the return slip, or the receipt. A picture (JPEG, PNG or WebP) or a PDF, 10 MB at most; a large photo is made smaller before it is sent.":
    {
      ar: "صورة أو ملف PDF للورقة التي جاء بها: إشعار التسليم، أو فاتورة المورّد أو إشعاره الدائن، أو ورقة الإرجاع، أو الإيصال. صورة (JPEG أو PNG أو WebP) أو ملف PDF، بحدّ أقصى 10 ميغابايت؛ وتُصغَّر الصورة الكبيرة قبل إرسالها.",
      ckb: "وێنە یان فایلی PDFی ئەو کاغەزەی لەگەڵیدا هات: پسووڵەی گەیاندن، پسووڵە یان پسووڵەی گەڕاندنەوەی دابینکەر، کاغەزی گەڕاندنەوەی کاڵا، یان وەسڵ. وێنە (JPEG، PNG یان WebP) یان PDF، زۆرترین 10 مێگابایت؛ وێنەی گەورە پێش ناردن بچووک دەکرێتەوە.",
    },
  "Only those who may record it attach its documents.": {
    ar: "لا يرفق مستنداته إلا من يحق له تسجيله.",
    ckb: "تەنها ئەوانەی دەتوانن تۆماری بکەن بەڵگەنامەکانی هاوپێچ دەکەن.",
  },
  "Taken off": { ar: "المُزالة", ckb: "لابراوەکان" },
  "Taken off by": { ar: "أزالها", ckb: "لایبرد" },
  "Kept for the audit trail, with why": {
    ar: "محفوظة لسجل التدقيق، مع السبب",
    ckb: "بۆ تۆماری گۆڕانکارییەکان هەڵگیراون، لەگەڵ هۆکارەکەی",
  },
  "Take a photo": { ar: "التقط صورة", ckb: "وێنەیەک بگرە" },
  "Choose a picture or a PDF": { ar: "اختر صورة أو ملف PDF", ckb: "وێنە یان فایلی PDF هەڵبژێرە" },
  Attach: { ar: "إرفاق", ckb: "هاوپێچ بکە" },
  "Sending…": { ar: "جارٍ الإرسال…", ckb: "دەنێردرێت…" },
  "Attached: {name}": { ar: "أُرفق: {name}", ckb: "هاوپێچ کرا: {name}" },
  "Take off": { ar: "إزالة", ckb: "لابردن" },
  "Why is {name} taken off?": { ar: "لماذا يُزال {name}؟", ckb: "بۆچی {name} لادەبرێت؟" },
  "Take it off": { ar: "أزِله", ckb: "لای ببە" },
  "Take a photo or choose a file first": {
    ar: "التقط صورة أو اختر ملفًا أولًا",
    ckb: "سەرەتا وێنەیەک بگرە یان فایلێک هەڵبژێرە",
  },
  "The file could not be sent: try again": {
    ar: "تعذّر إرسال الملف: حاول مجددًا",
    ckb: "فایلەکە نەنێردرا: دووبارە هەوڵ بدەرەوە",
  },
  "That file is empty": { ar: "هذا الملف فارغ", ckb: "ئەو فایلە بەتاڵە" },
  "{n} bytes": { ar: "{n} بايت", ckb: "{n} بایت" },
  "{n} KB": { ar: "{n} كيلوبايت", ckb: "{n} کیلۆبایت" },
  "{n} MB": { ar: "{n} ميغابايت", ckb: "{n} مێگابایت" },
  "the record": { ar: "السجل", ckb: "تۆمارەکە" },
  "The file": { ar: "الملف", ckb: "فایلەکە" },
  "The document's name": { ar: "اسم المستند", ckb: "ناوی بەڵگەنامەکە" },
  "the document": { ar: "المستند", ckb: "بەڵگەنامەکە" },
  "Document attached": { ar: "أُرفق مستند", ckb: "بەڵگەنامەیەک هاوپێچ کرا" },
  "Document taken off": { ar: "أُزيل مستند", ckb: "بەڵگەنامەیەک لابرا" },
  "Documents kept with records": {
    ar: "المستندات المحفوظة مع السجلات",
    ckb: "بەڵگەنامە هەڵگیراوەکان لەگەڵ تۆمارەکان",
  },

  // What the database says of a document kept with a record (0053).
  "Choose what the document goes with": {
    ar: "اختر السجل الذي يُرفق به المستند",
    ckb: "ئەوە هەڵبژێرە کە بەڵگەنامەکە هی چییە",
  },
  "The record was not found": { ar: "لم يُعثر على السجل", ckb: "تۆمارەکە نەدۆزرایەوە" },
  "Give the document a name": { ar: "أعطِ المستند اسمًا", ckb: "ناوێک بۆ بەڵگەنامەکە دابنێ" },
  "A document's name is at most 200 letters": {
    ar: "اسم المستند 200 حرف على الأكثر",
    ckb: "ناوی بەڵگەنامە لە 200 پیت زیاتر نییە",
  },
  "A note is at most 500 letters": {
    ar: "الملاحظة 500 حرف على الأكثر",
    ckb: "تێبینی لە 500 پیت زیاتر نییە",
  },
  "The file is not kept with this record": {
    ar: "الملف ليس محفوظًا مع هذا السجل",
    ckb: "فایلەکە لەگەڵ ئەم تۆمارەدا هەڵنەگیراوە",
  },
  "Upload the file first": { ar: "ارفع الملف أولًا", ckb: "سەرەتا فایلەکە بار بکە" },
  "A document is a picture (JPEG, PNG or WebP) or a PDF": {
    ar: "المستند صورة (JPEG أو PNG أو WebP) أو ملف PDF",
    ckb: "بەڵگەنامە وێنەیە (JPEG، PNG یان WebP) یان PDF",
  },
  "A document is at most 10 MB": {
    ar: "المستند 10 ميغابايت على الأكثر",
    ckb: "بەڵگەنامە لە 10 مێگابایت گەورەتر نییە",
  },
  "That file is attached already": {
    ar: "هذا الملف مرفق بالفعل",
    ckb: "ئەو فایلە پێشتر هاوپێچ کراوە",
  },
  "A record keeps at most 20 documents: take one off first": {
    ar: "يحفظ السجل 20 مستندًا على الأكثر: أزِل واحدًا أولًا",
    ckb: "تۆمارێک لە 20 بەڵگەنامە زیاتر هەڵناگرێت: سەرەتا یەکێکیان لاببە",
  },
  "Document not found": { ar: "لم يُعثر على المستند", ckb: "بەڵگەنامەکە نەدۆزرایەوە" },
  "Say why the document is taken off": {
    ar: "اذكر سبب إزالة المستند",
    ckb: "بڵێ بۆچی بەڵگەنامەکە لادەبرێت",
  },
  "This document was taken off already": {
    ar: "أُزيل هذا المستند من قبل",
    ckb: "ئەم بەڵگەنامەیە پێشتر لابراوە",
  },
  "A document is not deleted: take it off, saying why": {
    ar: "لا يُحذف المستند: أزِله مع ذكر السبب",
    ckb: "بەڵگەنامە ناسڕدرێتەوە: لای ببە و بڵێ بۆچی",
  },
  "A document is not changed: take it off and attach it again": {
    ar: "لا يُغيَّر المستند: أزِله ثم أرفقه من جديد",
    ckb: "بەڵگەنامە ناگۆڕدرێت: لای ببە و دووبارە هاوپێچی بکەرەوە",
  },
};

export default phrases;
