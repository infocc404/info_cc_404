// ============================================================================
// info cc 404 — Single Page Application (app.js)
// Plain JavaScript + Supabase, Hash Routing, PDF.js view-only viewer
// Clean typography, zero emojis, strict role division, minimal #/admin & #/upload
// ============================================================================

// 1. CONFIG CHECK
const rootEl = document.getElementById("appRoot");

if (!window.INFOCC_CONFIG || !window.INFOCC_CONFIG.SUPABASE_URL || !window.INFOCC_CONFIG.SUPABASE_ANON_KEY) {
  if (rootEl) {
    rootEl.innerHTML = `
      <div class="config-error-banner" role="alert">
        خطأ: ملف الإعدادات config.js مفقود أو لا يحتوي على مفاتيح Supabase الصحيحة.
        يرجى التأكد من تحميل config.js قبل app.js.
      </div>
    `;
  }
  throw new Error("Missing window.INFOCC_CONFIG");
}

// 2. SUPABASE CLIENT
const { createClient } = window.supabase || {};
if (!createClient) {
  if (rootEl) {
    rootEl.innerHTML = `<div class="config-error-banner">خطأ: مكتبة Supabase لم يتم تحميلها بشكل صحيح.</div>`;
  }
  throw new Error("Missing Supabase library");
}

// Password-recovery detection: must run BEFORE createClient, because Supabase
// clears the URL hash right after reading the tokens from it.
let recoveryMode = /type=recovery/.test(location.hash) || /type=recovery/.test(location.search);

const supabase = createClient(
  window.INFOCC_CONFIG.SUPABASE_URL,
  window.INFOCC_CONFIG.SUPABASE_ANON_KEY
);

// 3. APPLICATION STATE
const state = {
  session: null,
  user: null,
  role: "student", // "owner" | "uploader" | "student" (read-only from database)
  uploaderGroup: null, // 1..10 if uploader
  studentGroup: null, // read-only from the database (student_profiles)
  currentRoute: "#/",
  redirectAfterLogin: null,
  filesCache: [],
  teacherInfoCache: [], // Cache for teacher_info table
  scheduleCache: [], // Cache for schedule_entries table
  scheduleError: null,
  renderedUserId: null,
  sidebarOpen: false,
  searchQuery: "",
  activePdfDoc: null,
  pdfCurrentPage: 1,
  pdfTotalPages: 1,
  pdfScale: 1.0,
  pdfCanvas: null,
  pdfContext: null
};

// Subject Normalization Helper for legacy free-text rows
const SUBJECT_DEFINITIONS = window.SUBJECTS || [
  { id: "algo", nameFr: "Algo & SDS 1", nameAr: "الخوارزميات وهياكل المعطيات 1" },
  { id: "arch", nameFr: "Comp Arch 1", nameAr: "بنية الحاسوب 1" },
  { id: "sys", nameFr: "Operating Sys 1", nameAr: "نظام التشغيل 1" },
  { id: "analyse", nameFr: "Math Analysis 1", nameAr: "التحليل الرياضي 1" },
  { id: "algebre", nameFr: "Algebra 1", nameAr: "الجبر 1" },
  { id: "elec", nameFr: "Fundamental Electronics", nameAr: "الإلكترونيك الأساسية" },
  { id: "histoire", nameFr: "History of Algeria", nameAr: "تاريخ الجزائر" }
];

function normalizeSubjectId(sub) {
  if (!sub) return "autre";
  const str = String(sub).trim().toLowerCase();
  for (const s of SUBJECT_DEFINITIONS) {
    if (s.id.toLowerCase() === str) return s.id;
    if (s.aliases && s.aliases.some(a => a.toLowerCase() === str)) return s.id;
    if (s.nameFr.toLowerCase().includes(str) || str.includes(s.id)) return s.id;
    if (s.nameAr.includes(str)) return s.id;
  }
  if (str.includes("algo") || str.includes("sds")) return "algo";
  if (str.includes("arch")) return "arch";
  if (str.includes("sys") || str.includes("os") || str.includes("système")) return "sys";
  if (str.includes("anal") || str.includes("math")) return "analyse";
  if (str.includes("alg") || str.includes("جبر")) return "algebre";
  if (str.includes("elec") || str.includes("إلكترو")) return "elec";
  if (str.includes("hist") || str.includes("تاريخ")) return "histoire";
  return "autre";
}

function getSubjectObj(id) {
  return SUBJECT_DEFINITIONS.find(s => s.id === id) || {
    id: id || "autre",
    nameFr: id === "autre" ? "Autre" : id,
    nameAr: id === "autre" ? "أخرى / عام" : id
  };
}

// XSS Sanitizer
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 4. TEACHER INFO OVERRIDE RESOLUTION
function getResolvedTeacher(kind, subjectId, groupNo) {
  // Teachers live ONLY in the teacher_info table (managed by owner/admin).
  // "cours" rows are stored with group_no = NULL; td/tp rows with group_no 1..10.
  const gNo = kind === "cours" ? null : parseInt(groupNo, 10);
  const match = state.teacherInfoCache.find(
    t => t.kind === kind && t.subject_id === subjectId && (t.group_no ?? null) === gNo
  );

  if (match && match.name) {
    return { name: match.name, email: match.email || null, isCustom: true };
  }
  return { name: null, email: null, isCustom: false };
}

// Render teacher display with mailto when email exists
function teacherSlug(name) {
  return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "teacher";
}

function renderTeacherDisplayHtml(resolvedTeacher, kind = "cours", subjectId = "", groupNo = 0) {
  const validName = !!(resolvedTeacher && resolvedTeacher.name);
  const nameHtml = validName
    ? `<a href="#/teacher/${encodeURIComponent(teacherSlug(resolvedTeacher.name))}" class="teacher-profile-link" title="عرض صفحة الأستاذ وملفاته">${escapeHtml(resolvedTeacher.name)}</a>`
    : `<span style="color: var(--muted); font-size: 13px;">لم يُعيّن بعد</span>`;
  const emailHtml = resolvedTeacher?.email
    ? `<a href="mailto:${escapeHtml(resolvedTeacher.email)}" title="مراسلة الأستاذ" class="mono" style="font-size: 12px; text-decoration: underline;" dir="ltr">${escapeHtml(resolvedTeacher.email)}</a>`
    : "";
  const profileButton = validName
    ? `<a href="#/teacher/${encodeURIComponent(teacherSlug(resolvedTeacher.name))}" class="btn-secondary" style="padding:2px 8px;font-size:11px;text-decoration:none;">ملفات الأستاذ</a>`
    : "";
  return `<div style="display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap;">${nameHtml}${emailHtml}${profileButton}</div>`;
}

// 5. AUTH & ROLE INITIALIZATION
async function fetchRoleAndGroup() {
  try {
    const { data, error } = await supabase.rpc("my_role");
    if (error) {
      console.warn("RPC my_role error:", error);
      state.role = "student";
      state.uploaderGroup = null;
      state.studentGroup = null;
      if (error.message && !error.message.includes("Failed to fetch")) {
        showGlobalError(`خطأ في التحقق من الرتبة: ${error.message}`);
      }
      return;
    }
    // Read authoritative role, uploader_group, and assigned_group from DB
    if (Array.isArray(data) && data.length > 0) {
      state.role = data[0]?.user_role || "student";
      state.uploaderGroup = data[0]?.uploader_group ?? null;
      state.studentGroup = data[0]?.assigned_group ?? null;
    } else if (typeof data === "object" && data !== null) {
      state.role = data.user_role || "student";
      state.uploaderGroup = data.uploader_group ?? null;
      state.studentGroup = data.assigned_group ?? null;
    } else if (typeof data === "string") {
      state.role = data;
      state.uploaderGroup = null;
      state.studentGroup = null;
    } else {
      state.role = "student";
      state.uploaderGroup = null;
      state.studentGroup = null;
    }
  } catch (err) {
    console.warn("Network or execution error in my_role:", err);
    state.role = "student";
    state.uploaderGroup = null;
    state.studentGroup = null;
  }
}

function showGlobalError(msg) {
  const existing = document.getElementById("globalErrorNotification");
  if (existing) existing.remove();
  const box = document.createElement("div");
  box.id = "globalErrorNotification";
  box.className = "auth-error-box";
  box.style.cssText = "position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 9999; display: block; max-width: 90%;";
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 6000);
}

// Router Guard: hashes not starting with #/ are ignored
function normalizeHash(hash) {
  if (!hash || !hash.startsWith("#/")) return "#/";
  return hash;
}

// 6. SUPABASE AUTH LISTENER
supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    state.session = session;
    state.user = session?.user || null;

    if (event === "PASSWORD_RECOVERY") recoveryMode = true;

    // While the user is choosing a new password, never switch to the app.
    // (Supabase fires SIGNED_IN right before/after PASSWORD_RECOVERY.)
    if (recoveryMode) {
      if (!document.getElementById("pwResetForm")) renderPasswordRecoveryScreen();
      return;
    }

    if (state.user) {
      // Token refreshes and profile updates must not rebuild the page
      // (it would wipe whatever the user is typing).
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      if (event === "SIGNED_IN" && state.renderedUserId === state.user.id) return;

      await fetchRoleAndGroup();
      await Promise.all([loadFilesCache(), loadTeacherInfoCache(), loadScheduleCache()]);
      state.renderedUserId = state.user.id;

      const target = state.redirectAfterLogin || normalizeHash(location.hash);
      state.redirectAfterLogin = null;
      location.hash = target;
      renderApp();
    } else {
      // Logged out
      state.renderedUserId = null;
      state.role = "student";
      state.uploaderGroup = null;
      state.studentGroup = null;
      state.filesCache = [];
      state.teacherInfoCache = [];
      state.scheduleCache = [];
      location.hash = "#/";
      renderLoggedOut();
    }
  }, 0);
});

// Cache files
async function loadFilesCache() {
  try {
    const { data, error } = await supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      state.filesCache = data;
    } else {
      state.filesCache = [];
    }
  } catch (e) {
    console.error("Error loading files cache:", e);
    state.filesCache = [];
  }
}

// Cache teacher_info table
async function loadTeacherInfoCache() {
  try {
    const { data, error } = await supabase
      .from("teacher_info")
      .select("*");
    if (!error && data) {
      state.teacherInfoCache = data;
    } else {
      state.teacherInfoCache = [];
    }
  } catch (e) {
    console.error("Error loading teacher_info cache:", e);
    state.teacherInfoCache = [];
  }
}

// Cache schedule_entries table (timetable, managed by owner/admin)
async function loadScheduleCache() {
  try {
    const { data, error } = await supabase
      .from("schedule_entries")
      .select("*")
      .order("start_time", { ascending: true });
    if (!error && data) {
      state.scheduleCache = data;
      state.scheduleError = null;
    } else {
      state.scheduleCache = [];
      state.scheduleError = error ? error.message : null;
    }
  } catch (e) {
    console.error("Error loading schedule cache:", e);
    state.scheduleCache = [];
    state.scheduleError = String(e && e.message || e);
  }
}

