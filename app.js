// ============================================================================
// info cc 404 — منصة ملفات مهندس دولة في الإعلام الآلي (G1 إلى G10)
// Complete Frontend JavaScript (v3: Teachers, Roles, Groups, Hash Router)
// ============================================================================

// 1) إعدادات Supabase — تبقى القيم كما هي
const SUPABASE_URL = "PUT_YOUR_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PUT_YOUR_ANON_KEY_HERE";

const BUCKET = "course-files";
const GROUPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const KINDS = {
  cours: "Cours",
  td: "TD",
  tp: "TP",
  exam: "Examen",
  autre: "Autre"
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// فحص تفعيل المفاتيح
const isConfigured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PUT_YOUR");
let db = null;

if (isConfigured && window.supabase) {
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn("Supabase init error:", err);
  }
}

// قائمة المقاييس السبعة المعتمدة من ملف data.js
const SUBJECT_LIST = (typeof window !== "undefined" && window.SUBJECTS) ? window.SUBJECTS : [
  { id: "algo", nameFr: "Algo & SDS 1", nameAr: "الخوارزميات وهياكل المعطيات 1", lectureTeacher: "Mrs Bachir", aliases: ["algo", "algorithmique", "sds", "asd", "الخوارزميات"] },
  { id: "arch", nameFr: "Comp Arch 1", nameAr: "بنية الحاسوب 1", lectureTeacher: "Mr Guezouli", aliases: ["arch", "architecture", "archi", "بنية الحاسوب"] },
  { id: "sys", nameFr: "Operating Sys 1", nameAr: "نظام التشغيل 1", lectureTeacher: "Mrs Saadi", aliases: ["sys", "systeme", "operating sys", "os", "se", "نظام التشغيل"] },
  { id: "analyse", nameFr: "Math Analysis 1", nameAr: "التحليل الرياضي 1", lectureTeacher: "Mr Ramdani", aliases: ["analyse", "analysis", "maths", "التحليل"] },
  { id: "algebre", nameFr: "Algebra 1", nameAr: "الجبر 1", lectureTeacher: "Mrs Boudherssa", aliases: ["algebre", "algebra", "الجبر"] },
  { id: "elec", nameFr: "Fundamental Electronics", nameAr: "الإلكترونيك الأساسية", lectureTeacher: "Mrs Hasrouri", aliases: ["elec", "electronique", "electronics", "الإلكترونيك"] },
  { id: "histoire", nameFr: "History of Algeria", nameAr: "تاريخ الجزائر", lectureTeacher: "Mr Bekhouche", aliases: ["histoire", "history", "تاريخ الجزائر", "تاريخ"] }
];

// دالة تحويل الاسم لمعرّف نظيف (Slug)
function slugify(name) {
  if (!name) return "";
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// استخراج بيانات الأساتذة ديناميكياً من data.js حصراً
function getTeachersData() {
  const teachersMap = {};
  const subjects = SUBJECT_LIST;
  const grpTeachers = (typeof window !== "undefined" && window.GROUP_TEACHERS) ? window.GROUP_TEACHERS : {};

  // 1. المحاضرات (Lectures)
  subjects.forEach((s) => {
    if (s.lectureTeacher) {
      const slug = slugify(s.lectureTeacher);
      if (!teachersMap[slug]) {
        teachersMap[slug] = {
          slug,
          name: s.lectureTeacher,
          titleAr: s.lectureTeacher.toLowerCase().startsWith("mrs") ? "أستاذة" : "أستاذ",
          lectures: [],
          tds: [],
          tps: [],
          subjectsMap: {}
        };
      }
      const room = (s.id === "histoire") ? "Amphi C" : (s.id === "analyse" || s.id === "algebre") ? "Amphi B" : "Amphi A";
      teachersMap[slug].lectures.push({
        subjectId: s.id,
        nameFr: s.nameFr,
        nameAr: s.nameAr,
        room
      });
      teachersMap[slug].subjectsMap[s.id] = true;
    }
  });

  // 2. الأعمال الموجهة والتطبيقية (TD / TP)
  for (let g = 1; g <= 10; g++) {
    const gData = grpTeachers[g];
    if (!gData) continue;
    for (const sId of Object.keys(gData)) {
      const item = gData[sId];
      const sMeta = subjects.find((s) => s.id === sId);
      const sNameFr = sMeta ? sMeta.nameFr : sId;
      const sNameAr = sMeta ? sMeta.nameAr : "";

      if (item.td) {
        const slug = slugify(item.td);
        if (!teachersMap[slug]) {
          teachersMap[slug] = {
            slug,
            name: item.td,
            titleAr: item.td.toLowerCase().startsWith("mrs") ? "أستاذة" : "أستاذ",
            lectures: [],
            tds: [],
            tps: [],
            subjectsMap: {}
          };
        }
        teachersMap[slug].tds.push({
          subjectId: sId,
          nameFr: sNameFr,
          nameAr: sNameAr,
          groupNo: g,
          room: item.tdRoom || "Salle TD"
        });
        teachersMap[slug].subjectsMap[sId] = true;
      }

      if (item.tp) {
        const slug = slugify(item.tp);
        if (!teachersMap[slug]) {
          teachersMap[slug] = {
            slug,
            name: item.tp,
            titleAr: item.tp.toLowerCase().startsWith("mrs") ? "أستاذة" : "أستاذ",
            lectures: [],
            tds: [],
            tps: [],
            subjectsMap: {}
          };
        }
        teachersMap[slug].tps.push({
          subjectId: sId,
          nameFr: sNameFr,
          nameAr: sNameAr,
          groupNo: g,
          room: item.tpRoom || "Lab"
        });
        teachersMap[slug].subjectsMap[sId] = true;
      }
    }
  }

  return Object.values(teachersMap);
}

// حالة التطبيق
let currentUser = null;
let userGroupNo = null;
let userRole = "anon"; // 'owner' | 'admin' | 'uploader' | 'student' | 'anon'
let uploaderGroup = null; // group_no إذا كان المستخدم رافع ملفات لفوج محدد
let isAdmin = false;
let isOwner = false;
let isUploader = false;
let files = [];
let filesLoadError = null;
let isSignupMode = false;
let redirectAfterLogin = null;
let isPasswordRecoveryMode = false;

// دالة مساعدة لكتابة الرسائل
function say(el, text, ok = false) {
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? "var(--success)" : "var(--danger)";
}

// دالة حماية النصوص وتفادي ثغرات XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// دالة تطبيع أسماء المقاييس
function normalizeSubjectId(rawSubject) {
  if (!rawSubject) return "autre";
  const s = String(rawSubject).trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const item of SUBJECT_LIST) {
    if (item.id === s) return item.id;
    const frClean = item.nameFr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (frClean === s || s.includes(frClean)) return item.id;
    if (item.aliases && item.aliases.some((a) => {
      const aClean = a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return s === aClean || s.includes(aClean) || aClean.includes(s);
    })) {
      return item.id;
    }
  }
  return "autre";
}

function getSubjectMeta(rawSubject) {
  const normId = normalizeSubjectId(rawSubject);
  const found = SUBJECT_LIST.find((s) => s.id === normId);
  if (found) return found;
  return {
    id: "autre",
    nameFr: rawSubject ? String(rawSubject) : "Autre",
    nameAr: "مادة أخرى",
    lectureTeacher: "—",
    aliases: []
  };
}

// ============================================================================
// 2) المصادقة (Auth & Password Reset)
// ============================================================================

$("#tabLoginBtn").onclick = () => setAuthMode(false);
$("#tabSignupBtn").onclick = () => setAuthMode(true);

function setAuthMode(signup) {
  isSignupMode = signup;
  $("#tabLoginBtn").classList.toggle("active", !signup);
  $("#tabSignupBtn").classList.toggle("active", signup);
  $("#groupSignupGroup").style.display = signup ? "block" : "none";
  $("#authSubmitBtn").textContent = signup ? "إنشاء حساب" : "دخول";
  $("#password").autocomplete = signup ? "new-password" : "current-password";
  $("#forgotPassWrap").style.display = signup ? "none" : "block";
}

// استرجاع كلمة السر (Forgot Password)
$("#forgotPassBtn").onclick = async () => {
  const email = $("#email").value.trim();
  const msg = $("#authMsg");

  if (!email) {
    $("#email").focus();
    return say(msg, "اكتب بريدك الإلكتروني أولاً ثم اضغط هنا.");
  }

  if (!db) {
    return say(msg, "تنبيه: يلزم ضبط مفاتيح Supabase لإرسال رابط الاسترجاع.");
  }

  say(msg, "جاري إرسال رابط إعادة التعيين...", true);
  try {
    const redirectUrl = window.location.origin + window.location.pathname;
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      return say(msg, "خطأ: " + error.message);
    }

    say(msg, "تم إرسال رابط تعيين كلمة السر لبريدك! تفقّد صندوق الوارد.", true);
  } catch (err) {
    say(msg, "تعذر إرسال الرابط: " + err.message);
  }
};

