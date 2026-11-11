/* Yo'qlama jurnali — oflayn ishlash uchun kesh. Ilova yangilanganda VERSION ni oshiring. */
const VERSION = "jurnal-v225";
const CORE = ["./", "./index.html", "./xato.js", "./saqlash.js", "./sinx.js", "./telegram.js", "./app.css", "./guruhlar.css", "./tpt-mavzu.css", "./tpt-mavzu.js", "./tpt-tema.css", "./dizayn.css", "./dizayn.js", "./tugmalar.css", "./tugmalar.js", "./kalit.css", "./funksiyalar.css", "./funksiyalar.js", "./hisobotlar.css", "./hisobot-chop.css", "./hisobot-chop.js", "./hisobotlar.js", "./bosh-varaq.css", "./bosh-varaq.js", "./davomat.css", "./davomat.js", "./bsb-eksport.css", "./bsb-eksport.js", "./bsb-yangi.css", "./bsb-yangi.js", "./bugun.css", "./bajarish.css", "./bugun.js", "./bugun-arxiv.css", "./bugun-arxiv.js", "./bugun-tatil.css", "./bugun-tatil.js", "./sozlamalar.css", "./sozlamalar.js", "./mezon.css", "./mezon.js", "./kriterial.css", "./kriterial.js", "./kunlik.css", "./kunlik.js", "./pdf-tg.js", "./tg-umumiy.js", "./arxiv.css", "./arxiv-tekshir.css", "./arxiv.js", "./guruhlar.js", "./vendor/manrope-latin.woff2", "./vendor/manrope-latin-ext.woff2", "./vendor/bootstrap-5.3.3.css", "./vendor/bootstrap-icons-1.11.3.css", "./vendor/bootstrap-icons-1.11.3.woff2", "./ikon.js", "./ikon.css", "./emk-bir.css", "./emk-bir.js", "./emk-server.js", "./ota-emk.js", "./ota-emk.css", "./boshlash.js", "./boshlash.css", "./alifbo.css", "./alifbo.js", "./taxminiy.css", "./taxminiy.js", "./summativ.css", "./summativ.js", "./loyiha.css", "./loyiha.js", "./yangilik.css", "./yangilik.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-maskable.png", "./natija.html"];
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
// javob yaxshi bo'lsa keshga ham yoziladi
const keep = (req) => (res) => { if (res.ok) { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return res; };
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.endsWith(XLSX_PATH.slice(1))) {
    e.respondWith(caches.open(LIB).then((l) => l.match(req, {ignoreSearch: true}).then((r) => r || fetch(req).then((res) => { if (res.ok) l.put(req, res.clone()); return res; }))));
  } else if (url.origin === location.origin && url.searchParams.has("v")) {
    // versiyali fayl (app.js?v=213) o'zgarmaydi: avval kesh — sekin internetda ham ilova darhol ochiladi.
    // Fayl o'zgarsa, index.html dagi ?v= raqami oshiriladi (tests/web.test.mjs tekshiradi) va yangi manzil tarmoqdan olinadi.
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then(keep(req))
      .catch(() => caches.match(req, {ignoreSearch: true}).then((x) => x || Response.error()))));
  } else if (url.origin === location.origin) {
    // index.html va versiyasiz fayllar: avval tarmoq (yangi versiya), lekin uzog'i bilan 4 soniya kutiladi, keyin kesh
    const net = fetch(req, {cache: "no-cache"}).then(keep(req));
    const fallback = () => caches.match(req, {ignoreSearch: true}).then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : null)).then((r) => r || net);
    e.respondWith(Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error("sekin")), 4000))]).catch(fallback));
  }
});
// dars eslatmasi bosilganda ilovani ochish
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then((cs) => cs.length ? cs[0].focus() : self.clients.openWindow("./")));
});
