import type { PhraseBook } from "./types";

/**
 * Round ten: the café's own ways to pay, each with its own account (0069) —
 * added on Settings, a button each at the till, given back by the way it was
 * paid, the money moved out of their accounts on Sales, and each in the
 * reports and at the end of the day.
 */
const phrases: PhraseBook = {
  // ------------------------------------------------- Settings → Ways to pay
  "Ways to pay": { ar: "طرق الدفع", ckb: "ڕێگاکانی پارەدان" },
  "Cash and the card machine are always taken. Add the apps and banks the café is paid through: each gets an account of its own, where its money stays until it is moved, on Sales.":
    {
      ar: "النقد وجهاز البطاقات مقبولان دائمًا. أضف التطبيقات والبنوك التي يُدفع للمقهى عبرها: لكلٍّ منها حساب خاص يبقى فيه ماله حتى يُنقل، من شاشة «المبيعات».",
      ckb: "کاش و ئامێری کارت هەمیشە وەردەگیرێن. ئەو ئەپ و بانکانە زیاد بکە کە پارەی کافێکەیان پێدا دەدرێت: هەر یەکەیان هەژمارێکی تایبەتی خۆی هەیە، پارەکەی تێیدا دەمێنێتەوە تا دەگوازرێتەوە، لە شاشەی «فرۆشتن».",
    },
  "This needs the database update 0069, which has not been applied yet.": {
    ar: "يحتاج هذا إلى تحديث قاعدة البيانات 0069، ولم يُطبَّق بعد.",
    ckb: "ئەمە پێویستی بە نوێکردنەوەی 0069ی بنکەی زانیارییە، کە هێشتا جێبەجێ نەکراوە.",
  },
  "Way to pay": { ar: "طريقة الدفع", ckb: "ڕێگای پارەدان" },
  "Its account": { ar: "حسابها", ckb: "هەژمارەکەی" },
  "At the till": { ar: "على الكاشير", ckb: "لە کاشێر" },
  offered: { ar: "معروضة", ckb: "پێشکەش دەکرێت" },
  "out of use": { ar: "متوقفة", ckb: "لە کار خراوە" },
  "New name for {name}": { ar: "الاسم الجديد لـ{name}", ckb: "ناوی نوێ بۆ {name}" },
  Rename: { ar: "إعادة تسمية", ckb: "ناوگۆڕین" },
  "{name} added: the till offers it now.": {
    ar: "أُضيفت {name}: يعرضها الكاشير الآن.",
    ckb: "{name} زیاد کرا: ئێستا کاشێر پێشکەشی دەکات.",
  },
  "Renamed {name}: its account too.": {
    ar: "غُيّر الاسم إلى {name}: وحسابها أيضًا.",
    ckb: "ناوەکە کرا بە {name}: هەژمارەکەشی.",
  },
  "{name} is offered at the till again.": {
    ar: "تُعرض {name} على الكاشير من جديد.",
    ckb: "{name} دووبارە لە کاشێر پێشکەش دەکرێتەوە.",
  },
  "{name} is out of use: no longer offered at the till. Its account keeps what it holds.": {
    ar: "توقفت {name}: لم تعد تُعرض على الكاشير. ويحتفظ حسابها بما فيه.",
    ckb: "{name} لە کار خرا: ئیتر لە کاشێر پێشکەش ناکرێت. هەژمارەکەی ئەوەی تێیدایە دەیهێڵێتەوە.",
  },
  "Add with one press:": { ar: "أضف بضغطة واحدة:", ckb: "بە یەک پەنجەنان زیاد بکە:" },
  "Another way to pay, by its name": {
    ar: "طريقة دفع أخرى، باسمها",
    ckb: "ڕێگایەکی تری پارەدان، بە ناوەکەی",
  },
  "Another, by its name": { ar: "أخرى، باسمها", ckb: "یەکێکی تر، بە ناوەکەی" },

  // ------------------------------------------------- The till
  "The reference {name} shows (if any)": {
    ar: "المرجع الذي يُظهره {name} (إن وُجد)",
    ckb: "ئەو ژمارەی ئاماژەیەی {name} پیشانی دەدات (ئەگەر هەبێت)",
  },
  "Check the money has come into the café's account before you confirm.": {
    ar: "تحقّق من وصول المال إلى حساب المقهى قبل أن تؤكّد.",
    ckb: "پێش ئەوەی پشتڕاستی بکەیتەوە، بزانە پارەکە گەیشتۆتە هەژماری کافێکە.",
  },

  // ------------------------------------------------- Orders and refunds
  "Ref. {reference}": { ar: "المرجع {reference}", ckb: "ئاماژە {reference}" },
  "by {name}, the way it was paid": {
    ar: "عبر {name}، كما دُفع",
    ckb: "لە ڕێگەی {name}ەوە، وەک چۆن پارەکەی درا",
  },

  // ------------------------------------------------- Sales → Ways to Pay
  "Ways to Pay": { ar: "طرق الدفع", ckb: "ڕێگاکانی پارەدان" },
  "FIB, FastPay and the like · what each account holds until it is moved · the fee to 6500": {
    ar: "FIB وFastPay وأمثالهما · ما في كل حساب حتى يُنقل · والرسوم إلى 6500",
    ckb: "FIB و FastPay و هاوشێوەکانیان · ئەوەی لە هەر هەژمارێکدایە تا دەگوازرێتەوە · کرێکە بۆ 6500",
  },
  "Paid through FIB, FastPay, ZainCash or Qi Card too?": {
    ar: "هل يُدفع لكم عبر FIB أو FastPay أو ZainCash أو Qi Card أيضًا؟",
    ckb: "پارەتان لە ڕێگەی FIB یان FastPay یان ZainCash یان Qi Cardەوە پێدەدرێت؟",
  },
  "Add them on Settings → Ways to pay.": {
    ar: "أضفها من «الإعدادات» ← «طرق الدفع».",
    ckb: "لە «ڕێکخستنەکان» ← «ڕێگاکانی پارەدان» زیادیان بکە.",
  },
  "a charge": { ar: "رسوم", ckb: "کرێیەک" },
  "account {code}": { ar: "الحساب {code}", ckb: "هەژماری {code}" },
  "Money from": { ar: "المال من", ckb: "پارە لە" },
  "Money to": { ar: "المال إلى", ckb: "پارە بۆ" },
  "the safe, as cash": { ar: "الخزنة، نقدًا", ckb: "قاسەکە، بە کاش" },
  "Nowhere: a charge alone": { ar: "لا مكان: رسوم فقط", ckb: "هیچ شوێنێک: تەنها کرێ" },
  "What arrived (IQD)": { ar: "ما وصل (دينار)", ckb: "ئەوەی گەیشت (دینار)" },
  "The charge (IQD)": { ar: "الرسوم (دينار)", ckb: "کرێکە (دینار)" },
  "Fee kept (IQD)": { ar: "الرسوم المقتطعة (دينار)", ckb: "کرێی بڕدراو (دینار)" },
  "The charge": { ar: "الرسوم", ckb: "کرێکە" },
  "Fee kept": { ar: "الرسوم المقتطعة", ckb: "کرێی بڕدراو" },
  "The day it moved": { ar: "يوم النقل", ckb: "ڕۆژی گواستنەوە" },
  "Reference (optional)": { ar: "المرجع (اختياري)", ckb: "ژمارەی ئاماژە (ئارەزوومەندانە)" },
  "Reference of the move": { ar: "مرجع النقل", ckb: "ژمارەی ئاماژەی گواستنەوەکە" },
  "Note on the move": { ar: "ملاحظة على النقل", ckb: "تێبینی لەسەر گواستنەوەکە" },
  "Record the charge": { ar: "سجّل الرسوم", ckb: "کرێکە تۆمار بکە" },
  "Move money": { ar: "انقل المال", ckb: "پارە بگوازەرەوە" },
  "Money moves out of a way to pay's account, or into one; the bank and the safe move cash on Move Cash.":
    {
      ar: "يُنقل المال من حساب طريقة دفع أو إليه؛ أما البنك والخزنة فينقلان النقد من «نقل النقد».",
      ckb: "پارە لە هەژماری ڕێگایەکی پارەدانەوە دەگوازرێتەوە یان بۆ ناوی؛ بانک و قاسەش کاش لە «گواستنەوەی پارە» دەگوازنەوە.",
    },
  "Charge of {fee} taken by {from} recorded (journal {journal}).": {
    ar: "سُجّلت رسوم {fee} أخذها {from} (القيد {journal}).",
    ckb: "کرێی {fee} کە {from} بردی تۆمار کرا (تۆماری {journal}).",
  },
  "The move is cancelled: its journal is reversed today.": {
    ar: "أُلغي النقل: وعُكس قيده اليوم.",
    ckb: "گواستنەوەکە هەڵوەشێنرایەوە: تۆمارەکەی ئەمڕۆ هەڵگەڕێندرایەوە.",
  },
  "From → to": { ar: "من ← إلى", ckb: "لە ← بۆ" },
  "Cancelled {when}: {reason}": {
    ar: "أُلغي {when}: {reason}",
    ckb: "هەڵوەشێنرایەوە {when}: {reason}",
  },
  "journal {no}": { ar: "القيد {no}", ckb: "تۆماری {no}" },
  "Cancel the move": { ar: "ألغِ النقل", ckb: "گواستنەوەکە هەڵبوەشێنەوە" },
  "Money moved": { ar: "نقل أموال", ckb: "گواستنەوەی پارە" },

  // ------------------------------------------------- Reports and the end of the day
  "Moved out": { ar: "المنقول منها", ckb: "گوازراوە" },
  "In its account on {day}": { ar: "في حسابها يوم {day}", ckb: "لە هەژمارەکەیدا لە {day}" },
  "The café's own ways to pay, each with its own account: what it took, what refunds gave back by it, what was moved out of its account in the dates and the fees the bank or the app kept, and what the account held at the end. Money is moved on Sales → Ways to Pay.":
    {
      ar: "طرق الدفع الخاصة بالمقهى، لكلٍّ منها حسابها: ما استلمته، وما أعادته المرتجعات عبرها، وما نُقل من حسابها في هذه الأيام والرسوم التي اقتطعها البنك أو التطبيق، وما كان في الحساب في النهاية. يُنقل المال من «المبيعات» ← «طرق الدفع».",
      ckb: "ڕێگاکانی پارەدانی خودی کافێکە، هەر یەکەیان بە هەژماری خۆیەوە: ئەوەی وەریگرت، ئەوەی گەڕاندنەوەکان لە ڕێگەیەوە دایانەوە، ئەوەی لەم ڕۆژانەدا لە هەژمارەکەی گوازرایەوە و ئەو کرێیەی بانک یان ئەپەکە بردی، و ئەوەی لە کۆتاییدا لە هەژمارەکەدا بوو. پارە لە «فرۆشتن» ← «ڕێگاکانی پارەدان» دەگوازرێتەوە.",
    },
  "The café's own ways to pay, at this place: what each took, and what refunds gave back by it. Their accounts are the café's: see them for all places.":
    {
      ar: "طرق الدفع الخاصة بالمقهى في هذا المكان: ما استلمته كلٌّ منها، وما أعادته المرتجعات عبرها. حساباتها للمقهى كله: اطّلع عليها لجميع الأماكن.",
      ckb: "ڕێگاکانی پارەدانی خودی کافێکە لەم شوێنەدا: ئەوەی هەر یەکەیان وەریگرت، و ئەوەی گەڕاندنەوەکان لە ڕێگەیەوە دایانەوە. هەژمارەکانیان هی هەموو کافێکەن: بۆ هەموو شوێنەکان سەیریان بکە.",
    },
  "{name} today: {amount} from {n} sale(s). Check it against {name}'s own list.": {
    ar: "{name} اليوم: {amount} من {n, plural, one {عملية بيع واحدة} two {عمليتي بيع} few {# عمليات بيع} other {# عملية بيع}}. طابقه مع قائمة {name} نفسها.",
    ckb: "{name} ئەمڕۆ: {amount} لە {n} فرۆشتن. لەگەڵ لیستی خودی {name} بەراوردی بکە.",
  },

  // ------------------------------------------------- On the audit trail
  "Way to pay added": { ar: "إضافة طريقة دفع", ckb: "زیادکردنی ڕێگای پارەدان" },
  "Way to pay changed": { ar: "تعديل طريقة دفع", ckb: "گۆڕینی ڕێگای پارەدان" },
  "Move of money cancelled": { ar: "إلغاء نقل أموال", ckb: "هەڵوەشاندنەوەی گواستنەوەی پارە" },
  "A way to pay": { ar: "طريقة دفع", ckb: "ڕێگایەکی پارەدان" },
  "A move of money": { ar: "نقل أموال", ckb: "گواستنەوەیەکی پارە" },

  // ------------------------------------------------- What the actions check
  "a way to pay": { ar: "طريقة دفع", ckb: "ڕێگایەکی پارەدان" },
  "a move of money": { ar: "نقل أموال", ckb: "گواستنەوەیەکی پارە" },
  "The fee": { ar: "الرسوم", ckb: "کرێکە" },
};

export default phrases;
