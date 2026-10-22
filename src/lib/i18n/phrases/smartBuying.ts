import type { PhraseBook } from "./types";

const DAYS = "{n, plural, one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}";

/** Smarter buying (0092): the database's words and the screens'. */
const phrases: PhraseBook = {
  // The database's.
  "A supplier delivers every 1 to 60 days": {
    ar: "يورّد المورّد كل يوم إلى 60 يومًا",
    ckb: "دابینکەر هەر 1 تا 60 ڕۆژ جارێک دەگەیەنێت",
  },

  // Purchasing: each supplier's deliveries, and the drafts in one press.
  "How each supplier delivers": {
    ar: "كيف يورّد كل مورّد",
    ckb: "هەر دابینکەرێک چۆن دەگەیەنێت",
  },
  "usually {n} day(s), later {late} time(s) in {orders} orders": {
    ar: `عادةً خلال ${DAYS}، وتأخّر {late, plural, one {مرة واحدة} two {مرتين} few {# مرات} many {# مرة} other {# مرة}} في {orders} طلبية`,
    ckb: "زۆرجار {n} ڕۆژ، {late} جار دواکەوتووە لە {orders} داواکاریدا",
  },
  "usually {n} day(s), never later in {orders} orders": {
    ar: `عادةً خلال ${DAYS}، ولم يتأخّر قط في {orders} طلبية`,
    ckb: "زۆرجار {n} ڕۆژ، لە {orders} داواکاریدا هەرگیز دوا نەکەوتووە",
  },
  "{n} day(s), as set (too few orders sent yet to learn it)": {
    ar: `${DAYS}، كما حُدِّد (الطلبيات المُرسلة بعد أقل من أن يُتعلَّم منها)`,
    ckb: "{n} ڕۆژ، وەک دانراوە (هێشتا داواکاریی ناردراو کەمترە لەوەی فێری ببین)",
  },
  "{n} day(s), the café's own (none set, too few orders to learn it)": {
    ar: `${DAYS}، وهي مدة المقهى (لم تُحدَّد له مدة، والطلبيات أقل من أن يُتعلَّم منها)`,
    ckb: "{n} ڕۆژ، هی کافێکە خۆی (هیچ دانەنراوە، داواکارییەکان کەمن بۆ فێربوون)",
  },
  "delivers every {n} day(s)": {
    ar: `يورّد كل ${DAYS}`,
    ckb: "هەر {n} ڕۆژ جارێک دەگەیەنێت",
  },
  "its deliveries come every {n} day(s) or so": {
    ar: `تصل توريداته كل ${DAYS} تقريبًا`,
    ckb: "گەیاندنەکانی نزیکەی هەر {n} ڕۆژ جارێک دێن",
  },
  "how often it delivers is not set yet (a week is assumed)": {
    ar: "لم يُحدَّد بعد كم مرة يورّد (يُفترض أسبوع)",
    ckb: "هێشتا دیار نەکراوە چەند جار دەگەیەنێت (هەفتەیەک دادەنرێت)",
  },
  "Draft the orders now": {
    ar: "اكتب مسودات الطلبيات الآن",
    ckb: "ئێستا ڕەشنووسی داواکارییەکان دروست بکە",
  },
  "Nothing to order now: everything lasts until its next delivery could come.": {
    ar: "لا شيء يُطلب الآن: كل شيء يكفي حتى يمكن أن يصل توريده التالي.",
    ckb: "ئێستا هیچ داوا ناکرێت: هەموو شتێک بەش دەکات تا گەیاندنی داهاتووی دەتوانێت بگات.",
  },
  "{n} draft order(s) made: approve and send each below.": {
    ar: "أُنشئت {n, plural, one {مسودة طلبية واحدة} two {مسودتا طلبيتين} few {# مسودات طلبيات} many {# مسودة طلبية} other {# مسودة طلبية}}: اعتمد كلًّا منها وأرسله أدناه.",
    ckb: "ڕەشنووسی {n} داواکاری دروست کرا: هەریەکەیان لە خوارەوە پەسەند بکە و بینێرە.",
  },
  "To order, but with no supplier or price yet: {items}. Choose them on What to buy.": {
    ar: "مطلوب، لكن بلا مورّد أو سعر بعد: {items}. اخترهما في «ماذا نشتري».",
    ckb: "پێویستە داوا بکرێت، بەڵام هێشتا دابینکەر یان نرخی نییە: {items}. لە «چی بکڕین» هەڵیانبژێرە.",
  },
  "Approve and send": { ar: "اعتمد وأرسل", ckb: "پەسەند بکە و بینێرە" },
  "Order {no} approved and marked as sent to the supplier.": {
    ar: "اعتُمدت الطلبية {no} وعُلِّمت مُرسلةً إلى المورّد.",
    ckb: "داواکاریی {no} پەسەند کرا و وەک نێردراو بۆ دابینکەر نیشانە کرا.",
  },

  // Vendors: how often a supplier delivers.
  "Delivers every (days)": { ar: "يورّد كل (أيام)", ckb: "هەر چەند ڕۆژ دەگەیەنێت" },
  Learnt: { ar: "يُتعلَّم", ckb: "فێردەبین" },

  // What to buy.
  "Topped up with this order": {
    ar: "يُكمَّل مع هذه الطلبية",
    ckb: "لەگەڵ ئەم داواکارییە پڕ دەکرێتەوە",
  },
  "Order from {supplier}, {pct} cheaper": {
    ar: "اطلب من {supplier}، أرخص بـ{pct}",
    ckb: "لە {supplier} داوا بکە، {pct} هەرزانترە",
  },
  "From its use and its supplier's deliveries, {level} would be suggested.": {
    ar: "من استهلاكها وتوريدات مورّدها، يُقترح {level}.",
    ckb: "بەپێی بەکارهێنانی و گەیاندنەکانی دابینکەرەکەی، {level} پێشنیار دەکرێت.",
  },
  "Its supplier usually delivers in {n} day(s), as its orders have shown.": {
    ar: `يورّد مورّدها عادةً خلال ${DAYS}، كما أظهرت طلبياته.`,
    ckb: "دابینکەرەکەی زۆرجار لە {n} ڕۆژدا دەگەیەنێت، وەک داواکارییەکانی نیشانیان داوە.",
  },
  "A delivery takes {n} day(s), as set on the supplier.": {
    ar: `يستغرق التوريد ${DAYS}، كما حُدِّد للمورّد.`,
    ckb: "گەیاندن {n} ڕۆژ دەخایەنێت، وەک لەسەر دابینکەرەکە دانراوە.",
  },
  "A delivery takes {n} day(s), the café's own: the supplier has none set.": {
    ar: `يستغرق التوريد ${DAYS}، وهي مدة المقهى: لم تُحدَّد للمورّد مدة.`,
    ckb: "گەیاندن {n} ڕۆژ دەخایەنێت، هی کافێکە خۆی: هیچ بۆ دابینکەرەکە دانەنراوە.",
  },
  "Each day judged by its weekday over the last 4 weeks: until it comes, and a day more, it uses about {use}.":
    {
      ar: "كل يوم يُقدَّر بيومه من الأسبوع خلال آخر 4 أسابيع: حتى يصل، ويومًا آخر، تستهلك نحو {use}.",
      ckb: "هەر ڕۆژێک بەپێی ڕۆژی هەفتەکەی لە 4 هەفتەی ڕابردوودا دەخەمڵێنرێت: تا دەگات، و ڕۆژێکی تر، نزیکەی {use} بەکاردەهێنێت.",
    },
  "About {daily} a day over the last {days} days: until it comes, and a day more, about {use}.": {
    ar: "نحو {daily} يوميًا خلال آخر {days} يومًا: حتى يصل، ويومًا آخر، نحو {use}.",
    ckb: "نزیکەی {daily} لە ڕۆژێکدا لە {days} ڕۆژی ڕابردوودا: تا دەگات، و ڕۆژێکی تر، نزیکەی {use}.",
  },
  "It has come up to {n} day(s) late lately: {qty} more.": {
    ar: `تأخّر مؤخرًا حتى ${DAYS}: {qty} زيادة.`,
    ckb: "لەم دواییەدا تا {n} ڕۆژ دواکەوتووە: {qty} زیاتر.",
  },
  "For days busier than usual: {qty} more.": {
    ar: "للأيام الأكثر ازدحامًا من المعتاد: {qty} زيادة.",
    ckb: "بۆ ڕۆژانی قەرەباڵغتر لە ئاسایی: {qty} زیاتر.",
  },
  "{level} is its reorder level.": {
    ar: "{level} هو حدّ إعادة طلبها.",
    ckb: "{level} ئاستی داواکردنەوەیەتی.",
  },
  "Less than halfway to {target}: {packs} more when its supplier is ordered from anyway.": {
    ar: "أقل من منتصف الطريق إلى {target}: {packs} زيادة حين يُطلب من مورّدها على أي حال.",
    ckb: "کەمتر لە نیوەی ڕێگا بۆ {target}: {packs} زیاتر کاتێک بە هەر حاڵ لە دابینکەرەکەی داوا دەکرێت.",
  },
  "It delivers every {n} day(s): ordered up to what lasts until the delivery after this one, {target}.":
    {
      ar: `يورّد كل ${DAYS}: تُطلب حتى ما يكفي إلى التوريد الذي يلي هذا، {target}.`,
      ckb: "هەر {n} ڕۆژ جارێک دەگەیەنێت: تا ئەوەندە داوا دەکرێت کە بەش بکات تا گەیاندنی دوای ئەمە، {target}.",
    },
  "Its deliveries have come every {n} day(s) or so: ordered up to what lasts until the delivery after this one, {target}.":
    {
      ar: `وصلت توريداته كل ${DAYS} تقريبًا: تُطلب حتى ما يكفي إلى التوريد الذي يلي هذا، {target}.`,
      ckb: "گەیاندنەکانی نزیکەی هەر {n} ڕۆژ جارێک هاتوون: تا ئەوەندە داوا دەکرێت کە بەش بکات تا گەیاندنی دوای ئەمە، {target}.",
    },
  "Ordered up to a week more of use, until how often the supplier delivers is set or learnt: {target}.":
    {
      ar: "تُطلب حتى استهلاك أسبوع آخر، إلى أن يُحدَّد أو يُتعلَّم كم مرة يورّد المورّد: {target}.",
      ckb: "تا بەکارهێنانی هەفتەیەکی تر داوا دەکرێت، تا ئەوکاتەی دیار دەکرێت یان فێر دەبین دابینکەر چەند جار دەگەیەنێت: {target}.",
    },
  "{supplier} sells it {pct} cheaper: {price} a pack.": {
    ar: "يبيعها {supplier} أرخص بـ{pct}: {price} للعبوة.",
    ckb: "{supplier} بە {pct} هەرزانتر دەیفرۆشێت: {price} بۆ هەر پاکەتێک.",
  },

  // The price watch: the price that keeps a margin, in one tap.
  "Set it": { ar: "اعتمده", ckb: "دایبنێ" },
  "Set the price to {price}": { ar: "اجعل السعر {price}", ckb: "نرخەکە بکە بە {price}" },
  "Set from today": { ar: "حُدِّد من اليوم", ckb: "لە ئەمڕۆوە دانرا" },
};

export default phrases;
