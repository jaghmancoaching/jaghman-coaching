"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dumbbell, PlayCircle, RefreshCw, MessageCircle, Video, Users, TrendingUp,
  Bell, Check, X, ChevronLeft, ChevronRight, Flame, Shield, Calendar, Heart,
  Send, AlertTriangle, Crown, Zap, Activity, Clock, Target, User, LogOut, Star, Pause, Lock,
  BookOpen, Utensils, ChevronDown, Gift, Ticket, Mail, Bot, UserPlus, Award, Copy
} from "lucide-react";
import { BarChart, Bar } from "recharts";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import * as sheet from "./sheetData";
import { loadSiteData, loadSubscribers, saveSubscriber, saveReview, saveCoachApplication, signupAccount, loginAccount, activateAccount } from "./sheetData";
// دوال اختيارية — تعمل تلقائياً فور إضافتها إلى sheetData.js (راجع ملف "دليل-تفعيل-Google-والسعرات")
const googleLogin = sheet.googleLogin || (async () => ({ ok: false, error: "demo" }));
const logCalories = sheet.logCalories || (async () => ({ ok: true, local: true }));
const getCalories = sheet.getCalories || (async () => ({ ok: false, local: true, items: [] }));
const GOOGLE_CLIENT_ID = sheet.GOOGLE_CLIENT_ID || ""; // يُفعّل زر جوجل عند وضع المعرّف في sheetData.js
const saveAnatomyVideos = sheet.saveAnatomyVideos || null; // حفظ فيديوهات التشريح 3D في جدول جوجل (اختياري)

// سياق يوفّر بيانات الجدول لكل مكونات الموقع
const SiteData = React.createContext({ connected: false });
const useSite = () => React.useContext(SiteData);

// زر "المتابعة بحساب Google" — يظهر فقط عند ضبط GOOGLE_CLIENT_ID
function GoogleButton({ onCred }) {
  const ref = React.useRef(null);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !ref.current) return;
    const init = () => {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res) => {
            try {
              const b64 = res.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
              const payload = JSON.parse(decodeURIComponent(escape(atob(b64))));
              onCred({ email: payload.email, name: payload.name || payload.email.split("@")[0] });
            } catch {}
          },
        });
        window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", width: 280, locale: "ar" });
      } catch {}
    };
    if (window.google?.accounts?.id) init();
    else {
      const sc = document.createElement("script");
      sc.src = "https://accounts.google.com/gsi/client";
      sc.async = true; sc.onload = init;
      document.body.appendChild(sc);
    }
  }, []);
  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={ref} className="flex justify-center" />;
}


/* ═══════════════════════════════════════════════════════════════
   1. البيانات الأساسية — قاعدة التمارين والمنطق الرياضي
   ═══════════════════════════════════════════════════════════════ */

const COACH_WHATSAPP = "31645995782";

// أسماء الأيام بالعربية (اليوم الأول، الثاني...) بدل الأرقام
const DAY_NAMES = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع"];
const dayLabel = (i) => `اليوم ${DAY_NAMES[i] || (i + 1)}`;
const WEEK_NAMES = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
const weekLabel = (i) => `الأسبوع ${WEEK_NAMES[i] || (i + 1)}`;

// دورة التدرج في الحمل (Progressive Overload Mesocycle)
const OVERLOAD_WEEKS = [
  { id: 1, label: "تأسيس", sets: 3, reps: "10–12", intensity: "RPE 7 · وزن معتدل", note: "ركّز على إتقان الأداء الفني قبل زيادة الوزن." },
  { id: 2, label: "تحميل", sets: 4, reps: "8–10", intensity: "+2.5% وزن", note: "زد الوزن قليلاً مع الحفاظ على نفس جودة الأداء." },
  { id: 3, label: "ذروة", sets: 4, reps: "6–8", intensity: "+5% وزن · RPE 9", note: "أعلى حمل في الدورة — نم جيداً وتغذَّ بشكل كافٍ." },
  { id: 4, label: "استشفاء", sets: 2, reps: "10–12", intensity: "−30% وزن", note: "أسبوع تخفيف (Deload) لتجديد الجهاز العصبي والمفاصل." },
];

const DAY_ORD = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع"];
const EQUIPMENT = ["بار", "دمبل", "كيبل", "آلة", "وزن الجسم", "أشرطة مقاومة"];
const INJURIES = ["الكتف", "الركبة", "أسفل الظهر", "الرسغ"];
const GOALS = [
  { id: "fat", label: "خسارة الدهون", icon: Flame },
  { id: "muscle", label: "بناء العضلات", icon: Dumbbell },
  { id: "strength", label: "زيادة القوة", icon: Zap },
  { id: "fitness", label: "لياقة عامة", icon: Activity },
];

// قاعدة التمارين: كل تمرين له بدائل بنفس الفعالية العلمية (نفس الزاوية العضلية)
const EXERCISE_DB = {
  "صدر": [
    { name: "ضغط بار مستوي", eq: "بار", risk: ["الكتف"], cues: ["ثبّت لوحي الكتف على البنش", "أنزل البار إلى منتصف الصدر ببطء", "ادفع مع إخراج الزفير حتى فرد شبه كامل"], mistakes: ["رفع الحوض عن البنش", "ارتداد البار عن الصدر"], alts: [
      { name: "ضغط دمبل مستوي", eq: "دمبل" }, { name: "ضغط آلة الصدر", eq: "آلة" }, { name: "تمرين الضغط الأرضي", eq: "وزن الجسم" }] },
    { name: "ضغط دمبل مائل علوي", eq: "دمبل", risk: ["الكتف"], cues: ["اضبط البنش على 30–45°", "أنزل الدمبل بجانب الصدر العلوي", "ادفع للأعلى بقوس خفيف للداخل"], mistakes: ["زاوية بنش عالية جداً تحول الحمل للكتف"], alts: [
      { name: "ضغط بار مائل", eq: "بار" }, { name: "ضغط علوي بالكيبل", eq: "كيبل" }, { name: "ضغط مائل بالأشرطة", eq: "أشرطة مقاومة" }] },
    { name: "تفتيح كيبل", eq: "كيبل", risk: [], cues: ["انحنِ للأمام قليلاً", "افتح الذراعين بقوس ثابت", "اعصر الصدر في نهاية الحركة ثانية كاملة"], mistakes: ["ثني الكوع أكثر من اللازم فيتحول لتمرين ضغط"], alts: [
      { name: "تفتيح دمبل مستوي", eq: "دمبل" }, { name: "آلة الفراشة", eq: "آلة" }, { name: "تفتيح بأشرطة مقاومة", eq: "أشرطة مقاومة" }] },
  ],
  "ظهر": [
    { name: "تجديف بار منحني", eq: "بار", risk: ["أسفل الظهر"], cues: ["انحنِ 45° مع ظهر مستقيم تماماً", "اسحب البار نحو السرة", "اعصر لوحي الكتف في الأعلى"], mistakes: ["تقوّس أسفل الظهر", "استخدام الاندفاع بدل العضلة"], alts: [
      { name: "تجديف دمبل بذراع واحدة", eq: "دمبل" }, { name: "تجديف كيبل جالس", eq: "كيبل" }, { name: "تجديف مقلوب بوزن الجسم", eq: "وزن الجسم" }] },
    { name: "سحب علوي (عقلة)", eq: "وزن الجسم", risk: ["الكتف"], cues: ["ابدأ من تعليق كامل", "اسحب الكوعين نحو الجذع", "أنزل ببطء وتحكم كامل"], mistakes: ["التأرجح بالجسم", "نصف مدى حركة"], alts: [
      { name: "سحب أمامي بالكيبل (Lat Pulldown)", eq: "كيبل" }, { name: "سحب بآلة مساعدة", eq: "آلة" }, { name: "سحب بأشرطة مقاومة", eq: "أشرطة مقاومة" }] },
    { name: "سحب أرضي رومانى (RDL)", eq: "بار", risk: ["أسفل الظهر"], cues: ["ادفع الحوض للخلف مع ركبة شبه ثابتة", "أنزل البار ملاصقاً للساق", "اصعد بعصر المؤخرة"], mistakes: ["تدوير الظهر", "النزول أعمق من مرونة العضلة الخلفية"], alts: [
      { name: "سحب رومانى بالدمبل", eq: "دمبل" }, { name: "سحب من بين الأرجل بالكيبل", eq: "كيبل" }, { name: "تمرين الجسر الأرضي", eq: "وزن الجسم" }] },
  ],
  "أكتاف": [
    { name: "ضغط كتف بار واقف", eq: "بار", risk: ["الكتف", "أسفل الظهر"], cues: ["شدّ البطن والمؤخرة للتثبيت", "ادفع البار في خط مستقيم فوق الرأس", "أدخل الرأس تحت البار في الأعلى"], mistakes: ["تقوّس الظهر للخلف", "دفع بالأرجل"], alts: [
      { name: "ضغط كتف دمبل جالس", eq: "دمبل" }, { name: "ضغط كتف بالآلة", eq: "آلة" }, { name: "ضغط كتف بالأشرطة", eq: "أشرطة مقاومة" }] },
    { name: "رفرفة جانبية دمبل", eq: "دمبل", risk: [], cues: ["ارفع للجانب حتى مستوى الكتف فقط", "الكوع أعلى من الرسغ دائماً", "أنزل ببطء ضعف سرعة الصعود"], mistakes: ["استخدام وزن ثقيل مع اندفاع", "رفع الكتفين (Shrug)"], alts: [
      { name: "رفرفة جانبية كيبل", eq: "كيبل" }, { name: "رفرفة جانبية بالآلة", eq: "آلة" }, { name: "رفرفة بأشرطة مقاومة", eq: "أشرطة مقاومة" }] },
    { name: "فيس بول (كتف خلفي)", eq: "كيبل", risk: [], cues: ["اسحب الحبل نحو الجبهة", "افتح الكوعين للخارج وللأعلى", "اعصر الكتف الخلفي ثانية"], mistakes: ["السحب نحو الرقبة بمرفقين منخفضين"], alts: [
      { name: "رفرفة خلفية دمبل منحني", eq: "دمبل" }, { name: "آلة الفراشة العكسية", eq: "آلة" }, { name: "سحب وجه بالأشرطة", eq: "أشرطة مقاومة" }] },
  ],
  "ترايسبس": [
    { name: "دفع كيبل للأسفل", eq: "كيبل", risk: [], cues: ["ثبّت الكوعين بجانب الجسم", "افرد الذراع بالكامل واعصر", "لا تدع الوزن يسحب كتفك للأعلى"], mistakes: ["فتح الكوعين للخارج", "الانحناء فوق الوزن"], alts: [
      { name: "امتداد خلفي دمبل فوق الرأس", eq: "دمبل" }, { name: "تمرين الغطس على البنش", eq: "وزن الجسم" }, { name: "دفع بأشرطة مقاومة", eq: "أشرطة مقاومة" }] },
    { name: "ضغط بار قبضة ضيقة", eq: "بار", risk: ["الرسغ"], cues: ["قبضة بعرض الكتفين", "أنزل البار لأسفل الصدر", "أبقِ الكوعين قريبين من الجسم"], mistakes: ["قبضة ضيقة جداً تجهد الرسغ"], alts: [
      { name: "ضغط دمبل قبضة محايدة", eq: "دمبل" }, { name: "غطس متوازي", eq: "وزن الجسم" }, { name: "ضغط ضيق بالآلة", eq: "آلة" }] },
  ],
  "بايسبس": [
    { name: "مرجحة بار", eq: "بار", risk: ["الرسغ"], cues: ["ثبّت الكوعين بجانب الجذع", "ارفع بدون مرجحة الجسم", "أنزل ببطء 3 ثوانٍ"], mistakes: ["التأرجح بالظهر", "رفع الكوعين للأمام"], alts: [
      { name: "مرجحة دمبل بالتبادل", eq: "دمبل" }, { name: "مرجحة كيبل", eq: "كيبل" }, { name: "مرجحة بأشرطة مقاومة", eq: "أشرطة مقاومة" }] },
    { name: "مرجحة مطرقة (Hammer)", eq: "دمبل", risk: [], cues: ["قبضة محايدة طوال الحركة", "يستهدف العضلة العضدية وعرض الذراع", "تحكم كامل في النزول"], mistakes: ["السرعة الزائدة"], alts: [
      { name: "مرجحة حبل كيبل", eq: "كيبل" }, { name: "مرجحة مطرقة بالأشرطة", eq: "أشرطة مقاومة" }, { name: "سحب عقلة قبضة ضيقة", eq: "وزن الجسم" }] },
  ],
  "أرجل": [
    { name: "سكوات بار خلفي", eq: "بار", risk: ["الركبة", "أسفل الظهر"], cues: ["القدمان بعرض الكتفين", "انزل حتى يوازي الفخذ الأرض", "ادفع الأرض بكامل القدم"], mistakes: ["انهيار الركبتين للداخل", "رفع الكعب"], alts: [
      { name: "سكوات كأس بالدمبل (Goblet)", eq: "دمبل" }, { name: "دفع أرجل بالآلة (Leg Press)", eq: "آلة" }, { name: "سكوات بوزن الجسم", eq: "وزن الجسم" }] },
    { name: "اندفاع أمامي دمبل (Lunges)", eq: "دمبل", risk: ["الركبة"], cues: ["خطوة واسعة للأمام", "الركبة الأمامية فوق الكاحل", "ادفع بالكعب للعودة"], mistakes: ["ركبة تتجاوز أصابع القدم بشدة"], alts: [
      { name: "اندفاع بار خلفي", eq: "بار" }, { name: "اندفاع بوزن الجسم", eq: "وزن الجسم" }, { name: "طلوع درج (Step-up)", eq: "دمبل" }] },
    { name: "ثني أرجل خلفي بالآلة", eq: "آلة", risk: [], cues: ["ثبّت الحوض على الوسادة", "اعصر العضلة الخلفية في الأعلى", "نزول بطيء ومتحكم"], mistakes: ["رفع الحوض أثناء الثني"], alts: [
      { name: "سحب رومانى بالدمبل", eq: "دمبل" }, { name: "ثني أرجل بأشرطة", eq: "أشرطة مقاومة" }, { name: "جسر أرضي بساق واحدة", eq: "وزن الجسم" }] },
    { name: "رفع سمانة واقف", eq: "آلة", risk: [], cues: ["مدى حركة كامل: تمدد ثم انقباض", "توقف ثانية في الأعلى", "لا ترتد من الأسفل"], mistakes: ["ارتداد سريع بدون تحكم"], alts: [
      { name: "رفع سمانة بالدمبل", eq: "دمبل" }, { name: "رفع سمانة بوزن الجسم على درجة", eq: "وزن الجسم" }, { name: "سمانة على آلة دفع الأرجل", eq: "آلة" }] },
  ],
  "بطن": [
    { name: "بلانك (Plank)", eq: "وزن الجسم", risk: [], cues: ["جسم في خط مستقيم واحد", "شدّ البطن والمؤخرة", "تنفس طبيعي — لا تحبس النفس"], mistakes: ["هبوط الحوض", "رفع المؤخرة"], alts: [
      { name: "بلانك جانبي", eq: "وزن الجسم" }, { name: "بلانك بسحب كيبل (Pallof)", eq: "كيبل" }, { name: "بلانك بشريط مقاومة", eq: "أشرطة مقاومة" }] },
    { name: "رفع أرجل معلق", eq: "وزن الجسم", risk: ["أسفل الظهر"], cues: ["ارفع بالبطن لا بعضلة الفخذ", "لفّ الحوض للأعلى في النهاية", "نزول بطيء"], mistakes: ["التأرجح", "تقوس أسفل الظهر"], alts: [
      { name: "رفع أرجل مستلقي", eq: "وزن الجسم" }, { name: "طحن كيبل (Cable Crunch)", eq: "كيبل" }, { name: "طحن بالآلة", eq: "آلة" }] },
  ],
};

// تقسيمات الأسبوع حسب عدد أيام التمرين — توازن الزوايا العضلية
const SPLITS = {
  3: [
    { name: "جسم كامل A", groups: ["صدر", "ظهر", "أرجل", "بطن"] },
    { name: "جسم كامل B", groups: ["أكتاف", "ظهر", "أرجل", "بايسبس"] },
    { name: "جسم كامل C", groups: ["صدر", "أكتاف", "ترايسبس", "بطن"] },
  ],
  4: [
    { name: "علوي A — دفع وسحب", groups: ["صدر", "ظهر", "أكتاف"] },
    { name: "سفلي A — أرجل وبطن", groups: ["أرجل", "بطن"] },
    { name: "علوي B — ذراعين وتفاصيل", groups: ["صدر", "ظهر", "بايسبس", "ترايسبس"] },
    { name: "سفلي B — أرجل وبطن", groups: ["أرجل", "بطن"] },
  ],
  5: [
    { name: "دفع — صدر وأكتاف وترايسبس", groups: ["صدر", "أكتاف", "ترايسبس"] },
    { name: "سحب — ظهر وبايسبس", groups: ["ظهر", "بايسبس"] },
    { name: "أرجل كامل", groups: ["أرجل", "بطن"] },
    { name: "علوي شامل", groups: ["صدر", "ظهر", "أكتاف"] },
    { name: "سفلي وذراعين", groups: ["أرجل", "بايسبس", "ترايسبس"] },
  ],
  6: [
    { name: "دفع A", groups: ["صدر", "أكتاف", "ترايسبس"] },
    { name: "سحب A", groups: ["ظهر", "بايسبس"] },
    { name: "أرجل A", groups: ["أرجل", "بطن"] },
    { name: "دفع B", groups: ["صدر", "أكتاف", "ترايسبس"] },
    { name: "سحب B", groups: ["ظهر", "بايسبس"] },
    { name: "أرجل B", groups: ["أرجل", "بطن"] },
  ],
};

// المكتبة المجانية — أنظمة مثبتة علمياً (مغناطيس الزوار من محركات البحث)
const FREE_PROGRAMS = [
  { id: "ppl", name: "Push / Pull / Legs", ar: "دفع / سحب / أرجل", days: 6, level: "متوسط → متقدم",
    desc: "النظام الأشهر عالمياً لبناء العضلات: تقسيم منطقي حسب وظيفة الحركة، وكل عضلة تُستهدف مرتين أسبوعياً — التكرار الأمثل لنمو العضلات وفق الأبحاث.",
    best: "الأفضل لمن يتمرن 5–6 أيام ويريد أقصى حجم تدريبي." },
  { id: "ul", name: "Upper / Lower", ar: "علوي / سفلي", days: 4, level: "مبتدئ → متقدم",
    desc: "توازن مثالي بين الحجم التدريبي والاستشفاء: يومان للجزء العلوي ويومان للسفلي، بترتيب يمنح كل عضلة راحة كافية قبل استهدافها مجدداً.",
    best: "الأفضل للمشغولين الجادين — 4 أيام تكفي لنتائج ممتازة." },
  { id: "fb", name: "Full Body", ar: "جسم كامل", days: 3, level: "مبتدئ → متوسط",
    desc: "جسم كامل في كل جلسة، 3 مرات أسبوعياً — أعلى تكرار للتعلم الحركي، وأسرع نقطة انطلاق للمبتدئين ببناء قاعدة قوة متوازنة.",
    best: "الأفضل للمبتدئين ومحدودي الوقت." },
];
const buildFreeProgram = (days) => generateProgram({ days, equipment: EQUIPMENT, injuries: [], weakPoints: [] });

// قاعدة الوجبات — 3 بدائل لكل وجبة، بكميات دقيقة تُحجَّم تلقائياً على سعرات كل مشترك
// kcal / p / c / f = قيم الخيار عند الكميات الأساسية، وتُعاد معايرة الكميات المعروضة حسب هدفك اليومي
const MEALS = [
  { id: "bf", title: "الفطور", share: 0.25, options: [
    { tag: "كربوهيدرات معقدة · طاقة مستدامة", kcal: 715, p: 26, c: 99, f: 25, items: [
      { n: "شوفان", g: 80 }, { n: "حليب", g: 250, u: "مل" }, { n: "موز", g: 1, u: "حبة" }, { n: "زبدة فول سوداني", g: 30 }] },
    { tag: "بروتين عالٍ · دهون صحية", kcal: 545, p: 25, c: 36, f: 33, items: [
      { n: "بيض (أومليت)", g: 3, u: "حبة" }, { n: "توست أسمر", g: 2, u: "شريحة" }, { n: "أفوكادو", g: 70 }] },
    { tag: "سريع التحضير · بروتين جيد", kcal: 430, p: 26, c: 62, f: 8, items: [
      { n: "زبادي يوناني", g: 200 }, { n: "جرانولا", g: 40 }, { n: "عسل", g: 20 }, { n: "فواكه موسمية", g: 80 }] },
  ]},
  { id: "ln", title: "الغداء", share: 0.35, options: [
    { tag: "الوجبة الكلاسيكية للرياضيين", kcal: 610, p: 51, c: 60, f: 17, items: [
      { n: "صدر دجاج مشوي", g: 150 }, { n: "أرز بسمتي مطبوخ", g: 200 }, { n: "سلطة خضراء", g: 150 }, { n: "زيت زيتون", g: 10 }] },
    { tag: "أوميغا 3 · مضادات التهاب", kcal: 545, p: 35, c: 45, f: 23, items: [
      { n: "سلمون مشوي", g: 150 }, { n: "بطاطا حلوة", g: 200 }, { n: "خضار سوتيه", g: 150 }] },
    { tag: "حديد وزنك · كربوهيدرات جيدة", kcal: 585, p: 49, c: 62, f: 13, items: [
      { n: "لحم بقري قليل الدهن", g: 150 }, { n: "مكرونة قمح كامل (وزن جاف)", g: 80 }, { n: "خضار مشوية", g: 150 }] },
  ]},
  { id: "sn", title: "سناك ما قبل التمرين", share: 0.15, options: [
    { tag: "طاقة سريعة قبل الجلسة", kcal: 290, p: 6, c: 34, f: 16, items: [
      { n: "موز", g: 1, u: "حبة" }, { n: "مكسرات نيئة", g: 30 }] },
    { tag: "كافيين + سكريات سريعة", kcal: 265, p: 11, c: 50, f: 2, items: [
      { n: "تمر", g: 3, u: "حبة" }, { n: "زبادي", g: 200 }, { n: "قهوة", g: 1, u: "فنجان" }] },
    { tag: "خفيف وسريع الهضم", kcal: 345, p: 11, c: 46, f: 13, items: [
      { n: "توست أسمر", g: 2, u: "شريحة" }, { n: "زبدة فول سوداني", g: 20 }, { n: "عسل", g: 15 }] },
  ]},
  { id: "dn", title: "العشاء", share: 0.25, options: [
    { tag: "بروتين نظيف · شبع عالٍ", kcal: 320, p: 31, c: 44, f: 3, items: [
      { n: "تونة مصفّاة", g: 120 }, { n: "بطاطس مسلوقة", g: 200 }, { n: "خضار مشكلة", g: 150 }] },
    { tag: "استشفاء ليلي مثالي", kcal: 455, p: 52, c: 35, f: 10, items: [
      { n: "صدر دجاج", g: 150 }, { n: "كينوا مطبوخة", g: 150 }, { n: "بروكلي", g: 100 }] },
    { tag: "كازين بطيء الامتصاص قبل النوم", kcal: 360, p: 25, c: 36, f: 12, items: [
      { n: "جبن قريش", g: 200 }, { n: "خبز أسمر", g: 2, u: "شريحة" }, { n: "خيار وطماطم", g: 150 }] },
  ]},
];
// تحجيم كمية كل مكوّن حسب سعرات المشترك — الجرامات لأقرب 5جم، والحبّات لأنصاف
const scaleAmt = (it, f) => {
  if (it.u && it.u !== "مل") { const v = Math.max(0.5, Math.round(it.g * f * 2) / 2); return { v, u: it.u }; }
  const v = Math.max(5, Math.round((it.g * f) / 5) * 5);
  return { v, u: it.u || "جم" };
};

