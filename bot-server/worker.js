/* Umumiy Telegram bot serveri (Cloudflare Worker + D1) — Akmal, 2026-11-06.
   Hamma o'qituvchilar bitta botdan foydalanadi. Bot tokeni faqat shu serverda (Cloudflare «Secrets») turadi.
   Ilova (docs/tg-umumiy.js) bitta tugma bilan ulanadi:
     1) ilova tasodifiy t yaratadi va  GET /go/<t>  ni ochadi → server t ni yozib, t.me/<bot>?start=<t> ga yo'naltiradi;
     2) o'qituvchi Telegram'da «Boshlash» bosadi → bot /start <t> oladi → o'qituvchi ulanadi, unga shaxsiy kalit yaratiladi;
     3) ilova  GET /link/<t>  ni so'rab turadi va kalitni bir marta oladi.
   So'ng ilova Bot API so'rovlarini  POST /api/<method>  ga yuboradi (forma maydoni _k = kalit). Server kalitni tekshiradi,
   chat_id faqat o'qituvchining o'z chati yoki u botni qo'shgan guruh bo'lishiga ruxsat beradi va so'rovni Telegram'ga uzatadi.
   Zaxira, rasm va PDF serverda saqlanmaydi. D1 da faqat: o'qituvchilar (Telegram ID, ism), kalitlarning SHA-256 izi, guruhlar.
   Sozlash: bot-server/README.md.  Muhit: BOT_TOKEN, ADMIN_IDS ("123,456"), SETUP_SECRET (secret), DB (D1 bog'lanishi). */

const API = "https://api.telegram.org";
const APP_URL = "https://akmal1st.github.io/yoqlama-jurnal/";
const LINK_TTL = 10 * 60;   // soniya: /go dan keyin «Boshlash» uchun vaqt
const T_RE = /^[A-Za-z0-9_-]{16,64}$/;
// ilova chaqira oladigan Bot API usullari; «own» — faqat o'z chatiga (guruhga emas)
const METHODS = {sendMessage: 0, sendPhoto: 0, sendDocument: 0, pinChatMessage: 0, unpinChatMessage: 0, deleteMessage: 0,
  deleteMessages: "own", editMessageReplyMarkup: "own", getChat: "own", getMe: "none", myGroups: "none", backupFile: "none"};
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, uname TEXT, st TEXT NOT NULL, at INTEGER)",
  "CREATE TABLE IF NOT EXISTS keys (h TEXT PRIMARY KEY, uid INTEGER NOT NULL, dev TEXT, at INTEGER)",
  "CREATE TABLE IF NOT EXISTS links (t TEXT PRIMARY KEY, uid INTEGER, k TEXT, st TEXT NOT NULL, dev TEXT, at INTEGER)",
  "CREATE TABLE IF NOT EXISTS groups (id INTEGER NOT NULL, uid INTEGER NOT NULL, title TEXT, PRIMARY KEY (id, uid))",
  "CREATE TABLE IF NOT EXISTS cfg (k TEXT PRIMARY KEY, v TEXT)",
];

const CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"};
const json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers: Object.assign({"Content-Type": "application/json; charset=utf-8"}, CORS)});
const fail = (code, description) => json({ok: false, error_code: code, description}, code);
const now = () => Math.floor(Date.now() / 1000);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"})[c]);
const admins = (env) => String(env.ADMIN_IDS || "").split(/[\s,;]+/).filter(Boolean).map(Number);
const isAdmin = (env, id) => admins(env).includes(Number(id));
async function sha(t) { const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))); return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); }
function rnd(n = 24) { const b = crypto.getRandomValues(new Uint8Array(n)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || String(u.id);

async function tg(env, method, params) {
  const r = await fetch(`${API}/bot${env.BOT_TOKEN}/${method}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(params || {})});
  const j = await r.json().catch(() => ({}));
  if (!j.ok) console.warn("telegram", method, j.description);
  return j;
}
const one = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
const run = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).run();
async function cfgGet(env, k, def) { const r = await one(env, "SELECT v FROM cfg WHERE k = ?", k); return r ? r.v : def; }
const cfgSet = (env, k, v) => run(env, "INSERT INTO cfg (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, String(v));
const manual = async (env) => (await cfgGet(env, "manual", "0")) === "1";

/* ───────── sozlash: jadvallar, webhook, buyruqlar ───────── */
async function setup(req, env) {
  const u = new URL(req.url);
  if (!env.SETUP_SECRET || u.searchParams.get("s") !== env.SETUP_SECRET) return fail(403, "s= noto'g'ri");
  for (const q of SCHEMA) await env.DB.prepare(q).run();
  const me = await tg(env, "getMe");
  if (!me.ok) return fail(500, "BOT_TOKEN noto'g'ri: " + (me.description || ""));
  await cfgSet(env, "bot", me.result.username);
  const wh = await tg(env, "setWebhook", {url: `${u.origin}/tg`, secret_token: await sha("wh" + env.SETUP_SECRET).then((h) => h.slice(0, 48)),
    allowed_updates: ["message", "callback_query", "my_chat_member"], drop_pending_updates: true});
  await tg(env, "setMyCommands", {commands: [{command: "start", description: "Ilovani ulash"}, {command: "holat", description: "Ulanish holati"}]});
  return json({ok: !!wh.ok, bot: me.result.username, webhook: wh.description || "ok", admins: admins(env)});
}

/* ───────── ilova uchun ───────── */
// 1-qadam: ilova /go/<t> ni ochadi — t yoziladi va Telegram'ga yo'naltiriladi
async function goLink(env, t, req) {
  if (!T_RE.test(t)) return fail(400, "havola noto'g'ri");
  const dev = (new URL(req.url).searchParams.get("d") || "").slice(0, 60);
  await run(env, "DELETE FROM links WHERE at < ?", now() - 86400);
  await run(env, "INSERT OR IGNORE INTO links (t, st, dev, at) VALUES (?, 'new', ?, ?)", t, dev, now());
  const bot = await cfgGet(env, "bot", "");
  return Response.redirect(`https://t.me/${bot}?start=${t}`, 302);
}
// 3-qadam: ilova holatni so'raydi; kalit bir marta beriladi va havola o'chiriladi
async function pollLink(env, t) {
  if (!T_RE.test(t)) return fail(400, "havola noto'g'ri");
  const l = await one(env, "SELECT * FROM links WHERE t = ?", t);
  if (!l || now() - l.at > LINK_TTL + 600) return json({ok: true, st: "none"});
  if (l.st !== "ok") return json({ok: true, st: l.st});
  const u = await one(env, "SELECT * FROM users WHERE id = ?", l.uid);
  await run(env, "DELETE FROM links WHERE t = ?", t);
  return json({ok: true, st: "ok", key: l.k, chat: l.uid, name: u ? u.name : "", bot: await cfgGet(env, "bot", "")});
}
async function issueKey(env, uid, dev) {
  const k = rnd(32);
  await run(env, "INSERT INTO keys (h, uid, dev, at) VALUES (?, ?, ?, ?)", await sha(k), uid, dev || "", now());
  return k;
}

// Bot API so'rovini o'qituvchi nomidan uzatish
async function relay(req, env, method) {
  if (!(method in METHODS)) return fail(403, `«${method}» usuliga ruxsat yo'q`);
  let fd;
  try { fd = await req.formData(); } catch (e) { return fail(400, "so'rov formasi o'qilmadi"); }
  const k = fd.get("_k"); fd.delete("_k");
  if (!k) return fail(401, "Kalit yo'q — ilovada Telegram'ni qayta ulang");
  const u = await one(env, "SELECT users.* FROM keys JOIN users ON users.id = keys.uid WHERE keys.h = ?", await sha(String(k)));
  if (!u) return fail(401, "Ulanish bekor qilingan — ilovada Telegram'ni qayta ulang");
  if (u.st === "blocked") return fail(403, "Admin sizni bloklagan");
  if (u.st !== "ok") return fail(403, "Admin tasdig'i kutilmoqda");
  const kind = METHODS[method];
  if (method === "myGroups") return json({ok: true, result: (await all(env, "SELECT id, title FROM groups WHERE uid = ? ORDER BY title", u.id))});
  if (method === "backupFile") return json(await backupFile(env, u, String(fd.get("file_id") || "")));
  if (kind !== "none") {
    const chat = String(fd.get("chat_id") || "");
    if (chat !== String(u.id)) {
      if (kind === "own") return fail(403, "Faqat o'z chatingiz");
      if (!(await one(env, "SELECT 1 AS x FROM groups WHERE uid = ? AND id = ?", u.id, Number(chat)))) return fail(403, "Bu guruhga botni siz qo'shmagansiz");
    }
  }
  const r = await fetch(`${API}/bot${env.BOT_TOKEN}/${method}`, {method: "POST", body: fd});
  return new Response(await r.text(), {status: r.status, headers: Object.assign({"Content-Type": "application/json; charset=utf-8"}, CORS)});
}

// o'z chatidagi qadalgan zaxira faylini o'qib berish (brauzer fayl manzilini CORS sababli o'qiy olmaydi) — gas/Code.gs dagi backupFile_ bilan bir xil
async function backupFile(env, u, fid) {
  const ch = await tg(env, "getChat", {chat_id: u.id}), pm = ch.ok && ch.result && ch.result.pinned_message, d = pm && pm.document;
  if (!d) return {ok: false, error_code: 404, description: "Qadalgan zaxira topilmadi"};
  if (fid && fid !== d.file_id && fid !== d.file_unique_id) return {ok: false, error_code: 404, description: "Zaxira yangilangan — qayta urinib ko'ring"};
  const f = await tg(env, "getFile", {file_id: d.file_id});
  if (!f.ok || !f.result.file_path) return {ok: false, error_code: 502, description: f.description || "Faylni olib bo'lmadi"};
  const r = await fetch(`${API}/file/bot${env.BOT_TOKEN}/${f.result.file_path}`);
  if (!r.ok) return {ok: false, error_code: 502, description: "Faylni yuklab bo'lmadi"};
  return {ok: true, result: {message_id: pm.message_id, text: await r.text()}};
}

/* ───────── Telegram webhook ───────── */
const ADMIN_KB = async (env) => ({keyboard: [[{text: "👥 O'qituvchilar"}, {text: (await manual(env)) ? "🔒 Tasdiq bilan" : "🟢 Tasdiqsiz ulanish"}], [{text: "📈 Holat"}]], resize_keyboard: true});
const APP_BTN = {inline_keyboard: [[{text: "📒 Ilovani ochish", url: APP_URL}]]};
const say = (env, chat, text, extra) => tg(env, "sendMessage", Object.assign({chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true}, extra || {}));
async function toAdmins(env, text, kb) { for (const a of admins(env)) await say(env, a, text, kb ? {reply_markup: kb} : {}); }
const who = (u, dev) => `${esc(u.name)}${u.uname ? ` (@${esc(u.uname)})` : ""}\nTelegram ID: <code>${u.id}</code>${dev ? ` · ${esc(dev)}` : ""}`;
const welcome = (isAuto) => `${isAuto ? "✅ Ilova ulandi!" : "✅ Admin tasdiqladi. Ilova ulandi!"}\nEndi zaxiralar, kunlik hisobot rasmlari va PDF hisobotlar shu yerga keladi.`;

async function onStart(env, from, t) {
  const uid = from.id, name = fullName(from), uname = from.username || "";
  const old = await one(env, "SELECT * FROM users WHERE id = ?", uid);
  if (old && old.st === "blocked") return say(env, uid, "⛔ Admin sizga bu botdan foydalanishga ruxsat bermagan.");
  const l = t && T_RE.test(t) ? await one(env, "SELECT * FROM links WHERE t = ?", t) : null;
  if (!l || now() - l.at > LINK_TTL || l.st !== "new") {
    if (old && old.st === "ok") return say(env, uid, "Siz allaqachon ulangansiz. Yangi qurilmani ulash uchun shu qurilmadagi ilovada «Sozlamalar → Ma'lumotlar → ✈️ Telegram'ni ulash» tugmasini bosing.", {reply_markup: APP_BTN});
    return say(env, uid, t ? "⌛ Havola eskirgan. Ilovada «✈️ Telegram'ni ulash» tugmasini qayta bosing."
      : "Assalomu alaykum! Bu «Yo'qlama jurnali» boti.\nUlash uchun ilovada «Sozlamalar → Ma'lumotlar → ✈️ Telegram'ni ulash» tugmasini bosing.", {reply_markup: APP_BTN});
  }
  const ok = (old && old.st === "ok") || isAdmin(env, uid) || !(await manual(env));
  const st = ok ? "ok" : "wait";
  await run(env, "INSERT INTO users (id, name, uname, st, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, uname = excluded.uname, st = CASE WHEN users.st = 'ok' THEN 'ok' ELSE excluded.st END",
    uid, name, uname, st, now());
  const u = {id: uid, name, uname};
  if (ok) {
    await run(env, "UPDATE links SET uid = ?, st = 'ok', k = ? WHERE t = ?", uid, await issueKey(env, uid, l.dev), t);
    await say(env, uid, welcome(true));
    if (!isAdmin(env, uid)) await toAdmins(env, `${old ? "📱 Yangi qurilma ulandi" : "🆕 Yangi o'qituvchi ulandi"}\n${who(u, l.dev)}`, {inline_keyboard: [[{text: "🚫 Bloklash", callback_data: `bl:${uid}`}]]});
  } else {
    await run(env, "UPDATE links SET uid = ?, st = 'wait' WHERE t = ?", uid, t);
    await say(env, uid, "📨 So'rovingiz admin'ga yuborildi. Tasdiqlangach ilova o'zi ulanadi.");
    await toAdmins(env, `🆕 <b>Yangi o'qituvchi</b>\n${who(u, l.dev)}`, {inline_keyboard: [[{text: "✅ Tasdiqlash", callback_data: `ok:${uid}`}, {text: "❌ Rad etish", callback_data: `no:${uid}`}]]});
  }
}

async function usersList(env, chat) {
  const L = await all(env, "SELECT * FROM users ORDER BY st, name");
  if (!L.length) return say(env, chat, "Hali o'qituvchi ulanmagan.");
  const st = {ok: "faol", wait: "kutmoqda", blocked: "bloklangan"};
  const text = `👥 <b>O'qituvchilar: ${L.length} ta</b>\n` + L.slice(0, 60).map((u, i) => `${i + 1}. ${esc(u.name)}${u.uname ? ` @${esc(u.uname)}` : ""} — ${st[u.st] || u.st}`).join("\n");
  const kb = L.filter((u) => !isAdmin(env, u.id)).slice(0, 40).map((u) => [u.st === "blocked" ? {text: `↩ ${u.name}`, callback_data: `ub:${u.id}`}
    : u.st === "wait" ? {text: `✅ ${u.name}`, callback_data: `ok:${u.id}`} : {text: `🚫 ${u.name}`, callback_data: `bl:${u.id}`}]);
  return say(env, chat, text + (kb.length ? "\n\nTugma: 🚫 bloklash · ↩ blokdan chiqarish · ✅ tasdiqlash" : ""), kb.length ? {reply_markup: {inline_keyboard: kb}} : {});
}
async function status(env, chat) {
  const c = async (st) => ((await one(env, "SELECT COUNT(*) AS n FROM users WHERE st = ?", st)) || {}).n || 0;
  const g = ((await one(env, "SELECT COUNT(*) AS n FROM groups")) || {}).n || 0;
  return say(env, chat, `📈 <b>Holat</b>\nFaol o'qituvchilar: ${await c("ok")}\nTasdiq kutmoqda: ${await c("wait")}\nBloklangan: ${await c("blocked")}\nOta-onalar guruhlari: ${g}\nUlanish: ${(await manual(env)) ? "🔒 admin tasdig'i bilan" : "🟢 tasdiqsiz"}`);
}

async function onCallback(env, q) {
  const from = q.from.id, [act, id] = String(q.data || "").split(":"), uid = Number(id);
  const answer = (text) => tg(env, "answerCallbackQuery", {callback_query_id: q.id, text});
  if (!isAdmin(env, from)) return answer("Faqat admin uchun");
  const u = await one(env, "SELECT * FROM users WHERE id = ?", uid);
  if (!u) return answer("O'qituvchi topilmadi");
  const mark = (txt) => q.message ? tg(env, "editMessageReplyMarkup", {chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: {inline_keyboard: [[{text: txt, callback_data: "x:0"}]]}}) : null;
  if (act === "ok") {
    await run(env, "UPDATE users SET st = 'ok' WHERE id = ?", uid);
    for (const l of await all(env, "SELECT * FROM links WHERE uid = ? AND st = 'wait'", uid)) await run(env, "UPDATE links SET st = 'ok', k = ? WHERE t = ?", await issueKey(env, uid, l.dev), l.t);
    await say(env, uid, welcome(false)); await mark(`✅ ${u.name} tasdiqlandi`); return answer("Tasdiqlandi");
  }
  if (act === "no") {
    await run(env, "UPDATE users SET st = 'blocked' WHERE id = ?", uid); await run(env, "UPDATE links SET st = 'no' WHERE uid = ? AND st = 'wait'", uid);
    await say(env, uid, "❌ Admin so'rovingizni rad etdi. Savol bo'lsa, maktab adminiga murojaat qiling."); await mark(`❌ ${u.name} rad etildi`); return answer("Rad etildi");
  }
  if (act === "bl") {
    await run(env, "UPDATE users SET st = 'blocked' WHERE id = ?", uid); await run(env, "DELETE FROM keys WHERE uid = ?", uid);
    await say(env, uid, "⛔ Admin ulanishingizni to'xtatdi. Ilova endi bu botga yubormaydi."); await mark(`🚫 ${u.name} bloklandi`); return answer("Bloklandi");
  }
  if (act === "ub") {
    await run(env, "UPDATE users SET st = 'ok' WHERE id = ?", uid);
    await say(env, uid, "↩ Admin blokni olib tashladi. Ilovada «✈️ Telegram'ni ulash» tugmasini qayta bosing."); await mark(`↩ ${u.name} blokdan chiqarildi`); return answer("Blokdan chiqarildi");
  }
  return answer("");
}

async function onMyChat(env, m) {   // bot guruhga qo'shildi yoki chiqarildi
  const ch = m.chat, st = m.new_chat_member && m.new_chat_member.status;
  if (!ch || (ch.type !== "group" && ch.type !== "supergroup")) return;
  if (st === "left" || st === "kicked") { await run(env, "DELETE FROM groups WHERE id = ?", ch.id); return; }
  const u = await one(env, "SELECT * FROM users WHERE id = ? AND st = 'ok'", m.from.id);
  if (!u) { await say(env, ch.id, "Bu botni faqat ulangan o'qituvchi guruhga qo'sha oladi."); await tg(env, "leaveChat", {chat_id: ch.id}); return; }
  await run(env, "INSERT INTO groups (id, uid, title) VALUES (?, ?, ?) ON CONFLICT(id, uid) DO UPDATE SET title = excluded.title", ch.id, u.id, ch.title || String(ch.id));
  await say(env, u.id, `👥 «${esc(ch.title || ch.id)}» guruhiga qo'shildim. Ilovada «Kunlik hisobot → Ota-onalar guruhlari» ichida uni sinfga biriktiring.`);
}

async function onMessage(env, m) {
  if (m.migrate_to_chat_id) { await run(env, "UPDATE groups SET id = ? WHERE id = ?", m.migrate_to_chat_id, m.chat.id); return; }
  if (!m.from || !m.chat || m.chat.type !== "private" || typeof m.text !== "string") return;
  const id = m.from.id, text = m.text.trim(), adm = isAdmin(env, id);
  const s = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/);
  if (s) { await onStart(env, m.from, s[1] || ""); if (adm) await say(env, id, "Siz adminsiz. Pastdagi tugmalar faqat sizga ko'rinadi.", {reply_markup: await ADMIN_KB(env)}); return; }
  if (adm && text === "👥 O'qituvchilar") return usersList(env, id);
  if (adm && text === "📈 Holat") return status(env, id);
  if (adm && (text === "🔒 Tasdiq bilan" || text === "🟢 Tasdiqsiz ulanish")) {
    const m2 = !(await manual(env)); await cfgSet(env, "manual", m2 ? "1" : "0");
    return say(env, id, m2 ? "🔒 Endi yangi o'qituvchi siz tasdiqlagandan keyin ulanadi." : "🟢 Endi o'qituvchi bitta tugma bilan darhol ulanadi, sizga faqat xabar keladi.", {reply_markup: await ADMIN_KB(env)});
  }
  {
    const u = await one(env, "SELECT * FROM users WHERE id = ?", id), n = u ? ((await one(env, "SELECT COUNT(*) AS n FROM keys WHERE uid = ?", id)) || {}).n : 0;
    return say(env, id, !u ? "Siz hali ulanmagansiz. Ilovada «Sozlamalar → Ma'lumotlar → ✈️ Telegram'ni ulash» tugmasini bosing."
      : u.st === "ok" ? `✅ Ulangansiz. Ulangan qurilmalar: ${n} ta.` : u.st === "wait" ? "⏳ Admin tasdig'i kutilmoqda." : "⛔ Ulanish to'xtatilgan.", {reply_markup: APP_BTN});
  }
}

async function webhook(req, env) {
  const want = (await sha("wh" + env.SETUP_SECRET)).slice(0, 48);
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== want) return new Response("forbidden", {status: 403});
  const up = await req.json().catch(() => ({}));
  try {
    if (up.message) await onMessage(env, up.message);
    else if (up.callback_query) await onCallback(env, up.callback_query);
    else if (up.my_chat_member) await onMyChat(env, up.my_chat_member);
  } catch (e) { console.error("webhook", e && e.stack || e); }
  return new Response("ok");
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url), p = u.pathname.replace(/\/+$/, "") || "/";
    if (req.method === "OPTIONS") return new Response(null, {status: 204, headers: CORS});
    try {
      if (p === "/tg" && req.method === "POST") return await webhook(req, env);
      if (p === "/setup") return await setup(req, env);
      let m;
      if ((m = p.match(/^\/go\/([^/]+)$/))) return await goLink(env, m[1], req);
      if ((m = p.match(/^\/link\/([^/]+)$/))) return await pollLink(env, m[1]);
      if ((m = p.match(/^\/api\/(\w+)$/)) && req.method === "POST") return await relay(req, env, m[1]);
      if (p === "/") return json({ok: true, name: "Yo'qlama jurnali boti", bot: await cfgGet(env, "bot", "").catch(() => "")});
      return fail(404, "topilmadi");
    } catch (e) { console.error(e && e.stack || e); return fail(500, "Server xatosi: " + (e && e.message || e)); }
  },
};
