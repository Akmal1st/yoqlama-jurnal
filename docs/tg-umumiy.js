/* Umumiy Telegram bot (Akmal, 2026-11-06, maket v3 tasdiqlangan): o'qituvchi «✈️ Telegram'ni ulash» tugmasini bosadi —
   Telegram ochiladi, bot birinchi marta bo'lsa Telegram o'zi «Boshlash»ni ko'rsatadi, ilova o'zi ulanadi. Token, kod, BotFather kerak emas.
   Bot tokeni faqat Cloudflare'dagi serverda (bot-server/worker.js). Ilova serverga shaxsiy kalit (tgCfg().key) bilan murojaat qiladi:
   tgApi (index.html) kalit bo'lsa so'rovni  TGU.api(method)  ga yuboradi, aks holda avvalgidek o'z botining tokeni bilan api.telegram.org ga.
   tgCfg qo'shimchalari: key, chat (Telegram ID), bot, mode: "shared", pend: {t, at, wait} — ulanish kutilmoqda.
   Asosiy skriptdan oldin ulanadi (tgCfg/tgSet/tgAuto chaqirilganda tayyor bo'ladi). */
const TGU = (() => {
  // Cloudflare Worker manzili — server o'rnatilgach shu yerga yoziladi (bot-server/README.md). Bo'sh bo'lsa, tugma ko'rinmaydi.
  const URL0 = "";
  const PEND_MS = 15 * 60e3, STEP = 2000;
  const url = () => { try { return localStorage.getItem("yoqlama_tgu_url") || URL0; } catch (e) { return URL0; } };
  const on = () => !!url();
  const api = (method) => `${url()}/api/${method}`;
  const rnd = () => { const b = crypto.getRandomValues(new Uint8Array(18)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  function dev() {
    const u = navigator.userAgent || "", b = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /YaBrowser/.test(u) ? "Yandex" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "Brauzer";
    const o = /Android/.test(u) ? "Android" : /iPhone|iPad/.test(u) ? "iOS" : /Windows/.test(u) ? "Windows" : /Mac OS/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "";
    return o ? `${b} · ${o}` : b;
  }
  const pend = () => { const p = tgCfg().pend; return p && Date.now() - p.at < PEND_MS ? p : null; };

  // tugma bosilganda: hech qanday await'dan oldin oyna ochiladi (aks holda brauzer «popup»ni to'sadi)
  function connect() {
    if (!on()) return;
    const t = rnd(), link = `${url()}/go/${t}?d=${encodeURIComponent(dev())}`;
    const w = window.open(link, "_blank");
    if (!w) location.href = link;   // to'silsa — shu oynada (telefonda Telegram ilovasi ochiladi)
    tgSet({pend: {t, at: Date.now(), wait: false}});
    render(); poll();
  }
  function cancel() { tgSet({pend: null}); render(); }

  let timer = 0, busy = false;
  async function check() {
    const p = pend(); if (!p) { if (tgCfg().pend) { tgSet({pend: null}); render(); } return false; }
    if (busy || navigator.onLine === false) return true;
    busy = true;
    try {
      const r = await (await fetch(`${url()}/link/${p.t}`, {cache: "no-store"})).json();
      if (r.st === "ok") {
        tgSet({key: r.key, chat: r.chat, bot: r.bot, mode: "shared", token: undefined, pend: null, hash: "", seen: 0});
        TG_NEW = null; render(); toast("✈️ Telegram ulandi — birinchi zaxira yuborilmoqda");
        try { await tgAuto(); } catch (e) { /* tgAuto o'zi ogohlantiradi */ }
        render(); return false;
      }
      if (r.st === "wait" && !p.wait) { tgSet({pend: Object.assign(p, {wait: true})}); render(); }
      if (r.st === "no") { tgSet({pend: null}); render(); toast("Admin so'rovni rad etdi"); return false; }
    } catch (e) { /* tarmoq — keyingi urinishda */ }
    finally { busy = false; }
    return true;
  }
  function poll() {
    clearTimeout(timer);
    const loop = async () => { if (await check()) timer = setTimeout(loop, STEP); };
    timer = setTimeout(loop, 1200);
  }
  // Telegram'dan qaytganda darhol tekshiramiz; ilova qayta ochilsa ham kutish davom etadi
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && pend()) poll(); });
  window.addEventListener("load", () => { if (pend()) poll(); });

  // Sozlamalar → Ma'lumotlar: «Telegram» qatori (ulanmagan holat)
  function offRow(row) {
    const p = pend();
    if (p) return row("tg", "✈️ Telegram", p.wait ? `<span class="sz-warn-t">Admin tasdig'i kutilmoqda.</span> Tasdiqlangach ilova o'zi ulanadi, ilovani yopsangiz ham bo'ladi.`
        : "Telegram ochildi. Bot birinchi marta ochilayotgan bo'lsa, Telegram pastda «Boshlash» tugmasini ko'rsatadi — uni bosing. Ilova o'zi ulanadi.",
      `<button class="btn btn-sm" data-a="tguon">↻ Qayta ochish</button><button class="btn btn-sm" data-a="tgucancel">Bekor qilish</button>`, "wide");
    return row("tg", "✈️ Telegram", "Bitta tugma: Telegram ochiladi va ilova o'zi ulanadi. Zaxira, kunlik hisobot rasmlari va PDF hisobotlar shu botga keladi. Telefon yo'qolsa ham jurnal saqlanib qoladi.",
      `<button class="btn btn-sm btn-primary" data-a="tguon">✈️ Telegram'ni ulash</button><button class="btn btn-sm" data-a="tgon" title="BotFather'da o'zingiz yaratgan bot tokeni bilan">O'z botim</button>`, "wide");
  }
  const shared = () => !!tgCfg().key;
  return {on, url, api, connect, cancel, poll, pend, offRow, shared, dev};
})();
