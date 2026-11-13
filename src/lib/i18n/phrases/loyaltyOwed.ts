import type { PhraseBook } from "./types";

/** Loyalty points as money owed (0113), on Settings. */
const phrases: PhraseBook = {
  "Loyalty points as money owed": {
    ar: "نقاط الولاء كمبلغ مستحق",
    ckb: "خاڵەکانی دڵسۆزی وەک پارەی قەرز",
  },
  "Off: a reward is a discount when it is taken": {
    ar: "متوقف: المكافأة خصم عند أخذها",
    ckb: "کوژاوە: خەڵات داشکاندنە کاتێک وەردەگیرێت",
  },
  "On, the points customers hold are money owed: each point at the reward's value, a cost when it is earned (Dr 6150 Loyalty points, Cr 2150 Loyalty points owed), owed no more when it is spent or taken back. Off, a reward is a discount when it is taken.":
    {
      ar: "عند التشغيل، النقاط التي يحملها الزبائن مبلغ مستحق: كل نقطة بقيمة المكافأة، تكلفة عند كسبها (مدين 6150 نقاط الولاء، دائن 2150 نقاط الولاء المستحقة)، ولا تُستحق بعد صرفها أو استردادها. عند الإيقاف، المكافأة خصم عند أخذها.",
      ckb: "کاتێک هەڵکراوە، ئەو خاڵانەی کڕیاران هەیانە پارەی قەرزن: هەر خاڵێک بە نرخی خەڵاتەکە، تێچووە کاتێک بەدەست دێت (قەرزار 6150 خاڵەکانی دڵسۆزی، بەستانکار 2150 خاڵەکانی دڵسۆزی قەرز)، کاتێک خەرج دەکرێت یان دەگەڕێندرێتەوە ئیتر قەرز نییە. کاتێک کوژاوەیە، خەڵات داشکاندنە کاتێک وەردەگیرێت.",
    },
  "Points are booked as money owed": {
    ar: "تُسجَّل النقاط كمبلغ مستحق",
    ckb: "خاڵەکان وەک پارەی قەرز تۆمار دەکرێن",
  },
  "A point is worth {value}; customers hold {points} points, worth {worth}.": {
    ar: "قيمة النقطة {value}؛ يحمل الزبائن {points} نقطة، قيمتها {worth}.",
    ckb: "هەر خاڵێک {value}ە؛ کڕیاران {points} خاڵیان هەیە، بە نرخی {worth}.",
  },
  "The books owe {amount}.": {
    ar: "الدفاتر مدينة بـ {amount}.",
    ckb: "دەفتەرەکان {amount} قەرزدارن.",
  },
  "Bring the books to the points held": {
    ar: "اجعل الدفاتر مطابقة للنقاط المحتفَظ بها",
    ckb: "دەفتەرەکان بگەیەنە ئەو خاڵانەی هەن",
  },
  "Saved: the points held are owed, {amount}.": {
    ar: "حُفظ: النقاط المحتفَظ بها مستحقة، {amount}.",
    ckb: "پاشەکەوت کرا: ئەو خاڵانەی هەن قەرزن، {amount}.",
  },
  "Saved: points are a discount when they are taken, as before.": {
    ar: "حُفظ: النقاط خصم عند أخذها، كما كانت.",
    ckb: "پاشەکەوت کرا: خاڵەکان داشکاندنن کاتێک وەردەگیرێن، وەک پێشتر.",
  },
  "Only the owner books points as money owed": {
    ar: "المالك وحده يسجّل النقاط كمبلغ مستحق",
    ckb: "تەنها خاوەنەکە خاڵەکان وەک پارەی قەرز تۆمار دەکات",
  },
};

export default phrases;
