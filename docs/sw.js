/* Yo'qlama jurnali — oflayn ishlash uchun kesh. Ilova yangilanganda VERSION ni oshiring. */
const VERSION = "jurnal-v22";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-maskable.png"];
const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then(async (c) => {
    await c.addAll(CORE);
    try { const r = await fetch(XLSX_URL, {mode: "cors"}); if (r.ok) await c.put(XLSX_URL, r); } catch (err) { /* internet bo'lmasa — birinchi Excel importida yuklanadi */ }
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // ilovaning o'zi: avval tarmoq (yangi versiya), bo'lmasa kesh
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req, {ignoreSearch: true}).then((r) => r || caches.match("./index.html"))));
  } else if (req.url === XLSX_URL) {
    e.respondWith(caches.match(XLSX_URL).then((r) => r || fetch(XLSX_URL, {mode: "cors"}).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(XLSX_URL, cp)); } return res; })));
  }
});