/* ─── سوق المدربين (Multi-Coach Marketplace) ─── */
const COACHES_SEED = [
  { id: "jag", name: "كابتن جغمان", lead: true, years: 9, specialty: "تضخيم وتنشيف · إشراف عام", clients: 140,
    bio: "مؤسس المنصة والمشرف العام (Lead Coach). تسع سنوات في تدريب المحترفين والمبتدئين، متخصص في إعادة تركيب الجسم والبرمجة طويلة المدى. يراجع شخصياً سيرة كل مدرب قبل انضمامه للفريق — اسمه ضمانك.",
    programs: [{ n: "متابعة Premium شاملة", pr: 29 }, { n: "برنامج تنشيف 12 أسبوعاً", pr: 49 }, { n: "مراجعة أداء فني (فيديو)", pr: 15 }],
    reviews: [
      { a: "أحمد س.", st: 5, t: "أفضل استثمار في صحتي — متابعة حقيقية وليست رسائل جاهزة.", d: "مايو 2026" },
      { a: "ليلى م.", st: 5, t: "خسرت 9 كيلو مع الحفاظ على عضلاتي. يرد حتى في العطلات!", d: "أبريل 2026" },
      { a: "يوسف ك.", st: 4, t: "برنامج ممتاز، أتمنى فقط مرونة أكبر في مواعيد المكالمات.", d: "مارس 2026" },
    ] },
  { id: "sara", name: "كابتن سارة", years: 6, specialty: "لياقة نسائية · ما بعد الولادة", clients: 85,
    bio: "متخصصة في تدريب السيدات وإعادة التأهيل بعد الولادة. برامج تراعي الهرمونات والمراحل الحياتية المختلفة، بأسلوب متدرج وآمن.",
    programs: [{ n: "متابعة شهرية نسائية", pr: 25 }, { n: "برنامج ما بعد الولادة 8 أسابيع", pr: 39 }],
    reviews: [
      { a: "نور ع.", st: 5, t: "أول مدربة فهمت احتياجي بعد الولادة. عدت أقوى من قبل الحمل!", d: "يونيو 2026" },
      { a: "هبة ر.", st: 5, t: "متابعة دقيقة وأسلوب محفز جداً.", d: "مايو 2026" },
    ] },
  { id: "omar", name: "كابتن عمر", years: 4, specialty: "قوة وباورليفتنغ", clients: 52,
    bio: "لاعب باورليفتنغ تنافسي. متخصص في رفع أرقامك في السكوات والبنش والديدلفت ببرمجة موجات الحمل (Wave Loading) وتقنية أداء دقيقة.",
    programs: [{ n: "برنامج قوة 10 أسابيع", pr: 35 }, { n: "تحليل فني للرفعات الثلاث", pr: 12 }],
    reviews: [
      { a: "خالد ع.", st: 5, t: "زاد ديدلفتي 30 كجم في 10 أسابيع. برمجة على مستوى عالمي.", d: "أبريل 2026" },
      { a: "سامي ف.", st: 4, t: "ممتاز للمتقدمين — المبتدئ قد يجده مكثفاً.", d: "فبراير 2026" },
    ] },
  { id: "lina", name: "كابتن لينا", years: 5, specialty: "تغذية رياضية وعلاجية", clients: 70,
    bio: "أخصائية تغذية معتمدة. تبني خططاً غذائية واقعية تناسب نمط حياتك — بدون حرمان — مع مراعاة الحالات الخاصة (سكري، ضغط، حساسيات).",
    programs: [{ n: "خطة غذائية شهرية + متابعة", pr: 22 }, { n: "استشارة تغذية علاجية", pr: 18 }],
    reviews: [
      { a: "منى ح.", st: 5, t: "خطة مرنة جداً — أول مرة ألتزم أكثر من 3 أشهر!", d: "مايو 2026" },
    ] },
];
const coachAvg = (rv) => rv.length ? rv.reduce((t, r) => t + r.st, 0) / rv.length : 0;
const PLATFORM_FEE = 15; // عمولة المنصة % من اشتراكات المدربين

/* ─── بيانات لوحة الإدارة (تجريبية — تأتي من قاعدة البيانات في الإنتاج) ─── */
const ADMIN_SUBS = [
  { n: "أحمد سالم", pl: "Premium · سنة", d: "2026-02-14", st: "مدفوع", left: 227, g: "تضخيم", coach: "جغمان" },
  { n: "ليلى محمد", pl: "Premium · 3 أشهر", d: "2026-05-01", st: "مدفوع", left: 29, g: "تنشيف", coach: "جغمان" },
  { n: "نور عادل", pl: "أساسي · 6 أشهر", d: "2026-03-22", st: "مدفوع", left: 81, g: "لياقة", coach: "سارة" },
  { n: "خالد عمر", pl: "Premium · شهر", d: "2026-06-20", st: "مدفوع", left: 18, g: "قوة", coach: "عمر" },
  { n: "منى حسن", pl: "أساسي · 3 أشهر", d: "2026-04-10", st: "متأخر", left: 8, g: "تنشيف", coach: "لينا" },
  { n: "سامي فؤاد", pl: "أساسي · شهر", d: "2026-06-28", st: "مدفوع", left: 26, g: "قوة", coach: "عمر" },
];
const ADMIN_REV = [
  { m: "فبراير", v: 380 }, { m: "مارس", v: 520 }, { m: "أبريل", v: 690 },
  { m: "مايو", v: 940 }, { m: "يونيو", v: 1280 }, { m: "يوليو", v: 1010 },
];
const COACH_APPS = [
  { n: "كريم بدر", y: 3, sp: "كارديو وحرق دهون", st: "قيد المراجعة" },
  { n: "دينا سمير", y: 7, sp: "يوغا ومرونة", st: "قيد المراجعة" },
];
const AFFILIATES = [
  { code: "JAGH-AHMED-291", refs: 7, due: 20.3 },
  { code: "JAGH-NOUR-118", refs: 4, due: 10.0 },
  { code: "JAGH-KHALED-546", refs: 2, due: 5.8 },
];

// نجوم التقييم — عرض وإدخال
function Stars({ value, size = 14, onRate }) {
  return (
    <div className="flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} disabled={!onRate} onClick={() => onRate && onRate(n)}
          className={onRate ? "hover:scale-125 transition-transform" : "cursor-default"} aria-label={`${n} نجوم`}>
          <Star size={size} className={n <= Math.round(value) ? "text-amber-300" : "text-zinc-700"}
            fill={n <= Math.round(value) ? "#d4af6e" : "none"} />
        </button>
      ))}
    </div>
  );
}

const PLANS = {
  basic: {
    label: "الاشتراك الأساسي",
    tag: "رسوم رمزية",
    perks: [
      "برنامج تدريبي مخصص يناسب هدفك وجسمك ومعداتك",
      "حساب سعراتك بدقة (TDEE) + خطة غذائية مع تبديل الوجبات",
      "تخصيص الجدول حسب نقاط ضعفك العضلية",
      "وصول كامل لجميع أدوات المنصة",
      "بدائل علمية لكل تمرين",
      "تتبع الوزن والتقدم",
      "تحديث البرنامج مع كل دورة تدريبية",
    ],
    options: [
      { id: "b1", name: "شهر واحد", total: 10, per: "10€ / شهر", featured: false },
      { id: "b3", name: "3 أشهر", total: 25, per: "≈ 8.3€ / شهر", featured: true },
      { id: "b6", name: "6 أشهر كاملة", total: 40, per: "≈ 6.7€ / شهر", featured: false },
    ],
  },
  premium: {
    label: "اشتراك Premium",
    tag: "متابعة شخصية",
    perks: [
      "كل مميزات الاشتراك الأساسي",
      "متابعة شخصية مرتين أسبوعياً: مكالمة فيديو أو مكالمة أو رسائل",
      "تواصل مباشر مع المدرب في أي وقت",
      "الوصول لمجتمع الأبطال — الجروب الخاص بالمشتركين",
    ],
    options: [
      { id: "p1", name: "شهر واحد", total: 29, per: "29€ / شهر", featured: false },
      { id: "p3", name: "3 أشهر", total: 72, per: "24€ / شهر", featured: true },
      { id: "p12", name: "سنة كاملة", total: 204, per: "17€ / شهر", featured: false },
    ],
  },
};

const SEED_POSTS = [
  { id: 1, author: "أحمد س.", badge: "قبل / بعد", time: "قبل ساعتين", likes: 34, liked: false, content: "خسرت 9 كيلو في 12 أسبوع مع البرنامج! 💪 الالتزام بمبدأ التدرج في الحمل غيّر كل شيء. الصور في التعليقات." },
  { id: 2, author: "ليلى م.", badge: "سؤال", time: "قبل 5 ساعات", likes: 12, liked: false, content: "ما البديل الأفضل للسكوات مع ألم خفيف في الركبة؟ استخدمت خاصية التمارين البديلة واخترت دفع الأرجل — هل هذا صحيح؟" },
  { id: 3, author: "خالد ع.", badge: "إنجاز", time: "أمس", likes: 58, liked: false, content: "أول عقلة كاملة في حياتي اليوم! 🔥 بدأت بالسحب بالأشرطة قبل 8 أسابيع. شكراً للمدرب على المتابعة المستمرة." },
];

/* ═══════════════════════════════════════════════════════════════
   2. منطق توليد البرنامج (AI Program Generator)
   ═══════════════════════════════════════════════════════════════ */

// اختيار النسخة المناسبة من التمرين حسب المعدات المتوفرة والإصابات
function resolveExercise(ex, equipment, injuries) {
  const risky = ex.risk.some((r) => injuries.includes(r));
  const available = equipment.includes(ex.eq);
  if (available && !risky) return { ...ex, swapped: false, warning: null };
  // ابحث عن بديل بنفس الزاوية العضلية
  const alt = ex.alts.find((a) => equipment.includes(a.eq));
  if (alt) return { ...ex, name: alt.name, eq: alt.eq, swapped: true, original: ex.name, warning: risky ? "تم الاستبدال تلقائياً لحماية منطقة الإصابة" : "تم الاستبدال حسب المعدات المتوفرة" };
  return { ...ex, swapped: false, warning: risky ? "⚠ انتبه: هذا التمرين قد يجهد منطقة إصابتك — خفف الوزن أو استشر المدرب" : null };
}

function generateProgram(profile) {
  const days = Math.min(Math.max(profile.days, 3), 6);
  const split = SPLITS[days];
  return split.map((day, di) => ({
    ...day,
    exercises: day.groups.flatMap((g) => {
      const pool = EXERCISE_DB[g];
      const focus = profile.weakPoints?.includes(g);
      // تدوير التمارين حسب اليوم — وحجم تدريبي أكبر (تمرين إضافي) لنقاط الضعف المحددة
      const count = Math.min(focus ? 3 : 2, pool.length);
      const picks = Array.from({ length: count }, (_, k) => pool[(k + di) % pool.length]);
      return picks.map((ex) => ({ group: g, focus, ...resolveExercise(ex, profile.equipment, profile.injuries) }));
    }),
  }));
}

/* ═══════════════════════════════════════════════════════════════
   3. مكونات واجهة مشتركة
   ═══════════════════════════════════════════════════════════════ */

const Modal = ({ open, onClose, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[88vh] overflow-y-auto`}
      >
        <button onClick={onClose} className="absolute top-4 left-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800" aria-label="إغلاق">
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
};

const Chip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
      active ? "bg-amber-400 border-amber-400 text-zinc-950" : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-amber-400/60"
    }`}
  >
    {children}
  </button>
);

