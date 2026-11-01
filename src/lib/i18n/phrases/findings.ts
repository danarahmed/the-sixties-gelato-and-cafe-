import type { PhraseBook } from "./types";

/**
 * What writing the guide found, put right (0095): a delivery worth nothing,
 * the café's details and places on Settings, backup codes for the second
 * step, one phone for one person, and the words that read wrong.
 */
const phrases: PhraseBook = {
  // A delivery worth nothing.
  "Freight and other costs are shared by what the lines are worth: give the lines their prices": {
    ar: "تُوزَّع أجرة النقل والتكاليف الأخرى حسب قيمة البنود: أعطِ البنود أسعارها",
    ckb: "کرێی گواستنەوە و تێچووەکانی تر بەپێی نرخی هێڵەکان دابەش دەکرێن: نرخی هێڵەکان دابنێ",
  },
  "Delivery {1} came free: nothing to correct. Send its goods back, or record them as a loss": {
    ar: "التوريد {1} جاء مجانًا: لا شيء لتصحيحه. أعِد بضاعته، أو سجّلها خسارة",
    ckb: "باری {1} بەخۆڕایی هات: هیچ نییە بۆ ڕاستکردنەوە. کاڵاکانی بگەڕێنەوە، یان وەک زیان تۆماریان بکە",
  },
  "It came free: nothing to correct. Send its goods back, or record them as a loss": {
    ar: "جاء مجانًا: لا شيء لتصحيحه. أعِد بضاعته، أو سجّلها خسارة",
    ckb: "بەخۆڕایی هات: هیچ نییە بۆ ڕاستکردنەوە. کاڵاکانی بگەڕێنەوە، یان وەک زیان تۆماریان بکە",
  },
  "Delivery {1} came free: send its goods back without naming it": {
    ar: "التوريد {1} جاء مجانًا: أعِد بضاعته دون ذكره",
    ckb: "باری {1} بەخۆڕایی هات: کاڵاکانی بگەڕێنەوە بەبێ ناوهێنانی",
  },

  // The café's details.
  "Only the owner changes the café's details": {
    ar: "المالك وحده يغيّر بيانات المقهى",
    ckb: "تەنها خاوەن زانیارییەکانی کافێ دەگۆڕێت",
  },
  "The café's name is 2 to 80 letters": { ar: "اسم المقهى من 2 إلى 80 حرفًا", ckb: "ناوی کافێ 2 بۆ 80 پیتە" },
  "Choose one of the café's languages": { ar: "اختر إحدى لغات المقهى", ckb: "یەکێک لە زمانەکانی کافێ هەڵبژێرە" },
  "The currency, the time zone and bill numbers are fixed once the café has sold or posted anything": {
    ar: "العملة والمنطقة الزمنية وأرقام الفواتير تثبت بعد أن يبيع المقهى أو يسجّل أي شيء",
    ckb: "دراو و ناوچەی کات و ژمارەی پسوولەکان جێگیر دەبن کاتێک کافێ شتێکی فرۆشت یان تۆمار کرد",
  },
  "A currency is three capital letters, e.g. IQD": {
    ar: "العملة ثلاثة أحرف كبيرة، مثل IQD",
    ckb: "دراو سێ پیتی گەورەیە، بۆ نموونە IQD",
  },
  "The currency's sign is 1 to 6 letters": { ar: "رمز العملة من 1 إلى 6 أحرف", ckb: "هێمای دراو 1 بۆ 6 پیتە" },
  "A currency has 0 to 3 decimal places": {
    ar: "للعملة من 0 إلى 3 خانات عشرية",
    ckb: "دراو 0 بۆ 3 ژمارەی دوای خاڵی هەیە",
  },
  "That is not a time zone, e.g. Asia/Baghdad": {
    ar: "هذه ليست منطقة زمنية، مثل Asia/Baghdad",
    ckb: "ئەمە ناوچەی کات نییە، بۆ نموونە Asia/Baghdad",
  },
  "Bill numbers start with 2 to 8 capital letters or digits, a letter first": {
    ar: "تبدأ أرقام الفواتير بـ 2 إلى 8 أحرف كبيرة أو أرقام، أولها حرف",
    ckb: "ژمارەی پسوولەکان بە 2 بۆ 8 پیتی گەورە یان ژمارە دەست پێدەکەن، یەکەمیان پیتە",
  },

  // Places.
  "A place's name is 2 to 60 letters": { ar: "اسم المكان من 2 إلى 60 حرفًا", ckb: "ناوی شوێن 2 بۆ 60 پیتە" },
  "There is a place called {1} already": { ar: "يوجد مكان باسم {1} من قبل", ckb: "شوێنێک بە ناوی {1} پێشتر هەیە" },
  "Choose what kind of place it is": { ar: "اختر نوع المكان", ckb: "جۆری شوێنەکە هەڵبژێرە" },
  "That place is not one of the café's": { ar: "هذا المكان ليس من أماكن المقهى", ckb: "ئەو شوێنە هی کافێ نییە" },
  "Say why the place closes": { ar: "اذكر سبب إغلاق المكان", ckb: "بڵێ بۆچی شوێنەکە دادەخرێت" },
  "The café keeps at least one branch open": {
    ar: "يبقى للمقهى فرع واحد مفتوح على الأقل",
    ckb: "کافێ لانیکەم یەک لقی کراوە دەهێڵێتەوە",
  },
  "{1} has a drawer open: close it first": {
    ar: "في {1} درج مفتوح: أغلقه أولًا",
    ckb: "{1} دەخیلەیەکی کراوەی هەیە: سەرەتا دایبخە",
  },
  "{1} still holds stock: send it to another place, or record it as a loss, first": {
    ar: "ما زال في {1} مخزون: أرسله إلى مكان آخر، أو سجّله خسارة، أولًا",
    ckb: "{1} هێشتا کۆگای تێدایە: سەرەتا بینێرە بۆ شوێنێکی تر، یان وەک زیان تۆماری بکە",
  },
  "{1} has a table's bill open: settle or cancel it first": {
    ar: "في {1} فاتورة طاولة مفتوحة: سدّدها أو ألغِها أولًا",
    ckb: "{1} پسوولەی مێزێکی کراوەی هەیە: سەرەتا پارەکەی وەربگرە یان هەڵیبوەشێنەوە",
  },
  "{1} has a pre-order waiting: collect or cancel it first": {
    ar: "في {1} طلب مسبق ينتظر: سلّمه أو ألغِه أولًا",
    ckb: "{1} داواکارییەکی پێشوەختەی چاوەڕوانی هەیە: سەرەتا ڕادەستی بکە یان هەڵیبوەشێنەوە",
  },

  // Backup codes for the second step.
  "Turn on the second step first": { ar: "فعّل الخطوة الثانية أولًا", ckb: "سەرەتا هەنگاوی دووەم چالاک بکە" },
  "That backup code is not right, or was used already": {
    ar: "رمز الاحتياط هذا غير صحيح، أو استُخدم من قبل",
    ckb: "ئەم کۆدە یەدەگە دروست نییە، یان پێشتر بەکارهاتووە",
  },
  "Too many tries: wait an hour, then try again": {
    ar: "محاولات كثيرة: انتظر ساعة، ثم حاول مجددًا",
    ckb: "هەوڵی زۆر: کاتژمێرێک چاوەڕێ بکە، پاشان دووبارە هەوڵ بدەرەوە",
  },

  // One phone, one person.
  "The phone was linked to someone else": {
    ar: "رُبط الهاتف بشخص آخر",
    ckb: "مۆبایلەکە بە کەسێکی ترەوە بەسترا",
  },
};

export default phrases;
