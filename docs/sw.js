/* Yo'qlama jurnali — oflayn ishlash uchun kesh. Ilova yangilanganda VERSION ni oshiring. */
const VERSION = "jurnal-v111";
const CORE = ["./", "./index.html", "./app.css", "./vendor/bootstrap-5.3.3.css", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-maskable.png", "./natija.html"];
// Excel kutubxonasi katta (~1 MB) va kam o'zgaradi: alohida keshda turadi, ilova versiyasi oshganda qayta yuklanmaydi
const XLSX_PATH = "./vendor/xlsx-0.20.3.full.min.js";
const LIB = "lib-xlsx-0.20.3";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => caches.open(LIB)).then(async (l) => {
    try { if (!(await l.match(XLSX_PATH))) await l.add(XLSX_PATH); } catch (err) { /* bo'lmasa — birinchi Excel ishida yuklanadi */ }
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== LIB).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.endsWith(XLSX_PATH.slice(1))) {
    e.respondWith(caches.open(LIB).then((l) => l.match(req, {ignoreSearch: true}).then((r) => r || fetch(req).then((res) => { if (res.ok) l.put(req, res.clone()); return res; }))));
  } else if (url.origin === location.origin) {
    // ilovaning o'zi: avval tarmoq (yangi versiya), bo'lmasa kesh
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, {ignoreSearch: true}).then((r) => r || caches.match("./index.html"))));
  }
});
// dars eslatmasi bosilganda ilovani ochish
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then((cs) => cs.length ? cs[0].focus() : self.clients.openWindow("./")));
});
