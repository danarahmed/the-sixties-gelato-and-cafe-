import type { PhraseBook } from "./types";

/** The restaurant's parts (0110): the kitchen, courses and seats, joined bills, bookings. */
const phrases: PhraseBook = {
  Table: { ar: "طاولة", ckb: "مێز" },
  "A booking is for now or later": { ar: "الحجز للآن أو لاحقًا", ckb: "حجز بۆ ئێستا یان دواترە" },
  "A course is from 1 to 5": { ar: "الطبق من 1 إلى 5", ckb: "خواردن لە ١ تا ٥ە" },
  "A party is from 1 to 100 people": {
    ar: "المجموعة من 1 إلى 100 شخص",
    ckb: "گرووپ لە ١ تا ١٠٠ کەسە",
  },
  "A printed bill is not joined: the customer has its total": {
    ar: "الفاتورة المطبوعة لا تُدمج: الزبون لديه مجموعها",
    ckb: "پسوولەی چاپکراو یەک ناخرێت: کڕیار کۆکەی لایە",
  },
  "A station has a name of up to 40 letters": {
    ar: "اسم المحطة حتى 40 حرفًا",
    ckb: "وێستگە ناوێکی تا ٤٠ پیتی هەیە",
  },
  "Choose new, ready or done": {
    ar: "اختر جديد أو جاهز أو تم",
    ckb: "نوێ، ئامادە یان تەواو هەڵبژێرە",
  },
  "Choose seated, cancelled, not come or booked": {
    ar: "اختر جالسون أو ملغى أو لم يأتوا أو محجوز",
    ckb: "دانیشتوو، هەڵوەشاوە، نەهاتوو یان حجزکراو هەڵبژێرە",
  },
  "Choose two different bills": {
    ar: "اختر فاتورتين مختلفتين",
    ckb: "دوو پسوولەی جیاواز هەڵبژێرە",
  },
  "Give the name the table is for": {
    ar: "أعطِ الاسم الذي الطاولة له",
    ckb: "ئەو ناوەی مێزەکە بۆیەتی بنووسە",
  },
  "Take the discount off first, then join the bills": {
    ar: "أزل الخصم أولًا، ثم ادمج الفاتورتين",
    ckb: "سەرەتا داشکاندنەکە لابە، پاشان پسوولەکان یەک بخە",
  },
  "That booking is not found": { ar: "هذا الحجز غير موجود", ckb: "ئەو حجزە نەدۆزرایەوە" },
  "That booking is not open": { ar: "هذا الحجز ليس مفتوحًا", ckb: "ئەو حجزە کراوە نییە" },
  "That station is not one of the café's": {
    ar: "هذه المحطة ليست من محطات المقهى",
    ckb: "ئەو وێستگەیە هی کافێکە نییە",
  },
  "That table is not one of the café's": {
    ar: "هذه الطاولة ليست من طاولات المقهى",
    ckb: "ئەو مێزە هی کافێکە نییە",
  },
  "That ticket is not found": { ar: "هذه التذكرة غير موجودة", ckb: "ئەو تیکێتە نەدۆزرایەوە" },
  "There is a station called {1} already": {
    ar: "هناك محطة باسم {1} بالفعل",
    ckb: "وێستگەیەک بە ناوی {1} هەیە",
  },
  "This bill is closed": { ar: "هذه الفاتورة مغلقة", ckb: "ئەم پسوولەیە داخراوە" },
  "This bill was changed on another till: open it again": {
    ar: "تغيّرت هذه الفاتورة على صندوق آخر: افتحها مجددًا",
    ckb: "ئەم پسوولەیە لەسەر سندوقێکی تر گۆڕدرا: دووبارە بیکەرەوە",
  },
  "Each station's tickets, the oldest first, as the till sends them. Tap Ready when it is made, and Done when it has gone out.":
    {
      ar: "تذاكر كل محطة، الأقدم أولًا، كما يرسلها الصندوق. اضغط «جاهز» عند التحضير، و«تم» عند خروجه.",
      ckb: "تیکێتەکانی هەر وێستگەیەک، کۆنترینەکان سەرەتا، وەک سندوقەکە دەینێرێت. «ئامادەیە» دابگرە کاتێک دروست کرا، و «تەواو» کاتێک ڕۆیشت.",
    },
  Kitchen: { ar: "المطبخ", ckb: "چێشتخانە" },
  Reservations: { ar: "الحجوزات", ckb: "حجزکردنەکان" },
  "The day's bookings and the parties waiting now: seat one at a table, or mark it cancelled or not come.":
    {
      ar: "حجوزات اليوم والمجموعات المنتظرة الآن: أجلس واحدة على طاولة، أو علّمها ملغاة أو لم تأتِ.",
      ckb: "حجزەکانی ڕۆژەکە و ئەو گرووپانەی ئێستا چاوەڕێن: یەکێک لەسەر مێزێک دابنێ، یان بە هەڵوەشاوە یان نەهاتوو نیشانی بکە.",
    },
  "Kitchen stations": { ar: "محطات المطبخ", ckb: "وێستگەکانی چێشتخانە" },
  "{n} stations": { ar: "{n} محطات", ckb: "{n} وێستگە" },
  "Course {n}": { ar: "الطبق {n}", ckb: "خواردنی {n}" },
  "Every station": { ar: "كل المحطات", ckb: "هەموو وێستگەکان" },
  "No station": { ar: "بلا محطة", ckb: "بێ وێستگە" },
  "Nothing waiting for the kitchen.": {
    ar: "لا شيء ينتظر المطبخ.",
    ckb: "هیچ شتێک چاوەڕێی چێشتخانە نییە.",
  },
  "Seat {n}": { ar: "المقعد {n}", ckb: "کورسی {n}" },
  "{n} min": { ar: "{n} د", ckb: "{n} خولەک" },
  Course: { ar: "الطبق", ckb: "خواردن" },
  "Join another bill": { ar: "ادمج فاتورة أخرى", ckb: "پسوولەیەکی تر یەک بخە" },
  Seat: { ar: "المقعد", ckb: "کورسی" },
  "Send course {n}": { ar: "أرسل الطبق {n}", ckb: "خواردنی {n} بنێرە" },
  "Send to the kitchen": { ar: "أرسل إلى المطبخ", ckb: "بۆ چێشتخانە بنێرە" },
  "Its lines come onto this bill, and it is closed as moved.": {
    ar: "تنتقل أسطرها إلى هذه الفاتورة، وتُغلق كمنقولة.",
    ckb: "دێڕەکانی دێنە سەر ئەم پسوولەیە، و وەک گوازراوە دادەخرێت.",
  },
  "Nothing new for the kitchen": { ar: "لا جديد للمطبخ", ckb: "هیچ شتێکی نوێ بۆ چێشتخانە نییە" },
  "Sent to the kitchen: {n} tickets": {
    ar: "أُرسل إلى المطبخ: {n} تذاكر",
    ckb: "بۆ چێشتخانە نێردرا: {n} تیکێت",
  },
  "The bills are one now": { ar: "صارت الفاتورتان واحدة", ckb: "پسوولەکان ئێستا یەکن" },
  "Book a table": { ar: "احجز طاولة", ckb: "مێزێک حجز بکە" },
  Bookings: { ar: "الحجوزات", ckb: "حجزەکان" },
  "No bookings this day.": { ar: "لا حجوزات في هذا اليوم.", ckb: "لەم ڕۆژەدا هیچ حجزێک نییە." },
  "Not come": { ar: "لم يأتوا", ckb: "نەهاتوو" },
  "Seat them": { ar: "أجلسهم", ckb: "دایانبنێ" },
  "Waiting now": { ar: "ينتظرون الآن", ckb: "ئێستا چاوەڕێن" },
  Waiting: { ar: "ينتظرون", ckb: "چاوەڕێن" },
  Booked: { ar: "محجوز", ckb: "حجزکراو" },
  Seated: { ar: "جالسون", ckb: "دانیشتوو" },
  "The day before": { ar: "اليوم السابق", ckb: "ڕۆژی پێشوو" },
  "The day after": { ar: "اليوم التالي", ckb: "ڕۆژی دواتر" },
  "A new station": { ar: "محطة جديدة", ckb: "وێستگەیەکی نوێ" },
  "Each station has its own screen (Kitchen on the menu). What a bill or a sale adds goes to the station of its category; a category with none goes to the kitchen's own screen.":
    {
      ar: "لكل محطة شاشتها (المطبخ في القائمة). ما تضيفه الفاتورة أو البيع يذهب إلى محطة فئته؛ والفئة بلا محطة تذهب إلى شاشة المطبخ نفسها.",
      ckb: "هەر وێستگەیەک شاشەی خۆی هەیە (چێشتخانە لە لیستەکەدا). ئەوەی پسوولەیەک یان فرۆشتنێک زیادی دەکات دەچێتە وێستگەی پۆلەکەی؛ پۆلێکی بێ وێستگە دەچێتە شاشەی خودی چێشتخانە.",
    },
  "Station for {name}": { ar: "محطة {name}", ckb: "وێستگەی {name}" },
  "The kitchen's own screen": { ar: "شاشة المطبخ نفسها", ckb: "شاشەی خودی چێشتخانە" },
  "a station": { ar: "محطة", ckb: "وێستگەیەک" },
  "a ticket": { ar: "تذكرة", ckb: "تیکێتێک" },
  "Choose when": { ar: "اختر الوقت", ckb: "کاتەکە هەڵبژێرە" },
  "a booking": { ar: "حجزًا", ckb: "حجزێک" },
  "Kitchen screens and stations": { ar: "شاشات المطبخ ومحطاته", ckb: "شاشە و وێستگەکانی چێشتخانە" },
  "Courses and seats on a bill": {
    ar: "الأطباق والمقاعد على الفاتورة",
    ckb: "خواردن و کورسییەکان لەسەر پسوولە",
  },
  "Reservations and the waiting list": {
    ar: "الحجوزات وقائمة الانتظار",
    ckb: "حجزکردن و لیستی چاوەڕوانی",
  },
  "Joined to another bill": { ar: "دُمجت مع فاتورة أخرى", ckb: "لەگەڵ پسوولەیەکی تر یەک خرا" },
  "Bills joined": { ar: "دُمجت الفواتير", ckb: "پسوولەکان یەک خران" },
  "Kitchen station set": { ar: "ضُبطت محطة مطبخ", ckb: "وێستگەیەکی چێشتخانە دانرا" },
  "A category's station set": { ar: "ضُبطت محطة فئة", ckb: "وێستگەی پۆلێک دانرا" },
};

export default phrases;
