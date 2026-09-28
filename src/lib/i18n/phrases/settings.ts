import type { PhraseBook } from "./types";

/**
 * Settings, people and roles, alert limits, first-time setup, signing in and the account page, the till's messages, and approvals.
 */
const phrases: PhraseBook = {
  // Settings (src/app/settings/page.tsx).
  "Business name": { ar: "اسم العمل", ckb: "ناوی کار" },
  Currency: { ar: "العملة", ckb: "دراو" },
  "{code} — {n} decimal places": {
    ar: "{code} — عدد المراتب العشرية: {n}",
    ckb: "{code} — ژمارەی شوێنە دەیییەکان: {n}",
  },
  Timezone: { ar: "المنطقة الزمنية", ckb: "ناوچەی کاتی" },
  "{timezone} — every trading day and period runs midnight to midnight here": {
    ar: "{timezone} — كل يوم عمل وكل فترة يمتدان من منتصف الليل إلى منتصف الليل بتوقيت هذه المنطقة",
    ckb: "{timezone} — هەموو ڕۆژێکی کار و هەموو ماوەیەک بە کاتی ئێرە لە نیوەشەوەوە تا نیوەشەو دەخایەنێت",
  },
  "Default language": { ar: "اللغة الافتراضية", ckb: "زمانی بنەڕەت" },
  "Negative stock": { ar: "المخزون السالب", ckb: "کۆگای ژێر سفر" },
  "Refused — a sale needs the stock to be there": {
    ar: "مرفوض — يتطلب البيع أن يكون المخزون موجودًا",
    ckb: "ڕێگەپێنەدراو — فرۆشتن پێویستی بەوەیە کاڵاکە لە کۆگادا هەبێت",
  },
  "Allowed, costed at the last purchase cost": {
    ar: "مسموح، ويُحتسب بكلفة آخر شراء",
    ckb: "ڕێگەپێدراو، بە تێچووی دوایین کڕین هەژمار دەکرێت",
  },
  "Waste needing a manager": {
    ar: "الهدر الذي يحتاج إلى مدير",
    ckb: "ئەو بەفیڕۆچوونەی بەڕێوەبەری پێویستە",
  },
  "Above {amount}": { ar: "أكثر من {amount}", ckb: "زیاتر لە {amount}" },
  Discounts: { ar: "الخصومات", ckb: "داشکاندنەکان" },
  "A percentage is rounded to the nearest {step} (half-way rounds up); an amount is taken as typed":
    {
      ar: "تُقرَّب النسبة المئوية إلى أقرب {step} (والنصف يُقرَّب إلى الأعلى)؛ ويؤخذ المبلغ كما كُتب",
      ckb: "ڕێژەی سەدی بۆ نزیکترین {step} خڕ دەکرێتەوە (نیوە بۆ سەرەوە خڕ دەکرێتەوە)؛ بڕی پارە وەک خۆی وەردەگیرێت",
    },
  "Discounts a manager approves": {
    ar: "الخصومات التي يوافق عليها المدير",
    ckb: "ئەو داشکاندنانەی بەڕێوەبەر ڕەزامەندییان لەسەر دەدات",
  },
  "Over {cap}% of the bill: a manager (owner, general or branch manager) approves it on the till with their name and PIN, or gives it themselves. Every discount, void, refund and cancelled bill takes a reason from the list":
    {
      ar: "أكثر من {cap}% من الفاتورة: يوافق عليه مدير (المالك أو المدير العام أو مدير الفرع) على نقطة البيع باسمه ورمزه السري، أو يمنحه بنفسه. كل خصم وإلغاء واسترداد وفاتورة ملغاة يأخذ سببًا من القائمة",
      ckb: "زیاتر لە {cap}%ی پسووڵەکە: بەڕێوەبەرێک (خاوەن، بەڕێوەبەری گشتی یان بەڕێوەبەری لق) لەسەر خاڵی فرۆشتن بە ناو و PIN ـەکەی ڕەزامەندی لەسەر دەدات، یان خۆی دەیدات. هەموو داشکاندنێک، هەڵوەشاندنەوەیەک، گەڕاندنەوەیەکی پارە و پسووڵەیەکی هەڵوەشێنراو هۆکارێک لە لیستەکە وەردەگرێت",
    },
  "Bill numbers": { ar: "أرقام الفواتير", ckb: "ژمارەی پسووڵەکان" },
  "{prefix}-{year}-0001, -0002 … for a bill entered without the supplier's number: never given twice, never typed in by hand":
    {
      ar: "{prefix}-{year}-0001, -0002 … لفاتورة تُدخَل دون رقم المورّد: لا يتكرر الرقم أبدًا، ولا يُكتب يدويًا أبدًا",
      ckb: "{prefix}-{year}-0001, -0002 … بۆ پسووڵەیەک کە بەبێ ژمارەی دابینکەر تۆمار دەکرێت: هەرگیز دوو جار نادرێت و هەرگیز بە دەست نانووسرێت",
    },
  People: { ar: "الأشخاص", ckb: "کەسەکان" },
  "Add a person with their email and role. They then open this app, choose “First time here?”, and create their login with that same email; once they confirm it, they are in — with exactly what their role allows. Deactivating someone takes effect on their very next click.":
    {
      ar: "أضف شخصًا ببريده الإلكتروني ودوره. ثم يفتح هذا التطبيق، ويختار «أول مرة هنا؟»، وينشئ حسابه بالبريد نفسه؛ وبعد أن يؤكّده يدخل — بما يسمح به دوره بالضبط. إيقاف أي شخص يسري من نقرته التالية مباشرةً.",
      ckb: "کەسێک بە ئیمەیڵ و ڕۆڵەکەیەوە زیاد بکە. پاشان ئەم بەرنامەیە دەکاتەوە، «یەکەم جارتە؟» هەڵدەبژێرێت، و بە هەمان ئیمەیڵ هەژمارەکەی دروست دەکات؛ کە پشتڕاستی کردەوە، دەچێتە ژوورەوە — ڕێک بەوەی ڕۆڵەکەی ڕێگەی پێدەدات. ناچالاککردنی هەر کەسێک لە کلیکی داهاتوویەوە کار دەکات.",
    },
  "Business configuration": { ar: "إعدادات العمل", ckb: "ڕێکخستنی کار" },
  "These are changed in the database by the owner; there is no screen for them yet.": {
    ar: "يغيّر المالك هذه القيم في قاعدة البيانات؛ ولا توجد لها شاشة بعد.",
    ckb: "خاوەن ئەمانە لە بنکەدراوەکەدا دەگۆڕێت؛ هێشتا شاشەیەکیان بۆ نییە.",
  },
  Alerts: { ar: "التنبيهات", ckb: "ئاگادارکردنەوەکان" },
  "The dashboard checks the books against these each time it opens, and says what needs someone: red now, orange soon. Leave a box empty to follow its default. How long a supplier takes to deliver is set on each vendor (Vendors → Edit); this is for the rest.":
    {
      ar: "تفحص لوحة التحكم الدفاتر مقابل هذه الحدود كلما فُتحت، وتذكر ما يحتاج إلى متابعة: الأحمر الآن، والبرتقالي قريبًا. اترك الخانة فارغة لتتبع قيمتها الافتراضية. مدة توصيل كل مورّد تُضبط عند المورّد نفسه (المورّدون ← تعديل)؛ وهذه للباقين.",
      ckb: "داشبۆرد هەر جارێک دەکرێتەوە دەفتەرەکان بەم سنوورانە دەپشکنێت، و دەڵێت چی پێویستی بە کەسێکە: سوور بۆ ئێستا، پرتەقاڵی بۆ بەم زووانە. خانەیەک بەتاڵ بهێڵەوە بۆ ئەوەی بەهای بنەڕەتی خۆی وەربگرێت. ماوەی گەیاندنی هەر دابینکەرێک لەسەر خۆی دادەنرێت (دابینکەران ← دەستکاری)؛ ئەمە بۆ ئەوانی ترە.",
    },
  Locations: { ar: "المواقع", ckb: "شوێنەکان" },
  Branch: { ar: "فرع", ckb: "لق" },
  "Central kitchen": { ar: "مطبخ مركزي", ckb: "چێشتخانەی ناوەندی" },
  Warehouse: { ar: "مستودع", ckb: "ئەمبار" },
  active: { ar: "نشط", ckb: "چالاک" },
  inactive: { ar: "غير نشط", ckb: "ناچالاک" },
  "Roles & what they may do": {
    ar: "الأدوار وما يُسمح لكلٍّ منها",
    ckb: "ڕۆڵەکان و ئەوەی ڕێگەیان پێدراوە",
  },
  "Enforced by the database on every read and write — the screens only follow it. A cashier sells but never sees a cost; a counter never sees what the ledger expects; a count is approved by someone other than its counter; only the owner reopens a locked period.":
    {
      ar: "تفرضها قاعدة البيانات عند كل قراءة وكتابة — والشاشات تتبعها فقط. أمين الصندوق يبيع ولا يرى أي كلفة؛ وعادّ المخزون لا يرى ما يتوقعه السجل؛ ويوافق على الجرد شخص غير الذي عدّه؛ والمالك وحده يعيد فتح فترة مقفلة.",
      ckb: "بنکەدراوەکە لە هەموو خوێندنەوە و نووسینێکدا جێبەجێی دەکات — شاشەکان تەنها پەیڕەوی دەکەن. کاشێر دەفرۆشێت بەڵام هەرگیز تێچوو نابینێت؛ ژمێرەری کۆگا هەرگیز نابینێت دەفتەر چی چاوەڕێ دەکات؛ ژماردن کەسێکی تر جگە لە ژمێرەرەکەی پەسەندی دەکات؛ تەنها خاوەن ماوەیەکی داخراو دەکاتەوە.",
    },

  // Alert limits (src/app/settings/AlertThresholds.tsx), and each limit's
  // name as the database gives it (src/lib/alerts.ts, THRESHOLD_LABEL).
  "Nothing changed.": { ar: "لم يتغيّر شيء.", ckb: "هیچ شتێک نەگۆڕا." },
  "Saved, and on the audit trail. The dashboard uses them now.": {
    ar: "حُفظت، وهي في سجل التدقيق. تستخدمها لوحة التحكم الآن.",
    ckb: "پاشەکەوت کران، و لە تۆماری گۆڕانکارییەکاندان. داشبۆرد ئێستا بەکاریان دەهێنێت.",
  },
  "Default {default} · {min} to {max}": {
    ar: "الافتراضي {default} · من {min} إلى {max}",
    ckb: "بنەڕەت {default} · لە {min} بۆ {max}",
  },
  "now {value}": { ar: "الآن {value}", ckb: "ئێستا {value}" },
  "Save thresholds": { ar: "حفظ الحدود", ckb: "پاشەکەوتکردنی سنوورەکان" },
  "{1}: enter a number": { ar: "{1}: أدخل رقمًا", ckb: "{1}: ژمارەیەک بنووسە" },
  "{1}: enter a whole number from {2} to {3}": {
    ar: "{1}: أدخل عددًا صحيحًا من {2} إلى {3}",
    ckb: "{1}: ژمارەیەکی تەواو لە {2} بۆ {3} بنووسە",
  },
  "{1}: enter a number from {2} to {3}": {
    ar: "{1}: أدخل رقمًا من {2} إلى {3}",
    ckb: "{1}: ژمارەیەک لە {2} بۆ {3} بنووسە",
  },
  "Days a delivery takes (vendors without their own)": {
    ar: "أيام التوصيل (للمورّدين الذين لم تُحدَّد لهم مدة)",
    ckb: "ڕۆژانی گەیاندن (بۆ ئەو دابینکەرانەی ماوەی خۆیان نییە)",
  },
  "Margin target (%)": { ar: "هامش الربح المستهدف (%)", ckb: "ئامانجی پەراوێزی قازانج (%)" },
  "Hours a stock count may stay open": {
    ar: "الساعات التي يجوز أن يبقى فيها الجرد مفتوحًا",
    ckb: "ئەو کاتژمێرانەی ژماردنی کۆگا دەتوانێت کراوە بمێنێتەوە",
  },
  "Waste spike: times a usual week": {
    ar: "ارتفاع الهدر: أضعاف الأسبوع المعتاد",
    ckb: "بەرزبوونەوەی بەفیڕۆچوون: چەند ئەوەندەی هەفتەیەکی ئاسایی",
  },
  "Waste spike: at least (IQD)": {
    ar: "ارتفاع الهدر: على الأقل (IQD)",
    ckb: "بەرزبوونەوەی بەفیڕۆچوون: لانیکەم (IQD)",
  },
  "Exceptions by one person in 7 days": {
    ar: "استثناءات شخص واحد خلال 7 أيام",
    ckb: "ئاوارتەکانی یەک کەس لە 7 ڕۆژدا",
  },
  "Exceptions as a share of their sales (%)": {
    ar: "الاستثناءات كنسبة من مبيعاته (%)",
    ckb: "ئاوارتەکان وەک بەشێک لە فرۆشتنەکانی (%)",
  },
  "Days card money takes to reach the bank": {
    ar: "الأيام التي يستغرقها وصول مال البطاقات إلى البنك",
    ckb: "ئەو ڕۆژانەی پارەی کارت پێیدەچێت تا بگاتە بانک",
  },
  "Days a delivery platform takes to pay": {
    ar: "الأيام التي تستغرقها منصة التوصيل لتدفع",
    ckb: "ئەو ڕۆژانەی پلاتفۆرمی گەیاندن پێیدەچێت تا پارە بدات",
  },
  "Days before a bill is due to warn": {
    ar: "أيام التنبيه قبل استحقاق الفاتورة",
    ckb: "چەند ڕۆژ پێش کاتی دانی پسووڵە ئاگادار بکرێتەوە",
  },
  "Price typo: times another channel's price": {
    ar: "خطأ في كتابة السعر: أضعاف سعر قناة أخرى",
    ckb: "هەڵەی نووسینی نرخ: چەند ئەوەندەی نرخی کەناڵێکی تر",
  },

  // People (src/components/PeopleManager.tsx).
  "Only the owner can give this role": {
    ar: "المالك وحده يستطيع منح هذا الدور",
    ckb: "تەنها خاوەن دەتوانێت ئەم ڕۆڵە بدات",
  },
  Email: { ar: "البريد الإلكتروني", ckb: "ئیمەیڵ" },
  Roles: { ar: "الأدوار", ckb: "ڕۆڵەکان" },
  Login: { ar: "الحساب", ckb: "هەژمار" },
  "(you)": { ar: "(أنت)", ckb: "(تۆ)" },
  deactivated: { ar: "موقوف", ckb: "ناچالاککراو" },
  "signed in": { ar: "سجّل الدخول", ckb: "چووەتە ژوورەوە" },
  invited: { ar: "مدعوّ", ckb: "بانگهێشتکراو" },
  "Roles changed for {name}.": { ar: "تغيّرت أدوار {name}.", ckb: "ڕۆڵەکانی {name} گۆڕدران." },
  Deactivate: { ar: "إيقاف", ckb: "ناچالاککردن" },
  Reactivate: { ar: "إعادة التفعيل", ckb: "چالاککردنەوە" },
  "{name} can no longer sign in to the books.": {
    ar: "لم يعد بإمكان {name} الدخول إلى الدفاتر.",
    ckb: "{name} چیتر ناتوانێت بچێتە ناو دەفتەرەکان.",
  },
  "{name} is active again.": { ar: "عاد {name} نشطًا.", ckb: "{name} دووبارە چالاکە." },
  "Add a person": { ar: "إضافة شخص", ckb: "زیادکردنی کەسێک" },
  "Add person": { ar: "أضف الشخص", ckb: "کەسەکە زیاد بکە" },
  "Added. Ask them to create their login with {email}.": {
    ar: "تمت الإضافة. اطلب منه أن ينشئ حسابه بالبريد {email}.",
    ckb: "زیاد کرا. داوای لێ بکە هەژمارەکەی بە {email} دروست بکات.",
  },

  // First-time setup (src/app/setup/page.tsx).
  "Not configured": { ar: "غير مُعدّ", ckb: "ڕێکنەخراوە" },
  "This deployment has no database connection, so it shows nothing and records nothing. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> for the environment and deploy again.":
    {
      ar: "لا يملك هذا النشر اتصالًا بقاعدة البيانات، لذا لا يعرض شيئًا ولا يسجّل شيئًا. اضبط <code>NEXT_PUBLIC_SUPABASE_URL</code> و<code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> للبيئة ثم انشر مرة أخرى.",
      ckb: "ئەم دامەزراندنە هیچ پەیوەندییەکی بە بنکەدراوەوە نییە، بۆیە هیچ پیشان نادات و هیچ تۆمار ناکات. <code>NEXT_PUBLIC_SUPABASE_URL</code> و <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> بۆ ژینگەکە دابنێ و دووبارە دایبمەزرێنەوە.",
    },
  "There is intentionally no built-in default: a copy of the app must never write to another business's books by accident. See <code>docs/guides/deployment.md</code>.":
    {
      ar: "لا توجد قيمة افتراضية مدمجة عن قصد: يجب ألّا تكتب أي نسخة من التطبيق في دفاتر عمل آخر عن طريق الخطأ. انظر <code>docs/guides/deployment.md</code>.",
      ckb: "بە ئەنقەست هیچ بەهایەکی بنەڕەتی تێدا نییە: هیچ کۆپییەکی بەرنامەکە نابێت بە هەڵە لە دەفتەرەکانی کارێکی تردا بنووسێت. سەیری <code>docs/guides/deployment.md</code> بکە.",
    },

  // The reason a discount already on a bill was given, as the database keeps
  // it (reason_code), shown on the till: the same words as reason.discount.*.
  "Staff meal": { ar: "وجبة موظف", ckb: "خواردنی کارمەند" },
  "On the house": { ar: "ضيافة من المحل", ckb: "میوانداری" },
  "Regular customer": { ar: "زبون دائم", ckb: "کڕیاری هەمیشەیی" },
  "To make up for a complaint": { ar: "تعويضًا عن شكوى", ckb: "بۆ قەرەبووی سکاڵایەک" },
  Promotion: { ar: "عرض ترويجي", ckb: "ئۆفەر" },

  // What the till's actions answer (src/lib/actions/pos.ts).
  "This bill has no version": {
    ar: "لا يوجد رقم إصدار لهذه الفاتورة",
    ckb: "ئەم پسووڵەیە ژمارەی وەشانی نییە",
  },
  "a product": { ar: "منتجًا", ckb: "بەرهەمێک" },
  "Add something to the bill first": {
    ar: "أضف شيئًا إلى الفاتورة أولًا",
    ckb: "سەرەتا شتێک بخە سەر پسووڵەکە",
  },
  "Give the bill a table or a name": {
    ar: "حدّد للفاتورة طاولة أو اسمًا",
    ckb: "مێزێک یان ناوێک بدە بە پسووڵەکە",
  },
  "Give the discount as a percentage or as an amount, not both": {
    ar: "أدخل الخصم كنسبة مئوية أو كمبلغ، لا الاثنين معًا",
    ckb: "داشکاندنەکە بە ڕێژەی سەدی یان بە بڕی پارە بنووسە، نەک هەردووکیان",
  },
  "a bill": { ar: "فاتورة", ckb: "پسووڵەیەک" },
  "a table": { ar: "طاولة", ckb: "مێزێک" },
  "an approval": { ar: "موافقة", ckb: "ڕەزامەندییەک" },
  "This payment has no idempotency key": {
    ar: "لا يحمل هذا الدفع مفتاحًا يمنع تسجيله مرتين",
    ckb: "ئەم پارەدانە کلیلێکی نییە کە ڕێگری لە دوو جار تۆمارکردنی بکات",
  },
  "Choose how it was paid": { ar: "اختر طريقة الدفع", ckb: "هەڵبژێرە چۆن پارە درا" },
  "The total shown": { ar: "المجموع المعروض", ckb: "کۆی پیشاندراو" },
  "a line": { ar: "سطرًا", ckb: "هێڵێک" },
  "Choose what to move to the new bill": {
    ar: "اختر ما يُنقل إلى الفاتورة الجديدة",
    ckb: "هەڵبژێرە چی بگوازرێتەوە بۆ پسووڵە نوێیەکە",
  },
  "The table's name": { ar: "اسم الطاولة", ckb: "ناوی مێزەکە" },
  "Seats must be 1 to 99": {
    ar: "يجب أن يكون عدد المقاعد من 1 إلى 99",
    ckb: "ژمارەی کورسییەکان دەبێت لە 1 بۆ 99 بێت",
  },

  // What adding people answers (src/lib/actions/people.ts).
  "Enter the person's email": {
    ar: "أدخل البريد الإلكتروني للشخص",
    ckb: "ئیمەیڵی کەسەکە بنووسە",
  },
  "Their name": { ar: "اسم الشخص", ckb: "ناوی کەسەکە" },
  "Give the person at least one role": {
    ar: "امنح الشخص دورًا واحدًا على الأقل",
    ckb: "لانیکەم یەک ڕۆڵ بدە بە کەسەکە",
  },
  "a person": { ar: "شخصًا", ckb: "کەسێک" },

  // What approvals answer (src/lib/actions/approvals.ts).
  "Unknown approval": { ar: "موافقة غير معروفة", ckb: "ڕەزامەندییەکی نەناسراو" },
  "who approves it": { ar: "من يوافق عليه", ckb: "ئەو کەسەی ڕەزامەندی دەدات" },
  "A PIN is 4 to 8 digits": {
    ar: "الرمز السري من 4 إلى 8 أرقام",
    ckb: "PIN لە 4 بۆ 8 ژمارە پێکدێت",
  },
  "Not approved": { ar: "لم تتم الموافقة", ckb: "ڕەزامەندی نەدرا" },
  "The two PINs are not the same": {
    ar: "الرمزان السريان غير متطابقين",
    ckb: "هەردوو PIN ـەکە وەک یەک نین",
  },

  // What signing in answers (src/lib/auth/actions.ts).
  "Enter your email address": {
    ar: "أدخل عنوان بريدك الإلكتروني",
    ckb: "ناونیشانی ئیمەیڵەکەت بنووسە",
  },
  "Passwords are at least 8 characters": {
    ar: "كلمة المرور 8 أحرف على الأقل",
    ckb: "وشەی نهێنی لانیکەم 8 پیتە",
  },
  "Check the form": { ar: "راجع النموذج", ckb: "فۆڕمەکە بپشکنە" },
  "Confirm your email first — the link is in the message we sent you.": {
    ar: "أكّد بريدك الإلكتروني أولًا — الرابط في الرسالة التي أرسلناها إليك.",
    ckb: "سەرەتا ئیمەیڵەکەت پشتڕاست بکەرەوە — بەستەرەکە لەو نامەیەدایە کە بۆمان ناردوویت.",
  },
  "That email and password do not match.": {
    ar: "البريد الإلكتروني وكلمة المرور غير متطابقين.",
    ckb: "ئەو ئیمەیڵ و وشەی نهێنییە یەک ناگرنەوە.",
  },
  "Check your email and open the confirmation link. If the owner invited this address, you can then sign in.":
    {
      ar: "افتح بريدك الإلكتروني واضغط رابط التأكيد. إن كان المالك قد دعا هذا العنوان، يمكنك بعدها تسجيل الدخول.",
      ckb: "ئیمەیڵەکەت بپشکنە و بەستەری پشتڕاستکردنەوەکە بکەرەوە. ئەگەر خاوەن ئەم ناونیشانەی بانگهێشت کردبێت، دواتر دەتوانیت بچیتە ژوورەوە.",
    },
  "If that address has a login, a link to set a new password is on its way.": {
    ar: "إن كان لهذا العنوان حساب، فرابط تعيين كلمة مرور جديدة في الطريق إليه.",
    ckb: "ئەگەر ئەو ناونیشانە هەژماری هەبێت، بەستەرێک بۆ دانانی وشەی نهێنی نوێ بەڕێوەیە.",
  },
  "Use at least 8 characters": {
    ar: "استخدم 8 أحرف على الأقل",
    ckb: "لانیکەم 8 پیت بەکاربهێنە",
  },
  "Too short": { ar: "قصير جدًا", ckb: "زۆر کورتە" },
  "The two passwords differ": {
    ar: "كلمتا المرور مختلفتان",
    ckb: "هەردوو وشە نهێنییەکە جیاوازن",
  },
  "Your password is changed.": {
    ar: "تم تغيير كلمة المرور.",
    ckb: "وشەی نهێنییەکەت گۆڕدرا.",
  },

  // The rules on Settings (0040).
  Rules: { ar: "القواعد", ckb: "یاساکان" },
  "Back to Settings": { ar: "العودة إلى الإعدادات", ckb: "گەڕانەوە بۆ ڕێکخستنەکان" },
  "The discount a cashier gives without a manager, the refunds and losses a second person approves, and what happens when more stock is used than the books hold. Each is changed on Rules, with a reason, and every change is kept.":
    {
      ar: "الخصم الذي يعطيه الكاشير دون مدير، والاستردادات والخسائر التي يوافق عليها شخص ثانٍ، وما يحدث حين يُستخدم مخزون أكثر مما تحتفظ به الدفاتر. يُغيَّر كل منها من «القواعد» مع ذكر السبب، ويُحفظ كل تغيير.",
      ckb: "ئەو داشکاندنەی کاشێر بەبێ بەڕێوەبەر دەیدات، ئەو گەڕاندنەوەی پارە و زیانانەی کەسێکی دووەم ڕەزامەندییان لەسەر دەدات، و ئەوەی ڕوودەدات کاتێک کۆگایەکی زیاتر لەوەی لە دەفتەرەکاندایە بەکاردەهێنرێت. هەر یەکەیان لە «یاساکان» بە هۆکارەوە دەگۆڕدرێت، و هەموو گۆڕانکارییەک دەپارێزرێت.",
    },
  "{n} more for roles or items": { ar: "و{n} أخرى لأدوار أو مواد", ckb: "{n}ی تر بۆ ڕۆڵ یان کاڵا" },
  "Open Rules →": { ar: "افتح القواعد ←", ckb: "یاساکان بکەرەوە ←" },
  "How the café works: the discount a cashier gives without a manager, the refunds and losses a second person approves, and what happens when more stock is used than the books hold. A rule set for a role, a kind of item or one item is used before the whole café's. Every change takes a reason, and is kept below and on the audit trail.":
    {
      ar: "كيف يعمل المقهى: الخصم الذي يعطيه الكاشير دون مدير، والاستردادات والخسائر التي يوافق عليها شخص ثانٍ، وما يحدث حين يُستخدم مخزون أكثر مما تحتفظ به الدفاتر. القاعدة الموضوعة لدور أو لنوع من المواد أو لمادة واحدة تسبق قاعدة المقهى كله. كل تغيير يحتاج إلى سبب، ويُحفظ أدناه وفي سجل التدقيق.",
      ckb: "کافێکە چۆن کار دەکات: ئەو داشکاندنەی کاشێر بەبێ بەڕێوەبەر دەیدات، ئەو گەڕاندنەوەی پارە و زیانانەی کەسێکی دووەم ڕەزامەندییان لەسەر دەدات، و ئەوەی ڕوودەدات کاتێک کۆگایەکی زیاتر لەوەی لە دەفتەرەکاندایە بەکاردەهێنرێت. یاسایەک کە بۆ ڕۆڵێک، جۆرێک لە کاڵا یان یەک کاڵا دانرابێت پێش یاسای هەموو کافێکە بەکاردێت. هەموو گۆڕانکارییەک هۆکاری دەوێت، و لە خوارەوە و لە تۆماری گۆڕانکارییەکاندا دەپارێزرێت.",
    },
  Default: { ar: "الافتراضي", ckb: "بنەڕەت" },
  Rule: { ar: "القاعدة", ckb: "یاسا" },
  Set: { ar: "وُضعت", ckb: "دانرا" },
  "No rule has been changed yet.": {
    ar: "لم تُغيَّر أي قاعدة بعد.",
    ckb: "هێشتا هیچ یاسایەک نەگۆڕدراوە.",
  },
  "{who}, {when}": { ar: "{who}، {when}", ckb: "{who}، {when}" },
  Change: { ar: "تغيير", ckb: "گۆڕین" },
  "Back to default": { ar: "إعادة إلى الافتراضي", ckb: "گەڕاندنەوە بۆ بنەڕەت" },
  "+ Set it for {what}": { ar: "+ ضعها لـ{what}", ckb: "+ دایبنێ بۆ {what}" },
  "Set it back to the default": { ar: "أعدها إلى الافتراضي", ckb: "بیگەڕێنەوە بۆ بنەڕەت" },
  "Enter a number within the rule's limits": {
    ar: "أدخل رقمًا ضمن حدود القاعدة",
    ckb: "ژمارەیەک لە ناو سنوورەکانی یاساکە بنووسە",
  },
  "Discounts rounded to": { ar: "تُقرَّب الخصومات إلى", ckb: "داشکاندنەکان بازنە دەکرێن بۆ" },
  "Refunds a second person approves": {
    ar: "استردادات يوافق عليها شخص ثانٍ",
    ckb: "ئەو گەڕاندنەوەی پارانەی کەسێکی دووەم ڕەزامەندییان لەسەر دەدات",
  },
  "Losses a manager approves": {
    ar: "خسائر يوافق عليها مدير",
    ckb: "ئەو زیانانەی بەڕێوەبەر ڕەزامەندییان لەسەر دەدات",
  },
  "One person's losses are added up over": {
    ar: "تُجمع خسائر الشخص الواحد على مدى",
    ckb: "زیانەکانی یەک کەس کۆدەکرێنەوە لە ماوەی",
  },
  "Using more stock than the books hold": {
    ar: "استخدام مخزون أكثر مما تحتفظ به الدفاتر",
    ckb: "بەکارهێنانی کۆگای زیاتر لەوەی لە دەفتەرەکاندایە",
  },
  "Over this share of the bill, a discount needs a manager's name and PIN on the till; a manager gives it themselves. Set it for a role to let that role give more, or less.":
    {
      ar: "فوق هذه النسبة من الفاتورة يحتاج الخصم إلى اسم مدير ورمز PIN على نقطة البيع؛ والمدير يعطيه بنفسه. ضعها لدور لتسمح لذلك الدور بأن يعطي أكثر أو أقل.",
      ckb: "لە سەرووی ئەم بەشەی پسووڵەکەوە، داشکاندن پێویستی بە ناو و PIN ی بەڕێوەبەرێک هەیە لەسەر خاڵی فرۆشتن؛ بەڕێوەبەر خۆی دەیدات. بۆ ڕۆڵێک دایبنێ بۆ ئەوەی ئەو ڕۆڵە زیاتر یان کەمتر بدات.",
    },
  "A discount given as a percentage is rounded to the nearest step (half-way rounds up); an amount is taken as typed.":
    {
      ar: "يُقرَّب الخصم المعطى نسبةً مئوية إلى أقرب خطوة (والنصف يُقرَّب إلى الأعلى)؛ أما المبلغ فيؤخذ كما كُتب.",
      ckb: "داشکاندنێک کە بە ڕێژەی سەدی درابێت بۆ نزیکترین هەنگاو بازنە دەکرێت (نیوە بۆ سەرەوە دەچێت)؛ بڕیش وەک نووسراوە وەردەگیرێت.",
    },
  "A refund of more than this needs a second person's name and PIN. Set it for a role to trust that role with more.":
    {
      ar: "يحتاج الاسترداد الذي يزيد على هذا إلى اسم شخص ثانٍ ورمز PIN الخاص به. ضعها لدور لتأتمن ذلك الدور على أكثر.",
      ckb: "گەڕاندنەوەی پارە کە لەمە زیاتر بێت پێویستی بە ناو و PIN ی کەسێکی دووەم هەیە. بۆ ڕۆڵێک دایبنێ بۆ ئەوەی متمانەی زیاتر بەو ڕۆڵە بدەیت.",
    },
  "A loss over this — on its own, added to the person's other losses, or to the item's losses today — needs a manager: their PIN on the spot, or it waits for their approval under Needs you.":
    {
      ar: "الخسارة التي تتجاوز هذا — وحدها، أو مضافةً إلى خسائر الشخص الأخرى، أو إلى خسائر المادة اليوم — تحتاج إلى مدير: رمز PIN الخاص به في الحال، أو تنتظر موافقته تحت «يحتاج إليك».",
      ckb: "زیانێک لە سەرووی ئەمەوە — بە تەنها، یان لەگەڵ زیانەکانی تری ئەو کەسە، یان لەگەڵ زیانەکانی ئەمڕۆی کاڵاکە — پێویستی بە بەڕێوەبەرێک هەیە: PIN ی ئەو لە هەمان کاتدا، یان لە ژێر «پێویستی بە تۆیە» چاوەڕێی ڕەزامەندییەکەی دەکات.",
    },
  "An item's losses by anyone are always added up over the day. A person's are added up as chosen here.":
    {
      ar: "تُجمع خسائر المادة من أي شخص دائمًا على مدى اليوم. أما خسائر الشخص فتُجمع كما يُختار هنا.",
      ckb: "زیانەکانی کاڵایەک لەلایەن هەر کەسێکەوە هەمیشە لە ماوەی ڕۆژەکەدا کۆدەکرێنەوە. هی کەسێکیش وەک لێرە هەڵدەبژێردرێت کۆدەکرێنەوە.",
    },
  "When a sale, a loss, a batch or a correction would use more than the books hold. By default, what is made here is refused and everything else is allowed with a red alert. “Allowed, with no alert” is for chosen items only.":
    {
      ar: "حين يستخدم بيع أو خسارة أو دفعة أو تصحيح أكثر مما تحتفظ به الدفاتر. افتراضيًا يُرفض ما يُصنع هنا، ويُسمح بكل ما سواه مع تنبيه أحمر. «مسموح، دون تنبيه» لمواد مختارة فقط.",
      ckb: "کاتێک فرۆشتنێک، زیانێک، دەفعەیەک یان ڕاستکردنەوەیەک زیاتر لەوەی لە دەفتەرەکاندایە بەکاردەهێنێت. بە شێوەی بنەڕەت، ئەوەی لێرە دروستدەکرێت ڕەتدەکرێتەوە و هەموو شتێکی تر بە ئاگادارکردنەوەیەکی سوور ڕێگەی پێدەدرێت. «ڕێگەپێدراو، بەبێ ئاگادارکردنەوە» تەنها بۆ کاڵا هەڵبژێردراوەکانە.",
    },
  Refused: { ar: "مرفوض", ckb: "ڕەتکراوە" },
  "A manager approves it": { ar: "يوافق عليه مدير", ckb: "بەڕێوەبەرێک ڕەزامەندی لەسەر دەدات" },
  "Allowed, with a red alert": {
    ar: "مسموح، مع تنبيه أحمر",
    ckb: "ڕێگەپێدراو، بە ئاگادارکردنەوەیەکی سوور",
  },
  "Allowed, with no alert": { ar: "مسموح، دون تنبيه", ckb: "ڕێگەپێدراو، بەبێ ئاگادارکردنەوە" },
  "Each loss on its own": { ar: "كل خسارة وحدها", ckb: "هەر زیانێک بە تەنها" },
  "Their cash session, or their day": {
    ar: "جلسة صندوقه، أو يومه",
    ckb: "شیفتی پارەکەی، یان ڕۆژەکەی",
  },
  "The day": { ar: "اليوم", ckb: "ڕۆژەکە" },
  "The whole café": { ar: "المقهى كله", ckb: "هەموو کافێکە" },
  "A role": { ar: "دور", ckb: "ڕۆڵێک" },
  "A branch": { ar: "فرع", ckb: "لقێک" },
  "A kind of item": { ar: "نوع من المواد", ckb: "جۆرێک لە کاڵا" },
  "One item": { ar: "مادة واحدة", ckb: "یەک کاڵا" },
  "A rule": { ar: "قاعدة", ckb: "یاسایەک" },
  "Rule changed": { ar: "تغيّرت قاعدة", ckb: "یاسایەک گۆڕدرا" },

  // The dollar's rules (0043).
  "A dollar rate is used for": {
    ar: "يُستخدم سعر الدولار لمدة",
    ckb: "نرخی دۆلار بەکاردێت بۆ ماوەی",
  },
  "Dollars are counted in dinars to the nearest": {
    ar: "تُحسب الدولارات بالدينار لأقرب",
    ckb: "دۆلار بە دینار هەژمار دەکرێت بۆ نزیکترین",
  },
  "The till takes dollars at the rate a manager set, for this many hours after it was set. Older, dollars are refused until a manager sets today's on Sales → Dollars.":
    {
      ar: "يأخذ الدرج الدولارات بالسعر الذي حدده المدير، طوال هذه الساعات بعد تحديده. وبعدها تُرفض الدولارات حتى يحدد المدير سعر اليوم في شاشة «المبيعات»، قسم «الدولار».",
      ckb: "دەخیلە دۆلار بەو نرخە وەردەگرێت کە بەڕێوەبەر داینا، بۆ ئەم ماوە کاتژمێرە دوای دانانی. دوای ئەوە دۆلار ڕەتدەکرێتەوە تا بەڕێوەبەرێک نرخی ئەمڕۆ لە شاشەی «فرۆشتن»، بەشی «دۆلار» دادەنێت.",
    },
  "Dollars handed over are worth their number times the rate, rounded to the nearest step (half-way rounds up). The change is given in dinars.":
    {
      ar: "قيمة الدولارات المُسلَّمة هي عددها مضروبًا في السعر، مقرّبة لأقرب خطوة (النصف يُقرَّب إلى الأعلى). ويُعطى الباقي بالدينار.",
      ckb: "بەهای ئەو دۆلارانەی دەدرێن ژمارەکەیانە جارانی نرخەکە، بۆ نزیکترین هەنگاو خڕ دەکرێتەوە (نیوە بۆ سەرەوە). باقی بە دینار دەدرێتەوە.",
    },
  "{n} hours": { ar: "{n} ساعة", ckb: "{n} کاتژمێر" },
  hours: { ar: "ساعات", ckb: "کاتژمێر" },
};

export default phrases;
