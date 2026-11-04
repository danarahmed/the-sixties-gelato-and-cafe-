import type { PhraseBook } from "./types";

/**
 * Today (the sales round): where everyone starts, their own jobs for the day,
 * each with one button to where it is done, and each ticked once it is.
 */
const phrases: PhraseBook = {
  // The page.
  "All done for now": { ar: "انتهى كل شيء الآن", ckb: "ئێستا هەموو شتێک تەواوە" },
  "Here is your day": { ar: "هذا يومك", ckb: "ئەمە ڕۆژەکەتە" },
  "{name}, here is your day": { ar: "{name}، هذا يومك", ckb: "{name}، ئەمە ڕۆژەکەتە" },
  "Start at the top. Each button opens where the job is done; it is ticked here once it is.": {
    ar: "ابدأ من الأعلى. كل زر يفتح حيث يُنجز العمل؛ ويُعلَّم هنا حين يُنجز.",
    ckb: "لە سەرەوە دەست پێبکە. هەر دوگمەیەک ئەو شوێنە دەکاتەوە کە کارەکەی تێدا دەکرێت؛ کاتێک تەواو بوو لێرە نیشانە دەکرێت.",
  },
  "Nothing is left to do now. What is left waits on someone else, or is for later.": {
    ar: "لم يبقَ ما تفعله الآن. ما بقي ينتظر شخصًا آخر، أو هو لوقت لاحق.",
    ckb: "ئێستا هیچ کارێک نەماوە. ئەوەی ماوە چاوەڕێی کەسێکی ترە، یان بۆ دواترە.",
  },
  "Nothing is set for you today.": {
    ar: "لا شيء مقرر لك اليوم.",
    ckb: "ئەمڕۆ هیچ کارێک بۆ تۆ دیاری نەکراوە.",
  },
  "Your jobs today": { ar: "أعمالك اليوم", ckb: "کارەکانی ئەمڕۆت" },
  "To do": { ar: "للإنجاز", ckb: "بۆ کردن" },
  "Waiting on someone else": { ar: "بانتظار شخص آخر", ckb: "چاوەڕێی کەسێکی ترە" },
  "For later": { ar: "لاحقًا", ckb: "بۆ دواتر" },

  // The start of the day, and its close.
  "Open up for the day": { ar: "افتتاح اليوم", ckb: "کردنەوەی ڕۆژ" },
  "Close the day": { ar: "أغلق اليوم", ckb: "ڕۆژەکە دابخە" },
  "Time to close: work down the end of the day, step by step.": {
    ar: "حان وقت الإغلاق: اتبع نهاية اليوم خطوة بخطوة.",
    ckb: "کاتی داخستنە: کۆتایی ڕۆژ هەنگاو بە هەنگاو تەواو بکە.",
  },
  "From four in the afternoon: close the day step by step.": {
    ar: "من الرابعة عصرًا: أغلق اليوم خطوة بخطوة.",
    ckb: "لە کاتژمێر چواری دوای نیوەڕۆوە: ڕۆژەکە هەنگاو بە هەنگاو دابخە.",
  },

  // The drawer.
  "Open since {time}.": { ar: "مفتوح منذ {time}.", ckb: "لە {time}ەوە کراوەیە." },
  Sell: { ar: "بِع", ckb: "بفرۆشە" },
  "The drawer is not open yet: count the cash in it, then open it.": {
    ar: "درج النقد غير مفتوح بعد: اعدد النقد الذي فيه، ثم افتحه.",
    ckb: "دەخیلەکە هێشتا نەکراوەتەوە: پارەی ناوی بژمێرە، پاشان بیکەرەوە.",
  },
  "The drawer is not open yet: a manager opens it.": {
    ar: "درج النقد غير مفتوح بعد: يفتحه مدير.",
    ckb: "دەخیلەکە هێشتا نەکراوەتەوە: بەڕێوەبەرێک دەیکاتەوە.",
  },

  // What to make.
  "{n} batch(es)": {
    ar: "{n, plural, one {دفعة واحدة} two {دفعتان} few {# دفعات} many {# دفعة} other {# دفعة}}",
    ckb: "{n} دەستە",
  },

  // The count.
  "Your count is open: {counted} of {lines} item(s) counted.": {
    ar: "جردك مفتوح: عُدّ {counted} من {lines}.",
    ckb: "ژماردنەکەت کراوەیە: {counted} لە {lines} کاڵا ژمێردراون.",
  },
  "Go on counting": { ar: "تابع العدّ", ckb: "بەردەوام بە لە ژماردن" },
  "{n} count(s) to check.": {
    ar: "{n, plural, one {جرد واحد للمراجعة.} two {جردان للمراجعة.} few {# عمليات جرد للمراجعة.} many {# جردًا للمراجعة.} other {# جرد للمراجعة.}}",
    ckb: "{n} ژماردن بۆ پشکنین.",
  },
  "Check them": { ar: "راجعها", ckb: "بیانپشکنە" },
  "Your count is sent: someone else checks it now.": {
    ar: "أُرسل جردك: يراجعه شخص آخر الآن.",
    ckb: "ژماردنەکەت نێردرا: ئێستا کەسێکی تر دەیپشکنێت.",
  },
  "See the count": { ar: "اعرض الجرد", ckb: "ژماردنەکە ببینە" },
  "No count waits for you to check it.": {
    ar: "لا جرد ينتظر مراجعتك.",
    ckb: "هیچ ژماردنێک چاوەڕێی پشکنینی تۆ نییە.",
  },
  "No count is open. Start one when you are asked to.": {
    ar: "لا جرد مفتوح. ابدأ واحدًا حين يُطلب منك.",
    ckb: "هیچ ژماردنێک کراوە نییە. کاتێک داوات لێکرا یەکێک دەست پێبکە.",
  },
  "Start a count": { ar: "ابدأ جردًا", ckb: "ژماردنێک دەست پێبکە" },

  // Stock coming, and what to buy.
  "Stock on its way to you": { ar: "مخزون في الطريق إليك", ckb: "کۆگا لە ڕێگادایە بۆ لای تۆ" },
  "{n} transfer(s) to receive when they come.": {
    ar: "{n, plural, one {تحويل واحد للاستلام حين يصل.} two {تحويلان للاستلام حين يصلان.} few {# تحويلات للاستلام حين تصل.} many {# تحويلًا للاستلام حين تصل.} other {# تحويل للاستلام حين يصل.}}",
    ckb: "{n} گواستنەوە بۆ وەرگرتن کاتێک دەگەن.",
  },
  "{n} item(s) to order.": {
    ar: "{n, plural, one {مادة واحدة للطلب.} two {مادتان للطلب.} few {# مواد للطلب.} many {# مادة للطلب.} other {# مادة للطلب.}}",
    ckb: "{n} کاڵا بۆ داواکردن.",
  },
  "Nothing needs ordering now.": {
    ar: "لا شيء يحتاج إلى طلب الآن.",
    ckb: "ئێستا هیچ شتێک پێویستی بە داواکردن نییە.",
  },
  "Order them": { ar: "اطلبها", ckb: "داوایان بکە" },

  // Approvals, alerts and problems.
  "{n} thing(s) wait for you to approve.": {
    ar: "{n, plural, one {أمر واحد ينتظر موافقتك.} two {أمران ينتظران موافقتك.} few {# أمور تنتظر موافقتك.} many {# أمرًا ينتظر موافقتك.} other {# أمر ينتظر موافقتك.}}",
    ckb: "{n} شت چاوەڕێی پەسەندکردنی تۆن.",
  },
  "{n} of yours wait for someone else to approve.": {
    ar: "{n} من طلباتك بانتظار موافقة شخص آخر.",
    ckb: "{n} داواکاریی تۆ چاوەڕێی پەسەندکردنی کەسێکی ترن.",
  },
  "Open Approvals": { ar: "افتح الموافقات", ckb: "پەسەندکردنەکان بکەرەوە" },
  "Red alerts": { ar: "التنبيهات الحمراء", ckb: "ئاگادارکردنەوە سوورەکان" },
  "Problems reported": { ar: "مشكلات مُبلَّغ عنها", ckb: "کێشە ڕاپۆرتکراوەکان" },
  "{n} problem(s) reported by staff wait for an answer.": {
    ar: "{n, plural, one {مشكلة واحدة أبلغ عنها الموظفون تنتظر ردًّا.} two {مشكلتان أبلغ عنهما الموظفون تنتظران ردًّا.} few {# مشكلات أبلغ عنها الموظفون تنتظر ردًّا.} many {# مشكلة أبلغ عنها الموظفون تنتظر ردًّا.} other {# مشكلة أبلغ عنها الموظفون تنتظر ردًّا.}}",
    ckb: "{n} کێشە کە کارمەندان ڕاپۆرتیان کردووە چاوەڕێی وەڵامن.",
  },
  "No problem waits for an answer.": {
    ar: "لا مشكلة تنتظر ردًّا.",
    ckb: "هیچ کێشەیەک چاوەڕێی وەڵام نییە.",
  },
  "Look at them": { ar: "اطّلع عليها", ckb: "سەیریان بکە" },
  "The watch list": { ar: "قائمة المراقبة", ckb: "لیستی چاودێری" },
  "{n} strong finding(s) wait for a look.": {
    ar: "{n, plural, one {ملاحظة قوية واحدة تنتظر النظر.} two {ملاحظتان قويتان تنتظران النظر.} few {# ملاحظات قوية تنتظر النظر.} many {# ملاحظة قوية تنتظر النظر.} other {# ملاحظة قوية تنتظر النظر.}}",
    ckb: "{n} دۆزینەوەی بەهێز چاوەڕێی سەیرکردنن.",
  },
  "Nothing strong on the watch list.": {
    ar: "لا شيء قوي في قائمة المراقبة.",
    ckb: "هیچ شتێکی بەهێز لە لیستی چاودێریدا نییە.",
  },

  // The books.
  "Bills due this week": { ar: "فواتير مستحقة هذا الأسبوع", ckb: "پسووڵەکانی ئەم هەفتەیە" },
  "{n} bill(s) to pay by {day}, {amount} in all.": {
    ar: "{n, plural, one {فاتورة واحدة} two {فاتورتان} few {# فواتير} many {# فاتورة} other {# فاتورة}} للدفع قبل {day}، بمجموع {amount}.",
    ckb: "{n} پسووڵە بۆ پارەدان تا {day}، کۆی گشتی {amount}.",
  },
  "No bill is due this week.": {
    ar: "لا فاتورة مستحقة هذا الأسبوع.",
    ckb: "ئەم هەفتەیە هیچ پسووڵەیەک کاتی پارەدانی نییە.",
  },
  "late since {day}": { ar: "متأخرة منذ {day}", ckb: "دواکەوتووە لە {day}ەوە" },
  "Pay them": { ar: "ادفعها", ckb: "پارەکەیان بدە" },
  "{n} bank line(s) not matched to a statement yet.": {
    ar: "{n, plural, one {قيد واحد للبنك لم يُطابق بكشف بعد.} two {قيدان للبنك لم يُطابقا بكشف بعد.} few {# قيود للبنك لم تُطابق بكشف بعد.} many {# قيدًا للبنك لم يُطابق بكشف بعد.} other {# قيد للبنك لم يُطابق بكشف بعد.}}",
    ckb: "{n} تۆماری بانک هێشتا لەگەڵ کەشفێک ڕێک نەخراون.",
  },
  "Every bank line is on a statement.": {
    ar: "كل قيود البنك موجودة في كشف.",
    ckb: "هەموو تۆمارەکانی بانک لە کەشفێکدان.",
  },
  "Match them": { ar: "طابقها", ckb: "ڕێکیان بخە" },
  "Last month is over: draft its pay.": {
    ar: "انتهى الشهر الماضي: أعدّ رواتبه.",
    ckb: "مانگی ڕابردوو تەواو بوو: مووچەکەی ئامادە بکە.",
  },
  "Last month's pay is drafted: check it and approve it.": {
    ar: "رواتب الشهر الماضي مُعدّة: راجعها واعتمدها.",
    ckb: "مووچەی مانگی ڕابردوو ئامادە کراوە: بیپشکنە و پەسەندی بکە.",
  },
  "Last month's pay is approved: pay it.": {
    ar: "رواتب الشهر الماضي معتمدة: ادفعها.",
    ckb: "مووچەی مانگی ڕابردوو پەسەند کراوە: بیدە.",
  },
  "Last month's pay is paid.": {
    ar: "دُفعت رواتب الشهر الماضي.",
    ckb: "مووچەی مانگی ڕابردوو دراوە.",
  },
  "{n} check(s) do not tie: look into them.": {
    ar: "{n, plural, one {فحص واحد غير متطابق} two {فحصان غير متطابقين} few {# فحوص غير متطابقة} many {# فحصًا غير متطابق} other {# فحص غير متطابق}}: تحقّق منها.",
    ckb: "{n} پشکنین یەکناگرنەوە: لێیان بکۆڵەرەوە.",
  },
  "Every check ties: the books agree with their records.": {
    ar: "كل فحص متطابق: الدفاتر توافق سجلاتها.",
    ckb: "هەموو پشکنینێک یەکدەگرێتەوە: دەفتەرەکان لەگەڵ تۆمارەکانیان ڕێکن.",
  },
  "Open the checks": { ar: "افتح الفحوص", ckb: "پشکنینەکان بکەرەوە" },
  "What changed today": { ar: "ما تغيّر اليوم", ckb: "ئەمڕۆ چی گۆڕا" },
  "{n} change(s) recorded today.": {
    ar: "{n, plural, one {تغيير واحد سُجّل اليوم.} two {تغييران سُجّلا اليوم.} few {# تغييرات سُجّلت اليوم.} many {# تغييرًا سُجّل اليوم.} other {# تغيير سُجّل اليوم.}}",
    ckb: "ئەمڕۆ {n} گۆڕانکاری تۆمار کراوە.",
  },
  "Over {n} change(s) recorded today.": {
    ar: "سُجّل اليوم أكثر من {n} تغيير.",
    ckb: "ئەمڕۆ زیاتر لە {n} گۆڕانکاری تۆمار کراوە.",
  },
  "Nothing has been changed today.": {
    ar: "لم يُغيَّر شيء اليوم.",
    ckb: "ئەمڕۆ هیچ شتێک نەگۆڕاوە.",
  },
  "Open the audit trail": { ar: "افتح سجل التدقيق", ckb: "تۆماری گۆڕانکارییەکان بکەرەوە" },
};

export default phrases;
