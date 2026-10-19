import type { PhraseBook } from "./types";

/**
 * Two-step sign-in (round twenty-three, 0080): a six-digit code from an
 * authenticator app after the password.
 */
const phrases: PhraseBook = {
  "Two-step sign-in": { ar: "تسجيل الدخول بخطوتين", ckb: "چوونەژوورەوەی دوو هەنگاوی" },
  "On: signing in asks for the code from your authenticator app.": {
    ar: "مفعّل: تسجيل الدخول يطلب الرمز من تطبيق المصادقة.",
    ckb: "چالاکە: چوونەژوورەوە داوای کۆد لە ئەپی ناسینەوە دەکات.",
  },
  "Turn it off": { ar: "أوقفه", ckb: "بیکوژێنەوە" },
  "Open an authenticator app on your phone and scan this code:": {
    ar: "افتح تطبيق مصادقة على هاتفك وامسح هذا الرمز:",
    ckb: "ئەپێکی ناسینەوە لە مۆبایلەکەت بکەرەوە و ئەم کۆدە سکان بکە:",
  },
  "The code to scan": { ar: "الرمز للمسح", ckb: "کۆدی سکانکردن" },
  "Or type this key into the app:": {
    ar: "أو اكتب هذا المفتاح في التطبيق:",
    ckb: "یان ئەم کلیلە لە ئەپەکەدا بنووسە:",
  },
  "Then type the six digits it shows": {
    ar: "ثم اكتب الأرقام الستة التي يظهرها",
    ckb: "پاشان ئەو شەش ژمارەیەی پیشانی دەدات بنووسە",
  },
  "Turn it on": { ar: "فعّله", ckb: "چالاکی بکە" },
  "Recommended for the owner: with it, someone who learns your password still cannot open the books without your phone.":
    {
      ar: "موصى به للمالك: معه، من يعرف كلمة مرورك لا يستطيع فتح الدفاتر بدون هاتفك.",
      ckb: "بۆ خاوەن پێشنیار دەکرێت: لەگەڵیدا، ئەوەی وشەی نهێنییەکەت بزانێت بەبێ مۆبایلەکەت ناتوانێت دەفتەرەکان بکاتەوە.",
    },
  "With it, someone who learns your password still cannot sign in without your phone.": {
    ar: "معه، من يعرف كلمة مرورك لا يستطيع الدخول بدون هاتفك.",
    ckb: "لەگەڵیدا، ئەوەی وشەی نهێنییەکەت بزانێت بەبێ مۆبایلەکەت ناتوانێت بچێتە ژوورەوە.",
  },
  "Turn on two-step sign-in": {
    ar: "فعّل تسجيل الدخول بخطوتين",
    ckb: "چوونەژوورەوەی دوو هەنگاوی چالاک بکە",
  },
  "One more step": { ar: "خطوة أخرى", ckb: "هەنگاوێکی تر" },
  "Type the six digits your authenticator app shows for this café.": {
    ar: "اكتب الأرقام الستة التي يظهرها تطبيق المصادقة لهذا المقهى.",
    ckb: "ئەو شەش ژمارەیە بنووسە کە ئەپی ناسینەوەکەت بۆ ئەم کافێیە پیشانی دەدات.",
  },
  "The six digits": { ar: "الأرقام الستة", ckb: "شەش ژمارەکە" },
  "Type the six digits the app shows": {
    ar: "اكتب الأرقام الستة التي يظهرها التطبيق",
    ckb: "ئەو شەش ژمارەیە بنووسە کە ئەپەکە پیشانی دەدات",
  },
  "That code is not right. Type the one the app shows now.": {
    ar: "هذا الرمز غير صحيح. اكتب الذي يظهره التطبيق الآن.",
    ckb: "ئەو کۆدە دروست نییە. ئەوە بنووسە کە ئێستا ئەپەکە پیشانی دەدات.",
  },
  "The second step could not be started. Try again.": {
    ar: "تعذّر بدء الخطوة الثانية. حاول مرة أخرى.",
    ckb: "هەنگاوی دووەم دەستی پێ نەکرد. دووبارە هەوڵ بدەرەوە.",
  },
  "The second step could not be turned off. Sign in again and try.": {
    ar: "تعذّر إيقاف الخطوة الثانية. سجّل الدخول من جديد وحاول.",
    ckb: "هەنگاوی دووەم نەکوژێنرایەوە. دووبارە بچۆ ژوورەوە و هەوڵ بدە.",
  },
  "Finish signing in: type the code from your authenticator app": {
    ar: "أكمل تسجيل الدخول: اكتب الرمز من تطبيق المصادقة",
    ckb: "چوونەژوورەوە تەواو بکە: کۆدەکە لە ئەپی ناسینەوە بنووسە",
  },
};

export default phrases;