// Friendly Arabic messages for common Supabase auth errors
function translateAuthError(msg) {
  const m = String(msg || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (m.includes("email not confirmed")) return "لم يتم تأكيد البريد الإلكتروني بعد. افتح رسالة التأكيد في بريدك.";
  if (m.includes("already registered") || m.includes("already been registered")) return "هذا البريد مسجل من قبل. جرّب تسجيل الدخول أو استرجاع كلمة المرور.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "محاولات كثيرة في وقت قصير. استنى دقيقة وعاود المحاولة.";
  if (m.includes("same password") || m.includes("different from the old")) return "كلمة المرور الجديدة لازم تكون مختلفة عن القديمة.";
  if (m.includes("at least") && m.includes("character")) return "كلمة المرور قصيرة، استعمل 6 أحرف على الأقل.";
  if (m.includes("failed to fetch") || m.includes("network")) return "مشكل في الاتصال بالإنترنت. عاود المحاولة.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "صيغة البريد الإلكتروني غير صحيحة.";
  return msg;
}

// 7. LOGGED-OUT VIEW RENDERER
function renderLoggedOut(errorMessage = "", successMessage = "") {
  rootEl.innerHTML = `
    <div class="auth-container">
      <div class="auth-wrapper">
        <div class="auth-panel-banner">
          <div class="logo-badge mono">info_cc_404</div>
          <h1>info cc 404</h1>
          <p>منصة طلبة الإعلام الآلي — 10 أفواج / 7 مواد</p>
        </div>

        <div class="auth-card">
          <div class="auth-tabs" role="tablist">
            <button type="button" class="auth-tab active" id="tabLoginBtn">تسجيل الدخول</button>
            <button type="button" class="auth-tab" id="tabSignupBtn">إنشاء حساب</button>
          </div>

          <div id="authAlertError" class="auth-error-box" style="${errorMessage ? 'display:block' : ''}">
            ${escapeHtml(errorMessage)}
          </div>
          <div id="authAlertSuccess" class="auth-success-box" style="${successMessage ? 'display:block' : ''}">
            ${escapeHtml(successMessage)}
          </div>

          <!-- LOGIN FORM: NO group select -->
          <form id="authLoginForm" autocomplete="off">
            <div class="form-group">
              <label class="form-label" for="loginEmail">البريد الإلكتروني</label>
              <input type="email" id="loginEmail" class="form-control" placeholder="name@univ.dz" required autocomplete="off">
            </div>

            <div class="form-group">
              <label class="form-label" for="loginPass">كلمة المرور</label>
              <input type="password" id="loginPass" class="form-control" placeholder="••••••••" required>
            </div>

            <button type="submit" class="btn-primary" id="loginSubmitBtn" style="margin-top: 10px;">
              دخول
            </button>

            <div style="text-align: center; margin-top: 14px;">
              <a href="#" id="forgotPassLink" style="font-size: 13px; color: var(--muted);">نسيت كلمة المرور؟</a>
            </div>
          </form>

          <!-- SIGNUP FORM: REQUIRED group select -->
          <form id="authSignupForm" style="display: none;" autocomplete="off">
            <div class="form-group">
              <label class="form-label" for="signupEmail">البريد الإلكتروني</label>
              <input type="email" id="signupEmail" class="form-control" placeholder="name@univ.dz" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="signupPass">كلمة المرور</label>
              <input type="password" id="signupPass" class="form-control" placeholder="6 أحرف على الأقل" required minlength="6">
            </div>

            <div class="form-group">
              <label class="form-label" for="signupGroup">فوجك الدراسي *</label>
              <select id="signupGroup" class="form-control mono" required>
                <option value="" disabled selected>اختر فوجك (إلزامي)...</option>
                ${[1,2,3,4,5,6,7,8,9,10].map(g => `<option value="${g}">G${g}</option>`).join("")}
              </select>
            </div>

            <button type="submit" class="btn-primary" id="signupSubmitBtn" style="margin-top: 10px;">
              إنشاء الحساب
            </button>
          </form>

          <div id="forgotPassBox" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line);">
            <div style="font-size: 13px; font-weight: 500; margin-bottom: 8px;">استرجاع كلمة المرور</div>
            <div class="form-group">
              <input type="email" id="forgotEmail" class="form-control" placeholder="البريد الإلكتروني لتلقي رابط إعادة التعيين">
            </div>
            <button type="button" class="btn-secondary" id="sendResetBtn" style="width: 100%;">
              إرسال رابط التعيين
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const tabLogin = document.getElementById("tabLoginBtn");
  const tabSignup = document.getElementById("tabSignupBtn");
  const loginForm = document.getElementById("authLoginForm");
  const signupForm = document.getElementById("authSignupForm");
  const forgotBox = document.getElementById("forgotPassBox");

  tabLogin.onclick = () => {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    loginForm.style.display = "block";
    signupForm.style.display = "none";
    forgotBox.style.display = "none";
  };

  tabSignup.onclick = () => {
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
    loginForm.style.display = "none";
    signupForm.style.display = "block";
    forgotBox.style.display = "none";
  };

  document.getElementById("forgotPassLink").onclick = (e) => {
    e.preventDefault();
    forgotBox.style.display = forgotBox.style.display === "none" ? "block" : "none";
  };

  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPass").value;
    const btn = document.getElementById("loginSubmitBtn");
    btn.disabled = true;
    btn.textContent = "جاري الدخول...";

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      renderLoggedOut(translateAuthError(error.message));
    }
  };

  signupForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("signupEmail").value.trim();
    const pass = document.getElementById("signupPass").value;
    const groupVal = document.getElementById("signupGroup").value;

    if (!groupVal) {
      alert("يرجى اختيار الفوج الدراسي (إلزامي).");
      return;
    }

    const groupNo = parseInt(groupVal, 10);
    const btn = document.getElementById("signupSubmitBtn");
    btn.disabled = true;
    btn.textContent = "جاري الإنشاء...";

    // Supabase sends signup confirmation separately from password-reset emails.
    // The redirect must also be allow-listed in Supabase Authentication > URL Configuration.
    const emailRedirectTo = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        emailRedirectTo,
        data: { group_no: groupNo }
      }
    });

    if (error) {
      renderLoggedOut(translateAuthError(error.message));
    } else if (data?.user && !data?.session) {
      // Email confirmation is ON: the user must confirm before logging in.
      renderLoggedOut("", "تم إنشاء الحساب. افتح رسالة التأكيد في بريدك (وتحقق من الرسائل غير المرغوب فيها) ثم سجّل الدخول.");
    }
    // else: a session exists -> the auth listener opens the app by itself.
  };

  document.getElementById("sendResetBtn").onclick = async () => {
    const email = document.getElementById("forgotEmail").value.trim();
    if (!email) {
      alert("يرجى كتابة البريد الإلكتروني");
      return;
    }
    const redirectUrl = window.location.origin + window.location.pathname;
    const sendBtn = document.getElementById("sendResetBtn");
    sendBtn.disabled = true;
    sendBtn.textContent = "جاري الإرسال...";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    if (error) {
      renderLoggedOut(translateAuthError(error.message));
    } else {
      renderLoggedOut("", "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني.");
    }
  };
}

// 8. PASSWORD RECOVERY SCREEN
function renderPasswordRecoveryScreen() {
  rootEl.innerHTML = `
    <div class="auth-container">
      <div class="auth-wrapper">
        <div class="auth-panel-banner">
          <div class="logo-badge mono">info_cc_404</div>
          <h1>info cc 404</h1>
          <p>إعادة تعيين كلمة المرور</p>
        </div>

        <div class="auth-card">
          <h2 style="font-size: 18px; margin-bottom: 12px; font-weight: 600;">كلمة سر جديدة</h2>
          <div id="pwResetAlert" class="auth-error-box"></div>
          <form id="pwResetForm">
            <div class="form-group">
              <label class="form-label" for="newPassword">كلمة المرور الجديدة</label>
              <input type="password" id="newPassword" class="form-control" placeholder="••••••••" required minlength="6">
            </div>
            <button type="submit" class="btn-primary" id="updatePwBtn">حفظ كلمة المرور</button>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById("pwResetForm").onsubmit = async (e) => {
    e.preventDefault();
    const newPass = document.getElementById("newPassword").value;
    const btn = document.getElementById("updatePwBtn");
    btn.disabled = true;
    btn.textContent = "جاري الحفظ...";

    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) {
      const alertBox = document.getElementById("pwResetAlert");
      alertBox.textContent = translateAuthError(error.message);
      alertBox.style.display = "block";
      btn.disabled = false;
      btn.textContent = "حفظ كلمة المرور";
    } else {
      recoveryMode = false;
      alert("تم تحديث كلمة المرور بنجاح!");
      location.hash = "#/";
      await fetchRoleAndGroup();
      await Promise.all([loadFilesCache(), loadTeacherInfoCache(), loadScheduleCache()]);
      state.renderedUserId = state.user ? state.user.id : null;
      renderApp();
    }
  };
}

// 9. LOGGED-IN APP SHELL & ROUTER
function renderApp() {
  if (recoveryMode) {
    if (!document.getElementById("pwResetForm")) renderPasswordRecoveryScreen();
    return;
  }
  if (!state.user) {
    renderLoggedOut();
    return;
  }

  const hash = normalizeHash(location.hash);
  state.currentRoute = hash;

  const isOwner = state.role === "owner";
  const isAdmin = state.role === "admin";
  const isUploader = state.role === "uploader";

  // Build shell
  rootEl.innerHTML = `
    <div class="app-container">
      <!-- Backdrop for mobile -->
      <div id="sidebarBackdrop" class="sidebar-backdrop"></div>

      <!-- Right Sidebar -->
      <aside id="appSidebar" class="app-sidebar">
        <div class="sidebar-header">
          <span class="logo-badge-small mono">404</span>
          <span class="sidebar-brand-name mono">info_cc_404</span>
        </div>

        <nav class="sidebar-nav">
          <a href="#/" class="nav-link ${hash === "#/" ? "active" : ""}">
            <span>الرئيسية</span>
          </a>
          <a href="#/groupes" class="nav-link ${hash.startsWith("#/groupe") ? "active" : ""}">
            <span>الأفواج</span>
          </a>
          <a href="#/horaire" class="nav-link ${hash === "#/horaire" ? "active" : ""}">
            <span>الجدول الزمني</span>
          </a>
          <a href="#/teachers" class="nav-link ${hash.startsWith("#/teacher") ? "active" : ""}">
            <span>الأساتذة</span>
          </a>
          ${
            isOwner || isAdmin || isUploader
              ? `<a href="#/upload" class="nav-link ${hash === "#/upload" ? "active" : ""}">
                  <span>رفع الملفات</span>
                 </a>`
              : ""
          }
          ${
            isOwner || isAdmin
              ? `<a href="#/admin" class="nav-link ${hash === "#/admin" ? "active" : ""}">
                  <span>الإدارة</span>
                 </a>`
              : ""
          }
          <a href="#/compte" class="nav-link ${hash === "#/compte" ? "active" : ""}">
            <span>حسابي</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <button type="button" class="btn-secondary" id="sidebarLogoutBtn" style="width: 100%;">
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <!-- Main Area -->
      <div class="app-main">
        <!-- Top Bar -->
        <header class="app-topbar">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <button type="button" id="mobileMenuBtn" class="mobile-menu-btn" aria-label="القائمة">
              القائمة
            </button>

            <!-- Search box -->
            <div class="search-box-wrapper">
              <input type="text" id="topSearchInput" class="search-input" placeholder="ابحث في عناوين الملفات المتاحة...">
              <div id="searchResultsDropdown" class="search-results-dropdown"></div>
            </div>
          </div>

          <div class="topbar-right-info">
            <span class="role-badge ${state.role}">
              ${getRoleBadgeText(state.role, state.uploaderGroup)}
            </span>
            <div class="user-avatar-circle" id="topbarAvatar" title="${escapeHtml(state.user.email)}">
              ${escapeHtml(state.user.email?.[0]?.toUpperCase() || "U")}
            </div>
          </div>
        </header>

        <!-- Route Content Area -->
        <main class="page-body" id="pageContent">
          <!-- Injected Route View -->
        </main>
      </div>
    </div>
  `;

  attachShellEvents();
  dispatchRoute(hash);
}

// Owner and admin are the only roles that manage teachers and the timetable.
function canManageContent() {
  return state.role === "owner" || state.role === "admin";
}

function getRoleBadgeText(role, uploaderGroup) {
  if (role === "owner") return "المالك";
  if (role === "admin") return "مشرف";
  if (role === "uploader") return `رئيس القسم (G${uploaderGroup || ""})`;
  return "طالب";
}

function attachShellEvents() {
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  const menuBtn = document.getElementById("mobileMenuBtn");
  const logoutBtn = document.getElementById("sidebarLogoutBtn");
  const avatar = document.getElementById("topbarAvatar");
  const searchInput = document.getElementById("topSearchInput");
  const searchDropdown = document.getElementById("searchResultsDropdown");

  const toggleSidebar = () => {
    state.sidebarOpen = !state.sidebarOpen;
    sidebar.classList.toggle("open", state.sidebarOpen);
    backdrop.classList.toggle("open", state.sidebarOpen);
  };

  if (menuBtn) menuBtn.onclick = toggleSidebar;
  if (backdrop) backdrop.onclick = toggleSidebar;

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      state.session = null;
      state.user = null;
      state.role = "student";
      state.uploaderGroup = null;
      state.filesCache = [];
      state.teacherInfoCache = [];
      state.scheduleCache = [];
      state.renderedUserId = null;
      location.hash = "#/";
      renderLoggedOut("تم تسجيل الخروج بنجاح.");
    };
  }

  if (avatar) {
    avatar.onclick = () => {
      location.hash = "#/compte";
    };
  }

  // Live Search in readable files
  if (searchInput && searchDropdown) {
    searchInput.oninput = () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        searchDropdown.style.display = "none";
        searchDropdown.innerHTML = "";
        return;
      }
      const accessible = getAccessibleFiles();
      const results = accessible.filter(f => (f.title || "").toLowerCase().includes(q));
      if (results.length === 0) {
        searchDropdown.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--muted); font-size: 13px;">لا توجد ملفات مطابقة</div>`;
      } else {
        searchDropdown.innerHTML = results.slice(0, 10).map(f => `
          <div class="search-result-item" data-id="${f.id}">
            <div>
              <div style="font-weight: 500; font-size: 13px;">${escapeHtml(f.title)}</div>
              <div style="font-size: 11px; color: var(--muted);" class="mono">${escapeHtml(f.subject)} · ${f.kind} ${f.group_no ? `· G${f.group_no}` : "· كل الأفواج"}</div>
            </div>
            <span class="badge-tag">عرض</span>
          </div>
        `).join("");

        searchDropdown.querySelectorAll(".search-result-item").forEach(item => {
          item.onclick = () => {
            const fileId = item.getAttribute("data-id");
            searchDropdown.style.display = "none";
            searchInput.value = "";
            location.hash = `#/voir/${fileId}`;
          };
        });
      }
      searchDropdown.style.display = "block";
    };

    if (state._searchOutsideClick) document.removeEventListener("click", state._searchOutsideClick);
    state._searchOutsideClick = (e) => {
      if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = "none";
      }
    };
    document.addEventListener("click", state._searchOutsideClick);
  }
}

