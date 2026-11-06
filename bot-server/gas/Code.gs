/* Umumiy Telegram bot serveri — Google Apps Script varianti (Akmal, 2026-11-06).
   Cloudflare workers.dev O'zbekistonda VPN'siz ochilmadi, Google manzillari esa ochiladi. Mantiq bot-server/worker.js bilan bir xil:
   bitta tugma bilan ulanish, o'qituvchiga shaxsiy kalit, admin (ro'yxat, bloklash, «Tasdiq bilan»), ota-onalar guruhlari.
   Farqlari:
   - Webhook yo'q: Apps Script Telegram'ga 302 qaytaradi. Yangilanishlarni server o'zi getUpdates bilan oladi —
     ilova ulanishni so'raganda (har 2 soniyada) va har daqiqadagi triggerda (tick). Admin tugmalari ≤1 daqiqada ishlaydi.
   - Ilova so'rovlari JSON matn (text/plain) bo'lib keladi, fayllar base64 da:
       POST {a:"api", k, m, p:{maydonlar}, f:{maydon:{n:nomi, t:turi, b:base64}}}   POST {a:"new", t, d}
       GET  ?a=link&t=…   ?a=info   ?a=setup&s=SETUP_SECRET
   - Ma'lumot Script Properties da: u:<id> o'qituvchi, k:<sha256> kalit, l:<t> ulanish, g:<uid> guruhlar, c:* sozlamalar.
   Script Properties (qo'lda kiritiladi): BOT_TOKEN, ADMIN_IDS ("123,456"), SETUP_SECRET.  Yo'riqnoma: bot-server/gas/README.md */

var APP_URL = "https://akmal1st.github.io/yoqlama-jurnal/";
var VER = 3;   // kod versiyasi: manzil ochilganda ko'rinadi — Apps Script'da yangilangani shu bilan tekshiriladi
var LINK_TTL = 30 * 60;   // soniya: tugma bosilgandan «Boshlash» xabarigacha (xabar vaqti bo'yicha, serverga yetib kelish vaqti emas)
var T_RE = /^[A-Za-z0-9_-]{16,64}$/;
var METHODS = {sendMessage: 0, sendPhoto: 0, sendDocument: 0, pinChatMessage: 0, unpinChatMessage: 0, deleteMessage: 0,
  deleteMessages: "own", editMessageReplyMarkup: "own", getChat: "own", getMe: "none", myGroups: "none", backupFile: "none"};

