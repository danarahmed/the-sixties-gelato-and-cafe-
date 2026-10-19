import type { PhraseBook } from "./types";

/**
 * The books completed (round twenty-four, 0081): equipment and its monthly
 * depreciation, the owner's money, another bank, a loan.
 */
const phrases: PhraseBook = {
  // Equipment.
  "Worth in the books: {amount}": {
    ar: "القيمة في الدفاتر: {amount}",
    ckb: "بەها لە دەفتەرەکاندا: {amount}",
  },
  "Depreciation waits for {n} months gone.": {
    ar: "الإهلاك ينتظر {n} أشهر مضت.",
    ckb: "داشکانی بەها چاوەڕێی {n} مانگی ڕابردووە.",
  },
  "Post it": { ar: "سجّله", ckb: "تۆماری بکە" },
  "No equipment yet. Add the oven, the machines and the fridges: each month's share of what they cost is then a cost of that month.":
    {
      ar: "لا معدات بعد. أضف الفرن والآلات والثلاجات: يصبح نصيب كل شهر من كلفتها كلفةً لذلك الشهر.",
      ckb: "هێشتا هیچ ئامێرێک نییە. فڕن، ئامێرەکان و سەلاجەکان زیاد بکە: بەشی هەر مانگێک لە نرخیان دەبێتە تێچووی ئەو مانگە.",
    },
  "A month": { ar: "في الشهر", ckb: "مانگانە" },
  Depreciated: { ar: "المُهلَك", ckb: "داشکاوە" },
  "Worth now": { ar: "القيمة الآن", ckb: "بەهای ئێستا" },
  "Gone on {date}": { ar: "خرج في {date}", ckb: "لە {date} ڕۆیشت" },
  "Bought {date} · {months} months": {
    ar: "اشتُري {date} · {months} شهرًا",
    ckb: "کڕدرا {date} · {months} مانگ",
  },
  "Sold or thrown out": { ar: "بيع أو رُمي", ckb: "فرۆشرا یان فڕێدرا" },
  "What it fetched (0 when thrown out)": {
    ar: "ما جلبه (0 إن رُمي)",
    ckb: "ئەوەی پێی فرۆشرا (0 ئەگەر فڕێدرا)",
  },
  "Add equipment": { ar: "أضف معدات", ckb: "ئامێر زیاد بکە" },
  "Months it will be used": { ar: "أشهر الاستخدام", ckb: "ئەو مانگانەی بەکاردێت" },
  "Worth at the end (0 if nothing)": {
    ar: "القيمة في النهاية (0 إن لا شيء)",
    ckb: "بەها لە کۆتاییدا (0 ئەگەر هیچ)",
  },
  "Bought on": { ar: "اشتُري في", ckb: "ڕۆژی کڕین" },
  "How was it paid?": { ar: "كيف دُفع؟", ckb: "چۆن پارەکەی درا؟" },
  "From the bank": { ar: "من البنك", ckb: "لە بانکەوە" },
  "From the safe": { ar: "من الخزنة", ckb: "لە سندوقی پارەوە" },
  "With the owner's own money": { ar: "من مال المالك", ckb: "بە پارەی خاوەن" },
  "On a supplier's bill": { ar: "على فاتورة مورّد", ckb: "لەسەر پسوولەی دابینکەر" },
  "Bought before: in the books already": {
    ar: "اشتُري سابقًا: في الدفاتر أصلًا",
    ckb: "پێشتر کڕدرا: لە دەفتەرەکاندا هەیە",
  },
  "With the loan {name}": { ar: "بالقرض {name}", ckb: "بە قەرزی {name}" },
  "{amount} a month for {months} months": {
    ar: "{amount} شهريًا لمدة {months} شهرًا",
    ckb: "مانگانە {amount} بۆ {months} مانگ",
  },
  "Add it": { ar: "أضفه", ckb: "زیادی بکە" },
  // The owner's money.
  "The owner's money": { ar: "مال المالك", ckb: "پارەی خاوەن" },
  "Which way?": { ar: "أي اتجاه؟", ckb: "بە کام ئاڕاستە؟" },
  "The owner puts money in": { ar: "المالك يُدخل مالًا", ckb: "خاوەن پارە دەخاتە ناوەوە" },
  "The owner takes money out": { ar: "المالك يسحب مالًا", ckb: "خاوەن پارە دەردەهێنێت" },
  "Where?": { ar: "أين؟", ckb: "لە کوێ؟" },
  "Record it": { ar: "سجّله", ckb: "تۆماری بکە" },
  "Recorded.": { ar: "سُجّل.", ckb: "تۆمار کرا." },
  // The chart of accounts.
  "Another bank account": { ar: "حساب بنكي آخر", ckb: "حیسابی بانکی تر" },
  "A loan": { ar: "قرض", ckb: "قەرز" },
  "A kind of equipment": { ar: "نوع من المعدات", ckb: "جۆرێک لە ئامێر" },
  "Another bank's code is from 1021 to 1029. It counts as cash in the cash flow.": {
    ar: "رمز البنك الآخر من 1021 إلى 1029. يُعدّ نقدًا في التدفق النقدي.",
    ckb: "کۆدی بانکی تر لە 1021 تا 1029. لە ڕەوتی پارەدا وەک پارە هەژمار دەکرێت.",
  },
  "A loan's code is from 2400 to 2499. Money borrowed and paid back moves it.": {
    ar: "رمز القرض من 2400 إلى 2499. يتحرك بالمال المقترض والمسدَّد.",
    ckb: "کۆدی قەرز لە 2400 تا 2499. بە پارەی قەرزکراو و گەڕێنراوە دەجوڵێت.",
  },
  "A kind of equipment's code is from 1501 to 1589.": {
    ar: "رمز نوع المعدات من 1501 إلى 1589.",
    ckb: "کۆدی جۆری ئامێر لە 1501 تا 1589.",
  },
  // The audit trail.
  "Equipment added": { ar: "أُضيفت معدات", ckb: "ئامێر زیاد کرا" },
  "Depreciation posted": { ar: "سُجّل الإهلاك", ckb: "داشکانی بەها تۆمار کرا" },
  "Equipment sold or thrown out": { ar: "بيعت المعدات أو رُميت", ckb: "ئامێر فرۆشرا یان فڕێدرا" },
  // Refusals.
  "Name the equipment": { ar: "سمِّ المعدات", ckb: "ناوی ئامێرەکە بنووسە" },
  "Enter what it cost": { ar: "أدخل ما كلّفه", ckb: "نرخەکەی بنووسە" },
  "What it is worth at the end is less than what it cost": {
    ar: "قيمته في النهاية أقل مما كلّفه",
    ckb: "بەهای کۆتایی کەمترە لە نرخەکەی",
  },
  "It is used for 1 to 600 months": {
    ar: "يُستخدم من 1 إلى 600 شهر",
    ckb: "لە 1 تا 600 مانگ بەکاردێت",
  },
  "It was bought on a day up to today": {
    ar: "اشتُري في يوم حتى اليوم",
    ckb: "لە ڕۆژێکدا تا ئەمڕۆ کڕدراوە",
  },
  "Choose a kind of equipment from the chart": {
    ar: "اختر نوع المعدات من الدليل",
    ckb: "جۆری ئامێر لە لیستی حیسابەکان هەڵبژێرە",
  },
  "Say how it was paid: the bank, the safe, the owner, a supplier's bill or a loan": {
    ar: "قل كيف دُفع: البنك أو الخزنة أو المالك أو فاتورة مورّد أو قرض",
    ckb: "بڵێ چۆن پارەکەی درا: بانک، سندوقی پارە، خاوەن، پسوولەی دابینکەر یان قەرز",
  },
  "Equipment not found": { ar: "المعدات غير موجودة", ckb: "ئامێرەکە نەدۆزرایەوە" },
  "{1} is gone already": { ar: "{1} خرج أصلًا", ckb: "{1} پێشتر ڕۆیشتووە" },
  "It went on a day from when it was bought up to today": {
    ar: "خرج في يوم بين شرائه واليوم",
    ckb: "لە نێوان ڕۆژی کڕین و ئەمڕۆدا ڕۆیشت",
  },
  "Enter what it fetched, 0 or more": {
    ar: "أدخل ما جلبه، 0 أو أكثر",
    ckb: "ئەوەی پێی فرۆشرا بنووسە، 0 یان زیاتر",
  },
  "Say where the money went: the bank or the safe": {
    ar: "قل أين ذهب المال: البنك أو الخزنة",
    ckb: "بڵێ پارەکە چووە کوێ: بانک یان سندوقی پارە",
  },
  "An account added here is an income, a cost, a bank, a loan or a kind of equipment": {
    ar: "الحساب الذي يُضاف هنا دخل أو كلفة أو بنك أو قرض أو نوع معدات",
    ckb: "ئەو حیسابەی لێرە زیاد دەکرێت داهات، تێچوو، بانک، قەرز یان جۆری ئامێرە",
  },
  "Another bank's code is from 1021 to 1029": {
    ar: "رمز البنك الآخر من 1021 إلى 1029",
    ckb: "کۆدی بانکی تر لە 1021 تا 1029",
  },
  "A loan's code is from 2400 to 2499": {
    ar: "رمز القرض من 2400 إلى 2499",
    ckb: "کۆدی قەرز لە 2400 تا 2499",
  },
  "A kind of equipment's code is from 1501 to 1589": {
    ar: "رمز نوع المعدات من 1501 إلى 1589",
    ckb: "کۆدی جۆری ئامێر لە 1501 تا 1589",
  },
  "the equipment": { ar: "المعدات", ckb: "ئامێرەکە" },
  // What wrote a journal (journal_source_hint, 0081).
  "a customer's payment on account": {
    ar: "دفعة زبون على حسابه",
    ckb: "پارەدانی کڕیارێک بۆ حسابەکەی",
  },
  "equipment bought (record it sold or thrown out on Accounting instead)": {
    ar: "معدات اشتُريت (سجّلها مبيعة أو مرمية في المحاسبة بدلًا من ذلك)",
    ckb: "ئامێرێکی کڕدراو (لە جیاتی ئەوە لە ژمێریاری وەک فرۆشراو یان فڕێدراو تۆماری بکە)",
  },
  "equipment sold or thrown out": {
    ar: "معدات بيعت أو رُميت",
    ckb: "ئامێرێکی فرۆشراو یان فڕێدراو",
  },
  "a month's depreciation of the equipment": {
    ar: "إهلاك شهر للمعدات",
    ckb: "داشکانی بەهای مانگێکی ئامێرەکان",
  },
};

export default phrases;
