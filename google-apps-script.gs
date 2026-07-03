/**
 * ═══════════════════════════════════════════════════════════════
 *  Jaghman Coaching — محرك Google Sheets (Apps Script)
 *  هذا الكود يحوّل جدول جوجل الخاص بك إلى "خادم" يدير الموقع بالكامل.
 *  تنسخه مرة واحدة فقط — بعدها تدير كل شيء من الجدول دون لمس أي كود.
 * ═══════════════════════════════════════════════════════════════
 *
 *  طريقة التركيب (مشروحة بالتفصيل في دليل-Google-Sheets.md):
 *  1. افتح جدول جوجل → Extensions → Apps Script
 *  2. الصق هذا الكود كاملاً
 *  3. Deploy → New deployment → Web app → Anyone → Deploy
 *  4. انسخ الرابط الناتج وضعه في الموقع (متغيّر SHEET_API_URL)
 */

// كلمة سر بسيطة تحمي عمليات الكتابة (غيّرها لأي نص تريده)
const ADMIN_SECRET = "jaghman2026";

/** قراءة كل بيانات الموقع (يستدعيها الموقع تلقائياً) */
function doGet(e) {
  const action = (e.parameter.action || "all");
  try {
    if (action === "all") {
      return json({
        ok: true,
        config: readSheet("Config"),
        plans: readSheet("Plans"),
        videos: readSheet("Videos"),
        coaches: readSheet("Coaches"),
        coupons: readSheet("Coupons"),
      });
    }
    if (action === "subscribers") {
      // محمي: يتطلب كلمة السر
      if (e.parameter.secret !== ADMIN_SECRET) return json({ ok: false, error: "unauthorized" });
      return json({ ok: true, subscribers: readSheet("Subscribers") });
    }
    return json({ ok: false, error: "unknown action" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** كتابة بيانات (تسجيل مشترك جديد، إضافة تقييم، تسجيل إحالة) */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "addSubscriber") {
      const sh = sheet("Subscribers");
      sh.appendRow([
        new Date(),           // تاريخ الاشتراك
        body.name || "",
        body.email || "",
        body.plan || "",
        body.tier || "basic",
        body.amount || 0,
        "مدفوع",              // حالة الدفع
        body.goal || "",
        body.coach || "جغمان",
        body.refCode || "",   // كود الإحالة المستخدم
        body.myRefCode || "", // كود إحالة هذا المشترك
      ]);
      // إذا استُخدم كود إحالة، سجّل عمولة 10% لصاحبه
      if (body.refCode) recordReferral(body.refCode, (body.amount || 0) * 0.1);
      return json({ ok: true });
    }

    if (action === "addReview") {
      sheet("Reviews").appendRow([new Date(), body.coach, body.author, body.stars, body.text]);
      return json({ ok: true });
    }

    if (action === "coachApplication") {
      sheet("CoachApplications").appendRow([
        new Date(), body.name, body.age, body.years, body.spec, body.bio, body.link, "قيد المراجعة",
      ]);
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown action" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** يسجّل عمولة الإحالة في عمود المستحقات */
function recordReferral(refCode, commission) {
  const sh = sheet("Subscribers");
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const codeCol = headers.indexOf("myRefCode");
  const dueCol = headers.indexOf("refEarnings");
  if (codeCol < 0) return;
  for (let i = 1; i < data.length; i++) {
    if (data[i][codeCol] === refCode) {
      const current = Number(data[i][dueCol] || 0);
      sh.getRange(i + 1, dueCol + 1).setValue(current + commission);
      return;
    }
  }
}

/* ─── أدوات مساعدة ─── */
function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function readSheet(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).filter(r => r.some(c => c !== "")).map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return obj;
  });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * تشغيل هذه الدالة مرة واحدة يجهّز كل الجداول بالأعمدة الصحيحة
 * (من قائمة Apps Script: اختر setupSheets ثم Run)
 */
function setupSheets() {
  const tabs = {
    Config: [["key", "value"],
      ["siteName", "Jaghman Coaching"],
      ["whatsapp", "31645995782"],
      ["platformFeePercent", "15"]],
    Plans: [["id", "tier", "name", "total", "per", "featured", "stripeLink"],
      ["b1", "basic", "شهر واحد", "10", "10€ / شهر", "false", ""],
      ["b3", "basic", "3 أشهر", "25", "≈ 8.3€ / شهر", "true", ""],
      ["b6", "basic", "6 أشهر", "40", "≈ 6.7€ / شهر", "false", ""],
      ["p1", "premium", "شهر واحد", "29", "29€ / شهر", "false", ""],
      ["p3", "premium", "3 أشهر", "72", "24€ / شهر", "true", ""],
      ["p12", "premium", "سنة", "204", "17€ / شهر", "false", ""]],
    Videos: [["exercise", "youtubeId"],
      ["ضغط بار مستوي", "hWbUlkb5Ms4"],
      ["سكوات بار خلفي", ""],
      ["تجديف بار منحني", ""],
      ["ضغط كتف بار واقف", ""]],
    Coaches: [["id", "name", "lead", "years", "specialty", "clients", "bio", "photo"],
      ["jag", "كابتن جغمان", "true", "9", "تضخيم وتنشيف · إشراف عام", "140", "المشرف العام ومؤسس المنصة.", ""]],
    Coupons: [["code", "kind", "val", "max", "active"],
      ["JAGH10", "percent", "10", "100", "true"],
      ["WELCOME5", "fixed", "5", "50", "true"]],
    Subscribers: [["date", "name", "email", "plan", "tier", "amount", "status", "goal", "coach", "refCode", "myRefCode", "refEarnings"]],
    Reviews: [["date", "coach", "author", "stars", "text"]],
    CoachApplications: [["date", "name", "age", "years", "spec", "bio", "link", "status"]],
  };
  Object.keys(tabs).forEach(name => {
    const sh = sheet(name);
    sh.clear();
    sh.getRange(1, 1, tabs[name].length, tabs[name][0].length).setValues(tabs[name]);
    sh.getRange(1, 1, 1, tabs[name][0].length).setFontWeight("bold").setBackground("#d4af6e");
    sh.setFrozenRows(1);
  });
  SpreadsheetApp.getActiveSpreadsheet().toast("تم تجهيز كل الجداول ✓", "Jaghman Coaching", 5);
}