/* ───────── yordamchilar ───────── */
function P_() { return PropertiesService.getScriptProperties(); }
function env_(k) { return P_().getProperty(k) || ""; }
function get_(k) { var v = P_().getProperty(k); if (v == null) return null; try { return JSON.parse(v); } catch (e) { return v; } }
function set_(k, v) { P_().setProperty(k, JSON.stringify(v)); }
function del_(k) { P_().deleteProperty(k); }
function all_(prefix) { var o = P_().getProperties(), out = []; for (var k in o) if (k.indexOf(prefix) === 0) { try { out.push([k, JSON.parse(o[k])]); } catch (e) {} } return out; }
function now_() { return Math.floor(Date.now() / 1000); }
function esc_(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;"}[c]; }); }
function admins_() { return env_("ADMIN_IDS").split(/[\s,;]+/).filter(Boolean).map(Number); }
function isAdmin_(id) { return admins_().indexOf(Number(id)) >= 0; }
function sha_(t) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8).map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, "0"); }).join(""); }
function rnd_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ""); }
function fullName_(u) { return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || String(u.id); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fail_(code, d) { return out_({ok: false, error_code: code, description: d}); }
function manual_() { return env_("c:manual") === "1"; }
function bot_() { return env_("c:bot"); }

function tg_(method, params) {   // ichki chaqiriq: JSON
  var r = UrlFetchApp.fetch("https://api.telegram.org/bot" + env_("BOT_TOKEN") + "/" + method,
    {method: "post", contentType: "application/json", payload: JSON.stringify(params || {}), muteHttpExceptions: true});
  var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (!j.ok) console.warn("telegram " + method + ": " + j.description);
  return j;
}
function say_(chat, text, extra) {
  var p = {chat_id: chat, text: text, parse_mode: "HTML", disable_web_page_preview: true};
  for (var k in (extra || {})) p[k] = extra[k];
  return tg_("sendMessage", p);
}
function toAdmins_(text, kb) { admins_().forEach(function (a) { say_(a, text, kb ? {reply_markup: kb} : {}); }); }
function adminKb_() { return {keyboard: [[{text: "👥 O'qituvchilar"}, {text: manual_() ? "🔒 Tasdiq bilan" : "🟢 Tasdiqsiz ulanish"}], [{text: "📈 Holat"}]], resize_keyboard: true}; }
var APP_BTN = {inline_keyboard: [[{text: "📒 Ilovani ochish", url: APP_URL}]]};
function who_(u, dev) { return esc_(u.name) + (u.uname ? " (@" + esc_(u.uname) + ")" : "") + "\nTelegram ID: <code>" + u.id + "</code>" + (dev ? " · " + esc_(dev) : ""); }
function welcome_(isAuto) { return (isAuto ? "✅ Ilova ulandi!" : "✅ Admin tasdiqladi. Ilova ulandi!") + "\nEndi zaxiralar, kunlik hisobot rasmlari va PDF hisobotlar shu yerga keladi."; }
function issueKey_(uid, dev) { var k = rnd_(); set_("k:" + sha_(k), {uid: uid, dev: dev || "", at: now_()}); return k; }
function delKeys_(uid) { all_("k:").forEach(function (x) { if (x[1].uid === uid) del_(x[0]); }); }

/* ───────── kirish nuqtalari ───────── */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.a === "link") return out_(pollLink_(String(p.t || "")));
    if (p.a === "setup") return out_(setup_(String(p.s || "")));
    var tick = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "tick"; });
    return out_({ok: true, name: "Yo'qlama jurnali boti", bot: bot_(), v: VER, tick: tick});
  } catch (err) { console.error(err && err.stack || err); return fail_(500, "Server xatosi: " + (err && err.message || err)); }
}
function doPost(e) {
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (b.a === "api") return relay_(b);
    if (b.a === "new") { newLink_(String(b.t || ""), String(b.d || "")); return out_({ok: true}); }
    return fail_(404, "topilmadi");
  } catch (err) { console.error(err && err.stack || err); return fail_(500, "Server xatosi: " + (err && err.message || err)); }
}

function setup_(s) {
  if (!env_("SETUP_SECRET") || s !== env_("SETUP_SECRET")) return {ok: false, description: "s= noto'g'ri"};
  var me = tg_("getMe");
  if (!me.ok) return {ok: false, description: "BOT_TOKEN noto'g'ri: " + (me.description || "")};
  P_().setProperty("c:bot", me.result.username);
  tg_("deleteWebhook", {drop_pending_updates: false});   // webhook bo'lsa getUpdates ishlamaydi
  tg_("setMyCommands", {commands: [{command: "start", description: "Ilovani ulash"}, {command: "holat", description: "Ulanish holati"}]});
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "tick"; });
  if (!has) ScriptApp.newTrigger("tick").timeBased().everyMinutes(1).create();
  processUpdates_();
  return {ok: true, bot: me.result.username, admins: admins_(), trigger: "har daqiqada", v: VER};
}

// har daqiqada: admin tugmalari, guruhlar, eski havolalarni tozalash
function tick() {
  processUpdates_();
  var old = now_() - 86400;
  all_("l:").forEach(function (x) { if ((x[1].at || 0) < old) del_(x[0]); });
}

