# 🏛️ info cc 404 — دليل التشغيل والتحديث الشامل (Version Warm Redesign)

منصة مجانية موجهة لطلبة **مهندس دولة في الإعلام الآلي (Ingénieur d'État en Informatique)**، مقسمة إلى 10 أفواج (**G1 إلى G10**).
تمت إعادة تصميم الواجهة بالكامل بنمط دافئ ومريح للعين (Claude-style Warm Off-White) باستخدام **Plain HTML/CSS/JS** بدون أي Build Step، وبخدمات **Supabase (Auth, Postgres, Storage)** مجاناً 100%.

---

## 🎨 1. نظام الألوان والخطوط الجديد (Design System)

- **خلفية الصفحة**: رمادي دافئ مائل للبيج (`#F0EEE6`)
- **خلفية البطاقات والحقول**: أوف وايت عاجي ناعم (`#FAF9F5`)
- **النصوص**: أسود دافئ داكن ومريح للعين (`#1F1E1D`)، ورمادي معتدل للنصوص الثانوية (`#6B6A66`)
- **لون التمييز (Accent)**: Terracotta ترابي جذاب (`#D97757`)، مع درجة أغمق للأزرار والنصوص النشطة (`#C0583A`) لضمان تباين عالي يتوافق مع معايير الوصولية **WCAG AA**.
- **الخطوط**:
  - خط الأساس والعناوين: **IBM Plex Sans Arabic** خط عربي/لاتيني حديث وواضح.
  - خط التفاصيل التقنية ورموز الأفواج: **JetBrains Mono** (للأفواج `G1..G10`، شارات نوع الملف، والكود).

---

## 🛠️ 2. خطوات التحديث في Supabase (SQL & Data Migration)

### أ) إذا كان لديك مشروع قائم وتريد تحديثه (Migration Snippet):
ادخل إلى **Supabase Dashboard** ← **SQL Editor** ← **New Query** ونفذ هذا السطرين لإضافة حقل `group_no` ونقل البيانات الحالية:

```sql
-- 1. إضافة حقل رقم الفوج (1 إلى 10)
alter table public.files add column if not exists group_no smallint check (group_no between 1 and 10);
alter table public.profiles add column if not exists group_no smallint check (group_no between 1 and 10);

-- 2. تحويل البيانات المسجلة سابقاً من نص 'G1'..'G10' إلى أرقام:
update public.files
set group_no = substring(group_name from '([0-9]+)')::smallint
where group_name ~ '^G[0-9]+$' and group_no is null;

update public.profiles
set group_no = substring(group_name from '([0-9]+)')::smallint
where group_name ~ '^G[0-9]+$' and group_no is null;
```

### ب) لإعداد قاعدة بيانات جديدة من الصفر:
انسخ كامل محتوى ملف `supabase.sql` والصقه في **SQL Editor** واضغط **Run**. سيقوم بإنشاء:
- جدول `admins`، جدول `profiles` مع التريغر التلقائي، وجدول `files` مع حقل `group_no`.
- دالة `public.is_admin()` ودالة `set_admin_role()`.
- سياسات الحماية الصارمة (RLS) ومساحة التخزين الخاصة `course-files`.

### ج) تعيين نفسك كمسؤول (Admin):
بعد تسجيل حسابك، نفّذ الاستعلام التالي لترقية حسابك:
```sql
insert into public.admins (user_id)
select id from auth.users where email = 'locoviber16@gmail.com'
on conflict do nothing;

update public.profiles set is_admin = true where email = 'locoviber16@gmail.com';
```

---

## 🚀 3. خطوات النشر المجاني (Redeploy Instructions)

### الطريقة 1: Netlify Drop (الأسهل والأسرع)
1. افتح [app.netlify.com/drop](https://app.netlify.com/drop).
2. اسحب مجلد المشروع (الذي يحتوي على `index.html`, `style.css`, `app.js`, `manifest.webmanifest`, `sw.js`, الأيقونات).
3. سيعطيك رابطاً حياً فورياً (مثلاً `https://info-cc-404.netlify.app`).

### الطريقة 2: GitHub Pages
1. ادفع الملفات إلى مستودعك على GitHub في الفرع `main`.
2. ادخل إلى **Settings** ← **Pages** ← اختر Branch `main` والمجلد `/ (root)`.

---

## ✅ 4. قائمة الفحص والاختبار (Test Checklist)

- [ ] **الصفحة الرئيسية (Landing Hero)**: ظهور بطاقة الترحيب، الإحصائيات المحسوبة تلقائياً (عدد الملفات والمقاييس)، وخطوات "كيف يعمل الموقع".
- [ ] **بطاقات الأفواج (G1 إلى G10)**: ظهور 10 بطاقات تمثل الأفواج مع عدد ملفات كل فوج، والنقر على أي فوج يفلتر ملفات ذلك الفوج مباشرة.
- [ ] **تجميع الملفات حسب المادة**: ظهور الملفات منظمة في أقسام تحت عنوان كل مادة دراسية (Subject Header).
- [ ] **شارة "جديد"**: ظهور شارة `[جديد / NOUVEAU]` على الملفات المرفوعة خلال آخر 7 أيام.
- [ ] **التسجيل واختيار الفوج**: اختيار الفوج (G1 إلى G10) أثناء إنشاء الحساب، وحفظه في `profiles.group_no`.
- [ ] **رفع الملفات للأدمن**: رفع ملف جديد مع إمكانية توجيهه لكل الدفعة أو لفوج محدد (G1..G10).
- [ ] **التبديل بين العربية والفرنسية**: عمل زر `FR / عربي` مع تبديل الاتجاه بسلاسة (RTL/LTR).
- [ ] **تثبيت PWA والعمل بدون إنترنت**: ظهور زر التثبيت، ودعم التصفح السريع حتى عند انقطاع الاتصال.