const GroupBadge = ({ g }) => {
  const colors = {
    "صدر": "bg-rose-500/15 text-rose-300 border-rose-500/30",
    "ظهر": "bg-sky-500/15 text-sky-300 border-sky-500/30",
    "أكتاف": "bg-amber-500/15 text-amber-300 border-amber-500/30",
    "ترايسبس": "bg-violet-500/15 text-violet-300 border-violet-500/30",
    "بايسبس": "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
    "أرجل": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    "بطن": "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  };
  return <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${colors[g]}`}>{g}</span>;
};

/* ─── هوية Jaghman Coaching: ذهبي شامبين على فحمي داكن ─── */
const GOLD = "#d4af6e", GOLD_DEEP = "#a8843f", GOLD_LIGHT = "#ecd9a8";

// الشعار الرسمي (الصورة الأصلية مضمّنة Base64 — عند النشر في Next.js ضعها في /public واستخدم <Image>)
const JAGHMAN_LOGO = "data:image/webp;base64,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";

// الشعار الكامل — يعرض الصورة الرسمية الأصلية كما هي في كل مواضع المنصة
function Logo({ size = 34, stacked = false }) {
  return (
    <img src={JAGHMAN_LOGO} alt="Jaghman Coaching"
      className="w-auto select-none" draggable={false}
      style={{ height: stacked ? size * 2.4 : Math.round(size * 1.35) }} />
  );
}

function Landing({ onStart, onLibrary, onLogin, onCoaches, onJoin, onAdmin }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="min-h-screen">
      {/* شريط علوي */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Logo size={44} />
        <div className="flex items-center gap-2">
          <button onClick={onLibrary} className="hidden sm:flex items-center gap-1.5 text-sm font-bold text-zinc-300 hover:text-white px-3 py-2 transition-colors">
            <BookOpen size={15} /> البرامج المجانية
          </button>
          {/* قائمة المدربين المنسدلة */}
          <div className="relative">
            <button onClick={() => setMenu(!menu)}
              className="flex items-center gap-1 text-sm font-bold text-zinc-300 hover:text-white px-3 py-2 transition-colors">
              المدربون <ChevronDown size={14} className={`transition-transform ${menu ? "rotate-180" : ""}`} />
            </button>
            {menu && (
              <div className="absolute left-0 top-full mt-2 bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden w-48 z-50 shadow-2xl">
                <button onClick={() => { setMenu(false); onCoaches(); }}
                  className="w-full text-right px-4 py-3 text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2">
                  <Star size={14} className="text-amber-300" /> اختر مدربك
                </button>
                <button onClick={() => { setMenu(false); onJoin(); }}
                  className="w-full text-right px-4 py-3 text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 border-t border-zinc-800">
                  <UserPlus size={14} className="text-amber-300" /> انضم لفريقنا
                </button>
              </div>
            )}
          </div>
          <button onClick={onLogin} className="text-sm font-bold text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 px-4 py-2 rounded-xl transition-colors">
            تسجيل الدخول
          </button>
          <button onClick={onStart} className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold px-5 py-2 rounded-xl transition-colors">
            ابدأ الآن
          </button>
        </div>
      </nav>

      {/* البطل */}
      <header className="max-w-6xl mx-auto px-6 pt-12 pb-20 text-center">
        <div className="flex justify-center mb-5">
          <img src={JAGHMAN_LOGO} alt="Jaghman Coaching" className="w-72 md:w-96 drop-shadow-2xl" />
        </div>
        <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 text-sm text-amber-300 font-semibold mb-6">
          <Zap size={14} /> برنامج مخصص يُبنى لجسمك ويُتابَع بمدرب حقيقي
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
          خطة تمرين <span className="text-amber-400">تتطوّر معك</span>
          <br /> أسبوعاً بعد أسبوع
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          نبني برنامجك حسب جسمك وهدفك ومعداتك، ونطبّق مبدأ التدرج في الحمل (Progressive Overload) تلقائياً —
          مع بديل علمي لكل تمرين، ومدرب على واتساب في أي وقت.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={onStart} className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-lg px-9 py-4 rounded-2xl transition-all hover:scale-105 shadow-lg shadow-amber-400/20">
            🚀 صمّم برنامجي المخصص
          </button>
          <button onClick={onLibrary} className="border-2 border-zinc-700 hover:border-amber-400/60 text-white font-black text-lg px-8 py-4 rounded-2xl transition-colors flex items-center gap-2">
            <BookOpen size={20} /> تصفح البرامج المجانية
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-4">البرامج الجاهزة مجانية 100% — بدون تسجيل أو بطاقة.</p>

        {/* شريط دورة التدرج — عنصر مميز */}
        <div className="mt-16 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 max-w-3xl mx-auto">
          <p className="text-sm text-zinc-400 mb-4 font-semibold">هكذا تعمل دورة التدرج في الحمل كل 4 أسابيع:</p>
          <div className="grid grid-cols-4 gap-2">
            {OVERLOAD_WEEKS.map((w, i) => (
              <div key={w.id} className="rounded-xl p-3 border border-zinc-800 bg-zinc-950">
                <div className="flex justify-center mb-2">
                  <div className="flex items-end gap-0.5 h-8">
                    {[...Array(4)].map((_, b) => (
                      <div key={b} className={`w-1.5 rounded-t ${b <= i && i < 3 ? "bg-amber-400" : i === 3 && b === 0 ? "bg-emerald-400" : "bg-zinc-700"}`} style={{ height: `${i === 3 ? 12 : 10 + (b <= i ? b * 7 : 4)}px` }} />
                    ))}
                  </div>
                </div>
                <p className="text-xs font-bold">{w.label}</p>
                <p className="text-xs text-zinc-500">{w.reps} تكرار</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* مكتبة البرامج المجانية — بوابة الدخول (Freemium) */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-black">برامج تدريب مجانية جاهزة 🎁</h2>
            <p className="text-zinc-400 text-sm mt-1">أنظمة مثبتة علمياً — تصفحها كاملة بالفيديوهات التوضيحية، بدون تسجيل.</p>
          </div>
          <button onClick={onLibrary} className="text-sm font-bold text-amber-300 hover:text-amber-200 shrink-0 transition-colors">عرض الكل ←</button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {FREE_PROGRAMS.map((fp) => (
            <button key={fp.id} onClick={onLibrary}
              className="text-right bg-zinc-900/60 border border-zinc-800 hover:border-amber-400/50 rounded-2xl p-5 transition-colors group">
              <p className="font-black text-lg" dir="ltr" style={{ textAlign: "right" }}>{fp.name}</p>
              <p className="text-amber-300 text-sm font-bold mb-2">نظام {fp.ar} · {fp.days} أيام</p>
              <p className="text-xs text-zinc-400 leading-relaxed">{fp.best}</p>
              <p className="text-xs font-bold text-zinc-500 group-hover:text-amber-300 mt-3 transition-colors">تصفح البرنامج مجاناً ←</p>
            </button>
          ))}
        </div>
      </section>

      {/* المميزات */}
      <section className="max-w-6xl mx-auto px-6 pb-20 grid md:grid-cols-4 gap-4">
        {[
          { icon: RefreshCw, t: "بدائل علمية لكل تمرين", d: "ما عندك الجهاز؟ نعطيك البديل بنفس الزاوية العضلية والفعالية." },
          { icon: TrendingUp, t: "تدرج تلقائي في الحمل", d: "الأوزان والتكرارات تتغير كل أسبوع حسب مرحلة الدورة." },
          { icon: MessageCircle, t: "مدرب على واتساب", d: "تواصل مباشر مع مدربك في أي وقت، ومكالمة فيديو دورية." },
          { icon: Users, t: "مجتمع الأبطال", d: "شارك نتائجك قبل وبعد، واسأل وتحفّز مع مشتركين مثلك." },
        ].map((f, i) => (
          <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 hover:border-amber-400/40 transition-colors">
            <f.icon className="text-amber-400 mb-3" size={26} />
            <h3 className="font-bold mb-1">{f.t}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{f.d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-zinc-800 py-8 text-center text-zinc-500 text-sm">
        <p>Jaghman Coaching © 2026 — تدريب مخصص، متابعة إنسانية.</p>
        <button onClick={onAdmin} className="text-[11px] text-zinc-700 hover:text-amber-300 mt-2 transition-colors">
          🛡️ لوحة الإدارة (في الإنتاج: خلف مصادقة المسؤول حصراً)
        </button>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. التسجيل الذكي (Onboarding)
   ═══════════════════════════════════════════════════════════════ */

function Onboarding({ onDone, onBack }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState({ name: "", age: "", weight: "", height: "", bodyfat: "", gender: "ذكر", goal: "", days: 4, equipment: ["دمبل", "وزن الجسم"], injuries: [], weakPoints: [] });
  const steps = ["بياناتك", "هدفك", "الأيام", "معداتك", "نقاط الضعف", "الإصابات"];

  const toggle = (key, val) =>
    setP((s) => ({ ...s, [key]: s[key].includes(val) ? s[key].filter((x) => x !== val) : [...s[key], val] }));

  const canNext = [
    p.name && p.age > 9 && p.weight > 25 && p.height > 100,
    !!p.goal,
    true,
    p.equipment.length > 0,
    true,
    true,
  ][step];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        {/* شريط التقدم */}
        <div className="flex gap-1.5 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-amber-400" : "bg-zinc-800"}`} />
              <p className={`text-[10px] mt-1.5 ${i === step ? "text-amber-300 font-bold" : "text-zinc-600"}`}>{s}</p>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-black mb-2">عرّفنا على جسمك 📋</h2>
            <p className="text-zinc-400 text-sm mb-3">هذه البيانات أساس بناء برنامجك وحساب سعراتك بدقة.</p>
            <GoogleButton onCred={(u) => setP((s) => ({ ...s, name: s.name || u.name, email: u.email }))} />
            {GOOGLE_CLIENT_ID && <p className="text-[11px] text-zinc-600 text-center">زر Google يملأ اسمك تلقائياً — وتبقى بقية الأسئلة لتخصيص برنامجك</p>}
            <div>
              <label className="text-sm font-semibold text-zinc-300 block mb-1.5">الجنس (لحساب السعرات)</label>
              <div className="flex gap-2">
                {["ذكر", "أنثى"].map((g) => (
                  <Chip key={g} active={p.gender === g} onClick={() => setP({ ...p, gender: g })}>{g}</Chip>
                ))}
              </div>
            </div>
            {[
              { k: "name", l: "الاسم", t: "text", ph: "مثال: عمر" },
              { k: "age", l: "العمر (سنة)", t: "number", ph: "25" },
              { k: "weight", l: "الوزن (كجم)", t: "number", ph: "78" },
              { k: "height", l: "الطول (سم)", t: "number", ph: "175" },
              { k: "bodyfat", l: "نسبة الدهون % (اختياري — لحساب أدق بمعادلة Katch-McArdle)", t: "number", ph: "مثال: 18" },
            ].map((f) => (
              <div key={f.k}>
                <label className="text-sm font-semibold text-zinc-300 block mb-1.5">{f.l}</label>
                <input
                  type={f.t} placeholder={f.ph} value={p[f.k]}
                  onChange={(e) => setP({ ...p, [f.k]: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-2xl font-black mb-2">ما هدفك الأساسي؟ 🎯</h2>
            <p className="text-zinc-400 text-sm mb-6">سنضبط الحجم التدريبي والتكرارات على أساسه.</p>
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <button key={g.id} onClick={() => setP({ ...p, goal: g.id })}
                  className={`p-5 rounded-2xl border-2 transition-all text-center ${p.goal === g.id ? "border-amber-400 bg-amber-400/10" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"}`}>
                  <g.icon className={`mx-auto mb-2 ${p.goal === g.id ? "text-amber-400" : "text-zinc-400"}`} size={28} />
                  <p className="font-bold text-sm">{g.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-black mb-2">كم يوماً تتمرن أسبوعياً؟ 📅</h2>
            <p className="text-zinc-400 text-sm mb-6">التقسيم العضلي يتغير حسب اختيارك — الجودة قبل الكمية.</p>
            <div className="grid grid-cols-4 gap-3">
              {[3, 4, 5, 6].map((d) => (
                <button key={d} onClick={() => setP({ ...p, days: d })}
                  className={`py-6 rounded-2xl border-2 font-black text-2xl ${p.days === d ? "border-amber-400 bg-amber-400/10 text-amber-300" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500"}`}>
                  {d}
                </button>
              ))}
            </div>
            <p className="text-sm text-zinc-500 mt-4 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              {p.days === 3 && "تقسيم جسم كامل ×3 — مثالي للمبتدئين والمشغولين."}
              {p.days === 4 && "تقسيم علوي/سفلي — توازن ممتاز بين الحجم والاستشفاء."}
              {p.days === 5 && "دفع/سحب/أرجل + علوي/سفلي — حجم تدريبي متقدم."}
              {p.days === 6 && "دفع/سحب/أرجل ×2 — كل عضلة مرتين أسبوعياً."}
            </p>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-2xl font-black mb-2">ما المعدات المتوفرة لديك؟ 🏋️</h2>
            <p className="text-zinc-400 text-sm mb-6">سنختار تمارينك — وبدائلها — بناءً على ما تملكه فعلاً.</p>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map((e) => (
                <Chip key={e} active={p.equipment.includes(e)} onClick={() => toggle("equipment", e)}>{e}</Chip>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-2xl font-black mb-2">ما نقاط ضعفك العضلية؟ 🎯</h2>
            <p className="text-zinc-400 text-sm mb-6">اختر حتى عضلتين تريد تركيزاً إضافياً عليهما — سنضيف لهما حجماً تدريبياً أكبر في جدولك.</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(EXERCISE_DB).map((g) => (
                <Chip key={g} active={p.weakPoints.includes(g)}
                  onClick={() => setP((st) => ({ ...st, weakPoints: st.weakPoints.includes(g) ? st.weakPoints.filter((x) => x !== g) : st.weakPoints.length < 2 ? [...st.weakPoints, g] : st.weakPoints }))}>
                  {g}
                </Chip>
              ))}
              <Chip active={p.weakPoints.length === 0} onClick={() => setP({ ...p, weakPoints: [] })}>لا يوجد — برنامج متوازن ✓</Chip>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-2xl font-black mb-2">هل لديك إصابات سابقة؟ 🩹</h2>
            <p className="text-zinc-400 text-sm mb-6">سنستبعد التمارين المُجهدة لهذه المناطق ونستبدلها ببدائل آمنة تلقائياً.</p>
            <div className="flex flex-wrap gap-2">
              {INJURIES.map((inj) => (
                <Chip key={inj} active={p.injuries.includes(inj)} onClick={() => toggle("injuries", inj)}>{inj}</Chip>
              ))}
              <Chip active={p.injuries.length === 0} onClick={() => setP({ ...p, injuries: [] })}>لا يوجد ✓</Chip>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          <button onClick={() => (step > 0 ? setStep(step - 1) : onBack())}
            className="px-5 py-3 rounded-xl border border-zinc-700 text-zinc-300 font-bold hover:bg-zinc-800 transition-colors">
            رجوع
          </button>
          <button
            disabled={!canNext}
            onClick={() => (step < 5 ? setStep(step + 1) : onDone(p))}
            className="flex-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-black py-3 rounded-xl transition-colors"
          >
            {step < 4 ? "التالي" : "ابنِ برنامجي الآن 🚀"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6. الاشتراكات + بوابة الدفع التجريبية
   ═══════════════════════════════════════════════════════════════ */

function Plans({ onSubscribed, currentPlan, onBack, coupons }) {
  const site = useSite();
  const isUpgrade = currentPlan?.tier === "basic";
  const [tier, setTier] = useState(isUpgrade ? "premium" : "basic");
  const [selected, setSelected] = useState(null);
  // الأسعار وروابط الدفع من جدول جوجل إن توفرت، وإلا الافتراضية المدمجة
  const LIVE = React.useMemo(() => {
    if (site.connected && site.plans) {
      return {
        basic: { ...PLANS.basic, options: site.plans.basic.options.length ? site.plans.basic.options : PLANS.basic.options },
        premium: { ...PLANS.premium, options: site.plans.premium.options.length ? site.plans.premium.options : PLANS.premium.options },
      };
    }
    return PLANS;
  }, [site]);
  const t = LIVE[tier];
  // عرض الترقية: خصم قيمة الاشتراك الأساسي المدفوع من باقات Premium
  const credit = isUpgrade && tier === "premium" ? currentPlan.total : 0;
  const finalOf = (op) => Math.max(0, op.total - credit);
  // كود خصم (من لوحة الإدارة) أو كود إحالة (عمولة 10% لصاحبه)
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState(null);
  // حالات تسجيل الحساب
  const [reg, setReg] = useState({ name: "", username: "", password: "" });
  const [gUser, setGUser] = useState(null); // حساب Google المختار — يملأ البيانات ويغني عن كلمة المرور
  const [regLoading, setRegLoading] = useState(false);
  const [regDone, setRegDone] = useState(null);
  const [regErr, setRegErr] = useState("");
  const couponCut = (op) => {
    if (applied?.kind !== "coupon") return 0;
    const base = finalOf(op);
    return Math.min(base, applied.c.kind === "percent" ? Math.round((base * applied.c.val) / 100) : applied.c.val);
  };
  const payable = (op) => Math.max(0, finalOf(op) - couponCut(op));
  const applyCode = () => {
    const v = code.trim().toUpperCase();
    const c = (coupons || []).find((x) => x.active && x.code === v);
    if (c) setApplied({ kind: "coupon", c });
    else if (/^JAGH-/.test(v)) setApplied({ kind: "ref", v });
    else setApplied({ kind: "bad" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-16 relative">
      {/* زر الرجوع */}
      <button onClick={onBack}
        className="absolute top-5 right-5 flex items-center gap-1 text-sm font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-600 px-4 py-2 rounded-xl transition-colors">
        <ChevronRight size={16} /> رجوع
      </button>

      <h2 className="text-3xl font-black mb-2">{isUpgrade ? "الترقية إلى Premium 👑" : "اختر اشتراكك 👑"}</h2>
      <p className="text-zinc-400 mb-6">{isUpgrade ? "متابعة شخصية مرتين أسبوعياً + مجتمع الأبطال الخاص." : "برنامجك جاهز — فعّل اشتراكك للوصول الكامل."}</p>

      {isUpgrade && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold px-4 py-2.5 rounded-xl mb-6 text-center">
          🎁 عرض الترقية: نخصم قيمة اشتراكك الأساسي الحالي ({currentPlan.total}€) من أي باقة Premium
        </div>
      )}

      {/* مبدّل الفئة */}
      {!isUpgrade && (
      <div className="flex bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 mb-8 gap-1">
        <button onClick={() => setTier("basic")}
          className={`px-6 py-2.5 rounded-xl font-black text-sm transition-colors ${tier === "basic" ? "bg-amber-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}>
          الأساسي · رسوم رمزية
        </button>
        <button onClick={() => setTier("premium")}
          className={`px-6 py-2.5 rounded-xl font-black text-sm transition-colors flex items-center gap-1.5 ${tier === "premium" ? "bg-amber-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}>
          <Crown size={15} /> Premium · متابعة شخصية
        </button>
      </div>
      )}

      {/* مميزات الفئة المختارة */}
      <div className={`w-full max-w-4xl rounded-2xl border p-5 mb-6 ${tier === "premium" ? "border-amber-400/40 bg-amber-400/5" : "border-zinc-800 bg-zinc-900/60"}`}>
        <p className="font-black mb-3 flex items-center gap-2">
          {tier === "premium" ? <Crown size={17} className="text-amber-300" /> : <Check size={17} className="text-emerald-400" />}
          ماذا يشمل {t.label}؟
        </p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {t.perks.map((pk) => (
            <p key={pk} className="flex items-start gap-2 text-sm text-zinc-300">
              <Check size={15} className={`mt-0.5 shrink-0 ${tier === "premium" ? "text-amber-300" : "text-emerald-400"}`} /> {pk}
            </p>
          ))}
        </div>
      </div>

      {/* بطاقات المدد */}
      <div className="grid md:grid-cols-3 gap-5 max-w-4xl w-full">
        {t.options.map((op) => (
          <div key={op.id} className={`relative rounded-3xl p-6 border-2 flex flex-col ${op.featured ? "border-amber-400 bg-zinc-900" : "border-zinc-800 bg-zinc-900/60"}`}>
            {op.featured && (
              <span className="absolute -top-3 right-6 bg-amber-400 text-zinc-950 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                <Star size={12} /> الأوفر
              </span>
            )}
            <h3 className="font-black text-lg mb-2">{op.name}</h3>
            {credit > 0 ? (
              <>
                <p className="text-sm text-zinc-500 line-through">{op.total}€</p>
                <p className="text-4xl font-black mb-0.5 text-emerald-400">{finalOf(op)}<span className="text-lg text-zinc-400">€</span></p>
                <p className="text-xs text-emerald-400/90 mb-6">بعد خصم اشتراكك الأساسي · دفعة واحدة</p>
              </>
            ) : (
              <>
                <p className="text-4xl font-black mb-0.5">{op.total}<span className="text-lg text-zinc-400">€</span></p>
                <p className="text-xs text-zinc-500 mb-6">{op.per} · دفعة واحدة</p>
              </>
            )}
            <button onClick={() => setSelected(op)}
              className={`w-full py-3 rounded-xl font-black transition-colors mt-auto ${op.featured ? "bg-amber-400 hover:bg-amber-300 text-zinc-950" : "bg-zinc-800 hover:bg-zinc-700 text-white"}`}>
              اشترك الآن
            </button>
          </div>
        ))}
      </div>
      {tier === "basic" && (
        <p className="text-xs text-zinc-500 mt-5">تريد متابعة شخصية مع المدرب مرتين أسبوعياً ومجتمعاً خاصاً؟ جرّب <button onClick={() => setTier("premium")} className="text-amber-300 font-bold underline">Premium</button></p>
      )}

      {/* تسجيل حساب + طلب الاشتراك عبر واتساب — تحصيل يدوي آمن */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setReg({ name: "", username: "", password: "" }); setGUser(null); setRegDone(null); }}>
        <div className="p-7">
          {(() => {
            const finalPrice = payable(selected || { total: 0 });
            const regOk = reg.name.trim() && reg.username.trim().length >= 3 && reg.password.length >= 4;
            const waMsg = encodeURIComponent(
              `مرحباً كابتن جغمان 👋\nسجّلت حساباً وأريد الاشتراك في:\n▪️ ${t.label} — ${selected?.name}\n▪️ السعر: ${finalPrice}€\n▪️ اسم المستخدم: ${reg.username}${code && applied?.kind !== "bad" ? `\n▪️ الكود: ${code}` : ""}\n\nكيف أكمل الدفع؟`
            );
            const waHref = `https://wa.me/${COACH_WHATSAPP}?text=${waMsg}`;

            const doSignup = async () => {
              setRegLoading(true);
              const res = await signupAccount({
                name: reg.name, username: reg.username, password: reg.password,
                email: gUser?.email || "",
                plan: t.label + " · " + selected.name, tier, goal: "",
                amount: finalPrice, refCode: applied?.kind === "ref" ? applied.v : "",
              });
              setRegLoading(false);
              if (res.ok) setRegDone(waHref);
              else if (res.error === "username_taken") setRegErr("اسم المستخدم محجوز، اختر غيره");
              else setRegDone(waHref); // في وضع المعاينة أو تعذّر الاتصال، أكمل لواتساب
            };

            // بعد التسجيل الناجح: اعرض زر واتساب
            if (regDone) return (
              <div className="text-center">
                <div className="bg-emerald-500/15 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Check size={30} className="text-emerald-400" />
                </div>
                <h3 className="font-black text-xl mb-1">تم إنشاء حسابك! 🎉</h3>
                <p className="text-zinc-400 text-sm mb-5 leading-relaxed">
                  حسابك الآن <b className="text-amber-300">بانتظار تأكيد الدفع</b>. تواصل مع المدرب لإتمام الدفع، وسيُفعّل حسابك خلال دقائق.
                </p>
                <a href={regDone} target="_blank" rel="noreferrer"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  <MessageCircle size={20} /> تواصل لإتمام الدفع ({finalPrice}€)
                </a>
                <p className="text-[11px] text-zinc-600 mt-3">بعد الدفع، سجّل دخولك باسم المستخدم وكلمة المرور.</p>
              </div>
            );

            return (
              <>
                <h3 className="font-black text-xl text-center mb-1">أنشئ حسابك — {selected?.name}</h3>
                <p className="text-zinc-400 text-sm text-center mb-4">
                  {GOOGLE_CLIENT_ID ? "أسرع طريقة: زر Google يملأ بياناتك بنقرة — ثم أكمل الدفع مع المدرب." : "سجّل بياناتك أولاً، ثم أكمل الدفع مع المدرب لتفعيل اشتراكك."}
                </p>

                {/* التسجيل بنقرة عبر Google — يملأ الاسم والبريد ويغني عن كلمة المرور */}
                {!gUser && <GoogleButton onCred={(u) => {
                  setGUser(u);
                  setReg((r) => ({ name: r.name || u.name, username: u.email, password: r.password || ("g" + Math.random().toString(36).slice(2, 10)) }));
                  setRegErr("");
                }} />}
                {gUser && (
                  <p className="text-xs text-emerald-400 font-bold text-center bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2.5 mb-1">
                    ✓ سيرتبط حسابك بـ {gUser.email} — تدخل لاحقاً بزر Google مباشرة، بلا كلمة مرور
                  </p>
                )}
                {GOOGLE_CLIENT_ID && !gUser && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="h-px bg-zinc-800 flex-1" />
                    <span className="text-[11px] text-zinc-600 font-bold">أو سجّل يدوياً</span>
                    <div className="h-px bg-zinc-800 flex-1" />
                  </div>
                )}

                {/* ملخص السعر */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 mb-4 text-sm">
                  <p className="flex justify-between"><span className="text-zinc-400">{t.label} · {selected?.name}</span><span className="font-black text-amber-300">{finalPrice}€</span></p>
                </div>

                {/* حقول التسجيل */}
                <div className="space-y-3">
                  <input value={reg.name} onChange={(e) => { setReg({ ...reg, name: e.target.value }); setRegErr(""); }}
                    placeholder="الاسم الكامل"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
                  <input value={reg.username} onChange={(e) => { setReg({ ...reg, username: e.target.value.replace(/\s/g, "") }); setRegErr(""); }}
                    placeholder="اسم المستخدم (للدخول لاحقاً)" dir="ltr" readOnly={!!gUser}
                    className={`w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none ${gUser ? "opacity-70" : ""}`} />
                  {!gUser && <input type="password" value={reg.password} onChange={(e) => { setReg({ ...reg, password: e.target.value }); setRegErr(""); }}
                    placeholder="كلمة المرور (4 أحرف على الأقل)" dir="ltr"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />}
                </div>

                {/* كود خصم/إحالة */}
                <div className="flex gap-2 mt-3">
                  <input value={code} onChange={(e) => { setCode(e.target.value); setApplied(null); }}
                    placeholder="كود خصم أو إحالة (اختياري)" dir="ltr"
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
                  <button onClick={applyCode} disabled={!code.trim()}
                    className="text-sm font-black border border-amber-400/50 text-amber-300 hover:bg-amber-400/10 disabled:opacity-40 px-4 rounded-xl transition-colors">تطبيق</button>
                </div>
                {applied?.kind === "coupon" && <p className="text-xs text-emerald-400 font-bold mt-2 text-center">✓ تم تطبيق الكوبون</p>}
                {applied?.kind === "ref" && <p className="text-xs text-sky-400 font-bold mt-2 text-center">✓ كود إحالة صالح 🎁</p>}
                {applied?.kind === "bad" && <p className="text-xs text-rose-400 font-bold mt-2 text-center">✗ الكود غير صالح</p>}
                {regErr && <p className="text-xs text-rose-400 font-bold mt-2 text-center">{regErr}</p>}

                <button onClick={doSignup} disabled={!regOk || regLoading}
                  className="w-full mt-5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-black py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {regLoading ? <><RefreshCw size={18} className="animate-spin" /> جارٍ إنشاء الحساب...</> : "إنشاء الحساب والمتابعة للدفع"}
                </button>
              </>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6.5 محرك الفيديو التوليدي (AI Motion Engine)
   عرض حركي لكل تمرين + تضليل أحمر نابض على العضلة المستهدفة
   ═══════════════════════════════════════════════════════════════ */

const AI_CSS = `
@keyframes aiSlideY{0%,100%{transform:translateY(0)}50%{transform:translateY(var(--d))}}
@keyframes aiScaleY{0%,100%{transform:scaleY(1)}50%{transform:scaleY(var(--s))}}
@keyframes aiRot{0%,100%{transform:rotate(var(--r1,0deg))}50%{transform:rotate(var(--r2))}}
@keyframes aiPulse{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:1;transform:scale(1.12)}}
@keyframes aiProg{0%{width:0%}100%{width:100%}}
@keyframes aiGlow{0%,100%{filter:drop-shadow(0 0 4px rgba(239,68,68,.5))}50%{filter:drop-shadow(0 0 12px rgba(239,68,68,1))}}
@keyframes aiFadeA{0%,42%{opacity:1}52%,90%{opacity:0}100%{opacity:1}}
@keyframes aiFadeB{0%,42%{opacity:0}52%,90%{opacity:1}100%{opacity:0}}
@keyframes aiChev{0%,100%{transform:translateY(0);opacity:.95}50%{transform:translateY(11px);opacity:.3}}
@keyframes aiShadow{0%,100%{transform:scaleX(1);opacity:.4}50%{transform:scaleX(.78);opacity:.18}}
.aiHot{animation:aiPulse 1.4s cubic-bezier(.45,0,.55,1) infinite;transform-box:fill-box;transform-origin:center}
.aiHotG{animation:aiGlow 1.4s ease-in-out infinite}
`;

// ربط كل تمرين بنمط الحركة الخاص به
const PATTERN_OF = {
  "ضغط بار مستوي": "pressH", "ضغط دمبل مائل علوي": "pressH", "تفتيح كيبل": "fly",
  "تجديف بار منحني": "row", "سحب علوي (عقلة)": "pulldown", "سحب أرضي رومانى (RDL)": "hinge",
  "ضغط كتف بار واقف": "pressV", "رفرفة جانبية دمبل": "latRaise", "فيس بول (كتف خلفي)": "row",
  "دفع كيبل للأسفل": "pushdown", "ضغط بار قبضة ضيقة": "pressH",
  "مرجحة بار": "curl", "مرجحة مطرقة (Hammer)": "curl",
  "سكوات بار خلفي": "squat", "اندفاع أمامي دمبل (Lunges)": "lunge",
  "ثني أرجل خلفي بالآلة": "legCurl", "رفع سمانة واقف": "calf",
  "بلانك (Plank)": "plank", "رفع أرجل معلق": "legRaise",
};
/* ─── فيديوهات الشرح من قناة Jeff Nippard الرسمية (@JeffNippard) ───
   JEFF_YT: معرّفات مقاطع Shorts من قناته. لإضافة تمرين: افتح المقطع على قناته،
   انسخ ما بعد youtube.com/shorts/ والصقه هنا. أي تمرين بلا معرّف يعرض زراً
   يفتح البحث داخل قناته حصراً (لا يمكن أن يُظهر محتوى قناة أخرى). */
const JEFF_CH = "https://www.youtube.com/@JeffNippard";
const JEFF_YT = {
  "ضغط بار مستوي": "hWbUlkb5Ms4", // How To Bench Press With Perfect Technique (5 Steps)
};

/* ─── التشريح العضلي 3D — قناة Muscle and Motion الرسمية ───
   رسوم ثلاثية الأبعاد احترافية تُظهر انقباض الألياف العضلية أثناء التمرين.
   ANATOMY_YT: لإضافة تمرين، افتح فيديو التشريح على قناتهم وانسخ معرّفه هنا
   (ما بعد watch?v= أو shorts/). أي تمرين بلا معرّف يعرض زراً يبحث داخل قناتهم حصراً. */
const ANATOMY_CH = "https://www.youtube.com/channel/UCo0du-IzWuYaVf9QTg10nAQ"; // Muscle and Motion

/* فيديو تشريح 3D احتياطي لكل مجموعة عضلية.
   القيم هنا مؤكّدة يدوياً فقط — تُدار وتُوسَّع من لوحة الإدارة (تبويب فيديوهات 3D)
   التي تختبر التضمين قبل الحفظ، ثم تُخزَّن في جدول جوجل وتُقرأ عبر site.anatomyByGroup. */
const ANATOMY_BY_GROUP = {
  "أرجل": "H5VYU6t_w9o", // Squat — Anatomical Analysis (Muscle and Motion) — مؤكّد قابل للتضمين
};

// فيديو تشريح 3D لتمرين بعينه (أدق من الاحتياطي)
const ANATOMY_YT = {
  "سكوات بار خلفي": "H5VYU6t_w9o",
};
const EN_OF = {
  "ضغط بار مستوي": "barbell bench press",
  "ضغط دمبل مستوي": "dumbbell bench press",
  "ضغط آلة الصدر": "chest press machine",
  "تمرين الضغط الأرضي": "push up",
  "ضغط دمبل مائل علوي": "incline dumbbell press",
  "ضغط بار مائل": "incline barbell press",
  "ضغط علوي بالكيبل": "cable chest press",
  "ضغط مائل بالأشرطة": "resistance band incline press",
  "تفتيح كيبل": "cable fly",
  "تفتيح دمبل مستوي": "dumbbell fly",
  "آلة الفراشة": "pec deck machine fly",
  "تفتيح بأشرطة مقاومة": "resistance band chest fly",
  "تجديف بار منحني": "barbell row",
  "تجديف دمبل بذراع واحدة": "one arm dumbbell row",
  "تجديف كيبل جالس": "seated cable row",
  "تجديف مقلوب بوزن الجسم": "inverted row",
  "سحب علوي (عقلة)": "pull up",
  "سحب أمامي بالكيبل (Lat Pulldown)": "lat pulldown",
  "سحب بآلة مساعدة": "assisted pull up machine",
  "سحب بأشرطة مقاومة": "resistance band lat pulldown",
  "سحب أرضي رومانى (RDL)": "romanian deadlift",
  "سحب رومانى بالدمبل": "dumbbell romanian deadlift",
  "سحب من بين الأرجل بالكيبل": "cable pull through",
  "تمرين الجسر الأرضي": "glute bridge",
  "سحب عقلة قبضة ضيقة": "close grip pull up",
  "ضغط كتف بار واقف": "overhead press",
  "ضغط كتف دمبل جالس": "seated dumbbell shoulder press",
  "ضغط كتف بالآلة": "shoulder press machine",
  "ضغط كتف بالأشرطة": "resistance band shoulder press",
  "رفرفة جانبية دمبل": "dumbbell lateral raise",
  "رفرفة جانبية كيبل": "cable lateral raise",
  "رفرفة جانبية بالآلة": "lateral raise machine",
  "رفرفة بأشرطة مقاومة": "resistance band lateral raise",
  "فيس بول (كتف خلفي)": "face pull",
  "رفرفة خلفية دمبل منحني": "bent over reverse fly",
  "آلة الفراشة العكسية": "reverse pec deck",
  "سحب وجه بالأشرطة": "resistance band face pull",
  "دفع كيبل للأسفل": "tricep pushdown",
  "امتداد خلفي دمبل فوق الرأس": "overhead dumbbell tricep extension",
  "تمرين الغطس على البنش": "bench dips",
  "دفع بأشرطة مقاومة": "resistance band tricep pushdown",
  "ضغط بار قبضة ضيقة": "close grip bench press",
  "ضغط دمبل قبضة محايدة": "neutral grip dumbbell press",
  "غطس متوازي": "parallel bar dips",
  "ضغط ضيق بالآلة": "close grip machine press",
  "مرجحة بار": "barbell curl",
  "مرجحة دمبل بالتبادل": "alternating dumbbell curl",
  "مرجحة كيبل": "cable curl",
  "مرجحة بأشرطة مقاومة": "resistance band curl",
  "مرجحة مطرقة (Hammer)": "hammer curl",
  "مرجحة حبل كيبل": "cable rope hammer curl",
  "مرجحة مطرقة بالأشرطة": "resistance band hammer curl",
  "سكوات بار خلفي": "back squat",
  "سكوات كأس بالدمبل (Goblet)": "goblet squat",
  "دفع أرجل بالآلة (Leg Press)": "leg press",
  "سكوات بوزن الجسم": "bodyweight squat",
  "اندفاع أمامي دمبل (Lunges)": "dumbbell lunges",
  "اندفاع بار خلفي": "barbell lunge",
  "اندفاع بوزن الجسم": "bodyweight lunge",
  "طلوع درج (Step-up)": "step up exercise",
  "ثني أرجل خلفي بالآلة": "leg curl machine",
  "ثني أرجل بأشرطة": "resistance band leg curl",
  "جسر أرضي بساق واحدة": "single leg glute bridge",
  "رفع سمانة واقف": "standing calf raise",
  "رفع سمانة بالدمبل": "dumbbell calf raise",
  "رفع سمانة بوزن الجسم على درجة": "bodyweight calf raise",
  "سمانة على آلة دفع الأرجل": "leg press calf raise",
  "بلانك (Plank)": "plank",
  "بلانك جانبي": "side plank",
  "بلانك بسحب كيبل (Pallof)": "pallof press",
  "بلانك بشريط مقاومة": "resistance band plank",
  "رفع أرجل معلق": "hanging leg raise",
  "رفع أرجل مستلقي": "lying leg raise",
  "طحن كيبل (Cable Crunch)": "cable crunch",
  "طحن بالآلة": "ab crunch machine",
};

const GROUP_PATTERN = { "صدر": "pressH", "ظهر": "row", "أكتاف": "pressV", "ترايسبس": "pushdown", "بايسبس": "curl", "أرجل": "squat", "بطن": "plank" };

// العرض الحركي المولّد للتمرين
function ExerciseAnimation({ pattern, paused, speed }) {
  const anim = (name, vars, origin) => ({
    transformBox: "view-box",
    transformOrigin: origin,
    animationName: name,
    animationDuration: `${2.8 / speed}s`,
    animationTimingFunction: "cubic-bezier(.37,0,.63,1)",
    animationIterationCount: "infinite",
    animationPlayState: paused ? "paused" : "running",
    ...vars,
  });
  const dur = 2.8 / speed;
  const playState = paused ? "paused" : "running";
  const S = { stroke: "#f4f4f5", strokeWidth: 6, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  const B = { stroke: "url(#aiGoldGrad)", strokeWidth: 6.5, strokeLinecap: "round", fill: "none" };
  const Red = ({ x, y, r = 11 }) => (
    <g className="aiHotG" style={{ animationPlayState: paused ? "paused" : "running" }}>
      <g className="aiHot" style={{ animationPlayState: paused ? "paused" : "running" }}>
        <circle cx={x} cy={y} r={r} fill="url(#aiRedGrad)" />
        <circle cx={x} cy={y} r={4} fill="#ef4444" />
      </g>
    </g>
  );

  const bodies = {
    pressH: (
      <>
        <rect x="42" y="104" width="100" height="7" rx="3" fill="#3f3f46" />
        <line x1="52" y1="111" x2="52" y2="127" stroke="#3f3f46" strokeWidth="5" />
        <line x1="132" y1="111" x2="132" y2="127" stroke="#3f3f46" strokeWidth="5" />
        <circle cx="52" cy="96" r="9" {...S} />
        <line x1="63" y1="99" x2="122" y2="99" {...S} />
        <path d="M122 99 L138 103 L146 128" {...S} />
        <line x1="78" y1="99" x2="78" y2="60" {...S} style={anim("aiScaleY", { "--s": 0.55 }, "78px 99px")} />
        <g style={anim("aiSlideY", { "--d": "20px" })}>
          <circle cx="78" cy="58" r="8" {...B} />
          <circle cx="78" cy="58" r="2.5" fill="#d4af6e" />
        </g>
        <Red x={92} y={94} />
      </>
    ),
    pressV: (
      <>
        <line x1="70" y1="132" x2="130" y2="132" stroke="#3f3f46" strokeWidth="4" />
        <line x1="100" y1="105" x2="90" y2="131" {...S} />
        <line x1="100" y1="105" x2="110" y2="131" {...S} />
        <line x1="100" y1="105" x2="100" y2="64" {...S} />
        <circle cx="100" cy="53" r="9" {...S} />
        <line x1="100" y1="68" x2="100" y2="34" {...S} style={anim("aiScaleY", { "--s": 0.35 }, "100px 68px")} />
        <g style={anim("aiSlideY", { "--d": "24px" })}>
          <line x1="78" y1="33" x2="122" y2="33" {...B} />
        </g>
        <Red x={100} y={64} r={10} />
      </>
    ),
    squat: (
      <>
        <line x1="60" y1="132" x2="140" y2="132" stroke="#3f3f46" strokeWidth="4" />
        <g style={anim("aiScaleY", { "--s": 0.8 }, "100px 132px")}>
          <path d="M100 100 L116 114 L108 131" {...S} />
          <path d="M100 100 L90 118 L97 131" {...S} />
          <Red x={108} y={110} />
        </g>
        <g style={anim("aiSlideY", { "--d": "18px" })}>
          <line x1="100" y1="100" x2="100" y2="60" {...S} />
          <circle cx="100" cy="50" r="9" {...S} />
          <line x1="80" y1="66" x2="120" y2="66" {...B} />
          <line x1="100" y1="74" x2="86" y2="66" {...S} strokeWidth={4} />
          <line x1="100" y1="74" x2="114" y2="66" {...S} strokeWidth={4} />
        </g>
      </>
    ),
    hinge: (
      <>
        <line x1="70" y1="131" x2="130" y2="131" stroke="#3f3f46" strokeWidth="4" />
        <line x1="100" y1="100" x2="95" y2="130" {...S} />
        <line x1="100" y1="100" x2="105" y2="130" {...S} />
        <g style={anim("aiRot", { "--r2": "78deg" }, "100px 100px")}>
          <line x1="100" y1="100" x2="100" y2="62" {...S} />
          <circle cx="100" cy="52" r="9" {...S} />
          <line x1="100" y1="70" x2="100" y2="94" {...S} strokeWidth={4} />
          <circle cx="100" cy="97" r="6" {...B} />
        </g>
        <Red x={99} y={113} r={9} />
      </>
    ),
    row: (
      <>
        <line x1="70" y1="131" x2="155" y2="131" stroke="#3f3f46" strokeWidth="4" />
        <line x1="100" y1="102" x2="94" y2="130" {...S} />
        <line x1="100" y1="102" x2="108" y2="130" {...S} />
        <line x1="100" y1="102" x2="136" y2="76" {...S} />
        <circle cx="144" cy="70" r="8.5" {...S} />
        <line x1="122" y1="88" x2="122" y2="112" {...S} strokeWidth={4} style={anim("aiScaleY", { "--s": 0.45 }, "122px 88px")} />
        <g style={anim("aiSlideY", { "--d": "-13px" })}>
          <circle cx="122" cy="116" r="7" {...B} />
        </g>
        <Red x={116} y={84} />
      </>
    ),
    pulldown: (
      <>
        <line x1="100" y1="8" x2="100" y2="20" stroke="#52525b" strokeWidth="3" />
        <rect x="86" y="108" width="28" height="6" rx="2" fill="#3f3f46" />
        <path d="M100 108 L120 112 L120 130" {...S} />
        <line x1="100" y1="108" x2="100" y2="64" {...S} />
        <circle cx="100" cy="54" r="9" {...S} />
        <line x1="100" y1="66" x2="84" y2="40" {...S} strokeWidth={4} style={anim("aiScaleY", { "--s": 0.5 }, "100px 66px")} />
        <line x1="100" y1="66" x2="116" y2="40" {...S} strokeWidth={4} style={anim("aiScaleY", { "--s": 0.5 }, "100px 66px")} />
        <g style={anim("aiSlideY", { "--d": "22px" })}>
          <line x1="76" y1="38" x2="124" y2="38" {...B} />
        </g>
        <Red x={90} y={82} r={8} />
        <Red x={110} y={82} r={8} />
      </>
    ),
    curl: (
      <>
        <line x1="80" y1="131" x2="120" y2="131" stroke="#3f3f46" strokeWidth="4" />
        <line x1="100" y1="102" x2="93" y2="130" {...S} />
        <line x1="100" y1="102" x2="107" y2="130" {...S} />
        <line x1="100" y1="102" x2="100" y2="60" {...S} />
        <circle cx="100" cy="50" r="9" {...S} />
        <line x1="103" y1="66" x2="103" y2="86" {...S} strokeWidth={4} />
        <g style={anim("aiRot", { "--r2": "-110deg" }, "103px 86px")}>
          <line x1="103" y1="86" x2="124" y2="90" {...S} strokeWidth={4} />
          <circle cx="127" cy="90" r="6" {...B} />
        </g>
        <Red x={103} y={74} r={9} />
      </>
    ),
    pushdown: (
      <>
        <line x1="128" y1="8" x2="128" y2="56" stroke="#52525b" strokeWidth="2.5" />
        <line x1="80" y1="131" x2="120" y2="131" stroke="#3f3f46" strokeWidth="4" />
        <line x1="100" y1="102" x2="93" y2="130" {...S} />
        <line x1="100" y1="102" x2="107" y2="130" {...S} />
        <line x1="100" y1="102" x2="100" y2="60" {...S} />
        <circle cx="100" cy="50" r="9" {...S} />
        <line x1="103" y1="66" x2="103" y2="82" {...S} strokeWidth={4} />
        <g style={anim("aiRot", { "--r1": "-55deg", "--r2": "0deg" }, "103px 82px")}>
          <line x1="103" y1="82" x2="126" y2="86" {...S} strokeWidth={4} />
          <line x1="122" y1="80" x2="130" y2="92" {...B} strokeWidth={4} />
        </g>
        <Red x={106} y={74} r={8} />
      </>
    ),
    latRaise: (
      <>
        <line x1="75" y1="131" x2="125" y2="131" stroke="#3f3f46" strokeWidth="4" />
        <line x1="100" y1="100" x2="90" y2="130" {...S} />
        <line x1="100" y1="100" x2="110" y2="130" {...S} />
        <line x1="100" y1="100" x2="100" y2="60" {...S} />
        <circle cx="100" cy="49" r="9" {...S} />
        <g style={anim("aiRot", { "--r1": "72deg", "--r2": "0deg" }, "100px 63px")}>
          <line x1="100" y1="63" x2="132" y2="63" {...S} strokeWidth={4} />
          <circle cx="136" cy="63" r="5.5" {...B} />
        </g>
        <g style={anim("aiRot", { "--r1": "-72deg", "--r2": "0deg" }, "100px 63px")}>
          <line x1="100" y1="63" x2="68" y2="63" {...S} strokeWidth={4} />
          <circle cx="64" cy="63" r="5.5" {...B} />
        </g>
        <Red x={113} y={60} r={8} />
        <Red x={87} y={60} r={8} />
      </>
    ),
    fly: (
      <>
        <line x1="75" y1="131" x2="125" y2="131" stroke="#3f3f46" strokeWidth="4" />
        <line x1="100" y1="100" x2="90" y2="130" {...S} />
        <line x1="100" y1="100" x2="110" y2="130" {...S} />
        <line x1="100" y1="100" x2="100" y2="60" {...S} />
        <circle cx="100" cy="49" r="9" {...S} />
        <g style={anim("aiRot", { "--r2": "55deg" }, "100px 63px")}>
          <line x1="100" y1="63" x2="134" y2="58" {...S} strokeWidth={4} />
          <circle cx="137" cy="58" r="5" {...B} />
        </g>
        <g style={anim("aiRot", { "--r2": "-55deg" }, "100px 63px")}>
          <line x1="100" y1="63" x2="66" y2="58" {...S} strokeWidth={4} />
          <circle cx="63" cy="58" r="5" {...B} />
        </g>
        <Red x={92} y={64} r={8} />
        <Red x={108} y={64} r={8} />
      </>
    ),
    plank: (
      <>
        <line x1="40" y1="122" x2="160" y2="122" stroke="#3f3f46" strokeWidth="4" />
        <g style={anim("aiSlideY", { "--d": "4px" })}>
          <circle cx="52" cy="92" r="8.5" {...S} />
          <line x1="62" y1="96" x2="132" y2="102" {...S} />
          <path d="M132 102 L152 118" {...S} />
          <line x1="70" y1="98" x2="66" y2="120" {...S} strokeWidth={4} />
          <line x1="58" y1="120" x2="80" y2="120" {...S} strokeWidth={4} />
          <Red x={98} y={97} />
        </g>
      </>
    ),
    legRaise: (
      <>
        <line x1="72" y1="16" x2="128" y2="16" stroke="#71717a" strokeWidth="5" strokeLinecap="round" />
        <line x1="90" y1="16" x2="99" y2="43" {...S} strokeWidth={4} />
        <line x1="110" y1="16" x2="101" y2="43" {...S} strokeWidth={4} />
        <circle cx="100" cy="33" r="8" {...S} />
        <line x1="100" y1="43" x2="100" y2="88" {...S} />
        <g style={anim("aiRot", { "--r2": "-85deg" }, "100px 88px")}>
          <line x1="100" y1="88" x2="100" y2="124" {...S} />
        </g>
        <Red x={100} y={78} r={9} />
      </>
    ),
    calf: (
      <>
        <rect x="82" y="124" width="44" height="7" rx="2" fill="#3f3f46" />
        <g style={anim("aiSlideY", { "--d": "-9px" })}>
          <circle cx="100" cy="42" r="9" {...S} />
          <line x1="100" y1="52" x2="100" y2="98" {...S} />
          <line x1="100" y1="98" x2="97" y2="123" {...S} />
          <line x1="100" y1="98" x2="104" y2="123" {...S} />
          <Red x={102} y={112} r={8} />
        </g>
      </>
    ),
    lunge: (
      <>
        <line x1="55" y1="131" x2="145" y2="131" stroke="#3f3f46" strokeWidth="4" />
        <path d="M100 100 L122 112 L122 130" {...S} />
        <path d="M100 100 L84 116 L68 128" {...S} />
        <g style={anim("aiSlideY", { "--d": "14px" })}>
          <line x1="100" y1="100" x2="100" y2="58" {...S} />
          <circle cx="100" cy="48" r="9" {...S} />
          <circle cx="88" cy="92" r="5" {...B} />
          <circle cx="112" cy="92" r="5" {...B} />
        </g>
        <Red x={114} y={108} />
      </>
    ),
    legCurl: (
      <>
        <rect x="48" y="100" width="86" height="7" rx="3" fill="#3f3f46" />
        <line x1="56" y1="107" x2="56" y2="127" stroke="#3f3f46" strokeWidth="5" />
        <line x1="126" y1="107" x2="126" y2="127" stroke="#3f3f46" strokeWidth="5" />
        <circle cx="56" cy="92" r="8.5" {...S} />
        <line x1="66" y1="96" x2="120" y2="96" {...S} />
        <line x1="120" y1="96" x2="142" y2="98" {...S} />
        <g style={anim("aiRot", { "--r2": "-100deg" }, "142px 98px")}>
          <line x1="142" y1="98" x2="162" y2="102" {...S} />
          <circle cx="164" cy="102" r="5.5" {...B} />
        </g>
        <Red x={130} y={91} r={9} />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 200 150" className="relative z-0 w-full h-48 md:h-60">
      <defs>
        <radialGradient id="aiRedGrad">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="aiGoldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ecd19a" />
          <stop offset="55%" stopColor="#d4af6e" />
          <stop offset="100%" stopColor="#a8843f" />
        </linearGradient>
        <filter id="aiSoft" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.7" floodColor="#000000" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* ظل أرضي يتنفس مع الحركة — إحساس بالعمق */}
      <ellipse cx="100" cy="141" rx="44" ry="4.5" fill="#000"
        style={{ animation: `aiShadow ${dur}s ease-in-out infinite`, animationPlayState: playState, transformBox: "view-box", transformOrigin: "100px 141px" }} />

      {/* جسم التمرين مع ظل ناعم */}
      <g filter="url(#aiSoft)">{bodies[pattern] || bodies.pressH}</g>

      {/* مؤشر اتجاه الحركة — أسهم نابضة بإيقاع التكرار */}
      <g style={{ animation: `aiChev ${dur / 2}s ease-in-out infinite`, animationPlayState: playState, transformBox: "view-box", transformOrigin: "17px 66px" }}>
        <path d="M10 58 l7 8 l7 -8" stroke="#d4af6e" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 70 l7 8 l7 -8" stroke="#d4af6e" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      </g>

      {/* تسميات مرحلة الأداء — تتبادل بإيقاع التكرار نفسه */}
      <text x="196" y="14" textAnchor="end" fontSize="9.5" fontWeight="800" fill="#34d399"
        style={{ animation: `aiFadeA ${dur}s linear infinite`, animationPlayState: playState }}>ادفع بقوة مع الزفير ⬆</text>
      <text x="196" y="14" textAnchor="end" fontSize="9.5" fontWeight="800" fill="#fbbf24"
        style={{ animation: `aiFadeB ${dur}s linear infinite`, animationPlayState: playState }}>نزول بطيء متحكم ⬇</text>
      <text x="196" y="147" textAnchor="end" fontSize="8" fontWeight="700" fill="#71717a"
      >الإيقاع الموصى: ٢ ثانية صعود · ٣ ثوانٍ نزول</text>
    </svg>
  );
}

// الخريطة العضلية التشريحية — تضليل أحمر على الزاوية المستهدفة
function MuscleMap({ group }) {
  const hotF = { "صدر": ["pec"], "أكتاف": ["delt"], "بايسبس": ["bic"], "بطن": ["abs"], "أرجل": ["quad"] }[group] || [];
  const hotB = { "ظهر": ["trap", "lat"], "أكتاف": ["delt"], "ترايسبس": ["tri"], "أرجل": ["glute", "ham", "calf"] }[group] || [];

  const M = ({ hot, children }) => (
    <g className={hot ? "aiHot" : ""} fill={hot ? "#ef4444" : "#52525b"} opacity={hot ? 1 : 0.38}>{children}</g>
  );
  const Body = ({ children, label }) => (
    <div className="text-center">
      <svg viewBox="0 0 110 225" className="h-40 md:h-44 mx-auto">
        <circle cx="55" cy="20" r="12" fill="#27272a" stroke="#3f3f46" />
        <rect x="50" y="30" width="10" height="9" fill="#27272a" />
        <path d="M33 40 Q55 33 77 40 L81 118 Q55 127 29 118 Z" fill="#27272a" stroke="#3f3f46" />
        <line x1="30" y1="46" x2="19" y2="104" stroke="#27272a" strokeWidth="12" strokeLinecap="round" />
        <line x1="80" y1="46" x2="91" y2="104" stroke="#27272a" strokeWidth="12" strokeLinecap="round" />
        <line x1="44" y1="122" x2="41" y2="212" stroke="#27272a" strokeWidth="14" strokeLinecap="round" />
        <line x1="66" y1="122" x2="69" y2="212" stroke="#27272a" strokeWidth="14" strokeLinecap="round" />
        {children}
      </svg>
      <p className="text-[10px] text-zinc-500 font-bold mt-1">{label}</p>
    </div>
  );

  return (
    <div className="flex justify-center gap-3">
      <Body label="المنظر الأمامي">
        <M hot={hotF.includes("delt")}><circle cx="29" cy="46" r="7" /><circle cx="81" cy="46" r="7" /></M>
        <M hot={hotF.includes("pec")}><ellipse cx="44" cy="57" rx="10" ry="7" /><ellipse cx="66" cy="57" rx="10" ry="7" /></M>
        <M hot={hotF.includes("bic")}><ellipse cx="25" cy="72" rx="5" ry="10" /><ellipse cx="85" cy="72" rx="5" ry="10" /></M>
        <M hot={hotF.includes("abs")}><rect x="47" y="70" width="16" height="9" rx="3" /><rect x="47" y="81" width="16" height="9" rx="3" /><rect x="47" y="92" width="16" height="9" rx="3" /><rect x="47" y="103" width="16" height="9" rx="3" /></M>
        <M hot={hotF.includes("quad")}><ellipse cx="43" cy="152" rx="7" ry="20" /><ellipse cx="67" cy="152" rx="7" ry="20" /></M>
      </Body>
      <Body label="المنظر الخلفي">
        <M hot={hotB.includes("trap")}><path d="M40 40 L70 40 L55 62 Z" /></M>
        <M hot={hotB.includes("delt")}><circle cx="29" cy="46" r="7" /><circle cx="81" cy="46" r="7" /></M>
        <M hot={hotB.includes("lat")}><ellipse cx="43" cy="80" rx="9" ry="14" /><ellipse cx="67" cy="80" rx="9" ry="14" /></M>
        <M hot={hotB.includes("tri")}><ellipse cx="24" cy="74" rx="5" ry="10" /><ellipse cx="86" cy="74" rx="5" ry="10" /></M>
        <M hot={hotB.includes("glute")}><ellipse cx="46" cy="118" rx="8" ry="8" /><ellipse cx="64" cy="118" rx="8" ry="8" /></M>
        <M hot={hotB.includes("ham")}><ellipse cx="43" cy="155" rx="7" ry="17" /><ellipse cx="67" cy="155" rx="7" ry="17" /></M>
        <M hot={hotB.includes("calf")}><ellipse cx="42" cy="192" rx="6" ry="12" /><ellipse cx="69" cy="192" rx="6" ry="12" /></M>
      </Body>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   7. نافذة التمرين: فيديو الشرح + البدائل
   ═══════════════════════════════════════════════════════════════ */

function ExerciseModal({ ex, onClose, onSwap, equipment }) {
  const [vtab, setVtab] = useState("anatomy");
  const site = useSite();
  useEffect(() => { setVtab("anatomy"); }, [ex]);
  if (!ex) return null;
  const en = EN_OF[ex.name] || ex.name;
  /* الفيديو يُعرض مضمّناً داخل الموقع من مصادر مؤكّدة فقط (معتمدة من لوحة الإدارة/الكود).
     المجموعة التي لا فيديو لها بعد تعرض العرض التوضيحي الحركي المدمج — بلا رسالة خطأ. */
  // فيديو التشريح 3D: تمرين محدّد (جوجل ثم كود) ← احتياطي المجموعة (جوجل ثم كود).
  // كل هذه المصادر مؤكّدة يدوياً من لوحة الإدارة، فلا يظهر "غير متوفر" أبداً.
  const anatomyId = (site.anatomy && site.anatomy[ex.name])
    || ANATOMY_YT[ex.name]
    || (site.anatomyByGroup && site.anatomyByGroup[ex.group])
    || ANATOMY_BY_GROUP[ex.group]
    || null;
  const ytId = (site.videos && site.videos[ex.name]) || JEFF_YT[ex.name] || null;
  const anatomySrc = anatomyId ? `https://www.youtube.com/embed/${anatomyId}?rel=0&modestbranding=1&playsinline=1` : null;
  const realSrc = ytId ? `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1` : null;
  return (
    <Modal open={!!ex} onClose={onClose} wide>
      <div className="p-7">
        <div className="flex items-center gap-3 mb-1">
          <GroupBadge g={ex.group} />
          <span className="text-xs text-zinc-500">المعدات: {ex.eq}</span>
        </div>
        <h3 className="font-black text-2xl mb-4">{ex.name}</h3>

        {/* المشغّل المباشر: التشريح العضلي 3D يعمل فوراً أمام المستخدم */}
        <div className="grid md:grid-cols-3 gap-4 mb-5">
          <div className="md:col-span-2 flex flex-col">
            {(vtab === "anatomy" ? anatomySrc : realSrc) ? (
              <div className="bg-black border border-zinc-700 rounded-2xl overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
                <iframe
                  key={vtab + "-" + ex.name}
                  src={vtab === "anatomy" ? anatomySrc : realSrc}
                  title={vtab === "anatomy" ? `التشريح العضلي 3D — ${ex.name}` : `الأداء الواقعي — ${ex.name}`}
                  style={{ width: "100%", height: "100%", border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              /* لا فيديو مؤكّد بعد لهذه المجموعة — نعرض التوضيح الحركي المدمج بدل رسالة خطأ */
              <div className="relative bg-zinc-950 border border-zinc-700 rounded-2xl overflow-hidden flex flex-col" style={{ aspectRatio: "16 / 9" }}>
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(51,65,85,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,.35) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-zinc-900/90 border border-amber-400/40 text-amber-300 text-[10px] font-black px-2.5 py-1 rounded-full">
                  <Zap size={11} /> عرض توضيحي للحركة
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <ExerciseAnimation pattern={pattern} paused={false} speed={1} />
                </div>
                <p className="relative z-10 text-center text-[10px] text-zinc-500 pb-2">فيديو التشريح 3D لهذه المجموعة قيد الإضافة</p>
              </div>
            )}
            {anatomySrc && realSrc && (
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => setVtab("anatomy")}
                  className={`text-[11px] font-black px-3 py-1.5 rounded-lg border transition-colors ${vtab === "anatomy" ? "bg-amber-400 border-amber-400 text-zinc-950" : "border-zinc-700 text-zinc-400 hover:border-amber-400/50"}`}>
                  🧬 تشريح عضلي 3D
                </button>
                <button onClick={() => setVtab("real")}
                  className={`text-[11px] font-black px-3 py-1.5 rounded-lg border transition-colors ${vtab === "real" ? "bg-amber-400 border-amber-400 text-zinc-950" : "border-zinc-700 text-zinc-400 hover:border-amber-400/50"}`}>
                  🎬 أداء واقعي
                </button>
              </div>
            )}
            {anatomySrc && (
              <p className="text-[10px] text-zinc-600 mt-2">
                🧬 تشريح عضلي ثلاثي الأبعاد — يوضّح العضلات العاملة أثناء الحركة · المصدر: Muscle and Motion عبر مشغّل يوتيوب الرسمي
              </p>
            )}
          </div>
          {/* الخريطة العضلية */}
          <div className="bg-zinc-950 border border-zinc-700 rounded-2xl p-3 flex flex-col justify-center">
            <p className="text-xs font-black text-center mb-2 flex items-center justify-center gap-1.5">
              <Target size={13} className="text-red-500" /> الخريطة العضلية
            </p>
            <MuscleMap group={ex.group} />
            <p className="text-[10px] text-center text-zinc-500 mt-2">
              التضليل الأحمر = <b className="text-red-400">{ex.group}</b> — الزاوية العضلية المستهدفة
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <h4 className="font-bold text-emerald-400 mb-2 flex items-center gap-1.5 text-sm"><Check size={15} /> خطوات الأداء الصحيح</h4>
            <ol className="space-y-1.5 text-sm text-zinc-300">
              {ex.cues.map((c, i) => <li key={i} className="flex gap-2"><span className="text-amber-400 font-black">{i + 1}.</span>{c}</li>)}
            </ol>
          </div>
          <div>
            <h4 className="font-bold text-rose-400 mb-2 flex items-center gap-1.5 text-sm"><AlertTriangle size={15} /> أخطاء شائعة تجنّبها</h4>
            <ul className="space-y-1.5 text-sm text-zinc-400">
              {ex.mistakes.map((m, i) => <li key={i} className="flex gap-2"><X size={14} className="text-rose-500 mt-0.5 shrink-0" />{m}</li>)}
            </ul>
          </div>
        </div>

        {/* التمارين البديلة */}
        <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
          <h4 className="font-bold mb-1 flex items-center gap-2"><RefreshCw size={16} className="text-amber-400" /> تمارين بديلة — نفس الزاوية العضلية</h4>
          <p className="text-xs text-zinc-500 mb-4">إذا كان الجهاز مشغولاً أو غير متوفر، هذه البدائل بنفس الفعالية العلمية.</p>
          <div className="space-y-2">
            {ex.alts.map((a) => {
              const has = equipment.includes(a.eq);
              return (
                <div key={a.name} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm">{a.name}</p>
                    <p className={`text-xs ${has ? "text-emerald-400" : "text-zinc-500"}`}>
                      {a.eq} {has ? "· متوفر لديك ✓" : "· غير متوفر في معداتك"}
                    </p>
                  </div>
                  <button onClick={() => onSwap(a)}
                    className="text-xs font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400 hover:text-zinc-950 px-3 py-1.5 rounded-lg transition-colors">
                    استبدل به
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   8. لوحة التحكم — الخطة الأسبوعية
   ═══════════════════════════════════════════════════════════════ */

function WorkoutPlan({ profile, program, swaps, setSwaps, dayStatus, setDayStatus }) {
  const [week, setWeek] = useState(1);
  const [openEx, setOpenEx] = useState(null);
  const w = OVERLOAD_WEEKS[week - 1];

  const applySwap = (alt) => {
    setSwaps({ ...swaps, [openEx.key]: { name: alt.name, eq: alt.eq } });
    setOpenEx(null);
  };

  return (
    <div className="space-y-6">
      {/* محدد أسبوع الدورة — التدرج في الحمل */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-amber-400" />
          <h3 className="font-black">دورة التدرج في الحمل — Progressive Overload</h3>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {OVERLOAD_WEEKS.map((ow) => (
            <button key={ow.id} onClick={() => setWeek(ow.id)}
              className={`rounded-xl p-3 border-2 text-center transition-all ${week === ow.id ? (ow.id === 4 ? "border-emerald-400 bg-emerald-500/10" : "border-amber-400 bg-amber-400/10") : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"}`}>
              <p className="text-[11px] text-zinc-500">{weekLabel(ow.id - 1)}</p>
              <p className={`font-black text-sm ${week === ow.id ? (ow.id === 4 ? "text-emerald-400" : "text-amber-300") : ""}`}>{ow.label}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
          <span><span className="text-zinc-500">المجموعات:</span> <b className="text-amber-300">{w.sets}</b></span>
          <span><span className="text-zinc-500">التكرارات:</span> <b className="text-amber-300">{w.reps}</b></span>
          <span><span className="text-zinc-500">الشدة:</span> <b className="text-amber-300">{w.intensity}</b></span>
          <span className="text-zinc-400 text-xs">💡 {w.note}</span>
        </div>
      </div>

      {/* أيام الأسبوع */}
      {program.map((day, di) => (
        <div key={di} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-zinc-800 bg-zinc-900/80">
            <div className="flex items-center gap-3">
              <span className="bg-amber-400/15 text-amber-300 font-black rounded-xl px-3 h-10 flex items-center justify-center text-sm whitespace-nowrap">{dayLabel(di)}</span>
              <div>
                <h3 className="font-black">{day.name}</h3>
                <div className="flex gap-1.5 mt-1 flex-wrap">{day.groups.map((g) => <GroupBadge key={g} g={g} />)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDayStatus({ ...dayStatus, [di]: "done" })}
                className={`text-xs font-bold px-3 py-2 rounded-lg border transition-colors ${dayStatus[di] === "done" ? "bg-emerald-500 border-emerald-500 text-zinc-950" : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"}`}>
                <Check size={14} className="inline ml-1" /> أنجزت التمرين
              </button>
              <button onClick={() => setDayStatus({ ...dayStatus, [di]: "skipped" })}
                className={`text-xs font-bold px-3 py-2 rounded-lg border transition-colors ${dayStatus[di] === "skipped" ? "bg-rose-500 border-rose-500 text-zinc-950" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"}`}>
                تخطيت
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                <th className="text-right px-5 py-2.5 font-semibold">التمرين</th>
                <th className="px-3 py-2.5 font-semibold">العضلة</th>
                <th className="px-3 py-2.5 font-semibold">مجموعات × تكرار</th>
                <th className="px-3 py-2.5 font-semibold">شرح</th>
              </tr>
            </thead>
            <tbody>
              {day.exercises.map((ex, ei) => {
                const key = `${di}-${ei}`;
                const swap = swaps[key];
                const shown = swap ? { ...ex, name: swap.name, eq: swap.eq, swapped: true } : ex;
                return (
                  <tr key={key} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30">
                    <td className="px-5 py-3">
                      <p className="font-semibold">{shown.name}</p>
                      <p className="text-xs text-zinc-500">{shown.eq}{shown.swapped && <span className="text-amber-300 mr-2">· بديل مُفعّل ↺</span>}</p>
                      {ex.focus && <p className="text-[10px] text-amber-300 mt-0.5 font-bold">🔥 تركيز إضافي — نقطة ضعف حددتها</p>}
                      {ex.warning && <p className="text-xs text-amber-400 mt-0.5">{ex.warning}</p>}
                    </td>
                    <td className="px-3 py-3 text-center"><GroupBadge g={ex.group} /></td>
                    <td className="px-3 py-3 text-center font-bold text-amber-300 whitespace-nowrap">{w.sets} × {w.reps}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => setOpenEx({ ...ex, key })}
                        className="text-amber-400 hover:text-amber-200 hover:scale-110 transition-all" aria-label="فيديو وشرح التمرين">
                        <PlayCircle size={24} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <ExerciseModal ex={openEx} onClose={() => setOpenEx(null)} onSwap={applySwap} equipment={profile.equipment} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   9. تتبع التقدم (Progress Tracker)
   ═══════════════════════════════════════════════════════════════ */

function Progress({ profile, weightLog, setWeightLog, dayStatus }) {
  const [newW, setNewW] = useState("");
  const [earn, setEarn] = useState(0);
  const [refMsg, setRefMsg] = useState("");
  const refCode = "JAGH-" + (profile.name || "USER").replace(/\s/g, "").toUpperCase().slice(0, 8) + "-" + String(profile.weight || 70).slice(0, 2) + "4";
  const doneCount = Object.values(dayStatus).filter((s) => s === "done").length;
  const bmi = (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1);
  const last = weightLog[weightLog.length - 1]?.weight;
  const diff = (last - weightLog[0].weight).toFixed(1);

  const addWeight = () => {
    if (!newW || newW < 25) return;
    setWeightLog([...weightLog, { week: weekLabel(weightLog.length - 1), weight: parseFloat(newW) }]);
    setNewW("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "الوزن الحالي", v: `${last} كجم`, icon: Activity, c: "text-amber-300" },
          { l: "التغير الكلي", v: `${diff > 0 ? "+" : ""}${diff} كجم`, icon: TrendingUp, c: diff <= 0 ? "text-emerald-400" : "text-sky-400" },
          { l: "مؤشر كتلة الجسم", v: bmi, icon: Target, c: "text-violet-400" },
          { l: "تمارين مكتملة", v: `${doneCount} هذا الأسبوع`, icon: Flame, c: "text-rose-400" },
        ].map((s) => (
          <div key={s.l} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <s.icon size={18} className={`${s.c} mb-2`} />
            <p className="text-xs text-zinc-500">{s.l}</p>
            <p className={`font-black text-lg ${s.c}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="font-black mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-amber-400" /> منحنى الوزن</h3>
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightLog}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="week" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} />
              <Line type="monotone" dataKey="weight" name="الوزن (كجم)" stroke="#d4a955" strokeWidth={3} dot={{ fill: "#d4a955", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-3 mt-4">
          <input type="number" placeholder="سجّل وزن هذا الأسبوع (كجم)" value={newW} onChange={(e) => setNewW(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
          <button onClick={addWeight} className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black px-6 rounded-xl transition-colors">
            تسجيل
          </button>
        </div>
      </div>

      {/* نظام الإحالة — اربح 10% من كل صديق يشترك بكودك */}
      <div className="border-2 border-amber-400/40 rounded-2xl p-5"
        style={{ background: "linear-gradient(135deg, rgba(212,175,110,0.10), rgba(24,24,27,0.6))" }}>
        <div className="flex items-center gap-2 mb-1">
          <Gift size={20} className="text-amber-300" />
          <h3 className="font-black">اربح من دعوة أصدقائك 🎁</h3>
        </div>
        <p className="text-sm text-zinc-400 mb-4">شارك كودك — كل اشتراك جديد عبره يضيف <b className="text-amber-300">عمولة 10%</b> لرصيدك تلقائياً.</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5">
            <span className="font-black text-amber-300 text-sm" dir="ltr">{refCode}</span>
            <button onClick={() => { navigator.clipboard?.writeText(refCode); setRefMsg("تم نسخ الكود ✓"); }}
              className="text-zinc-500 hover:text-amber-300 transition-colors" aria-label="نسخ الكود"><Copy size={15} /></button>
          </div>
          <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm">
            رصيدك: <b className="text-emerald-400">{earn.toFixed(1)}€</b>
          </div>
          <button onClick={() => { setEarn(earn + 2.9); setRefMsg("🎉 صديق اشترك بكودك! أُضيفت عمولة 2.9€"); }}
            className="text-xs font-bold border border-zinc-700 hover:border-amber-400/50 text-zinc-400 hover:text-amber-300 px-3 py-2.5 rounded-xl transition-colors">
            محاكاة اشتراك عبر كودك
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button disabled={earn === 0} onClick={() => { setRefMsg(`تم خصم ${earn.toFixed(1)}€ من اشتراكك القادم ✓`); setEarn(0); }}
            className="text-xs font-black bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 px-4 py-2 rounded-lg transition-colors">
            خصمه من اشتراكي القادم
          </button>
          <button disabled={earn === 0} onClick={() => { setRefMsg(`تم إرسال طلب سحب ${earn.toFixed(1)}€ — يصلك خلال 3 أيام عمل ✓`); setEarn(0); }}
            className="text-xs font-black border border-amber-400/50 text-amber-300 hover:bg-amber-400/10 disabled:opacity-40 px-4 py-2 rounded-lg transition-colors">
            طلب سحب الرصيد
          </button>
        </div>
        {refMsg && <p className="text-xs text-emerald-400 font-bold mt-3">{refMsg}</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   10. مجتمع الأبطال (Community Feed)
   ═══════════════════════════════════════════════════════════════ */

function Community({ profile }) {
  const [posts, setPosts] = useState(SEED_POSTS);
  const [text, setText] = useState("");

  const like = (id) => setPosts(posts.map((p) => p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p));
  const publish = () => {
    if (!text.trim()) return;
    setPosts([{ id: Date.now(), author: profile.name || "أنت", badge: "إنجاز", time: "الآن", likes: 0, liked: false, content: text }, ...posts]);
    setText("");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 flex items-center gap-3">
        <Shield size={20} className="text-amber-300 shrink-0" />
        <p className="text-sm text-zinc-300">مساحة <b>خاصة بالمشتركين فقط</b> — شارك نتائجك قبل وبعد، اطرح أسئلتك، وادعم زملاءك الأبطال. 🏆</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="شارك إنجازك أو اطرح سؤالك على المجتمع..."
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none resize-none" />
        <div className="flex justify-end mt-2">
          <button onClick={publish} className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black px-5 py-2 rounded-xl flex items-center gap-2 transition-colors">
            <Send size={15} /> نشر
          </button>
        </div>
      </div>

      {posts.map((p) => (
        <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-zinc-800 border border-zinc-700 rounded-full w-10 h-10 flex items-center justify-center font-black text-amber-300">{p.author[0]}</div>
              <div>
                <p className="font-bold text-sm">{p.author}</p>
                <p className="text-xs text-zinc-500">{p.time}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${p.badge === "قبل / بعد" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : p.badge === "سؤال" ? "bg-sky-500/10 text-sky-400 border-sky-500/30" : "bg-amber-400/10 text-amber-300 border-amber-400/30"}`}>
              {p.badge}
            </span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed mb-3">{p.content}</p>
          <button onClick={() => like(p.id)} className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${p.liked ? "text-rose-400" : "text-zinc-500 hover:text-rose-400"}`}>
            <Heart size={16} fill={p.liked ? "currentColor" : "none"} /> {p.likes} تشجيع
          </button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   11. التواصل مع المدرب (WhatsApp + حجز مكالمة فيديو)
   ═══════════════════════════════════════════════════════════════ */

function Coach({ profile }) {
  const [booking, setBooking] = useState(false);
  const [slot, setSlot] = useState(null);
  const [booked, setBooked] = useState(null);
  const waLink = `https://wa.me/${COACH_WHATSAPP}?text=${encodeURIComponent(`مرحباً كابتن، أنا ${profile.name || "مشترك"} من منصة Jaghman Coaching وعندي استفسار عن برنامجي 💪`)}`;
  const slots = ["السبت 6:00 م", "الأحد 8:00 م", "الثلاثاء 7:00 م", "الخميس 9:00 م"];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-gradient-to-l from-emerald-500/15 to-zinc-900 border border-emerald-500/30 rounded-3xl p-7 text-center">
        <div className="bg-emerald-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <MessageCircle size={30} className="text-emerald-400" />
        </div>
        <h3 className="font-black text-xl mb-2">متابعتك الشخصية — مرتان أسبوعياً</h3>
        <p className="text-zinc-400 text-sm mb-5 leading-relaxed">
          اشتراكك Premium يشمل <b className="text-amber-300">جلستي متابعة أسبوعياً</b> بالطريقة التي تناسبك:
          مكالمة فيديو، مكالمة صوتية، أو رسائل — ومدربك متاح للرد على استفساراتك عبر واتساب <b className="text-emerald-400">في أي وقت</b>.
        </p>
        <a href={waLink} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black px-8 py-3.5 rounded-2xl transition-all hover:scale-105">
          <MessageCircle size={20} /> افتح محادثة واتساب الآن
        </a>
        <p className="text-xs text-zinc-600 mt-3" dir="ltr">+31 6 4599 5782</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-7">
        <div className="flex items-center gap-3 mb-2">
          <Video size={22} className="text-amber-400" />
          <h3 className="font-black text-lg">مكالمة فيديو للمتابعة الدورية</h3>
        </div>
        <p className="text-zinc-400 text-sm mb-5">جلسة مباشرة لمراجعة أدائك الفني، تعديل برنامجك، والإجابة على أسئلتك وجهاً لوجه.</p>
        {booked ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center">
            <Check size={26} className="text-emerald-400 mx-auto mb-2" />
            <p className="font-bold">تم حجز مكالمتك: <span className="text-emerald-400">{booked}</span></p>
            <p className="text-xs text-zinc-500 mt-1">سيصلك رابط المكالمة على واتساب قبل الموعد بساعة.</p>
          </div>
        ) : (
          <button onClick={() => setBooking(true)}
            className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            <Calendar size={18} /> احجز موعد المكالمة
          </button>
        )}
      </div>

      <Modal open={booking} onClose={() => setBooking(false)}>
        <div className="p-7">
          <h3 className="font-black text-xl mb-1">اختر الموعد المناسب 📅</h3>
          <p className="text-zinc-400 text-sm mb-5">المواعيد بتوقيتك المحلي — مدة الجلسة 30 دقيقة.</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {slots.map((s) => (
              <button key={s} onClick={() => setSlot(s)}
                className={`py-3.5 rounded-xl border-2 font-bold text-sm ${slot === s ? "border-amber-400 bg-amber-400/10 text-amber-300" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"}`}>
                <Clock size={14} className="inline ml-1.5" />{s}
              </button>
            ))}
          </div>
          <button disabled={!slot} onClick={() => { setBooked(slot); setBooking(false); }}
            className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-black py-3.5 rounded-xl transition-colors">
            تأكيد الحجز
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   11.5 نموذج Freemium: المكتبة المجانية + بوابة الدفع + الدخول + التغذية
   ═══════════════════════════════════════════════════════════════ */

// بوابة الدفع (Paywall) — تظهر عند طلب أي ميزة تخصيص
function Paywall({ open, feature, onClose, onSubscribe, onLogin }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-7 text-center">
        <img src={JAGHMAN_LOGO} alt="Jaghman Coaching" className="w-44 mx-auto mb-2" />
        <h3 className="font-black text-xl mb-2">{feature} — ميزة المشتركين 👑</h3>
        <p className="text-zinc-400 text-sm mb-5 leading-relaxed">
          البرامج الجاهزة ستبقى مجانية دائماً. أما التخصيص على جسمك أنت فيبدأ من <b className="text-amber-300">10€ فقط</b>:
        </p>
        <div className="text-right space-y-2 mb-6">
          {[
            "تحليل بياناتك وحساب سعراتك بدقة (TDEE)",
            "برنامج غذائي مخصص لهدفك مع تبديل الوجبات",
            "جدول تمرين يركّز على نقاط ضعفك العضلية",
            "أوزان متدرجة تلقائياً بمبدأ التدرج في الحمل",
          ].map((b) => (
            <p key={b} className="flex items-start gap-2 text-sm text-zinc-300">
              <Check size={15} className="text-amber-300 mt-0.5 shrink-0" /> {b}
            </p>
          ))}
        </div>
        <button onClick={onSubscribe}
          className="w-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black py-3.5 rounded-2xl transition-all hover:scale-[1.02]">
          🚀 ابدأ التخصيص — دقيقتان فقط
        </button>
        <button onClick={onLogin} className="text-xs text-zinc-500 hover:text-white mt-3 font-bold transition-colors">
          لديك اشتراك بالفعل؟ سجّل الدخول
        </button>
      </div>
    </Modal>
  );
}

/* المكتبة المجانية (Public Library)
   ملاحظة تقنية للنشر: في Next.js تُقدَّم هذه الصفحات عبر SSG (generateStaticParams)
   مع وسوم <meta> وبيانات schema.org (ExercisePlan/HowTo) لأرشفة كل برنامج وتمرين في جوجل. */
function FreeLibrary({ onBack, onSubscribe, onLogin }) {
  const [active, setActive] = useState(null);
  const [openEx, setOpenEx] = useState(null);
  const [paywall, setPaywall] = useState(null);
  const program = useMemo(() => (active ? buildFreeProgram(active.days) : null), [active]);

  const Cta = () => (
    <div className="bg-gradient-to-l from-amber-400/15 to-zinc-900 border-2 border-amber-400/40 rounded-3xl p-7 text-center mt-8">
      <h3 className="font-black text-xl mb-2">تعرف الآن "ماذا تتمرن"… لكن هل تعرف "كيف تتقدم"؟ 🤔</h3>
      <p className="text-zinc-400 text-sm max-w-xl mx-auto leading-relaxed mb-5">
        النظام الجاهز نقطة بداية ممتازة — لكن الأوزان المناسبة لك، وسعراتك اليومية، ووجباتك، ونقاط ضعفك… كلها تحتاج تخصيصاً على جسمك أنت. هذا بالضبط ما يفعله اشتراكك.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button onClick={() => setPaywall("البرنامج المخصص")}
          className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black px-7 py-3.5 rounded-2xl transition-all hover:scale-105">
          🚀 توليد برنامج خاص بي
        </button>
        <button onClick={() => setPaywall("الخطة الغذائية المخصصة")}
          className="border-2 border-amber-400/50 hover:bg-amber-400/10 text-amber-300 font-black px-7 py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2">
          <Utensils size={18} /> تصميم خطة غذائية
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-16">
      <nav className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={active ? () => setActive(null) : onBack}
            className="flex items-center gap-1 text-sm font-bold text-zinc-400 hover:text-white transition-colors">
            <ChevronRight size={16} /> {active ? "كل البرامج" : "الرئيسية"}
          </button>
          <Logo size={28} />
          <button onClick={onLogin} className="text-xs font-bold text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors">
            دخول المشتركين
          </button>
        </div>
      </nav>

      {!active ? (
        <>
          <header className="text-center max-w-3xl mx-auto px-6 pt-12 pb-10">
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black px-3 py-1.5 rounded-full mb-4">
              <BookOpen size={13} /> مجاني 100% — بدون تسجيل
            </span>
            <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">مكتبة برامج التدريب المجانية</h1>
            <p className="text-zinc-400 leading-relaxed">
              أنظمة تدريب مثبتة علمياً يستخدمها ملايين المتدربين حول العالم.
              تصفح الجدول الأسبوعي كاملاً، وشاهد الشرح الحركي لكل تمرين — ثم قرر بنفسك إن كان أسلوبنا يستحق.
            </p>
          </header>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto px-4">
            {FREE_PROGRAMS.map((fp) => (
              <article key={fp.id} className="bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 rounded-3xl p-6 flex flex-col transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2.5 py-1 rounded-full">مجاني 100%</span>
                  <span className="text-[10px] text-zinc-500 font-bold">{fp.level}</span>
                </div>
                <h2 className="font-black text-xl" dir="ltr" style={{ textAlign: "right" }}>{fp.name}</h2>
                <p className="text-amber-300 text-sm font-bold mb-3">نظام {fp.ar} · {fp.days} أيام أسبوعياً</p>
                <p className="text-sm text-zinc-400 leading-relaxed flex-1">{fp.desc}</p>
                <p className="text-xs text-emerald-400/90 font-semibold mt-3 mb-4">✓ {fp.best}</p>
                <button onClick={() => setActive(fp)}
                  className="bg-zinc-800 hover:bg-amber-400 hover:text-zinc-950 text-white font-black py-3 rounded-xl transition-colors">
                  عرض الجدول الكامل + الفيديوهات
                </button>
              </article>
            ))}
          </div>
          <div className="max-w-5xl mx-auto px-4"><Cta /></div>
        </>
      ) : (
        <main className="max-w-5xl mx-auto px-4 pt-8">
          <article>
            <header className="mb-6">
              <h1 className="text-3xl font-black" dir="ltr" style={{ textAlign: "right" }}>{active.name}</h1>
              <p className="text-amber-300 font-bold mt-1">نظام {active.ar} · {active.days} أيام أسبوعياً · {active.level}</p>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed max-w-2xl">{active.desc}</p>
              <p className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mt-4 inline-block leading-relaxed">
                💡 توصية عامة: 3–4 مجموعات × 8–12 تكراراً، راحة 60–90 ثانية.
                أما الأوزان والتدرج المناسبان <b className="text-amber-300">لجسمك أنت</b> فهذا ما يحسبه الاشتراك المخصص.
              </p>
            </header>
            {program.map((day, di) => (
              <div key={di} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-5">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
                  <span className="bg-amber-400/15 text-amber-300 font-black rounded-xl px-3 h-10 flex items-center justify-center text-sm whitespace-nowrap">{dayLabel(di)}</span>
                  <div>
                    <h3 className="font-black">{day.name}</h3>
                    <div className="flex gap-1.5 mt-1 flex-wrap">{day.groups.map((g) => <GroupBadge key={g} g={g} />)}</div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                      <th className="text-right px-5 py-2.5 font-semibold">التمرين</th>
                      <th className="px-3 py-2.5 font-semibold">العضلة</th>
                      <th className="px-3 py-2.5 font-semibold">مجموعات × تكرار</th>
                      <th className="px-3 py-2.5 font-semibold">شرح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.exercises.map((ex, ei) => (
                      <tr key={ei} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30">
                        <td className="px-5 py-3">
                          <p className="font-semibold">{ex.name}</p>
                          <p className="text-xs text-zinc-500">{ex.eq}</p>
                        </td>
                        <td className="px-3 py-3 text-center"><GroupBadge g={ex.group} /></td>
                        <td className="px-3 py-3 text-center font-bold text-amber-300 whitespace-nowrap">3–4 × 8–12</td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => setOpenEx(ex)}
                            className="text-amber-400 hover:text-amber-200 hover:scale-110 transition-all" aria-label="فيديو وشرح التمرين">
                            <PlayCircle size={24} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </article>
          <Cta />
        </main>
      )}

      {/* فيديو الشرح متاح مجاناً — لكن الاستبدال المخصص يفتح بوابة الدفع */}
      <ExerciseModal ex={openEx} onClose={() => setOpenEx(null)} equipment={EQUIPMENT}
        onSwap={() => { setOpenEx(null); setPaywall("تخصيص البدائل حسب معداتك"); }} />
      <Paywall open={!!paywall} feature={paywall} onClose={() => setPaywall(null)} onSubscribe={onSubscribe} onLogin={onLogin} />
    </div>
  );
}

// تسجيل دخول المشتركين — لوحة التحكم خلف بوابة آمنة
function Login({ onBack, onLogin }) {
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // {type, text}

  const doLogin = async () => {
    if (!username.trim() || !pass) return;
    setLoading(true); setMsg(null);
    const res = await loginAccount(username.trim(), pass);
    setLoading(false);
    if (res.ok) {
      onLogin({ name: res.name, plan: res.plan, tier: res.tier, goal: res.goal, username: username.trim() });
    } else if (res.error === "pending") {
      setMsg({ type: "warn", text: `مرحباً ${res.name || ""} — حسابك بانتظار تأكيد الدفع. تواصل مع المدرب لتفعيله.` });
    } else if (res.error === "wrong_password") {
      setMsg({ type: "err", text: "كلمة المرور غير صحيحة" });
    } else if (res.error === "not_found") {
      setMsg({ type: "err", text: "اسم المستخدم غير موجود" });
    } else if (res.error === "demo") {
      setMsg({ type: "warn", text: "تسجيل الدخول يعمل بعد ربط الموقع بجدول جوجل ونشره." });
    } else {
      setMsg({ type: "err", text: "تعذّر تسجيل الدخول، حاول مجدداً" });
    }
  };

  // دخول بنقرة واحدة عبر حساب Google — بلا كتابة
  const viaGoogle = async ({ email, name }) => {
    setLoading(true); setMsg(null);
    const res = await googleLogin(email, name);
    setLoading(false);
    if (res.ok) {
      onLogin({ name: res.name || name, plan: res.plan, tier: res.tier, goal: res.goal, username: res.username || email, email });
    } else if (res.error === "pending") {
      setMsg({ type: "warn", text: `مرحباً ${name} — حسابك بانتظار تأكيد الدفع. تواصل مع المدرب لتفعيله.` });
    } else if (res.error === "not_found") {
      setMsg({ type: "warn", text: "لا يوجد اشتراك مرتبط ببريدك بعد — اختر باقة من الرئيسية وسننشئ حسابك بنقرة واحدة." });
    } else {
      setMsg({ type: "warn", text: "دخول Google يُفعّل بعد ضبط GOOGLE_CLIENT_ID في sheetData.js ونشر الموقع." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <button onClick={onBack}
        className="absolute top-5 right-5 flex items-center gap-1 text-sm font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-600 px-4 py-2 rounded-xl transition-colors">
        <ChevronRight size={16} /> رجوع
      </button>
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <img src={JAGHMAN_LOGO} alt="Jaghman Coaching" className="w-48 mx-auto mb-4" />
        <h2 className="text-2xl font-black mb-1">دخول المشتركين 🔐</h2>
        <p className="text-zinc-400 text-sm mb-5">ادخل بنقرة واحدة بحساب Google — أو باسم المستخدم وكلمة المرور.</p>
        <GoogleButton onCred={viaGoogle} />
        {GOOGLE_CLIENT_ID && (
          <div className="flex items-center gap-3 my-4">
            <div className="h-px bg-zinc-800 flex-1" />
            <span className="text-[11px] text-zinc-600 font-bold">أو يدوياً</span>
            <div className="h-px bg-zinc-800 flex-1" />
          </div>
        )}
        <div className="space-y-3">
          <input placeholder="اسم المستخدم" dir="ltr" value={username}
            onChange={(e) => { setUsername(e.target.value.replace(/\s/g, "")); setMsg(null); }}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
          <input type="password" placeholder="كلمة المرور" dir="ltr" value={pass}
            onChange={(e) => { setPass(e.target.value); setMsg(null); }}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
        </div>
        {msg && (
          <p className={`text-xs font-bold mt-3 text-center leading-relaxed ${msg.type === "err" ? "text-rose-400" : "text-amber-300"}`}>
            {msg.text}
          </p>
        )}
        <button disabled={!username || !pass || loading} onClick={doLogin}
          className="w-full mt-5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-black py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
          {loading ? <><RefreshCw size={18} className="animate-spin" /> جارٍ التحقق...</> : "دخول"}
        </button>
        <p className="text-[11px] text-zinc-600 mt-4 text-center">
          ليس لديك حساب؟ اختر باقة من الصفحة الرئيسية لإنشاء حسابك.
        </p>
      </div>
    </div>
  );
}

/* سجلّ السعرات اليومي — يُحفظ فوراً على الجهاز ويُزامَن مع قاعدة البيانات (جدول جوجل)
   بمجرد تسجيل الدخول من أي جهاز، يجد المشترك سجلّه كاملاً */
const DAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalorieTracker({ profile, target, quickMeals }) {
  const userKey = String(profile.username || profile.email || profile.name || "guest").trim();
  const LS_KEY = "jg_cal_" + userKey;
  const todayISO = isoOf(new Date());
  const [items, setItems] = useState([]);
  const [cloud, setCloud] = useState(false);
  const [nm, setNm] = useState("");
  const [kc, setKc] = useState("");
  const [flash, setFlash] = useState("");

  // تحميل: من هذا الجهاز فوراً، ثم دمج سجلّ قاعدة البيانات إن توفّر الاتصال
  useEffect(() => {
    let local = [];
    try { local = JSON.parse(window.localStorage.getItem(LS_KEY) || "[]"); } catch {}
    setItems(local);
    getCalories(userKey).then((res) => {
      if (res && res.ok && Array.isArray(res.items)) {
        setCloud(true);
        setItems((cur) => {
          const seen = new Set(cur.map((x) => String(x.id)));
          const merged = [...cur, ...res.items.filter((x) => x && !seen.has(String(x.id)))];
          try { window.localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch {}
          return merged;
        });
      }
    }).catch(() => {});
  }, [LS_KEY]);

  const persist = (next) => {
    setItems(next);
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
  };

  const addEntry = (name, kcal) => {
    const k = Math.round(+kcal);
    if (!String(name).trim() || !k || k < 1) return;
    const entry = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 6), d: todayISO, n: String(name).trim(), k };
    persist([...items, entry]);
    setFlash(`سُجّلت «${entry.n}» — ${k} سعرة ✓`);
    setNm(""); setKc("");
    logCalories(userKey, entry).then((r) => { if (r && r.ok && !r.local) setCloud(true); }).catch(() => {});
  };

  const today = items.filter((x) => x.d === todayISO);
  const totToday = today.reduce((t, x) => t + (+x.k || 0), 0);
  const pct = Math.min(100, Math.round((totToday / target) * 100));
  const remain = target - totToday;

  // ملخص آخر 7 أيام للرسم البياني
  const week = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const iso = isoOf(d);
    return { name: DAY_AR[d.getDay()], kcal: items.filter((x) => x.d === iso).reduce((t, x) => t + (+x.k || 0), 0) };
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h3 className="font-black flex items-center gap-2"><Flame size={18} className="text-amber-400" /> سجلّ سعراتك اليومي</h3>
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${cloud ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
          {cloud ? "☁️ محفوظ في حسابك — يظهر عند دخولك من أي جهاز" : "💾 محفوظ على هذا الجهاز"}
        </span>
      </div>
      <p className="text-xs text-zinc-500 mb-4">سجّل ما تأكله أولاً بأول — نقارنه بهدفك اليومي ونرسم التزامك أسبوعياً.</p>

      {/* عداد اليوم مقابل الهدف */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-4">
        <div className="flex items-end justify-between mb-2 flex-wrap gap-2">
          <p className="text-sm"><b className={`text-2xl font-black ${totToday > target ? "text-rose-400" : "text-amber-300"}`}>{totToday}</b><span className="text-zinc-500"> / {target} سعرة اليوم</span></p>
          <p className={`text-xs font-bold ${remain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {remain >= 0 ? `متبقٍ لك ${remain} سعرة 👌` : `تجاوزت هدفك بـ ${Math.abs(remain)} سعرة ⚠️`}
          </p>
        </div>
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${totToday > target ? "bg-rose-500" : "bg-gradient-to-l from-amber-400 to-amber-300"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* تسجيل سريع للوجبات المقترحة */}
      <p className="text-xs font-bold text-zinc-400 mb-2">تسجيل سريع — وجبات خطتك:</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {quickMeals.map((q) => (
          <button key={q.t} onClick={() => addEntry(q.t + " (من خطتي)", q.k)}
            className="text-xs font-bold bg-zinc-950 border border-zinc-700 hover:border-amber-400/60 hover:text-amber-300 text-zinc-300 px-3 py-2 rounded-xl transition-colors">
            ＋ {q.t} · {q.k} سعرة
          </button>
        ))}
      </div>

      {/* إدخال يدوي */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="ماذا أكلت؟ (مثال: شاورما دجاج)"
          className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
        <input type="number" value={kc} onChange={(e) => setKc(e.target.value)} placeholder="السعرات" dir="ltr"
          onKeyDown={(e) => e.key === "Enter" && addEntry(nm, kc)}
          className="sm:w-32 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
        <button onClick={() => addEntry(nm, kc)} disabled={!nm.trim() || !kc}
          className="bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-black px-6 py-3 rounded-xl transition-colors">تسجيل</button>
      </div>
      {flash && <p className="text-xs text-emerald-400 font-bold mt-2">{flash}</p>}

      {/* قائمة اليوم */}
      {today.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {today.map((x) => (
            <div key={x.id} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm">
              <span className="font-semibold">{x.n}</span>
              <span className="flex items-center gap-3">
                <b className="text-amber-300 whitespace-nowrap">{x.k} سعرة</b>
                <button onClick={() => persist(items.filter((y) => y.id !== x.id))}
                  className="text-zinc-600 hover:text-rose-400 transition-colors" aria-label="حذف"><X size={15} /></button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* رسم آخر 7 أيام */}
      <div className="mt-5">
        <p className="text-xs font-bold text-zinc-400 mb-2">آخر 7 أيام:</p>
        <div className="h-40" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={week}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} width={38} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} formatter={(v) => [`${v} سعرة`, "المسجّل"]} />
              <Bar dataKey="kcal" name="سعرات" fill="#d4a955" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// محرك التغذية: تحليل البيانات وحساب TDEE + خطة وجبات قابلة للتبديل
function Nutrition({ profile }) {
  const [choice, setChoice] = useState({});
  const w = +profile.weight, h = +profile.height, a = +profile.age;
  const bf = parseFloat(profile.bodyfat);
  const hasBf = !isNaN(bf) && bf > 3 && bf < 60;
  const male = profile.gender !== "أنثى";
  // BMR: معادلة Katch-McArdle إذا توفرت نسبة الدهون (أدق)، وإلا Mifflin-St Jeor
  const bmr = hasBf
    ? Math.round(370 + 21.6 * (w * (1 - bf / 100)))
    : Math.round(10 * w + 6.25 * h - 5 * a + (male ? 5 : -161));
  const act = 1.2 + profile.days * 0.0833; // معامل النشاط حسب أيام التمرين
  const tdee = Math.round(bmr * act);
  const adj = { fat: -0.2, muscle: 0.1, strength: 0.05, fitness: 0 }[profile.goal] ?? 0;
  const target = Math.round(tdee * (1 + adj));
  const protein = Math.round(w * 2);
  const fatG = Math.round((target * 0.25) / 9);
  const carbs = Math.max(0, Math.round((target - protein * 4 - fatG * 9) / 4));
  const goalWord = profile.goal === "fat" ? "تنشيف" : profile.goal === "muscle" ? "تضخيم" : "أداء واستشفاء";

  return (
    <div className="space-y-5">
      {/* تحليل البيانات */}
      <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 text-sm text-zinc-300 leading-relaxed">
        🧠 حللنا بياناتك: <b className="text-white">{w} كجم · {h} سم · {a} سنة</b>
        {hasBf ? <> · <b className="text-white">{bf}% دهون</b> (معادلة Katch-McArdle الأدق)</> : <> (معادلة Mifflin-St Jeor — أضف نسبة دهونك لدقة أعلى)</>}
        {" "}· {profile.days} أيام تمرين. هدفك <b className="text-amber-300">{goalWord}</b>،
        {adj < 0 ? ` لذا وضعنا عجزاً ${Math.round(Math.abs(adj) * 100)}% تحت احتياجك اليومي.` : adj > 0 ? ` لذا أضفنا فائضاً ${Math.round(adj * 100)}% فوق احتياجك اليومي.` : " لذا ثبّتنا سعراتك عند احتياجك اليومي."}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "الأيض الأساسي BMR", v: `${bmr} سعرة`, icon: Activity, c: "text-sky-400" },
          { l: "احتياجك اليومي TDEE", v: `${tdee} سعرة`, icon: Flame, c: "text-amber-300" },
          { l: `هدفك اليومي (${goalWord})`, v: `${target} سعرة`, icon: Target, c: adj < 0 ? "text-emerald-400" : "text-rose-400" },
          { l: "بروتينك اليومي", v: `${protein} جم`, icon: Zap, c: "text-violet-400" },
        ].map((st) => (
          <div key={st.l} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <st.icon size={18} className={`${st.c} mb-2`} />
            <p className="text-xs text-zinc-500">{st.l}</p>
            <p className={`font-black text-lg ${st.c}`}>{st.v}</p>
          </div>
        ))}
      </div>

      {/* الماكروز */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="font-black mb-4 flex items-center gap-2"><Target size={18} className="text-amber-400" /> توزيع الماكروز اليومي</h3>
        {[
          { l: "بروتين", g: protein, kcal: protein * 4, c: "bg-rose-500", tc: "text-rose-400" },
          { l: "كربوهيدرات", g: carbs, kcal: carbs * 4, c: "bg-sky-500", tc: "text-sky-400" },
          { l: "دهون", g: fatG, kcal: fatG * 9, c: "bg-amber-500", tc: "text-amber-400" },
        ].map((m) => (
          <div key={m.l} className="mb-3 last:mb-0">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-bold">{m.l}</span>
              <span className={`font-black ${m.tc}`}>{m.g} جم · {m.kcal} سعرة</span>
            </div>
            <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full ${m.c} rounded-full`} style={{ width: `${Math.min(100, (m.kcal / target) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* خطة الوجبات مع التبديل — كميات مضبوطة على سعرات المشترك */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h3 className="font-black flex items-center gap-2"><Utensils size={18} className="text-amber-400" /> خطتك الغذائية — {goalWord}</h3>
          <span className="text-xs text-zinc-500">🔄 3 خيارات لكل وجبة</span>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          الكميات أدناه <b className="text-amber-300">محسوبة على سعراتك أنت</b> ({target} سعرة) — بدّل أي وجبة، فكل البدائل بنفس التوزيع الغذائي تقريباً.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {MEALS.map((meal) => {
            const mealKcal = Math.round(target * meal.share);
            const idx = choice[meal.id] || 0;
            const op = meal.options[idx];
            const f = Math.min(1.7, Math.max(0.55, mealKcal / op.kcal));
            const mp = Math.round(op.p * f), mc = Math.round(op.c * f), mf = Math.round(op.f * f);
            return (
              <div key={meal.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-sm">{meal.title}</p>
                  <span className="text-xs font-bold text-amber-300">≈ {mealKcal} سعرة</span>
                </div>
                <ul className="space-y-1 mb-2">
                  {op.items.map((it) => {
                    const a = scaleAmt(it, f);
                    return (
                      <li key={it.n} className="text-sm text-zinc-200 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 shrink-0" />
                        <b className="text-amber-200 whitespace-nowrap" dir="ltr">{a.v}{a.u === "جم" || a.u === "مل" ? a.u : ` ${a.u}`}</b>
                        <span>{it.n}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  <span className="text-[10px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded-full">بروتين {mp}جم</span>
                  <span className="text-[10px] font-black bg-sky-500/10 text-sky-400 border border-sky-500/25 px-2 py-0.5 rounded-full">كربوهيدرات {mc}جم</span>
                  <span className="text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full">دهون {mf}جم</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">{op.tag}</p>
                <button onClick={() => setChoice({ ...choice, [meal.id]: (idx + 1) % meal.options.length })}
                  className="mt-3 text-xs font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400 hover:text-zinc-950 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 self-start">
                  <RefreshCw size={12} /> بدّل الوجبة ({idx + 1}/{meal.options.length})
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-600 mt-4">
          ⚕️ هذه الخطة إرشادية عامة مبنية على معادلات علمية — إن كانت لديك حالة صحية أو حساسية غذائية فاستشر مختص تغذية.
        </p>
      </div>

      {/* سجلّ السعرات اليومي — يُحفظ في حساب المشترك */}
      <CalorieTracker profile={profile} target={target}
        quickMeals={MEALS.map((meal) => ({ t: meal.title, k: Math.round(target * meal.share) }))} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   11.7 سوق المدربين (Multi-Coach Marketplace)
   ═══════════════════════════════════════════════════════════════ */

// اختر مدربك: شبكة المدربين المعتمدين → بروفايل → تقييم موثّق
function CoachesHub({ onBack, onSubscribe, onJoin, isSubscriber, userName }) {
  const [coaches, setCoaches] = useState(COACHES_SEED);
  const [activeId, setActiveId] = useState(null);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const c = coaches.find((x) => x.id === activeId);

  const submitReview = () => {
    if (!stars || !text.trim()) return;
    setCoaches(coaches.map((x) => x.id === activeId
      ? { ...x, reviews: [{ a: userName || "مشترك", st: stars, t: text, d: "الآن" }, ...x.reviews] } : x));
    saveReview({ coach: c.name, author: userName || "مشترك", stars, text }); // حفظ في جوجل شيت
    setStars(0); setText("");
  };

  const Avatar = ({ co, size = "w-16 h-16 text-2xl" }) => (
    <div className={`${size} rounded-2xl flex items-center justify-center font-black text-zinc-950 shrink-0`}
      style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DEEP})` }}>
      {co.name.replace("كابتن ", "")[0]}
    </div>
  );

  return (
    <div className="min-h-screen pb-16">
      <nav className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={c ? () => setActiveId(null) : onBack}
            className="flex items-center gap-1 text-sm font-bold text-zinc-400 hover:text-white transition-colors">
            <ChevronRight size={16} /> {c ? "كل المدربين" : "الرئيسية"}
          </button>
          <Logo size={28} />
          <button onClick={onJoin} className="text-xs font-bold text-amber-300 hover:text-amber-200 border border-amber-400/40 px-3 py-1.5 rounded-lg transition-colors">
            انضم كمدرب 🤝
          </button>
        </div>
      </nav>

      {!c ? (
        <>
          <header className="text-center max-w-2xl mx-auto px-6 pt-12 pb-8">
            <h1 className="text-3xl md:text-4xl font-black mb-3">اختر مدربك ⭐</h1>
            <p className="text-zinc-400 leading-relaxed text-sm">
              كل مدرب هنا اجتاز مراجعة شخصية من <b className="text-amber-300">المشرف العام (كابتن جغمان)</b> لسيرته وخبرته —
              والتقييمات من عملاء حقيقيين أكملوا اشتراكاتهم.
            </p>
          </header>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto px-4">
            {coaches.map((co) => {
              const avg = coachAvg(co.reviews);
              return (
                <button key={co.id} onClick={() => setActiveId(co.id)}
                  className="text-right bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 rounded-3xl p-5 transition-colors group">
                  <div className="flex justify-center mb-3"><Avatar co={co} size="w-20 h-20 text-3xl" /></div>
                  {co.lead && (
                    <p className="text-center mb-1"><span className="text-[10px] font-black bg-amber-400/15 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full">👑 المشرف العام</span></p>
                  )}
                  <p className="font-black text-center">{co.name}</p>
                  <p className="text-xs text-amber-300 text-center font-bold mt-0.5 mb-2">{co.specialty}</p>
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Stars value={avg} /> <span className="text-xs text-zinc-500 font-bold">{avg.toFixed(1)} ({co.reviews.length})</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 text-center">{co.years} سنوات خبرة · {co.clients}+ متدرب</p>
                  <p className="text-xs font-bold text-zinc-500 group-hover:text-amber-300 text-center mt-3 transition-colors">عرض البروفايل ←</p>
                </button>
              );
            })}
          </div>
          <p className="text-center text-xs text-zinc-600 mt-8 px-4">
            💳 كل المدفوعات تتم عبر المنصة — ضمان جودة، واسترداد خلال 7 أيام إن لم تبدأ المتابعة.
          </p>
        </>
      ) : (
        <main className="max-w-3xl mx-auto px-4 pt-8 space-y-5">
          {/* رأس البروفايل */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <div className="flex items-start gap-4 flex-wrap">
              <Avatar co={c} size="w-24 h-24 text-4xl" />
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-black text-2xl">{c.name}</h1>
                  {c.lead && <span className="text-[10px] font-black bg-amber-400/15 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full">👑 المشرف العام</span>}
                  <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">✓ معتمد</span>
                </div>
                <p className="text-amber-300 font-bold text-sm mt-1">{c.specialty}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Stars value={coachAvg(c.reviews)} size={16} />
                  <span className="text-sm font-black text-amber-300">{coachAvg(c.reviews).toFixed(1)}</span>
                  <span className="text-xs text-zinc-500">({c.reviews.length} تقييم موثّق)</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[[c.years + " سنوات", "خبرة"], [c.clients + "+", "متدرب"], [c.programs.length, "برامج"]].map(([v, l]) => (
                <div key={l} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center">
                  <p className="font-black text-amber-300">{v}</p><p className="text-[11px] text-zinc-500">{l}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mt-4">{c.bio}</p>
          </div>

          {/* البرامج */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <h2 className="font-black mb-4 flex items-center gap-2"><Award size={18} className="text-amber-300" /> برامج {c.name}</h2>
            <div className="space-y-2.5">
              {c.programs.map((pg) => (
                <div key={pg.n} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 gap-3 flex-wrap">
                  <p className="font-bold text-sm">{pg.n}</p>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-amber-300">{pg.pr}€</span>
                    <button onClick={onSubscribe}
                      className="text-xs font-black bg-amber-400 hover:bg-amber-300 text-zinc-950 px-4 py-2 rounded-lg transition-colors">
                      احجز عبر المنصة
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-600 mt-3">🛡️ الدفع عبر المنصة حصرياً — يضمن حقك ويشمل عمولة تشغيل {PLATFORM_FEE}% تدعم استمرار الخدمة.</p>
          </div>

          {/* التقييمات */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
            <h2 className="font-black mb-4 flex items-center gap-2"><Star size={18} className="text-amber-300" /> تقييمات العملاء</h2>
            <div className="space-y-3 mb-6">
              {c.reviews.map((r, i) => (
                <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{r.a}</p>
                      <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">✓ عميل موثّق</span>
                    </div>
                    <div className="flex items-center gap-2"><Stars value={r.st} size={12} /><span className="text-[10px] text-zinc-600">{r.d}</span></div>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{r.t}</p>
                </div>
              ))}
            </div>
            {/* إضافة تقييم — للمشتركين الذين أكملوا فترة مع المدرب فقط */}
            {isSubscriber ? (
              <div className="border-t border-zinc-800 pt-5">
                <p className="font-bold text-sm mb-1">قيّم تجربتك مع {c.name}</p>
                <p className="text-[11px] text-zinc-500 mb-3">✓ تحققنا من اشتراكك — التقييم متاح فقط لمن أكمل فترة اشتراك مع هذا المدرب، ويُحدَّث المتوسط تلقائياً.</p>
                <Stars value={stars} size={26} onRate={setStars} />
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
                  placeholder="صف تجربتك بصدق — تقييمك يساعد الآخرين على الاختيار..."
                  className="w-full mt-3 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none resize-none" />
                <button onClick={submitReview} disabled={!stars || !text.trim()}
                  className="mt-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-black px-5 py-2.5 rounded-xl text-sm transition-colors">
                  نشر التقييم
                </button>
              </div>
            ) : (
              <div className="border-t border-zinc-800 pt-5 flex items-center gap-3 text-sm text-zinc-500">
                <Lock size={16} className="text-amber-300 shrink-0" />
                التقييم متاح فقط للمشتركين الذين أكملوا فترة اشتراك مع هذا المدرب — لضمان مصداقية كل نجمة تراها.
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

// انضم لفريقنا — نموذج تقديم المدربين (يخضع لمراجعة المشرف العام)
function JoinCoach({ onBack }) {
  const [f, setF] = useState({ name: "", age: "", years: "", spec: "", bio: "", link: "", photo: null });
  const [sent, setSent] = useState(false);
  const specs = ["تضخيم وتنشيف", "قوة وباورليفتنغ", "لياقة نسائية", "تغذية رياضية", "كارديو وحرق دهون", "إعادة تأهيل", "يوغا ومرونة"];
  const ok = f.name && f.age > 17 && f.years !== "" && f.spec && f.bio.length > 30;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 relative">
      <button onClick={onBack}
        className="absolute top-5 right-5 flex items-center gap-1 text-sm font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-600 px-4 py-2 rounded-xl transition-colors">
        <ChevronRight size={16} /> رجوع
      </button>
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        {sent ? (
          <div className="text-center py-8">
            <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-emerald-400" />
            </div>
            <h2 className="font-black text-xl mb-2">تم استلام طلبك! 📩</h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
              سيراجع <b className="text-amber-300">المشرف العام (كابتن جغمان)</b> سيرتك وخبرتك شخصياً خلال 72 ساعة —
              نظام الاعتماد (Vetting) هو ما يمنح متدربينا الثقة. إن قُبلت، تحصل على صفحة بروفايل خاصة
              وتحتفظ بـ {100 - PLATFORM_FEE}% من كل اشتراك (عمولة المنصة {PLATFORM_FEE}%).
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-1"><UserPlus size={24} className="text-amber-300" /><h2 className="text-2xl font-black">انضم لفريقنا 🤝</h2></div>
            <p className="text-zinc-400 text-sm mb-6">درّب عبر منصة موثوقة: نجلب لك العملاء، ندير المدفوعات، وتتفرغ أنت للتدريب.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="الاسم الكامل" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
                <input type="number" placeholder="العمر" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
              </div>
              <input type="number" placeholder="عدد سنوات الخبرة" value={f.years} onChange={(e) => setF({ ...f, years: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
              <div>
                <label className="text-sm font-semibold text-zinc-300 block mb-2">التخصص</label>
                <div className="flex flex-wrap gap-2">
                  {specs.map((sp) => <Chip key={sp} active={f.spec === sp} onClick={() => setF({ ...f, spec: sp })}>{sp}</Chip>)}
                </div>
              </div>
              <textarea rows={3} placeholder="السيرة الذاتية والخبرة (30 حرفاً على الأقل): شهاداتك، إنجازاتك، أسلوبك التدريبي..."
                value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none resize-none" />
              <input placeholder="رابط فيديو تعريفي أو حساب تواصل (إنستغرام/يوتيوب)" dir="ltr" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
              <div>
                <label className="text-sm font-semibold text-zinc-300 block mb-2">صورة شخصية احترافية</label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-zinc-700 hover:border-amber-400/60 rounded-xl py-5 cursor-pointer transition-colors text-sm text-zinc-400">
                  {f.photo ? <><Check size={16} className="text-emerald-400" /> {f.photo}</> : "📷 اضغط لرفع صورتك"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setF({ ...f, photo: e.target.files?.[0]?.name || null })} />
                </label>
              </div>
              <button disabled={!ok} onClick={() => { saveCoachApplication({ name: f.name, age: f.age, years: f.years, spec: f.spec, bio: f.bio, link: f.link }); setSent(true); }}
                className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-black py-3.5 rounded-xl transition-colors">
                إرسال الطلب للمراجعة
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   11.8 لوحة تحكم المسؤول (Admin Panel)
   في الإنتاج: خلف مصادقة دور "مسؤول" (Role-based Auth) حصراً
   ═══════════════════════════════════════════════════════════════ */
// كلمة سر لوحة الإدارة — لا تُفتح اللوحة إلا بها
const ADMIN_PASSWORD = "JAGHMANcoaching1993";

// شاشة تسجيل دخول المسؤول
function AdminGate({ onBack, onUnlock }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const submit = () => {
    if (pass === ADMIN_PASSWORD) onUnlock();
    else { setError(true); setPass(""); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <button onClick={onBack}
        className="absolute top-5 right-5 flex items-center gap-1 text-sm font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-600 px-4 py-2 rounded-xl transition-colors">
        <ChevronRight size={16} /> رجوع
      </button>
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <div className="bg-amber-400/15 rounded-2xl w-14 h-14 flex items-center justify-center mb-4">
          <Lock size={26} className="text-amber-300" />
        </div>
        <h2 className="text-2xl font-black mb-1">لوحة الإدارة 🔐</h2>
        <p className="text-zinc-400 text-sm mb-6">هذه المنطقة خاصة بالمسؤول فقط. أدخل كلمة السر للمتابعة.</p>
        <input type="password" value={pass} autoFocus
          onChange={(e) => { setPass(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="كلمة السر" dir="ltr"
          className={`w-full bg-zinc-950 border rounded-xl px-4 py-3 placeholder-zinc-600 focus:outline-none text-center ${error ? "border-rose-500 focus:border-rose-500" : "border-zinc-700 focus:border-amber-400"}`} />
        {error && <p className="text-rose-400 text-xs font-bold mt-2 text-center">كلمة السر غير صحيحة</p>}
        <button onClick={submit} disabled={!pass}
          className="w-full mt-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-black py-3.5 rounded-xl transition-colors">
          دخول
        </button>
      </div>
    </div>
  );
}

/* أداة إدارة فيديوهات التشريح 3D — على مستوى كل تمرين بعينه.
   تعرض كل التمارين مجمّعة تحت عضلاتها، ولكل تمرين خانة اختبار + اعتماد مستقل.
   تختبر التضمين قبل الحفظ فلا يظهر "غير متوفر" للمشترك. تُحفظ في جدول جوجل عبر site.anatomy. */

// استخراج معرّف يوتيوب من أي صيغة رابط أو معرّف مجرّد
function ytIdFrom(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : "";
}

// كل التمارين مجمّعة حسب المجموعة العضلية — الأساسية + البدائل (بلا تكرار)
function allExercisesByGroup() {
  const out = {};
  Object.keys(EXERCISE_DB).forEach((g) => {
    const set = new Set();
    EXERCISE_DB[g].forEach((ex) => {
      set.add(ex.name);
      (ex.alts || []).forEach((a) => set.add(a.name));
    });
    out[g] = [...set];
  });
  return out;
}

function VideoAdmin() {
  const site = useSite();
  const byGroup = React.useMemo(allExercisesByGroup, []);
  const existing = (site.anatomy) || {};
  const [map, setMap] = useState(() => ({ ...existing }));
  const [inputs, setInputs] = useState({});
  const [testing, setTesting] = useState(null); // {name, id}
  const [openG, setOpenG] = useState(Object.keys(byGroup)[0] || null);
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const startTest = (name) => {
    const id = ytIdFrom(inputs[name]);
    if (!id) { setSaveMsg("⚠️ الرابط غير صالح — انسخ رابط الفيديو كاملاً من يوتيوب"); return; }
    setSaveMsg(""); setTesting({ name, id });
  };
  const confirmWorks = (name, id) => {
    setMap((m) => ({ ...m, [name]: id })); setTesting(null);
    setSaveMsg(`✓ اعتُمد فيديو «${name}» — لا تنسَ الحفظ في الأسفل`);
  };
  const markBad = () => { setTesting(null); setSaveMsg("جرّب فيديو آخر — هذا لا يسمح بالعرض داخل الموقع"); };
  const removeEx = (name) => { setMap((m) => { const c = { ...m }; delete c[name]; return c; }); setInputs((i) => ({ ...i, [name]: "" })); };

  const saveAll = async () => {
    setSaving(true); setSaveMsg("جارٍ الحفظ...");
    if (site.mergeAnatomy) site.mergeAnatomy(map); // يظهر فوراً للمشتركين في هذه الجلسة
    try {
      if (saveAnatomyVideos) { await saveAnatomyVideos(map); setSaveMsg("✓ حُفظت في جدول جوجل — دائمة لكل الأجهزة"); }
      else setSaveMsg("✓ اعتُمدت وظهرت للمشتركين. لتخزينها دائماً بعد كل نشر، فعّل saveAnatomyVideos (راجع الدليل).");
    } catch { setSaveMsg("✓ معتمدة في هذه الجلسة — تعذّر الحفظ الدائم في الجدول"); }
    setSaving(false); setTimeout(() => setSaveMsg(""), 7000);
  };

  const totalDone = Object.keys(map).filter((k) => map[k]).length;
  const totalEx = Object.values(byGroup).reduce((t, arr) => t + arr.length, 0);

  return (
    <div className="space-y-4">
      <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 text-sm text-zinc-300 leading-relaxed">
        🧬 لكل تمرين، ثلاث خطوات سهلة:
        <span className="block mt-1.5 text-xs text-zinc-400 leading-relaxed">
          <b className="text-sky-400">1)</b> اضغط <b className="text-sky-400">🔎 ابحث تشريح 3D</b> — يفتح يوتيوب على نتائج هذا التمرين بالضبط ·
          <b className="text-sky-400">2)</b> افتح الفيديو المناسب وانسخ رابطه والصقه في الخانة ·
          <b className="text-sky-400">3)</b> اضغط <b className="text-amber-300">اختبار</b> ثم <b className="text-emerald-400">يعمل ✓ اعتمده</b>.
        </span>
        <div className="mt-2 text-xs text-zinc-400">المعتمَد حتى الآن: <b className="text-emerald-400">{totalDone}</b> من {totalEx} تمرين · التمرين بلا فيديو يعرض للمشترك العرض التوضيحي الحركي المدمج تلقائياً.</div>
      </div>

      {Object.keys(byGroup).map((g) => {
        const exs = byGroup[g];
        const doneInG = exs.filter((n) => map[n]).length;
        const isOpen = openG === g;
        return (
          <div key={g} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <button onClick={() => setOpenG(isOpen ? null : g)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition-colors">
              <div className="flex items-center gap-2">
                <GroupBadge g={g} />
                <span className="text-sm font-black">{g}</span>
                <span className="text-[11px] text-zinc-500">({exs.length} تمرين)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${doneInG ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/25" : "text-zinc-500 bg-zinc-800 border border-zinc-700"}`}>
                  {doneInG}/{exs.length} معتمد
                </span>
                <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-2 border-t border-zinc-800 pt-3">
                {exs.map((name) => {
                  const saved = map[name];
                  const isTesting = testing && testing.name === name;
                  return (
                    <div key={name} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{name}</span>
                          {saved
                            ? <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">✓ معتمد</span>
                            : <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">عرض توضيحي</span>}
                        </div>
                        {saved && <button onClick={() => removeEx(name)} className="text-[10px] font-bold text-rose-400 hover:text-rose-300">إزالة</button>}
                      </div>
                      {(() => {
                        const en = EN_OF[name] || name;
                        const q3d = encodeURIComponent(en + " muscle anatomy 3d");
                        const qForm = encodeURIComponent("how to " + en + " proper form");
                        return (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <a href={`https://www.youtube.com/results?search_query=${q3d}`} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-black text-sky-400 bg-sky-500/10 border border-sky-500/25 hover:bg-sky-500/20 px-2.5 py-1.5 rounded-lg transition-colors">
                              🔎 ابحث تشريح 3D ↗
                            </a>
                            <a href={`https://www.youtube.com/results?search_query=${qForm}`} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors">
                              🎬 ابحث أداء ↗
                            </a>
                            <span className="text-[10px] text-zinc-600 self-center" dir="ltr">{en}</span>
                          </div>
                        );
                      })()}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input value={inputs[name] || ""} onChange={(e) => setInputs({ ...inputs, [name]: e.target.value })}
                          placeholder="الصق رابط يوتيوب هنا بعد اختيار الفيديو" dir="ltr"
                          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
                        <button onClick={() => startTest(name)}
                          className="bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400 hover:text-zinc-950 font-black text-xs px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                          اختبار
                        </button>
                      </div>

                      {isTesting && (
                        <div className="mt-2">
                          <div className="bg-black border border-zinc-700 rounded-lg overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
                            <iframe src={`https://www.youtube.com/embed/${testing.id}?rel=0&modestbranding=1`}
                              title={`اختبار ${name}`} style={{ width: "100%", height: "100%", border: 0 }}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => confirmWorks(name, testing.id)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs px-4 py-2 rounded-lg transition-colors">يعمل ✓ اعتمده</button>
                            <button onClick={markBad}
                              className="border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs px-4 py-2 rounded-lg transition-colors">لا يعمل</button>
                          </div>
                        </div>
                      )}
                      {saved && !isTesting && <p className="text-[10px] text-emerald-400/90 mt-1.5" dir="ltr">✓ {saved}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3 flex-wrap sticky bottom-3">
        <button onClick={saveAll} disabled={saving}
          className="bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-black px-7 py-3 rounded-xl transition-colors">
          {saving ? "جارٍ الحفظ..." : "💾 حفظ كل الفيديوهات المعتمدة"}
        </button>
        {saveMsg && <span className="text-sm font-bold text-emerald-400">{saveMsg}</span>}
      </div>
    </div>
  );
}

function AdminPanel({ onBack, coupons, setCoupons }) {
  const site = useSite();
  const [tab, setTab] = useState("overview");
  const [q, setQ] = useState("");
  const [liveSubs, setLiveSubs] = useState(null);
  const [accounts, setAccounts] = useState([]); // الحسابات (للتفعيل)
  const [actMsg, setActMsg] = useState("");
  // اجلب المشتركين والحسابات الحقيقية من جدول جوجل عند فتح اللوحة
  useEffect(() => {
    if (site.connected) loadSubscribers().then((data) => {
      const rows = data.subscribers || [];
      if (rows.length) setLiveSubs(rows.map((r) => ({
        n: r.name, pl: r.plan, d: r.date ? String(r.date).slice(0, 10) : "",
        st: r.status || "مدفوع", left: 30, g: r.goal || "-", coach: r.coach || "جغمان",
      })));
      setAccounts(data.accounts || []);
    });
  }, [site.connected]);

  const activateUser = async (username, status) => {
    setActMsg("جارٍ...");
    const res = await activateAccount(username, status);
    if (res.ok) {
      setAccounts((prev) => prev.map((a) => a.username === username ? { ...a, status } : a));
      setActMsg(status === "مفعّل" ? `✓ تم تفعيل ${username}` : `تم تعليق ${username}`);
    } else setActMsg("تعذّر التنفيذ");
    setTimeout(() => setActMsg(""), 3000);
  };
  const pendingAccounts = accounts.filter((a) => String(a.status) !== "مفعّل");
  const [apps, setApps] = useState(COACH_APPS);
  const [cForm, setCForm] = useState({ code: "", kind: "percent", val: 10, max: 100 });
  const [autoRules, setAutoRules] = useState([
    { id: 1, icon: Mail, on: true, ch: ["WhatsApp", "Email"], t: "ترحيب وتأكيد الاشتراك", d: "تُرسل فور نجاح الدفع: رسالة ترحيب + رابط لوحة التحكم + خطوات البداية." },
    { id: 2, icon: Clock, on: true, ch: ["WhatsApp", "Email"], t: "تذكير قرب انتهاء الاشتراك", d: "قبل 3 أيام من الانتهاء: تذكير بالتجديد مع رابط دفع مباشر وعرض ترقية." },
    { id: 3, icon: Flame, on: true, ch: ["WhatsApp"], t: "رسالة تحفيزية عند الانقطاع", d: "إذا لم يسجّل المشترك أي تمرين لمدة 48 ساعة: رسالة تحفيز شخصية باسمه وهدفه." },
    { id: 4, icon: Bot, on: false, ch: ["WhatsApp"], t: "الرد الآلي الذكي (AI)", d: "نموذج ذكاء اصطناعي يرد فوراً على الاستفسارات الشائعة — ويحوّل المحادثة لكابتن جغمان شخصياً إذا تعذر الحل." },
  ]);
  const revenue = ADMIN_REV.reduce((t, r) => t + r.v, 0);
  const growth = Math.round(((ADMIN_REV[5].v - ADMIN_REV[4].v) / ADMIN_REV[4].v) * 100);
  const SUBS = liveSubs || ADMIN_SUBS;
  const subs = SUBS.filter((r) => (r.n||"").includes(q) || (r.g||"").includes(q) || (r.coach||"").includes(q));

  const genCode = () => setCForm({ ...cForm, code: "JG" + Math.random().toString(36).slice(2, 7).toUpperCase() });
  const addCoupon = () => {
    if (!cForm.code || !cForm.val) return;
    setCoupons([{ code: cForm.code.toUpperCase(), kind: cForm.kind, val: +cForm.val, max: +cForm.max, uses: 0, active: true }, ...coupons]);
    setCForm({ code: "", kind: "percent", val: 10, max: 100 });
  };

  const tabs = [
    { id: "overview", l: "نظرة عامة", ic: TrendingUp }, { id: "activate", l: "طلبات التفعيل", ic: UserPlus }, { id: "subs", l: "المشتركون", ic: Users },
    { id: "coupons", l: "الكوبونات", ic: Ticket }, { id: "coaches", l: "المدربون", ic: Award },
    { id: "videos", l: "فيديوهات 3D", ic: PlayCircle },
    { id: "affiliate", l: "الإحالات", ic: Gift }, { id: "auto", l: "الأتمتة", ic: Bot },
  ];

  return (
    <div className="min-h-screen pb-16">
      <nav className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur border-b border-amber-400/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-zinc-400 hover:text-white"><ChevronRight size={16} /> خروج</button>
            <span className="text-xs font-black bg-amber-400/15 text-amber-300 border border-amber-400/40 px-2.5 py-1 rounded-full">🛡️ لوحة المسؤول — كابتن جغمان</span>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${tab === t.id ? "bg-amber-400 text-zinc-950" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
                <t.ic size={13} /> {t.l}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { l: "الأرباح الإجمالية (6 أشهر)", v: revenue + "€", c: "text-amber-300" },
                { l: "اشتراكات جديدة هذا الشهر", v: "23", c: "text-emerald-400" },
                { l: "نسبة النمو الشهري", v: (growth > 0 ? "+" : "") + growth + "%", c: growth >= 0 ? "text-emerald-400" : "text-rose-400" },
                { l: `عمولات المدربين (${PLATFORM_FEE}%)`, v: Math.round(revenue * 0.31 * PLATFORM_FEE / 100) + "€", c: "text-sky-400" },
              ].map((st) => (
                <div key={st.l} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <p className="text-[11px] text-zinc-500 mb-1">{st.l}</p>
                  <p className={`font-black text-xl ${st.c}`}>{st.v}</p>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="font-black mb-4">الإيرادات الشهرية</h3>
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ADMIN_REV}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="m" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 12, color: "#fff" }} />
                    <Bar dataKey="v" name="الإيراد (€)" fill="#d4af6e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {tab === "activate" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <h3 className="font-black flex items-center gap-2"><UserPlus size={18} className="text-amber-300" /> طلبات التفعيل — بانتظار الدفع</h3>
              {actMsg && <span className="text-xs font-bold text-emerald-400">{actMsg}</span>}
            </div>
            <p className="text-[11px] text-zinc-500 mb-4">بعد استلام الدفع من المشترك عبر واتساب، اضغط "تفعيل" ليتمكن من تسجيل الدخول لحسابه.</p>
            {!site.connected ? (
              <p className="text-sm text-zinc-500">يظهر هنا المسجّلون الجدد بعد ربط الموقع بجدول جوجل ونشره.</p>
            ) : pendingAccounts.length === 0 ? (
              <p className="text-sm text-zinc-500">لا طلبات معلّقة حالياً 🎉</p>
            ) : (
              <div className="space-y-2">
                {pendingAccounts.map((a) => (
                  <div key={a.username} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-sm">{a.name} <span className="text-zinc-500 font-normal">· @{a.username}</span></p>
                      <p className="text-xs text-zinc-500">{a.plan} · {a.amount}€ {a.refCode ? `· كود: ${a.refCode}` : ""}</p>
                    </div>
                    <button onClick={() => activateUser(a.username, "مفعّل")}
                      className="text-xs font-black bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg hover:bg-emerald-400 transition-colors">
                      ✓ تفعيل الحساب
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* الحسابات المفعّلة */}
            {accounts.filter((a) => String(a.status) === "مفعّل").length > 0 && (
              <div className="mt-6">
                <h4 className="font-bold text-sm mb-2 text-zinc-400">الحسابات المفعّلة</h4>
                <div className="space-y-2">
                  {accounts.filter((a) => String(a.status) === "مفعّل").map((a) => (
                    <div key={a.username} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 gap-3 flex-wrap">
                      <p className="text-sm"><span className="font-bold">{a.name}</span> <span className="text-zinc-500">· @{a.username}</span></p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-full">مفعّل ✓</span>
                        <button onClick={() => activateUser(a.username, "معلّق")}
                          className="text-[10px] font-bold text-zinc-500 hover:text-rose-400 transition-colors">تعليق</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "subs" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-black">قاعدة المشتركين ({SUBS.length}){site.connected && liveSubs && <span className="text-[10px] text-emerald-400 mr-2">● مباشر من Google Sheets</span>}</h3>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 بحث بالاسم أو الهدف أو المدرب"
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2 text-sm placeholder-zinc-600 focus:border-amber-400 focus:outline-none w-64" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-zinc-500 text-xs border-b border-zinc-800">
                  {["المشترك", "الباقة", "تاريخ الاشتراك", "حالة الدفع", "المتبقي", "الهدف", "المدرب"].map((h) => <th key={h} className="text-right px-4 py-2.5 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {subs.map((r) => (
                    <tr key={r.n} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-bold">{r.n}</td>
                      <td className="px-4 py-3 text-zinc-400">{r.pl}</td>
                      <td className="px-4 py-3 text-zinc-500" dir="ltr" style={{ textAlign: "right" }}>{r.d}</td>
                      <td className="px-4 py-3"><span className={`text-[10px] font-black px-2 py-1 rounded-full border ${r.st === "مدفوع" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"}`}>{r.st}</span></td>
                      <td className={`px-4 py-3 font-bold ${r.left <= 10 ? "text-rose-400" : "text-zinc-300"}`}>{r.left} يوم</td>
                      <td className="px-4 py-3 text-zinc-400">{r.g}</td>
                      <td className="px-4 py-3 text-amber-300 font-bold">{r.coach}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "coupons" && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="font-black mb-4 flex items-center gap-2"><Ticket size={18} className="text-amber-300" /> توليد كود خصم</h3>
              <div className="grid sm:grid-cols-5 gap-3 items-end">
                <div className="sm:col-span-2 flex gap-2">
                  <input value={cForm.code} onChange={(e) => setCForm({ ...cForm, code: e.target.value })} placeholder="الكود (أو ولّده)" dir="ltr"
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm placeholder-zinc-600 focus:border-amber-400 focus:outline-none" />
                  <button onClick={genCode} className="text-xs font-bold border border-amber-400/40 text-amber-300 px-3 rounded-xl hover:bg-amber-400/10">🎲</button>
                </div>
                <select value={cForm.kind} onChange={(e) => setCForm({ ...cForm, kind: e.target.value })}
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none">
                  <option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت €</option>
                </select>
                <input type="number" value={cForm.val} onChange={(e) => setCForm({ ...cForm, val: e.target.value })} placeholder="القيمة"
                  className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
                <button onClick={addCoupon} className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black py-2.5 rounded-xl text-sm">إنشاء</button>
              </div>
              <p className="text-[11px] text-zinc-600 mt-3">✨ الأكواد تعمل فوراً في بوابة الدفع — جرّبها بنفسك عند الاشتراك.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="font-black mb-3">الأكواد الفعّالة ({coupons.length})</h3>
              <div className="space-y-2">
                {coupons.map((cp) => (
                  <div key={cp.code} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-amber-300" dir="ltr">{cp.code}</span>
                      <span className="text-xs text-zinc-400">{cp.kind === "percent" ? `خصم ${cp.val}%` : `خصم ${cp.val}€`}</span>
                      <span className="text-[10px] text-zinc-600">استُخدم {cp.uses}/{cp.max}</span>
                    </div>
                    <button onClick={() => setCoupons(coupons.map((x) => x.code === cp.code ? { ...x, active: !x.active } : x))}
                      className={`text-[10px] font-black px-3 py-1.5 rounded-full border ${cp.active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>
                      {cp.active ? "فعّال ✓" : "موقوف"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "coaches" && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="font-black mb-1 flex items-center gap-2"><UserPlus size={18} className="text-amber-300" /> طلبات الانضمام — نظام الاعتماد (Vetting)</h3>
              <p className="text-[11px] text-zinc-500 mb-4">راجع السيرة قبل القبول — اسمك كمشرف عام هو الضمانة التي تبني ثقة المتدربين.</p>
              {apps.length === 0 ? <p className="text-sm text-zinc-500">لا طلبات معلقة 🎉</p> : apps.map((ap) => (
                <div key={ap.n} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 mb-2 gap-3 flex-wrap">
                  <div><p className="font-bold text-sm">{ap.n}</p><p className="text-xs text-zinc-500">{ap.sp} · {ap.y} سنوات خبرة</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => setApps(apps.filter((x) => x.n !== ap.n))} className="text-xs font-black bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg hover:bg-emerald-400">قبول ✓</button>
                    <button onClick={() => setApps(apps.filter((x) => x.n !== ap.n))} className="text-xs font-black border border-rose-500/40 text-rose-400 px-4 py-2 rounded-lg hover:bg-rose-500/10">رفض</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="font-black mb-3">المدربون المعتمدون — عمولة المنصة {PLATFORM_FEE}%</h3>
              {COACHES_SEED.map((co) => (
                <div key={co.id} className="flex items-center justify-between border-b border-zinc-800/60 last:border-0 py-2.5 gap-3 flex-wrap">
                  <p className="font-bold text-sm">{co.name} {co.lead && "👑"} <span className="text-xs text-zinc-500 font-normal">· {co.specialty}</span></p>
                  <p className="text-xs text-zinc-400">إيراد تقديري: <b className="text-amber-300">{co.clients * 3}€/شهر</b> → عمولتك: <b className="text-emerald-400">{Math.round(co.clients * 3 * PLATFORM_FEE / 100)}€</b></p>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "affiliate" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h3 className="font-black mb-1 flex items-center gap-2"><Gift size={18} className="text-amber-300" /> نظام الإحالات — عمولة 10% تلقائية</h3>
            <p className="text-[11px] text-zinc-500 mb-4">لكل مشترك كود خاص. عند اشتراك شخص جديد عبر الكود تُحتسب 10% تلقائياً لصاحبه — يسحبها أو يخصمها من تجديده.</p>
            <table className="w-full text-sm">
              <thead><tr className="text-zinc-500 text-xs border-b border-zinc-800">
                <th className="text-right px-3 py-2">كود الإحالة</th><th className="text-right px-3 py-2">إحالات ناجحة</th><th className="text-right px-3 py-2">عمولة مستحقة</th><th className="px-3 py-2">إجراء</th>
              </tr></thead>
              <tbody>
                {AFFILIATES.map((af) => (
                  <tr key={af.code} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-3 py-3 font-black text-amber-300" dir="ltr" style={{ textAlign: "right" }}>{af.code}</td>
                    <td className="px-3 py-3">{af.refs}</td>
                    <td className="px-3 py-3 font-bold text-emerald-400">{af.due}€</td>
                    <td className="px-3 py-3 text-center"><button className="text-[10px] font-black border border-amber-400/40 text-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-400/10">صرف العمولة</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "auto" && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="font-black mb-1 flex items-center gap-2"><Bot size={18} className="text-amber-300" /> الأتمتة الذكية والتواصل</h3>
              <p className="text-[11px] text-zinc-500 mb-4">⚙️ في الإنتاج تُربط عبر WhatsApp Business API وخدمة بريد (Resend/SendGrid) وواجهة نموذج ذكاء اصطناعي — من الخادم حصراً لحماية المفاتيح.</p>
              {autoRules.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-2.5">
                  <div className="flex gap-3">
                    <r.icon size={20} className="text-amber-300 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-sm">{r.t} <span className="mr-1">{r.ch.map((c) => <span key={c} className="text-[9px] font-black bg-zinc-800 border border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full mr-1">{c}</span>)}</span></p>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{r.d}</p>
                    </div>
                  </div>
                  <button onClick={() => setAutoRules(autoRules.map((x) => x.id === r.id ? { ...x, on: !x.on } : x))}
                    className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${r.on ? "bg-emerald-500" : "bg-zinc-700"}`} aria-label="تفعيل">
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${r.on ? "right-0.5" : "right-6"}`} />
                  </button>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="font-black mb-3">📨 سجل الرسائل الآلية (عينة)</h3>
              {[
                ["واتساب · الآن", "أهلاً أحمد! 🎉 تم تفعيل اشتراكك Premium. لوحة تحكمك جاهزة — أول جلسة متابعة السبت 6م."],
                ["بريد · قبل ساعتين", "منى، اشتراكك ينتهي بعد 3 أيام ⏳ جدّدي الآن واحتفظي بخصم 10% بكود JAGH10."],
                ["واتساب · أمس", "خالد، مرّت 48 ساعة بدون تمرين 🔥 هدفك (قوة) ينتظرك — جلسة اليوم 40 دقيقة فقط. أنا هنا لو واجهك أي عائق."],
              ].map(([m, t]) => (
                <div key={m} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 mb-2 text-sm">
                  <p className="text-[10px] text-zinc-600 mb-1">{m}</p><p className="text-zinc-300">{t}</p>
                </div>
              ))}
            </div>
          </>
        )}
              {tab === "videos" && <VideoAdmin />}

        </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   12. لوحة التحكم الرئيسية + تنبيهات المتابعة
   ═══════════════════════════════════════════════════════════════ */

// بطاقة الترقية — تظهر لمشتركي الأساسي عند فتح مميزات Premium
function UpgradeCard({ feature, onUpgrade }) {
  return (
    <div className="max-w-xl mx-auto bg-zinc-900 border-2 border-amber-400/40 rounded-3xl p-8 text-center">
      <div className="bg-amber-400/15 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
        <Lock size={28} className="text-amber-300" />
      </div>
      <h3 className="font-black text-xl mb-2">{feature} — ميزة Premium 👑</h3>
      <p className="text-zinc-400 text-sm leading-relaxed mb-5">
        رقِّ اشتراكك إلى <b className="text-amber-300">Premium</b> لتحصل على:
      </p>
      <div className="text-right space-y-2 mb-6 max-w-sm mx-auto">
        {PLANS.premium.perks.slice(1).map((pk) => (
          <p key={pk} className="flex items-start gap-2 text-sm text-zinc-300">
            <Check size={15} className="text-amber-300 mt-0.5 shrink-0" /> {pk}
          </p>
        ))}
      </div>
      <button onClick={onUpgrade}
        className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black px-8 py-3.5 rounded-2xl transition-all hover:scale-105 inline-flex items-center gap-2">
        <Crown size={18} /> الترقية إلى Premium
      </button>
    </div>
  );
}

function Dashboard({ profile, plan, onUpgrade }) {
  const [tab, setTab] = useState("plan");
  const [swaps, setSwaps] = useState({});
  const [dayStatus, setDayStatus] = useState({});
  const [weightLog, setWeightLog] = useState([{ week: "البداية", weight: parseFloat(profile.weight) }]);
  const [dismissed, setDismissed] = useState(false);

  const program = useMemo(() => generateProgram(profile), [profile]);

  // منطق تنبيه المتابعة: تمرينان متتاليان مُتخطَّيان ← تذكير تحفيزي
  const missedTwo = useMemo(() => {
    const statuses = program.map((_, i) => dayStatus[i]);
    for (let i = 0; i < statuses.length - 1; i++) {
      if (statuses[i] === "skipped" && statuses[i + 1] === "skipped") return true;
    }
    return false;
  }, [dayStatus, program]);

  const waLink = `https://wa.me/${COACH_WHATSAPP}?text=${encodeURIComponent(`مرحباً كابتن، أنا ${profile.name} — واجهت صعوبة في الالتزام هذا الأسبوع وأحتاج مساعدتك للعودة 💪`)}`;
  const goalLabel = GOALS.find((g) => g.id === profile.goal)?.label;

  const isPremium = plan?.tier === "premium";
  const tabs = [
    { id: "plan", label: "خطة التمرين", icon: Dumbbell },
    { id: "progress", label: "تتبع التقدم", icon: TrendingUp },
    { id: "nutrition", label: "التغذية", icon: Utensils },
    { id: "community", label: "مجتمع الأبطال", icon: Users, premium: true },
    { id: "coach", label: "المدرب", icon: MessageCircle, premium: true },
  ];

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      {/* الرأس */}
      <header className="border-b border-zinc-800 bg-zinc-950/90 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size={36} />
          {/* تبويبات سطح المكتب */}
          <nav className="hidden md:flex gap-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === t.id ? "bg-amber-400 text-zinc-950" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
                <t.icon size={15} /> {t.label} {t.premium && !isPremium && <Lock size={11} className="opacity-70" />}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className={`border rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 ${isPremium ? "bg-amber-400/15 border-amber-400/40 text-amber-300" : "bg-zinc-800 border-zinc-700 text-zinc-300"}`}>
              <Crown size={12} /> {isPremium ? "Premium" : "أساسي"} · {plan?.name || "مشترك"}
            </span>
            <div className="bg-zinc-800 border border-zinc-700 rounded-full w-8 h-8 flex items-center justify-center font-black text-amber-300 text-xs">
              {profile.name?.[0] || <User size={14} />}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* تنبيه المتابعة — يظهر عند تخطي تمرينين متتاليين */}
        {missedTwo && !dismissed && (
          <div className="mb-6 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-amber-500/20 rounded-full p-3 shrink-0"><Bell size={22} className="text-amber-400" /></div>
            <div className="flex-1">
              <h4 className="font-black text-amber-300">افتقدناك يا بطل! 🔥</h4>
              <p className="text-sm text-zinc-300 mt-1 leading-relaxed">
                لاحظنا تخطيك تمرينين متتاليين — لا بأس، الجميع يمر بأسبوع صعب. المهم العودة اليوم لا غداً.
                {isPremium && <> مدربك <b className="text-emerald-400">متاح على واتساب في أي وقت</b> للرد على استفساراتك ومساعدتك على تجاوز أي عائق.</>}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {isPremium ? (
                <a href={waLink} target="_blank" rel="noreferrer"
                  className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors">
                  <MessageCircle size={15} /> كلّم المدرب
                </a>
              ) : (
                <button onClick={onUpgrade}
                  className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors">
                  <Crown size={15} /> متابعة شخصية؟
                </button>
              )}
              <button onClick={() => setDismissed(true)} className="text-zinc-500 hover:text-white p-2" aria-label="إخفاء التنبيه"><X size={18} /></button>
            </div>
          </div>
        )}

        {/* ترحيب */}
        {tab === "plan" && (
          <div className="mb-6">
            <h2 className="text-2xl font-black">أهلاً {profile.name} 👋</h2>
            <p className="text-zinc-400 text-sm mt-1">
              هدفك: <b className="text-amber-300">{goalLabel}</b> · {profile.days} أيام أسبوعياً · برنامجك مبني على معداتك
              {profile.injuries.length > 0 && <> · مع مراعاة إصابة <b className="text-amber-400">{profile.injuries.join("، ")}</b></>}
            </p>
          </div>
        )}

        {tab === "plan" && <WorkoutPlan profile={profile} program={program} swaps={swaps} setSwaps={setSwaps} dayStatus={dayStatus} setDayStatus={setDayStatus} />}
        {tab === "progress" && <Progress profile={profile} weightLog={weightLog} setWeightLog={setWeightLog} dayStatus={dayStatus} />}
        {tab === "nutrition" && <Nutrition profile={profile} />}
        {tab === "community" && (isPremium ? <Community profile={profile} /> : <UpgradeCard feature="مجتمع الأبطال" onUpgrade={onUpgrade} />)}
        {tab === "coach" && (isPremium ? <Coach profile={profile} /> : <UpgradeCard feature="المتابعة الشخصية مع المدرب" onUpgrade={onUpgrade} />)}
      </main>

      {/* تبويبات الجوال السفلية */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 flex z-40">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold ${tab === t.id ? "text-amber-400" : "text-zinc-500"}`}>
            <t.icon size={20} /> {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   13. التطبيق الرئيسي — إدارة المسارات
   ═══════════════════════════════════════════════════════════════ */

export default function App() {
  const [view, setView] = useState("landing");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [site, setSite] = useState({ connected: false });
  // دمج فيديوهات التشريح المعتمدة (لكل تمرين) من لوحة الإدارة فوراً في السياق
  const mergeAnatomy = React.useCallback((m) => setSite((s) => ({ ...s, anatomy: { ...(s.anatomy || {}), ...m } })), []);
  const [ready, setReady] = useState(false); // انتظر استعادة الجلسة قبل العرض
  // الكوبونات مشتركة بين لوحة الإدارة وبوابة الدفع
  const [coupons, setCoupons] = useState([
    { code: "JAGH10", kind: "percent", val: 10, max: 100, uses: 12, active: true },
    { code: "WELCOME5", kind: "fixed", val: 5, max: 50, uses: 4, active: true },
  ]);

  // أدوات حفظ الجلسة بأمان (تعمل على الموقع المنشور، وتتجاهل الأخطاء في المعاينة)
  const saveSession = (key, val) => {
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {}
  };
  const clearSession = () => {
    try { ["jg_profile", "jg_plan", "jg_admin"].forEach((k) => window.localStorage.removeItem(k)); } catch {}
  };

  // استعادة الجلسة المحفوظة عند فتح الموقع (تذكّر الدخول)
  useEffect(() => {
    try {
      const p = JSON.parse(window.localStorage.getItem("jg_profile") || "null");
      const pl = JSON.parse(window.localStorage.getItem("jg_plan") || "null");
      const adm = window.localStorage.getItem("jg_admin") === "1";
      if (p) setProfile(p);
      if (pl) setPlan(pl);
      if (adm) setAdminUnlocked(true);
      // إن كان مشتركاً مسجّلاً، ادخله مباشرة للوحة تحكمه
      if (p && pl) setView("dashboard");
    } catch {}
    setReady(true);
  }, []);

  // تحميل بيانات جوجل شيت (أسعار، فيديوهات، كوبونات) عند الفتح
  useEffect(() => {
    loadSiteData().then((data) => {
      setSite(data);
      if (data.connected && data.coupons?.length) setCoupons(data.coupons);
    });
  }, []);

  // تحميل خط Cairo العربي
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  if (!ready) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <SiteData.Provider value={{ ...site, mergeAnatomy }}>
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}>
      <style>{AI_CSS}</style>
      {view === "landing" && <Landing onStart={() => setView("onboarding")} onLibrary={() => setView("library")} onLogin={() => setView("login")}
        onCoaches={() => setView("coaches")} onJoin={() => setView("join")} onAdmin={() => setView("admin")} />}
      {view === "coaches" && <CoachesHub onBack={() => setView("landing")} onSubscribe={() => setView(profile ? "plans" : "onboarding")}
        onJoin={() => setView("join")} isSubscriber={!!plan} userName={profile?.name} />}
      {view === "join" && <JoinCoach onBack={() => setView("landing")} />}
      {view === "admin" && (adminUnlocked
        ? <AdminPanel onBack={() => { setView("landing"); setAdminUnlocked(false); }} coupons={coupons} setCoupons={setCoupons} />
        : <AdminGate onBack={() => setView("landing")} onUnlock={() => setAdminUnlocked(true)} />)}
      {view === "library" && <FreeLibrary onBack={() => setView("landing")} onSubscribe={() => setView("onboarding")} onLogin={() => setView("login")} />}
      {view === "login" && <Login onBack={() => setView("landing")} onLogin={(acc) => {
        // مشترك مُفعّل سجّل دخوله: ادخله للوحة التحكم ببياناته
        if (acc && acc.name) {
          setProfile((prev) => prev
            ? { ...prev, username: prev.username || acc.username || "", email: prev.email || acc.email || "" }
            : { name: acc.name, username: acc.username || "", email: acc.email || "", age: 25, weight: 75, height: 175, days: 4, goal: acc.goal || "muscle", equipment: ["دمبل", "وزن الجسم"], injuries: [], weakPoints: [] });
          setPlan({ tier: acc.tier || "basic", name: acc.plan || "مشترك", tierLabel: acc.tier === "premium" ? "اشتراك Premium" : "الاشتراك الأساسي" });
          setView("dashboard");
        } else {
          setView(profile && plan ? "dashboard" : "onboarding");
        }
      }} />}
      {view === "onboarding" && <Onboarding onDone={(p) => { setProfile(p); setView("plans"); }} onBack={() => setView("landing")} />}
      {view === "plans" && <Plans coupons={coupons} currentPlan={plan} onSubscribed={(pl) => { setPlan(pl); setView("dashboard"); }} onBack={() => setView(plan ? "dashboard" : "onboarding")} />}
      {view === "dashboard" && profile && <Dashboard profile={profile} plan={plan} onUpgrade={() => setView("plans")} />}
    </div>
    </SiteData.Provider>
  );
}