// حفظ كلمة السر الجديدة بعد فتح رابط الاسترجاع
$("#recoveryForm").onsubmit = async (e) => {
  e.preventDefault();
  const newPass = $("#recoveryPassword").value;
  const msg = $("#recoveryMsg");

  if (!newPass || newPass.length < 6) {
    return say(msg, "كلمة السر يجب أن تحتوي على 6 أحرف على الأقل.");
  }

  if (!db) {
    return say(msg, "Supabase غير متصل.");
  }

  say(msg, "جاري تحديث كلمة السر...", true);
  try {
    const { error } = await db.auth.updateUser({ password: newPass });
    if (error) {
      return say(msg, "خطأ في التحديث: " + error.message);
    }
    say(msg, "تم تحديث كلمة السر بنجاح! جاري توجيهك...", true);
    setTimeout(() => {
      isPasswordRecoveryMode = false;
      $("#passwordRecoveryBox").style.display = "none";
      $("#authForm").style.display = "block";
      say($("#authMsg"), "تم تسجيل الدخول بكلمة السر الجديدة ✓", true);
    }, 1200);
  } catch (err) {
    say(msg, "تعذر تحديث كلمة السر: " + err.message);
  }
};

function showPasswordRecoveryUI() {
  isPasswordRecoveryMode = true;
  $("#authForm").style.display = "none";
  $("#passwordRecoveryBox").style.display = "block";
  say($("#recoveryMsg"), "");
  $("#recoveryPassword").focus();
}

$("#authForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const msg = $("#authMsg");

  if (!email || !password) {
    return say(msg, "يرجى إدخال البريد الإلكتروني وكلمة السر.");
  }

  say(msg, "جاري المعالجة...", true);

  if (!db) {
    return say(msg, "تنبيه: يجب وضع مفاتيح Supabase الصحيحة في ملف app.js للاتصال بقاعدة البيانات.");
  }

  if (isSignupMode) {
    const selectedGroupNo = parseInt($("#signupGroup").value, 10);
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { group_no: selectedGroupNo }
      }
    });

    if (error) return say(msg, "خطأ: " + error.message);

    if (data.session) {
      await onUserSignedIn(data.session);
    } else {
      say(msg, "تم إنشاء الحساب! تفقّد بريدك الإلكتروني لتأكيد التسجيل.", true);
    }
  } else {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return say(msg, "خطأ: البريد أو كلمة السر غير صحيحة.");
    await onUserSignedIn(data.session);
  }
};

$("#logoutBtn").onclick = async () => {
  if (db) {
    await db.auth.signOut();
  } else {
    onUserSignedOut();
  }
};

// القاعدة 4: عدم استخدام await لنداءات Supabase داخل onAuthStateChange لتفادي الـ Deadlock
if (db) {
  db.auth.onAuthStateChange((event, session) => {
    setTimeout(async () => {
      if (event === "PASSWORD_RECOVERY") {
        showPasswordRecoveryUI();
        return;
      }

      if (isPasswordRecoveryMode) {
        return;
      }

      if (session) {
        await onUserSignedIn(session);
      } else {
        onUserSignedOut();
      }
    }, 0);
  });
}

// دالة فحص وتحديد رتبة المستخدم الحالية
async function determineUserRole(user) {
  if (!user || !db) {
    userRole = "anon";
    isAdmin = false;
    isOwner = false;
    isUploader = false;
    uploaderGroup = null;
    return;
  }

  try {
    // 1. استدعاء my_role() من قاعدة البيانات
    const { data: roleRes, error: roleErr } = await db.rpc("my_role");
    if (!roleErr && roleRes) {
      userRole = roleRes;
    } else {
      // فحص يدوي احتياطي
      const { data: admRow } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (admRow) {
        userRole = (user.email === "locoviber16@gmail.com") ? "owner" : "admin";
      } else {
        const { data: upRow } = await db.from("uploaders").select("user_id, group_no").eq("user_id", user.id).maybeSingle();
        userRole = upRow ? "uploader" : "student";
      }
    }
  } catch (e) {
    userRole = "student";
  }

  isOwner = (userRole === "owner");
  isAdmin = (userRole === "admin" || userRole === "owner");
  isUploader = (userRole === "uploader");

  if (isUploader) {
    try {
      const { data: upRecord } = await db.from("uploaders").select("group_no").eq("user_id", user.id).maybeSingle();
      uploaderGroup = upRecord?.group_no ?? null;
    } catch (e) {
      uploaderGroup = null;
    }
  } else {
    uploaderGroup = null;
  }
}

async function onUserSignedIn(session = null) {
  if (session && session.user) {
    currentUser = session.user;
    userGroupNo = currentUser.user_metadata?.group_no ? parseInt(currentUser.user_metadata.group_no, 10) : null;
    await determineUserRole(currentUser);
  }

  $("#authBox").style.display = "none";
  $("#heroLoggedInBadge").style.display = "block";
  $("#logoutBtn").style.display = "inline-flex";

  // إظهار رابط الإدارة للأدمن، المالك، ورافعي الملفات
  const canAccessAdmin = isAdmin || isUploader;
  $("#navAdminLink").style.display = canAccessAdmin ? "inline-flex" : "none";
  if (isUploader && !isAdmin) {
    $("#navAdminLink").textContent = `رفع الملفات (G${uploaderGroup || 'فوجك'})`;
  } else {
    $("#navAdminLink").textContent = "الإدارة";
  }

  // زر "فوجي" في الهيدر
  if (userGroupNo) {
    $("#myGroupBtn").textContent = `فوجي (G${userGroupNo})`;
    $("#myGroupBtn").href = `#/groupe/${userGroupNo}`;
    $("#myGroupBtn").style.display = "inline-flex";
  } else {
    $("#myGroupBtn").style.display = "none";
  }

  await loadFiles();

  if (redirectAfterLogin) {
    const target = redirectAfterLogin;
    redirectAfterLogin = null;
    window.location.hash = target;
  } else {
    handleRouting();
  }
}

function onUserSignedOut() {
  currentUser = null;
  userGroupNo = null;
  userRole = "anon";
  isAdmin = false;
  isOwner = false;
  isUploader = false;
  uploaderGroup = null;

  $("#authBox").style.display = "block";
  $("#heroLoggedInBadge").style.display = "none";
  $("#logoutBtn").style.display = "none";
  $("#navAdminLink").style.display = "none";
  $("#myGroupBtn").style.display = "none";
  loadFiles().then(() => handleRouting());
}

// ============================================================================
// 3) تحميل وعرض الملفات (Files & DB Logic)
// ============================================================================

async function loadFiles() {
  filesLoadError = null;
  if (!db) {
    files = [];
    filesLoadError = "ملاحظة: قاعدة بيانات Supabase غير متصلة حالياً (المفاتيح بحاجة للإعداد في app.js).";
  } else {
    try {
      const { data, error } = await db
        .from("files")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Error fetching files:", error);
        filesLoadError = "تعذر تحميل الملفات من الخادم: " + error.message;
        files = [];
      } else {
        files = data || [];
      }
    } catch (err) {
      filesLoadError = "حدث خطأ في الاتصال بالخادم: " + err.message;
      files = [];
    }
  }

  const countEl = $("#homeStatFiles");
  if (countEl) countEl.textContent = files.length;
}