function processUpdates_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return;
  try {
    var off = Number(env_("c:off") || 0);
    var r = tg_("getUpdates", {offset: off, timeout: 0, limit: 100, allowed_updates: ["message", "callback_query", "my_chat_member"]});
    (r.result || []).forEach(function (up) {
      P_().setProperty("c:off", String(up.update_id + 1));
      try {
        if (up.message) onMessage_(up.message);
        else if (up.callback_query) onCallback_(up.callback_query);
        else if (up.my_chat_member) onMyChat_(up.my_chat_member);
      } catch (err) { console.error("update " + up.update_id + ": " + (err && err.stack || err)); }
    });
  } finally { lock.releaseLock(); }
}

/* ───────── ilova uchun ───────── */
function newLink_(t, dev) {
  if (!T_RE.test(t) || get_("l:" + t)) return;
  set_("l:" + t, {st: "new", dev: dev.slice(0, 60), at: now_()});
}
function pollLink_(t) {
  if (!T_RE.test(t)) return {ok: false, description: "havola noto'g'ri"};
  var l = get_("l:" + t);
  if (!l || l.st !== "ok") { processUpdates_(); l = get_("l:" + t); }
  if (!l || now_() - l.at > LINK_TTL + 600) return {ok: true, st: "none"};
  if (l.st !== "ok") return {ok: true, st: l.st};
  var u = get_("u:" + l.uid) || {};
  del_("l:" + t);
  return {ok: true, st: "ok", key: l.k, chat: l.uid, name: u.name || "", bot: bot_()};
}

function relay_(b) {
  var m = String(b.m || "");
  if (!METHODS.hasOwnProperty(m)) return fail_(403, "«" + m + "» usuliga ruxsat yo'q");
  if (!b.k) return fail_(401, "Kalit yo'q — ilovada Telegram'ni qayta ulang");
  var key = get_("k:" + sha_(b.k)), u = key && get_("u:" + key.uid);
  if (!u) return fail_(401, "Ulanish bekor qilingan — ilovada Telegram'ni qayta ulang");
  if (u.st === "blocked") return fail_(403, "Admin sizni bloklagan");
  if (u.st !== "ok") return fail_(403, "Admin tasdig'i kutilmoqda");
  var p = b.p || {}, kind = METHODS[m];
  if (m === "myGroups") { processUpdates_(); return out_({ok: true, result: get_("g:" + u.id) || []}); }
  if (m === "backupFile") return out_(backupFile_(u, p));
  if (kind !== "none") {
    var chat = String(p.chat_id || "");
    if (chat !== String(u.id)) {
      if (kind === "own") return fail_(403, "Faqat o'z chatingiz");
      var gs = get_("g:" + u.id) || [];
      if (!gs.some(function (g) { return String(g.id) === chat; })) return fail_(403, "Bu guruhga botni siz qo'shmagansiz");
    }
  }
  var payload = {}, f = b.f || {}, files = false;
  for (var k in p) payload[k] = typeof p[k] === "string" ? p[k] : JSON.stringify(p[k]);
  for (var n in f) { payload[n] = Utilities.newBlob(Utilities.base64Decode(f[n].b), f[n].t || "application/octet-stream", f[n].n || n); files = true; }
  var opt = {method: "post", payload: payload, muteHttpExceptions: true};
  if (!files && !Object.keys(payload).length) opt = {method: "post", muteHttpExceptions: true};
  var r = UrlFetchApp.fetch("https://api.telegram.org/bot" + env_("BOT_TOKEN") + "/" + m, opt);
  return ContentService.createTextOutput(r.getContentText()).setMimeType(ContentService.MimeType.JSON);
}

