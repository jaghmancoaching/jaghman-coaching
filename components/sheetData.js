/**
 * ═══════════════════════════════════════════════════════════════
 *  جسر الاتصال بين الموقع و Google Sheets
 *  عدّل رابطاً واحداً فقط (SHEET_API_URL) وكل شيء يعمل.
 * ═══════════════════════════════════════════════════════════════
 */

// ⚠️ الصق هنا رابط الـ Web App الذي حصلت عليه من Apps Script (خطوة النشر)
export const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxAsS7Uz-OH7iQE3IlB6iRmgQ1dmsX0XT5F7tqbJbYBN2RBxqrQMBhSsj6YFhOsKcZ6mg/exec";

// كلمة السر نفسها الموجودة في Apps Script (لقراءة قائمة المشتركين)
export const ADMIN_SECRET = "jaghman2026";

/** يحوّل صفوف جدول Config إلى كائن {key: value} */
function rowsToObject(rows) {
  const o = {};
  (rows || []).forEach((r) => { if (r.key) o[r.key] = r.value; });
  return o;
}

/** يحوّل جدول Videos إلى {اسم التمرين: معرّف اليوتيوب} */
function videosToMap(rows) {
  const m = {};
  (rows || []).forEach((r) => { if (r.exercise && r.youtubeId) m[r.exercise] = String(r.youtubeId).trim(); });
  return m;
}

/** يحوّل جدول Plans إلى بنية الباقات التي يستخدمها الموقع */
function plansToStructure(rows) {
  const out = { basic: { options: [] }, premium: { options: [] } };
  (rows || []).forEach((r) => {
    const tier = r.tier === "premium" ? "premium" : "basic";
    out[tier].options.push({
      id: r.id, name: r.name, total: Number(r.total) || 0,
      per: r.per || "", featured: String(r.featured) === "true",
      stripeLink: r.stripeLink || "",
    });
  });
  return out;
}

/** يجلب كل بيانات الموقع من الجدول مرة واحدة عند الفتح */
export async function loadSiteData() {
  if (!SHEET_API_URL || SHEET_API_URL.includes("ضع_رابطك_هنا")) {
    return { connected: false }; // لم يُربط بعد — الموقع يستخدم بياناته الافتراضية
  }
  try {
    const res = await fetch(`${SHEET_API_URL}?action=all`);
    const data = await res.json();
    if (!data.ok) return { connected: false };
    return {
      connected: true,
      config: rowsToObject(data.config),
      videos: videosToMap(data.videos),
      plans: plansToStructure(data.plans),
      coaches: data.coaches || [],
      coupons: (data.coupons || []).map((c) => ({
        code: c.code, kind: c.kind, val: Number(c.val),
        max: Number(c.max) || 100, active: String(c.active) === "true", uses: 0,
      })),
    };
  } catch (e) {
    console.warn("تعذّر الاتصال بجدول جوجل:", e);
    return { connected: false };
  }
}

/** يجلب قائمة المشتركين (للوحة الإدارة — محمي بكلمة السر) */
export async function loadSubscribers() {
  try {
    const res = await fetch(`${SHEET_API_URL}?action=subscribers&secret=${encodeURIComponent(ADMIN_SECRET)}`);
    const data = await res.json();
    return data.ok ? data.subscribers : [];
  } catch { return []; }
}

/** يسجّل مشتركاً جديداً في الجدول بعد نجاح الدفع */
export async function saveSubscriber(payload) {
  try {
    await fetch(SHEET_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "addSubscriber", ...payload }),
    });
    return true;
  } catch { return false; }
}

/** يرسل تقييم مدرب */
export async function saveReview(payload) {
  try {
    await fetch(SHEET_API_URL, { method: "POST", body: JSON.stringify({ action: "addReview", ...payload }) });
    return true;
  } catch { return false; }
}

/** يرسل طلب انضمام مدرب */
export async function saveCoachApplication(payload) {
  try {
    await fetch(SHEET_API_URL, { method: "POST", body: JSON.stringify({ action: "coachApplication", ...payload }) });
    return true;
  } catch { return false; }
}
