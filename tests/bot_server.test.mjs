// Umumiy Telegram bot serveri (bot-server/worker.js): bitta tugma bilan ulanish, admin, guruhlar, uzatishdagi ruxsatlar.
// D1 o'rniga node:sqlite, Telegram o'rniga soxta fetch.
import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import worker from "../bot-server/worker.js";

function d1() {
  const db = new DatabaseSync(":memory:");
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({results: db.prepare(sql).all(...args)}),
    run: async () => { db.prepare(sql).run(...args); return {success: true}; },
  });
  return {prepare: (sql) => stmt(sql)};
}

const ADMIN = 100, T1 = 200, T2 = 300;
let sent, realFetch = globalThis.fetch;
function mockTg() {
  sent = [];
  globalThis.fetch = async (url, opt = {}) => {
    const m = String(url).match(/\/bot([^/]+)\/(\w+)$/);
    assert.ok(m, "faqat Telegram'ga so'rov: " + url);
    assert.equal(m[1], "TOKEN");
    let p = {};
    if (opt.body instanceof FormData) for (const [k, v] of opt.body) p[k] = typeof v === "string" ? v : "[fayl]";
    else if (opt.body) p = JSON.parse(opt.body);
    sent.push({method: m[2], p});
    const result = m[2] === "getMe" ? {id: 1, username: "YoqlamaJurnalBot"} : {message_id: sent.length, chat: {id: p.chat_id}};
    return new Response(JSON.stringify({ok: true, result}));
  };
}

async function mk() {
  const env = {BOT_TOKEN: "TOKEN", ADMIN_IDS: `${ADMIN}`, SETUP_SECRET: "sir", DB: d1()};
  const call = (path, init) => worker.fetch(new Request("https://bot.example.workers.dev" + path, init), env);
  const r = await call("/setup?s=sir"); assert.equal(r.status, 200);
  const wh = sent.find((x) => x.method === "setWebhook"), secret = wh.p.secret_token;
  const up = (u) => call("/tg", {method: "POST", headers: {"X-Telegram-Bot-Api-Secret-Token": secret}, body: JSON.stringify(u)});
  const start = (id, t, name = "Dilnoza Karimova") => up({message: {from: {id, first_name: name, username: "u" + id}, chat: {id, type: "private"}, text: t ? `/start ${t}` : "/start"}});
  const api = (method, fields) => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, v); return call(`/api/${method}`, {method: "POST", body: fd}); };
  // bitta tugma: ilova /go/<t> ni ochadi, o'qituvchi Boshlash bosadi, ilova /link/<t> dan kalit oladi
  const connect = async (id, t) => {
    const g = await call(`/go/${t}?d=Chrome · Android`); assert.equal(g.status, 302); assert.equal(g.headers.get("location"), `https://t.me/YoqlamaJurnalBot?start=${t}`);
    await start(id, t);
    return (await call(`/link/${t}`)).json();
  };
  return {env, call, up, start, api, connect};
}

test.beforeEach(() => mockTg());
test.after(() => { globalThis.fetch = realFetch; });

test("sozlash: webhook maxfiy kalit bilan, noto'g'ri s= rad etiladi", async () => {
  const S = await mk();
  assert.equal((await S.call("/setup?s=xato")).status, 403);
  assert.ok(sent.find((x) => x.method === "setWebhook").p.url.endsWith("/tg"));
  assert.equal((await S.call("/tg", {method: "POST", body: "{}"})).status, 403, "maxfiy sarlavhasiz webhook rad etiladi");
});