// O'qituvchining o'z chatida qadalgan zaxira faylini o'qib berish. Brauzer api.telegram.org/file/… ni o'qiy olmaydi (CORS),
// shuning uchun avval zaxira chatga siqilgan matn bo'laklari («📦1/11 H4sI…») bo'lib ham borardi. Endi server faylni o'zi o'qiydi.
// Faqat o'z chatidagi qadalgan hujjat: begona file_id bilan boshqa faylni o'qib bo'lmaydi.
function backupFile_(u, p) {
  var ch = tg_("getChat", {chat_id: u.id}), pm = ch.ok && ch.result && ch.result.pinned_message, d = pm && pm.document;
  if (!d) return {ok: false, error_code: 404, description: "Qadalgan zaxira topilmadi"};
  if (p.file_id && String(p.file_id) !== d.file_id && String(p.file_id) !== d.file_unique_id) return {ok: false, error_code: 404, description: "Zaxira yangilangan — qayta urinib ko'ring"};
  var f = tg_("getFile", {file_id: d.file_id});
  if (!f.ok || !f.result.file_path) return {ok: false, error_code: 502, description: f.description || "Faylni olib bo'lmadi"};
  var r = UrlFetchApp.fetch("https://api.telegram.org/file/bot" + env_("BOT_TOKEN") + "/" + f.result.file_path, {muteHttpExceptions: true});
  if (r.getResponseCode() !== 200) return {ok: false, error_code: 502, description: "Faylni yuklab bo'lmadi"};
  return {ok: true, result: {message_id: pm.message_id, text: r.getContentText("UTF-8")}};
}

/* ───────── Telegram yangilanishlari ───────── */
// sent — Telegram xabari yuborilgan vaqt: server xabarni kechikib olsa ham (telefonda brauzer fonda to'xtaydi, trigger daqiqada bir) havola eskirmaydi
function onStart_(from, t, sent) {
  var uid = from.id, name = fullName_(from), uname = from.username || "";
  var old = get_("u:" + uid);
  if (old && old.st === "blocked") return say_(uid, "⛔ Admin sizga bu botdan foydalanishga ruxsat bermagan.");
  var l = null;
  if (t && T_RE.test(t)) { l = get_("l:" + t); if (!l) { l = {st: "new", dev: "", at: now_()}; } }   // ilova «new» ni yuborib ulgurmagan bo'lsa ham
  if (!l || (sent || now_()) - l.at > LINK_TTL || l.st !== "new") {
    if (old && old.st === "ok") return say_(uid, "Siz allaqachon ulangansiz. Yangi qurilmani ulash uchun shu qurilmadagi ilovada «Sozlamalar → Ma'lumotlar → ✈️ Telegram'ni ulash» tugmasini bosing.", {reply_markup: APP_BTN});
    return say_(uid, t ? "⌛ Havola eskirgan. Ilovada «✈️ Telegram'ni ulash» tugmasini qayta bosing."
      : "Assalomu alaykum! Bu «Yo'qlama jurnali» boti.\nUlash uchun ilovada «Sozlamalar → Ma'lumotlar → ✈️ Telegram'ni ulash» tugmasini bosing.", {reply_markup: APP_BTN});
  }
  var ok = (old && old.st === "ok") || isAdmin_(uid) || !manual_();
  set_("u:" + uid, {id: uid, name: name, uname: uname, st: ok ? "ok" : (old && old.st === "ok" ? "ok" : "wait"), at: (old && old.at) || now_()});
  var u = {id: uid, name: name, uname: uname};
  if (ok) {
    l.uid = uid; l.st = "ok"; l.k = issueKey_(uid, l.dev); l.at = now_(); set_("l:" + t, l);
    say_(uid, welcome_(true));
    if (!isAdmin_(uid)) toAdmins_((old ? "📱 Yangi qurilma ulandi" : "🆕 Yangi o'qituvchi ulandi") + "\n" + who_(u, l.dev), {inline_keyboard: [[{text: "🚫 Bloklash", callback_data: "bl:" + uid}]]});
  } else {
    l.uid = uid; l.st = "wait"; l.at = now_(); set_("l:" + t, l);
    say_(uid, "📨 So'rovingiz admin'ga yuborildi. Tasdiqlangach ilova o'zi ulanadi.");
    toAdmins_("🆕 <b>Yangi o'qituvchi</b>\n" + who_(u, l.dev), {inline_keyboard: [[{text: "✅ Tasdiqlash", callback_data: "ok:" + uid}, {text: "❌ Rad etish", callback_data: "no:" + uid}]]});
  }
}

