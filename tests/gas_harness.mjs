// Google Apps Script serverini (bot-server/gas/Code.gs) Node'da ishga tushirish: GAS xizmatlari va Telegram soxta.
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {createHash, randomUUID} from "node:crypto";

const CODE = readFileSync(new URL("../bot-server/gas/Code.gs", import.meta.url), "utf8");
const signed = (buf) => [...buf].map((b) => (b > 127 ? b - 256 : b));

export function makeGas({token = "TOK", admins = "100", secret = "sir", bot = "YoqlamaJurnalbot"} = {}) {
  const props = new Map([["BOT_TOKEN", token], ["ADMIN_IDS", admins], ["SETUP_SECRET", secret]]);
  const updates = [], log = [], triggers = [], files = {}, sent = {}, pins = {};
  let uid = 1;
  const tgResult = (m, p, raw) => {
    if (m === "getUpdates") return updates.filter((u) => u.update_id >= Number(p.offset || 0));
    if (m === "getMe") return {id: 1, username: bot};
    if (m === "getChat") return Object.assign({id: Number(p.chat_id)}, pins[p.chat_id] ? {pinned_message: pins[p.chat_id]} : {});
    if (m === "sendDocument") { const id = 5000 + log.length, fid = "DOC" + id; files[fid] = raw.document && raw.document.bytes; sent[id] = {message_id: id, date: 1761300000, caption: p.caption || "", document: {file_id: fid, file_unique_id: "U" + fid}}; return sent[id]; }
    if (m === "pinChatMessage") { if (sent[p.message_id]) pins[p.chat_id] = sent[p.message_id]; return true; }
    if (m === "getFile") return {file_id: p.file_id, file_path: "documents/" + p.file_id};
    if (m === "sendPhoto") return {message_id: log.length, photo: [{file_id: "s"}, {file_id: "PH" + log.length}]};
    return {message_id: log.length};
  };
  const G = {
    console: {log() {}, warn() {}, error: (...a) => console.error(...a)},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => { props.set(k, String(v)); },
      deleteProperty: (k) => { props.delete(k); }, getProperties: () => Object.fromEntries(props)})},
    Utilities: {
      DigestAlgorithm: {SHA_256: "sha256"}, Charset: {UTF_8: "utf8"},
      computeDigest: (_a, s) => signed(createHash("sha256").update(String(s), "utf8").digest()),
      getUuid: () => randomUUID(),
      base64Decode: (b) => signed(Buffer.from(b, "base64")),
      newBlob: (bytes, type, name) => ({blob: true, size: bytes.length, type, name, bytes: Buffer.from(bytes.map((b) => (b + 256) % 256))}),
    },
    ContentService: {MimeType: {JSON: "json"}, createTextOutput: (t) => ({t, setMimeType() { return this; }})},
    LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock() {}})},
    ScriptApp: {getProjectTriggers: () => triggers, newTrigger: (fn) => ({timeBased: () => ({everyMinutes: () => ({create: () => triggers.push({getHandlerFunction: () => fn})})})})},
    UrlFetchApp: {fetch: (url, opt = {}) => {
      const fm = String(url).match(/^https:\/\/api\.telegram\.org\/file\/bot([^/]+)\/documents\/(\w+)$/);
      if (fm) { log.push({m: "file", p: {id: fm[2]}}); const b = fm[1] === token && files[fm[2]]; return {getResponseCode: () => (b ? 200 : 404), getContentText: () => (b ? b.toString("utf8") : "")}; }
      const m = String(url).match(/\/bot([^/]+)\/(\w+)$/);
      if (!m || m[1] !== token) throw new Error("faqat Telegram'ga: " + url);
      let p = {}; const raw = opt.payload || {};
      if (opt.contentType === "application/json") p = JSON.parse(opt.payload);
      else for (const [k, v] of Object.entries(opt.payload || {})) p[k] = v && v.blob ? {size: v.size, type: v.type, name: v.name} : v;
      log.push({m: m[2], p});
      const result = tgResult(m[2], p, raw);
      return {getResponseCode: () => 200, getContentText: () => JSON.stringify({ok: true, result})};
    }},
  };
  const ctx = vm.createContext(G);
  vm.runInContext(CODE, ctx, {filename: "Code.gs"});
  return {
    ctx, log, props, triggers, pins,
    push(u) { u.update_id = 1000 + uid++; updates.push(u); },
    get: (params) => JSON.parse(ctx.doGet({parameter: params}).t),
    post: (obj) => JSON.parse(ctx.doPost({postData: {contents: typeof obj === "string" ? obj : JSON.stringify(obj)}}).t),
    // brauzer so'rovini (Playwright route) bajarish
    handle(method, url, body) {
      const q = Object.fromEntries(new URL(url).searchParams);
      const out = method === "GET" ? ctx.doGet({parameter: q}) : ctx.doPost({parameter: q, postData: {contents: body || ""}});
      return out.t;
    },
  };
}
