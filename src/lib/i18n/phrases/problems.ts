import type { PhraseBook } from "./types";

/**
 * "Something's wrong" (G5, 0083): said from any screen by whoever is signed
 * in; read and dealt with by the owner and the managers.
 */
const phrases: PhraseBook = {
  // The button and its dialog.
  "Something's wrong?": { ar: "هناك مشكلة؟", ckb: "شتێک هەڵەیە؟" },
  "Say in a word or two what went wrong. The screen you are on goes with it, so nobody has to ask.":
    {
      ar: "قل بكلمة أو كلمتين ما الذي حدث خطأ. تُرسل معه الشاشة التي أنت عليها، فلا يحتاج أحد إلى السؤال.",
      ckb: "بە یەک دوو وشە بڵێ چی هەڵە بوو. ئەو شاشەیەی لەسەریت لەگەڵیدا دەنێردرێت، بۆیە کەس پێویستی بە پرسیار نییە.",
    },
  "What went wrong?": { ar: "ما الذي حدث خطأ؟", ckb: "چی هەڵە بوو؟" },
  "The receipt printed twice": { ar: "طُبع الإيصال مرتين", ckb: "پسوولەکە دوو جار چاپ کرا" },
  "On: {page}": { ar: "في: {page}", ckb: "لە: {page}" },
  "Thank you. The owner will see it, with this screen.": {
    ar: "شكرًا. سيراه المالك مع هذه الشاشة.",
    ckb: "سوپاس. خاوەن دەیبینێت، لەگەڵ ئەم شاشەیە.",
  },
  "Say in a word or two what went wrong": {
    ar: "قل بكلمة أو كلمتين ما الذي حدث خطأ",
    ckb: "بە یەک دوو وشە بڵێ چی هەڵە بوو",
  },
  "At most 500 letters": { ar: "500 حرف على الأكثر", ckb: "لانیزۆر 500 پیت" },
  Send: { ar: "أرسل", ckb: "بنێرە" },
  "the report": { ar: "البلاغ", ckb: "ڕاپۆرتەکە" },
  "Reported problems are kept once the owner applies the latest database update.": {
    ar: "تُحفظ المشكلات المُبلَّغ عنها بعد أن يطبّق المالك آخر تحديث لقاعدة البيانات.",
    ckb: "کێشە ڕاپۆرتکراوەکان دەپارێزرێن دوای ئەوەی خاوەن دوایین نوێکردنەوەی بنکەدراوە جێبەجێ دەکات.",
  },
  "That report is not here": { ar: "هذا البلاغ غير موجود هنا", ckb: "ئەو ڕاپۆرتە لێرە نییە" },

  // The list.
  "Reported problems": { ar: "المشكلات المُبلَّغ عنها", ckb: "کێشە ڕاپۆرتکراوەکان" },
  "What staff said went wrong, with the screen they were on. Mark each one dealt with once it is put right; copy one to send it on.":
    {
      ar: "ما قال الموظفون إنه حدث خطأ، مع الشاشة التي كانوا عليها. علّم كل واحدة بأنها عولجت حين تُصلح؛ وانسخ واحدة لإرسالها.",
      ckb: "ئەوەی کارمەندان گوتیان هەڵە بوو، لەگەڵ ئەو شاشەیەی لەسەری بوون. هەر یەکێک کە چاک کرا وەک چارەسەرکراو نیشانە بکە؛ یەکێک کۆپی بکە بۆ ناردنی.",
    },
  "Nothing reported. Anyone can say something is wrong from the menu, on any screen.": {
    ar: "لا شيء مُبلَّغ عنه. يستطيع أي أحد أن يقول إن هناك مشكلة من القائمة، في أي شاشة.",
    ckb: "هیچ شتێک ڕاپۆرت نەکراوە. هەر کەسێک دەتوانێت لە مێنیوەوە، لەسەر هەر شاشەیەک، بڵێت شتێک هەڵەیە.",
  },
  "Dealt with": { ar: "عولجت", ckb: "چارەسەر کرا" },
  "Open again": { ar: "افتحها مجددًا", ckb: "دووبارە بیکەرەوە" },
  "What was done (optional)": { ar: "ما الذي فُعل (اختياري)", ckb: "چی کرا (ئارەزوومەندانە)" },
  "Copy to send on": { ar: "انسخ لإرسالها", ckb: "کۆپی بکە بۆ ناردن" },
  Copied: { ar: "نُسخ", ckb: "کۆپی کرا" },
  "Note: {note}": { ar: "ملاحظة: {note}", ckb: "تێبینی: {note}" },
  "{n} problem(s) reported by staff, not dealt with yet": {
    ar: "{n} مشكلة أبلغ عنها الموظفون، لم تُعالج بعد",
    ckb: "{n} کێشە کارمەندان ڕاپۆرتیان کردووە، هێشتا چارەسەر نەکراون",
  },
};

export default phrases;
