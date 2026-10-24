// Service Worker for "مكتبتي" - Workshop 2
// Strategie: Cache-first للأصول، Network-first للبيانات الديناميكية
// يحافظ على localStorage ويعمل خارج الاتصال

const CACHE_NAME = "maktabati-v2";
const CORE_ASSETS = [
  "/maktabati-workshop1/",
  "/maktabati-workshop1/index.html",
  "/maktabati-workshop1/styles.css",
  "/maktabati-workshop1/app.js",
  "/maktabati-workshop1/manifest.webmanifest",
  "/maktabati-workshop1/about.html",
  "/maktabati-workshop1/icons/icon-192.png",
  "/maktabati-workshop1/icons/icon-512.png",
  "/maktabati-workshop1/icons/maskable-512.png",
  "/maktabati-workshop1/about.html",
];

// تثبيت Service Worker وتخزين الأصول الأساسية
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Service Worker: تم caching الأصول الأساسية");
      return cache.addAll(CORE_ASSETS);
    })
  );
  // تجاهل حدث الانتظار للتفعيل الفوري
  self.skipWaiting();
});

// تفعيل Service Worker وتنظيف الكاش القديم
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 Service Worker: حذف كاش قديم:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // Claim التحكم الفوري في النوافذ المفتوحة
  self.clients.claim();
);

// استراتيجية الاسترداد: Cache-first للأصول، Network-first للبيانات
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // تجاهل طلبات خارج النطاق (Supabase، تحليلات، إلخ)
  if (url.origin !== self.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  // استراتيجية:Cache للأصول الثابتة، Network للأدوات والصفحات
  if (event.request.method === "GET") {
    // للأصول الثابتة (CSS, JS,Icons, HTML)
    if (
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".json") ||
      url.pathname === "/" ||
      url.pathname === "/index.html" ||
      url.pathname === "/about.html"
    ) {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            // تحديث الكاش للطلب القادم
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          });
        })
      );
    }
    // للأدوات الديناميكية (API calls، بيانات الكتب عبر fetch غير المستخدمة)
    else {
      event.respondWith(
        fetch(event.request).then((networkResponse) => {
          // لا نقوم cached للطلبات التي تحتوي on بيانات user
          const url = new URL(event.request.url);
          if (url.pathname.includes("api") || url.pathname.includes("supabase")) {
            return networkResponse;
          }
          // يمكن إضافة caching للبيانات هنا إذا لزم الأمر
          return networkResponse;
        }).catch(() => {
          // في حالة فشل الشبكة، حاول إرجاع من الكاش
          return caches.match(event.request).then((cached) => cached || new Response("Offline mode"));
        })
      );
    }
  }
});