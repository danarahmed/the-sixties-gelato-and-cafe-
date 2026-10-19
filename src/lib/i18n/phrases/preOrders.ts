import type { PhraseBook } from "./types";

/**
 * Pre-orders with deposits (round eighteen, 0076): a cake for Friday, part
 * paid now; collected later, or cancelled with the deposit given back or kept.
 */
const phrases: PhraseBook = {
  // The till.
  "Pre-orders": { ar: "الطلبات المسبقة", ckb: "داواکارییە پێشوەختەکان" },
  "New pre-order": { ar: "طلب مسبق جديد", ckb: "داواکاریی پێشوەختەی نوێ" },
  "Add what they order to the till first.": {
    ar: "أضف ما يطلبونه إلى الصندوق أولًا.",
    ckb: "سەرەتا ئەوەی داوای دەکەن بیخەرە سەر سندوق.",
  },
  "No pre-orders waiting. Add what the customer orders to the till, then press New pre-order.": {
    ar: "لا طلبات مسبقة تنتظر. أضف ما يطلبه الزبون إلى الصندوق، ثم اضغط طلب مسبق جديد.",
    ckb: "هیچ داواکارییەکی پێشوەخت چاوەڕێ نییە. ئەوەی کڕیار داوای دەکات بیخەرە سەر سندوق، پاشان داواکاریی پێشوەختەی نوێ دابگرە.",
  },
  "Not collected yet": { ar: "لم يُستلم بعد", ckb: "هێشتا وەرنەگیراوە" },
  "Paid {amount} ahead": { ar: "دُفع {amount} مقدمًا", ckb: "{amount} پێشوەخت دراوە" },
  Collect: { ar: "تسليم", ckb: "ڕادەستکردن" },
  "Deposits held: {amount}": {
    ar: "العرابين المحفوظة: {amount}",
    ckb: "پێشەکییە هەڵگیراوەکان: {amount}",
  },
  "A pre-order takes no add-ons: write what they want in the line's note.": {
    ar: "الطلب المسبق لا يأخذ إضافات: اكتب ما يريدونه في ملاحظة السطر.",
    ckb: "داواکاریی پێشوەخت زیادکراو وەرناگرێت: ئەوەی دەیانەوێت لە تێبینیی دێڕەکەدا بنووسە.",
  },
  "A pre-order is at the menu's prices: take the discount off first.": {
    ar: "الطلب المسبق بأسعار القائمة: أزل الخصم أولًا.",
    ckb: "داواکاریی پێشوەخت بە نرخی لیستەکەیە: سەرەتا داشکاندنەکە لابە.",
  },
  "Whose order is it?": { ar: "طلب من هذا؟", ckb: "ئەم داواکارییە هی کێیە؟" },
  "Phone (optional)": { ar: "الهاتف (اختياري)", ckb: "تەلەفۆن (ئارەزوومەندانە)" },
  "Collected on": { ar: "يُستلم في", ckb: "ڕۆژی وەرگرتن" },
  "Note for the kitchen (optional)": {
    ar: "ملاحظة للمطبخ (اختياري)",
    ckb: "تێبینی بۆ چێشتخانە (ئارەزوومەندانە)",
  },
  "Paid now (optional)": { ar: "المدفوع الآن (اختياري)", ckb: "ئێستا دراو (ئارەزوومەندانە)" },
  Half: { ar: "النصف", ckb: "نیوە" },
  "All of it": { ar: "كله", ckb: "هەمووی" },
  "How is it paid?": { ar: "كيف يُدفع؟", ckb: "چۆن دەدرێت؟" },
  "Take the pre-order": { ar: "سجّل الطلب المسبق", ckb: "داواکارییە پێشوەختەکە تۆمار بکە" },
  "Total {amount}": { ar: "المجموع {amount}", ckb: "کۆی گشتی {amount}" },
  "Collected: the sale is recorded.": {
    ar: "تم التسليم: سُجّل البيع.",
    ckb: "ڕادەستکرا: فرۆشتنەکە تۆمار کرا.",
  },
  "To pay now: {amount}": { ar: "للدفع الآن: {amount}", ckb: "ئێستا بدرێت: {amount}" },
  "Paid in full: hand it over": { ar: "مدفوع بالكامل: سلّمه", ckb: "بە تەواوی دراوە: ڕادەستی بکە" },
  "The deposit": { ar: "العربون", ckb: "پێشەکییەکە" },
  "Give {amount} back": { ar: "أعِد {amount}", ckb: "{amount} بگەڕێنەوە" },
  "Cancel the pre-order": { ar: "ألغِ الطلب المسبق", ckb: "داواکارییە پێشوەختەکە هەڵبوەشێنەوە" },
  // The kitchen.
  "Ordered ahead": { ar: "طُلب مسبقًا", ckb: "پێشوەخت داواکراو" },
  // A receipt's payments.
  "Deposit paid": { ar: "العربون المدفوع", ckb: "پێشەکیی دراو" },
  // The audit trail.
  "Pre-order taken": { ar: "سُجّل طلب مسبق", ckb: "داواکاریی پێشوەخت تۆمار کرا" },
  "Pre-order collected": { ar: "سُلّم طلب مسبق", ckb: "داواکاریی پێشوەخت ڕادەست کرا" },
  "Pre-order cancelled": { ar: "أُلغي طلب مسبق", ckb: "داواکاریی پێشوەخت هەڵوەشێنرایەوە" },
  "Pre-order number": { ar: "رقم الطلب المسبق", ckb: "ژمارەی داواکاریی پێشوەخت" },
  "Paid ahead": { ar: "المدفوع مقدمًا", ckb: "پێشوەخت دراو" },
  "Deposit kept": { ar: "العربون محتفظ به", ckb: "پێشەکییەکە هەڵگیرا" },
  // Refusals.
  "a pre-order": { ar: "طلبًا مسبقًا", ckb: "داواکارییەکی پێشوەخت" },
  "A phone number is at most 40 characters": {
    ar: "رقم الهاتف 40 حرفًا على الأكثر",
    ckb: "ژمارەی تەلەفۆن زۆرترین 40 هێمایە",
  },
  "Say who the order is for": { ar: "قل لمن الطلب", ckb: "بڵێ داواکارییەکە بۆ کێیە" },
  "Say when it is collected": { ar: "قل متى يُستلم", ckb: "بڵێ کەی وەردەگیرێت" },
  "It is collected later than now": { ar: "يُستلم بعد الآن", ckb: "دوای ئێستا وەردەگیرێت" },
  "It is collected within six months": {
    ar: "يُستلم خلال ستة أشهر",
    ckb: "لە ماوەی شەش مانگدا وەردەگیرێت",
  },
  "A pre-order is collected at the café: take it away or eat in": {
    ar: "الطلب المسبق يُستلم في المقهى: سفري أو داخلي",
    ckb: "داواکاریی پێشوەخت لە کافێکە وەردەگیرێت: بیبە یان لێرە بیخۆ",
  },
  "A deposit is at most the order's total": {
    ar: "العربون لا يزيد على مجموع الطلب",
    ckb: "پێشەکی لە کۆی داواکارییەکە زیاتر نییە",
  },
  "A deposit is paid in cash, by card or one of the café's ways to pay": {
    ar: "العربون يُدفع نقدًا أو بالبطاقة أو بإحدى طرق الدفع في المقهى",
    ckb: "پێشەکی بە پارەی نەختینە، کارت یان یەکێک لە ڕێگاکانی پارەدانی کافێ دەدرێت",
  },
  "Pre-order not found": { ar: "الطلب المسبق غير موجود", ckb: "داواکارییە پێشوەختەکە نەدۆزرایەوە" },
  "Pre-order {1} is collected already": {
    ar: "الطلب المسبق {1} سُلّم من قبل",
    ckb: "داواکاریی پێشوەختی {1} پێشتر ڕادەست کراوە",
  },
  "Pre-order {1} was cancelled": {
    ar: "الطلب المسبق {1} أُلغي",
    ckb: "داواکاریی پێشوەختی {1} هەڵوەشێنرایەوە",
  },
};

export default phrases;
