import type { PhraseBook } from "./types";

/**
 * Test your devices (G4): each of the till's devices tried before opening,
 * and what to do when one does not work.
 */
const phrases: PhraseBook = {
  "Test your devices": { ar: "اختبر أجهزتك", ckb: "ئامێرەکانت تاقی بکەرەوە" },
  "Before opening, try each one in turn. Anything that does not work says what to do. Nothing here is a sale or goes in the books.":
    {
      ar: "قبل الافتتاح، جرّب كل واحد بدوره. ما لا يعمل يقول ما العمل. لا شيء هنا بيع أو يدخل الدفاتر.",
      ckb: "پێش کردنەوە، هەریەکەیان بە نۆبە تاقی بکەرەوە. هەر شتێک کار نەکات دەڵێت چی بکەیت. هیچ شتێک لێرە فرۆشتن نییە و ناچێتە دەفتەرەکانەوە.",
    },
  "the printer, the drawer, the scanner and the internet, before the first customer.": {
    ar: "الطابعة والدرج والماسح والإنترنت، قبل أول زبون.",
    ckb: "چاپکەر، دەرج، سکانەر و ئینتەرنێت، پێش یەکەم کڕیار.",
  },
  // The internet.
  "The internet": { ar: "الإنترنت", ckb: "ئینتەرنێت" },
  "Check the connection": { ar: "افحص الاتصال", ckb: "پەیوەندی بپشکنە" },
  "Checking…": { ar: "جارٍ الفحص…", ckb: "پشکنین…" },
  "This device says it has no connection.": {
    ar: "يقول هذا الجهاز إنه بلا اتصال.",
    ckb: "ئەم ئامێرە دەڵێت پەیوەندی نییە.",
  },
  "The app answered, but the database did not.": {
    ar: "أجاب التطبيق، لكن قاعدة البيانات لم تُجب.",
    ckb: "ئەپەکە وەڵامی دایەوە، بەڵام بنکەدراوە وەڵامی نەدایەوە.",
  },
  "Slow: the database answered in {ms} ms. Sales still work; pages open slowly.": {
    ar: "بطيء: أجابت قاعدة البيانات في {ms} ملّي ثانية. البيع يعمل؛ والصفحات تُفتح ببطء.",
    ckb: "هێواش: بنکەدراوە لە {ms} میلیچرکەدا وەڵامی دایەوە. فرۆشتن کار دەکات؛ پەڕەکان هێواش دەکرێنەوە.",
  },
  "Good: the database answered in {ms} ms.": {
    ar: "جيد: أجابت قاعدة البيانات في {ms} ملّي ثانية.",
    ckb: "باشە: بنکەدراوە لە {ms} میلیچرکەدا وەڵامی دایەوە.",
  },
  "No answer from the app.": { ar: "لا جواب من التطبيق.", ckb: "هیچ وەڵامێک لە ئەپەکەوە نییە." },
  // Printing.
  "The receipt printer": { ar: "طابعة الإيصالات", ckb: "چاپکەری پسوولە" },
  "Print a test receipt": { ar: "اطبع إيصالًا تجريبيًا", ckb: "پسوولەیەکی تاقیکاری چاپ بکە" },
  "Did it print, easy to read?": {
    ar: "هل طُبع، وسهل القراءة؟",
    ckb: "چاپ کرا، و بە ئاسانی دەخوێنرێتەوە؟",
  },
  "Test receipt": { ar: "إيصال تجريبي", ckb: "پسوولەی تاقیکاری" },
  "Test line": { ar: "سطر تجريبي", ckb: "دێڕی تاقیکاری" },
  "Another test line": { ar: "سطر تجريبي آخر", ckb: "دێڕێکی تاقیکاری تر" },
  "Not a sale": { ar: "ليس بيعًا", ckb: "فرۆشتن نییە" },
  "The cash drawer": { ar: "درج النقود", ckb: "دەرجی پارە" },
  "Did the drawer open when the test receipt printed?": {
    ar: "هل فُتح الدرج حين طُبع الإيصال التجريبي؟",
    ckb: "دەرجەکە کرایەوە کاتێک پسوولە تاقیکارییەکە چاپ کرا؟",
  },
  "The drawer is not on the printer": {
    ar: "الدرج غير موصول بالطابعة",
    ckb: "دەرجەکە بە چاپکەرەکەوە نییە",
  },
  "A drawer plugged into the receipt printer opens when a receipt prints. Print the test receipt above, then say.":
    {
      ar: "الدرج الموصول بطابعة الإيصالات يُفتح حين يُطبع إيصال. اطبع الإيصال التجريبي أعلاه، ثم أجب.",
      ckb: "دەرجێک کە بە چاپکەری پسوولەوە بەسترابێت کاتێک پسوولە چاپ دەکرێت دەکرێتەوە. پسوولە تاقیکارییەکەی سەرەوە چاپ بکە، پاشان بڵێ.",
    },
  "The label printer": { ar: "طابعة الملصقات", ckb: "چاپکەری لەیبڵ" },
  "Print a test label": { ar: "اطبع ملصقًا تجريبيًا", ckb: "لەیبڵێکی تاقیکاری چاپ بکە" },
  "Did the label print, its bars sharp?": {
    ar: "هل طُبع الملصق، وخطوطه واضحة؟",
    ckb: "لەیبڵەکە چاپ کرا، و هێڵەکانی ڕوونن؟",
  },
  "No label printer here": { ar: "لا طابعة ملصقات هنا", ckb: "لێرە چاپکەری لەیبڵ نییە" },
  "Test label": { ar: "ملصق تجريبي", ckb: "لەیبڵی تاقیکاری" },
  // The scanner and the scale.
  "The barcode scanner": { ar: "ماسح الباركود", ckb: "سکانەری بارکۆد" },
  "Click here, then scan any barcode": {
    ar: "انقر هنا، ثم امسح أي باركود",
    ckb: "لێرە کلیک بکە، پاشان هەر بارکۆدێک سکان بکە",
  },
  "No scanner here": { ar: "لا ماسح هنا", ckb: "لێرە سکانەر نییە" },
  "That was typed, not scanned. Scan a code into the box.": {
    ar: "هذا كُتب ولم يُمسح. امسح رمزًا في الخانة.",
    ckb: "ئەوە نووسرا، سکان نەکرا. کۆدێک بۆ ناو خانەکە سکان بکە.",
  },
  "Scanned: {code}, which is {name}.": {
    ar: "مُسح: {code}، وهو {name}.",
    ckb: "سکان کرا: {code}، کە {name} ـە.",
  },
  "Scanned: {code}. No product has this barcode yet: add it on Products & Recipes.": {
    ar: "مُسح: {code}. لا منتج يحمل هذا الباركود بعد: أضفه في المنتجات والوصفات.",
    ckb: "سکان کرا: {code}. هێشتا هیچ بەرهەمێک ئەم بارکۆدەی نییە: لە بەرهەمەکان و ڕەچەتەکان زیادی بکە.",
  },
  "The scale's labels": { ar: "ملصقات الميزان", ckb: "لەیبڵەکانی تەرازوو" },
  "Weigh something sold by weight, print its label on the scale, and scan it into the box above.": {
    ar: "زِن شيئًا يُباع بالوزن، واطبع ملصقه على الميزان، وامسحه في الخانة أعلاه.",
    ckb: "شتێک کە بە کێش دەفرۆشرێت بکێشە، لەیبڵەکەی لەسەر تەرازووەکە چاپ بکە، و بۆ ناو خانەکەی سەرەوە سکانی بکە.",
  },
  "Read the scale's label: {name}, {weight}.": {
    ar: "قُرئ ملصق الميزان: {name}، {weight}.",
    ckb: "لەیبڵی تەرازوو خوێندرایەوە: {name}، {weight}.",
  },
  "A scale's label, but no weighed product has its product code.": {
    ar: "ملصق ميزان، لكن لا منتج موزون يحمل رمزه.",
    ckb: "لەیبڵی تەرازووە، بەڵام هیچ بەرهەمێکی کێشراو کۆدەکەی نییە.",
  },
  "Nothing is sold by weight here": {
    ar: "لا شيء يُباع بالوزن هنا",
    ckb: "لێرە هیچ شتێک بە کێش نافرۆشرێت",
  },
  // Phone warnings.
  "Warnings on the phone": { ar: "التنبيهات على الهاتف", ckb: "ئاگادارکردنەوەکان لەسەر مۆبایل" },
  "Did the test warning reach the phone?": {
    ar: "هل وصل التنبيه التجريبي إلى الهاتف؟",
    ckb: "ئاگادارکردنەوە تاقیکارییەکە گەیشتە مۆبایلەکە؟",
  },
  "Not used": { ar: "غير مستخدم", ckb: "بەکار نایەت" },
  "On the phone that should get the café's warnings, open": {
    ar: "على الهاتف الذي يجب أن يتلقى تنبيهات المقهى، افتح",
    ckb: "لەسەر ئەو مۆبایلەی کە دەبێت ئاگادارکردنەوەکانی کافێکە وەربگرێت، بکەرەوە",
  },
  "and press Send a test.": { ar: "واضغط أرسل تجربة.", ckb: "و تاقیکردنەوەیەک بنێرە دابگرە." },
  // States.
  Works: { ar: "يعمل", ckb: "کار دەکات" },
  "Needs attention": { ar: "يحتاج انتباهًا", ckb: "پێویستی بە سەرنجە" },
  "Not used here": { ar: "غير مستخدم هنا", ckb: "لێرە بەکار نایەت" },
  "Not tried yet": { ar: "لم يُجرَّب بعد", ckb: "هێشتا تاقی نەکراوەتەوە" },
  "{n} device(s) need attention.": {
    ar: "{n} جهاز يحتاج انتباهًا.",
    ckb: "{n} ئامێر پێویستی بە سەرنجە.",
  },
  "{n} of 7 tried.": { ar: "جُرّب {n} من 7.", ckb: "{n} لە 7 تاقی کراونەتەوە." },
  // What to do.
  "Check the Wi-Fi or the cable, then restart the router. The till keeps selling quick sales and table bills meanwhile, and sends them when the internet is back.":
    {
      ar: "افحص الواي فاي أو الكابل، ثم أعد تشغيل الراوتر. يواصل الصندوق البيع السريع وفواتير الطاولات خلال ذلك، ويرسلها عند عودة الإنترنت.",
      ckb: "وای فای یان کێبڵەکە بپشکنە، پاشان ڕاوتەرەکە دووبارە هەڵبکە. سندوقەکە لەم ماوەیەدا فرۆشتنی خێرا و حسابی مێزەکان بەردەوام دەکات، و کاتێک ئینتەرنێت گەڕایەوە دەیاننێرێت.",
    },
  "Check the printer is on, has paper and is chosen in the print dialog. Set the paper to 80 mm and the margins to none, then try again.":
    {
      ar: "تأكد أن الطابعة تعمل وفيها ورق ومختارة في نافذة الطباعة. اجعل الورق 80 مم والهوامش بلا، ثم أعد المحاولة.",
      ckb: "دڵنیابە چاپکەرەکە هەڵکراوە، کاغەزی تێدایە و لە پەنجەرەی چاپدا هەڵبژێردراوە. کاغەزەکە بکە 80 ملم و پەراوێزەکان هیچ، پاشان دووبارە هەوڵ بدەرەوە.",
    },
  "In the receipt printer's settings on this computer, turn on opening the cash drawer when printing. Check the drawer's cable is in the printer's drawer socket.":
    {
      ar: "في إعدادات طابعة الإيصالات على هذا الحاسوب، فعّل فتح درج النقود عند الطباعة. تأكد أن كابل الدرج في منفذ الدرج في الطابعة.",
      ckb: "لە ڕێکخستنەکانی چاپکەری پسوولە لەسەر ئەم کۆمپیوتەرە، کردنەوەی دەرجی پارە لە کاتی چاپدا هەڵبکە. دڵنیابە کێبڵی دەرجەکە لە کونی دەرجی چاپکەرەکەدایە.",
    },
  "Check the label printer is on, has labels and is chosen in the print dialog, with the label's size as its paper.":
    {
      ar: "تأكد أن طابعة الملصقات تعمل وفيها ملصقات ومختارة في نافذة الطباعة، بحجم الملصق ورقًا لها.",
      ckb: "دڵنیابە چاپکەری لەیبڵ هەڵکراوە، لەیبڵی تێدایە و لە پەنجەرەی چاپدا هەڵبژێردراوە، و قەبارەی لەیبڵەکە وەک کاغەزەکەی دانراوە.",
    },
  "Click in the box first, then scan. Check the scanner is plugged in and set to press Enter after each code.":
    {
      ar: "انقر في الخانة أولًا، ثم امسح. تأكد أن الماسح موصول ومضبوط ليضغط Enter بعد كل رمز.",
      ckb: "سەرەتا لە خانەکەدا کلیک بکە، پاشان سکان بکە. دڵنیابە سکانەرەکە بەستراوە و ڕێکخراوە کە دوای هەر کۆدێک Enter دابگرێت.",
    },
  "Set the scale to print EAN-13 labels starting with 2, and give each weighed product the scale's product code as its barcode on Products & Recipes.":
    {
      ar: "اضبط الميزان ليطبع ملصقات EAN-13 تبدأ بـ 2، وأعطِ كل منتج موزون رمز الميزان باركودًا له في المنتجات والوصفات.",
      ckb: "تەرازووەکە ڕێکبخە کە لەیبڵی EAN-13 چاپ بکات کە بە 2 دەست پێدەکات، و لە بەرهەمەکان و ڕەچەتەکان کۆدی تەرازوو وەک بارکۆد بدە بە هەر بەرهەمێکی کێشراو.",
    },
  "On the phone, open My account, turn on Phone warnings and press Send a test.": {
    ar: "على الهاتف، افتح حسابي، وفعّل تنبيهات الهاتف واضغط أرسل تجربة.",
    ckb: "لەسەر مۆبایلەکە، هەژمارەکەم بکەرەوە، ئاگادارکردنەوەی مۆبایل هەڵبکە و تاقیکردنەوەیەک بنێرە دابگرە.",
  },
};

export default phrases;