test("bitta tugma bilan ulanish: kalit bir marta beriladi, admin'ga xabar boradi", async () => {
  const S = await mk(), t = "tA1234567890abcdefXY";
  sent.length = 0;
  const r = await S.connect(T1, t);
  assert.equal(r.st, "ok"); assert.equal(r.chat, T1); assert.equal(r.bot, "YoqlamaJurnalBot"); assert.ok(r.key.length > 30);
  assert.ok(sent.some((x) => x.method === "sendMessage" && x.p.chat_id === T1 && /Ilova ulandi/.test(x.p.text)));
  const adm = sent.find((x) => x.method === "sendMessage" && x.p.chat_id === ADMIN);
  assert.match(adm.p.text, /Yangi o'qituvchi ulandi/); assert.match(adm.p.text, /Chrome · Android/);
  assert.equal(adm.p.reply_markup.inline_keyboard[0][0].callback_data, `bl:${T1}`);
  assert.equal((await (await S.call(`/link/${t}`)).json()).st, "none", "kalit ikkinchi marta berilmaydi");
});

test("eskirgan yoki /go siz havola ulamaydi", async () => {
  const S = await mk();
  await S.start(T1, "boshqaHavola1234567890");
  assert.equal((await (await S.call("/link/boshqaHavola1234567890")).json()).st, "none");
  assert.match(sent.at(-1).p.text, /eskirgan/);
});

test("uzatish: o'z chatiga va o'zi qo'shgan guruhga ruxsat, boshqasiga yo'q", async () => {
  const S = await mk();
  const {key} = await S.connect(T1, "tB1234567890abcdefXY");
  const {key: key2} = await S.connect(T2, "tC1234567890abcdefXY");
  sent.length = 0;
  let r = await S.api("sendDocument", {_k: key, chat_id: String(T1), caption: "zaxira", document: new Blob(["{}"], {type: "application/json"})});
  assert.equal(r.status, 200); assert.equal(sent.at(-1).method, "sendDocument"); assert.equal(sent.at(-1).p._k, undefined, "kalit Telegram'ga ketmaydi");
  assert.equal(sent.at(-1).p.document, "[fayl]");
  assert.equal((await S.api("sendMessage", {_k: key, chat_id: String(T2), text: "x"})).status, 403, "boshqa o'qituvchiga yo'q");
  assert.equal((await S.api("sendMessage", {_k: "soxta", chat_id: String(T1), text: "x"})).status, 401);
  assert.equal((await S.api("getUpdates", {_k: key})).status, 403, "getUpdates ruxsat etilmagan");
  // guruh: T1 botni qo'shadi
  await S.up({my_chat_member: {chat: {id: -555, type: "group", title: "7-A ota-onalar"}, from: {id: T1}, new_chat_member: {status: "member", user: {id: 1}}}});
  const gs = await (await S.api("myGroups", {_k: key})).json();
  assert.deepEqual(gs.result, [{id: -555, title: "7-A ota-onalar"}]);
  assert.equal((await S.api("sendPhoto", {_k: key, chat_id: "-555", photo: "FILEID"})).status, 200);
  assert.equal((await S.api("sendPhoto", {_k: key2, chat_id: "-555", photo: "FILEID"})).status, 403, "guruhni boshqa o'qituvchi qo'shgan");
  assert.equal((await S.api("getChat", {_k: key, chat_id: "-555"})).status, 403, "getChat faqat o'z chatiga");
  // supergroup'ga aylansa, yangi ID ga ko'chadi
  await S.up({message: {chat: {id: -555, type: "group"}, migrate_to_chat_id: -100555}});
  assert.equal((await S.api("sendMessage", {_k: key, chat_id: "-100555", text: "x"})).status, 200);
  // bot chiqarilsa — ruxsat yo'q
  await S.up({my_chat_member: {chat: {id: -100555, type: "supergroup", title: "7-A"}, from: {id: T1}, new_chat_member: {status: "kicked", user: {id: 1}}}});
  assert.equal((await S.api("sendMessage", {_k: key, chat_id: "-100555", text: "x"})).status, 403);
});

test("ulanmagan odam botni guruhga qo'shsa, bot chiqib ketadi", async () => {
  const S = await mk();
  await S.up({my_chat_member: {chat: {id: -9, type: "group", title: "Begona"}, from: {id: 999}, new_chat_member: {status: "member", user: {id: 1}}}});
  assert.ok(sent.some((x) => x.method === "leaveChat" && x.p.chat_id === -9));
});

test("admin: bloklash kalitlarni bekor qiladi, Tasdiq bilan rejimida kutadi", async () => {
  const S = await mk();
  const {key} = await S.connect(T1, "tD1234567890abcdefXY");
  await S.up({callback_query: {id: "q1", from: {id: ADMIN}, data: `bl:${T1}`}});
  assert.equal((await S.api("sendMessage", {_k: key, chat_id: String(T1), text: "x"})).status, 401);
  await S.start(T1, "");
  assert.match(sent.at(-1).p.text, /ruxsat bermagan/);
  // admin emas — callback ishlamaydi
  await S.up({callback_query: {id: "q2", from: {id: T2}, data: `ub:${T1}`}});
  assert.match(sent.at(-1).p.text, /Faqat admin/);
  // Tasdiq bilan
  await S.up({message: {from: {id: ADMIN, first_name: "Akmal"}, chat: {id: ADMIN, type: "private"}, text: "🟢 Tasdiqsiz ulanish"}});
  assert.match(sent.at(-1).p.text, /tasdiqlagandan keyin/);
  const t = "tE1234567890abcdefXY";
  await S.call(`/go/${t}`); await S.start(T2, t);
  assert.equal((await (await S.call(`/link/${t}`)).json()).st, "wait");
  const req = sent.find((x) => x.p.chat_id === ADMIN && /Yangi o'qituvchi<\/b>/.test(x.p.text || ""));
  assert.deepEqual(req.p.reply_markup.inline_keyboard[0].map((b) => b.callback_data), [`ok:${T2}`, `no:${T2}`]);
  await S.up({callback_query: {id: "q3", from: {id: ADMIN}, data: `ok:${T2}`, message: {chat: {id: ADMIN}, message_id: 5}}});
  const r = await (await S.call(`/link/${t}`)).json();
  assert.equal(r.st, "ok");
  assert.equal((await S.api("sendMessage", {_k: r.key, chat_id: String(T2), text: "x"})).status, 200);
  // ro'yxat va holat
  await S.up({message: {from: {id: ADMIN}, chat: {id: ADMIN, type: "private"}, text: "👥 O'qituvchilar"}});
  assert.match(sent.at(-1).p.text, /O'qituvchilar: 2 ta/);
  await S.up({message: {from: {id: ADMIN}, chat: {id: ADMIN, type: "private"}, text: "📈 Holat"}});
  assert.match(sent.at(-1).p.text, /Bloklangan: 1/);
});

test("bir o'qituvchi ikki qurilma: ikkala kalit ham ishlaydi", async () => {
  const S = await mk();
  const a = await S.connect(T1, "tF1234567890abcdefXY"), b = await S.connect(T1, "tG1234567890abcdefXY");
  assert.notEqual(a.key, b.key);
  for (const k of [a.key, b.key]) assert.equal((await S.api("sendMessage", {_k: k, chat_id: String(T1), text: "x"})).status, 200);
  assert.ok(sent.some((x) => x.p.chat_id === ADMIN && /Yangi qurilma/.test(x.p.text || "")));
});

test("zaxira faylini server o'qib beradi: faqat o'z chatidagi qadalgan hujjat", async () => {
  const S = await mk();
  const {key} = await S.connect(T1, "tK1234567890abcdefXY");
  const json = '{"classes":[{"name":"7-A"}]}', base = globalThis.fetch;
  let pinned = null;
  globalThis.fetch = async (url, opt) => {
    if (String(url) === "https://api.telegram.org/file/botTOKEN/documents/f1.json") return new Response(json);
    const m = String(url).match(/\/(getChat|getFile)$/);
    if (m) { const p = JSON.parse(opt.body); sent.push({method: m[1], p}); return new Response(JSON.stringify({ok: true, result: m[1] === "getChat" ? Object.assign({id: p.chat_id}, pinned ? {pinned_message: pinned} : {}) : {file_path: "documents/f1.json"}})); }
    return base(url, opt);
  };
  assert.equal((await (await S.api("backupFile", {_k: key, file_id: "-"})).json()).error_code, 404);
  pinned = {message_id: 9, document: {file_id: "FID", file_unique_id: "UID"}};
  const r = await (await S.api("backupFile", {_k: key, file_id: "FID"})).json();
  assert.equal(r.ok, true); assert.equal(r.result.text, json); assert.equal(r.result.message_id, 9);
  assert.equal((await (await S.api("backupFile", {_k: key, file_id: "BOSHQA"})).json()).error_code, 404);
  assert.equal(sent.filter((x) => x.method === "getChat").every((x) => x.p.chat_id === T1), true, "faqat o'z chati");
});
