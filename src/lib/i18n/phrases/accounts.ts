import type { PhraseBook } from "./types";

/**
 * Wholesale customers on account (round nineteen, 0077): a limit, terms and
 * a wholesale price; invoices charged to the account; payments that pay the
 * oldest first.
 */
const phrases: PhraseBook = {
  // A customer's account.
  "Credit settings": { ar: "إعدادات الدين", ckb: "ڕێکخستنی قەرز" },
  "New invoice": { ar: "فاتورة جديدة", ckb: "پسوولەی نوێ" },
  "Receive a payment": { ar: "استلام دفعة", ckb: "وەرگرتنی پارەدان" },
  "Not on account: they pay as they buy. A shop or a hotel that pays later is put on account here, with a limit and terms.":
    {
      ar: "ليس على الحساب: يدفع عند الشراء. المحل أو الفندق الذي يدفع لاحقًا يوضع على الحساب هنا، بحد ومهلة.",
      ckb: "لەسەر حیساب نییە: کاتی کڕین دەدات. دووکان یان هوتێلێک کە دواتر دەدات لێرە دەخرێتە سەر حیساب، بە سنوور و ماوە.",
    },
  "They owe": { ar: "عليهم", ckb: "قەرزاری" },
  Overdue: { ar: "متأخر", ckb: "دواکەوتوو" },
  "Credit left": { ar: "المتبقي من الحد", ckb: "ماوەی سنوور" },
  "Limit {amount} · {days} days to pay · {percent}% off": {
    ar: "الحد {amount} · {days} يومًا للدفع · خصم {percent}%",
    ckb: "سنوور {amount} · {days} ڕۆژ بۆ پارەدان · {percent}% داشکاندن",
  },
  "Buys on account (pays later)": {
    ar: "يشتري على الحساب (يدفع لاحقًا)",
    ckb: "بە حیساب دەکڕێت (دواتر دەدات)",
  },
  "Credit limit": { ar: "حد الدين", ckb: "سنووری قەرز" },
  "Days to pay": { ar: "أيام الدفع", ckb: "ڕۆژەکانی پارەدان" },
  "Wholesale price: % off the menu": {
    ar: "سعر الجملة: % خصم من القائمة",
    ckb: "نرخی کۆ: % داشکاندن لە لیستەکە",
  },
  "Another line": { ar: "سطر آخر", ckb: "دێڕێکی تر" },
  "Due in {days} days": { ar: "يستحق خلال {days} يومًا", ckb: "لە ماوەی {days} ڕۆژدا دەبێت بدرێت" },
  "Make the invoice": { ar: "أنشئ الفاتورة", ckb: "پسوولەکە دروست بکە" },
  "Where did the money go?": { ar: "أين ذهب المال؟", ckb: "پارەکە چووە کوێ؟" },
  "Receive it": { ar: "استلمه", ckb: "وەریبگرە" },
  "Left to pay": { ar: "المتبقي للدفع", ckb: "ماوە بۆ پارەدان" },
  "{days} days late": { ar: "متأخر {days} يومًا", ckb: "{days} ڕۆژ دواکەوتووە" },
  "Payments ({n})": { ar: "الدفعات ({n})", ckb: "پارەدانەکان ({n})" },
  "Invoice {no} made: {amount}, due {date}.": {
    ar: "أُنشئت الفاتورة {no}: {amount}، تستحق في {date}.",
    ckb: "پسوولەی {no} دروست کرا: {amount}، لە {date} دەبێت بدرێت.",
  },
  "Payment received. They owe {amount}.": {
    ar: "استُلمت الدفعة. عليهم {amount}.",
    ckb: "پارەدانەکە وەرگیرا. {amount} قەرزارن.",
  },
  // The customers' list.
  "On account": { ar: "على الحساب", ckb: "لەسەر حیساب" },
  "Owed to the café: {amount}, of which {overdue} is overdue.": {
    ar: "مستحق للمقهى: {amount}، منها {overdue} متأخر.",
    ckb: "قەرزی کافێ: {amount}، کە {overdue}ی دواکەوتووە.",
  },
  "The books say {amount}.": { ar: "الدفاتر تقول {amount}.", ckb: "دەفتەرەکان دەڵێن {amount}." },
  "1–30 days late": { ar: "متأخر 1–30 يومًا", ckb: "1–30 ڕۆژ دواکەوتوو" },
  "31–60 days late": { ar: "متأخر 31–60 يومًا", ckb: "31–60 ڕۆژ دواکەوتوو" },
  "Over 60 days late": { ar: "متأخر أكثر من 60 يومًا", ckb: "زیاتر لە 60 ڕۆژ دواکەوتوو" },
  // The audit trail.
  "A customer's account set": { ar: "ضُبط حساب زبون", ckb: "حیسابی کڕیارێک ڕێکخرا" },
  "Invoice made": { ar: "أُنشئت فاتورة", ckb: "پسوولە دروست کرا" },
  "Payment received from a customer": {
    ar: "استُلمت دفعة من زبون",
    ckb: "پارەدان لە کڕیارێک وەرگیرا",
  },
  "Buys on account": { ar: "يشتري على الحساب", ckb: "بە حیساب دەکڕێت" },
  "Wholesale % off": { ar: "خصم الجملة %", ckb: "داشکاندنی کۆ %" },
  "Due on": { ar: "يستحق في", ckb: "ڕۆژی پێدان" },
  // Refusals.
  "a customer": { ar: "زبونًا", ckb: "کڕیارێک" },
  "A credit limit is an amount of 0 or more": {
    ar: "حد الدين مبلغ 0 أو أكثر",
    ckb: "سنووری قەرز بڕێکە لە 0 یان زیاتر",
  },
  "Terms are from 0 to 365 days": { ar: "المهلة من 0 إلى 365 يومًا", ckb: "ماوە لە 0 تا 365 ڕۆژە" },
  "A wholesale price is from 0% to 90% off": {
    ar: "سعر الجملة خصم من 0% إلى 90%",
    ckb: "نرخی کۆ لە 0% تا 90% داشکاندنە",
  },
  "{1} is no longer a customer": { ar: "{1} لم يعد زبونًا", ckb: "{1} چیتر کڕیار نییە" },
  "{1} does not buy on account": { ar: "{1} لا يشتري على الحساب", ckb: "{1} بە حیساب ناکڕێت" },
  "An invoice is for take-away or eat-in prices": {
    ar: "الفاتورة بأسعار السفري أو الداخلي",
    ckb: "پسوولە بە نرخی بردن یان خواردن لێرەیە",
  },
  "{1} may owe at most {2}: they owe {3} already, and this is {4}": {
    ar: "{1} لا يتجاوز دينه {2}: عليه {3} أصلًا، وهذه {4}",
    ckb: "{1} زۆرترین {2} قەرزار دەبێت: پێشتر {3} قەرزارە، و ئەمە {4}ە",
  },
  "{1} owes {2}: a payment is at most that": {
    ar: "على {1} مبلغ {2}: الدفعة لا تزيد عليه",
    ckb: "{1} {2} قەرزارە: پارەدان لەوە زیاتر نییە",
  },
  "Say where the money went: the till, the bank or a way to pay": {
    ar: "قل أين ذهب المال: الصندوق أو البنك أو طريقة دفع",
    ckb: "بڵێ پارەکە چووە کوێ: سندوق، بانک یان ڕێگایەکی پارەدان",
  },
};

export default phrases;
