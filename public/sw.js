// ============================================================================
// Service Worker — info cc 404 (PWA Offline Support)
// ============================================================================
// هاذ الفايل يسمح للتطبيق يخدم حتى ونت بلا أنترنت (Offline) في الجامعة
// Ce fichier permet à l'application de fonctionner hors-ligne
// ============================================================================

const CACHE_NAME = "info-cc-404-v1";

// الملفات الأساسية لي نخزنوها مسبقا (App Shell)
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
  "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap"
];

// 1. تثبيت الـ Service Worker وحفظ الملفات في الكاش
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // نزيدو الملفات لي نقدرو، ونتجاوزو لي يفشلو بلا ما يحبس التثبيت
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

// 2. تفعيل وحذف النسخ القديمة من الكاش
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. اعتراض الطلبات (Fetch Handler)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // إذا كان طلب Supabase API أو Storage، نخليه Network First
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // بالنسبة للملفات الثابتة (HTML, CSS, JS, Fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // إذا ما كاش نت وطلبنا صفحة HTML، نرجعو الكاش تاع index.html
          if (req.mode === "navigate") {
            return caches.match("/index.html");
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
