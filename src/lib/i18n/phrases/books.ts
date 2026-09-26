import type { PhraseBook } from "./types";

/**
 * The accountant's screens: Journals, Accounting, Expenses, an account's ledger, closing a period, and their forms and messages.
 */
const phrases: PhraseBook = {
  // Journals: the register.
  "The lines behind the figure": {
    ar: "سطور القيود التي يتكوّن منها الرقم",
    ckb: "ئەو هێڵانەی تۆمار کە ژمارەکە پێکدەهێنن",
  },
  "Every entry in the book, by number, newest first": {
    ar: "كل قيد في الدفتر، حسب الرقم، والأحدث أولًا",
    ckb: "هەموو تۆمارێکی دەفتەرەکە، بەپێی ژمارە، نوێترین لە سەرەوە",
  },
  "{n} draft": { ar: "مسودات: {n}", ckb: "ڕەشنووس: {n}" },
  // A period's state, after its name ("2026-09 open").
  locked: { ar: "مقفلة", ckb: "قفڵکراو" },
  "New Journal": { ar: "قيد جديد", ckb: "تۆماری نوێ" },
  "Debits must equal credits before it can be published": {
    ar: "يجب أن يتساوى المدين والدائن قبل ترحيل القيد",
    ckb: "پێش پەسەندکردن دەبێت مەدین و دائین یەکسان بن",
  },
  "Journal Register": { ar: "سجل القيود", ckb: "لیستی تۆمارەکان" },
  All: { ar: "الكل", ckb: "هەموو" },
  "Manual and reversals": { ar: "اليدوية والعكسية", ckb: "دەستی و هەڵگەڕاندنەوەکان" },
  "No journal entries yet": { ar: "لا توجد قيود بعد", ckb: "هێشتا هیچ تۆمارێک نییە" },
  "Sales, receipts, bills, payments, expenses, drawer counts and cash moved all write here, as do journals posted by hand.":
    {
      ar: "المبيعات والاستلامات والفواتير والمدفوعات والمصروفات وجرد الدرج ونقل النقد كلها تُكتب هنا، وكذلك القيود المرحّلة يدويًا.",
      ckb: "فرۆشتن، وەرگرتن، پسووڵە، پارەدان، خەرجی، ژماردنی دەخیلە و گواستنەوەی کاش هەموویان لێرە دەنووسرێن، هەروەها تۆمارە دەستییەکانیش.",
    },
  "Journal #": { ar: "رقم القيد", ckb: "ژمارەی تۆمار" },
  Reference: { ar: "المرجع", ckb: "سەرچاوە" },
  // A journal's narration: its column, its field, and the check of it.
  Notes: { ar: "البيان", ckb: "تێبینی" },
  "Posted by": { ar: "رُحِّل بواسطة", ckb: "تۆمارکراوە لەلایەن" },
  "A published entry can never be edited or deleted — the database refuses it. A mistake is corrected by reversing the entry, so the history of the book stays intact. Only a draft, which has not reached the books, may be discarded. Numbers are given in order when an entry is published, with no gaps.":
    {
      ar: "لا يمكن أبدًا تعديل القيد المُرحَّل أو حذفه — فقاعدة البيانات ترفض ذلك. يُصحَّح الخطأ بعكس القيد، فيبقى تاريخ الدفتر سليمًا. وحدها المسودة، التي لم تصل إلى الدفاتر، يمكن حذفها. تُعطى الأرقام بالتسلسل عند ترحيل القيد، بلا فجوات.",
      ckb: "تۆمارێکی پەسەندکراو هەرگیز دەستکاری ناکرێت و ناسڕدرێتەوە — بنکەدراوەکە ڕەتی دەکاتەوە. هەڵە بە هەڵگەڕاندنەوەی تۆمارەکە ڕاست دەکرێتەوە، بۆ ئەوەی مێژووی دەفتەرەکە وەک خۆی بمێنێتەوە. تەنها ڕەشنووس، کە نەگەیشتۆتە دەفتەرەکان، دەکرێت فڕێ بدرێت. ژمارەکان لە کاتی پەسەندکردنی تۆمارەکەدا بە ڕیز دەدرێن، بێ بۆشایی.",
    },
  "{n} entry is marked “before controls”: recorded before these rules existed, kept as they were, and reported for review (docs/REMEDIATION.md).":
    {
      ar: "{n} قيد موسوم «قبل الضوابط»: سُجّل قبل وجود هذه القواعد، وبقي كما كان، ويُبلَّغ عنه للمراجعة (docs/REMEDIATION.md).",
      ckb: "{n} تۆمار بە «پێش کۆنترۆڵەکان» نیشانە کراوە: پێش بوونی ئەم یاسایانە تۆمار کراوە، وەک خۆی هێڵراوەتەوە و بۆ پێداچوونەوە ڕاپۆرت کراوە (docs/REMEDIATION.md).",
    },
  "{n} entries are marked “before controls”: recorded before these rules existed, kept as they were, and reported for review (docs/REMEDIATION.md).":
    {
      ar: "القيود الموسومة «قبل الضوابط»: {n}. سُجّلت قبل وجود هذه القواعد، وبقيت كما كانت، ويُبلَّغ عنها للمراجعة (docs/REMEDIATION.md).",
      ckb: "{n} تۆمار بە «پێش کۆنترۆڵەکان» نیشانە کراون: پێش بوونی ئەم یاسایانە تۆمار کراون، وەک خۆیان هێڵراونەتەوە و بۆ پێداچوونەوە ڕاپۆرت کراون (docs/REMEDIATION.md).",
    },
  Shown: { ar: "المعروض", ckb: "پیشاندراو" },
  "All sources": { ar: "كل المصادر", ckb: "هەموو سەرچاوەکان" },
  Drafts: { ar: "المسودات", ckb: "ڕەشنووسەکان" },
  "Not in the books; block the period close": {
    ar: "ليست في الدفاتر، وتمنع إقفال الفترة",
    ckb: "لە دەفتەرەکاندا نین؛ ڕێگری لە داخستنی ماوەکە دەکەن",
  },
  "Published, shown": { ar: "المُرحَّل من المعروض", ckb: "پەسەندکراوەکانی پیشاندراو" },
  "Total debits": { ar: "مجموع المدين", ckb: "کۆی مەدین" },
  "Next number": { ar: "الرقم التالي", ckb: "ژمارەی داهاتوو" },
  "Given on publish": { ar: "يُعطى عند الترحيل", ckb: "لە کاتی پەسەندکردندا دەدرێت" },

  // A new journal (JournalEntryForm).
  "For anything that is not a sale, a receipt, a bill, a payment or an expense. Stock, payables, goods-received and retained earnings are kept by their own records and take no manual journal.":
    {
      ar: "لكل ما ليس بيعًا أو استلامًا أو فاتورة أو دفعة أو مصروفًا. المخزون والدائنون والبضاعة المستلمة والأرباح المحتجزة تُمسك بسجلاتها الخاصة ولا تقبل قيدًا يدويًا.",
      ckb: "بۆ هەر شتێک کە فرۆشتن، وەرگرتن، پسووڵە، پارەدان یان خەرجی نەبێت. کۆگا، قەرزە دانەدراوەکان، کاڵای وەرگیراو و قازانجی هەڵگیراو بە تۆمارەکانی خۆیان ڕادەگیرێن و هیچ تۆمارێکی دەستی وەرناگرن.",
    },
  "Reverse on (optional)": { ar: "يُعكس في (اختياري)", ckb: "هەڵگەڕاندنەوە لە (ئارەزوومەندانە)" },
  "{n} (given on publish)": {
    ar: "{n} (يُعطى عند الترحيل)",
    ckb: "{n} (لە کاتی پەسەندکردندا دەدرێت)",
  },
  "Reference #": { ar: "رقم المرجع", ckb: "ژمارەی سەرچاوە" },
  Currency: { ar: "العملة", ckb: "دراو" },
  "Correction to a control account (the till's cash, Inventory, payables, goods received, retained earnings) — owner only, with a reason on the audit trail. For repairing history recorded before the controls; see docs/REMEDIATION.md.":
    {
      ar: "تصحيح على حساب رقابي (نقد نقطة البيع، المخزون، الدائنون، البضاعة المستلمة، الأرباح المحتجزة) — للمالك فقط، مع سبب يُسجَّل في سجل التدقيق. لإصلاح تاريخ سُجّل قبل الضوابط؛ راجع docs/REMEDIATION.md.",
      ckb: "ڕاستکردنەوەی هەژمارێکی کۆنترۆڵ (کاشی خاڵی فرۆشتن، کۆگا، قەرزە دانەدراوەکان، کاڵای وەرگیراو، قازانجی هەڵگیراو) — تەنها بۆ خاوەن، لەگەڵ هۆکارێک لە تۆماری گۆڕانکارییەکاندا. بۆ چاککردنەوەی مێژوویەک کە پێش کۆنترۆڵەکان تۆمار کراوە؛ بڕوانە docs/REMEDIATION.md.",
    },
  "Reason for the correction": { ar: "سبب التصحيح", ckb: "هۆکاری ڕاستکردنەوە" },
  "What was wrong, and how this entry puts it right": {
    ar: "ما الخطأ، وكيف يصحّحه هذا القيد",
    ckb: "چی هەڵە بوو، و ئەم تۆمارە چۆن ڕاستی دەکاتەوە",
  },
  "Being the reason this entry is made": {
    ar: "وذلك عن سبب إجراء هذا القيد",
    ckb: "ئەمەش بۆ هۆکاری ئەم تۆمارە",
  },
  "On publishing, a mirror entry dated {date} is posted too, reversing every line below.": {
    ar: "عند الترحيل يُرحَّل أيضًا قيد معاكس بتاريخ {date}، يعكس كل سطر أدناه.",
    ckb: "لە کاتی پەسەندکردندا تۆمارێکی پێچەوانەش بە بەرواری {date} تۆمار دەکرێت، کە هەموو هێڵەکانی خوارەوە هەڵدەگەڕێنێتەوە.",
  },
  Description: { ar: "الوصف", ckb: "وەسف" },
  Debits: { ar: "المدين", ckb: "مەدین" },
  Credits: { ar: "الدائن", ckb: "دائین" },
  "Select an account": { ar: "اختر حسابًا", ckb: "هەژمارێک هەڵبژێرە" },
  "Remove line": { ar: "إزالة السطر", ckb: "لابردنی هێڵ" },
  "+ Add line": { ar: "+ إضافة سطر", ckb: "+ زیادکردنی هێڵ" },
  Difference: { ar: "الفرق", ckb: "جیاوازی" },
  "Save and publish": { ar: "حفظ وترحيل", ckb: "پاشەکەوتکردن و پەسەندکردن" },
  "Save as draft": { ar: "حفظ كمسودة", ckb: "پاشەکەوتکردن وەک ڕەشنووس" },
  "Debits and credits must agree before it can be published.": {
    ar: "يجب أن يتطابق المدين والدائن قبل ترحيل القيد.",
    ckb: "پێش پەسەندکردن دەبێت مەدین و دائین وەک یەک بن.",
  },
  "Correction published as journal {no}; the reason is on the audit trail.": {
    ar: "رُحِّل التصحيح بالقيد {no}؛ والسبب مسجّل في سجل التدقيق.",
    ckb: "ڕاستکردنەوەکە وەک تۆماری {no} پەسەند کرا؛ هۆکارەکە لە تۆماری گۆڕانکارییەکاندایە.",
  },
  "Journal {no} published.": { ar: "رُحِّل القيد {no}.", ckb: "تۆماری {no} پەسەند کرا." },
  "Journal {no} published; its reversal is journal {reversal}.": {
    ar: "رُحِّل القيد {no}؛ وقيد عكسه هو {reversal}.",
    ckb: "تۆماری {no} پەسەند کرا؛ تۆماری {reversal} هەڵیدەگەڕێنێتەوە.",
  },
  "Saved as a draft. It is not in the books until it is published.": {
    ar: "حُفظ كمسودة. لا يدخل الدفاتر حتى يُرحَّل.",
    ckb: "وەک ڕەشنووس پاشەکەوت کرا. تا پەسەند نەکرێت ناچێتە ناو دەفتەرەکانەوە.",
  },

  // One entry of the register (JournalRow): where it came from, and its voucher.
  Refund: { ar: "استرداد", ckb: "گەڕاندنەوەی پارە" },
  Receipt: { ar: "استلام", ckb: "وەرگرتن" },
  Bill: { ar: "فاتورة", ckb: "پسووڵە" },
  Payment: { ar: "دفعة", ckb: "پارەدان" },
  Expense: { ar: "مصروف", ckb: "خەرجی" },
  Stock: { ar: "مخزون", ckb: "کۆگا" },
  Count: { ar: "جرد", ckb: "ژماردن" },
  "Drawer count": { ar: "جرد الدرج", ckb: "ژماردنی دەخیلە" },
  "Cash moved": { ar: "نقل نقد", ckb: "گواستنەوەی کاش" },
  Manual: { ar: "يدوي", ckb: "دەستی" },
  "Year end": { ar: "نهاية السنة", ckb: "کۆتایی ساڵ" },
  draft: { ar: "مسودة", ckb: "ڕەشنووس" },
  Draft: { ar: "مسودة", ckb: "ڕەشنووس" },
  Published: { ar: "مُرحَّل", ckb: "پەسەندکراو" },
  "Recorded before the ledger controls; kept as it was and reported for review": {
    ar: "سُجّل قبل ضوابط الدفتر، وبقي كما كان ويُبلَّغ عنه للمراجعة",
    ckb: "پێش کۆنترۆڵەکانی دەفتەر تۆمار کراوە؛ وەک خۆی هێڵراوەتەوە و بۆ پێداچوونەوە ڕاپۆرت کراوە",
  },
  "before controls": { ar: "قبل الضوابط", ckb: "پێش کۆنترۆڵەکان" },
  "reverses #{no}": { ar: "يعكس #{no}", ckb: "#{no} هەڵدەگەڕێنێتەوە" },
  "reversed by #{no}": { ar: "عكسه #{no}", ckb: "بە #{no} هەڵگەڕێندراوەتەوە" },
  "Publish to the books": { ar: "ترحيل إلى الدفاتر", ckb: "پەسەندکردن و خستنە ناو دەفتەرەکان" },
  "Does not balance": { ar: "غير متوازن", ckb: "هاوسەنگ نییە" },
  Publish: { ar: "ترحيل", ckb: "پەسەندکردن" },
  Discard: { ar: "حذف", ckb: "فڕێدان" },
  Reverse: { ar: "عكس", ckb: "هەڵگەڕاندنەوە" },
  "Reverse journal {no} with a mirror entry dated": {
    ar: "اعكس القيد {no} بقيد معاكس بتاريخ",
    ckb: "تۆماری {no} هەڵبگەڕێنەوە بە تۆمارێکی پێچەوانە بە بەرواری",
  },
  "Date of the reversal": { ar: "تاريخ العكس", ckb: "بەرواری هەڵگەڕاندنەوە" },
  "Why is it being reversed?": { ar: "لماذا يُعكس؟", ckb: "بۆچی هەڵدەگەڕێندرێتەوە؟" },
  "Post reversal": { ar: "ترحيل العكس", ckb: "تۆمارکردنی هەڵگەڕاندنەوە" },
  "Journal {no}": { ar: "القيد {no}", ckb: "تۆماری {no}" },
  "(draft)": { ar: "(مسودة)", ckb: "(ڕەشنووس)" },
  "ref {ref}": { ar: "مرجع {ref}", ckb: "سەرچاوە {ref}" },
  // A voucher line's side, in a narrow column.
  Dr: { ar: "مدين", ckb: "مەدین" },
  Cr: { ar: "دائن", ckb: "دائین" },
  // A narration as the voucher gives it: "Being rent for September".
  "Being {text}": { ar: "وذلك عن {text}", ckb: "ئەمەش بۆ {text}" },
  "Balanced — {amount} both sides": {
    ar: "متوازن — {amount} لكل طرف",
    ckb: "هاوسەنگە — {amount} بۆ هەر لایەک",
  },
  "Out by {amount}": { ar: "غير متوازن بفارق {amount}", ckb: "هاوسەنگ نییە بە جیاوازی {amount}" },

  // An account's ledger (AccountLedger): the lines behind a figure.
  "Manual journal": { ar: "قيد يدوي", ckb: "تۆماری دەستی" },
  Delivery: { ar: "توريد", ckb: "گەیاندن" },
  "Supplier bill": { ar: "فاتورة مورّد", ckb: "پسووڵەی دابینکەر" },
  "Bill payment": { ar: "تسديد فاتورة", ckb: "پارەدانی پسووڵە" },
  "Stock count": { ar: "جرد المخزون", ckb: "ژماردنی کۆگا" },
  "Year-end close": { ar: "إقفال نهاية السنة", ckb: "داخستنی کۆتایی ساڵ" },
  "Owner's correction": { ar: "تصحيح المالك", ckb: "ڕاستکردنەوەی خاوەن" },
  "{from} to {to} · published entries": {
    ar: "من {from} إلى {to} · القيود المرحّلة",
    ckb: "لە {from} تا {to} · تۆمارە پەسەندکراوەکان",
  },
  "{from} to {to} · published entries · the year-end close left out, as on the P&L": {
    ar: "من {from} إلى {to} · القيود المرحّلة · دون إقفال نهاية السنة، كما في قائمة الأرباح والخسائر",
    ckb: "لە {from} تا {to} · تۆمارە پەسەندکراوەکان · بەبێ داخستنی کۆتایی ساڵ، وەک لە ڕاپۆرتی قازانج و زەرەر",
  },
  Narration: { ar: "البيان", ckb: "ڕوونکردنەوە" },
  Debit: { ar: "المدين", ckb: "مەدین" },
  Credit: { ar: "الدائن", ckb: "دائین" },
  Balance: { ar: "الرصيد", ckb: "باڵانس" },
  "Nothing posted in these dates.": {
    ar: "لم يُرحَّل شيء في هذه التواريخ.",
    ckb: "لەم بەروارانەدا هیچ تۆمار نەکراوە.",
  },
  "Total: {amount}": { ar: "المجموع: {amount}", ckb: "کۆی گشتی: {amount}" },
  "Movement, and closing balance": {
    ar: "الحركة، والرصيد الختامي",
    ckb: "جووڵە، و باڵانسی کۆتایی",
  },
  "The first {n} lines are shown; the CSV has them all.": {
    ar: "تُعرض أول {n} سطر؛ وملف CSV فيه كلها.",
    ckb: "یەکەم {n} هێڵ پیشان دراون؛ فایلی CSV هەموویانی تێدایە.",
  },
  "{n} line(s).": { ar: "عدد السطور: {n}.", ckb: "{n} هێڵ." },
  "Balances are debit-positive: a credit balance shows in brackets.": {
    ar: "الأرصدة موجبة في جانب المدين: يظهر الرصيد الدائن بين قوسين.",
    ckb: "باڵانسەکان لە لایەنی مەدین موجەبن: باڵانسی دائین لەناو کەوانەدا پیشان دەدرێت.",
  },
  "Back to the journal register": {
    ar: "العودة إلى سجل القيود",
    ckb: "گەڕانەوە بۆ لیستی تۆمارەکان",
  },

  // Accounting: the trial balance.
  "Trial balance & closing the period": {
    ar: "ميزان المراجعة وإقفال الفترة",
    ckb: "تەرازووی پێداچوونەوە و داخستنی ماوە",
  },
  "Period debits equal credits": {
    ar: "مدين الفترة يساوي دائنها",
    ckb: "مەدینی ماوەکە یەکسانە بە دائینەکەی",
  },
  "Period debits do not equal credits": {
    ar: "مدين الفترة لا يساوي دائنها",
    ckb: "مەدینی ماوەکە یەکسان نییە بە دائینەکەی",
  },
  "Trial Balance": { ar: "ميزان المراجعة", ckb: "تەرازووی پێداچوونەوە" },
  "{from} to {to} · published entries only · {currency}": {
    ar: "من {from} إلى {to} · القيود المرحّلة فقط · {currency}",
    ckb: "لە {from} تا {to} · تەنها تۆمارە پەسەندکراوەکان · {currency}",
  },
  "A/C": { ar: "رقم الحساب", ckb: "ژمارەی هەژمار" },
  Class: { ar: "النوع", ckb: "جۆر" },
  Opening: { ar: "الرصيد الافتتاحي", ckb: "باڵانسی سەرەتا" },
  Closing: { ar: "الرصيد الختامي", ckb: "باڵانسی کۆتایی" },
  "Nothing posted up to the end of this period.": {
    ar: "لم يُرحَّل شيء حتى نهاية هذه الفترة.",
    ckb: "تا کۆتایی ئەم ماوەیە هیچ تۆمار نەکراوە.",
  },
  "The lines behind it": {
    ar: "سطور القيود التي وراءه",
    ckb: "ئەو هێڵانەی تۆمار کە لە پشتیەوەن",
  },
  "Totals for the period": { ar: "مجاميع الفترة", ckb: "کۆی گشتی ماوەکە" },
  "Open an account for the journal lines behind it. Opening and closing balances are debit-positive (a credit balance shows in brackets). Drafts are excluded; so is anything outside the dates shown. That the debits equal the credits is guaranteed by the database for every published entry — whether the books are <em>right</em> is shown by the reconciliation on <reports>Reports</reports>, which compares each subledger with its control account.":
    {
      ar: "افتح حسابًا لترى سطور القيود التي وراءه. الأرصدة الافتتاحية والختامية موجبة في جانب المدين (يظهر الرصيد الدائن بين قوسين). المسودات مستبعدة، وكذلك كل ما يقع خارج التواريخ المعروضة. تضمن قاعدة البيانات تساوي المدين والدائن في كل قيد مُرحَّل — أما هل الدفاتر <em>صحيحة</em> فتُظهره المطابقة في <reports>التقارير</reports>، التي تقارن كل دفتر فرعي بحسابه الرقابي.",
      ckb: "هەژمارێک بکەرەوە بۆ ئەوەی هێڵەکانی تۆمار لە پشتیەوە ببینیت. باڵانسی سەرەتا و کۆتایی لە لایەنی مەدین موجەبن (باڵانسی دائین لەناو کەوانەدا پیشان دەدرێت). ڕەشنووسەکان دەرکراون؛ هەروەها هەر شتێک لە دەرەوەی ئەو بەروارانەی پیشان دراون. یەکسانی مەدین و دائین لە هەموو تۆمارێکی پەسەندکراودا بنکەدراوەکە مسۆگەری دەکات — بەڵام ئایا دەفتەرەکان <em>دروستن</em>، ئەوە هاوتاکردنەکەی ناو <reports>ڕاپۆرتەکان</reports> پیشانی دەدات، کە هەر دەفتەرێکی لاوەکی لەگەڵ هەژماری کۆنترۆڵەکەی بەراورد دەکات.",
    },
  "Who changed what — prices, products, items, suppliers, settings, and every void, refund, count and correction — is on the <audit>audit trail</audit>, with the values before and after.":
    {
      ar: "مَن غيّر ماذا — الأسعار والمنتجات والمواد والمورّدين والإعدادات، وكل إلغاء واسترداد وجرد وتصحيح — مسجّل في <audit>سجل التدقيق</audit>، مع القيم قبل التغيير وبعده.",
      ckb: "کێ چی گۆڕی — نرخەکان، بەرهەمەکان، کاڵاکان، دابینکەران، ڕێکخستنەکان، و هەموو هەڵوەشاندنەوە، گەڕاندنەوەی پارە، ژماردن و ڕاستکردنەوەیەک — لە <audit>تۆماری گۆڕانکارییەکان</audit>دایە، لەگەڵ بەهاکان پێش و دوای گۆڕان.",
    },
  // An account's class.
  Asset: { ar: "أصل", ckb: "سامان" },
  Liability: { ar: "التزام", ckb: "قەرز" },
  Equity: { ar: "حقوق ملكية", ckb: "سەرمایە" },
  Income: { ar: "إيراد", ckb: "داهات" },

  // Closing a period (PeriodControl).
  "Close {period}": { ar: "إقفال الفترة {period}", ckb: "داخستنی ماوەی {period}" },
  Locked: { ar: "مقفلة", ckb: "قفڵکراوە" },
  "Locked {when}": { ar: "أُقفلت في {when}", ckb: "لە {when} قفڵ کرا" },
  "Locked by {name}": { ar: "أقفلها {name}", ckb: "{name} قفڵی کرد" },
  "Locked {when} by {name}": { ar: "أقفلها {name} في {when}", ckb: "{name} لە {when} قفڵی کرد" },
  "Every check must pass before the period can be locked": {
    ar: "يجب أن تنجح كل الفحوصات قبل قفل الفترة",
    ckb: "پێش قفڵکردنی ماوەکە دەبێت هەموو پشکنینەکان سەرکەوتوو بن",
  },
  "Note for the audit trail (optional)": {
    ar: "ملاحظة لسجل التدقيق (اختيارية)",
    ckb: "تێبینی بۆ تۆماری گۆڕانکارییەکان (ئارەزوومەندانە)",
  },
  "Locking…": { ar: "جارٍ القفل…", ckb: "قفڵ دەکرێت…" },
  "Lock {period}": { ar: "قفل {period}", ckb: "قفڵکردنی {period}" },
  "Resolve the {n} failing check(s) first.": {
    ar: "عالج أولًا الفحوصات التي لم تنجح ({n}).",
    ckb: "سەرەتا پشکنینە سەرنەکەوتووەکان چارەسەر بکە ({n}).",
  },
  "Why must it be reopened? (required)": {
    ar: "لماذا يجب إعادة فتحها؟ (مطلوب)",
    ckb: "بۆچی دەبێت دووبارە بکرێتەوە؟ (پێویستە)",
  },
  "Reopening…": { ar: "جارٍ إعادة الفتح…", ckb: "دووبارە دەکرێتەوە…" },
  "Reopen {period}": { ar: "إعادة فتح {period}", ckb: "دووبارە کردنەوەی {period}" },
  "Only the owner can reopen a locked period.": {
    ar: "وحده المالك يستطيع إعادة فتح فترة مقفلة.",
    ckb: "تەنها خاوەن دەتوانێت ماوەیەکی قفڵکراو دووبارە بکاتەوە.",
  },
  "{period} is locked. Corrections now go in by reversing entries in an open period.": {
    ar: "أُقفلت {period}. تُجرى التصحيحات الآن بقيود عكسية في فترة مفتوحة.",
    ckb: "{period} قفڵ کرا. ڕاستکردنەوەکان ئێستا بە تۆماری هەڵگەڕاندنەوە لە ماوەیەکی کراوەدا دەکرێن.",
  },
  "The year-end close was posted as journal {no}.": {
    ar: "رُحِّل إقفال نهاية السنة بالقيد {no}.",
    ckb: "داخستنی کۆتایی ساڵ وەک تۆماری {no} نووسرا.",
  },
  "{period} is open again. The reason is on the audit trail.": {
    ar: "أُعيد فتح {period}. السبب مسجّل في سجل التدقيق.",
    ckb: "{period} دووبارە کرایەوە. هۆکارەکە لە تۆماری گۆڕانکارییەکاندایە.",
  },

  // Stock the old app never journaled (LegacyPostings, on Reports).
  "Opening stock": { ar: "مخزون افتتاحي", ckb: "کۆگای سەرەتا" },
  "Goods received": { ar: "بضاعة مستلمة", ckb: "کاڵای وەرگیراو" },
  "Count variance": { ar: "فرق الجرد", ckb: "جیاوازی ژماردن" },
  "Stock correction": { ar: "تصحيح المخزون", ckb: "ڕاستکردنەوەی کۆگا" },
  "{n} journal(s) posted, {amount} in all. They are in the Journal Register.": {
    ar: "رُحِّلت القيود ({n})، بمجموع {amount}. تجدها في سجل القيود.",
    ckb: "تۆمارە نووسراوەکان: {n}، بە کۆی {amount}. لە لیستی تۆمارەکاندان.",
  },
  "Stock the old app never journaled": {
    ar: "مخزون لم يُقيّده التطبيق القديم",
    ckb: "ئەو کۆگایەی بەرنامە کۆنەکە هەرگیز تۆماری بۆ نەنووسی",
  },
  "These records moved stock before the upgrade but have no journal, so they show above as an Inventory difference. Each would post the entry the new app writes for the same record, dated when it happened. Post them only if the records are real.":
    {
      ar: "حرّكت هذه السجلات المخزون قبل التحديث لكن ليس لها قيد، لذا تظهر أعلاه فرقًا في المخزون. سيُرحّل كل منها القيد الذي يكتبه التطبيق الجديد للسجل نفسه، بتاريخ حدوثه. لا ترحّلها إلا إذا كانت السجلات حقيقية.",
      ckb: "ئەم بەڵگانە پێش نوێکردنەوەکە کۆگایان جووڵاندووە بەڵام هیچ تۆمارێکیان نییە، بۆیە لە سەرەوە وەک جیاوازی کۆگا دەردەکەون. هەر یەکێکیان ئەو تۆمارە دەنووسێت کە بەرنامە نوێیەکە بۆ هەمان بەڵگە دەینووسێت، بە بەرواری ڕوودانی. تەنها ئەگەر بەڵگەکان ڕاستەقینە بن بیاننووسە.",
    },
  Record: { ar: "السجل", ckb: "بەڵگە" },
  "Journal it would post": { ar: "القيد الذي سيُرحّله", ckb: "ئەو تۆمارەی دەینووسێت" },
  "{n} record(s)": { ar: "عدد السجلات: {n}", ckb: "{n} بەڵگە" },
  "Why they are being posted (for the audit trail)": {
    ar: "لماذا تُرحَّل (لسجل التدقيق)",
    ckb: "بۆچی دەنووسرێن (بۆ تۆماری گۆڕانکارییەکان)",
  },
  "Posting…": { ar: "جارٍ الترحيل…", ckb: "تۆمار دەکرێت…" },
  "Post these {n} journal(s)": { ar: "ترحيل هذه القيود ({n})", ckb: "نووسینی ئەم {n} تۆمارە" },
  "Only the owner can post them.": {
    ar: "وحده المالك يستطيع ترحيلها.",
    ckb: "تەنها خاوەن دەتوانێت بیاننووسێت.",
  },

  // Expenses: the register.
  "Rent · salaries · utilities · sundries": {
    ar: "إيجار · رواتب · خدمات · نثريات",
    ckb: "کرێ · مووچە · خزمەتگوزاری · خەرجی جۆراوجۆر",
  },
  "Record an Expense": { ar: "تسجيل مصروف", ckb: "تۆمارکردنی خەرجییەک" },
  "The account is proposed from the narration — you confirm it before posting": {
    ar: "يُقترح الحساب من البيان — وتؤكده أنت قبل الترحيل",
    ckb: "هەژمارەکە لە ڕوونکردنەوەکەوە پێشنیار دەکرێت — تۆ پێش تۆمارکردن پشتڕاستی دەکەیتەوە",
  },
  "Expense Register": { ar: "سجل المصروفات", ckb: "لیستی خەرجییەکان" },
  "Last {n}": { ar: "آخر {n}", ckb: "دوایین {n}" },
  "No expenses recorded yet": {
    ar: "لم تُسجَّل مصروفات بعد",
    ckb: "هێشتا هیچ خەرجییەک تۆمار نەکراوە",
  },
  "Record the first one above.": {
    ar: "سجّل أول مصروف في الأعلى.",
    ckb: "یەکەمیان لە سەرەوە تۆمار بکە.",
  },
  "Total shown": { ar: "مجموع المعروض", ckb: "کۆی پیشاندراو" },
  "Total shown, less {n} reversed": {
    ar: "مجموع المعروض، دون المعكوسة ({n})",
    ckb: "کۆی پیشاندراو، جگە لە {n} هەڵگەڕێندراوە",
  },
  "By Account": { ar: "حسب الحساب", ckb: "بەپێی هەژمار" },
  "The expenses above, by where they were posted": {
    ar: "المصروفات أعلاه، حسب الحساب الذي رُحّلت إليه",
    ckb: "خەرجییەکانی سەرەوە، بەپێی ئەو هەژمارەی تێیدا تۆمار کراون",
  },

  // Recording an expense (ExpenseEntry): where the money came from, and the voucher.
  "The till (today's drawer)": {
    ar: "نقطة البيع (درج اليوم)",
    ckb: "خاڵی فرۆشتن (دەخیلەی ئەمڕۆ)",
  },
  "The safe": { ar: "الخزنة", ckb: "قاسەکە" },
  "The bank": { ar: "البنك", ckb: "بانکەکە" },
  "A card": { ar: "بطاقة", ckb: "کارتێک" },
  "The owner, personally": { ar: "المالك شخصيًا", ckb: "خاوەن خۆی" },
  "September shop rent": { ar: "إيجار المحل لشهر أيلول", ckb: "کرێی دوکان بۆ مانگی ئەیلوول" },
  "Amount (IQD)": { ar: "المبلغ (IQD)", ckb: "بڕی پارە (IQD)" },
  "Paid from": { ar: "دُفع من", ckb: "پارە درا لە" },
  "Choose…": { ar: "اختر…", ckb: "هەڵبژێرە…" },
  "As it will be written": { ar: "كما سيُكتب", ckb: "وەک ئەوەی دەنووسرێت" },
  "Choose the account…": { ar: "اختر الحساب…", ckb: "هەژمارەکە هەڵبژێرە…" },
  "Choose where the money came from…": {
    ar: "اختر من أين جاء المال…",
    ckb: "هەڵبژێرە پارەکە لە کوێوە هات…",
  },
  "Balanced — debits equal credits": {
    ar: "متوازن — المدين يساوي الدائن",
    ckb: "هاوسەنگە — مەدین یەکسانە بە دائین",
  },
  "Enter an amount": { ar: "أدخل مبلغًا", ckb: "بڕێک بنووسە" },
  "Post expense": { ar: "ترحيل المصروف", ckb: "تۆمارکردنی خەرجی" },
  "Posted to {account} {name} (journal {no}).": {
    ar: "رُحِّل إلى {account} {name} (القيد {no}).",
    ckb: "لە {account} {name} تۆمار کرا (تۆماری {no}).",
  },
  // The account the house rules propose (src/lib/bookkeeping/rules.ts), shown through msg().
  "“{1}” sounds like stock that was lost. Record it on Inventory → Record waste instead, so the stock and its cost come out together. Only post it here if it really is a bought-in service.":
    {
      ar: "يبدو أن «{1}» مخزون فُقد. سجّله بدلًا من ذلك في المخزون ← تسجيل هدر، ليخرج المخزون وكلفته معًا. لا ترحّله هنا إلا إذا كان فعلًا خدمة مشتراة.",
      ckb: "«{1}» وەک کۆگایەکی لەدەستچوو دەردەکەوێت. لە جیاتی ئەوە لە کۆگا ← تۆمارکردنی بەفیڕۆچوون تۆماری بکە، بۆ ئەوەی کۆگاکە و تێچووەکەی پێکەوە دەربچن. تەنها ئەگەر بەڕاستی خزمەتگوزارییەکی کڕدراو بێت لێرە تۆماری بکە.",
    },
  "Matched “{1}” → {2} {3} for {4} IQD. Change the account if this is wrong.": {
    ar: "الكلمة «{1}» تشير إلى الحساب {2} {3} بمبلغ {4} IQD. غيّر الحساب إن كان هذا خطأ.",
    ckb: "وشەی «{1}» دۆزرایەوە: هەژماری {2} {3} بۆ {4} IQD. ئەگەر ئەمە هەڵەیە هەژمارەکە بگۆڕە.",
  },
  "No clear category word found, so {1} {2} is proposed. Please choose the right account before posting.":
    {
      ar: "لم نجد كلمة تدل بوضوح على نوع المصروف، لذا يُقترح الحساب {1} {2}. يرجى اختيار الحساب الصحيح قبل الترحيل.",
      ckb: "هیچ وشەیەکی ڕوون بۆ جۆری خەرجییەکە نەدۆزرایەوە، بۆیە هەژماری {1} {2} پێشنیار دەکرێت. تکایە پێش تۆمارکردن هەژماری دروست هەڵبژێرە.",
    },

  // What the actions answer (src/lib/actions/books.ts): the fields' names, as
  // the form checks of common.ts put them in a sentence, and their messages.
  "What the expense was for": { ar: "الغرض من المصروف", ckb: "مەبەستی خەرجییەکە" },
  "The amount": { ar: "المبلغ", ckb: "بڕی پارە" },
  "The date": { ar: "التاريخ", ckb: "بەروار" },
  "The reversal date": { ar: "تاريخ العكس", ckb: "بەرواری هەڵگەڕاندنەوە" },
  "a journal": { ar: "قيدًا", ckb: "تۆمارێک" },
  "a period": { ar: "فترةً", ckb: "ماوەیەک" },
  "A reason": { ar: "السبب", ckb: "هۆکار" },
  "The reason for correcting a control account": {
    ar: "سبب تصحيح الحساب الرقابي",
    ckb: "هۆکاری ڕاستکردنەوەی هەژمارێکی کۆنترۆڵ",
  },
  "Choose the account": { ar: "اختر الحساب", ckb: "هەژمارەکە هەڵبژێرە" },
  "Choose an account on every line": {
    ar: "اختر حسابًا في كل سطر",
    ckb: "لە هەموو هێڵێکدا هەژمارێک هەڵبژێرە",
  },
  "Add at least one line": { ar: "أضف سطرًا واحدًا على الأقل", ckb: "لانیکەم یەک هێڵ زیاد بکە" },
  "A line is either a debit or a credit, not both": {
    ar: "السطر إما مدين وإما دائن، لا الاثنان معًا",
    ckb: "هەر هێڵێک یان مەدینە یان دائین، نەک هەردووکیان",
  },
  "A correction needs at least two lines": {
    ar: "يحتاج التصحيح إلى سطرين على الأقل",
    ckb: "ڕاستکردنەوە لانیکەم دوو هێڵی پێویستە",
  },
  // Where a journal came from, for the kinds the register had no name for.
  Correction: { ar: "تصحيح", ckb: "ڕاستکردنەوە" },
  "Card settlement": { ar: "تسوية البطاقات", ckb: "یەکلاکردنەوەی کارت" },
  "Platform settlement": { ar: "تسوية المنصة", ckb: "یەکلاکردنەوەی پلاتفۆرم" },
};

export default phrases;
