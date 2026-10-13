# info cc 404 — منصة طلبة الإعلام الآلي (Ingénieur d'État en Informatique)

موقع ويب تفاعلي ثابت (Static Web App) مبني بـ Vanilla HTML / CSS / JavaScript ومربوط بقاعدة بيانات Supabase، مهيأ للنشر المباشر على GitHub Pages تحت المسار `/info-cc-404/`.

---

## هيكلة المشروع (Project Structure)

```text
- index.html                     # الصفحة الرئيسية ونقطة البداية (Vite / Browser Entry)
- style.css                      # نظام التصميم والهوية البصرية الدافئة (RTL Warm Academic)
- config.js                      # مفاتيح الربط مع Supabase (URL + Anon Key)
- app.js                         # منطق التطبيق الكامل والتوجيه (SPA Router + PDF.js Viewer)
- data.js                        # بيانات المواد وتوزيع الأساتذة والحصص المستخرجة من PDF الرسمي
- supabase.sql                   # سكريبت إعداد قاعدة البيانات وجداول RLS ودوال RPC
- sw.js                          # Service Worker للعمل في وضع غير متصل (Network-First Cache)
- manifest.webmanifest           # إعدادات تطبيق الويب التقدمي (PWA)
- icon.svg                       # أيقونة المتجه للمنصة
- icon-192.png                   # أيقونة PWA قياس 192px
- icon-512.png                   # أيقونة PWA قياس 512px
- robots.txt                     # إرشادات محركات البحث
- sitemap.xml                    # خريطة الموقع لمحركات البحث
- google404infoccverification.html # ملف التحقق من ملكية الموقع لدى Google
- README.md                      # توثيق المشروع وطريقة التشغيل والنشر
```

---

## الإعداد والتشغيل المحلي (Local Development)

1. تشغيل خادم محلي:
   ```bash
   npx serve .
   # أو بواسطة Vite:
   npm run dev
   ```
2. تأكد من تحميل `config.js` قبل `app.js` في ملف `index.html`.

---

## نظام الصلاحيات والرتب (Roles System)

- **المالك (Owner):** يتمتع بصلاحية إدارة رؤساء الأقسام، رفع وحذف الملفات لجميع الأفواج والمقاييس، وتعديل بيانات الأساتذة.
- **رئيس القسم (Uploader / Chef de section):** مفوض لفوج محدد فقط، يملك صلاحية رفع وحذف ملفات الـ (TD / TP / الامتحانات) الخاصة بفوجه الدراسي فقط عبر صفحة رفع الملفات، ولا يمكنه رفع دروس المحاضرات (Cours).
- **الطالب (Student):** الاطلاع الكامل على ملفات فوجه والمحاضرات العامة عبر عارض PDF المدمج والمحمي.