// 10. FILTER ACCESSIBLE FILES FOR THE USER
function getAccessibleFiles() {
  if (state.role === "owner" || state.role === "admin") return state.filesCache;
  const sg = state.studentGroup;
  return state.filesCache.filter(f => {
    if (f.kind === "cours") return true; // Cours is available to all
    if (f.group_no === null || f.group_no === undefined) return true;
    if (!sg) return false; // Default deny if user has no trusted student group assigned
    return f.group_no === sg;
  });
}

// 11. ROUTE DISPATCHER
function dispatchRoute(hash) {
  const page = document.getElementById("pageContent");
  if (!page) return;

  // #/
  if (hash === "#/") {
    renderHomeView(page);
    return;
  }

  // #/groupes
  if (hash === "#/groupes") {
    renderGroupesView(page);
    return;
  }

  // #/groupe/N or #/groupe/N/<tab> or #/groupe/N/<tab>/<subjectId>
  const groupMatch = hash.match(/^#\/groupe\/(\d+)(?:\/([^\/]+)(?:\/([^\/]+))?)?$/);
  if (groupMatch) {
    const groupNo = parseInt(groupMatch[1], 10);
    const tab = groupMatch[2] || "cours";
    const subjectId = groupMatch[3] || null;
    renderGroupDetailView(page, groupNo, tab, subjectId);
    return;
  }

  // #/horaire
  if (hash === "#/horaire") {
    renderTimetableView(page);
    return;
  }

  // #/teachers and filtered teacher directories
  const teachersMatch = hash.match(/^#\/teachers(?:\/(cours|td|tp))?$/);
  if (teachersMatch) {
    renderTeachersView(page, teachersMatch[1] || "all");
    return;
  }

  // #/teacher/:slug
  const teacherMatch = hash.match(/^#\/teacher\/([^/]+)$/);
  if (teacherMatch) {
    renderTeacherProfileView(page, decodeURIComponent(teacherMatch[1]));
    return;
  }

  // #/voir/:id
  const viewMatch = hash.match(/^#\/voir\/([^\/]+)$/);
  if (viewMatch) {
    const fileId = viewMatch[1];
    renderPdfViewerView(page, fileId);
    return;
  }

  // #/upload (owner, admin and uploader)
  if (hash === "#/upload") {
    if (state.role !== "owner" && state.role !== "admin" && state.role !== "uploader") {
      renderAccessDenied(page);
      return;
    }
    renderUploadView(page);
    return;
  }

  // #/admin (owner and admin)
  if (hash === "#/admin") {
    if (state.role !== "owner" && state.role !== "admin") {
      renderAccessDenied(page);
      return;
    }
    renderAdminView(page);
    return;
  }

  // #/compte
  if (hash === "#/compte") {
    renderAccountView(page);
    return;
  }

  // Unknown route: 404
  renderNotFoundView(page);
}

function renderAccessDenied(page) {
  page.innerHTML = `
    <div class="content-card" style="text-align: center; padding: 40px;">
      <h2 style="font-size: 20px; font-weight: 600; color: var(--danger); margin-bottom: 8px;">ما عندكش الصلاحية</h2>
      <p style="color: var(--muted); margin-bottom: 20px;">هذه الصفحة مخصصة لمالك المنصة فقط.</p>
      <a href="#/" class="btn-primary" style="display: inline-block; width: auto;">العودة للرئيسية</a>
    </div>
  `;
}

// 12. PAGE: HOME (#/)
function renderHomeView(page) {
  const sg = state.studentGroup;
  const recentFiles = getAccessibleFiles().slice(0, 5);

  page.innerHTML = `
    <div class="page-banner">
      <h2>مرحباً بك، ${escapeHtml(state.user.email?.split("@")[0] || "طالب")}</h2>
      <p>منصة info cc 404 لمشاركة وتصفح ملفات الإعلام الآلي (الدفعة الأولى).</p>
    </div>

    <!-- 3 Shortcut Cards -->
    <div class="welcome-grid">
      <a href="${sg ? `#/groupe/${sg}` : '#/groupes'}" class="shortcut-card">
        <div class="title">${sg ? `فوجي (<span class="mono">G${sg}</span>)` : 'الأفواج الدراسية'}</div>
        <div class="desc">${sg ? 'دروس، أعمال موجهة وتطبيقية خاصة بفوجك.' : 'تصفح المحاضرات والملفات الدراسية.'}</div>
      </a>
      <a href="#/groupes" class="shortcut-card">
        <div class="title">الأفواج</div>
        <div class="desc">تصفح ملفات وتفاصيل جميع الأفواج من G1 إلى G10.</div>
      </a>
      <a href="#/horaire" class="shortcut-card">
        <div class="title">الجدول الزمني</div>
        <div class="desc">البرنامج الأسبوعي وتوزيع الحصص والقاعات.</div>
      </a>
    </div>

    <!-- Chips G1..G10 -->
    <div class="content-card">
      <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: var(--brown-dark);">الانتقال المباشر لأي فوج:</h3>
      <div class="chips-wrap" style="margin-bottom: 0;">
        ${[1,2,3,4,5,6,7,8,9,10].map(g => `
          <a href="#/groupe/${g}" class="group-chip-btn ${sg && g === sg ? 'current' : ''}">
            G${g}${sg && g === sg ? ' فوجك' : ''}
          </a>
        `).join("")}
      </div>
    </div>

    <!-- آخر ملفات فوجك -->
    <div class="content-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark);">${sg ? `آخر ملفات فوجك (G${sg})` : "آخر الملفات"}</h3>
        <span style="font-size: 12px; color: var(--muted);"><span class="mono">${recentFiles.length}</span> ملفات معروضة</span>
      </div>

      ${
        recentFiles.length === 0
          ? `<p style="color: var(--muted); text-align: center; padding: 20px;">ما كاين حتى ملف بعد</p>`
          : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>عنوان الملف</th>
                    <th>المادة</th>
                    <th>النوع</th>
                    <th>التاريخ</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentFiles.map(f => {
                    const isNew = isWithinDays(f.created_at, 7);
                    return `
                      <tr>
                        <td>
                          <strong>${escapeHtml(f.title)}</strong>
                          ${isNew ? '<span class="badge-new">جديد</span>' : ''}
                        </td>
                        <td>${escapeHtml(getSubjectObj(normalizeSubjectId(f.subject)).nameAr)}</td>
                        <td><span class="badge-tag">${escapeHtml(f.kind)}</span></td>
                        <td class="mono" style="font-size: 12px;">${formatDate(f.created_at)}</td>
                        <td>
                          <button type="button" class="btn-secondary view-file-btn" data-id="${f.id}" style="padding: 4px 10px; font-size: 12px;">
                            عرض
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          `
      }
    </div>
  `;

  page.querySelectorAll(".view-file-btn").forEach(btn => {
    btn.onclick = () => {
      const fid = btn.getAttribute("data-id");
      location.hash = `#/voir/${fid}`;
    };
  });
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / (1000 * 60 * 60 * 24);
  return diff <= days;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch (e) {
    return dateStr;
  }
}

// 13. PAGE: GROUPES (#/groupes)
function renderGroupesView(page) {
  const sg = state.studentGroup;
  page.innerHTML = `
    <div class="page-banner">
      <h2>الأفواج الدراسية (<span class="mono">G1 - G10</span>)</h2>
      <p>اختر أي فوج للاطلاع على تفاصيل أساتذة الـ TD والـ TP وملفات الدروس الخاصة به.</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">
      ${[1,2,3,4,5,6,7,8,9,10].map(g => `
        <a href="#/groupe/${g}" class="content-card" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 24px 16px; text-decoration: none; border: 1px solid ${sg && g === sg ? 'var(--brown)' : 'var(--line)'}; position: relative;">
          ${sg && g === sg ? `<span style="position: absolute; top: 10px; left: 10px; background-color: var(--brown); color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 500;">فوجك</span>` : ''}
          <div class="logo-badge-small mono" style="font-size: 16px; padding: 6px 14px; margin-bottom: 12px;">G${g}</div>
          <div style="font-weight: 600; font-size: 16px; color: var(--brown-dark);">الفوج ${g}</div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">تصفح الدروس والملفات</div>
        </a>
      `).join("")}
    </div>
  `;
}

// 14. PAGE: GROUPE DETAIL (#/groupe/N/...)
function renderGroupDetailView(page, groupNo, tab = "cours", subjectId = null) {
  if (groupNo < 1 || groupNo > 10) {
    renderNotFoundView(page);
    return;
  }

  if (subjectId) {
    renderSubjectLessonsView(page, groupNo, tab, subjectId);
    return;
  }

  const isOwner = canManageContent(); // owner or admin (kept name for the markup below)

  page.innerHTML = `
    <div class="breadcrumb">
      <a href="#/groupes">الأفواج</a>
      <span>›</span>
      <span class="current mono">G${groupNo}</span>
    </div>

    <div class="page-banner">
      <h2>الفوج <span class="mono">G${groupNo}</span></h2>
      <p>تصفح مقاييس وملفات الفوج حسب نوع الحصة.</p>
    </div>

    <div class="group-tabs">
      <button type="button" class="group-tab-btn ${tab === 'cours' ? 'active' : ''}" data-tab="cours">الكور</button>
      <button type="button" class="group-tab-btn mono ${tab === 'td' ? 'active' : ''}" data-tab="td">TD</button>
      <button type="button" class="group-tab-btn mono ${tab === 'tp' ? 'active' : ''}" data-tab="tp">TP</button>
      <button type="button" class="group-tab-btn ${tab === 'exam' ? 'active' : ''}" data-tab="exam">الامتحانات</button>
    </div>

    <div id="groupTabContent">
      <!-- Injected Tab Content -->
    </div>
  `;

  page.querySelectorAll(".group-tab-btn").forEach(btn => {
    btn.onclick = () => {
      const nextTab = btn.getAttribute("data-tab");
      location.hash = `#/groupe/${groupNo}/${nextTab}`;
    };
  });

  const tabContainer = document.getElementById("groupTabContent");

  if (tab === "cours") {
    tabContainer.innerHTML = `
      <div class="content-card">
        <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 14px;">محاضرات المقاييس (Cours)</h3>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>المقياس (بالعربية / Français)</th>
                <th>أستاذ المحاضرة</th>
                <th>عدد الملفات</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              ${SUBJECT_DEFINITIONS.map(sub => {
                const count = state.filesCache.filter(f =>
                  f.kind === "cours" && normalizeSubjectId(f.subject) === sub.id
                ).length;
                const teacher = getResolvedTeacher("cours", sub.id, 0);
                return `
                  <tr>
                    <td>
                      <strong>${escapeHtml(sub.nameAr)}</strong>
                      <div class="mono" style="font-size: 12px; color: var(--muted);">${escapeHtml(sub.nameFr)}</div>
                    </td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-start; flex-wrap: wrap;">
                        ${renderTeacherDisplayHtml(teacher)}
                        ${
                          isOwner
                            ? `<button type="button" class="btn-secondary edit-teacher-btn" data-kind="cours" data-sub="${sub.id}" data-grp="0" style="padding: 2px 8px; font-size: 11px;">${teacher.name ? "تعديل" : "تعيين"}</button>`
                            : ""
                        }
                      </div>
                    </td>
                    <td><span class="badge-tag mono">${count}</span></td>
                    <td>
                      <a href="#/groupe/${groupNo}/cours/${sub.id}" class="btn-primary" style="padding: 4px 12px; font-size: 12px; width: auto; text-decoration: none;">
                        فتح الدروس
                      </a>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (tab === "td") {
    // Students see only subjects that have a teacher assigned or files for this group.
    // Owner/admin see every subject so they can assign teachers.
    const validSubs = SUBJECT_DEFINITIONS.filter(sub =>
      isOwner ||
      getResolvedTeacher("td", sub.id, groupNo).name ||
      state.filesCache.some(f =>
        f.kind === "td" &&
        normalizeSubjectId(f.subject) === sub.id &&
        (f.group_no === groupNo || f.group_no === null)
      )
    );

    tabContainer.innerHTML = `
      <div class="content-card">
        <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 14px;">حصص الأعمال الموجهة (TD) — الفوج G${groupNo}</h3>
        ${validSubs.length === 0 ? `<p style="color: var(--muted);">لم تُضف حصص TD لهذا الفوج بعد.</p>` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>المقياس</th>
                  <th>أستاذ الـ TD</th>
                  <th>عدد الملفات</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                ${validSubs.map(sub => {
                  const count = state.filesCache.filter(f =>
                    f.kind === "td" &&
                    normalizeSubjectId(f.subject) === sub.id &&
                    (f.group_no === groupNo || f.group_no === null)
                  ).length;
                  const teacher = getResolvedTeacher("td", sub.id, groupNo);
                  return `
                    <tr>
                      <td>
                        <strong>${escapeHtml(sub.nameAr)}</strong>
                        <div class="mono" style="font-size: 12px; color: var(--muted);">${escapeHtml(sub.nameFr)}</div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-start; flex-wrap: wrap;">
                          ${renderTeacherDisplayHtml(teacher)}
                          ${
                            isOwner
                              ? `<button type="button" class="btn-secondary edit-teacher-btn" data-kind="td" data-sub="${sub.id}" data-grp="${groupNo}" style="padding: 2px 8px; font-size: 11px;">${teacher.name ? "تعديل" : "تعيين"}</button>`
                              : ""
                          }
                        </div>
                      </td>
                      <td><span class="badge-tag mono">${count}</span></td>
                      <td>
                        <a href="#/groupe/${groupNo}/td/${sub.id}" class="btn-primary" style="padding: 4px 12px; font-size: 12px; width: auto; text-decoration: none;">
                          فتح
                        </a>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  } else if (tab === "tp") {
    // Students see only subjects that have a teacher assigned or files for this group.
    // Owner/admin see every subject so they can assign teachers.
    const validSubs = SUBJECT_DEFINITIONS.filter(sub =>
      isOwner ||
      getResolvedTeacher("tp", sub.id, groupNo).name ||
      state.filesCache.some(f =>
        f.kind === "tp" &&
        normalizeSubjectId(f.subject) === sub.id &&
        (f.group_no === groupNo || f.group_no === null)
      )
    );

    tabContainer.innerHTML = `
      <div class="content-card">
        <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 14px;">حصص الأعمال التطبيقية (TP) — الفوج G${groupNo}</h3>
        ${validSubs.length === 0 ? `<p style="color: var(--muted);">لم تُضف حصص TP لهذا الفوج بعد.</p>` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>المقياس</th>
                  <th>أستاذ الـ TP</th>
                  <th>عدد الملفات</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                ${validSubs.map(sub => {
                  const count = state.filesCache.filter(f =>
                    f.kind === "tp" &&
                    normalizeSubjectId(f.subject) === sub.id &&
                    (f.group_no === groupNo || f.group_no === null)
                  ).length;
                  const teacher = getResolvedTeacher("tp", sub.id, groupNo);
                  return `
                    <tr>
                      <td>
                        <strong>${escapeHtml(sub.nameAr)}</strong>
                        <div class="mono" style="font-size: 12px; color: var(--muted);">${escapeHtml(sub.nameFr)}</div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-start; flex-wrap: wrap;">
                          ${renderTeacherDisplayHtml(teacher)}
                          ${
                            isOwner
                              ? `<button type="button" class="btn-secondary edit-teacher-btn" data-kind="tp" data-sub="${sub.id}" data-grp="${groupNo}" style="padding: 2px 8px; font-size: 11px;">${teacher.name ? "تعديل" : "تعيين"}</button>`
                              : ""
                          }
                        </div>
                      </td>
                      <td><span class="badge-tag mono">${count}</span></td>
                      <td>
                        <a href="#/groupe/${groupNo}/tp/${sub.id}" class="btn-primary" style="padding: 4px 12px; font-size: 12px; width: auto; text-decoration: none;">
                          فتح
                        </a>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  } else if (tab === "exam") {
    const examFiles = state.filesCache.filter(f =>
      f.kind === "exam" && (f.group_no === groupNo || f.group_no === null)
    );

    tabContainer.innerHTML = `
      <div class="content-card">
        <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 14px;">الامتحانات والاختبارات السابقة — الفوج G${groupNo}</h3>
        ${examFiles.length === 0 ? `<p style="color: var(--muted); text-align: center; padding: 20px;">ما كاين حتى ملف بعد</p>` : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>المادة</th>
                  <th>تاريخ الرفع</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                ${examFiles.map(f => `
                  <tr>
                    <td><strong>${escapeHtml(f.title)}</strong></td>
                    <td>${escapeHtml(getSubjectObj(normalizeSubjectId(f.subject)).nameAr)}</td>
                    <td class="mono" style="font-size: 12px;">${formatDate(f.created_at)}</td>
                    <td>
                      <a href="#/voir/${f.id}" class="btn-secondary" style="padding: 4px 10px; font-size: 12px; text-decoration: none;">عرض</a>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  if (isOwner) {
    tabContainer.querySelectorAll(".edit-teacher-btn").forEach(btn => {
      btn.onclick = () => {
        const k = btn.getAttribute("data-kind");
        const sId = btn.getAttribute("data-sub");
        const gNo = parseInt(btn.getAttribute("data-grp"), 10);
        openTeacherEditModal(k, sId, gNo, () => {
          renderGroupDetailView(page, groupNo, tab, subjectId);
        });
      };
    });
  }
}

// 15. OWNER TEACHER EDIT MODAL DIALOG
function openTeacherEditModal(kind, subjectId, groupNo, onSavedCallback) {
  if (!canManageContent()) return;
  if (kind === "cours") groupNo = null; // "cours" teachers are stored with group_no = NULL

  const current = getResolvedTeacher(kind, subjectId, groupNo);
  const subObj = getSubjectObj(subjectId);
  const targetLabel = kind === "cours" ? "المحاضرة (كل الأفواج)" : `الفوج G${groupNo}`;

  const modal = document.createElement("div");
  modal.className = "dialog-overlay";
  modal.innerHTML = `
    <div class="dialog-box">
      <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 6px;">
        تعيين / تعديل أستاذ: ${escapeHtml(subObj.nameAr)} (${kind.toUpperCase()})
      </h3>
      <p style="font-size: 13px; color: var(--muted); margin-bottom: 14px;">
        نطاق التعديل: <strong>${escapeHtml(targetLabel)}</strong>
      </p>

      <div id="teacherEditAlert" class="auth-error-box"></div>

      <form id="teacherEditForm">
        <div class="form-group">
          <label class="form-label" for="teacherEditName">اسم الأستاذ *</label>
          <input type="text" id="teacherEditName" class="form-control" value="${escapeHtml(current.name || '')}" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="teacherEditEmail">البريد الإلكتروني (اختياري)</label>
          <input type="email" id="teacherEditEmail" class="form-control mono" value="${escapeHtml(current.email || '')}" placeholder="teacher@univ.dz">
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 18px; flex-wrap: wrap;">
          <button type="button" class="btn-danger" id="teacherResetBtn" style="padding: 8px 12px;${current.isCustom ? "" : " visibility: hidden;"}">
            حذف الأستاذ
          </button>

          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-secondary" id="teacherCancelBtn">إلغاء</button>
            <button type="submit" class="btn-primary" id="teacherSaveBtn" style="width: auto; min-width: 100px;">حفظ</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#teacherEditForm");
  const alertBox = modal.querySelector("#teacherEditAlert");
  const cancelBtn = modal.querySelector("#teacherCancelBtn");
  const resetBtn = modal.querySelector("#teacherResetBtn");
  const saveBtn = modal.querySelector("#teacherSaveBtn");

  const closeModal = () => modal.remove();
  cancelBtn.onclick = closeModal;

  form.onsubmit = async (e) => {
    e.preventDefault();
    alertBox.style.display = "none";

    const name = modal.querySelector("#teacherEditName").value.trim();
    const email = modal.querySelector("#teacherEditEmail").value.trim();

    if (!name) {
      alertBox.textContent = "يرجى كتابة اسم الأستاذ.";
      alertBox.style.display = "block";
      return;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alertBox.textContent = "صيغة البريد الإلكتروني غير صحيحة.";
        alertBox.style.display = "block";
        return;
      }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "جاري الحفظ...";

    try {
      const payload = {
        kind,
        subject_id: subjectId,
        group_no: groupNo, // NULL for cours, 1..10 for td/tp
        name,
        email: email || null,
        updated_at: new Date().toISOString()
      };

      // Find the existing row first (works with NULL group_no), then update or insert.
      let findQ = supabase
        .from("teacher_info")
        .select("id")
        .eq("kind", kind)
        .eq("subject_id", subjectId);
      findQ = groupNo === null ? findQ.is("group_no", null) : findQ.eq("group_no", groupNo);
      const { data: existingRow, error: findErr } = await findQ.maybeSingle();
      if (findErr) throw new Error(findErr.message);

      const { error } = existingRow
        ? await supabase.from("teacher_info").update(payload).eq("id", existingRow.id)
        : await supabase.from("teacher_info").insert(payload);

      if (error) {
        throw new Error(error.message);
      }

      await loadTeacherInfoCache();
      closeModal();
      if (onSavedCallback) onSavedCallback();
    } catch (err) {
      alertBox.textContent = `خطأ: ${err.message}`;
      alertBox.style.display = "block";
      saveBtn.disabled = false;
      saveBtn.textContent = "حفظ";
    }
  };

  resetBtn.onclick = async () => {
    if (!confirm("هل أنت متأكد من حذف هذا الأستاذ من الحصة؟")) return;

    resetBtn.disabled = true;
    resetBtn.textContent = "جاري الحذف...";

    try {
      let delQ = supabase
        .from("teacher_info")
        .delete()
        .eq("kind", kind)
        .eq("subject_id", subjectId);
      delQ = groupNo === null ? delQ.is("group_no", null) : delQ.eq("group_no", groupNo);
      const { error } = await delQ;

      if (error) {
        throw new Error(error.message);
      }

      await loadTeacherInfoCache();
      closeModal();
      if (onSavedCallback) onSavedCallback();
    } catch (err) {
      alertBox.textContent = `خطأ في الحذف: ${err.message}`;
      alertBox.style.display = "block";
      resetBtn.disabled = false;
      resetBtn.textContent = "حذف الأستاذ";
    }
  };
}

// 16. PAGE: LESSON LIST (#/groupe/N/<tab>/<subjectId>)
function renderSubjectLessonsView(page, groupNo, tab, subjectId) {
  const subObj = getSubjectObj(subjectId);
  const teacher = getResolvedTeacher(tab, subjectId, groupNo);
  const isOwner = canManageContent() && ["cours", "td", "tp"].includes(tab);

  let files = state.filesCache.filter(f => {
    const sMatch = normalizeSubjectId(f.subject) === subjectId;
    if (!sMatch) return false;
    if (tab === "cours") {
      return f.kind === "cours";
    }
    return f.kind === tab && (f.group_no === groupNo || f.group_no === null);
  }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const tabLabel = tab === "cours" ? "الكور" : tab.toUpperCase();

  page.innerHTML = `
    <div class="breadcrumb">
      <a href="#/groupes">الأفواج</a>
      <span>›</span>
      <a href="#/groupe/${groupNo}" class="mono">G${groupNo}</a>
      <span>›</span>
      <a href="#/groupe/${groupNo}/${tab}">${tabLabel}</a>
      <span>›</span>
      <span class="current">${escapeHtml(subObj.nameAr)}</span>
    </div>

    <div class="page-banner">
      <h2>${escapeHtml(subObj.nameAr)} (<span class="mono">${escapeHtml(subObj.nameFr)}</span>)</h2>
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
        <span>الأستاذ المشرف: <strong>${renderTeacherDisplayHtml(teacher)}</strong> · الفوج <span class="mono">G${groupNo}</span></span>
        ${
          isOwner
            ? `<button type="button" class="btn-secondary edit-teacher-btn" data-kind="${tab}" data-sub="${subObj.id}" data-grp="${tab === 'cours' ? 0 : groupNo}" style="padding: 2px 8px; font-size: 11px;">${teacher.name ? "تعديل الأستاذ" : "تعيين الأستاذ"}</button>`
            : ""
        }
      </div>
    </div>

    <div class="content-card">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark);">قائمة الدروس والملفات (<span class="mono">${files.length}</span>)</h3>
        <input type="text" id="lessonSearchInput" class="form-control" placeholder="تصفية الدروس بالعنوان..." style="max-width: 280px; padding: 6px 12px; font-size: 13px;">
      </div>

      <div id="lessonsTableWrapper">
        ${renderLessonsTableHtml(files)}
      </div>
    </div>
  `;

  const searchInput = document.getElementById("lessonSearchInput");
  const wrapper = document.getElementById("lessonsTableWrapper");
  if (searchInput && wrapper) {
    searchInput.oninput = () => {
      const q = searchInput.value.trim().toLowerCase();
      const filtered = files.filter(f => (f.title || "").toLowerCase().includes(q));
      wrapper.innerHTML = renderLessonsTableHtml(filtered);
    };
  }

  if (isOwner) {
    page.querySelectorAll(".edit-teacher-btn").forEach(btn => {
      btn.onclick = () => {
        const k = btn.getAttribute("data-kind");
        const sId = btn.getAttribute("data-sub");
        const gNo = parseInt(btn.getAttribute("data-grp"), 10);
        openTeacherEditModal(k, sId, gNo, () => {
          renderSubjectLessonsView(page, groupNo, tab, subjectId);
        });
      };
    });
  }
}

function renderLessonsTableHtml(filesList) {
  if (filesList.length === 0) {
    return `<div style="text-align: center; padding: 30px; color: var(--muted); font-size: 14px;">ما كاين حتى درس بعد</div>`;
  }
  return `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 50px;">الرقم</th>
            <th>عنوان الدرس</th>
            <th>تاريخ النشر</th>
            <th>إجراء</th>
          </tr>
        </thead>
        <tbody>
          ${filesList.map((f, idx) => {
            const isNew = isWithinDays(f.created_at, 7);
            return `
              <tr>
                <td class="mono" style="font-weight: 500;">#${idx + 1}</td>
                <td>
                  <strong>${escapeHtml(f.title)}</strong>
                  ${isNew ? '<span class="badge-new">جديد</span>' : ''}
                </td>
                <td class="mono" style="font-size: 12px;">${formatDate(f.created_at)}</td>
                <td>
                  <a href="#/voir/${f.id}" class="btn-primary" style="padding: 4px 12px; font-size: 12px; width: auto; text-decoration: none;">عرض</a>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// Teacher directory: built from the existing course/group teacher data and overrides.
function collectTeachers() {
  const teachers = new Map();
  const add = (name, kind, subjectId, groupNo) => {
    if (!name) return;
    const slug = teacherSlug(name);
    if (!teachers.has(slug)) teachers.set(slug, { slug, name, assignments: [] });
    const item = teachers.get(slug);
    if (!item.assignments.some(a => a.kind === kind && a.subjectId === subjectId && a.groupNo === groupNo)) {
      item.assignments.push({ kind, subjectId, groupNo });
    }
  };
  for (const sub of SUBJECT_DEFINITIONS) {
    add(getResolvedTeacher("cours", sub.id, 0).name, "cours", sub.id, 0);
    for (let g = 1; g <= 10; g++) {
      add(getResolvedTeacher("td", sub.id, g).name, "td", sub.id, g);
      add(getResolvedTeacher("tp", sub.id, g).name, "tp", sub.id, g);
    }
  }
  return [...teachers.values()].sort((a,b) => a.name.localeCompare(b.name));
}

function teacherKindLabel(kind) {
  return kind === "cours" ? "Cours" : kind === "td" ? "TD" : "TP";
}

function renderTeachersView(page, kindFilter = "all") {
  const teachers = collectTeachers().filter(t => kindFilter === "all" || t.assignments.some(a => a.kind === kindFilter));
  const heading = kindFilter === "all" ? "دليل الأساتذة" : `أساتذة ${teacherKindLabel(kindFilter)}`;
  page.innerHTML = `
    <div class="page-banner"><h2>${heading}</h2><p>ابحث عن الأستاذ وافتح صفحته للاطلاع على المواد والملفات المتاحة لحسابك.</p></div>
    <div class="content-card">
      <label class="form-label" for="teacherSearchInput">البحث عن أستاذ</label>
      <input id="teacherSearchInput" class="form-control" type="search" placeholder="اكتب اسم الأستاذ..." autocomplete="off">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;margin-bottom:16px;">
        <a class="btn-secondary" href="#/teachers">الكل</a><a class="btn-secondary" href="#/teachers/cours">Cours</a><a class="btn-secondary" href="#/teachers/td">TD</a><a class="btn-secondary" href="#/teachers/tp">TP</a>
      </div>
      <div id="teacherDirectoryResults" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">
        ${teachers.map(t => `<article class="content-card teacher-directory-card" data-name="${escapeHtml(t.name.toLowerCase())}" style="margin:0;padding:16px;"><strong>${escapeHtml(t.name)}</strong><p style="color:var(--muted);font-size:12px;margin:8px 0;">${[...new Set(t.assignments.filter(a => kindFilter === "all" || a.kind === kindFilter).map(a => teacherKindLabel(a.kind)))].join(" · ")}</p><a href="#/teacher/${encodeURIComponent(t.slug)}" class="btn-primary" style="display:inline-block;width:auto;text-decoration:none;">صفحة الأستاذ والملفات</a></article>`).join("")}
      </div>
      ${teachers.length ? "" : `<p style="color:var(--muted);text-align:center;padding:20px;">لا توجد بيانات أساتذة لهذا القسم حاليًا.</p>`}
    </div>`;
  const input = page.querySelector("#teacherSearchInput");
  input?.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    page.querySelectorAll(".teacher-directory-card").forEach(card => { card.style.display = card.dataset.name.includes(q) ? "" : "none"; });
  });
}

function renderTeacherProfileView(page, slug) {
  const teacher = collectTeachers().find(t => t.slug === slug);
  if (!teacher) { renderNotFoundView(page); return; }
  const assignments = teacher.assignments;
  const accessibleFiles = getAccessibleFiles();
  const subjectIds = [...new Set(assignments.map(a => a.subjectId))];
  // The files schema links files to subjects/groups, not directly to teacher IDs.
  // Show accessible files for the subjects and assignment types this teacher teaches.
  const relatedFiles = accessibleFiles.filter(f => {
    const sid = normalizeSubjectId(f.subject);
    if (!subjectIds.includes(sid)) return false;
    return assignments.some(a => a.subjectId === sid && (a.kind === "cours" ? f.kind === "cours" : a.kind === f.kind && (f.group_no == null || f.group_no === a.groupNo)));
  });
  page.innerHTML = `
    <div class="breadcrumb"><a href="#/teachers">الأساتذة</a><span>›</span><span>${escapeHtml(teacher.name)}</span></div>
    <div class="page-banner"><h2>${escapeHtml(teacher.name)}</h2><p>المواد والأفواج والملفات المرتبطة بتدريس هذا الأستاذ وفق البيانات المتاحة.</p></div>
    <div class="content-card"><h3 style="margin-bottom:12px;">المواد والأفواج</h3>
      <div class="table-responsive"><table class="data-table"><thead><tr><th>نوع الحصة</th><th>المادة</th><th>الفوج</th><th>الانتقال</th></tr></thead><tbody>
      ${assignments.map(a => { const sub = getSubjectObj(a.subjectId); return `<tr><td>${teacherKindLabel(a.kind)}</td><td>${escapeHtml(sub.nameAr)}</td><td>${a.kind === "cours" ? "كل الأفواج" : `G${a.groupNo}`}</td><td><a class="btn-secondary" style="text-decoration:none;padding:4px 8px;" href="#/groupe/${a.kind === "cours" ? (state.studentGroup || 1) : a.groupNo}/${a.kind}/${a.subjectId}">عرض المادة</a></td></tr>`; }).join("")}
      </tbody></table></div>
    </div>
    <div class="content-card"><h3 style="margin-bottom:12px;">الملفات المتاحة (${relatedFiles.length})</h3>
      ${relatedFiles.length ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>عنوان الملف</th><th>المادة</th><th>النوع</th><th>الفوج</th><th>إجراء</th></tr></thead><tbody>${relatedFiles.map(f => `<tr><td>${escapeHtml(f.title)}</td><td>${escapeHtml(getSubjectObj(normalizeSubjectId(f.subject)).nameAr)}</td><td>${escapeHtml(teacherKindLabel(f.kind))}</td><td>${f.group_no ? `G${f.group_no}` : "كل الأفواج"}</td><td><a class="btn-secondary" style="text-decoration:none;padding:4px 8px;" href="#/voir/${encodeURIComponent(f.id)}">عرض الملف</a></td></tr>`).join("")}</tbody></table></div>` : `<p style="color:var(--muted);text-align:center;padding:18px;">لا توجد ملفات متاحة مرتبطة بمواد هذا الأستاذ حاليًا. قد تظهر الملفات بعد رفعها وربطها بالمادة والفوج الصحيحين.</p>`}
    </div>`;
}

// 17. PAGE: TIMETABLE (#/horaire)
// Sessions come from the schedule_entries table. Everyone reads it;
// only owner/admin can add, edit or delete sessions (enforced by RLS too).
const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const KIND_LABELS = { cours: "Cours", td: "TD", tp: "TP" };

function fmtTime(t) {
  return String(t || "").slice(0, 5);
}

function renderTimetableView(page) {
  const canManage = canManageContent();
  let selectedGroup = state.studentGroup || state.uploaderGroup || 1;

  page.innerHTML = `
    <div class="page-banner">
      <h2>الجدول الزمني الأسبوعي (<span class="mono">Emploi du Temps</span>)</h2>
      <p>المحاضرات المشتركة وحصص الـ TD/TP الخاصة بكل فوج.</p>
    </div>

    <div class="content-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label class="form-label" for="timetableGroupSelect" style="margin: 0;">عرض جدول الفوج:</label>
          <select id="timetableGroupSelect" class="form-control mono" style="width: auto; padding: 6px 12px; font-weight: 500;">
            ${[1,2,3,4,5,6,7,8,9,10].map(g => `
              <option value="${g}" ${g === selectedGroup ? "selected" : ""}>G${g}</option>
            `).join("")}
          </select>
        </div>
        ${canManage ? `<button type="button" class="btn-primary" id="addSessionBtn" style="width: auto; padding: 8px 16px;">إضافة حصة</button>` : ""}
      </div>

      <div class="timetable-legend">
        <div class="legend-item">
          <span class="legend-color" style="background-color: var(--brown);"></span>
          <span>محاضرة (Cours)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: var(--soft); border: 1px solid var(--line);"></span>
          <span>أعمال موجهة (TD)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #fff; border: 1px dashed var(--brown);"></span>
          <span>أعمال تطبيقية (TP)</span>
        </div>
      </div>

      ${canManage && state.scheduleError ? `
        <div class="auth-error-box" style="display: block; margin-bottom: 12px;">
          تعذر تحميل الجدول: ${escapeHtml(state.scheduleError)}
          <br>إذا كان الجدول غير موجود في قاعدة البيانات، شغّل الملف migration_schedule.sql في Supabase (SQL Editor).
        </div>` : ""}

      <div id="timetableRenderContainer"></div>
    </div>
  `;

  const container = document.getElementById("timetableRenderContainer");
  const select = document.getElementById("timetableGroupSelect");
  const addBtn = document.getElementById("addSessionBtn");

  function draw() {
    container.innerHTML = generateWeeklyTableHtml(selectedGroup, canManage);
    if (!canManage) return;

    container.querySelectorAll(".edit-session-btn").forEach(btn => {
      btn.onclick = () => {
        const entry = state.scheduleCache.find(e => String(e.id) === btn.getAttribute("data-id"));
        if (entry) openScheduleModal(entry, selectedGroup, draw);
      };
    });

    container.querySelectorAll(".delete-session-btn").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("هل تريد حذف هذه الحصة من الجدول؟")) return;
        btn.disabled = true;
        const { error } = await supabase
          .from("schedule_entries")
          .delete()
          .eq("id", btn.getAttribute("data-id"));
        if (error) {
          alert(`فشل الحذف: ${error.message}`);
          btn.disabled = false;
          return;
        }
        await loadScheduleCache();
        draw();
      };
    });
  }

  select.onchange = () => {
    selectedGroup = parseInt(select.value, 10);
    draw();
  };

  if (addBtn) {
    addBtn.onclick = () => openScheduleModal(null, selectedGroup, draw);
  }

  draw();
}

function generateWeeklyTableHtml(grp, canManage) {
  // Shared sessions (group_no NULL) + sessions of the selected group
  const entries = state.scheduleCache.filter(e => e.group_no === null || e.group_no === grp);

  if (entries.length === 0) {
    return `
      <div style="text-align: center; padding: 30px; color: var(--muted); font-size: 14px;">
        لم يُضف الجدول بعد
        ${canManage ? `<div style="margin-top: 6px; font-size: 13px;">استعمل زر "إضافة حصة" لإضافة أول حصة.</div>` : ""}
      </div>
    `;
  }

  const days = [0, 1, 2, 3, 4];
  if (entries.some(e => e.day_of_week === 5)) days.push(5);
  if (entries.some(e => e.day_of_week === 6)) days.push(6);

  const chipHtml = (e) => {
    const sub = getSubjectObj(e.subject_id);
    const kind = KIND_LABELS[e.kind] ? e.kind : "cours";
    const cls = kind === "cours" ? "chip-cours" : kind === "td" ? "chip-td" : "chip-tp";
    const teacher = getResolvedTeacher(kind, e.subject_id, kind === "cours" ? null : (e.group_no ?? grp));
    return `
      <div class="${cls}" style="text-align: right; min-width: 190px;">
        <div class="mono" style="font-size: 11px;">${escapeHtml(fmtTime(e.start_time))} – ${escapeHtml(fmtTime(e.end_time))}</div>
        <strong>${KIND_LABELS[kind]} ${escapeHtml(sub.nameFr)}</strong>
        ${teacher.name ? `<div>${escapeHtml(teacher.name)}</div>` : ""}
        ${e.room ? `<div class="mono" style="font-size: 11px;">${escapeHtml(e.room)}</div>` : ""}
        ${e.group_no === null && kind !== "cours" ? `<div style="font-size: 11px;">كل الأفواج</div>` : ""}
        ${canManage ? `
          <div style="margin-top: 6px; display: flex; gap: 6px;">
            <button type="button" class="btn-secondary edit-session-btn" data-id="${e.id}" style="padding: 2px 8px; font-size: 11px;">تعديل</button>
            <button type="button" class="btn-danger delete-session-btn" data-id="${e.id}" style="padding: 2px 8px; font-size: 11px;">حذف</button>
          </div>` : ""}
      </div>
    `;
  };

  const rows = days.map(d => {
    const list = entries
      .filter(e => e.day_of_week === d)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    const cell = list.length
      ? `<div style="display: flex; flex-wrap: wrap; gap: 8px;">${list.map(chipHtml).join("")}</div>`
      : `<span class="chip-empty">—</span>`;
    return `
      <tr>
        <td class="timetable-slot-time">${DAY_NAMES[d]}</td>
        <td style="text-align: right;">${cell}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="timetable-container">
      <table class="timetable-table" style="min-width: 0;">
        <thead>
          <tr><th style="width: 110px;">اليوم</th><th>الحصص</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// Add / edit one session (owner & admin only)
function openScheduleModal(entry, defaultGroup, onSaved) {
  if (!canManageContent()) return;

  const isEdit = !!entry;
  const v = entry || {
    day_of_week: 0,
    start_time: "08:30",
    end_time: "10:00",
    subject_id: SUBJECT_DEFINITIONS[0].id,
    kind: "cours",
    room: "",
    group_no: null
  };

  const modal = document.createElement("div");
  modal.className = "dialog-overlay";
  modal.innerHTML = `
    <div class="dialog-box">
      <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 14px;">
        ${isEdit ? "تعديل حصة" : "إضافة حصة"}
      </h3>
      <div id="scheduleAlert" class="auth-error-box"></div>

      <form id="scheduleForm">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
          <div class="form-group">
            <label class="form-label" for="schDay">اليوم *</label>
            <select id="schDay" class="form-control" required>
              ${DAY_NAMES.map((n, i) => `<option value="${i}" ${i === v.day_of_week ? "selected" : ""}>${n}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="schStart">من *</label>
            <input type="time" id="schStart" class="form-control mono" value="${escapeHtml(fmtTime(v.start_time))}" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="schEnd">إلى *</label>
            <input type="time" id="schEnd" class="form-control mono" value="${escapeHtml(fmtTime(v.end_time))}" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
          <div class="form-group">
            <label class="form-label" for="schSubject">المقياس *</label>
            <select id="schSubject" class="form-control" required>
              ${SUBJECT_DEFINITIONS.map(sb => `<option value="${sb.id}" ${sb.id === v.subject_id ? "selected" : ""}>${escapeHtml(sb.nameAr)}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="schKind">النوع *</label>
            <select id="schKind" class="form-control mono" required>
              <option value="cours" ${v.kind === "cours" ? "selected" : ""}>Cours</option>
              <option value="td" ${v.kind === "td" ? "selected" : ""}>TD</option>
              <option value="tp" ${v.kind === "tp" ? "selected" : ""}>TP</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="schGroup">الفوج *</label>
            <select id="schGroup" class="form-control mono" required>
              <option value="all" ${v.group_no === null ? "selected" : ""}>كل الأفواج</option>
              ${[1,2,3,4,5,6,7,8,9,10].map(g => `<option value="${g}" ${v.group_no === g ? "selected" : ""}>G${g}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="schRoom">القاعة / المدرج (اختياري)</label>
          <input type="text" id="schRoom" class="form-control" value="${escapeHtml(v.room || "")}" placeholder="مثال: Amphi A">
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
          <button type="button" class="btn-secondary" id="schCancelBtn">إلغاء</button>
          <button type="submit" class="btn-primary" id="schSaveBtn" style="width: auto; min-width: 100px;">حفظ</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const form = modal.querySelector("#scheduleForm");
  const alertBox = modal.querySelector("#scheduleAlert");
  const kindSel = modal.querySelector("#schKind");
  const groupSel = modal.querySelector("#schGroup");
  const saveBtn = modal.querySelector("#schSaveBtn");
  const closeModal = () => modal.remove();
  modal.querySelector("#schCancelBtn").onclick = closeModal;

  // Cours are shared by all groups; TD/TP usually belong to one group.
  const syncGroupWithKind = () => {
    if (kindSel.value === "cours") {
      groupSel.value = "all";
      groupSel.disabled = true;
    } else {
      groupSel.disabled = false;
      if (groupSel.value === "all" && !isEdit) groupSel.value = String(defaultGroup || 1);
    }
  };
  kindSel.onchange = syncGroupWithKind;
  syncGroupWithKind();

  form.onsubmit = async (e) => {
    e.preventDefault();
    alertBox.style.display = "none";

    const start = modal.querySelector("#schStart").value;
    const end = modal.querySelector("#schEnd").value;
    if (!start || !end || end <= start) {
      alertBox.textContent = "وقت النهاية لازم يكون بعد وقت البداية.";
      alertBox.style.display = "block";
      return;
    }

    const kind = kindSel.value;
    const groupVal = groupSel.value;
    const payload = {
      day_of_week: parseInt(modal.querySelector("#schDay").value, 10),
      start_time: start,
      end_time: end,
      subject_id: modal.querySelector("#schSubject").value,
      kind,
      room: modal.querySelector("#schRoom").value.trim() || null,
      group_no: kind === "cours" || groupVal === "all" ? null : parseInt(groupVal, 10)
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "جاري الحفظ...";

    try {
      const { error } = isEdit
        ? await supabase.from("schedule_entries").update(payload).eq("id", entry.id)
        : await supabase.from("schedule_entries").insert(payload);
      if (error) throw new Error(error.message);

      await loadScheduleCache();
      closeModal();
      if (onSaved) onSaved();
    } catch (err) {
      const msg = String(err.message || err);
      const hint = /schedule_entries|does not exist|schema cache/i.test(msg)
        ? " — شغّل الملف migration_schedule.sql في Supabase (SQL Editor) أولا."
        : "";
      alertBox.textContent = `خطأ: ${msg}${hint}`;
      alertBox.style.display = "block";
      saveBtn.disabled = false;
      saveBtn.textContent = "حفظ";
    }
  };
}

// 18. PAGE: VIEW-ONLY PDF VIEWER (#/voir/:id)
async function renderPdfViewerView(page, fileId) {
  let fileObj = state.filesCache.find(f => String(f.id) === String(fileId));
  if (!fileObj) {
    const { data } = await supabase.from("files").select("*").eq("id", fileId).single();
    if (data) {
      fileObj = data;
    }
  }

  if (!fileObj) {
    page.innerHTML = `
      <div class="content-card" style="text-align: center; padding: 40px;">
        <h2 style="font-size: 18px; color: var(--danger); margin-bottom: 8px;">الملف غير موجود</h2>
        <a href="#/" class="btn-primary" style="display: inline-block; width: auto;">العودة للرئيسية</a>
      </div>
    `;
    return;
  }

  page.innerHTML = `
    <div class="breadcrumb">
      <a href="#/">الرئيسية</a>
      <span>›</span>
      <span class="current">${escapeHtml(fileObj.title)}</span>
    </div>

    <div class="pdf-viewer-wrap" id="pdfViewerContainer" oncontextmenu="return false;">
      <div class="pdf-viewer-toolbar">
        <div class="pdf-toolbar-group">
          <strong>${escapeHtml(fileObj.title)}</strong>
          <span class="badge-tag mono" style="margin-right: 8px;">${escapeHtml(fileObj.subject)}</span>
        </div>

        <div class="pdf-toolbar-group">
          <button type="button" class="btn-secondary" id="pdfPrevPage" style="padding: 4px 10px;">السابق</button>
          <span style="font-size: 13px;" class="mono" id="pdfPageIndicator">صفحة 1 / 1</span>
          <button type="button" class="btn-secondary" id="pdfNextPage" style="padding: 4px 10px;">التالي</button>

          <span style="border-right: 1px solid var(--line); height: 20px; margin: 0 4px;"></span>

          <button type="button" class="btn-secondary mono" id="pdfZoomOut" style="padding: 4px 10px;">-</button>
          <span style="font-size: 12px;" class="mono" id="pdfZoomLevel">100%</span>
          <button type="button" class="btn-secondary mono" id="pdfZoomIn" style="padding: 4px 10px;">+</button>
        </div>
      </div>

      <div class="pdf-canvas-container" id="pdfCanvasContainer">
        <div id="pdfLoadingState" style="color: #ffffff; padding: 40px; text-align: center;">جاري تجهيز وعرض الملف...</div>
        <canvas id="pdfCanvas" style="display: none;"></canvas>
        <div id="pdfErrorState" style="display: none; color: #fca5a5; padding: 30px; text-align: center;"></div>
      </div>

      <div class="pdf-viewer-footer-note">
        هذا الملف محمي ومتاح للاطلاع فقط.
      </div>
    </div>
  `;

  const container = document.getElementById("pdfViewerContainer");
  if (container) {
    container.addEventListener("contextmenu", e => e.preventDefault());
  }

  try {
    const { data: signedData, error: signedError } = await supabase.storage
      .from("course-files")
      .createSignedUrl(fileObj.path, 300);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(signedError?.message || "فشل الحصول على رابط آمن لعرض الملف.");
    }

    loadPdfWithPdfJs(signedData.signedUrl);
  } catch (err) {
    showPdfError(err.message || "تعذر فتح المستند.");
  }
}

function showPdfError(msg) {
  const loading = document.getElementById("pdfLoadingState");
  const errBox = document.getElementById("pdfErrorState");
  if (loading) loading.style.display = "none";
  if (errBox) {
    errBox.innerHTML = `خطأ في المعاينة: ${escapeHtml(msg)}<br><small>لا يمكن تحميل الملف مباشرة لأسباب أمنية.</small>`;
    errBox.style.display = "block";
  }
}

async function loadPdfWithPdfJs(pdfUrl) {
  const loading = document.getElementById("pdfLoadingState");
  const canvas = document.getElementById("pdfCanvas");
  if (!window.pdfjsLib) {
    showPdfError("مكتبة pdf.js غير متوفرة.");
    return;
  }

  try {
    const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
    const pdfDoc = await loadingTask.promise;
    state.activePdfDoc = pdfDoc;
    state.pdfCurrentPage = 1;
    state.pdfTotalPages = pdfDoc.numPages;
    state.pdfScale = 1.2;

    if (loading) loading.style.display = "none";
    if (canvas) canvas.style.display = "block";

    renderPdfPage(state.pdfCurrentPage);

    document.getElementById("pdfPrevPage").onclick = () => {
      if (state.pdfCurrentPage > 1) {
        state.pdfCurrentPage--;
        renderPdfPage(state.pdfCurrentPage);
      }
    };

    document.getElementById("pdfNextPage").onclick = () => {
      if (state.pdfCurrentPage < state.pdfTotalPages) {
        state.pdfCurrentPage++;
        renderPdfPage(state.pdfCurrentPage);
      }
    };

    document.getElementById("pdfZoomIn").onclick = () => {
      state.pdfScale = Math.min(state.pdfScale + 0.2, 2.5);
      document.getElementById("pdfZoomLevel").textContent = `${Math.round(state.pdfScale * 100)}%`;
      renderPdfPage(state.pdfCurrentPage);
    };

    document.getElementById("pdfZoomOut").onclick = () => {
      state.pdfScale = Math.max(state.pdfScale - 0.2, 0.6);
      document.getElementById("pdfZoomLevel").textContent = `${Math.round(state.pdfScale * 100)}%`;
      renderPdfPage(state.pdfCurrentPage);
    };
  } catch (e) {
    showPdfError(e.message || "تعذر تصيير صفحات ملف الـ PDF.");
  }
}

async function renderPdfPage(num) {
  if (!state.activePdfDoc) return;
  const canvas = document.getElementById("pdfCanvas");
  if (!canvas) return;

  const page = await state.activePdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: state.pdfScale });
  const ctx = canvas.getContext("2d");

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };

  await page.render(renderContext).promise;

  const indicator = document.getElementById("pdfPageIndicator");
  if (indicator) {
    indicator.textContent = `صفحة ${num} / ${state.pdfTotalPages}`;
  }
}

// 19. PAGE: MINIMAL ADMIN FOR OWNER ONLY (#/admin)
async function renderAdminView(page) {
  page.innerHTML = `
    <div class="page-banner">
      <h2>الإدارة</h2>
      <p>${state.role === "owner" ? "إدارة وتعيين المشرفين ورؤساء الأقسام." : "إدارة وتعيين رؤساء الأقسام للأفواج الدراسية."}</p>
    </div>

    ${state.role === "owner" ? `
    <!-- Card 0: Admins (owner only) -->
    <div class="content-card">
      <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 6px;">المشرفون</h3>
      <p style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">المشرف يضيف ويعدل الأساتذة والجدول الزمني والملفات، ويعين رؤساء الأقسام. يجب أن يكون الحساب مسجلا مسبقا.</p>
      <div id="addAdminAlertError" class="auth-error-box"></div>
      <div id="addAdminAlertSuccess" class="auth-success-box"></div>
      <form id="addAdminForm" style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 16px;">
        <div class="form-group" style="flex: 2; min-width: 220px; margin-bottom: 0;">
          <label class="form-label" for="adminEmailInput">البريد الإلكتروني *</label>
          <input type="email" id="adminEmailInput" class="form-control mono" placeholder="admin@example.com" required>
        </div>
        <button type="submit" class="btn-primary" id="addAdminSubmitBtn" style="width: auto; min-width: 110px; height: 42px;">إضافة مشرف</button>
      </form>
      <div id="adminsListTableWrapper">
        <div style="padding: 20px; text-align: center; color: var(--muted);">جاري تحميل القائمة...</div>
      </div>
    </div>
    ` : ""}

    <!-- Card 1: Add Section Head -->
    <div class="content-card">
      <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 12px;">إضافة رئيس قسم</h3>
      <div id="addHeadAlertError" class="auth-error-box"></div>
      <div id="addHeadAlertSuccess" class="auth-success-box"></div>

      <form id="addHeadForm" style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
        <div class="form-group" style="flex: 2; min-width: 220px; margin-bottom: 0;">
          <label class="form-label" for="headEmailInput">البريد الإلكتروني للطالب *</label>
          <input type="email" id="headEmailInput" class="form-control mono" placeholder="student@univ.dz" required>
        </div>

        <div class="form-group" style="flex: 1; min-width: 140px; margin-bottom: 0;">
          <label class="form-label" for="headGroupSelect">الفوج *</label>
          <select id="headGroupSelect" class="form-control mono" required>
            ${[1,2,3,4,5,6,7,8,9,10].map(g => `<option value="${g}">G${g}</option>`).join("")}
          </select>
        </div>

        <button type="submit" class="btn-primary" id="addHeadSubmitBtn" style="width: auto; min-width: 110px; height: 42px;">
          إضافة
        </button>
      </form>
    </div>

    <!-- Card 2: Section Heads Table -->
    <div class="content-card">
      <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 8px;">رؤساء الأقسام</h3>
      <p style="font-size: 12px; color: var(--muted); margin-bottom: 14px;">تغيير الدور يتطبق عند تسجيل الدخول القادم للمستخدم.</p>
      
      <div id="headsListTableWrapper">
        <div style="padding: 20px; text-align: center; color: var(--muted);">جاري تحميل القائمة...</div>
      </div>
    </div>
  `;

  const addForm = document.getElementById("addHeadForm");
  const alertErr = document.getElementById("addHeadAlertError");
  const alertSucc = document.getElementById("addHeadAlertSuccess");
  const addBtn = document.getElementById("addHeadSubmitBtn");
  const emailInput = document.getElementById("headEmailInput");
  const groupSelect = document.getElementById("headGroupSelect");

  addForm.onsubmit = async (e) => {
    e.preventDefault();
    alertErr.style.display = "none";
    alertSucc.style.display = "none";

    const targetEmail = emailInput.value.trim().toLowerCase();
    const targetGroup = parseInt(groupSelect.value, 10);

    if (!targetEmail) return;

    addBtn.disabled = true;
    addBtn.textContent = "جاري الفحص...";

    try {
      // 1. Call rpc("owner_list_users")
      const { data: users, error: listErr } = await supabase.rpc("owner_list_users");
      if (listErr) throw new Error(listErr.message);

      // 2. Find user by case-insensitive email
      const matchedUser = (users || []).find(u => (u.email || "").toLowerCase() === targetEmail);

      if (!matchedUser) {
        alertErr.textContent = "هذا الإيميل ما سجلش حساب بعد، خلي رئيس القسم يسجل أول.";
        alertErr.style.display = "block";
        addBtn.disabled = false;
        addBtn.textContent = "إضافة";
        return;
      }

      if (matchedUser.role === "owner") {
        alertErr.textContent = "لا يمكن تعيين المالك كرئيس قسم.";
        alertErr.style.display = "block";
        addBtn.disabled = false;
        addBtn.textContent = "إضافة";
        return;
      }

      addBtn.textContent = "جاري التعيين...";

      // 3. Call owner_set_uploader
      const { error: setErr } = await supabase.rpc("owner_set_uploader", {
        p_user: matchedUser.id,
        p_group: targetGroup
      });

      if (setErr) throw new Error(setErr.message);

      alertSucc.textContent = `تم تعيين ${matchedUser.email} رئيساً للفوج G${targetGroup} بنجاح.`;
      alertSucc.style.display = "block";
      emailInput.value = "";
      loadRealHeadsTable();
    } catch (err) {
      alertErr.textContent = `خطأ: ${err.message}`;
      alertErr.style.display = "block";
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = "إضافة";
    }
  };

  async function loadRealHeadsTable() {
    const wrapper = document.getElementById("headsListTableWrapper");
    if (!wrapper) return;

    try {
      const { data: users, error } = await supabase.rpc("owner_list_users");
      if (error) {
        wrapper.innerHTML = `<div class="auth-error-box" style="display:block;">خطأ: ${escapeHtml(error.message)}</div>`;
        return;
      }

      // Filter users whose user_role = "uploader"
      const uploaderHeads = (users || []).filter(u => u.role === "uploader");

      if (uploaderHeads.length === 0) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted); font-size: 14px;">ما عينتش حتى رئيس قسم بعد</div>`;
        return;
      }

      wrapper.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>البريد الإلكتروني</th>
                <th>الفوج</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              ${uploaderHeads.map(h => `
                <tr>
                  <td class="mono">${escapeHtml(h.email)}</td>
                  <td class="mono">G${h.group_no || "—"}</td>
                  <td>
                    <button type="button" class="btn-danger remove-head-row-btn" data-uid="${h.id}" data-email="${escapeHtml(h.email)}">
                      إلغاء
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;

      wrapper.querySelectorAll(".remove-head-row-btn").forEach(rBtn => {
        rBtn.onclick = async () => {
          const uid = rBtn.getAttribute("data-uid");
          const uemail = rBtn.getAttribute("data-email");
          if (!confirm(`هل أنت متأكد من إلغاء تعيين رئيس القسم (${uemail})؟`)) return;

          rBtn.disabled = true;
          rBtn.textContent = "جاري الإلغاء...";

          const { error: remErr } = await supabase.rpc("owner_remove_uploader", { p_user: uid });
          if (remErr) {
            alert(`فشل الإلغاء: ${remErr.message}`);
            rBtn.disabled = false;
            rBtn.textContent = "إلغاء";
          } else {
            loadRealHeadsTable();
          }
        };
      });

    } catch (err) {
      wrapper.innerHTML = `<div class="auth-error-box" style="display:block;">خطأ: ${escapeHtml(err.message)}</div>`;
    }
  }

  loadRealHeadsTable();

  // ---- Admins management (owner only; the database enforces this too) ----
  if (state.role === "owner") {
    const adminForm = document.getElementById("addAdminForm");
    const adminErr = document.getElementById("addAdminAlertError");
    const adminSucc = document.getElementById("addAdminAlertSuccess");
    const adminBtn = document.getElementById("addAdminSubmitBtn");
    const adminEmail = document.getElementById("adminEmailInput");

    async function loadAdminsTable() {
      const wrapper = document.getElementById("adminsListTableWrapper");
      if (!wrapper) return;
      const { data: users, error } = await supabase.rpc("owner_list_users");
      if (error) {
        wrapper.innerHTML = `<div class="auth-error-box" style="display:block;">خطأ: ${escapeHtml(error.message)}</div>`;
        return;
      }
      const admins = (users || []).filter(u => u.role === "admin");
      if (admins.length === 0) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 18px; color: var(--muted); font-size: 14px;">لا يوجد مشرفون بعد</div>`;
        return;
      }
      wrapper.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>البريد الإلكتروني</th><th>إجراء</th></tr></thead>
            <tbody>
              ${admins.map(a => `
                <tr>
                  <td class="mono">${escapeHtml(a.email)}</td>
                  <td><button type="button" class="btn-danger remove-admin-btn" data-uid="${a.id}" data-email="${escapeHtml(a.email)}">إلغاء</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      wrapper.querySelectorAll(".remove-admin-btn").forEach(btn => {
        btn.onclick = async () => {
          if (!confirm(`هل أنت متأكد من إلغاء المشرف (${btn.getAttribute("data-email")})؟`)) return;
          btn.disabled = true;
          const { error: remErr } = await supabase.rpc("owner_remove_admin", { p_user: btn.getAttribute("data-uid") });
          if (remErr) {
            alert(`فشل الإلغاء: ${remErr.message}`);
            btn.disabled = false;
            return;
          }
          loadAdminsTable();
        };
      });
    }

    adminForm.onsubmit = async (e) => {
      e.preventDefault();
      adminErr.style.display = "none";
      adminSucc.style.display = "none";
      const targetEmail = adminEmail.value.trim().toLowerCase();
      if (!targetEmail) return;

      adminBtn.disabled = true;
      adminBtn.textContent = "جاري الفحص...";
      try {
        const { data: users, error: listErr } = await supabase.rpc("owner_list_users");
        if (listErr) throw new Error(listErr.message);
        const matched = (users || []).find(u => (u.email || "").toLowerCase() === targetEmail);
        if (!matched) {
          adminErr.textContent = "هذا الإيميل ما سجلش حساب بعد، خليه يسجل أول.";
          adminErr.style.display = "block";
          return;
        }
        if (matched.role === "owner") {
          adminErr.textContent = "هذا الحساب هو المالك بالفعل.";
          adminErr.style.display = "block";
          return;
        }
        const { error: setErr } = await supabase.rpc("owner_set_admin", { p_user: matched.id });
        if (setErr) throw new Error(setErr.message);

        adminSucc.textContent = `تم تعيين ${matched.email} مشرفا بنجاح. التغيير يتطبق عند تسجيل دخوله القادم.`;
        adminSucc.style.display = "block";
        adminEmail.value = "";
        loadAdminsTable();
        loadRealHeadsTable();
      } catch (err) {
        adminErr.textContent = `خطأ: ${err.message}`;
        adminErr.style.display = "block";
      } finally {
        adminBtn.disabled = false;
        adminBtn.textContent = "إضافة مشرف";
      }
    };

    loadAdminsTable();
  }
}

// 20. PAGE: UPLOAD FILE (#/upload) FOR OWNER & HEAD
async function renderUploadView(page) {
  const isOwner = state.role === "owner";
  const isAdmin = state.role === "admin";
  const isStaff = isOwner || isAdmin;
  const upGroup = state.uploaderGroup;

  page.innerHTML = `
    <div class="page-banner">
      <h2>رفع الملفات</h2>
      <p>رفع ومشاركة ملفات المواد الأكاديمية (PDF فقط).</p>
    </div>

    <!-- Upload Form -->
    <div class="content-card">
      <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark); margin-bottom: 16px;">رفع ملف جديد</h3>
      <div id="uploadAlertBox" class="auth-error-box"></div>
      <div id="uploadSuccessBox" class="auth-success-box"></div>

      <form id="fileUploadForm">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div class="form-group">
            <label class="form-label" for="uploadTitle">عنوان الملف *</label>
            <input type="text" id="uploadTitle" class="form-control" placeholder="مثال: Série 01 - Les Pointeurs" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="uploadSubject">المقياس *</label>
            <select id="uploadSubject" class="form-control" required>
              ${SUBJECT_DEFINITIONS.map(s => `<option value="${s.id}">${escapeHtml(s.nameAr)} (${s.id})</option>`).join("")}
              <option value="Autre">Autre (أخرى)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="uploadKind">نوع الحصة *</label>
            <select id="uploadKind" class="form-control mono" required>
              ${isStaff ? '<option value="cours">cours (محاضرة)</option>' : ''}
              <option value="td">td (أعمال موجهة)</option>
              <option value="tp">tp (أعمال تطبيقية)</option>
              <option value="exam">exam (امتحان)</option>
              <option value="autre">autre (أخرى)</option>
            </select>
          </div>

          <div class="form-group" id="uploadGroupWrap">
            <label class="form-label" for="uploadGroup">الفوج المستهدف *</label>
            <select id="uploadGroup" class="form-control mono" ${!isStaff ? 'disabled' : ''}>
              ${
                isStaff
                  ? `
                    <option value="all">كل الأفواج (عام)</option>
                    ${[1,2,3,4,5,6,7,8,9,10].map(g => `<option value="${g}">G${g}</option>`).join("")}
                  `
                  : `<option value="${upGroup}" selected>G${upGroup} (فوجك فقط)</option>`
              }
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label class="form-label" for="uploadFileInput">اختر ملف PDF (الحد الأقصى 25 ميغابايت) *</label>
          <input type="file" id="uploadFileInput" class="form-control" accept=".pdf,application/pdf" required>
        </div>

        <button type="submit" class="btn-primary" id="uploadSubmitBtn" style="margin-top: 14px; width: auto; min-width: 160px;">
          رفع الملف
        </button>
      </form>
    </div>

    <!-- Files Management Table -->
    <div class="content-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <h3 style="font-size: 16px; font-weight: 600; color: var(--brown-dark);">
          ${isStaff ? "إدارة جميع ملفات المنصة" : `ملفاتي (الفوج G${upGroup})`}
        </h3>

        ${
          isStaff
            ? `
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <select id="filterUploadGroup" class="form-control mono" style="width: auto; padding: 4px 10px; font-size: 12px;">
                  <option value="all">كل الأفواج</option>
                  ${[1,2,3,4,5,6,7,8,9,10].map(g => `<option value="${g}">G${g}</option>`).join("")}
                </select>
                <select id="filterUploadKind" class="form-control mono" style="width: auto; padding: 4px 10px; font-size: 12px;">
                  <option value="all">كل الأنواع</option>
                  <option value="cours">cours</option>
                  <option value="td">td</option>
                  <option value="tp">tp</option>
                  <option value="exam">exam</option>
                  <option value="autre">autre</option>
                </select>
              </div>
            `
            : ""
        }
      </div>

      <div id="uploadFilesTableWrapper">
        <!-- Render files -->
      </div>
    </div>
  `;

  const kindSelect = document.getElementById("uploadKind");
  const groupSelectWrap = document.getElementById("uploadGroupWrap");
  const groupSelect = document.getElementById("uploadGroup");

  if (isStaff && kindSelect && groupSelectWrap) {
    const handleKindChange = () => {
      if (kindSelect.value === "cours") {
        groupSelectWrap.style.display = "none";
      } else {
        groupSelectWrap.style.display = "flex";
      }
    };
    kindSelect.onchange = handleKindChange;
    handleKindChange();
  }

  const uploadForm = document.getElementById("fileUploadForm");
  const uploadBtn = document.getElementById("uploadSubmitBtn");
  const uploadAlert = document.getElementById("uploadAlertBox");
  const uploadSuccess = document.getElementById("uploadSuccessBox");

  uploadForm.onsubmit = async (e) => {
    e.preventDefault();
    uploadAlert.style.display = "none";
    uploadSuccess.style.display = "none";

    const title = document.getElementById("uploadTitle").value.trim();
    const subject = document.getElementById("uploadSubject").value;
    const kind = document.getElementById("uploadKind").value;
    const fileInput = document.getElementById("uploadFileInput");
    const file = fileInput.files[0];

    if (!file) {
      uploadAlert.textContent = "يرجى اختيار ملف PDF.";
      uploadAlert.style.display = "block";
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      uploadAlert.textContent = "يسمح فقط بملفات بصيغة PDF.";
      uploadAlert.style.display = "block";
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      uploadAlert.textContent = "حجم الملف يتجاوز 25 ميغابايت.";
      uploadAlert.style.display = "block";
      return;
    }

    let targetGroup = null;
    if (isStaff) {
      if (kind === "cours") {
        targetGroup = null;
      } else {
        const val = groupSelect.value;
        targetGroup = val === "all" ? null : parseInt(val, 10);
      }
    } else {
      targetGroup = upGroup;
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = "جاري رفع الملف...";

    const timestamp = Date.now();
    const randStr = Math.random().toString(36).substring(2, 8);
    const folder = targetGroup ? `g${targetGroup}` : "common";
    const storagePath = `${folder}/${timestamp}_${randStr}.pdf`;

    let uploadedKey = null;

    try {
      const { error: storageError } = await supabase.storage
        .from("course-files")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (storageError) throw new Error(storageError.message);
      uploadedKey = storagePath;

      uploadBtn.textContent = "جاري حفظ بيانات الملف...";

      const { error: insertError } = await supabase.from("files").insert({
        title,
        semester: "S1",
        subject,
        kind,
        group_no: targetGroup,
        path: storagePath
      });

      if (insertError) {
        await supabase.storage.from("course-files").remove([uploadedKey]);
        throw new Error(insertError.message);
      }

      uploadSuccess.textContent = "تم رفع الملف وحفظه بنجاح.";
      uploadSuccess.style.display = "block";
      uploadForm.reset();
      if (isStaff && typeof handleKindChange === "function") handleKindChange();

      await loadFilesCache();
      renderUploadFilesTable();
    } catch (err) {
      uploadAlert.textContent = `خطأ: ${err.message || "فشلت عملية الرفع"}`;
      uploadAlert.style.display = "block";
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "رفع الملف";
    }
  };

  function renderUploadFilesTable() {
    const wrapper = document.getElementById("uploadFilesTableWrapper");
    if (!wrapper) return;

    let files = isStaff ? [...state.filesCache] : state.filesCache.filter(f => f.group_no === upGroup);

    if (isStaff) {
      const gFilter = document.getElementById("filterUploadGroup")?.value;
      const kFilter = document.getElementById("filterUploadKind")?.value;
      if (gFilter && gFilter !== "all") {
        files = files.filter(f => String(f.group_no) === gFilter);
      }
      if (kFilter && kFilter !== "all") {
        files = files.filter(f => f.kind === kFilter);
      }
    }

    if (files.length === 0) {
      wrapper.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted);">ما كاين حتى ملف بعد</div>`;
      return;
    }

    wrapper.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>العنوان</th>
              <th>المادة</th>
              <th>النوع</th>
              <th>الفوج</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${files.map(f => `
              <tr>
                <td><strong>${escapeHtml(f.title)}</strong></td>
                <td>${escapeHtml(getSubjectObj(normalizeSubjectId(f.subject)).nameAr)}</td>
                <td><span class="badge-tag">${escapeHtml(f.kind)}</span></td>
                <td class="mono">${f.group_no ? `G${f.group_no}` : "كل الأفواج"}</td>
                <td class="mono" style="font-size: 12px;">${formatDate(f.created_at)}</td>
                <td>
                  <div style="display: flex; gap: 6px;">
                    <a href="#/voir/${f.id}" class="btn-secondary" style="padding: 4px 8px; font-size: 12px; text-decoration: none;">عرض</a>
                    <button type="button" class="btn-danger delete-file-btn" data-id="${f.id}" data-path="${escapeHtml(f.path)}" data-title="${escapeHtml(f.title)}">حذف</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    wrapper.querySelectorAll(".delete-file-btn").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-id");
        const path = btn.getAttribute("data-path");
        const title = btn.getAttribute("data-title");

        const ok = confirm(`هل أنت متأكد من حذف الملف "${title}" بشكل نهائي؟`);
        if (!ok) return;

        btn.disabled = true;
        btn.textContent = "جاري الحذف...";

        try {
          const { error: dbErr } = await supabase.from("files").delete().eq("id", id);
          if (dbErr) throw new Error(dbErr.message);

          if (path) {
            await supabase.storage.from("course-files").remove([path]);
          }

          await loadFilesCache();
          renderUploadFilesTable();
        } catch (err) {
          alert(`خطأ في الحذف: ${err.message}`);
          btn.disabled = false;
          btn.textContent = "حذف";
        }
      };
    });
  }

  if (isOwner) {
    document.getElementById("filterUploadGroup")?.addEventListener("change", renderUploadFilesTable);
    document.getElementById("filterUploadKind")?.addEventListener("change", renderUploadFilesTable);
  }

  renderUploadFilesTable();
}

// 21. PAGE: ACCOUNT (#/compte)
function renderAccountView(page) {
  const sg = state.studentGroup;
  page.innerHTML = `
    <div class="page-banner">
      <h2>حسابي</h2>
      <p>تفاصيل الحساب الدراسي والصلاحيات المسجلة.</p>
    </div>

    <div class="content-card" style="max-width: 600px;">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div class="user-avatar-circle" style="width: 56px; height: 56px; font-size: 22px;">
          ${escapeHtml(state.user.email?.[0]?.toUpperCase() || "U")}
        </div>
        <div>
          <h3 style="font-size: 18px; font-weight: 600; color: var(--brown-dark);" class="mono">${escapeHtml(state.user.email)}</h3>
          <span class="role-badge ${state.role}" style="display: inline-block; margin-top: 4px;">
            ${getRoleBadgeText(state.role, state.uploaderGroup)}
          </span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">فوجك الدراسي المسجل:</label>
        <div style="font-weight: 600; font-size: 16px; color: var(--brown-dark);" class="mono">
          ${sg ? `الفوج G${sg}` : "غير محدد (يرجى مراجعة إدارة المنصة)"}
        </div>
        <small style="color: var(--muted); font-size: 12px;">الفوج موثق ومعتمد من قاعدة البيانات ولا يمكن تعديله عبر بيانات الحساب المحلية.</small>
      </div>

      <hr style="border: 0; border-top: 1px solid var(--line); margin: 24px 0;">

      <button type="button" class="btn-danger" id="accountLogoutBtn" style="padding: 10px 20px; font-size: 14px;">
        تسجيل الخروج من الحساب
      </button>
    </div>
  `;

  document.getElementById("accountLogoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    state.session = null;
    state.user = null;
    state.role = "student";
    state.uploaderGroup = null;
    state.filesCache = [];
    state.teacherInfoCache = [];
    state.scheduleCache = [];
    state.renderedUserId = null;
    location.hash = "#/";
    renderLoggedOut("تم تسجيل الخروج بنجاح.");
  };
}

// 22. PAGE: 404 NOT FOUND
function renderNotFoundView(page) {
  page.innerHTML = `
    <div class="content-card" style="text-align: center; padding: 60px 20px;">
      <div class="mono" style="font-size: 64px; font-weight: 500; color: var(--brown); margin-bottom: 12px;">404</div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">الصفحة غير موجودة</h2>
      <p style="color: var(--muted); margin-bottom: 24px;">الرابط الذي طلبته غير موجود أو تم نقله.</p>
      <a href="#/" class="btn-primary" style="display: inline-block; width: auto; text-decoration: none;">العودة للرئيسية</a>
    </div>
  `;
}

// 23. HASH CHANGE LISTENER
window.addEventListener("hashchange", () => {
  if (recoveryMode) return;
  const hash = location.hash;
  if (!hash.startsWith("#/")) {
    return;
  }
  if (!state.user) {
    if (hash !== "#/") {
      state.redirectAfterLogin = hash;
      location.hash = "#/";
      renderLoggedOut("سجّل الدخول باش تكمل.");
    }
    return;
  }
  renderApp();
});