// فتح / تحميل الملف برابط موقع آمن
async function openFile(f) {
  if (!db) {
    alert("يرجى إعداد مفاتيح Supabase لتتمكن من تحميل الملفات من التخزين السحابي.");
    return;
  }

  try {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(f.path, 3600);
    if (error) return alert("تعذر فتح الملف: " + error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert("حدث خطأ في فتح الملف: " + err.message);
  }
}

// فحص صلاحية حذف الملف
function canDeleteFile(f) {
  if (isAdmin || isOwner) return true;
  if (isUploader && uploaderGroup && f.group_no === uploaderGroup) return true;
  return false;
}

// حذف الملف
async function removeFile(f) {
  if (!confirm("هل أنت متأكد من حذف «" + f.title + "»؟")) return;

  if (!db) return;

  try {
    await db.storage.from(BUCKET).remove([f.path]);
  } catch (e) {
    console.warn("Storage remove warning:", e);
  }

  const { error } = await db.from("files").delete().eq("id", f.id);
  if (error) return alert("خطأ في حذف الملف: " + error.message);
  await loadFiles();
  handleRouting();
}

function createFileRow(f) {
  const row = document.createElement("div");
  row.className = "file-row";

  const kindLabel = KINDS[f.kind] || f.kind;
  const isRecent = f.created_at && (Date.now() - new Date(f.created_at).getTime() < 7 * 86400000);
  const groupLabel = f.group_no ? `G${f.group_no}` : "كل الدفعة";
  const dateStr = f.created_at ? new Date(f.created_at).toLocaleDateString("fr-DZ") : "";
  const meta = getSubjectMeta(f.subject);
  const allowDelete = canDeleteFile(f);

  row.innerHTML = `
    <div class="file-row-left">
      <span class="badge-kind ${escapeHtml(f.kind)}">${escapeHtml(kindLabel)}</span>
      <div class="file-main">
        <div class="file-title-wrap">
          <span class="file-title">${escapeHtml(f.title)}</span>
          ${isRecent ? '<span class="badge-new">جديد</span>' : ''}
        </div>
        <div class="file-meta">
          <span>${escapeHtml(meta.nameFr)}</span>
          <span>·</span>
          <span>${escapeHtml(f.semester || "S1")}</span>
          <span>·</span>
          <span class="file-group-chip">${escapeHtml(groupLabel)}</span>
          <span>·</span>
          <span>${escapeHtml(dateStr)}</span>
        </div>
      </div>
    </div>
    <div class="file-row-right">
      <button class="btn btn-primary btn-sm open-btn">فتح</button>
      ${allowDelete ? '<button class="btn btn-danger btn-sm del-btn">حذف</button>' : ''}
    </div>
  `;

  row.querySelector(".open-btn").onclick = () => openFile(f);
  if (allowDelete) {
    row.querySelector(".del-btn").onclick = () => removeFile(f);
  }

  return row;
}

// ============================================================================
// 4) موجه الهاش (Hash Router)
// المسارات: #/, #/groupes, #/groupe/N, #/cours, #/profs, #/profs/:id, #/fichiers, #/admin
// ============================================================================

window.addEventListener("hashchange", handleRouting);

function handleRouting() {
  const hash = window.location.hash || "#/";

  if (!hash.startsWith("#/")) {
    return;
  }

  window.scrollTo(0, 0);

  const cleanPath = hash.replace(/^#\//, "");
  const parts = cleanPath.split("/").filter(Boolean);

  updateNavHighlight(parts[0] || "home");

  // مسار الصفحة الرئيسية #/
  if (parts.length === 0) {
    showHomePage();
    return;
  }

  // المسار العام للأفواج #/groupes
  if (parts[0] === "groupes") {
    showGroupsListPage();
    return;
  }

  // مسار الأساتذة #/profs
  if (parts[0] === "profs" || parts[0] === "enseignants") {
    if (parts[1]) {
      showTeacherDetailPage(parts[1]);
    } else {
      showTeachersListPage();
    }
    return;
  }

  // فحص تسجيل الدخول للمسارات المحمية
  if (!currentUser) {
    redirectAfterLogin = hash;
    showHomePage();
    $("#authBox").style.display = "block";
    say($("#authMsg"), "سجّل الدخول باش تكمل");
    $("#email").focus();
    return;
  }

  // مسار الملفات العامة #/fichiers
  if (parts[0] === "fichiers") {
    showGlobalFilesPage();
    return;
  }

  // مسار لوحة الإدارة #/admin (للأدمن، المالك، ورافعي الملفات)
  if (parts[0] === "admin") {
    if (!isAdmin && !isUploader) {
      showErrorPage("صفحة خاصة بالمسؤولين فقط", "ليس لديك صلاحية الوصول لهذه الصفحة.");
      return;
    }
    showAdminPage();
    return;
  }

  // مسار الكور الموحد #/cours
  if (parts[0] === "cours") {
    const subjectParam = parts[1] || null;
    showCoursPage(null, subjectParam);
    return;
  }

  // مسارات الفوج: #/groupe/:num...
  if (parts[0] === "groupe") {
    const groupNum = parseInt(parts[1], 10);
    if (isNaN(groupNum) || groupNum < 1 || groupNum > 10) {
      show404Page();
      return;
    }

    if (parts[2] === "cours") {
      const subjectParam = parts[3] || null;
      showCoursPage(groupNum, subjectParam);
      return;
    }

    showGroupPage(groupNum);
    return;
  }

  show404Page();
}

function updateNavHighlight(section) {
  $$("#mainNav .nav-link").forEach((link) => link.classList.remove("active"));
  if (!section || section === "home") {
    $("#navHomeLink")?.classList.add("active");
  } else if (section === "groupes" || section === "groupe") {
    $("#navGroupesLink")?.classList.add("active");
  } else if (section === "profs" || section === "enseignants") {
    $("#navProfsLink")?.classList.add("active");
  } else if (section === "fichiers") {
    $("#navFilesLink")?.classList.add("active");
  } else if (section === "admin") {
    $("#navAdminLink")?.classList.add("active");
  }
}

// ----------------------------------------------------------------------------
// PAGE 1: HOME (#/)
// ----------------------------------------------------------------------------
function showHomePage() {
  document.title = "info cc 404 — منصة ملفات مهندس دولة في الإعلام الآلي";
  $("#homeView").style.display = "block";
  $("#dynamicView").innerHTML = "";

  const heading = document.querySelector(".hero-title");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus();
  }
}

// ----------------------------------------------------------------------------
// PAGE 2: GROUPS (#/groupes)
// ----------------------------------------------------------------------------
function showGroupsListPage() {
  document.title = "الأفواج العشرة | info cc 404";
  $("#homeView").style.display = "none";

  const container = $("#dynamicView");
  const timetable = (typeof window !== "undefined" && window.TIMETABLE) ? window.TIMETABLE : null;

  container.innerHTML = `
    <div style="padding: 10px 0 40px;">
      <div class="card-header" style="border: none; padding-bottom: 8px;">
        <div>
          <h1 id="groupesHeading" tabindex="-1" class="section-title" style="font-size: 1.8rem; margin: 0 0 6px;">
            الأفواج العشرة
          </h1>
          <p class="section-sub" style="margin: 0;">اضغط على فوجك لفتح صفحته ومتابعة الأساتذة والملفات:</p>
        </div>
      </div>

      <div class="groups-grid" style="grid-template-columns: repeat(5, 1fr); margin-bottom: 36px;">
        ${GROUPS.map((num) => {
          const isUser = userGroupNo === num;
          return `
            <a href="#/groupe/${num}" class="group-card ${isUser ? 'my-group' : ''}" style="padding: 18px 12px;">
              <div class="group-card-code">
                G${num}
                ${isUser ? '<span class="badge-mygroup" style="margin-right: 4px;">فوجك</span>' : ''}
              </div>
              <div class="group-card-name" style="margin: 4px 0 2px;">Groupe ${num}</div>
              <div class="group-card-count" style="color: var(--accent-btn); font-weight: 600;">افتح صفحة الفوج ←</div>
            </a>
          `;
        }).join("")}
      </div>

      <div class="general-timetable-card">
        <div class="general-timetable-header">
          <div>
            <h3>برنامج الحصص — ING1 السداسي 1 (2026/2027)</h3>
            <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary);">
              مخطط التوزيع الزمني الرسمي للمحاضرات والأعمال الموجهة والمخبرية.
            </p>
          </div>
          <a href="planning.pdf" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="فتح ملف PDF الأصلي">
            📄 فتح الـ PDF الأصلي
          </a>
        </div>

        <div class="general-timetable-table-wrap">
          <table class="timetable-full-table">
            <thead>
              <tr>
                <th style="width: 130px;">التوقيت</th>
                ${timetable ? timetable.days.map((d) => `<th>${escapeHtml(d)}</th>`).join("") : ""}
              </tr>
            </thead>
            <tbody>
              ${timetable ? timetable.slots.map((slot) => {
                if (slot.isLunch) {
                  return `
                    <tr class="lunch-row">
                      <td class="timetable-time-cell">${escapeHtml(slot.time)}</td>
                      <td colspan="5">${escapeHtml(slot.label)}</td>
                    </tr>
                  `;
                }
                return `
                  <tr>
                    <td class="timetable-time-cell">${escapeHtml(slot.time)}</td>
                    ${slot.cells.map((cell) => {
                      if (cell.subject === "-") {
                        return `<td class="dimmed-cell">-</td>`;
                      }
                      return `
                        <td class="timetable-session-cell">
                          <div class="session-name">${escapeHtml(cell.subject)}</div>
                          <div class="session-teacher-room">${escapeHtml(cell.teacher)} · ${escapeHtml(cell.room)}</div>
                        </td>
                      `;
                    }).join("")}
                  </tr>
                `;
              }).join("") : ""}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const h = $("#groupesHeading");
  if (h) h.focus();
}

// ----------------------------------------------------------------------------
// PAGE 3: GROUP PAGE (#/groupe/N)
// ----------------------------------------------------------------------------
function showGroupPage(groupNum) {
  document.title = `G${groupNum} | info cc 404`;
  $("#homeView").style.display = "none";

  const container = $("#dynamicView");
  const isStudentGroup = userGroupNo === groupNum;

  const teachersData = (typeof window !== "undefined" && window.GROUP_TEACHERS && window.GROUP_TEACHERS[groupNum])
    ? window.GROUP_TEACHERS[groupNum]
    : {};

  const groupFiles = files.filter((f) => {
    const isGrp = f.group_no === groupNum || f.group_no === null;
    return isGrp && f.kind !== "cours";
  });

  container.innerHTML = `
    <div style="padding: 10px 0 40px;">
      <nav class="breadcrumb-nav" aria-label="مسار التنقل">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/groupes">الأفواج</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">G${groupNum}</span>
      </nav>

      <div class="card-header" style="border: none; padding-bottom: 12px;">
        <div>
          <h1 id="groupHeading" tabindex="-1" class="section-title" style="margin: 0 0 6px;">
            الفوج G${groupNum} · Groupe ${groupNum}
            ${isStudentGroup ? '<span class="badge-mygroup" style="margin-right: 8px;">فوجك الدراسي</span>' : ''}
          </h1>
          <p class="section-sub" style="margin: 0;">
            جدول المواد وأساتذة الأعمال الموجهة والتطبيقية، وملفات الفوج. اضغط على اسم أي أستاذ لفتح صفحته.
          </p>
        </div>
      </div>

      <!-- 7 Subjects Card & Table -->
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 30px;">
        <div class="group-teachers-table-wrap" style="border: none; margin: 0;">
          <table class="group-teachers-table">
            <thead>
              <tr>
                <th>المادة</th>
                <th>أستاذ TD (فوجك)</th>
                <th>أستاذ TP (فوجك)</th>
                <th style="text-align: center;">الكور (موحد)</th>
              </tr>
            </thead>
            <tbody>
              ${SUBJECT_LIST.map((subj) => {
                const tInfo = teachersData[subj.id] || { td: null, tp: null };
                const tdSlug = tInfo.td ? slugify(tInfo.td) : null;
                const tpSlug = tInfo.tp ? slugify(tInfo.tp) : null;

                const tdDisplay = tInfo.td
                  ? `<div class="teacher-name-box">
                      <a href="#/profs/${tdSlug}" class="teacher-link" title="فتح صفحة الأستاذ">${escapeHtml(tInfo.td)}</a>
                      <span>${escapeHtml(tInfo.tdRoom || "")}</span>
                    </div>`
                  : `<span class="dimmed-cell">-</span>`;

                const tpDisplay = tInfo.tp
                  ? `<div class="teacher-name-box">
                      <a href="#/profs/${tpSlug}" class="teacher-link" title="فتح صفحة الأستاذ">${escapeHtml(tInfo.tp)}</a>
                      <span>${escapeHtml(tInfo.tpRoom || "")}</span>
                    </div>`
                  : `<span class="dimmed-cell">-</span>`;

                return `
                  <tr>
                    <td>
                      <div class="subject-cell-title">
                        <strong>${escapeHtml(subj.nameFr)}</strong>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(subj.nameAr)}</span>
                      </div>
                    </td>
                    <td>${tdDisplay}</td>
                    <td>${tpDisplay}</td>
                    <td style="text-align: center;">
                      <a href="#/groupe/${groupNum}/cours/${subj.id}" class="btn btn-primary btn-sm" title="فتح دروس الكور">
                        دروس الكور ←
                      </a>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>

        <!-- Mobile Stacked Cards for 7 Subjects -->
        <div class="group-teachers-mobile" style="padding: 14px;">
          ${SUBJECT_LIST.map((subj) => {
            const tInfo = teachersData[subj.id] || { td: null, tp: null };
            const tdSlug = tInfo.td ? slugify(tInfo.td) : null;
            const tpSlug = tInfo.tp ? slugify(tInfo.tp) : null;

            return `
              <div class="group-teacher-mobile-card">
                <div class="top-row">
                  <div>
                    <strong style="color: var(--text-main); font-size: 0.98rem;">${escapeHtml(subj.nameFr)}</strong>
                    <div style="font-size: 0.82rem; color: var(--text-secondary);">${escapeHtml(subj.nameAr)}</div>
                  </div>
                  <a href="#/groupe/${groupNum}/cours/${subj.id}" class="btn btn-primary btn-sm">
                    دروس الكور ←
                  </a>
                </div>
                <div class="info-grid">
                  <div>
                    <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">أستاذ TD:</span>
                    <strong>${tInfo.td ? `<a href="#/profs/${tdSlug}" class="teacher-link">${escapeHtml(tInfo.td)}</a> (${escapeHtml(tInfo.tdRoom || '')})` : '-'}</strong>
                  </div>
                  <div>
                    <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">أستاذ TP:</span>
                    <strong>${tInfo.tp ? `<a href="#/profs/${tpSlug}" class="teacher-link">${escapeHtml(tInfo.tp)}</a> (${escapeHtml(tInfo.tpRoom || '')})` : '-'}</strong>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <!-- Section: ملفات TD / TP والامتحانات تاع فوجك -->
      <div class="card" style="padding: 24px;">
        <div class="card-header" style="border: none; padding: 0 0 16px;">
          <div>
            <h2 class="section-title" style="margin: 0 0 4px; font-size: 1.3rem;">
              ملفات TD / TP والامتحانات تاع فوجك
            </h2>
            <p class="section-sub" style="margin: 0;">
              سلاسل التمارين والأعمال التطبيقية وحوليات الامتحانات الخاصة بالفوج ${groupNum}:
            </p>
          </div>
        </div>

        <div class="files-filter-bar" style="margin-bottom: 20px;">
          <input id="grpSearchInput" type="search" placeholder="ابحث في ملفات الفوج ${groupNum}..." aria-label="بحث في ملفات الفوج">
          <div class="type-chips-bar" id="grpTypeChips">
            <button class="type-chip-btn active" data-kind="">الكل (${groupFiles.length})</button>
            <button class="type-chip-btn" data-kind="td">TD</button>
            <button class="type-chip-btn" data-kind="tp">TP</button>
            <button class="type-chip-btn" data-kind="exam">Examen</button>
            <button class="type-chip-btn" data-kind="autre">Autre</button>
            <button class="btn btn-secondary btn-sm" id="grpResetBtn" style="margin-right: auto;">إعادة ضبط</button>
          </div>
        </div>

        <div id="grpFilesContainer"></div>
      </div>
    </div>
  `;

  const h = $("#groupHeading");
  if (h) h.focus();

  setupGroupFilesFilter(groupNum, groupFiles);
}

function setupGroupFilesFilter(groupNum, groupFiles) {
  let searchVal = "";
  let currentKind = "";

  const render = () => {
    const container = $("#grpFilesContainer");
    if (!container) return;

    const filtered = groupFiles.filter((f) => {
      const matchSearch = !searchVal || f.title.toLowerCase().includes(searchVal) || (f.subject && f.subject.toLowerCase().includes(searchVal));
      const matchKind = !currentKind || f.kind === currentKind;
      return matchSearch && matchKind;
    });

    container.innerHTML = "";

    if (!filtered.length) {
      container.innerHTML = `
        <div class="empty-box">
          <div class="empty-icon">📂</div>
          <strong style="color: var(--text-main); font-size: 1.05rem;">لا توجد ملفات متوفرة تطابق هذا البحث</strong>
          <p style="margin: 6px 0 14px;">جرب تغيير كلمة البحث أو اختيار كل الأنواع.</p>
        </div>
      `;
      return;
    }

    SUBJECT_LIST.forEach((subj) => {
      const items = filtered.filter((f) => normalizeSubjectId(f.subject) === subj.id);
      if (items.length) {
        const sec = document.createElement("div");
        sec.style.marginBottom = "24px";
        sec.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid var(--border);">
            <h3 style="margin:0; font-size:1.05rem; color:var(--text-main);">
              ${escapeHtml(subj.nameFr)} <span style="font-weight:normal; font-size:0.85rem; color:var(--text-secondary);">(${escapeHtml(subj.nameAr)})</span>
            </h3>
            <span style="font-size:0.82rem; font-weight:600; color:var(--accent-btn);">${items.length} ملف</span>
          </div>
          <div class="files-sublist"></div>
        `;
        const subList = sec.querySelector(".files-sublist");
        items.forEach((f) => subList.append(createFileRow(f)));
        container.append(sec);
      }
    });

    const otherItems = filtered.filter((f) => normalizeSubjectId(f.subject) === "autre");
    if (otherItems.length) {
      const sec = document.createElement("div");
      sec.style.marginBottom = "24px";
      sec.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid var(--border);">
          <h3 style="margin:0; font-size:1.05rem; color:var(--text-main);">Autre (ملفات أخرى)</h3>
          <span style="font-size:0.82rem; font-weight:600; color:var(--accent-btn);">${otherItems.length} ملف</span>
        </div>
        <div class="files-sublist"></div>
      `;
      const subList = sec.querySelector(".files-sublist");
      otherItems.forEach((f) => subList.append(createFileRow(f)));
      container.append(sec);
    }
  };

  const sInput = $("#grpSearchInput");
  if (sInput) {
    sInput.addEventListener("input", (e) => {
      searchVal = e.target.value.trim().toLowerCase();
      render();
    });
  }

  $$("#grpTypeChips .type-chip-btn").forEach((btn) => {
    btn.onclick = () => {
      $$("#grpTypeChips .type-chip-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentKind = btn.getAttribute("data-kind") || "";
      render();
    };
  });

  const resetBtn = $("#grpResetBtn");
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (sInput) sInput.value = "";
      searchVal = "";
      currentKind = "";
      $$("#grpTypeChips .type-chip-btn").forEach((b) => b.classList.toggle("active", b.getAttribute("data-kind") === ""));
      render();
    };
  }

  render();
}

// ----------------------------------------------------------------------------
// FEATURE A: TEACHER PAGES (#/profs AND #/profs/:id)
// ----------------------------------------------------------------------------
function showTeachersListPage() {
  document.title = "أساتذة الدفعة | info cc 404";
  $("#homeView").style.display = "none";

  const container = $("#dynamicView");
  const teachers = getTeachersData();

  container.innerHTML = `
    <div style="padding: 10px 0 40px;">
      <nav class="breadcrumb-nav" aria-label="مسار التنقل">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">الأساتذة</span>
      </nav>

      <div class="card-header" style="border: none; padding-bottom: 10px;">
        <div>
          <h1 id="teachersHeading" tabindex="-1" class="section-title" style="margin: 0 0 6px; font-size: 1.7rem;">
            أساتذة السداسي الأول (2026/2027)
          </h1>
          <p class="section-sub" style="margin: 0;">
            قائمة الأساتذة المحاضرين وأساتذة الأعمال الموجهة والمخبرية لدفعة مهندسي الإعلام الآلي:
          </p>
        </div>
      </div>

      <div class="profs-grid">
        ${teachers.map((prof) => {
          const subjectsTaught = Object.keys(prof.subjectsMap)
            .map((sId) => SUBJECT_LIST.find((s) => s.id === sId)?.nameFr || sId)
            .join(" · ");

          const hasLectures = prof.lectures.length > 0;
          const hasTd = prof.tds.length > 0;
          const hasTp = prof.tps.length > 0;

          const groupsTaughtSet = new Set();
          prof.tds.forEach((t) => groupsTaughtSet.add("G" + t.groupNo));
          prof.tps.forEach((t) => groupsTaughtSet.add("G" + t.groupNo));
          const groupsStr = groupsTaughtSet.size ? Array.from(groupsTaughtSet).join(", ") : "موحد (كل الأفواج)";

          const avatarInitials = prof.name.replace(/^(Mr|Mrs)\s+/, "").slice(0, 2).toUpperCase();

          return `
            <div class="prof-card">
              <div>
                <div class="prof-card-top">
                  <div class="prof-avatar">${escapeHtml(avatarInitials)}</div>
                  <div class="prof-card-info">
                    <h3>${escapeHtml(prof.name)}</h3>
                    <p>${escapeHtml(subjectsTaught)}</p>
                  </div>
                </div>

                <div class="prof-tags">
                  ${hasLectures ? '<span class="prof-tag cours-tag">محاضر (Cours)</span>' : ''}
                  ${hasTd ? '<span class="prof-tag">أعمال موجهة (TD)</span>' : ''}
                  ${hasTp ? '<span class="prof-tag">أعمال تطبيقية (TP)</span>' : ''}
                </div>
              </div>

              <div class="prof-stats-strip">
                <div>الأفواج: <strong>${escapeHtml(groupsStr)}</strong></div>
              </div>

              <div class="prof-card-footer">
                <a href="#/profs/${prof.slug}" class="btn btn-primary btn-sm" style="width: 100%; text-align: center; justify-content: center;">
                  عرض الحصص والملفات ←
                </a>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  const h = $("#teachersHeading");
  if (h) h.focus();
}

function showTeacherDetailPage(teacherSlug) {
  const teachers = getTeachersData();
  const prof = teachers.find((t) => t.slug === teacherSlug);

  if (!prof) {
    show404Page();
    return;
  }

  document.title = `${prof.name} | info cc 404`;
  $("#homeView").style.display = "none";

  const container = $("#dynamicView");

  // ملفات المواد التي يدرّسها هذا الأستاذ
  const teacherSubjectIds = Object.keys(prof.subjectsMap);
  const teacherFiles = files.filter((f) => {
    const normId = normalizeSubjectId(f.subject);
    return teacherSubjectIds.includes(normId);
  });

  const avatarInitials = prof.name.replace(/^(Mr|Mrs)\s+/, "").slice(0, 2).toUpperCase();

  container.innerHTML = `
    <div style="padding: 10px 0 40px;">
      <nav class="breadcrumb-nav" aria-label="مسار التنقل">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/profs">الأساتذة</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">${escapeHtml(prof.name)}</span>
      </nav>

      <!-- Profile Header Box -->
      <div class="card" style="padding: 24px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="prof-avatar" style="width: 56px; height: 56px; font-size: 1.3rem;">
              ${escapeHtml(avatarInitials)}
            </div>
            <div>
              <h1 id="profDetailHeading" tabindex="-1" class="section-title" style="margin: 0 0 4px; font-size: 1.6rem;">
                ${escapeHtml(prof.name)}
              </h1>
              <p style="margin: 0; color: var(--text-secondary); font-size: 0.92rem;">
                ${escapeHtml(prof.titleAr)} في قسم الإعلام الآلي · السداسي الأول
              </p>
            </div>
          </div>
          <a href="#/profs" class="btn btn-secondary btn-sm">
            ← رجوع لكافة الأساتذة
          </a>
        </div>
      </div>

      <!-- Schedule Breakdown Table -->
      <div class="card" style="padding: 24px; margin-bottom: 24px;">
        <h2 style="font-size: 1.25rem; margin: 0 0 8px; color: var(--text-main);">
          توزيع الحصص والقاعات (Emploi du Temps)
        </h2>
        <p style="margin: 0 0 16px; font-size: 0.88rem; color: var(--text-secondary);">
          تفاصيل المحاضرات والأعمال الموجهة والمخبرية المسندة للأستاذ حسب الوثيقة الرسمية:
        </p>

        <div class="prof-schedule-table-wrap">
          <table class="prof-schedule-table">
            <thead>
              <tr>
                <th style="width: 140px;">النوع (Type)</th>
                <th>المادة (Module)</th>
                <th>الأفواج المعنية (Groupes)</th>
                <th>القاعة / المخبر (Salle / Lab)</th>
              </tr>
            </thead>
            <tbody>
              ${prof.lectures.map((lec) => `
                <tr>
                  <td><span class="badge-kind cours">Cours</span></td>
                  <td><strong>${escapeHtml(lec.nameFr)}</strong> (${escapeHtml(lec.nameAr)})</td>
                  <td><strong>كل الأفواج (G1 - G10)</strong></td>
                  <td>${escapeHtml(lec.room)}</td>
                </tr>
              `).join("")}

              ${prof.tds.map((td) => `
                <tr>
                  <td><span class="badge-kind td">TD</span></td>
                  <td><strong>${escapeHtml(td.nameFr)}</strong> (${escapeHtml(td.nameAr)})</td>
                  <td><a href="#/groupe/${td.groupNo}" class="teacher-link">الفوج G${td.groupNo}</a></td>
                  <td>${escapeHtml(td.room)}</td>
                </tr>
              `).join("")}

              ${prof.tps.map((tp) => `
                <tr>
                  <td><span class="badge-kind tp">TP</span></td>
                  <td><strong>${escapeHtml(tp.nameFr)}</strong> (${escapeHtml(tp.nameAr)})</td>
                  <td><a href="#/groupe/${tp.groupNo}" class="teacher-link">الفوج G${tp.groupNo}</a></td>
                  <td>${escapeHtml(tp.room)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Files for Teacher's Modules -->
      <div class="card" style="padding: 24px;">
        <div class="card-header" style="border: none; padding: 0 0 14px;">
          <div>
            <h2 style="font-size: 1.25rem; margin: 0 0 4px; color: var(--text-main);">
              ملفات المقاييس التابعة للأستاذ (${teacherFiles.length} ملف)
            </h2>
            <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary);">
              المحاضرات وسلاسل التمارين والأعمال التطبيقية المتعلقة بمقاييس الأستاذ:
            </p>
          </div>
        </div>

        <div id="profFilesList">
          ${teacherFiles.length
            ? ""
            : `
              <div class="empty-box">
                <div class="empty-icon">📂</div>
                <strong style="color: var(--text-main); font-size: 1.05rem;">لا توجد ملفات مرفوعة لهذه المقاييس حالياً</strong>
                <p style="margin: 6px 0 14px;">ستظهر الملفات هنا فور رفعها من المشرف أو رافعي ملفات الأفواج.</p>
              </div>
            `
          }
        </div>
      </div>
    </div>
  `;

  const listEl = $("#profFilesList");
  if (listEl && teacherFiles.length) {
    teacherFiles.forEach((f) => listEl.append(createFileRow(f)));
  }

  const h = $("#profDetailHeading");
  if (h) h.focus();
}

// ----------------------------------------------------------------------------
// PAGE 4: COURS (#/groupe/N/cours OR #/cours)
// ----------------------------------------------------------------------------
function showCoursPage(groupNum = null, subjectParam = null) {
  $("#homeView").style.display = "none";
  const container = $("#dynamicView");

  if (subjectParam) {
    showSubjectCoursDetailPage(groupNum, subjectParam);
    return;
  }

  document.title = "الكور — موحد لكل الأفواج | info cc 404";

  const breadcrumbHtml = groupNum
    ? `
      <nav class="breadcrumb-nav" aria-label="مسار التنقل">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/groupes">الأفواج</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/groupe/${groupNum}">G${groupNum}</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">الكور</span>
      </nav>
    `
    : `
      <nav class="breadcrumb-nav" aria-label="مسار التنقل">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">الكور (موحد لكل الأفواج)</span>
      </nav>
    `;

  container.innerHTML = `
    <div style="padding: 10px 0 40px;">
      ${breadcrumbHtml}

      <div class="card-header" style="border: none; padding-bottom: 10px;">
        <div>
          <h1 id="coursHeading" tabindex="-1" class="section-title" style="margin: 0 0 4px; font-size: 1.6rem;">
            الكور — موحد لكل الأفواج
          </h1>
          <p class="section-sub" style="margin: 0;">
            محاضرات السداسي الأول الموحدة لكافة طلبة السنة الأولى مهندس دولة:
          </p>
        </div>
      </div>

      <div class="cours-grid">
        ${SUBJECT_LIST.map((subj) => {
          const coursFilesCount = files.filter((f) => normalizeSubjectId(f.subject) === subj.id && f.kind === "cours").length;
          const targetHref = groupNum
            ? `#/groupe/${groupNum}/cours/${subj.id}`
            : `#/cours/${subj.id}`;

          return `
            <div class="cours-subject-card">
              <div class="cours-subject-header">
                <h3>${escapeHtml(subj.nameFr)}</h3>
                <p>${escapeHtml(subj.nameAr)}</p>
              </div>

              <div class="cours-teacher-info">
                أستاذ الكور: <strong>${escapeHtml(subj.lectureTeacher)}</strong>
              </div>

              <div class="cours-card-footer">
                <span class="cours-count-badge">${coursFilesCount} محاضرات</span>
                <a href="${targetHref}" class="btn btn-primary btn-sm">
                  فتح ملفات الكور ←
                </a>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  const h = $("#coursHeading");
  if (h) h.focus();
}

function showSubjectCoursDetailPage(groupNum, subjectParam) {
  const subjMeta = getSubjectMeta(subjectParam);
  document.title = `الكور · ${subjMeta.nameFr} | info cc 404`;

  const container = $("#dynamicView");

  const coursFiles = files.filter((f) => {
    return normalizeSubjectId(f.subject) === subjMeta.id && f.kind === "cours";
  });

  const backUrl = groupNum ? `#/groupe/${groupNum}` : `#/cours`;
  const backLabel = groupNum ? `← رجوع لصفحة الفوج ${groupNum}` : `← رجوع لقائمة الكور`;

  const breadcrumbHtml = groupNum
    ? `
      <nav class="breadcrumb-nav" aria-label="مسار التنقل">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/groupes">الأفواج</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/groupe/${groupNum}">G${groupNum}</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/groupe/${groupNum}/cours">الكور</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">${escapeHtml(subjMeta.nameFr)}</span>
      </nav>
    `
    : `
      <nav class="breadcrumb-nav" aria-label="مسار التنقل">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <a href="#/cours">الكور</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">${escapeHtml(subjMeta.nameFr)}</span>
      </nav>
    `;

  container.innerHTML = `
    <div style="padding: 10px 0 40px;">
      ${breadcrumbHtml}

      <div class="subject-detail-box">
        <div class="subject-detail-header">
          <div>
            <h1 id="subCoursHeading" tabindex="-1" style="margin: 0 0 6px; font-size: 1.45rem;">
              محاضرات الكور · ${escapeHtml(subjMeta.nameFr)} (${escapeHtml(subjMeta.nameAr)})
            </h1>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">
              الأستاذ المحاضر: <strong>${escapeHtml(subjMeta.lectureTeacher)}</strong> · الكور موحد لكافة الأفواج
            </p>
          </div>
          <a href="${backUrl}" class="back-to-group-btn">
            ${backLabel}
          </a>
        </div>
      </div>

      <div class="card" style="padding: 24px;">
        <h2 style="font-size: 1.15rem; margin: 0 0 16px;">الملفات المتاحة (${coursFiles.length} ملف)</h2>
        <div id="coursFilesList">
          ${coursFiles.length
            ? ""
            : `
              <div class="empty-box">
                <div class="empty-icon">📂</div>
                <strong style="color: var(--text-main); font-size: 1.05rem;">لا توجد محاضرات مرفوعة لهذه المادة حتى الآن</strong>
                <p style="margin: 6px 0 14px;">سيتم إضافة المحاضرات فور نشرها من طرف الأستاذ.</p>
                <a href="${backUrl}" class="btn btn-secondary btn-sm">${backLabel}</a>
              </div>
            `
          }
        </div>
      </div>
    </div>
  `;

  const listEl = $("#coursFilesList");
  if (listEl && coursFiles.length) {
    coursFiles.forEach((f) => listEl.append(createFileRow(f)));
  }

  const h = $("#subCoursHeading");
  if (h) h.focus();
}

// ----------------------------------------------------------------------------
// PAGE 5: GLOBAL FILES (#/fichiers)
// ----------------------------------------------------------------------------
function showGlobalFilesPage() {
  document.title = "الملفات والموارد الدراسية | info cc 404";
  $("#homeView").style.display = "none";

  const container = $("#dynamicView");

  container.innerHTML = `
    <div style="padding: 10px 0 40px;">
      <nav class="breadcrumb-nav" aria-label="مسار التنقل">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">جميع الملفات</span>
      </nav>

      <div class="card-header" style="border: none; padding-bottom: 0;">
        <div>
          <h1 id="filesHeading" tabindex="-1" class="section-title">الملفات والموارد الدراسية</h1>
          <p class="section-sub">تصفح وفلترة جميع ملفات الدروس، الأعمال الموجهة، التطبيقية والامتحانات.</p>
        </div>
      </div>

      ${filesLoadError ? `
        <div class="error-banner">
          <div class="error-banner-text">⚠️ ${escapeHtml(filesLoadError)}</div>
          <button class="btn btn-secondary btn-sm" onclick="loadFiles().then(() => showGlobalFilesPage())">إعادة المحاولة</button>
        </div>
      ` : ''}

      <div class="files-filter-bar">
        <input id="q" type="search" placeholder="ابحث باسم الملف، الأستاذ أو الكلمة المفتاحية..." aria-label="بحث في الملفات">

        <div class="filters-row">
          <select id="fSem" aria-label="السداسي">
            <option value="">كل السداسيات</option>
            <option value="S1">S1</option>
            <option value="S2">S2</option>
            <option value="Annuel">Annuel</option>
          </select>
          <select id="fSubject" aria-label="المادة">
            <option value="">كل المواد</option>
            ${SUBJECT_LIST.map((s) => `<option value="${s.id}">${escapeHtml(s.nameFr)} (${escapeHtml(s.nameAr)})</option>`).join("")}
            <option value="autre">Autre (مادة أخرى)</option>
          </select>
          <select id="fKind" aria-label="النوع">
            <option value="">كل الأنواع</option>
            <option value="cours">Cours</option>
            <option value="td">TD</option>
            <option value="tp">TP</option>
            <option value="exam">Examen</option>
            <option value="autre">Autre</option>
          </select>
          <select id="fGroup" aria-label="الفوج">
            <option value="">كل الأفواج (G1 - G10)</option>
            ${GROUPS.map((g) => `<option value="${g}">Groupe ${g} (G${g})</option>`).join("")}
          </select>
        </div>

        <div class="files-summary">
          <span id="filesCount">${files.length} ملف متوفر</span>
          <button id="resetFiltersBtn" class="btn btn-ghost btn-sm" style="text-decoration: underline;">إعادة ضبط الفلاتر</button>
        </div>
      </div>

      <div class="files-list" id="filesList"></div>
    </div>
  `;

  const h = $("#filesHeading");
  if (h) h.focus();

  const filterAndDraw = () => {
    const q = ($("#q")?.value || "").trim().toLowerCase();
    const sem = $("#fSem")?.value || "";
    const sub = $("#fSubject")?.value || "";
    const kind = $("#fKind")?.value || "";
    const grp = $("#fGroup")?.value || "";

    const rows = files.filter((f) => {
      const normSub = normalizeSubjectId(f.subject);
      const matchQ = !q || f.title.toLowerCase().includes(q) || (f.subject && f.subject.toLowerCase().includes(q));
      const matchSem = !sem || f.semester === sem;
      const matchSub = !sub || normSub === sub;
      const matchKind = !kind || f.kind === kind;

      let matchGroup = true;
      if (grp) {
        const gNum = parseInt(grp, 10);
        matchGroup = f.group_no === gNum || f.group_no === null;
      }

      return matchQ && matchSem && matchSub && matchKind && matchGroup;
    });

    const countEl = $("#filesCount");
    if (countEl) countEl.textContent = `${rows.length} ملف متوفر`;

    const listEl = $("#filesList");
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!rows.length) {
      listEl.innerHTML = `
        <div class="empty-box">
          <div class="empty-icon">📂</div>
          <strong style="color: var(--text-main); font-size: 1.05rem;">لم يتم العثور على أي ملفات</strong>
          <p style="margin: 6px 0 14px;">جرب تعديل كلمات البحث أو اختيار 'كل المواد' لإظهار المزيد من النتائج.</p>
        </div>
      `;
      return;
    }

    rows.forEach((f) => listEl.append(createFileRow(f)));
  };

  ["#q", "#fSem", "#fSubject", "#fKind", "#fGroup"].forEach((id) => {
    $(id)?.addEventListener("input", filterAndDraw);
  });

  $("#resetFiltersBtn")?.addEventListener("click", () => {
    $("#q").value = "";
    $("#fSem").value = "";
    $("#fSubject").value = "";
    $("#fKind").value = "";
    $("#fGroup").value = "";
    filterAndDraw();
  });

  filterAndDraw();
}

// ----------------------------------------------------------------------------
// PAGE 6: ADMIN PAGE (#/admin)
// Supports Owner User Management (Feature B), Admin upload, and Uploader flow
// ----------------------------------------------------------------------------
let currentAdminTab = "upload"; // 'upload' | 'users' | 'manage'

function showAdminPage() {
  document.title = "لوحة الإدارة | info cc 404";
  $("#homeView").style.display = "none";

  const container = $("#dynamicView");

  // عنوان وتفاصيل الرتبة
  let roleBadgeText = "مشرف (Admin)";
  if (isOwner) roleBadgeText = "المالك (Owner)";
  else if (isUploader) roleBadgeText = `رافع ملفات (الفوج G${uploaderGroup || 'الكل'})`;

  container.innerHTML = `
    <div style="padding: 10px 0 40px;">
      <nav class="breadcrumb-nav" aria-label="مسار التنقل">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">لوحة الإدارة</span>
      </nav>

      <div class="card-header" style="border: none; padding-bottom: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; width: 100%;">
          <div>
            <h1 id="adminHeading" tabindex="-1" style="font-size: 1.45rem; margin: 0 0 4px;">
              لوحة الإدارة والرفع
            </h1>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">
              صلاحيتك الحالية: <span class="role-badge ${isOwner ? 'role-owner' : (isAdmin ? 'role-admin' : 'role-uploader')}">${escapeHtml(roleBadgeText)}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Tab Bar (Only visible if owner or admin) -->
      ${isAdmin ? `
        <div class="admin-tab-bar">
          <button class="admin-tab-btn ${currentAdminTab === 'upload' ? 'active' : ''}" id="tabAdminUpload">
            📤 رفع ملف جديد
          </button>
          ${isOwner ? `
            <button class="admin-tab-btn ${currentAdminTab === 'users' ? 'active' : ''}" id="tabAdminUsers">
              👥 إدارة الرتب والمستخدمين
            </button>
          ` : ''}
          <button class="admin-tab-btn ${currentAdminTab === 'manage' ? 'active' : ''}" id="tabAdminManage">
            📁 إدارة الملفات المرفوعة (${files.length})
          </button>
        </div>
      ` : ''}

      <!-- TAB 1: UPLOAD FORM -->
      <div id="adminUploadSection" style="${currentAdminTab === 'upload' ? 'display: block;' : 'display: none;'}">
        <section class="card admin-card">
          <div class="card-header">
            <div>
              <h2 style="font-size: 1.2rem; margin: 0 0 4px;">رفع ملف جديد</h2>
              <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary);">
                ${isUploader && !isAdmin
                  ? `أنت مفوض لرفع ملفات الفوج G${uploaderGroup || 'الكل'}. سيتم توجيه الملف تلقائياً لفوجك.`
                  : 'رفع ملفات الدروس والتمارين وتوجيهها للدفعة كاملة أو لفوج معين.'}
              </p>
            </div>
          </div>

          <form id="upForm">
            <div class="grid-2">
              <div class="form-group" style="grid-column: 1 / -1;">
                <label for="upTitle">عنوان الملف الكامل</label>
                <input id="upTitle" required placeholder="مثال: TD 1 - Algorithmique et Structures de Données">
              </div>

              <div class="form-group">
                <label for="upSubject">المادة الدراسية (Subject)</label>
                <select id="upSubject" required>
                  <option value="">اختر المادة...</option>
                  ${SUBJECT_LIST.map((s) => `<option value="${s.id}">${escapeHtml(s.nameFr)} — ${escapeHtml(s.nameAr)} (${escapeHtml(s.lectureTeacher)})</option>`).join("")}
                  <option value="autre">Autre — مادة أخرى</option>
                </select>
              </div>

              <div class="form-group">
                <label for="upSem">السداسي (Semestre)</label>
                <select id="upSem">
                  <option value="S1">S1</option>
                  <option value="S2">S2</option>
                  <option value="Annuel">Annuel</option>
                </select>
              </div>

              <div class="form-group">
                <label for="upKind">نوع الوثيقة</label>
                <select id="upKind">
                  ${!isUploader || isAdmin ? '<option value="cours">Cours</option>' : ''}
                  <option value="td">TD</option>
                  <option value="tp">TP</option>
                  <option value="exam">Examen</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <!-- Group Select: Restricted if uploader -->
              <div class="form-group" id="upGroupWrap">
                <label for="upGroup">الفوج المستهدف (Groupe)</label>
                ${isUploader && !isAdmin && uploaderGroup ? `
                  <input type="text" id="upGroupDisplay" disabled value="Groupe ${uploaderGroup} (G${uploaderGroup}) — مفوض لفوجك" style="background: var(--bg-page);">
                  <input type="hidden" id="upGroup" value="${uploaderGroup}">
                ` : `
                  <select id="upGroup">
                    <option value="">كل الأفواج (All groups)</option>
                    ${GROUPS.map((g) => `<option value="${g}">Groupe ${g} (G${g})</option>`).join("")}
                  </select>
                `}
              </div>

              <div class="form-group" style="grid-column: 1 / -1;">
                <label for="upFile">اختر الملف للرفع (PDF, ZIP, DOCX...)</label>
                <input id="upFile" type="file" required>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="upSubmitBtn">
              رفع الملف الآن
            </button>
            <p id="upMsg" class="msg-text"></p>
          </form>
        </section>
      </div>

      <!-- TAB 2: USER & ROLE MANAGEMENT (Owner Only - Feature B) -->
      ${isOwner ? `
        <div id="adminUsersSection" style="${currentAdminTab === 'users' ? 'display: block;' : 'display: none;'}">
          <section class="card" style="padding: 24px;">
            <div class="card-header" style="border: none; padding: 0 0 14px;">
              <div>
                <h2 style="font-size: 1.25rem; margin: 0 0 4px;">إدارة المستخدمين والرتب المفوضة</h2>
                <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary);">
                  تعيين مندوبي الأفواج بصلاحية رافع ملفات (Uploader) وتفويض المهام:
                </p>
              </div>
              <button class="btn btn-secondary btn-sm" id="refreshUsersBtn">تحديث القائمة</button>
            </div>

            <div id="usersListContainer">
              <p style="color: var(--text-secondary);">جاري تحميل قائمة المستخدمين...</p>
            </div>
          </section>
        </div>
      ` : ''}

      <!-- TAB 3: MANAGE UPLOADED FILES -->
      <div id="adminManageSection" style="${(currentAdminTab === 'manage' || !isAdmin) ? 'display: block;' : 'display: none;'}">
        <section class="card" style="margin-top: ${isAdmin ? '0' : '24px'}; padding: 24px;">
          <div class="card-header" style="border: none; padding: 0 0 14px;">
            <div>
              <h2 style="font-size: 1.2rem; margin: 0 0 4px;">إدارة وحذف الملفات المرفوعة</h2>
              <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">
                ${isUploader && !isAdmin
                  ? `يمكنك إدارة وحذف الملفات التابعة لفوجك G${uploaderGroup || 'الكل'}.`
                  : 'حذف وتعديل الملفات المرفوعة على المنصة.'}
              </p>
            </div>
          </div>
          <div class="files-list" id="adminFilesList"></div>
        </section>
      </div>
    </div>
  `;

  const h = $("#adminHeading");
  if (h) h.focus();

  // تبديل التبويبات
  const setTab = (tab) => {
    currentAdminTab = tab;
    $$(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
    if (tab === "upload") $("#tabAdminUpload")?.classList.add("active");
    if (tab === "users") $("#tabAdminUsers")?.classList.add("active");
    if (tab === "manage") $("#tabAdminManage")?.classList.add("active");

    $("#adminUploadSection").style.display = (tab === "upload") ? "block" : "none";
    if ($("#adminUsersSection")) $("#adminUsersSection").style.display = (tab === "users") ? "block" : "none";
    $("#adminManageSection").style.display = (tab === "manage") ? "block" : "none";

    if (tab === "users") loadOwnerUsersList();
  };

  $("#tabAdminUpload")?.addEventListener("click", () => setTab("upload"));
  $("#tabAdminUsers")?.addEventListener("click", () => setTab("users"));
  $("#tabAdminManage")?.addEventListener("click", () => setTab("manage"));

  // إخفاء حقل الفوج عندما يكون نوع الملف Cours
  const upKindSelect = $("#upKind");
  const upGroupWrap = $("#upGroupWrap");

  const toggleGroupSelect = () => {
    if (!upKindSelect || !upGroupWrap) return;
    if (upKindSelect.value === "cours") {
      upGroupWrap.style.display = "none";
      const gInput = $("#upGroup");
      if (gInput) gInput.value = "";
    } else {
      upGroupWrap.style.display = "block";
    }
  };

  if (upKindSelect) {
    upKindSelect.addEventListener("change", toggleGroupSelect);
    toggleGroupSelect();
  }

  // ملء قائمة إدارة الملفات
  const adminFilesList = $("#adminFilesList");
  if (adminFilesList) {
    adminFilesList.innerHTML = "";
    const manageableFiles = files.filter(canDeleteFile);
    if (!manageableFiles.length) {
      adminFilesList.innerHTML = `
        <div class="empty-box" style="padding: 24px;">
          <p style="margin: 0; color: var(--text-secondary);">لا توجد ملفات مرفوعة تحت إدارتك حالياً.</p>
        </div>
      `;
    } else {
      manageableFiles.forEach((f) => adminFilesList.append(createFileRow(f)));
    }
  }

  // ربط نموذج الرفع
  $("#upForm").onsubmit = async (e) => {
    e.preventDefault();
    const file = $("#upFile").files[0];
    const msg = $("#upMsg");
    if (!file) return;

    if (!db) {
      return say(msg, "يرجى ربط إعدادات Supabase أولاً للتمكن من رفع الملفات.");
    }

    say(msg, "جاري رفع الملف إلى التخزين السحابي...", true);

    const ext = file.name.includes(".") ? "." + file.name.split(".").pop().toLowerCase() : "";
    const cleanBase = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45) || "file";
    const path = `${Date.now()}_${cleanBase}${ext}`;

    const title = $("#upTitle").value.trim();
    const subject = $("#upSubject").value;
    const semester = $("#upSem").value;
    const kind = $("#upKind").value;

    let group_no = null;
    if (kind !== "cours") {
      const gVal = $("#upGroup")?.value;
      if (gVal) group_no = parseInt(gVal, 10);
    }

    if (!subject) {
      return say(msg, "يرجى اختيار المادة الدراسية.");
    }

    const { error: upErr } = await db.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

    if (upErr) return say(msg, "خطأ في رفع الملف: " + upErr.message);

    const { error: insErr } = await db.from("files").insert({
      title,
      subject,
      semester,
      kind,
      group_no,
      path
    });

    if (insErr) {
      await db.storage.from(BUCKET).remove([path]);
      return say(msg, "خطأ في تسجيل الملف: " + insErr.message);
    }

    say(msg, "تم الرفع بنجاح ✓", true);
    e.target.reset();
    setTimeout(() => {
      say(msg, "");
      loadFiles().then(() => showAdminPage());
    }, 800);
  };

  if (currentAdminTab === "users" && isOwner) {
    loadOwnerUsersList();
  }
}

// دالة تحميل وإدارة المستخدمين للمالك (Feature B: Owner User Management)
async function loadOwnerUsersList() {
  const container = $("#usersListContainer");
  if (!container || !db) return;

  container.innerHTML = `<p style="color: var(--text-secondary);">جاري الاتصال بـ Supabase واسترجاع الحسابات...</p>`;

  try {
    const { data: users, error } = await db.rpc("owner_list_users");

    if (error) {
      container.innerHTML = `
        <div class="empty-box" style="padding: 24px;">
          <strong style="color: var(--danger);">تعذر استرجاع المستخدمين</strong>
          <p style="margin: 6px 0 0; font-size: 0.88rem; color: var(--text-secondary);">${escapeHtml(error.message)}</p>
          <p style="font-size: 0.82rem; color: var(--text-secondary);">تأكد من تطبيق كود supabase.sql v3 كاملاً في لوحة تحكم Supabase.</p>
        </div>
      `;
      return;
    }

    if (!users || !users.length) {
      container.innerHTML = `
        <div class="empty-box" style="padding: 24px;">
          <p style="margin: 0; color: var(--text-secondary);">لا يوجد مستخدمون مسجلون بعد.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="users-table-wrap">
        <table class="users-table">
          <thead>
            <tr>
              <th>البريد الإلكتروني</th>
              <th>تاريخ التسجيل</th>
              <th>الرتبة</th>
              <th>الفوج المفوض</th>
              <th>الإجراءات والتفويض</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((u) => {
              const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString("fr-DZ") : "-";
              let roleBadge = `<span class="role-badge role-student">طالب</span>`;
              if (u.role === "owner") roleBadge = `<span class="role-badge role-owner">المالك</span>`;
              else if (u.role === "admin") roleBadge = `<span class="role-badge role-admin">مشرف</span>`;
              else if (u.role === "uploader") roleBadge = `<span class="role-badge role-uploader">رافع ملفات</span>`;

              const groupStr = u.group_no ? `Groupe ${u.group_no} (G${u.group_no})` : (u.role === "uploader" ? "كل الأفواج" : "-");

              const isOwnerRow = u.role === "owner";

              return `
                <tr data-user-id="${escapeHtml(u.id)}">
                  <td><strong>${escapeHtml(u.email)}</strong></td>
                  <td style="color: var(--text-secondary); font-size: 0.84rem;">${escapeHtml(dateStr)}</td>
                  <td>${roleBadge}</td>
                  <td><strong>${escapeHtml(groupStr)}</strong></td>
                  <td>
                    ${isOwnerRow ? '<span style="color: var(--text-secondary); font-size: 0.8rem;">— الحساب الرئيسي —</span>' : `
                      <div style="display: flex; gap: 8px; align-items: center;">
                        <select class="user-group-select" style="padding: 4px 8px; font-size: 0.82rem; border-radius: 4px;">
                          ${GROUPS.map((g) => `<option value="${g}" ${u.group_no === g ? 'selected' : ''}>فوج G${g}</option>`).join("")}
                        </select>
                        <button class="btn btn-secondary btn-sm set-uploader-btn" data-id="${escapeHtml(u.id)}">
                          ${u.role === "uploader" ? 'تحديث الفوج' : 'تعيين كرافع'}
                        </button>
                        ${u.role === "uploader" ? `
                          <button class="btn btn-danger btn-sm remove-uploader-btn" data-id="${escapeHtml(u.id)}">
                            إلغاء
                          </button>
                        ` : ''}
                      </div>
                    `}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;

    // ربط أزرار التعيين والإلغاء
    container.querySelectorAll(".set-uploader-btn").forEach((btn) => {
      btn.onclick = async () => {
        const uId = btn.getAttribute("data-id");
        const row = btn.closest("tr");
        const select = row.querySelector(".user-group-select");
        const grpVal = parseInt(select.value, 10);

        btn.disabled = true;
        btn.textContent = "جاري التعيين...";

        try {
          const { error: setErr } = await db.rpc("owner_set_uploader", {
            p_user: uId,
            p_group: grpVal
          });

          if (setErr) {
            alert("خطأ في التعيين: " + setErr.message);
          } else {
            alert(`تم تعيين الطالب كرافع ملفات للفوج G${grpVal} بنجاح ✓`);
            loadOwnerUsersList();
          }
        } catch (e) {
          alert("حدث خطأ: " + e.message);
        } finally {
          btn.disabled = false;
        }
      };
    });

    container.querySelectorAll(".remove-uploader-btn").forEach((btn) => {
      btn.onclick = async () => {
        const uId = btn.getAttribute("data-id");
        if (!confirm("هل أنت متأكد من إلغاء صلاحية رافع الملفات لهذا الطالب؟")) return;

        btn.disabled = true;
        btn.textContent = "جاري الإلغاء...";

        try {
          const { error: remErr } = await db.rpc("owner_remove_uploader", {
            p_user: uId
          });

          if (remErr) {
            alert("خطأ في الإلغاء: " + remErr.message);
          } else {
            alert("تم إلغاء الصلاحية بنجاح ✓");
            loadOwnerUsersList();
          }
        } catch (e) {
          alert("حدث خطأ: " + e.message);
        } finally {
          btn.disabled = false;
        }
      };
    });

    $("#refreshUsersBtn")?.addEventListener("click", loadOwnerUsersList);

  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">خطأ: ${escapeHtml(err.message)}</p>`;
  }
}

// ----------------------------------------------------------------------------
// ERROR & 404 PAGES
// ----------------------------------------------------------------------------
function show404Page() {
  document.title = "404 | الصفحة غير موجودة";
  $("#homeView").style.display = "none";

  const container = $("#dynamicView");
  container.innerHTML = `
    <div style="padding: 20px 0 60px;">
      <nav class="breadcrumb-nav">
        <a href="#/">الرئيسية</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-active">404</span>
      </nav>

      <div class="empty-box" style="padding: 60px 20px;">
        <div class="empty-icon">⚠️</div>
        <h2 id="errHeading" tabindex="-1" style="font-size: 1.4rem; color: var(--text-main); margin: 0 0 10px;">
          عذراً، هذه الصفحة أو هذا الفوج غير موجود
        </h2>
        <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto 20px;">
          تأكد من صحة الرابط أو اضغط الزر أدناه للانتقال لصفحة الأفواج.
        </p>
        <a href="#/groupes" class="btn btn-primary">الانتقال لصفحة الأفواج</a>
      </div>
    </div>
  `;

  const h = $("#errHeading");
  if (h) h.focus();
}

function showErrorPage(title, desc) {
  document.title = `${title} | info cc 404`;
  $("#homeView").style.display = "none";

  const container = $("#dynamicView");
  container.innerHTML = `
    <div style="padding: 20px 0 60px;">
      <div class="empty-box" style="padding: 60px 20px;">
        <div class="empty-icon">🔒</div>
        <h2 id="permHeading" tabindex="-1" style="font-size: 1.4rem; color: var(--text-main); margin: 0 0 10px;">
          ${escapeHtml(title)}
        </h2>
        <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto 20px;">
          ${escapeHtml(desc)}
        </p>
        <a href="#/" class="btn btn-primary">العودة للرئيسية</a>
      </div>
    </div>
  `;

  const h = $("#permHeading");
  if (h) h.focus();
}

// ============================================================================
// 5) تهيئة التطبيق وتسجيل Service Worker
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service Worker registration notice:", err);
    });
  }

  loadFiles().then(() => {
    handleRouting();
  });
});