function usersList_(chat) {
  var L = all_("u:").map(function (x) { return x[1]; }).sort(function (a, b) { return (a.st + a.name).localeCompare(b.st + b.name); });
  if (!L.length) return say_(chat, "Hali o'qituvchi ulanmagan.");
  var st = {ok: "faol", wait: "kutmoqda", blocked: "bloklangan"};
  var text = "👥 <b>O'qituvchilar: " + L.length + " ta</b>\n" + L.slice(0, 60).map(function (u, i) { return (i + 1) + ". " + esc_(u.name) + (u.uname ? " @" + esc_(u.uname) : "") + " — " + (st[u.st] || u.st); }).join("\n");
  var kb = L.filter(function (u) { return !isAdmin_(u.id); }).slice(0, 40).map(function (u) {
    return [u.st === "blocked" ? {text: "↩ " + u.name, callback_data: "ub:" + u.id} : u.st === "wait" ? {text: "✅ " + u.name, callback_data: "ok:" + u.id} : {text: "🚫 " + u.name, callback_data: "bl:" + u.id}]; });
  return say_(chat, text + (kb.length ? "\n\nTugma: 🚫 bloklash · ↩ blokdan chiqarish · ✅ tasdiqlash" : ""), kb.length ? {reply_markup: {inline_keyboard: kb}} : {});
}
function status_(chat) {
  var L = all_("u:").map(function (x) { return x[1]; }), c = function (s) { return L.filter(function (u) { return u.st === s; }).length; };
  var g = all_("g:").reduce(function (n, x) { return n + (x[1] || []).length; }, 0);
  return say_(chat, "📈 <b>Holat</b>\nFaol o'qituvchilar: " + c("ok") + "\nTasdiq kutmoqda: " + c("wait") + "\nBloklangan: " + c("blocked") + "\nOta-onalar guruhlari: " + g + "\nUlanish: " + (manual_() ? "🔒 admin tasdig'i bilan" : "🟢 tasdiqsiz"));
}

function onCallback_(q) {
  var parts = String(q.data || "").split(":"), act = parts[0], uid = Number(parts[1]);
  var answer = function (text) { return tg_("answerCallbackQuery", {callback_query_id: q.id, text: text}); };
  if (!isAdmin_(q.from.id)) return answer("Faqat admin uchun");
  var u = get_("u:" + uid);
  if (!u) return answer("O'qituvchi topilmadi");
  var mark = function (txt) { if (q.message) tg_("editMessageReplyMarkup", {chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: {inline_keyboard: [[{text: txt, callback_data: "x:0"}]]}}); };
  var setSt = function (st) { u.st = st; set_("u:" + uid, u); };
  if (act === "ok") {
    setSt("ok");
    all_("l:").forEach(function (x) { if (x[1].uid === uid && x[1].st === "wait") { x[1].st = "ok"; x[1].k = issueKey_(uid, x[1].dev); x[1].at = now_(); set_(x[0], x[1]); } });
    say_(uid, welcome_(false)); mark("✅ " + u.name + " tasdiqlandi"); return answer("Tasdiqlandi");
  }
  if (act === "no") {
    setSt("blocked");
    all_("l:").forEach(function (x) { if (x[1].uid === uid && x[1].st === "wait") { x[1].st = "no"; x[1].at = now_(); set_(x[0], x[1]); } });
    say_(uid, "❌ Admin so'rovingizni rad etdi. Savol bo'lsa, maktab adminiga murojaat qiling."); mark("❌ " + u.name + " rad etildi"); return answer("Rad etildi");
  }
  if (act === "bl") { setSt("blocked"); delKeys_(uid); say_(uid, "⛔ Admin ulanishingizni to'xtatdi. Ilova endi bu botga yubormaydi."); mark("🚫 " + u.name + " bloklandi"); return answer("Bloklandi"); }
  if (act === "ub") { setSt("ok"); say_(uid, "↩ Admin blokni olib tashladi. Ilovada «✈️ Telegram'ni ulash» tugmasini qayta bosing."); mark("↩ " + u.name + " blokdan chiqarildi"); return answer("Blokdan chiqarildi"); }
  return answer("");
}

