import type { PhraseBook } from "./types";

/**
 * Each branch's books (G3, 0084): the transfer price between branches, and
 * what each branch holds and owes.
 */
const phrases: PhraseBook = {
  // The rule.
  "Stock sent to another branch is charged at cost plus (%)": {
    ar: "المخزون المرسل إلى فرع آخر يُحتسب بالتكلفة مضافًا إليها (%)",
    ckb: "ئەو کاڵایەی بۆ لقێکی تر دەنێردرێت بە تێچوو زیاد ئەم ڕێژەیە حیساب دەکرێت (%)",
  },
  "What a branch charges another for stock it sends: its cost and this share on top. What is added is the sending branch's revenue and the receiving branch's cost in the profit by branch; within the café it is the same money, so the café's own books do not change. Set for a branch, it is what that branch charges. 0 is at cost.":
    {
      ar: "ما يحتسبه فرع على آخر للمخزون الذي يرسله: تكلفته وهذه النسبة فوقها. ما يُضاف هو إيراد الفرع المرسِل وتكلفة الفرع المستلِم في الربح حسب الفرع؛ وداخل المقهى هو المال نفسه، فلا تتغير دفاتر المقهى نفسها. إذا ضُبطت لفرع فهي ما يحتسبه ذلك الفرع. 0 تعني بالتكلفة.",
      ckb: "ئەوەی لقێک بۆ ئەو کاڵایەی دەینێرێت لە لقێکی تر وەری دەگرێت: تێچووەکەی و ئەم ڕێژەیە لەسەری. ئەوەی زیاد دەکرێت داهاتی لقی نێرەرە و تێچووی لقی وەرگرە لە قازانجی هەر لقێکدا؛ لە ناو کافێکەدا هەمان پارەیە، بۆیە حیساباتی خودی کافێکە ناگۆڕێت. ئەگەر بۆ لقێک دابنرێت، ئەوە ئەوەیە کە ئەو لقە وەری دەگرێت. 0 واتە بە تێچوو.",
    },
  "At cost": { ar: "بالتكلفة", ckb: "بە تێچوو" },
  "Cost plus {pct}%": { ar: "التكلفة + {pct}%", ckb: "تێچوو + {pct}%" },
  "Charged to {to} at cost plus {pct}%: {amount}": {
    ar: "احتُسب على {to} بالتكلفة + {pct}%: {amount}",
    ckb: "بە {to} حیساب کرا بە تێچوو + {pct}%: {amount}",
  },
  // The two accounts.
  "Sold to other branches": { ar: "مبيعات لفروع أخرى", ckb: "فرۆشراو بە لقەکانی تر" },
  "Bought from other branches": { ar: "مشتريات من فروع أخرى", ckb: "کڕاو لە لقەکانی تر" },
  "The accounts of the transfer price between branches carry no journal": {
    ar: "حسابا سعر التحويل بين الفروع لا يُقيَّد عليهما أي قيد",
    ckb: "حیسابەکانی نرخی گواستنەوە لە نێوان لقەکاندا هیچ تۆمارێکیان لەسەر ناکرێت",
  },

  // Each branch, now.
  "Each branch, now": { ar: "كل فرع، الآن", ckb: "هەر لقێک، ئێستا" },
  "What each branch holds and owes as of now, read from its till, its stock and its records, with its profit this year. Stock sent to another branch is charged at cost plus the share set on Settings → Rules: what is added is the sender's revenue and the receiver's cost, and is the same money within the café.":
    {
      ar: "ما يملكه كل فرع وما عليه حتى الآن، من صندوقه ومخزونه وسجلاته، مع ربحه هذه السنة. المخزون المرسل إلى فرع آخر يُحتسب بالتكلفة مضافًا إليها النسبة المضبوطة في الإعدادات ← القواعد: ما يُضاف إيراد للمرسِل وتكلفة على المستلِم، وهو المال نفسه داخل المقهى.",
      ckb: "ئەوەی هەر لقێک تا ئێستا هەیەتی و قەرزارییەتی، لە قاسەکەی و کاڵاکەی و تۆمارەکانییەوە، لەگەڵ قازانجی ئەمساڵی. ئەو کاڵایەی بۆ لقێکی تر دەنێردرێت بە تێچوو زیاد ئەو ڕێژەیەی لە ڕێکخستنەکان ← یاساکان دانراوە حیساب دەکرێت: ئەوەی زیاد دەکرێت داهاتی نێرەرە و تێچووی وەرگرە، و لە ناو کافێکەدا هەمان پارەیە.",
    },
  "Cash in its till": { ar: "النقد في صندوقه", ckb: "پارەی ناو قاسەکەی" },
  "Stock, at cost": { ar: "المخزون، بالتكلفة", ckb: "کاڵا، بە تێچوو" },
  "Stock it sent, not yet received": {
    ar: "مخزون أرسله ولم يُستلم بعد",
    ckb: "کاڵای ناردوو، هێشتا وەرنەگیراو",
  },
  "Equipment, at book value": {
    ar: "المعدات، بالقيمة الدفترية",
    ckb: "ئامێرەکان، بە نرخی ناو حیسابات",
  },
  "Customers owe, on its invoices": {
    ar: "ما على الزبائن، من فواتيره",
    ckb: "قەرزی کڕیاران، لەسەر پسوولەکانی",
  },
  "What it holds": { ar: "ما يملكه", ckb: "ئەوەی هەیەتی" },
  "Less deposits it holds for pre-orders": {
    ar: "ناقص العرابين التي يحتفظ بها للطلبات المسبقة",
    ckb: "کەم پێشەکییەکانی لای خۆی بۆ داواکاریی پێشوەختە",
  },
  "Its own": { ar: "صافي ما له", ckb: "هی خۆی" },
  "Profit this year": { ar: "الربح هذه السنة", ckb: "قازانجی ئەمساڵ" },
  "Sold to other branches this year": {
    ar: "مبيعات لفروع أخرى هذه السنة",
    ckb: "فرۆشراو بە لقەکانی تر ئەمساڵ",
  },
  "Bought from other branches this year": {
    ar: "مشتريات من فروع أخرى هذه السنة",
    ckb: "کڕاو لە لقەکانی تر ئەمساڵ",
  },
  "Charges other branches": { ar: "يحتسب على الفروع الأخرى", ckb: "لە لقەکانی تر وەردەگرێت" },
  "The café's, no one branch's: the safe {safe}, the bank {bank}, card and platform money to come in {toComeIn}, owed to suppliers {suppliers}, owed to staff {staff}.":
    {
      ar: "للمقهى، لا لفرع بعينه: الخزنة {safe}، البنك {bank}، أموال البطاقات والمنصات المنتظرة {toComeIn}، المستحق للموردين {suppliers}، المستحق للموظفين {staff}.",
      ckb: "هی کافێکەیە، هی هیچ لقێک نییە: قاسەی سەرەکی {safe}، بانک {bank}، پارەی کارت و پلاتفۆرمەکان کە دێت {toComeIn}، قەرزی دابینکەران {suppliers}، قەرزی کارمەندان {staff}.",
    },
  "Equipment of no branch {equipment}; customers owe on invoices of no branch {owe}.": {
    ar: "معدات لا تخص فرعًا {equipment}؛ ما على الزبائن من فواتير لا تخص فرعًا {owe}.",
    ckb: "ئامێری هیچ لقێک نا {equipment}؛ قەرزی کڕیاران لەسەر پسوولەی هیچ لقێک نا {owe}.",
  },
};

export default phrases;