function onMyChat_(m) {
  var ch = m.chat, st = m.new_chat_member && m.new_chat_member.status;
  if (!ch || (ch.type !== "group" && ch.type !== "supergroup")) return;
  if (st === "left" || st === "kicked") {
    all_("g:").forEach(function (x) { var gs = (x[1] || []).filter(function (g) { return g.id !== ch.id; }); if (gs.length !== (x[1] || []).length) set_(x[0], gs); });
    return;
  }
  var u = get_("u:" + m.from.id);
  if (!u || u.st !== "ok") { say_(ch.id, "Bu botni faqat ulangan o'qituvchi guruhga qo'sha oladi."); tg_("leaveChat", {chat_id: ch.id}); return; }
  var gs = (get_("g:" + u.id) || []).filter(function (g) { return g.id !== ch.id; });
  gs.push({id: ch.id, title: ch.title || String(ch.id)}); set_("g:" + u.id, gs);
  say_(u.id, "👥 «" + esc_(ch.title || ch.id) + "» guruhiga qo'shildim. Ilovada «Kunlik hisobot → Ota-onalar guruhlari» ichida uni sinfga biriktiring.");
}

function onMessage_(m) {
  if (m.migrate_to_chat_id) {
    all_("g:").forEach(function (x) { var ch = false; (x[1] || []).forEach(function (g) { if (g.id === m.chat.id) { g.id = m.migrate_to_chat_id; ch = true; } }); if (ch) set_(x[0], x[1]); });
    return;
  }
  if (!m.from || !m.chat || m.chat.type !== "private" || typeof m.text !== "string") return;
  var id = m.from.id, text = m.text.trim(), adm = isAdmin_(id);
  var s = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/);
  if (s) { onStart_(m.from, s[1] || "", m.date); if (adm) say_(id, "Siz adminsiz. Pastdagi tugmalar faqat sizga ko'rinadi. Tugmalar 1 daqiqagacha kechikib javob berishi mumkin.", {reply_markup: adminKb_()}); return; }
  if (adm && text === "👥 O'qituvchilar") return usersList_(id);
  if (adm && text === "📈 Holat") return status_(id);
  if (adm && (text === "🔒 Tasdiq bilan" || text === "🟢 Tasdiqsiz ulanish")) {
    var m2 = !manual_(); P_().setProperty("c:manual", m2 ? "1" : "0");
    return say_(id, m2 ? "🔒 Endi yangi o'qituvchi siz tasdiqlagandan keyin ulanadi." : "🟢 Endi o'qituvchi bitta tugma bilan darhol ulanadi, sizga faqat xabar keladi.", {reply_markup: adminKb_()});
  }
  var u = get_("u:" + id), n = u ? all_("k:").filter(function (x) { return x[1].uid === id; }).length : 0;
  return say_(id, !u ? "Siz hali ulanmagansiz. Ilovada «Sozlamalar → Ma'lumotlar → ✈️ Telegram'ni ulash» tugmasini bosing."
    : u.st === "ok" ? "✅ Ulangansiz. Ulangan qurilmalar: " + n + " ta." : u.st === "wait" ? "⏳ Admin tasdig'i kutilmoqda." : "⛔ Ulanish to'xtatilgan.", {reply_markup: APP_BTN});
}
