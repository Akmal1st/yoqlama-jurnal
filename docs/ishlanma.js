/* Dars ishlanma sahifasi — Akmal tasdiqlagan maket v8 (2026-11-14): kompyuterda chapda chorak darslari, o'ngda ishlanma;
   telefonda bitta ustun, darslar pastki oynada. Bo'limlar: Tahrirlash (dars turi, maqsad, metod, borishi — bosqichlar va daqiqalar,
   mavzu materiali — formula/chizma/rasm/yechim, topshiriqlar A/B/C, so'raladigan o'quvchilar, baholash mezonlari, uyga vazifa)
   va Varaq (Batafsil — muqova bilan, Jadval — 1 bet, Qisqa; uslub, ramka, kartochkalar). «Darsni boshlash» — darsda rejimi
   (bosqich taymeri, doskaga ko'rsatish, o'yinlar, so'raladiganlarga baho → jurnalga).
   Darslar: jurnal sanalari + mavzulari (KTR reja yoki qo'lda yozilgan), tanlangan chorak bo'yicha; «(1/2)» — mavzuning nechanchi darsi.
   Ishlanmalar: c.ish[kalit] (kalit = chorak|mavzu|k|takror — KTR qayta taqsimlansa ham mavzuga bog'liq qoladi), Set lar massiv bo'lib,
   so'raladigan o'quvchilar ismi bilan saqlanadi. Varaq va muqova sozlamalari, shablonlar — D.web.ish.
   Avtomatik to'ldirish qoidaga asoslangan (internet/SI kerak emas): matematika mavzulari kutubxonasi (MAT, FAM) bo'lsa misollar,
   javoblar, yechimlar o'zi tuziladi; boshqa fanlarda umumiy andoza. Formulalar LaTeX'da ($…$), KaTeX bilan chiziladi
   (vendor/katex, sahifa birinchi ochilganda yuklanadi). SI bilan to'ldirish — bepul: so'rov nusxalanadi, javob qo'yib ajratiladi.
   Uslub: ishlanma.css (hamma narsa #ishp / #ishd ichida). */
const ISH = (() => {
"use strict";

const MG=["yanvar","fevral","mart","aprel","may","iyun","iyul","avgust","sentabr","oktabr","noyabr","dekabr"];
const MS=["yan","fev","mar","apr","may","iyn","iyl","avg","sen","okt","noy","dek"];
const WDN=["yakshanba","dushanba","seshanba","chorshanba","payshanba","juma","shanba"];
const WDS=["Ya","Du","Se","Ch","Pa","Ju","Sh"];

const MET=["Aqliy hujum","Klaster","Insert","BBB jadvali","Venn diagrammasi","Juftlikda ishlash","Kichik guruhlarda ishlash","Zinama-zina","Savol-javob","Test","Mustaqil ish","Muammoli vaziyat"];
const JIH=["Darslik","Doska","Proyektor / taqdimot","Tarqatma materiallar","Kartochkalar","Kompyuter","Kalkulyator"];
const KOM=["Kommunikativ","Axborot bilan ishlash","O'zini o'zi rivojlantirish","Ijtimoiy faol fuqarolik","Milliy va umummadaniy","Matematik savodxonlik"];
const TYPES=["Yangi bilim beruvchi","Mustahkamlash","Aralash","Takrorlash","Nazorat","Xatolar ustida ishlash"];
const MTIP={"Aqliy hujum":"Mavzuga oid savollarga tez, ko'p javob yig'iladi; tanqid qilinmaydi.","Klaster":"Mavzu markazga yoziladi, o'quvchilar bog'liq tushunchalarni tarmoq qilib bog'laydi.","Insert":"Matnni o'qib belgilar qo'yadi: ✓ bilardim, + yangi, − boshqacha o'ylardim, ? savol.","BBB jadvali":"«Bilaman · Bilishni xohlayman · Bilib oldim» ustunlari dars boshida va oxirida to'ldiriladi.","Venn diagrammasi":"Ikki tushunchaning o'xshash va farqli tomonlari kesishgan doiralarda ko'rsatiladi.","Juftlikda ishlash":"Partadoshlar birga yechadi, bir-birini tekshiradi.","Kichik guruhlarda ishlash":"Sinf 4 guruhga bo'linadi, har guruh o'z kartochkasini yechib himoya qiladi.","Zinama-zina":"Savollar oddiydan murakkabga, har o'quvchi bir pog'ona javob beradi.","Savol-javob":"O'qituvchi qisqa savollar beradi, o'quvchilar navbat bilan javob beradi.","Test":"3–5 savollik qisqa test, javoblar darhol tekshiriladi.","Mustaqil ish":"Har kim alohida yechadi, o'qituvchi aylanib yordam beradi.","Muammoli vaziyat":"Yechimi noma'lum vaziyat beriladi, o'quvchilar yo'l izlaydi."};
const TASKS={"Umumiy ko'paytuvchini qavsdan tashqariga chiqarish":[["A","6x + 9y","3(2x + 3y)"],["A","5a² − 10a","5a(a − 2)"],["B","12x³y − 18x²y²","6x²y(2x − 3y)"],["C","a(x − y) + b(y − x)","(x − y)(a − b)"]],
"Guruhlash usuli":[["A","ax + ay + 3x + 3y","(x + y)(a + 3)"],["A","2m + 2n + km + kn","(m + n)(2 + k)"],["B","x³ − 2x² + 3x − 6","(x − 2)(x² + 3)"],["B","ab − 3b + 2a − 6","(a − 3)(b + 2)"],["C","x² − 7x + 12 (−7x = −3x − 4x)","(x − 3)(x − 4)"]],
"Yig'indi kvadrati":[["A","(a + 5)²","a² + 10a + 25"],["A","(x + 1)²","x² + 2x + 1"],["B","(3x + 2y)²","9x² + 12xy + 4y²"],["C","x² + 6x + 9 = 0 ni yeching","x = −3"]]};
const LVN={A:"oson",B:"o'rta",C:"qiyin"};
const MAT={
"Umumiy ko'paytuvchini qavsdan tashqariga chiqarish":{g:"Ko'phadning hamma hadlarida qatnashgan umumiy ko'paytuvchini qavsdan tashqariga chiqarish — ko'phadni ko'paytuvchilarga ajratishning eng oddiy usuli. Koeffitsiyentlarning EKUBi va har bir harfning eng kichik darajasi olinadi.",f:["ab + ac = a(b + c)","ma − mb = m(a − b)"],fig:"area",cap:"To'g'ri to'rtburchak yuzi: 3(2x + 3y) = 6x + 9y",ex:["12x^3y − 18x^2y^2","$\\text{EKUB}(12;\\ 18) = 6$; $x$ ning eng kichik darajasi $x^2$, $y$ niki $y$","= 6x^2y(2x − 3y)"],n:"Tekshirish: qavsni ochganda dastlabki ko'phad hosil bo'lishi kerak.",ij:"Uyingizdagi biror to'g'ri to'rtburchak shakl yuzini ikki qismga bo'lib, a(b + c) ko'rinishida yozing."},
"Guruhlash usuli":{g:"Agar ko'phadning hamma hadlarida umumiy ko'paytuvchi bo'lmasa, hadlar guruhlarga ajratiladi. Har bir guruhdan umumiy ko'paytuvchi chiqariladi, so'ng hosil bo'lgan bir xil qavs yana umumiy ko'paytuvchi sifatida chiqariladi.",f:["ax + ay + bx + by = (x + y)(a + b)"],fig:"group",cap:"Guruhlash sxemasi: 2 guruh → bir xil qavs → ko'paytma",ex:["x^3 − 2x^2 + 3x − 6","= (x^3 − 2x^2) + (3x − 6)","= x^2(x − 2) + 3(x − 2)","= (x − 2)(x^2 + 3)"],n:"Guruhlardan keyin qavslar bir xil chiqmasa, hadlarni boshqacha guruhlang.",ij:"Guruhlash usulida yechiladigan 2 ta misol tuzing va javobini qavsni ochib tekshiring."},
"Yig'indi kvadrati":{g:"Ikki son yig'indisining kvadrati birinchi son kvadrati, ikkinchi son kvadrati va ular ko'paytmasining ikkilanganining yig'indisiga teng.",f:["(a + b)^2 = a^2 + 2ab + b^2"],fig:"sq",cap:"Tomoni a + b bo'lgan kvadrat: a^2 + ab + ab + b^2",ex:["(3x + 2y)^2","= (3x)^2 + 2 · 3x · 2y + (2y)^2","= 9x^2 + 12xy + 4y^2"],n:"Ko'p uchraydigan xato: (a + b)^2 = a^2 + b^2 deb yozish. 2ab hadi unutilmasin!",ij:"Qog'ozdan a va b tomonli kvadrat va to'rtburchaklar qirqib, (a + b)^2 formulasini yig'ib ko'rsating."},
"Ayirma kvadrati":{g:"Ikki son ayirmasining kvadrati birinchi son kvadrati minus ko'paytmaning ikkilangani plyus ikkinchi son kvadratiga teng.",f:["(a − b)^2 = a^2 − 2ab + b^2"],fig:"sqm",cap:"a × a kvadratdan ab to'rtburchaklar olinadi, b^2 qaytariladi",ex:["(5 − 2m)^2","= 5^2 − 2 · 5 · 2m + (2m)^2","= 25 − 20m + 4m^2"],n:"(a − b)^2 = (b − a)^2 — qavs ichidagi ishora kvadratda yo'qoladi.",ij:"99^2 ni formula yordamida og'zaki hisoblash usulini tushuntiring."},
"Kvadratlar ayirmasi":{g:"Ikki son kvadratlarining ayirmasi shu sonlar ayirmasi va yig'indisining ko'paytmasiga teng.",f:["a^2 − b^2 = (a − b)(a + b)"],fig:"diff",cap:"a^2 dan b^2 kesiladi, qolgan qism (a + b)(a − b) to'rtburchakka aylanadi",ex:["49x^2 − 16","= (7x)^2 − 4^2","= (7x − 4)(7x + 4)"],n:"Og'zaki hisobda qo'l keladi: 51 · 49 = 50^2 − 1 = 2499.",ij:"Formuladan foydalanib 3 ta ko'paytmani og'zaki hisoblang: 31 · 29, 102 · 98, 45 · 35."},
"Kublar yig'indisi va ayirmasi":{g:"Ikki son kublarining yig'indisi (ayirmasi) shu sonlar yig'indisi (ayirmasi) va to'liqmas kvadratning ko'paytmasiga teng.",f:["a^3 + b^3 = (a + b)(a^2 − ab + b^2)","a^3 − b^3 = (a − b)(a^2 + ab + b^2)"],fig:null,ex:["x^3 − 8","= x^3 − 2^3","= (x − 2)(x^2 + 2x + 4)"],n:"Ikkinchi qavsdagi «to'liqmas kvadrat»da 2ab emas, ab turadi.",ij:"1 dan 10 gacha sonlar kublari jadvalini tuzing."},
"Ko'phadni ko'paytuvchilarga ajratish":{g:"Ko'phadni ko'paytuvchilarga ajratishda usullar ketma-ket qo'llanadi: avval umumiy ko'paytuvchi qavsdan chiqariladi, so'ng qisqa ko'paytirish formulalari yoki guruhlash usuli ishlatiladi. Har bir ko'paytuvchi boshqa ajralmaydigan bo'lguncha davom ettiriladi.",f:["ka^2 − kb^2 = k(a − b)(a + b)","a^3 + 2a^2b + ab^2 = a(a + b)^2"],fig:null,ex:["3x^3 − 12x","= 3x(x^2 − 4)","= 3x(x − 2)(x + 2)"],n:"Ko'p uchraydigan xato: umumiy ko'paytuvchini chiqargach to'xtab qolish. Qavs ichini yana tekshiring!",ij:"Uch xil usul ketma-ket qo'llanadigan bitta ko'phad tuzing va uni ajrating."},
"Algebraik kasrlar":{g:"Surati va maxraji ko'phad bo'lgan kasr algebraik kasr deyiladi. Maxrajni nolga aylantiradigan qiymatlarda kasr ma'noga ega emas. Kasrning asosiy xossasi: surat va maxrajni nolga teng bo'lmagan bir xil ifodaga ko'paytirish yoki bo'lish mumkin.",f:["a/b = (a · c)/(b · c),  b ≠ 0, c ≠ 0"],fig:null,ex:["(x^2 − 9)/(x + 3)","= (x − 3)(x + 3)/(x + 3)","= x − 3,  x ≠ −3"],n:"Ko'p uchraydigan xato: qo'shiluvchini qisqartirish, masalan (x + 2)/(x + 3) = 2/3 deb yozish. Faqat ko'paytuvchi qisqaradi!",ij:"Hayotdan algebraik kasr bilan ifodalanadigan 2 ta masala tuzing."},
"Algebraik kasrlarni qisqartirish":{g:"Algebraik kasrni qisqartirish uchun surat va maxraj ko'paytuvchilarga ajratiladi, so'ng umumiy ko'paytuvchiga bo'linadi. Javobda maxrajni nolga aylantiradigan qiymatlar ko'rsatiladi.",f:["(a · c)/(b · c) = a/b,  c ≠ 0"],fig:null,ex:["(x^2 − 4x + 4)/(x^2 − 4)","= (x − 2)^2 / ((x − 2)(x + 2))","= (x − 2)/(x + 2),  x ≠ ±2"],n:"Avval ko'paytuvchilarga ajrating, keyin qisqartiring. Ayirma va yig'indi hadlarini qisqartirib bo'lmaydi.",ij:"Qisqarmaydigan va qisqaradigan 2 tadan kasr tuzing, farqini tushuntiring."}};
function aiPrompt(l,p){return `Sen tajribali ${SUBJ().toLowerCase()} o'qituvchisisan. ${GRADE()}-sinf ${SUBJ().toLowerCase()} darsi uchun «${l.t}» mavzusiga material tayyorla. Dars turi: ${p.type}${l.h>1?`, mavzuning ${l.k}-darsi (${l.h} soatdan)`:""}. Uy vazifasi (darslik): ${l.hw||"yo'q"}.
Javobni o'zbek tilida (lotin yozuvida) yoz. Faqat quyidagi bo'limlarni, aynan shu belgilar bilan yoz, boshqa hech narsa qo'shma. Barcha formula va ifodalarni LaTeX kodida, $...$ orasida yoz (masalan: $(a+b)^2 = a^2 + 2ab + b^2$, kasr — $\\frac{a}{b}$, ko'paytma — \\cdot). FORMULA: qatoriga faqat LaTeX kodini $ belgisisiz yoz.
QO'LLANMA: 3–4 gapli qisqa nazariya
FORMULA: har formula alohida qatorda, har biri FORMULA: bilan
YECHIM: bitta namunaviy misol, keyingi qatorlarda har qadam "- " bilan
ESLATMA: o'quvchilar ko'p qiladigan xato, 1 gap
TOPSHIRIQ A: misol | javob   (2 ta A — oson, 2 ta B — o'rta, 1 ta C — qiyin)
UY A: ...  UY B: ...  UY C: ...  (darslikdagi raqamlardan)
IJODIY: bitta ijodiy uy vazifasi
NATIJA: dars yakunida o'quvchi nimani biladi va qila oladi (3 ta, har biri NATIJA: bilan)
NAMUNA MATN: o'qituvchining darsni boshlash so'zi, 2–3 gap
SAVOL: o'tgan mavzu bo'yicha savol (3 ta, har biri SAVOL: bilan)
HAYOQ: «Ha–Yo'q» o'yini uchun bayonot | Ha yoki Yo'q   (6 ta, aralash)
XULOSA: dars yakunidagi xulosa, 1–2 gap`;}
function aiParse(t){
  const r={g:"",f:[],ex:[],n:"",tasks:[],hw:{},res:[],nm:"",q:[],hy:[],xul:""};let cur=null;
  String(t).replace(/\*\*/g,"").split(/\r?\n/).forEach(line=>{const x=line.trim();if(!x)return;
    let m;
    if(m=x.match(/^QO.?LLANMA\s*:\s*(.*)$/i)){r.g=m[1];cur="g";return;}
    if(m=x.match(/^FORMULA\s*:\s*(.*)$/i)){if(m[1])r.f.push(tFormula(m[1].trim().replace(/^\$+|\$+$/g,"")));cur="f";return;}
    if(m=x.match(/^YECHIM\s*:\s*(.*)$/i)){if(m[1])r.ex.push(m[1]);cur="ex";return;}
    if(m=x.match(/^ESLATMA\s*:\s*(.*)$/i)){r.n=m[1];cur="n";return;}
    if(m=x.match(/^TOPSHIRIQ\s*([ABC])\s*:\s*(.*)$/i)){const [q,a]=m[2].split("|");r.tasks.push({lv:m[1].toUpperCase(),q:q.trim(),a:(a||"").trim()});cur=null;return;}
    if(m=x.match(/^UY\s*([ABC])\s*:\s*(.*)$/i)){r.hw[m[1].toUpperCase()]=m[2];cur=null;return;}
    if(m=x.match(/^IJODIY\s*:\s*(.*)$/i)){r.hw.ij=m[1];cur=null;return;}
    if(m=x.match(/^NATIJA\s*:\s*(.*)$/i)){if(m[1])r.res.push(m[1]);cur="res";return;}
    if(m=x.match(/^NAMUNA\s*MATN\s*:\s*(.*)$/i)){r.nm=m[1];cur="nm";return;}
    if(m=x.match(/^SAVOL\s*:\s*(.*)$/i)){if(m[1])r.q.push(m[1]);cur=null;return;}
    if(m=x.match(/^HA\W?YO.?Q\s*:\s*(.*)$/i)){const [b,a]=m[1].split("|");r.hy.push({b:b.trim(),a:/yo/i.test(a||"")?"Yo'q":"Ha"});cur=null;return;}
    if(m=x.match(/^XULOSA\s*:\s*(.*)$/i)){r.xul=m[1];cur="xul";return;}
    const y=x.replace(/^[-•*]\s*/,"");
    if(cur==="ex")r.ex.push(y);else if(cur==="g")r.g+=" "+y;else if(cur==="f")r.f.push(y);else if(cur==="n")r.n+=" "+y;else if(cur==="res")r.res.push(y);else if(cur==="nm")r.nm+=" "+y;else if(cur==="xul")r.xul+=" "+y;});
  r.g=tex(r.g);r.ex=r.ex.map(tex);r.n=tex(r.n);r.tasks.forEach(t=>{t.q=tex(t.q);t.a=tex(t.a);});Object.keys(r.hw).forEach(k=>r.hw[k]=tex(r.hw[k]));r.res=r.res.map(tex);r.nm=tex(r.nm);r.q=r.q.map(tex);r.hy.forEach(x=>x.b=tex(x.b));r.xul=tex(r.xul);
  return r;}
const FIGS={sq:"Yig'indi kvadrati",sqm:"Ayirma kvadrati",diff:"Kvadratlar ayirmasi",area:"Yuz modeli",group:"Guruhlash sxemasi"};
const QUOTES=["Bilim — kuch.","O'qigan o'zar, o'qimagan to'zar.","Ustoz otangdek ulug'.","Ilm — aql chirog'i."];
const f1=x=>String(x||"").split("\n")[0];
const lines=x=>String(x||"").split("\n").map(y=>y.trim()).filter(Boolean);
const TSTOP=new Set(["ni","va","da","bu","ga","yo","u","o","ta","bo","ya","is","in","on","to"]);
const TOP=new Set(["+","−","-","=","·","×","≠","±","/","≤","≥","<",">"]);
const LXC=/\\[a-zA-Z]+/;   // tayyor LaTeX buyrug'i (\frac, \cdot, \sin…): SI ko'pincha formulani shunday yozadi
function tTok(w){if(TOP.has(w))return "op";if(LXC.test(w)&&!/[«»—→№§]/.test(w))return "m";if(/['ʻʼ‘’«»—–→№§*:!?"]/.test(w))return null;
  const c=w.replace(/[.,;]+$/,"");if(!c||!/^[0-9a-zA-Z^²³()\/·.,;−+=±≠×≤≥]+$/.test(c))return null;
  const ls=c.match(/[A-Za-z]+/g)||[];for(const x of ls){if(x.length>2||/[A-Z]/.test(x)||TSTOP.has(x))return null;}
  if(!/[a-z0-9]/.test(c))return null;return "m";}
function tQual(ts){return ts.some(t=>LXC.test(t)||TOP.has(t)||/[\^²³\/=+−]/.test(t)||/\d[a-z]/.test(t)||/^\(?[a-z]{1,2}\)?[.,;]?$/.test(t)&&!TSTOP.has(t.replace(/[().,;]/g,"")));}
function tBal(s){let d=0;for(const ch of s){if(ch==="(")d++;else if(ch===")"){d--;if(d<0)return false;}}return d===0;}
function tFrac(s){let k;let guard=0;
  while((k=s.search(/\s?\/\s?/))>=0&&guard++<20){const m=s.slice(k).match(/^\s?\/\s?/)[0];
    let i=k-1;const isA=ch=>/[A-Za-z0-9^{}\\]/.test(ch);let groups=0;
    while(i>=0){if(s[i]===")"){let d=0,j=i;for(;j>=0;j--){if(s[j]===")")d++;else if(s[j]==="("){d--;if(!d)break;}}i=j-1;groups++;}else if(isA(s[i]))i--;else break;}
    let L=s.slice(i+1,k);let r=k+m.length,R;
    let e=r;let rg=0;while(e<s.length){if(s[e]==="("){let d=0,j=e;for(;j<s.length;j++){if(s[j]==="(")d++;else if(s[j]===")"){d--;if(!d)break;}}e=j+1;rg++;}else if(isA(s[e]))e++;else break;}
    R=s.slice(r,e);const strip=x=>/^\(.*\)$/.test(x)&&tBal(x.slice(1,-1))?x.slice(1,-1):x;
    s=s.slice(0,i+1)+`\\dfrac{${strip(L)}}{${strip(R)}}`+s.slice(e);}
  return s;}
function tLatex(r){let s=r.replace(/−/g,"-").replace(/·/g,"\\cdot ").replace(/×/g,"\\times ").replace(/≠/g,"\\neq ").replace(/±/g,"\\pm ").replace(/≤/g,"\\le ").replace(/≥/g,"\\ge ").replace(/²/g,"^2").replace(/³/g,"^3").replace(/\^(\d\d+)/g,"^{$1}");
  return tFrac(s).replace(/\s+/g," ").trim();}
function tex(str){if(str==null)return str;return String(str).split(/(\$[^$]+\$)/).map(seg=>{if(/^\$[^$]+\$$/.test(seg))return seg;
  return seg.split("\n").map(line=>{const tk=line.split(/( +)/);const out=[];let run=[];
    const flush=()=>{if(!run.length)return;let ws=run.filter(x=>!/^ +$/.test(x));
      // trim non-math end punctuation
      let txt=run.join("");let tail="";const mm=txt.match(/[.,;:]+$/);if(mm){tail=mm[0];txt=txt.slice(0,-tail.length);}
      let lead=txt.match(/^ */)[0],trl=txt.match(/ *$/)[0];txt=txt.trim();
      if(txt&&tQual(ws)&&tBal(txt))out.push(lead+"$"+tLatex(txt)+"$"+trl+tail);else out.push(run.join(""));run=[];};
    tk.forEach(t=>{if(/^ +$/.test(t)){if(run.length)run.push(t);else out.push(t);return;}if(tTok(t)){run.push(t);if(/[.,;]$/.test(t))flush();}else{flush();out.push(t);}});flush();
    return out.join("");}).join("\n");}).join("");}
// formula bloki: tayyor LaTeX ($ siz, \buyruqlar bilan) o'zgarmaydi; aks holda matn bo'laklari \text{} ga, matematika — LaTeX'ga
const tFormula=v=>{if(!String(v).includes("$")&&LXC.test(v))return unText(String(v)).trim();const t=tex(v);if(/^\$[^$]+\$$/.test(t.trim()))return t.trim().slice(1,-1);if(!t.includes("$"))return t;return t.split(/(\$[^$]+\$)/).filter(x=>x!=="").map(x=>/^\$/.test(x)?x.slice(1,-1):/^[\s,;]+$/.test(x)?",\\quad ":`\\text{${x}}`).join("");};
// \text{…} ichida qolib ketgan buyruqlar (\text{ \frac{1}{2} }) matn rejimida xato beradi — ichi formulaga chiqariladi (eski saqlangan formulalar ham)
const unText=t=>String(t).replace(/\\text\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g,(m,x)=>LXC.test(x)?` ${x} `:m);
const km=t=>{t=unText(t);if(typeof katex==="undefined")return esc(t);try{return katex.renderToString(t,{throwOnError:false});}catch(e){return esc(t);}};
const fx=s=>String(s??"").split(/(\$[^$]+\$)/).map(x=>/^\$[^$]+\$$/.test(x)?km(x.slice(1,-1)):esc(x).replace(/\^(\d+)/g,"<sup>$1</sup>")).join("");
const fF=v=>String(v).includes("$")?fx(v):km("\\displaystyle "+v);
const tPlain=x=>unText(x).replace(/\$/g,"").replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g,"($1)/($2)").replace(/\\cdot\s?/g,"· ").replace(/\\neq\s?/g,"≠ ").replace(/\\pm\s?/g,"±").replace(/\\times\s?/g,"× ").replace(/\\quad/g," ").replace(/\\text\{([^}]*)\}/g,"$1").replace(/\\[,;! ]/g," ").replace(/\^\{?(\d+)\}?/g,(m,d)=>[...d].map(c=>"⁰¹²³⁴⁵⁶⁷⁸⁹"[c]).join("")).replace(/ - /g," − ").replace(/\(-/g,"(−");
function texPlan(p){p.g=p.g.map(tex);p.res=tex(p.res);p.st.forEach(x=>{x.t=tex(x.t);x.s=tex(x.s);x.nm=tex(x.nm);x.q=tex(x.q);x.mq=tex(x.mq);});p.tasks.forEach(t=>{t.q=tex(t.q);t.a=tex(t.a);});
  p.mat.forEach(b=>{if(b.k==="f")b.v=tFormula(b.v);else if(b.k==="g"||b.k==="ex"||b.k==="n")b.v=tex(b.v);if(b.cap)b.cap=tex(b.cap);});Object.keys(p.hwx).forEach(k=>p.hwx[k]=tex(p.hwx[k]));
  p.game.hy.forEach(x=>x.b=tex(x.b));p.game.bb.forEach(x=>{x.q=tex(x.q);x.a=tex(x.a);});p.game.sk=p.game.sk.map(tex);p.xul=tex(p.xul);return p;}
function figSvg(k){
  const T=(x,y,t,c="")=>`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle"${c?` class="${c}"`:""}>${fx(t).replace(/<sup>(\d+)<\/sup>/g,'<tspan dy="-6" font-size="11">$1</tspan><tspan dy="6"></tspan>')}</text>`;
  if(k==="sq")return `<svg viewBox="-24 -26 252 252" width="240"><rect class="f1 rc" x="0" y="0" width="130" height="130"/><rect class="f2 rc" x="130" y="0" width="70" height="130"/><rect class="f2 rc" x="0" y="130" width="130" height="70"/><rect class="f3 rc" x="130" y="130" width="70" height="70"/>${T(65,65,"a^2")}${T(165,65,"ab")}${T(65,165,"ab")}${T(165,165,"b^2")}${T(65,-13,"a","s")}${T(165,-13,"b","s")}${T(-12,65,"a","s")}${T(-12,165,"b","s")}</svg>`;
  if(k==="sqm")return `<svg viewBox="-24 -26 252 252" width="240"><rect class="f2 rc" x="0" y="0" width="200" height="200"/><rect class="f1 rc" x="0" y="0" width="140" height="140"/><rect class="f3 rc" x="140" y="140" width="60" height="60"/>${T(70,70,"(a − b)^2")}${T(170,70,"b(a − b)","s")}${T(70,170,"b(a − b)","s")}${T(170,170,"b^2")}${T(100,-13,"a","s")}${T(-12,70,"a − b","s")}${T(-12,170,"b","s")}</svg>`;
  if(k==="diff")return `<svg viewBox="-20 -24 480 230" width="440"><rect class="f1 rc" x="0" y="0" width="160" height="160"/><rect class="f3 rc" x="100" y="100" width="60" height="60" stroke-dasharray="5 4"/>${T(80,-12,"a","s")}${T(130,130,"b^2")}${T(50,50,"a^2 − b^2","s")}<path class="st" d="M185 80 h40 m-10 -8 l10 8 l-10 8"/><rect class="f1 rc" x="245" y="55" width="210" height="100"/><line class="rc" x1="405" y1="55" x2="405" y2="155" stroke-dasharray="5 4"/>${T(350,105,"(a + b)(a − b)")}${T(350,42,"a + b","s")}${T(445,170,"","s")}<text x="465" y="105" class="s" text-anchor="start" dominant-baseline="middle"></text>${T(232,105,"a − b","s")}</svg>`;
  if(k==="area")return `<svg viewBox="-24 -26 300 130" width="300"><rect class="f1 rc" x="0" y="0" width="130" height="80"/><rect class="f2 rc" x="130" y="0" width="130" height="80"/>${T(65,40,"6x")}${T(195,40,"9y")}${T(65,-13,"2x","s")}${T(195,-13,"3y","s")}${T(-12,40,"3","s")}</svg>`;
  if(k==="group")return `<div class="gflow"><div class="r"><span class="g g1">ax + ay</span>+<span class="g g2">bx + by</span></div><span class="ar">↓ har guruhdan umumiy ko'paytuvchi</span><div class="r"><span class="g g1">a(x + y)</span>+<span class="g g2">b(x + y)</span></div><span class="ar">↓ (x + y) — umumiy qavs</span><div class="r"><span class="g g3">(x + y)(a + b)</span></div></div>`;
  return "";
}
function matFor(l){const m=MAT[l.tk];if(!m)return [];const B=[{k:"g",v:m.g}];m.f.forEach(f=>B.push({k:"f",v:f}));if(m.fig)B.push({k:"fig",v:m.fig,cap:m.cap});B.push({k:"ex",v:m.ex.join("\n")});B.push({k:"n",v:m.n});return B.map(b=>({...b,show:true}));}
function hwxFor(l){const m=String(l.hw).match(/(\d{3})\s*[–-]\s*(\d{3})/),n=String(l.hw).match(/\d{3}/g)||[],mm=MAT[l.tk];
  if(l.kind==="bsb"||l.kind==="chsb")return {A:"",B:"",C:"",ij:""};
  const a=m?[+m[1],+m[2]]:n.length?[+n[0],+n[n.length-1]]:null;
  return a?{A:`№ ${a[0]}, ${a[0]+1}`,B:`№ ${a[1]-1}`,C:`№ ${a[1]}*`,ij:mm?mm.ij:"Mavzuga oid 2 ta misol tuzib, javobini yozing."}:{A:"",B:"",C:"",ij:""};}
const SC=["--s1","--s2","--s3","--s4","--s5","--s6","--s7"];

/* ── yordamchilar ── */
const I=(n,c="")=>`<i class="bi bi-${n}${c?" "+c:""}" aria-hidden="true"></i>`;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dd=s=>new Date(s+"T00:00:00");
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fL=s=>{const d=dd(s);return `${d.getDate()}-${MG[d.getMonth()]}, ${WDN[d.getDay()]}`;};
const fS=s=>{const d=dd(s);return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;};
const kindOf=t=>/^BSB/.test(t)?"bsb":/^CHSB/.test(t)?"chsb":/^Takrorlash/.test(t)?"rev":/^Xatolar/.test(t)?"err":null;
const ini=n=>String(n).trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2);
const short=n=>{const [f,s]=String(n).trim().split(/\s+/);return s?`${s} ${f[0]}.`:f;};
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;

/* ── ilova bilan bog'lanish ── */
let TODAY="";   // page() da yangilanadi (asosiy skript bu fayldan keyin ulanadi)
const onPage=()=>typeof S!=="undefined"&&S.page==="journal"&&S.jpage==="ish";
const SUBJ=()=>(st.c&&st.c.subject)||"Fan";
const isMath=()=>/matem|algebr|geometr|математ|алгебр|геометр/i.test(SUBJ());
const GRADE=()=>{const m=String(st.c?st.c.name:"").match(/\d+/);return m?m[0]:"";};
const QL=()=>st.q?`${st.q}-chorak`:"o'quv yili";
const NS=()=>st.c?st.c.students.length:0;
const devOf=r=>(r.clientWidth||innerWidth)<720?"tel":"pc";
const norm=s=>String(s||"").toLowerCase().replace(/[ʻʼ‘’`´]/g,"'").replace(/\s+/g," ").trim();
let LIBN=null;
const libKey=t=>{if(!LIBN){LIBN={};[...Object.keys(MAT),...Object.keys(FAM),...Object.keys(TASKS)].forEach(k=>LIBN[norm(k)]=k);}return LIBN[norm(t)]||t;};
const ABS=["s","dq","k","ch","ox"];
// tanlangan chorakdagi darslar: jurnal sanasi + mavzusi (KTR rejadan yoki qo'lda); mavzusiz dars ro'yxatga kirmaydi
function lessonsOf(c,q){
  const rg=q?qRange(q):null,out=[],seen={};
  c.dates.filter(d=>!isNoLesson(c,d)&&(!rg||(rg[0]<=d&&d<=rg[1]))).sort().forEach(d=>{
    const le=c.lessons[d],tp=String((le&&le.topic)||"").trim();if(!tp)return;
    const m=tp.match(/^(.*\S)\s*\((\d+)\/(\d+)\)$/),t=m?m[1]:tp,k=m?+m[2]:1,h=m?Math.max(+m[3],1):1;
    const w=workOfTopic(t),kind=w&&(w[0]==="bsb"||w[0]==="chsb")?w[0]:/^takrorlash/i.test(t)?"rev":/^xatolar/i.test(t)?"err":null;
    const base=`${q||0}|${t}|${k}`;seen[base]=(seen[base]||0)+1;
    out.push({d,t,k,h,n:out.length+1,hw:(le&&le.hw)||"",kind,tk:libKey(t),key:`${base}|${seen[base]}`});
  });
  return out;
}
// o'quvchilar: g — shu chorakdagi baholar soni, ab — oxirgi o'tgan darsda kelmagan
function students(){
  const c=st.c;if(!c)return [];
  const rg=st.q?qRange(st.q):null,inQ=d=>!rg||(rg[0]<=d&&d<=rg[1]);
  const held=c.dates.filter(d=>d<=TODAY&&inQ(d)&&!isNoLesson(c,d)),last=held[held.length-1];
  return c.students.map((s,i)=>({i,nm:s.name,g:Object.entries(s.marks||{}).filter(([d,m])=>inQ(d)&&gradesOf(m).length).length,ab:!!last&&["s","dq","k"].includes(attPart((s.marks||{})[last]||""))}));
}
function afterLesson(l){
  const c=st.c,ms=c.students.map(s=>(s.marks||{})[l.d]||""),att=c.att_ok.includes(l.d)||ms.some(Boolean);
  const gs=ms.flatMap(m=>gradesOf(m));
  return {att,came:ms.filter(m=>!ABS.includes(attPart(m))).length,gr:ms.filter(m=>gradesOf(m).length).length,avg:gs.length?gs.reduce((a,b)=>a+b,0)/gs.length:0};
}
const addD=(s,n)=>{const d=dd(s);d.setDate(d.getDate()+n);return iso(d);};
const wkFrom=w=>addD(TODAY,-((dd(TODAY).getDay()+6)%7)+7*w);
const wkTo=w=>addD(wkFrom(w),6);
const qEnd=()=>{const r=st.q&&qRange(st.q);return r?r[1]:L.length?L[L.length-1].d:TODAY;};
const weekIdx=()=>L.map((l,i)=>i).filter(i=>L[i].d>=wkFrom(0)&&L[i].d<=wkTo(0)&&st.plans[i]);
function setHw(l,v){const c=st.c,le=c.lessons[l.d];if(!le)return;le.hw=v;st.dirty=true;}

/* ── saqlash: c.ish ── */
const SETS=["komp","met","jih","shakl"];
function ser(p){
  const o=JSON.parse(JSON.stringify(p,(k,v)=>v instanceof Set?[...v]:v));
  const S2=st.c?st.c.students:[];o.ask=Array.isArray(p.ask)?p.ask.map(i=>S2[i]&&S2[i].name).filter(Boolean):null;
  return o;
}
function hyd(o){
  const p=JSON.parse(JSON.stringify(o||{}));
  SETS.forEach(k=>p[k]=new Set(Array.isArray(p[k])?p[k]:[]));
  const nm=st.c?st.c.students.map(s=>s.name):[];
  p.ask=Array.isArray(p.ask)?p.ask.map(n=>nm.indexOf(n)).filter(i=>i>=0):null;
  p.g=Array.isArray(p.g)?p.g:["","",""];p.st=Array.isArray(p.st)?p.st:[];p.tasks=Array.isArray(p.tasks)?p.tasks:[];p.mat=Array.isArray(p.mat)?p.mat:[];
  p.hwx=Object.assign({A:"",B:"",C:"",ij:""},p.hwx);p.game=Object.assign({hy:[],bb:[],kl:[],sk:[]},p.game);p.mezon=Array.isArray(p.mezon)?p.mezon:[];
  ["type","res","fan","tex","xul","note"].forEach(k=>{if(typeof p[k]!=="string")p[k]="";});
  p.st.forEach(s=>["n","t","s","mq","nm","q","gm"].forEach(k=>{if(typeof s[k]!=="string")s[k]="";}));
  return p;
}
let pT=null;
function persist(){
  clearTimeout(pT);pT=null;const c=st.c;if(!c||!D.classes.includes(c))return;
  let ch=!!st.dirty;st.dirty=false;
  L.forEach((l,i)=>{const p=st.plans[i],old=c.ish&&c.ish[l.key];
    if(p){const s=ser(p);if(JSON.stringify(s)!==JSON.stringify(old)){(c.ish=c.ish||{})[l.key]=s;ch=true;}}
    else if(old){delete c.ish[l.key];ch=true;}});
  const w=JSON.parse(JSON.stringify({...(D.web.ish||{}),cover:st.cover,paper:st.paper,gen:st.gen}));
  if(JSON.stringify(w)!==JSON.stringify(D.web.ish||{})){D.web.ish=w;ch=true;}
  if(ch)save();
}
const later=()=>{clearTimeout(pT);pT=setTimeout(persist,500);};
function cfg(){const w=D.web.ish||{};Object.assign(st.cover,w.cover||{});Object.assign(st.paper,w.paper||{});if(w.paper&&w.paper.style==="ras"&&!w.paper.ff)st.paper.ff="ras";   // eski «Rasmiy (Times)» uslubi → shrift to'plami
  if(w.gen)st.gen=w.gen;}

/* ── shablon: dars turi bo'yicha bosqichlar, metod, jihoz, shakl, mezonlar (D.web.ish.tpl) ── */
const tplOf=ty=>((D.web.ish||{}).tpl||{})[ty]||null;
function tplApply(p){
  const t=tplOf(p.type);if(!t)return p;
  if(Array.isArray(t.st)&&t.st.length)p.st=t.st.map(x=>{const g=p.st.find(y=>y.n===x.n);return g?{...g,m:x.m,mq:x.mq||g.mq}:{n:x.n,m:x.m,t:"",s:"",mq:x.mq||"",nm:"",q:"",gm:x.gm||"",open:false};});
  if(t.met)p.met=new Set(t.met);if(t.jih)p.jih=new Set(t.jih);if(t.shakl)p.shakl=new Set(t.shakl);if(t.mezon)p.mezon=t.mezon.map(x=>[...x]);if(t.tex)p.tex=t.tex;
  return p;
}

/* ── darslar yo'q ── */
function noLessons(){
  const qs=[1,2,3,4].filter(q=>qRange(q));
  return `<main class="ismain">${headerBase()}
  ${qs.length?`<div class="qch">${qs.map(q=>`<button class="chip${st.q===q?" on":""}" data-a="qq" data-v="${q}">${q}-chorak</button>`).join("")}</div>`:""}
  <div class="card nolsn"><span class="tag">${I("card-text")} Mavzular</span>
    <div class="topic">${st.q?`${st.q}-chorakda`:"Jurnalda"} mavzusi yozilgan dars yo'q</div>
    <p class="muted" style="margin:0">Ishlanma har dars mavzusi uchun tuziladi. Mavzular kalendar-tematik rejadan (KTR) dars kunlariga o'zi tushadi yoki jurnalda har dars uchun yoziladi.</p>
    <div class="row">${typeof KTR!=="undefined"?`<button class="btn pri" data-a="ktr">${I("calendar3")} KTR'ni ochish</button>`:""}<button class="btn" data-a="back">${I("arrow-left")} Jurnalga qaytish</button></div></div></main>`;
}
function headerBase(){
  return `<div class="hd"><button class="ib" data-a="back" aria-label="Jurnalga qaytish">${I("arrow-left")}</button><div class="ht"><span class="eyebrow">${I("journal-text")} Dars ishlanma</span>
    <h1>${cls()}${st.c&&st.c.subject?` · ${esc(SUBJ())}`:""}</h1><div class="meta"><span>${I("people")} ${NS()} o'quvchi</span></div></div></div>`;
}
const qChips=()=>{const qs=[1,2,3,4].filter(q=>qRange(q));return qs.length>1?`<div class="fl qch">${qs.map(q=>`<button class="chip${st.q===q?" on":""}" data-a="qq" data-v="${q}">${q}-ch</button>`).join("")}</div>`:"";};

let L=[];
const nextIdx=()=>L.findIndex(l=>l.d>=TODAY);

/* ── avtomatik to'ldirish ── */
function typeOf(l){if(l.kind==="bsb"||l.kind==="chsb")return "Nazorat";if(l.kind==="rev")return "Takrorlash";if(l.kind==="err")return "Xatolar ustida ishlash";return l.h>1?(l.k===1?"Yangi bilim beruvchi":"Mustahkamlash"):"Aralash";}
function build(i){const x=tplApply(build0(i));const y=genLevel(x,i,st.gen||"bat");return isMath()?texPlan(y):y;}
function build0(i){
  const l=L[i],p=L[i-1],ty=typeOf(l),T=`«${l.t}»`,prevHw=p&&p.hw?p.hw:"oldingi dars vazifasi",prevT=p?`«${p.t}»`:"o'tilgan";
  const hw=l.hw||"—";
  const G={
    "Yangi bilim beruvchi":[`O'quvchilarga ${T} mavzusi bo'yicha tushuncha berish, qoidani misollarda qo'llashni o'rgatish.`,`Darsda aniqlik, mas'uliyat, bir-birini tinglash va jamoada ishlash madaniyatini tarbiyalash.`,`Mantiqiy fikrlash, taqqoslash, xulosa chiqarish va ${isMath()?"matematik":"og'zaki"} nutqni rivojlantirish.`,`O'quvchi ${T} qoidasini aytib bera oladi va 3–4 ta oddiy misolda qo'llaydi.`],
    "Mustahkamlash":[`${T} mavzusi bo'yicha olingan bilimlarni mustahkamlash, murakkabroq misollarni mustaqil yechish ko'nikmasini shakllantirish.`,`Mustaqillik, o'z ishini tekshirish odati va o'rtog'iga yordam berishni tarbiyalash.`,`Tahlil qilish, usulni to'g'ri tanlash va xatoni topish ko'nikmasini rivojlantirish.`,`O'quvchi ${T} usulini turli ko'rinishdagi misollarda xatosiz qo'llaydi.`],
    "Aralash":[`${T} mavzusini o'rgatish va oldingi mavzu bilan bog'lab mustahkamlash.`,`Aniqlik, mehnatsevarlik va jamoada ishlashni tarbiyalash.`,`Mantiqiy fikrlash va hisoblash tezligini rivojlantirish.`,`O'quvchi ${T} bo'yicha misollarni mustaqil yechadi.`],
    "Takrorlash":[`Chorak davomida o'tilgan mavzularni takrorlash, bilimlardagi bo'shliqlarni aniqlash va to'ldirish.`,`O'z bilimiga mas'uliyat bilan qarash, guruhda hamkorlikni tarbiyalash.`,`Bilimlarni tizimlashtirish, umumlashtirish va xulosa chiqarishni rivojlantirish.`,`O'quvchi CHSBga tayyor: asosiy formulalarni biladi va qo'llaydi.`],
    "Nazorat":[`${T} orqali o'quvchilarning bilim darajasini aniqlash va baholash.`,`Halollik, mustaqillik va vaqtni to'g'ri taqsimlashni tarbiyalash.`,`Bilimni mustaqil qo'llash va o'zini nazorat qilish ko'nikmasini rivojlantirish.`,`Har bir o'quvchi topshiriqlarni mustaqil bajaradi, natija ball bilan baholanadi.`],
    "Xatolar ustida ishlash":[`Nazorat ishida yo'l qo'yilgan xatolarni tahlil qilish va bartaraf etish.`,`O'z xatosini tan olish va tuzatishga intilishni tarbiyalash.`,`Tahlil qilish, sabab-oqibatni topish va o'z-o'zini tekshirishni rivojlantirish.`,`O'quvchi o'z xatosini topadi va shu turdagi misolni to'g'ri yechadi.`]
  }[ty];
  const S={
    "Yangi bilim beruvchi":[["Tashkiliy qism",2,"Salomlashish, davomatni aniqlash, dars maqsadini e'lon qilish.","Darsga tayyorlanadi, maqsad bilan tanishadi."],["Uy vazifasini tekshirish",8,`«${prevHw}» vazifasini tekshirish; ${prevT} bo'yicha aqliy hujum savollari.`,"Vazifasini ko'rsatadi, savollarga javob beradi."],["Yangi mavzu bayoni",15,`${T}: ta'rif va qoida, doskada 3 ta namunaviy misol, klaster tuzish.`,"Tinglaydi, qoida va misollarni daftarga yozadi, savol beradi."],["Mustahkamlash",12,"Darslikdagi misollarni juftlikda yechishni tashkil etish, kuzatib yordam berish.","Juftlikda misol yechadi, doskada yechimini tushuntiradi."],["Baholash",5,"Faol o'quvchilarni rag'batlantirish, baholarni e'lon qilish va jurnalga qo'yish.","O'z ishini baholaydi, darsdan xulosa qiladi."],["Uyga vazifa",3,`Uyga vazifa: ${hw}. Bajarish yo'lini tushuntirish.`,"Vazifani kundaligiga yozib oladi."]],
    "Mustahkamlash":[["Tashkiliy qism",2,"Salomlashish, davomatni aniqlash, dars maqsadini e'lon qilish.","Darsga tayyorlanadi."],["Uy vazifasini tekshirish",8,`«${prevHw}» vazifasini tekshirish, qiyin misolni doskada yechdirish.`,"Vazifasini ko'rsatadi, doskada yechadi."],["O'tilganni takrorlash",7,`${T} qoidasini «Zinama-zina» usulida takrorlash.`,"Qoidani aytadi, misol keltiradi."],["Amaliy mashg'ulot",18,"Sinfni 4 guruhga bo'lib, har guruhga darajali topshiriq kartochkasi berish.","Guruhda misol yechadi, javobni himoya qiladi."],["Baholash",5,"Guruhlar natijasini e'lon qilish, baholarni jurnalga qo'yish.","Boshqa guruh ishini baholaydi."],["Uyga vazifa",5,`Uyga vazifa: ${hw}. Qiyin misolga ko'rsatma berish.`,"Vazifani yozib oladi."]],
    "Aralash":[["Tashkiliy qism",2,"Salomlashish, davomatni aniqlash.","Darsga tayyorlanadi."],["Uy vazifasini tekshirish",7,`«${prevHw}» vazifasini tekshirish.`,"Vazifasini ko'rsatadi."],["Yangi mavzu bayoni",14,`${T}: qoida va namunaviy misollar.`,"Tinglaydi, daftarga yozadi."],["Mustahkamlash",14,"Misollarni mustaqil yechish, doskada tekshirish.","Mustaqil misol yechadi."],["Baholash",5,"Baholarni e'lon qilish va jurnalga qo'yish.","O'z ishini baholaydi."],["Uyga vazifa",3,`Uyga vazifa: ${hw}.`,"Vazifani yozib oladi."]],
    "Takrorlash":[["Tashkiliy qism",2,"Salomlashish, davomatni aniqlash, CHSB haqida ma'lumot berish.","Darsga tayyorlanadi."],["Savol-javob",10,"Chorak mavzulari bo'yicha savol-javob, formulalar klasteri.","Savollarga javob beradi, formulalarni yozadi."],["Misollar yechish",20,"Guruhlarda har mavzudan bittadan misol yechdirish.","Guruhda misol yechadi, javobni tushuntiradi."],["Test",8,"5 savollik qisqa test o'tkazish.","Testni bajaradi, javoblarni tekshiradi."],["Baholash",3,"Natijalarni e'lon qilish.","O'zini baholaydi."],["Uyga vazifa",2,`Uyga vazifa: ${hw}.`,"Vazifani yozib oladi."]],
    "Nazorat":[["Tashkiliy qism",2,"Salomlashish, davomatni aniqlash, partalarni tayyorlash.","Darsga tayyorlanadi."],["Yo'riqnoma",3,"Topshiriqlar, vaqt va baholash mezonini tushuntirish.","Yo'riqnomani tinglaydi."],["Nazorat ishini bajarish",35,`${T} variantlarini tarqatish, mustaqillikni kuzatish.`,"Topshiriqlarni mustaqil bajaradi."],["Ishlarni yig'ish",3,"Ishlarni yig'ish, keyingi dars tartibini aytish.","Ishini topshiradi."],["Uyga vazifa",2,l.hw?`Uyga vazifa: ${hw}.`:"Uyga vazifa berilmaydi.","—"]],
    "Xatolar ustida ishlash":[["Tashkiliy qism",2,"Salomlashish, davomatni aniqlash.","Darsga tayyorlanadi."],["Natijalar tahlili",8,"CHSB natijalari: ballar taqsimoti, eng ko'p xato qilingan topshiriqlar.","Natijasi bilan tanishadi."],["Xatolarni tahlil qilish",20,"Ko'p uchragan 3 ta xatoni doskada yechib ko'rsatish.","Xatosini topadi va daftarda to'g'rilaydi."],["Mustaqil ish",10,"Shu turdagi 3 ta misolni mustaqil yechdirish.","Mustaqil yechadi."],["Baholash",3,"Ishlarni baholash.","O'zini baholaydi."],["Uyga vazifa",2,`Uyga vazifa: ${hw}.`,"Vazifani yozib oladi."]]
  }[ty];
  const met={"Yangi bilim beruvchi":["Aqliy hujum","Klaster","Juftlikda ishlash"],"Mustahkamlash":["Zinama-zina","Kichik guruhlarda ishlash","Savol-javob"],"Aralash":["Savol-javob","Mustaqil ish"],"Takrorlash":["Klaster","Kichik guruhlarda ishlash","Test"],"Nazorat":["Mustaqil ish"],"Xatolar ustida ishlash":["Muammoli vaziyat","Mustaqil ish"]}[ty];
  const jih=ty==="Nazorat"?["Tarqatma materiallar"]:ty==="Mustahkamlash"?["Darslik","Doska","Kartochkalar"]:["Darslik","Doska","Proyektor / taqdimot"];
  const XS=stageX(l,p,ty);
  const S2=S.map(([n,m,t,s])=>{const x=XS(n);return [x.n||n,m,[t,...(x.t||[])].join("\n"),[s,...(x.s||[])].join("\n"),x];});
  return {type:ty,g:G.slice(0,3),res:[G[3],"Mavzuga oid misollarni mustaqil yechadi.",isMath()?"Javobini asoslab, to'g'ri matematik tilda tushuntiradi.":"Javobini asoslab, o'z fikrini aniq va to'liq tushuntiradi."].join("\n"),komp:new Set(["Axborot bilan ishlash","O'zini o'zi rivojlantirish",isMath()?"Matematik savodxonlik":"Kommunikativ"]),met:new Set(met),jih:new Set(jih),fan:isMath()?"Geometriya, fizika":"",
    st:S2.map(([n,m,t,s,x])=>({n,m,t,s,mq:x.mq||"",nm:x.nm||"",q:(x.q||[]).join("\n"),gm:x.gm||"",open:false})),
    shakl:new Set(ty==="Mustahkamlash"||ty==="Takrorlash"?["Jamoaviy","Guruhli","Individual"]:["Jamoaviy","Juftlik","Individual"]),tex:"Proyektor, kompyuter, slaydlar",
    game:{hy:hayoqFor(l),bb:beshFor(l),kl:klFor(l),sk:skFor(l)},mezon:[["Savollarga to'g'ri javob berish",4],["Topshiriqni to'g'ri bajarish",4],["Faollik, misol keltirish va xulosa",2]],
    xul:MAT[l.tk]?`Bugun «${l.t}» mavzusini o'rgandik. ${MAT[l.tk].g.split(". ")[0].replace(/\.$/,"")}.`:`Bugun «${l.t}» mavzusi bo'yicha bilimlarimizni mustahkamladik va misollarda qo'lladik.`,ask:null,ready:false,note:"",tasks:tasksFor(l),mat:matFor(l),hwx:hwxFor(l)};
}

/* ── v7: batafsil generatsiya (qoidaga asoslangan, internet/SI kerak emas) ── */
const FAM={"Umumiy ko'paytuvchini qavsdan tashqariga chiqarish":"qavs","Guruhlash usuli":"guruh","Yig'indi kvadrati":"yk","Ayirma kvadrati":"ak","Kvadratlar ayirmasi":"kva","Kublar yig'indisi va ayirmasi":"kub","Ko'phadni ko'paytuvchilarga ajratish":"aj","Algebraik kasrlar":"kas","Algebraik kasrlarni qisqartirish":"kas"};
const FAMT=Object.fromEntries(Object.entries(FAM).map(([t,f])=>[f,t]));
const HOOK={qavs:"Do'kondan 6 ta daftar x so'mdan va 9 ta ruchka y so'mdan oldingiz. Umumiy narxni qisqaroq yozish mumkinmi?",guruh:"Ba'zan ko'phadning hamma hadida umumiy ko'paytuvchi bo'lmaydi. Unda nima qilamiz?",yk:"21^2 ni kalkulyatorsiz 10 soniyada hisoblay olasizmi? Bugun shu sirni o'rganamiz.",ak:"99^2 = ? Kalkulyatorsiz, 5 soniyada!",kva:"51 · 49 ni og'zaki hisoblang. Bugungi formula bilan bu 2 soniyalik ish.",kub:"Qirrasi a va b bo'lgan ikki kub hajmlari farqini ko'paytma ko'rinishida yozish mumkinmi?",aj:"3x^3 − 12x ni bir urinishda ajrata olasizmi? Bugun usullarni zanjir qilib ishlatamiz.",kas:"6/9 kasrni qisqartirishni bilamiz. Harfli kasrni-chi?"};
const cf=(n,v)=>n===1?v:n+v;
function rng(i){let x=(i*7919+17)%2147483647||5;return (a,b)=>{x=(x*16807)%2147483647;return a+Math.floor(x/2147483647*(b-a+1));};}
const CP=[[1,2],[2,3],[3,4],[2,5],[3,5],[1,3],[4,5],[1,4]],CP2=[[2,3],[3,2],[3,4],[2,5],[3,5],[4,3],[5,2],[4,5],[5,3],[2,1],[3,1]];
function fgen(f,lv,r){const pr=CP[r(0,CP.length-1)],[a,b]=pr,[c2,d2]=CP2[r(0,CP2.length-1)],k=r(2,6),p=r(2,7);let q=p+r(1,3);
  switch(f){
  case "qavs":return lv==="A"?{q:`${k*a}x + ${k*b}y`,a:`${k}(${cf(a,"x")} + ${cf(b,"y")})`,st:[`$\\text{EKUB}(${k*a};\\ ${k*b}) = ${k}$`,`= ${k}(${cf(a,"x")} + ${cf(b,"y")})`]}
    :lv==="B"?{q:`${k*a}x^3 − ${k*b}x^2`,a:`${k}x^2(${cf(a,"x")} − ${b})`,st:[`$\\text{EKUB}(${k*a};\\ ${k*b}) = ${k}$, $x$ ning eng kichik darajasi — $x^2$`,`= ${k}x^2(${cf(a,"x")} − ${b})`]}
    :{q:`a(x − ${p}) + b(${p} − x)`,a:`(x − ${p})(a − b)`,st:[`b(${p} − x) = −b(x − ${p})`,`= a(x − ${p}) − b(x − ${p})`,`= (x − ${p})(a − b)`]};
  case "guruh":return lv==="A"?{q:`ax + ${p}a + ${q}x + ${p*q}`,a:`(x + ${p})(a + ${q})`,st:[`= (ax + ${p}a) + (${q}x + ${p*q})`,`= a(x + ${p}) + ${q}(x + ${p})`,`= (x + ${p})(a + ${q})`]}
    :lv==="B"?{q:`x^3 − ${p}x^2 + ${q}x − ${p*q}`,a:`(x − ${p})(x^2 + ${q})`,st:[`= (x^3 − ${p}x^2) + (${q}x − ${p*q})`,`= x^2(x − ${p}) + ${q}(x − ${p})`,`= (x − ${p})(x^2 + ${q})`]}
    :{q:`x^2 + ${p+q}x + ${p*q}`,a:`(x + ${p})(x + ${q})`,st:[`${p+q}x = ${p}x + ${q}x`,`= (x^2 + ${p}x) + (${q}x + ${p*q})`,`= x(x + ${p}) + ${q}(x + ${p})`,`= (x + ${p})(x + ${q})`]};
  case "yk":case "ak":{const z=f==="yk"?"+":"−",n=r(2,9);return lv==="A"?{q:`(x ${z} ${p})^2`,a:`x^2 ${z} ${2*p}x + ${p*p}`,st:[`= x^2 ${z} 2 · x · ${p} + ${p}^2`,`= x^2 ${z} ${2*p}x + ${p*p}`]}
    :lv==="B"?{q:`(${cf(c2,"x")} ${z} ${cf(d2,"y")})^2`,a:`${c2*c2}x^2 ${z} ${2*c2*d2}xy + ${cf(d2*d2,"y^2")}`,st:[`= (${cf(c2,"x")})^2 ${z} 2 · ${cf(c2,"x")} · ${cf(d2,"y")} + (${cf(d2,"y")})^2`,`= ${c2*c2}x^2 ${z} ${2*c2*d2}xy + ${cf(d2*d2,"y^2")}`]}
    :f==="yk"?{q:`${10*n+1}^2 ni og'zaki hisoblang`,a:`${(10*n+1)**2}`,st:[`= (${10*n} + 1)^2`,`= ${100*n*n} + ${20*n} + 1`,`= ${(10*n+1)**2}`]}:{q:`${10*n-1}^2 ni og'zaki hisoblang`,a:`${(10*n-1)**2}`,st:[`= (${10*n} − 1)^2`,`= ${100*n*n} − ${20*n} + 1`,`= ${(10*n-1)**2}`]};}
  case "kva":{const m=r(1,9);return lv==="A"?{q:`x^2 − ${p*p}`,a:`(x − ${p})(x + ${p})`,st:[`= x^2 − ${p}^2`,`= (x − ${p})(x + ${p})`]}
    :lv==="B"?{q:`${c2*c2}x^2 − ${cf(d2*d2,"y^2")}`,a:`(${cf(c2,"x")} − ${cf(d2,"y")})(${cf(c2,"x")} + ${cf(d2,"y")})`,st:[`= (${cf(c2,"x")})^2 − (${cf(d2,"y")})^2`,`= (${cf(c2,"x")} − ${cf(d2,"y")})(${cf(c2,"x")} + ${cf(d2,"y")})`]}
    :{q:`${50+m} · ${50-m} ni og'zaki hisoblang`,a:`${2500-m*m}`,st:[`= (50 + ${m})(50 − ${m})`,`= 50^2 − ${m}^2`,`= 2500 − ${m*m} = ${2500-m*m}`]};}
  case "kub":{const c=r(2,5),d=r(2,4);return lv==="A"?{q:`x^3 − ${c**3}`,a:`(x − ${c})(x^2 + ${c}x + ${c*c})`,st:[`= x^3 − ${c}^3`,`= (x − ${c})(x^2 + x · ${c} + ${c}^2)`,`= (x − ${c})(x^2 + ${c}x + ${c*c})`]}
    :lv==="B"?{q:`${d**3}x^3 + 1`,a:`(${d}x + 1)(${d*d}x^2 − ${d}x + 1)`,st:[`= (${d}x)^3 + 1^3`,`= (${d}x + 1)((${d}x)^2 − ${d}x · 1 + 1^2)`,`= (${d}x + 1)(${d*d}x^2 − ${d}x + 1)`]}
    :{q:`m^3 + ${c**3}n^3`,a:`(m + ${c}n)(m^2 − ${c}mn + ${c*c}n^2)`,st:[`= m^3 + (${c}n)^3`,`= (m + ${c}n)(m^2 − m · ${c}n + (${c}n)^2)`,`= (m + ${c}n)(m^2 − ${c}mn + ${c*c}n^2)`]};}
  case "aj":{const c=r(2,3);return lv==="A"?{q:`${k}x^2 − ${k*p*p}`,a:`${k}(x − ${p})(x + ${p})`,st:[`= ${k}(x^2 − ${p*p})   (umumiy ko'paytuvchi)`,`= ${k}(x − ${p})(x + ${p})   (kvadratlar ayirmasi)`]}
    :lv==="B"?{q:`x^3 + ${2*p}x^2 + ${p*p}x`,a:`x(x + ${p})^2`,st:[`= x(x^2 + ${2*p}x + ${p*p})   (umumiy ko'paytuvchi)`,`= x(x + ${p})^2   (yig'indi kvadrati)`]}
    :{q:`x^4 − ${c**4}`,a:`(x − ${c})(x + ${c})(x^2 + ${c*c})`,st:[`= (x^2 − ${c*c})(x^2 + ${c*c})`,`= (x − ${c})(x + ${c})(x^2 + ${c*c})`]};}
  case "kas":return lv==="A"?{q:`(x^2 − ${p*p}) / (x − ${p})`,a:`x + ${p}, bunda x ≠ ${p}`,st:[`= (x − ${p})(x + ${p}) / (x − ${p})`,`= x + ${p}   (x ≠ ${p})`]}
    :lv==="B"?{q:`(${k}x + ${k*p}) / (x^2 − ${p*p})`,a:`${k} / (x − ${p})`,st:[`= ${k}(x + ${p}) / ((x − ${p})(x + ${p}))`,`= ${k} / (x − ${p}),   x ≠ ±${p}`]}
    :{q:`(x^2 + ${2*p}x + ${p*p}) / (x^2 − ${p*p})`,a:`(x + ${p}) / (x − ${p})`,st:[`= (x + ${p})^2 / ((x − ${p})(x + ${p}))`,`= (x + ${p}) / (x − ${p}),   x ≠ ±${p}`]};
  }}
const mut=a=>{const m=a.includes(" + ")?a.replace(" + "," − "):a.includes(" − ")?a.replace(" − "," + "):a+"0";return m;};
function famsBefore(i){const r=[];L.slice(0,i).forEach(l=>{const f=FAM[l.tk];if(f&&!r.includes(f))r.push(f);});return r;}
function genLevel(p,i,lvl){
  const l=L[i],f=FAM[l.tk],r=rng(i),pl=L[i-1],pf=pl?FAM[pl.tk]:null,M=MAT[l.tk],ty=p.type;
  if(lvl==="qisqa"){p.st.forEach((s,j)=>{s.t=lines(s.t)[0]||"";s.s=lines(s.s)[0]||"";s.q="";if(j)s.nm="";});p.res=lines(p.res)[0]||"";p.mat=p.mat.filter(b=>b.k==="g"||b.k==="f");p.tasks=p.tasks.slice(0,3);p.gen="qisqa";return p;}
  if(lvl!=="bat"){p.gen="orta";return p;}
  p.gen="bat";
  const fams=f?[f]:famsBefore(i);if(!fams.length)return p;
  const g1=(lv,ff=fams[0])=>fgen(ff,lv,r);
  // topshiriqlar
  if(f){const T=[],seen=new Set();["A","A","A","B","B","B","C","C"].forEach(lv=>{let t,k=0;do{t=g1(lv);k++;}while(seen.has(t.q)&&k<12);seen.add(t.q);T.push({lv,...t});});p.tasks=T.map(t=>({lv:t.lv,q:t.q,a:t.a}));
    const ex=[g1("B"),g1("C")];ex.forEach(e=>p.mat.splice(p.mat.findIndex(b=>b.k==="n")>=0?p.mat.findIndex(b=>b.k==="n"):p.mat.length,0,{k:"ex",v:[e.q,...e.st].join("\n"),show:true}));
    const hy=[];[g1("A"),g1("B"),g1("A"),g1("C")].forEach((t,k)=>{hy.push({b:`${t.q} = ${t.a}`.replace(" ni og'zaki hisoblang",""),a:"Ha"});const m=mut(t.a);if(m!==t.a)hy.push({b:`${t.q} = ${m}`.replace(" ni og'zaki hisoblang",""),a:"Yo'q"});});
    p.game.hy=[...p.game.hy.slice(0,3),...hy].slice(0,10);
  }else{const fs=fams.slice(-6);p.tasks=fs.map((ff,k)=>({lv:k<2?"A":k<4?"B":"C",...fgen(ff,k<2?"A":k<4?"B":"C",r)})).map(t=>({lv:t.lv,q:t.q,a:t.a}));}
  const T=p.tasks,TA=T.filter(t=>t.lv==="A"),TB=T.filter(t=>t.lv==="B"),TC=T.filter(t=>t.lv==="C"),ls=a=>a.map(t=>`${t.q} → ${t.a}`).join("; ");
  const pm=pf?MAT[pl.tk]:null,pq=pf?fgen(pf,"A",r):null,hook=HOOK[f]||(ty==="Takrorlash"?"Chorak nazoratiga tayyormisiz? Bugun chorakdagi barcha formulalarni bir darsda eslaymiz.":ty==="Xatolar ustida ishlash"?"Xato — eng yaxshi ustoz, agar uni tushunsak. Bugun xatolarimizni do'stga aylantiramiz.":"Bugun bilimingizni ko'rsatish kuni.");
  p.res=(f?[`«${l.t}» ta'rifini o'z so'zi bilan aytib beradi va formulasini yozadi.`,`${TA[0].q} kabi oddiy misollarni mustaqil yechadi (A daraja).`,`${TB[0].q} kabi murakkabroq misollarda formulani to'g'ri qo'llaydi (B daraja).`,`Javobini teskari amal bilan tekshiradi, ko'p uchraydigan xatoni topadi.`,`Formulaning geometrik yoki hayotiy ma'nosini tushuntiradi.`]:[`Chorak mavzularining asosiy formulalarini yozadi va qo'llaydi.`,`Har bir usuldan bittadan misolni mustaqil yechadi.`,`O'z xatosini topadi va to'g'rilaydi.`]).join("\n");
  const set=(re,o)=>{const s=p.st.find(x=>re.test(x.n));if(!s)return;const f0=lines(s.t)[0]||"";if(o.t)s.t=[f0,...o.t].join("\n");if(o.s)s.s=[lines(s.s)[0]||"",...o.s].join("\n");if(o.nm)s.nm=o.nm;if(o.q)s.q=o.q.join("\n");if(o.mq)s.mq=o.mq;};
  set(/^Tashkiliy/,{t:["(1 daq) Navbatchi axboroti, yo'qlama; partalar va daftarlarning tayyorligini tekshiradi.",`(1 daq) Motivatsiya: «${hook}»`,`Dars rejasini doskaga yozadi: ${p.st.slice(1).map((x,k)=>`${k+1}) ${x.n.toLowerCase()}`).join(", ")}.`],s:["Salomlashadi, navbatchi yo'q o'quvchilarni aytadi.","Motivatsion savol haqida o'ylaydi, taxminini aytadi.","Dars rejasini daftarga yozadi."],
    nm:ty==="Nazorat"?null:`Assalomu alaykum, aziz o'quvchilar! ${hook} Bugun «${l.t}» mavzusi orqali bunga javob topamiz. Darsimiz rejasi doskada.`});
  if(pq)set(/^Uy vazifasini/,{t:["(2 daq) Partama-parta yurib daftarlarni ko'zdan kechiradi, bajarmaganlarni belgilaydi.",`(3 daq) 2 o'quvchini doskaga chiqaradi: ${pq.q} misolini yechdiradi (javob: ${pq.a}).`,"(3 daq) Qolganlar bilan aqliy hujum savollari, javoblarga 0–2 ball qo'yadi."],s:["Daftarini ochib qo'yadi, xatosini qalam bilan belgilaydi.","Doskadagi yechimni kuzatadi, xato topsa aytadi.","Savollarga javob beradi."],
    q:[`«${pl.t}» qoidasini aytib bering → ${pm?pm.g.split(". ")[0]:"qoida"}`,pm?`Formulani yozing → ${pm.f[0]}`:"",`${pq.q} ni hisoblang → ${pq.a}`,`Qavslarni ochib qanday tekshiramiz? → ko'paytmani ochganda dastlabki ifoda chiqishi kerak`].filter(Boolean)});
  if(f&&M){const e1=g1("A");
    set(/bayon/i,{t:[`(2 daq) Muammoli savol: «${hook}» — o'quvchilar taxminini tinglaydi.`,`(3 daq) Ta'rif: ${M.g}`,`(2 daq) Formulani doskaga yozadi: ${M.f.join(";  ")}`,M.fig?`(2 daq) Chizma orqali tushuntiradi: ${M.cap}`:null,`(4 daq) Namunaviy misollarni bosqichma-bosqich yechadi: ${M.ex[0]}; ${T[3].q}; ${T[6].q}.`,`(1 daq) Ogohlantiradi: ${M.n}`,p.st.some(x=>x.gm==="klaster")?"(1 daq) Klaster tuzadi: o'quvchilar mavzuga bog'liq tushunchalarni aytadi.":null].filter(Boolean),
      s:["Muammoli savolga taxmin aytadi.","Ta'rif va formulani daftarga yozadi.",M.fig?"Chizmani daftarga chizadi, yuzalarni hisoblaydi.":"Formulani o'qiydi, misol keltiradi.","Misollarning har qadamini kuzatadi, 3-misolni o'zi davom ettiradi.","Klasterga tushuncha qo'shadi."],
      nm:`Diqqat qiling. ${M.g} Buni ${M.f[0]} ko'rinishida yozamiz. Masalan, ${e1.q} = ${e1.a}. Esda tuting: ${M.n.replace(/^Ko'p uchraydigan xato: /,"ko'p uchraydigan xato — ")}`,
      q:[`Qoidani o'z so'zingiz bilan aytib bering → ${M.g.split(". ")[0]}`,`${e1.q} = ? → ${e1.a}`,`Eng ko'p qanday xato qilinadi? → ${M.n.replace(/^Ko'p uchraydigan xato: /,"")}`]});}
  if(f)set(/^Mustahkamlash$|Amaliy/,{t:["(1 daq) Topshiriqlarni taqsimlaydi: A — hamma uchun, B — A ni tez yechganlar uchun, C — kuchli o'quvchilar uchun (qo'shimcha ball).",`(4 daq) A daraja: ${ls(TA)}. 1-juftlik doskada yechadi.`,`(5 daq) B daraja: ${ls(TB)}.`,`(2 daq) C daraja: ${ls(TC)}.`,"Javoblarni slaydda ko'rsatadi, juftliklar bir-birini tekshiradi; qiynalganga yo'naltiruvchi savol beradi."],
    s:["Juftlikda A darajadan boshlaydi.","Tez yechsa B va C ga o'tadi.","Doskada yechimini tushuntiradi.","Partadoshining javobini tekshiradi."],
    nm:"Har bir juftlik A darajadan boshlaydi. Kim tez va to'g'ri yechsa, B ga o'tadi. C — eng qiziq misol: uni yechgan juftlikka qo'shimcha ball!",
    q:["Qaysi misolda qiynaldingiz va nima uchun?","Javobni qanday tekshirish mumkin? → qavslarni ochib, dastlabki ifodaga qaytish orqali"]});
  set(/takrorlash$/i,{t:[`(7 daq) «Besh barmoq»: har barmoq — bitta savol; misollar: ${ls(TA.slice(0,2))}.`],q:[`Formulani yozing → ${M?M.f[0]:""}`,`${TA[0].q} = ? → ${TA[0].a}`]});
  set(/^Refleksiya|^Baholash$/,{t:[(p.st.find(x=>/^Refleksiya|^Baholash$/.test(x.n))||{}).gm==="hayoq"?`(3 daq) «Ha–Yo'q»: ${p.game.hy.filter(x=>x.b.trim()).length} ta bayonot ekranda birma-bir chiqadi, javobni ko'rsatadi.`:"Eng faol 3 o'quvchini nomma-nom aytadi, ularning qaysi javobi yaxshi bo'lganini izohlaydi.","(2 daq) Mezonlar bo'yicha baholaydi: savollarga javob (4), topshiriq (4), faollik (2) — jami 10 ball; rag'bat kartochkalarini beradi."],s:[(p.st.find(x=>/^Refleksiya|^Baholash$/.test(x.n))||{}).gm==="hayoq"?"Bayonotga «Ha» yoki «Yo'q» kartochkasini ko'taradi.":"O'z ishini mezonlar bo'yicha baholaydi.","«Bugun nimani o'rgandim?» savoliga 1 gap bilan javob beradi."],
    nm:(p.st.find(x=>/^Refleksiya|^Baholash$/.test(x.n))||{}).gm!=="hayoq"?"Bugun hammangiz yaxshi ishladingiz. Baholarni mezonlar bo'yicha e'lon qilaman — kim qayerda ball yo'qotganini ham aytaman.":"Hozir ekranda bayonotlar chiqadi. To'g'ri bo'lsa «Ha», noto'g'ri bo'lsa «Yo'q» kartochkasini ko'taring. Shoshilmang, avval o'ylang!",q:["Bugun nimani o'rgandim?","Qaysi joyi qiyin bo'ldi?",f?`«${l.t}» formulasi qayerda kerak bo'ladi? → tez hisoblash, ko'phadni soddalashtirish, tenglama yechish`:"Qaysi mavzuni yana takrorlash kerak?"]});
  set(/^Uyga vazifa/,{t:[p.hwx.A?`A daraja: ${p.hwx.A} — darsdagi namunaviy misol kabi.`:null,p.hwx.B?`B daraja: ${p.hwx.B}.`:null,p.hwx.C?`C daraja: ${p.hwx.C} — qo'shimcha baho.`:null,p.hwx.ij?`Ijodiy: ${p.hwx.ij}`:null,"Keyingi darsda 2 o'quvchi yechimini doskada tushuntiradi."].filter(Boolean),nm:"Uyda avval darsdagi namunaviy misolni qayta ko'rib chiqing, keyin o'z darajangizdagi vazifani bajaring. Qiyin bo'lsa, qo'llanmadagi eslatmani o'qing."});
  if(!f){const fs=fams.slice(-6);
    set(/^Savol-javob/,{t:[`(10 daq) Har mavzudan bitta savol: ${fs.map(x=>`«${FAMT[x]}»`).join(", ")}.`],q:fs.map(x=>{const M2=MAT[FAMT[x]];if(M2)return `«${FAMT[x]}» formulasi? → ${M2.f[0]}`;const t=fgen(x,"A",r);return `«${FAMT[x]}»: ${t.q} = ? → ${t.a}`;})});
    set(/^Misollar yechish/,{t:fs.slice(0,4).map((x,k)=>`${k+1}-guruh: «${FAMT[x]}» — ${(t=>`${t.q} → ${t.a}`)(fgen(x,"B",r))}`)});
    set(/^Test$/,{t:[`5 savollik test: ${ls(T.slice(0,5))}.`]});
    const bl=/CHSB/.test(l.t)?[5,6,8,9,12]:[3,4,5,6,7];
    set(/^Nazorat ishini/,{t:[1,2].map(v=>`${v}-variant: ${fs.slice(-5).map((x,k)=>`${k+1}) ${fgen(x,k<2?"A":k<4?"B":"C",r).q} (${bl[k]} ball)`).join("; ")}.`)});
    set(/^Yo'riqnoma/,{t:[`Baholash: jami ${bl.reduce((a,b)=>a+b,0)} ball, har topshiriq bali varaqda; yechimni to'liq yozish shart.`],nm:"Har bir topshiriqni to'liq yechib, javobni ramkaga oling. Avval o'zingizga oson misollardan boshlang."});
    set(/^Xatolarni tahlil/,{t:fs.slice(-3).map(x=>{const t=fgen(x,"A",r);return `Xato: ${t.q} = ${mut(t.a)} → To'g'ri: ${t.a}`;})});
    set(/^Mustaqil ish/,{t:[`Shu turdagi misollar: ${ls(T.slice(0,3))}.`]});}
  return p;
}
function genStat(p){const b=p.st.reduce((a,s)=>a+lines(s.t).length+lines(s.s).length,0),q=p.st.reduce((a,s)=>a+lines(s.q).length,0),e=p.mat.filter(x=>x.k==="ex").length;return `${b} ta band, ${q} ta savol, ${p.tasks.filter(t=>t.q.trim()).length} ta topshiriq${e?`, ${e} ta yechilgan misol`:""}`;}
function tasksFor(l){
  if(l.kind==="bsb"||l.kind==="chsb")return [];
  if(TASKS[l.tk])return TASKS[l.tk].filter((_,j)=>l.k===1?j<4:j>0).map(([lv,q,a])=>({lv,q,a}));
  const m=String(l.hw).match(/(\d{3})\s*[–-]\s*(\d{3})/),a=m?+m[1]-6:0;
  return a?[{lv:"A",q:`Darslik № ${a}`,a:""},{lv:"A",q:`Darslik № ${a+1}`,a:""},{lv:"B",q:`Darslik № ${a+3}`,a:""},{lv:"C",q:`Darslik № ${a+5} (qiyin)`,a:""}]:[{lv:"A",q:"",a:""}];
}
function stageX(l,p,ty){
  const T=`«${l.t}»`,P2=p?`«${p.t}»`:"o'tgan mavzu",M=MAT[l.tk];
  return n=>{
    if(/^Tashkiliy/.test(n))return {mq:"Darsni boshlash, tartib-intizomni ta'minlash, o'quvchilarni mavzuga ruhlantirish.",t:["Davomatni aniqlaydi, sinfning darsga tayyorligini tekshiradi.","Doska, slayd va tarqatmalarni tayyorlaydi."],s:["Daftar va darsliklarini tayyorlaydi."],
      nm:ty==="Nazorat"?`Assalomu alaykum! Bugun ${T}. Ishni mustaqil bajaring, vaqt — 35 daqiqa. Har bir topshiriqning bali varaqda ko'rsatilgan.`:`Assalomu alaykum, aziz o'quvchilar! Bugun ${T} mavzusini o'rganamiz. Avval o'tgan darsni eslaymiz, keyin yangi qoida bilan tanishib, misollar yechamiz.`};
    if(/^Uy vazifasini/.test(n))return {mq:"O'quvchilarning oldingi bilimlarini uyg'otish, yangi mavzuga ko'prik yaratish.",t:["Har savoldan keyin 2–3 o'quvchi javobini tinglaydi, xatoni qisqa to'g'rilaydi.","Faollikka 0–2 ball beradi."],s:["Xato bo'lsa, o'rtog'i bilan muhokama qiladi."],
      q:[`${P2} mavzusida qanday qoidani o'rgandik?`,"Uy vazifasidagi qaysi misol qiyin bo'ldi va nima uchun?","Bitta misolni doskada yechib, har qadamini tushuntiring."]};
    if(/bayon/i.test(n))return {gm:ty==="Yangi bilim beruvchi"&&M?"klaster":"",mq:"Yangi tushuncha va qoidani shakllantirish, namunaviy misollarda ko'rsatish.",t:["Qoidani chizma yordamida tushuntiradi.","Namunaviy misolni bosqichma-bosqich yechadi.","Ko'p uchraydigan xato haqida ogohlantiradi."],s:["Savol beradi, o'z misolini aytadi."]};
    if(/^Mustahkamlash$|Amaliy/.test(n))return {mq:"Yangi bilimni misollarda qo'llash, mustaqil yechish ko'nikmasini shakllantirish.",t:["A, B, C darajali topshiriqlarni beradi.","Qiynalgan o'quvchiga yo'naltiruvchi savol beradi."],s:["O'z darajasidagi topshiriqni tanlaydi va yechadi."]};
    if(/takrorlash$/i.test(n))return {mq:"Mavzuni takrorlash va mustahkamlash.",t:["«Besh barmoq» metodini o'tkazadi."],s:["Har barmoqdagi savolga javob beradi."],gm:"besh"};
    if(/^Baholash$/.test(n)&&ty==="Yangi bilim beruvchi")return {n:"Refleksiya va baholash",mq:"Mavzuni qanchalik tushunganini aniqlash, xatolarni topish va baholash.",t:["«Ha–Yo'q» o'yinini o'tkazadi.","Mezonlar asosida baholaydi, rag'bat kartochkalarini beradi."],s:["Har bayonotga «Ha» yoki «Yo'q» kartochkasini ko'taradi."],gm:"hayoq"};
    if(/aholash/.test(n))return {mq:"O'quvchilar faoliyatini mezonlar asosida baholash va rag'batlantirish.",t:["Rag'bat kartochkalarini beradi."],s:[]};
    if(/^Test$/.test(n))return {mq:"Bilimni tezkor tekshirish.",t:["«Ha–Yo'q» bayonotlarini o'qiydi."],s:["Javobini daftariga yozadi."],gm:"hayoq"};
    if(/^Uyga vazifa/.test(n))return {mq:"Uyga vazifani tushuntirish.",t:["A, B, C darajali va ijodiy vazifani aytadi."],s:["O'z darajasini tanlaydi."]};
    return {};
  };
}
function hayoqFor(l){
  const H={"Yig'indi kvadrati":[["(a + b)^2 = a^2 + b^2","Yo'q"],["(a + b)^2 = a^2 + 2ab + b^2","Ha"],["(x + 3)^2 = x^2 + 6x + 9","Ha"],["(2a + 1)^2 = 4a^2 + 2a + 1","Yo'q"],["Tomoni a + b bo'lgan kvadrat yuzi 4 qismga bo'linadi","Ha"],["2ab — ikkilangan ko'paytma","Ha"]],
    "Guruhlash usuli":[["ax + ay + bx + by = (x + y)(a + b)","Ha"],["Guruhlashda hadlar faqat yonma-yon guruhlanadi","Yo'q"],["x^3 − 2x^2 + 3x − 6 = (x − 2)(x^2 + 3)","Ha"],["Guruhlardan keyin qavslar har xil bo'lsa ham ko'paytma hosil bo'ladi","Yo'q"],["Javobni qavslarni ochib tekshirish mumkin","Ha"],["2m + 2n + km + kn = (m + n)(2 + k)","Ha"]]};
  if(H[l.tk])return H[l.tk].map(([b,a])=>({b,a}));
  const M=MAT[l.tk];if(!M)return [{b:"",a:"Ha"}];
  const r=[];M.f.forEach(f=>{r.push({b:f,a:"Ha"});const m=f.includes(" + ")?f.replace(" + "," − "):f.replace(" − "," + ");if(m!==f)r.push({b:m,a:"Yo'q"});});
  r.push({b:M.n.replace(/^Ko'p uchraydigan xato: /,""),a:"Ha"});return r.slice(0,8);
}
const GMN={hayoq:"«Ha–Yo'q» o'yini",besh:"«Besh barmoq»",klaster:"«Klaster»",sinkveyn:"«Sinkveyn»"};
function klFor(l){const M=MAT[l.tk];if(!M)return ["Ta'rif","Qoida","Misol","Qo'llanishi"];
  return [...M.f.slice(0,3),M.fig?"Geometrik ma'nosi — chizma":"Hayotiy misol","Ko'paytuvchilarga ajratish","Tez hisoblash"].slice(0,6);}
function skFor(l){const M=MAT[l.tk];return [l.t,"Qisqa, foydali","Soddalashtiradi, tezlashtiradi, isbotlaydi",M?M.g.split(". ")[0].replace(/\.$/,"")+".":`«${l.t}» qoidasi misollarni tez yechishga yordam beradi.`,"Formula"];}
const SKL=[["1-qator","Ot (mavzu)"],["2-qator","Ikki sifat"],["3-qator","Uch fe'l"],["4-qator","To'rt so'zli gap"],["5-qator","Sinonim"]];
const sup=x=>tPlain(x);
function klSvg(c,nodes){const N=nodes.filter(x=>x.trim()),W=700,H=Math.max(260,N.length>6?330:280),cx=W/2,cy=H/2;
  const nd=N.map((t,k)=>{const an=-Math.PI/2+k*2*Math.PI/N.length,w=Math.min(220,sup(t).length*7.2+22),x=Math.max(w/2+4,Math.min(W-w/2-4,cx+Math.cos(an)*240)),y=cy+Math.sin(an)*(H/2-30);return {t:sup(t),x,y,w};});
  return `<div class="klw"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${nd.map(n=>`<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="#9aa8b6" stroke-width="1.5"/>`).join("")}
    <ellipse cx="${cx}" cy="${cy}" rx="${Math.min(150,sup(c).length*5+40)}" ry="34" fill="#0d6f6c"/><text x="${cx}" y="${cy+5}" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">${esc(sup(c))}</text>
    ${nd.map(n=>`<rect x="${n.x-n.w/2}" y="${n.y-16}" width="${n.w}" height="32" rx="16" fill="#f1eefe" stroke="#6d5bd0"/><text x="${n.x}" y="${n.y+4.5}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#1a1f24">${esc(n.t.length>30?n.t.slice(0,29)+"…":n.t)}</text>`).join("")}</svg></div>`;}
function beshFor(l){const M=MAT[l.tk]||{g:"",f:[""],ex:[""],n:""};
  return [["Bosh barmoq","Asosiy tushuncha",`«${l.t}» deganda nimani tushunasiz?`,M.g.split(". ")[0]],["Ko'rsatkich barmoq","Qoida",`Mavzuning asosiy formulasini yozing.`,M.f[0]],["O'rta barmoq","Misol keltir","O'zingiz misol tuzib, yeching.",M.ex.length?`${M.ex[0]} ${M.ex[M.ex.length-1]}`:""],["Nomsiz barmoq","Xatoni top","Bu mavzuda qanday xato ko'p uchraydi?",M.n],["Jimjiloq","Xulosa chiqar","Bugun nimani o'rgandingiz?",`«${l.t}» qoidasini misollarda qo'llashni.`]].map(([f,t,q,a])=>({f,t,q,a}));}
/* ── o'quvchilar ── */
function groups(){const S=students().slice().sort((a,b)=>b.g-a.g||a.i-b.i),G=[[],[],[],[]];S.forEach((s,k)=>{const r=Math.floor(k/4),c=k%4;G[r%2?3-c:c].push(s);});return G;}
function suggest(){const S=students(),k=S.length>20?6:4;return S.slice().sort((a,b)=>(a.g-b.g)||(b.ab-a.ab)||a.i-b.i).slice(0,k).map(s=>s.i);}

/* ── holat ── */
const st={dev:"pc",cur:0,tab:"edit",view:"ed",plans:{},flt:"all",gen:"bat",cover:{cs:"rang",fan:"",vil:"",tum:"",mak:"",fio:"",ochiq:true},paper:{rag:true,cover:true,style:"zam",vs:"A",ff:"auto",fmt:"bat",school:true,sig:true,ask:true,tick:false,tasks:true,cards:false,mat:true,frame:"naqsh",quote:true,wm:true},showG:false,live:null,undo:null,dlg:null,toast:null,alt:0,q:0,c:null,ci:-1};
const cls=()=>esc(st.c?st.c.name:"");
const P=()=>st.plans[st.cur];
const statusOf=i=>!st.plans[i]?"no":st.plans[i].ready?"ok":"dr";
const stIcon=i=>({ok:I("check-circle-fill","sti ok"),dr:I("pencil-square","sti dr"),no:I("circle","sti no")}[statusOf(i)]);
const sum=p=>p.st.reduce((a,s)=>a+s.m,0);
const clone=p=>p&&({...p,g:[...p.g],komp:new Set(p.komp),met:new Set(p.met),jih:new Set(p.jih),st:p.st.map(s=>({...s})),ask:p.ask&&[...p.ask],tasks:p.tasks.map(t=>({...t})),mat:p.mat.map(b=>({...b})),hwx:{...p.hwx},shakl:new Set(p.shakl),game:{hy:p.game.hy.map(x=>({...x})),bb:p.game.bb.map(x=>({...x})),kl:[...p.game.kl],sk:[...p.game.sk]},mezon:p.mezon.map(x=>[...x])});
const snap=()=>{const o={};for(const k in st.plans)o[k]=clone(st.plans[k]);return o;};
function parts(i){const p=st.plans[i],l=L[i];if(!p)return [];const nz=l.kind==="bsb"||l.kind==="chsb";return [
  ["mavzu","Dars turi",!!p.type],["maqsad","Maqsad",p.g.every(x=>x.trim())&&!!p.res.trim()],["metod","Metod",p.met.size>0&&p.jih.size>0],
  ["borishi","Borishi",sum(p)===45&&p.st.every(s=>s.t.trim())],["mat","Material",p.mat.some(b=>b.show)],["top","Topshiriqlar",nz||p.tasks.some(t=>t.q.trim())],
  ["bah","Baholash",p.mezon.length>0&&!!p.xul.trim()],["oq","O'quvchilar",!!(p.ask&&p.ask.length)],["uy","Uy vazifasi",nz||!!String(l.hw).trim()]];}
function ring(done,all,sz){const r=sz/2-5,c=2*Math.PI*r,f=all?done/all:0;return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" aria-hidden="true"><circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="var(--soft)" stroke-width="5"/><circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="${f===1?"var(--plus)":"var(--acc)"}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c*f} ${c}" transform="rotate(-90 ${sz/2} ${sz/2})"/></svg>`;}

/* ── ko'rinishlar ── */
function listHtml(){
  const ok=L.filter((_,i)=>statusOf(i)==="ok").length;
  let wk="",h="";
  L.forEach((l,i)=>{
    if(st.flt==="no"&&statusOf(i)==="ok")return;
    if(st.flt==="wk"&&!(l.d>=wkFrom(0)&&l.d<=wkTo(1)))return;
    const d=dd(l.d),mon=new Date(d);mon.setDate(d.getDate()-((d.getDay()+6)%7));const w=iso(mon);
    if(w!==wk){wk=w;const e=new Date(mon);e.setDate(mon.getDate()+5);h+=`<div class="wk">${mon.getMonth()===e.getMonth()?mon.getDate():mon.getDate()+"-"+MG[mon.getMonth()]} – ${e.getDate()}-${MG[e.getMonth()]}</div>`;}
    h+=`<button class="li${i===st.cur?" on":""}${l.d<TODAY?" past":""}" data-a="go" data-v="${i}">
      <span class="dt"><small>${WDS[d.getDay()]}</small><b>${d.getDate()}</b><small>${MS[d.getMonth()]}</small></span>
      <span style="min-width:0"><span class="lt">${esc(l.t)}${l.h>1?` <span class="muted">(${l.k}/${l.h})</span>`:""}</span><span class="ls">${l.n}-dars · ${typeOf(l)}</span></span>${stIcon(i)}</button>`;
  });
  const nx=L.map((l,i)=>[l,i]).filter(([l,i])=>l.d>=wkFrom(1)&&l.d<=wkTo(1)&&statusOf(i)!=="ok").length;
  return `<div class="lh"><div class="row"><b>${st.q?st.q+"-chorak":"Yil"} darslari</b><span class="sp"></span><span class="small muted">${ok}/${L.length} tayyor</span></div>${qChips()}
    <div class="lprog"><div class="lbar"><i style="width:${ok/L.length*100}%"></i></div>${nx?`<span class="lwarn">${I("exclamation-triangle")} Keyingi haftada ${nx} ta dars tayyor emas</span>`:""}</div>
    <button class="btn sm vio" data-a="bulk" style="justify-content:center">${I("magic")} Bir nechta darsni to'ldirish</button>
    <div class="fl">${[["all","Hammasi"],["wk","2 hafta"],["no","Tayyor emas"]].map(([k,t])=>`<button class="chip${st.flt===k?" on":""}" data-a="flt" data-v="${k}">${t}</button>`).join("")}</div></div>
    <div class="lsc">${h||'<div class="small muted" style="padding:10px">Hammasi tayyor</div>'}</div>`;
}
function header(){
  const l=L[st.cur];
  return `<div class="hd"><button class="ib" data-a="back" aria-label="Jurnalga qaytish">${I("arrow-left")}</button><div class="ht"><span class="eyebrow">${I("journal-text")} Dars ishlanma</span>
    <h1>${cls()}${st.c&&st.c.subject?` · ${esc(SUBJ())}`:""}</h1>
    <div class="meta"><span>${I("calendar-event")} ${fL(l.d)}</span><span>${I("bookmark-star")} ${QL()}, ${l.n}-dars</span><span>${I("people")} ${NS()} o'quvchi</span></div></div>
    <div class="acts">
      <button class="btn" data-a="prev" ${st.cur?"":"disabled"} aria-label="Oldingi dars">${I("chevron-left")}<span class="tl-only">Oldingi</span></button>
      ${st.dev==="tel"?`<button class="btn" data-a="list">${I("list-ul")} Darslar</button>`:""}
      <button class="btn" data-a="next" ${st.cur<L.length-1?"":"disabled"} aria-label="Keyingi dars"><span class="tl-only">Keyingi</span>${I("chevron-right")}</button>
      <button class="btn pri" data-a="exp">${I("download")} Eksport</button>
    </div></div>`;
}
function hero(){
  const l=L[st.cur],p=P(),d=dd(l.d),PT=parts(st.cur),ok=PT.filter(x=>x[2]).length,past=l.d<TODAY;
  return `<div class="hero"><span class="dtile${past?" past":""}"><small>${WDS[d.getDay()]}</small><b>${d.getDate()}</b><small>${MS[d.getMonth()]}</small></span>
    <div class="hx"><span class="tag">${I("card-text")} KTR'dan · ${l.n}-dars</span><div class="topic">${esc(l.t)}${l.h>1?` <span class="muted">(${l.k}/${l.h})</span>`:""}</div>
      <div class="hl"><span>${I("easel")} ${esc(p.type)}</span><span>${I("hourglass-split")} ${sum(p)} daqiqa</span><span>${I("house-door")} ${esc(l.hw||"—")}</span></div></div>
    <div class="hr"><div class="ring">${ring(ok,PT.length,st.dev==="tel"?48:64)}<span><b>${ok}/${PT.length}</b>${st.dev==="tel"?"":"<small>tayyor</small>"}</span></div>
      ${past?`<button class="btn" data-a="jump" data-v="keyin">${I("list-check")} Natija</button>`:`<button class="btn pri" data-a="live">${I("play-fill")} Darsni boshlash</button>`}</div></div>`;
}
function statusBar(){
  const p=P();
  if(!p)return "";
  return `<div class="stbar"><button class="tgl${p.ready?" on":""}" data-a="ready"><span class="sw"></span>${p.ready?"Tayyor":"Qoralama"}</button>
    <span class="saved">${I("check-lg")} Saqlandi</span><span class="sp"></span>
    <span class="sbb"><button class="btn sm vio" data-a="auto">${I("magic")} ${st.dev==="tel"?"To'ldirish":"Qaytadan to'ldirish"}</button>
    <button class="btn sm" data-a="copy">${I("copy")} Nusxa</button>
    <button class="btn sm" data-a="tpl">${I("bookmark-star")} Shablon</button></span></div>`;
}
function empty(){
  const l=L[st.cur];
  return `<div class="card" style="align-items:flex-start;gap:12px">
    <span class="tag">${I("card-text")} KTR'dan</span><div class="topic">${esc(l.t)}${l.h>1?` <span class="muted">(${l.k}-dars)</span>`:""}</div>
    <div class="meta"><span>${I("easel")} ${typeOf(l)}</span><span>${I("house-door")} Uyga vazifa: ${esc(l.hw||"—")}</span></div>
    <p class="muted" style="margin:0;max-width:60ch">Bu dars uchun hali ishlanma yo'q. Avtomatik to'ldirish maqsad, metod, jihoz, dars bosqichlari, misollar va topshiriqlarni dars turi va mavzuga qarab yozadi. Keyin xohlagan joyini o'zgartirasiz.</p><div class="row" style="align-items:center"><span class="lbl">Batafsillik</span><div class="chips">${[["qisqa","Qisqa"],["orta","O'rta"],["bat","Batafsil"]].map(([k,t])=>`<button class="chip${st.gen===k?" on":""}" data-a="gen" data-v="${k}">${t}</button>`).join("")}</div></div><div class="small muted">${{qisqa:"Har bosqichga 1 qator — tez ko'rib chiqish uchun.",orta:"Har bosqichda 2–4 band, asosiy savollar.",bat:"Har bosqich daqiqalarga bo'lingan, namuna nutq, savollar javobi bilan, 8 ta A/B/C topshiriq (javoblari bilan), qo'shimcha yechilgan misollar, «Ha–Yo'q» bayonotlari, nazorat ishida 2 variant."}[st.gen]}</div>
    <div class="row"><button class="btn pri" data-a="auto">${I("magic")} Avtomatik to'ldirish</button><button class="btn" data-a="copy">${I("copy")} Boshqa sinfdan nusxa</button><button class="btn" data-a="blank">${I("file-earmark-text")} Bo'sh boshlash</button></div></div>`;
}
function editor(){
  const l=L[st.cur],p=P();if(!p)return empty();
  const S=sum(p),diff=S-45;
  const stud=students();if(!p.ask)p.ask=suggest();
  const past=l.d<TODAY;
  const PT=parts(st.cur);
  let h=`<div class="jump" role="navigation" aria-label="Bo'limlar">${PT.map(([id,t,ok])=>`<button data-a="jump" data-v="${id}"><span class="d${ok?" ok":""}"></span>${t}</button>`).join("")}</div>
  <div class="card" id="is-s-mavzu">
    <div class="sec-h"><span class="ic">${I("easel")}</span><h3>Dars turi</h3></div>
    ${l.kind==="bsb"||l.kind==="chsb"?`<div class="hint v">${I("info-circle")}<span>Nazorat darsi: topshiriqlar ${l.kind==="bsb"?"BSB":"CHSB"} bo'limidan olinadi, ishlanmaga faqat tartib va vaqt yoziladi.</span></div>`:""}
    <div class="lbl">Dars turi</div>
    <div class="chips">${TYPES.map(t=>`<button class="chip${p.type===t?" on":""}" data-a="type" data-v="${t}">${t}</button>`).join("")}</div>
    <div class="lbl">Dars shakli</div>
    <div class="chips">${["Jamoaviy","Guruhli","Juftlik","Individual"].map(t=>`<button class="chip${p.shakl.has(t)?" on":""}" data-a="shakl" data-v="${t}">${p.shakl.has(t)?I("check-lg"):""}${t}</button>`).join("")}</div>
    <div class="fld"><label class="lbl" for="is-tex">Texnik vositalar</label><input id="is-tex" class="inp" data-f="tex" value="${esc(p.tex)}"></div>
    <div class="fld"><label class="lbl" for="is-fan">Fanlararo bog'liqlik</label><input id="is-fan" class="inp" data-f="fan" value="${esc(p.fan)}"></div>
  </div>
  <div class="card" id="is-s-maqsad">
    <div class="sec-h"><span class="ic">${I("bullseye")}</span><h3>Darsning maqsadi</h3></div>
    <div class="g3">${[["Ta'limiy",0],["Tarbiyaviy",1],["Rivojlantiruvchi",2]].map(([t,k])=>`<div class="fld"><label class="lbl" for="is-g${k}">${t}</label><textarea id="is-g${k}" rows="4" data-f="g${k}">${esc(p.g[k])}</textarea></div>`).join("")}</div>
    <div class="fld"><label class="lbl" for="is-res">${I("award")} Kutilayotgan natijalar <span style="font-weight:600">· har qator — alohida band</span></label><textarea id="is-res" rows="3" data-f="res">${esc(p.res)}</textarea></div>
    <div class="lbl">Tayanch kompetensiyalar</div>
    <div class="chips">${KOM.map(t=>`<button class="chip${p.komp.has(t)?" on":""}" data-a="komp" data-v="${t}">${p.komp.has(t)?I("check-lg"):""}${t}</button>`).join("")}</div>
  </div>
  <div class="card" id="is-s-metod">
    <div class="sec-h"><span class="ic">${I("lightbulb")}</span><h3>Metod va jihozlar</h3></div>
    <div class="lbl">Metodlar</div>
    <div class="chips">${[...new Set([...MET,...p.met])].map(t=>`<button class="chip${p.met.has(t)?" on":""}" data-a="met" data-v="${t}">${p.met.has(t)?I("check-lg"):""}${t}</button>`).join("")}<button class="chip add" data-a="addmet" data-v="met">${I("plus-lg")} Boshqa</button></div>
    <div class="lbl">Jihozlar</div>
    <div class="chips">${[...new Set([...JIH,...p.jih])].map(t=>`<button class="chip${p.jih.has(t)?" on":""}" data-a="jih" data-v="${t}">${p.jih.has(t)?I("check-lg"):""}${t}</button>`).join("")}<button class="chip add" data-a="addmet" data-v="jih">${I("plus-lg")} Boshqa</button></div>
    ${p.met.size?`<div class="mtips">${[...p.met].map(m=>`<div><b>${esc(m)}</b> — ${esc(MTIP[m]||"")}</div>`).join("")}</div>`:""}
  </div>
  <div class="card" id="is-s-borishi">
    <div class="sec-h"><span class="ic">${I("hourglass-split")}</span><h3>Darsning borishi</h3><span class="sp"></span><button class="btn sm" data-a="allopen">${p.st.every(s=>s.open)?I("chevron-up")+" Yig'ish":I("chevron-down")+" Hammasini ochish"}</button></div>
    <div class="tl" role="img" aria-label="Bosqichlar vaqti">${p.st.map((s,j)=>`<i style="flex:${s.m};background:var(${SC[j%7]})" title="${esc(s.n)} · ${s.m} daq"></i>`).join("")}${diff<0?`<i style="flex:${-diff};background:transparent"></i>`:""}</div>
    <div class="tlt"><span>Jami: ${S} daqiqa</span><span class="${diff?"bad":"good"}">${diff>0?`${I("exclamation-triangle")} ${diff} daqiqa ortiqcha`:diff<0?`${I("exclamation-triangle")} ${-diff} daqiqa bo'sh`:`${I("check-lg")} 45 daqiqaga to'g'ri`}</span></div>
    ${p.st.map((s,j)=>`<div class="stg${s.open?"":" cl"}">
      <div class="sh"><span class="dot" style="background:var(${SC[j%7]})">${j+1}</span><input class="nm" data-f="sn" data-j="${j}" value="${esc(s.n)}" aria-label="Bosqich nomi">
        <span class="mins"><button data-a="m-" data-v="${j}" aria-label="−1 daqiqa">${I("dash-lg")}</button><b>${s.m} daq</b><button data-a="m+" data-v="${j}" aria-label="+1 daqiqa">${I("plus-lg")}</button></span>
        <button class="ib sm" data-a="tog" data-v="${j}" aria-label="Ochish">${I(s.open?"chevron-up":"chevron-down")}</button>
        <span class="pv">${esc(s.t)}</span></div>
      <div class="sb"><div class="fld wide"><label class="lbl" for="is-mq${j}">Bosqich maqsadi</label><input class="inp" id="is-mq${j}" data-f="smq" data-j="${j}" value="${esc(s.mq)}"></div>
        <div class="fld"><label class="lbl" for="is-t${j}">O'qituvchi faoliyati · har qator — band</label><textarea id="is-t${j}" rows="${Math.max(3,s.t.split("\n").length+1)}" data-f="st" data-j="${j}">${esc(s.t)}</textarea></div>
        <div class="fld"><label class="lbl" for="is-s${j}">O'quvchi faoliyati · har qator — band</label><textarea id="is-s${j}" rows="${Math.max(3,s.s.split("\n").length+1)}" data-f="ss" data-j="${j}">${esc(s.s)}</textarea></div>
        <div class="fld wide"><label class="lbl" for="is-nm${j}">Namuna matn (o'qituvchi so'zi)</label><textarea id="is-nm${j}" rows="2" data-f="snm" data-j="${j}" placeholder="Bo'sh qoldirsangiz, varaqda chiqmaydi">${esc(s.nm)}</textarea></div>
        <div class="fld wide"><label class="lbl" for="is-q${j}">Savollar · har qator — bitta savol</label><textarea id="is-q${j}" rows="${Math.max(2,s.q.split("\n").length+1)}" data-f="sq" data-j="${j}" placeholder="Bo'sh qoldirsangiz, varaqda chiqmaydi">${esc(s.q)}</textarea></div>
        <div class="wide"><div class="lbl" style="margin-bottom:5px">Metod / o'yin</div><div class="chips">${[["","Yo'q"],...Object.entries(GMN)].map(([k,t])=>`<button class="chip${(s.gm||"")===k?" on":""}" data-a="sgm" data-v="${j}:${k}">${t}</button>`).join("")}</div></div>
        ${s.gm?`<div class="wide">${gameEd(p,s.gm)}</div>`:""}</div>
      <div class="sf"><button class="ib sm" data-a="up" data-v="${j}" ${j?"":"disabled"} aria-label="Yuqoriga">${I("arrow-up")}</button><button class="ib sm" data-a="dn" data-v="${j}" ${j<p.st.length-1?"":"disabled"} aria-label="Pastga">${I("arrow-down")}</button><button class="ib sm" data-a="del" data-v="${j}" aria-label="O'chirish">${I("trash")}</button></div>
    </div>`).join("")}
    <div class="row"><button class="btn sm" data-a="addst">${I("plus-lg")} Bosqich qo'shish</button>${diff?`<button class="btn sm" data-a="fit">${I("arrow-repeat")} 45 daqiqaga moslash</button>`:""}</div>
  </div>
  ${matCard(l,p)}
  <div class="card" id="is-s-top">
    <div class="sec-h"><span class="ic">${I("list-ol")}</span><h3>Darsdagi topshiriqlar</h3><span class="sp"></span><span class="small muted">${p.tasks.length} ta</span></div>
    ${l.kind==="bsb"||l.kind==="chsb"?`<div class="hint v">${I("info-circle")}<span>Nazorat darsi: topshiriqlar ${l.kind==="bsb"?"BSB":"CHSB"} bo'limidagi variantlardan olinadi.</span></div>`:`
    <div class="lvleg"><span><i style="background:var(--plus)"></i>A — oson</span><span><i style="background:var(--acc)"></i>B — o'rta</span><span><i style="background:var(--minus)"></i>C — qiyin</span><span>Darajani o'zgartirish uchun harfni bosing</span></div>
    ${p.tasks.map((t,j)=>`<div class="task"><button class="lv ${t.lv}" data-a="lv" data-v="${j}" aria-label="Daraja: ${LVN[t.lv]}">${t.lv}</button><input class="inp" data-f="tq" data-j="${j}" value="${esc(t.q)}" placeholder="Topshiriq yoki darslikdagi raqam" aria-label="Topshiriq"><input class="inp ans" data-f="ta" data-j="${j}" value="${esc(t.a)}" placeholder="Javob (ixtiyoriy)" aria-label="Javob"><button class="ib sm" data-a="tdel" data-v="${j}" aria-label="O'chirish">${I("trash")}</button>${t.q.includes("$")||t.a.includes("$")?`<div class="tpv">${fx(t.q)}${t.a?` → ${fx(t.a)}`:""}</div>`:""}</div>`).join("")}
    <div class="row"><button class="btn sm" data-a="tadd">${I("plus-lg")} Topshiriq qo'shish</button><span class="sp"></span><button class="btn sm" data-a="cards">${I("grid")} Guruh kartochkalari</button></div>
    ${st.showG?`<div class="lbl">4 guruh · baholar bo'yicha teng bo'lingan</div><div class="grp">${groups().map((g,k)=>`<div><b>${k+1}-guruh · ${g.length} kishi</b>${g.slice(0,st.dev==="tel"?3:5).map(s=>`<span>${esc(short(s.nm))}</span>`).join("")}${g.length>(st.dev==="tel"?3:5)?`<span>+${g.length-(st.dev==="tel"?3:5)} ta</span>`:""}</div>`).join("")}</div><div class="small muted">Varaq bo'limida «Tarqatma kartochkalar»ni yoqsangiz, har guruhga topshiriqli kartochka chop etiladi.</div>`:""}`}
  </div>
  <div class="card" id="is-s-oq">
    <div class="sec-h"><span class="ic">${I("person-check")}</span><h3>So'raladigan o'quvchilar</h3><span class="sp"></span><button class="btn sm" data-a="shuf">${I("shuffle")} Boshqalar</button></div>
    <div class="hint">${I("info-circle")}<span>Jurnaldan tanlandi: shu chorakda eng kam baho olgan va oxirgi darsda kelmaganlar. Belgilanganlar varaqda «Uy vazifasini tekshirish» bosqichida chiqadi.</span></div>
    <div class="ask">${(()=>{const pick=new Set(p.ask),pool=stud.slice().sort((a,b)=>(a.g-b.g)||(b.ab-a.ab)||a.i-b.i).slice(0,NS()>20?12:8);return pool.map(s=>`<button class="pp${pick.has(s.i)?" on":""}" data-a="ask" data-v="${s.i}"><span class="av">${ini(s.nm)}</span>${esc(short(s.nm))} <small>${s.g} baho</small>${s.g===0?'<span class="why z">baho yo\'q</span>':s.ab?'<span class="why">kelmagan</span>':""}</button>`).join("");})()}</div>
    <div class="small muted">${p.ask.length} ta belgilangan · sinfda ${NS()} o'quvchi</div>
  </div>
  <div class="card" id="is-s-bah">
    <div class="sec-h"><span class="ic">${I("award")}</span><h3>Baholash mezonlari va dars yakuni</h3><span class="sp"></span><span class="small muted">Jami: ${p.mezon.reduce((a,x)=>a+x[1],0)} ball</span></div>
    ${p.mezon.map((x,k)=>`<div class="mzr"><input class="inp" data-f="mzm" data-j="${k}" value="${esc(x[0])}" aria-label="Mezon"><span class="mins"><button data-a="mz-" data-v="${k}" aria-label="−1 ball">${I("dash-lg")}</button><b>${x[1]} ball</b><button data-a="mz+" data-v="${k}" aria-label="+1 ball">${I("plus-lg")}</button></span><button class="ib sm" data-a="mzd" data-v="${k}" aria-label="O'chirish">${I("trash")}</button></div>`).join("")}
    <div class="row"><button class="btn sm" data-a="mzadd">${I("plus-lg")} Mezon qo'shish</button><span class="small muted">Baho darajalari varaqda o'zi yoziladi (10 ballik tizim).</span></div>
    <div class="fld"><label class="lbl" for="is-xul">Dars yakuni — xulosa</label><textarea id="is-xul" rows="2" data-f="xul">${esc(p.xul)}</textarea></div>
  </div>
  <div class="card" id="is-s-uy">
    <div class="sec-h"><span class="ic">${I("house-door")}</span><h3>Uyga vazifa</h3><span class="sp"></span><span class="tag">KTR bilan bir xil</span></div>
    <input class="inp" id="is-hw" data-f="hw" value="${esc(l.hw)}" placeholder="Masalan: §12, 315–318">
    <div class="small muted">Bu yerda o'zgartirsangiz, KTR va jurnaldagi shu dars uy vazifasi ham o'zgaradi.</div>
    ${l.kind==="bsb"||l.kind==="chsb"?"":`<div class="lbl">Darajali vazifa (o'quvchi o'ziga mosini tanlaydi)</div>
    <div class="hwl">${["A","B","C"].map(k=>`<span class="lv ${k}">${k}</span><input class="inp" data-f="hx" data-k="${k}" value="${esc(p.hwx[k])}" placeholder="${LVN[k]} daraja" aria-label="${k} daraja">`).join("")}
      <span class="lv" style="background:var(--vio-soft);color:var(--vio)">${I("stars")}</span><input class="inp" data-f="hx" data-k="ij" value="${esc(p.hwx.ij)}" placeholder="Ijodiy vazifa (ixtiyoriy)" aria-label="Ijodiy vazifa"></div>`}
  </div>`;
  if(past){const K=afterLesson(l);
    h+=`<div class="card" id="is-s-keyin"><div class="sec-h"><span class="ic">${I("list-check")}</span><h3>Darsdan keyin</h3><span class="sp"></span><span class="tag">Jurnaldan</span></div>
    <div class="kpi"><div><b>${K.att?`${K.came}/${NS()}`:"—"}</b><small>Keldi</small></div><div><b>${K.gr}</b><small>Baho qo'yildi</small></div><div><b>${K.avg?K.avg.toFixed(1):"—"}</b><small>O'rtacha baho</small></div><div><b>${p.ask.length}</b><small>So'ralishi kerak edi</small></div></div>
    <div class="fld"><label class="lbl" for="is-note">Izoh (o'zingiz uchun)</label><textarea id="is-note" rows="2" data-f="note" placeholder="Nima yaxshi o'tdi, nimaga vaqt yetmadi…">${esc(p.note)}</textarea></div></div>`;}
  return h;
}

function gameEd(p,g){
  if(g==="hayoq")return `<div class="gmbox"><b>«Ha–Yo'q» bayonotlari</b>${p.game.hy.map((x,k)=>`<div class="hyr"><span class="n">${k+1}</span><input class="inp" data-f="hyb" data-j="${k}" value="${esc(x.b)}" placeholder="Bayonot" aria-label="Bayonot"><button class="yn ${x.a==="Ha"?"ha":"yoq"}" data-a="hya" data-v="${k}">${x.a}</button><button class="ib sm" data-a="hyd" data-v="${k}" aria-label="O'chirish">${I("trash")}</button></div>`).join("")}<div><button class="btn sm" data-a="hyadd">${I("plus-lg")} Bayonot</button></div></div>`;
  if(g==="klaster")return `<div class="gmbox"><b>«Klaster» tarmoqlari · markazda mavzu</b><textarea rows="${p.game.kl.length+1}" data-f="kl" aria-label="Klaster tarmoqlari">${esc(p.game.kl.join("\n"))}</textarea><span class="small muted">Har qator — bitta tarmoq (6 tagacha yaxshi ko'rinadi).</span></div>`;
  if(g==="sinkveyn")return `<div class="gmbox"><b>«Sinkveyn» — 5 qatorli she'r</b>${SKL.map(([a,b2],k)=>`<div class="skr"><b>${a}<small>${b2}</small></b><input class="inp" data-f="sk" data-j="${k}" value="${esc(p.game.sk[k]||"")}" aria-label="${a}"></div>`).join("")}</div>`;
  return `<div class="gmbox"><b>«Besh barmoq» savollari</b>${p.game.bb.map((x,k)=>`<div class="bbr"><b>${x.f}<small>${x.t}</small></b><input class="inp" data-f="bbq" data-j="${k}" value="${esc(x.q)}" aria-label="Savol"><input class="inp" data-f="bba" data-j="${k}" value="${esc(x.a)}" placeholder="Kutiladigan javob" aria-label="Kutiladigan javob"></div>`).join("")}</div>`;
}
const LTX=[["\\frac{}{}","\\frac{a}{b}"],["^{}","a^n"],["\\sqrt{}","\\sqrt{x}"],["\\cdot ","\\cdot"],["\\neq ","\\neq"],["\\pm ","\\pm"],["\\le ","\\le"],["\\ge ","\\ge"],["\\pi","\\pi"],["^\\circ","90^\\circ"]];
function matBlock(b,j,n){
  const H=(ic,t)=>`<div class="mbh"><span class="k">${I(ic)} ${t}</span>${b.ai?`<button class="aitag${b.ai==="ok"?" ok":""}" data-a="aiok" data-v="${j}">${b.ai==="ok"?I("check-lg")+" Tekshirildi":I("stars")+" SI yozdi · tekshiring"}</button>`:""}<span class="sp"></span>
    <button class="ib sm" data-a="mshow" data-v="${j}" aria-label="Varaqda ko'rsatish">${I(b.show?"eye":"eye-slash")}</button><button class="ib sm" data-a="mup" data-v="${j}" ${j?"":"disabled"} aria-label="Yuqoriga">${I("arrow-up")}</button><button class="ib sm" data-a="mdel" data-v="${j}" aria-label="O'chirish">${I("trash")}</button></div>`;
  if(b.k==="g")return `<div class="mb${b.show?"":" off"}">${H("book","Qo'llanma")}<textarea rows="3" data-f="mb" data-j="${j}">${esc(b.v)}</textarea></div>`;
  if(b.k==="f")return `<div class="mb${b.show?"":" off"}">${H("calculator","Formula")}<input class="inp ltx" data-f="mb" data-j="${j}" value="${esc(b.v)}" aria-label="Formula, LaTeX kodi" spellcheck="false"><div class="ltb">${LTX.map(([c,t])=>`<button class="chip sm" data-a="ltx" data-v="${j}|${esc(c)}" title="${esc(c)}">${km(t)}</button>`).join("")}</div><div class="fx" data-pv="${j}">${fF(b.v)}</div><div class="small muted">LaTeX kodi: kasr <code>\\frac{a}{b}</code>, daraja <code>a^2</code>, ildiz <code>\\sqrt{x}</code>, ko'paytma <code>\\cdot</code>. Matn ichida formulani <code>$...$</code> orasiga yozing.</div></div>`;
  if(b.k==="fig")return `<div class="mb${b.show?"":" off"}">${H("bounding-box","Chizma")}<div class="fig">${figSvg(b.v)}</div><input class="inp" data-f="mbc" data-j="${j}" value="${esc(b.cap)}" aria-label="Chizma izohi"></div>`;
  if(b.k==="img")return `<div class="mb${b.show?"":" off"}">${H("image","Rasm")}<img class="imgp" src="${b.v}" alt="${esc(b.cap)}"><input class="inp" data-f="mbc" data-j="${j}" value="${esc(b.cap)}" placeholder="Rasm izohi" aria-label="Rasm izohi"></div>`;
  if(b.k==="ex")return `<div class="mb${b.show?"":" off"}">${H("list-ol","Namunaviy yechim")}<textarea rows="${Math.max(3,b.v.split("\n").length)}" data-f="mb" data-j="${j}" style="font-family:&#39;BV Serif&#39;,&#39;Liberation Serif&#39;,&#39;Times New Roman&#39;,serif">${esc(b.v)}</textarea><ol class="exs" data-pv="${j}">${b.v.split("\n").filter(x=>x.trim()).map(x=>`<li>${fx(x)}</li>`).join("")}</ol></div>`;
  if(b.k==="n")return `<div class="mb${b.show?"":" off"}">${H("exclamation-triangle","Eslatma")}<textarea rows="2" data-f="mb" data-j="${j}">${esc(b.v)}</textarea></div>`;
  return "";
}
function matCard(l,p){
  const lib=!!MAT[l.tk],nz=l.kind==="bsb"||l.kind==="chsb";
  return `<div class="card" id="is-s-mat">
    <div class="sec-h"><span class="ic">${I("book")}</span><h3>Mavzu materiali</h3><span class="sp"></span>${lib?`<span class="tag">${I("bookmark-star")} Kutubxonadan</span>`:""}</div>
    ${p.mat.length?`<div class="small muted">Qo'llanma, formula, chizma va namunaviy yechim «Varaq»da alohida «Qo'llanma» betiga chiqadi, darsda esa ekranga ko'rsatiladi. ${I("eye")} belgisi varaqda chiqish-chiqmasligini boshqaradi.</div>`
      :`<div class="hint">${I("info-circle")}<span>${nz?"Nazorat darsi uchun material shart emas.":"Kutubxonada bu mavzu uchun tayyor material yo'q. Quyidagi tugmalar bilan o'zingiz qo'shing yoki chizmani rasmga olib yuklang. Siz qo'shgan material keyingi yil va boshqa sinflarda ham tayyor turadi."}</span></div>`}
    ${nz?"":`<div class="aibar"><span class="oi">${I("stars")}</span><span><b>${p.mat.length?"SI bilan boyitish":"SI bilan to'ldirish"} · bepul</b><small>So'rovni ChatGPT, Claude yoki Gemini'ga qo'yasiz, javobni shu yerga qaytarasiz — dastur bo'limlarga o'zi ajratadi</small></span><button class="btn sm vio" data-a="ai">${I("stars")} Boshlash</button></div>`}
    ${p.mat.map((b,j)=>matBlock(b,j)).join("")}
    <div class="chips">${[["g","book","Matn"],["f","calculator","Formula"],["fig","bounding-box","Chizma"],["img","image","Rasm"],["ex","list-ol","Namuna"],["n","exclamation-triangle","Eslatma"]].map(([k,ic,t])=>`<button class="chip add" data-a="madd" data-v="${k}">${I(ic)} ${t}</button>`).join("")}</div>
  </div>`;
}
function matPage(l,p,o){
  const B=p.mat.filter(b=>b.show);if(!B.length&&!o.mat)return "";
  const F=B.filter(b=>b.k==="f"),G=B.filter(b=>b.k==="fig"||b.k==="img"),X=B.filter(b=>b.k==="ex");
  const one=b=>b.k==="g"?`<p style="margin:0">${fx(b.v)}</p>`:b.k==="n"?`<div class="nbx">${I("exclamation-triangle")}<span><b>Eslatma:</b> ${fx(b.v)}</span></div>`:"";
  const figH=b=>`<div><div class="fig">${b.k==="img"?`<img class="imgp" src="${b.v}" alt="">`:figSvg(b.v)}</div><div class="cap">${fx(b.cap||"")}</div></div>`;
  return `<div class="a4${pcls(o)}">${frame(o)}
    <div class="top"><span>${cls()} sinf · ${esc(SUBJ())} · ${fS(l.d)}</span><span>Mavzu bo'yicha qo'llanma</span></div>
    <h2>${esc(l.t)}</h2><div class="ml">Qisqa nazariya · formulalar · chizma · namunaviy yechim</div>
    ${B.filter(b=>b.k==="g").map(one).join("")}
    ${F.length?`<h4>Formulalar</h4>${F.map(b=>`<div class="fx">${fF(b.v)}</div>`).join("")}`:""}
    ${G.length||X.length?`<div class="gx">${G.length?`<div>${"<h4>Chizma</h4>"+G.map(figH).join("")}</div>`:""}${X.length?`<div><h4>Namunaviy yechim</h4>${X.map(b=>`<ol class="exs">${b.v.split("\n").filter(x=>x.trim()).map(x=>`<li>${fx(x)}</li>`).join("")}</ol>`).join("")}</div>`:""}</div>`:""}
    ${B.filter(b=>b.k==="n").map(one).join("")}
    ${o.tasks&&p.tasks.some(t=>t.q.trim())?`<h4>Darsdagi topshiriqlar</h4><div class="tk">${p.tasks.filter(t=>t.q.trim()).map(t=>`<span><em>${t.lv}</em>${fx(t.q)}</span>`).join("")}</div>`:""}
    <div class="hwb"><b>Uyga vazifa: ${esc(L[st.cur].hw||"—")}</b>${hwLines(p)}</div>
    ${o.quote?`<div class="qt" style="margin-top:auto">«${QUOTES[st.cur%QUOTES.length]}»</div>`:""}
    <div class="ft"${o.quote?"":` style="margin-top:auto"`}><span>${cls()} ${esc(SUBJ())} · Qo'llanma · ${fS(l.d)}</span><span>2</span></div></div>`;
}
const hwLines=p=>["A","B","C"].filter(k=>p.hwx[k]).map(k=>`<span><em style="font-style:normal;font-weight:800">${k} (${LVN[k]}):</em> ${fx(p.hwx[k])}</span>`).join("")+(p.hwx.ij?`<span><em style="font-style:normal;font-weight:800">Ijodiy:</em> ${fx(p.hwx.ij)}</span>`:"");
const NAQSH=(()=>{const c=["#0d8a87","#e9a23b"];let r="";for(let y=0;y<3;y++)for(let x=0;x<3;x++){const cx=5.5+x*11,cy=5.5+y*11,col=c[(x+y)%2];r+=`<path d='M${cx} ${cy-4.5}L${cx+4.5} ${cy}L${cx} ${cy+4.5}L${cx-4.5} ${cy}Z' fill='${col}'/><circle cx='${cx}' cy='${cy}' r='1.4' fill='white'/>`;}return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='33' height='33'>${r}</svg>`).replace(/'/g,"%27")}")`;})();
if(!document.getElementById("is-ish-naqsh"))document.head.insertAdjacentHTML("beforeend",`<style id="is-ish-naqsh">:is(#ishp,#ishd) .a4 .frm.naqsh{border-image:${NAQSH} 11 round}</style>`);
const frame=o=>o.frame==="none"?"":`<div class="frm ${o.frame}"></div>`;
/* ── varaq ── */
const ul=x=>`<ul class="bl">${lines(x).map(y=>`<li>${fx(y)}</li>`).join("")}</ul>`;
const ffNow=o=>ISHV.setOf(o.fmt==="bat"?o.vs:"A",o.ff)[0];   // «Uslubga mos» bo'lsa ham haqiqiy to'plam (B → Rasmiy)
const pcls=o=>`${ffNow(o)==="ras"?" tnr":""}${o.frame!=="none"?" fr":""}${o.frame==="naqsh"?" dec":""}`;
function paginate(chunks,o,foot,start,total){
  let m=document.getElementById("is-meas");if(!m){m=document.createElement("div");m.id="is-meas";m.style.cssText="position:absolute;left:-12000px;top:0;visibility:hidden;width:794px";document.body.appendChild(m);}
  m.innerHTML=`<div id="ishd"><div class="a4 bat${pcls(o)}">${frame(o)}<div class="ft"><span>x</span><span>1/1</span></div></div></div>`;
  const pg=m.firstChild.firstChild,ft=pg.querySelector(".ft"),P2=[];let cur=[];
  const cs=[];let gl="";chunks.filter(Boolean).forEach(c=>{if(c[0]==="\u0001"){gl+=c.slice(1);return;}cs.push(gl+c);gl="";});if(gl)cs.push(gl);
  cs.forEach(c=>{const w=`<div class="ck">${c}</div>`;ft.insertAdjacentHTML("beforebegin",w);
    if(pg.scrollHeight>1124&&cur.length){P2.push(cur);cur=[];pg.querySelectorAll(".ck").forEach(e=>e.remove());ft.insertAdjacentHTML("beforebegin",w);}cur.push(w);});
  if(cur.length)P2.push(cur);m.innerHTML="";return P2;
}
// «Batafsil» — yangi varaq (ishlanma-varaq.js, maket «Ishlanma varag'i» v2): uslub o.vs (A/B/C), shrift o.ff; kartochka va rag'bat betlari — eski
function fullPages(l,p,o){
  const C=st.cover,H=(typeof D!=="undefined"&&D.web&&D.web.bsb_hdr)||{},stud=students(),dl0=dd(l.d),yr=dl0.getMonth()>=8?dl0.getFullYear():dl0.getFullYear()-1;
  const place=[C.vil?`${C.vil} viloyati`:"",C.tum?`${C.tum} tumani`:""].filter(Boolean).join(" ");
  const cv={fio:(C.fio||H.teacher||"").trim(),school:C.mak?`${C.mak}-sonli umumiy o'rta ta'lim maktabi`:(H.school||"").trim(),place,fan:C.fan,ochiq:!!C.ochiq,yr};
  const R=ISHV.pages({l,p,o,cv,ask:(p.ask||[]).filter(i=>stud[i]).map(i=>short(stud[i].nm)),T:p.tasks.filter(t=>t.q.trim()),MB:p.mat.filter(b=>b.show),quote:QUOTES[st.cur%QUOTES.length],
    cls:cls(),sub:SUBJ(),ql:QL(),sum,esc,fx,fF,figSvg,klSvg,I,lines,fS,fL,dd});
  const T=p.tasks.filter(t=>t.q.trim()),extra=[];if(o.cards&&T.length)extra.push("cards");if(o.rag)extra.push("rag");
  const N=(R.cover?1:0)+R.body.length+extra.length;let n=R.cover?1:0;
  const cover=R.cover?R.cover.replace("<div ",'<div id="is-a4" '):"";
  const pages=R.body.map(b=>{n++;return ISHV.page(b,n,N,!R.cover&&n===1?"is-a4":"");});
  let ex="";extra.forEach(k=>{n++;if(k==="cards")ex+=cardsPage(l,p).replace(/<span>\d+<\/span><\/div><\/div>$/,`<span>${n}/${N}</span></div></div>`);else ex+=ragPage(l,o,n,N);});
  st.pc={N,body:R.body.length};
  return cover+pages.join("")+ex;
}
function ragPage(l,o,n,N){
  const R2=[["trophy-fill","A'lo natija!","10 bahoga loyiq","#e9a23b","#fff6e0"],["star-fill","Bugungi lider","Darsning eng faol o'quvchisi","#6d5bd0","#f1eefe"],["lightning-fill","Faol o'quvchi","Har savolga qo'l ko'tardi","#0d8a87","#e3f4f3"],["lightbulb-fill","Eng yaxshi savol","Qiziqarli savol uchun","#2f80c9","#e6f0fb"],["people-fill","Jamoa sardori","Guruhni to'g'ri yo'naltirdi","#1f9d55","#e3f5ea"],["palette-fill","Ijodkor","O'z yechim usulini topdi","#d9534f","#fde8e7"]];
  return `<div class="a4 bat${pcls(o)}">${frame(o)}<div class="top"><span>${cls()} sinf · ${esc(l.t)}</span><span>Rag'bat kartochkalari</span></div>
    <div class="rag">${R2.map(([i,t,s2,c,bg])=>`<div class="rc2" style="color:${c};background:${bg}">${I(i)}<b>${t}</b><small>${s2}</small></div>`).join("")}</div>
    <div class="ft"><span>Qirqib, darsda tarqating</span><span>${n}/${N}</span></div></div>`;
}
// eski shakllar (Jadval, Qisqa): «Rasmiy» to'plam — eski Times uslubi (tnr), boshqalari — data-ff bilan
const oldFf=h=>{const k=ffNow(st.paper);if(k==="zam"||k==="ras")return h;return h.replace(/<div class="a4/g,`<div${ISHV.fattr("A",k)} class="a4`);};
function paperHtml(){return oldFf(paperHtml0());}
function paperHtml0(){
  const l=L[st.cur],p=P(),o=st.paper;if(!p)return `<div class="card"><p class="muted" style="margin:0">Avval ishlanmani to'ldiring.</p><div><button class="btn pri" data-a="auto">${I("magic")} Avtomatik to'ldirish</button></div></div>`;
  if(o.fmt==="bat"){if(!p.ask)p.ask=suggest();return fullPages(l,p,o);}
  if(!p.ask)p.ask=suggest();const stud=students(),ask=p.ask.map(i=>short(stud[i].nm));
  const flow=p.st.map(s=>`<tr><td>${esc(s.n)}</td><td>${s.m} daq</td><td>${fx(f1(s.t))}${o.ask&&/Uy vazifasini|Savol-javob/.test(s.n)&&ask.length?`<br><i>So'raladi: ${esc(ask.join(", "))}</i>`:""}</td><td>${fx(f1(s.s))}</td></tr>`).join("");
  const short2=p.st.map(s=>`<tr><td>${esc(s.n)}</td><td>${s.m} daq</td><td colspan="2">${fx(f1(s.t))}</td></tr>`).join("");
  const F1=p.mat.find(b=>b.k==="f"&&b.show);
  return `<div class="a4${pcls(o)}" id="is-a4">${frame(o)}${o.wm&&F1?`<div class="wm">${km(F1.v.split("=")[0])}</div>`:""}
    ${o.school?`<div class="top"><span>${st.cover.mak?`${esc(st.cover.mak)}-sonli umumiy o'rta ta'lim maktabi`:""}</span><span>Chop etildi: ${fS(TODAY)}</span></div>`:""}
    <h2>Dars ishlanmasi</h2>
    <div class="ml">${cls()} sinf · ${esc(SUBJ())} · ${QL()}, ${l.n}-dars · ${fS(l.d)}</div>
    <table class="info"><tr><th>Mavzu</th><td><b>${esc(l.t)}</b>${l.h>1?` (${l.k}-dars)`:""}</td></tr>
      <tr><th>Dars turi</th><td>${esc(p.type)}</td></tr>
      ${o.fmt==="full"?`<tr><th>Metodlar</th><td>${esc([...p.met].join(", "))}</td></tr><tr><th>Jihozlar</th><td>${esc([...p.jih].join(", "))}</td></tr><tr><th>Fanlararo bog'liqlik</th><td>${esc(p.fan)}</td></tr>`:`<tr><th>Metod va jihozlar</th><td>${esc([...p.met,...p.jih].join(", "))}</td></tr>`}</table>
    <h4>Darsning maqsadi</h4>
    <div class="gl"><b>Ta'limiy:</b><span>${esc(p.g[0])}</span><b>Tarbiyaviy:</b><span>${esc(p.g[1])}</span><b>Rivojlantiruvchi:</b><span>${esc(p.g[2])}</span></div>
    ${o.fmt==="full"?`<div class="gl"><b>Kompetensiyalar:</b><span>${esc([...p.komp].join(", "))}</span><b>Kutilayotgan natija:</b><span>${esc(lines(p.res).slice(0,2).join(" "))}</span></div>`:""}
    <h4>Darsning borishi</h4>
    <table class="flow"><tr><th>Bosqich</th><th>Vaqt</th><th>O'qituvchi faoliyati</th><th>O'quvchi faoliyati</th></tr>${o.fmt==="full"?flow:short2}<tr><td>Jami</td><td>${sum(p)} daq</td><td colspan="2"></td></tr></table>
    ${o.tasks&&p.tasks.some(t=>t.q.trim())&&!(o.mat&&p.mat.some(b=>b.show))?`<div class="gl"><b>Topshiriqlar:</b><div class="tk">${p.tasks.filter(t=>t.q.trim()).map(t=>`<span><em>${t.lv}</em>${fx(t.q)}${t.a?` <i>→ ${fx(t.a)}</i>`:""}</span>`).join("")}</div></div>`:""}
    <div class="gl"><b>Uyga vazifa:</b><span>${esc(l.hw||"—")}${p.hwx.A||p.hwx.ij?` · ${["A","B","C"].filter(k=>p.hwx[k]).map(k=>`<b>${k}:</b> ${esc(p.hwx[k])}`).join("; ")}${p.hwx.ij?`<br><b>Ijodiy:</b> ${fx(p.hwx.ij)}`:""}`:""}</span></div>
    ${o.tick?`<div class="gl"><b>Dars o'tildi:</b><span><span class="tick"></span>to'liq &nbsp; <span class="tick"></span>qisman &nbsp; Izoh: ______________________</span></div>`:""}
    ${o.quote&&!(o.mat&&p.mat.some(b=>b.show))?`<div class="qt">«${QUOTES[st.cur%QUOTES.length]}»</div>`:""}
    ${o.sig?`<div class="sig"><span>O'qituvchi:<span></span></span><span>Tekshirdi (O'IBDO'):<span></span></span></div>`:""}
    <div class="ft"><span>${cls()} ${esc(SUBJ())} · Dars ishlanmasi · ${fS(l.d)}</span><span id="is-pgn">1/1</span></div></div>${o.mat&&p.mat.some(b=>b.show)?matPage(l,p,o):""}${o.cards&&p.tasks.some(t=>t.q.trim())?cardsPage(l,p):""}`;
}
function cardsPage(l,p){
  const T=p.tasks.filter(t=>t.q.trim());
  const o=st.paper;
  return `<div class="a4${pcls(o)}">${frame(o)}<div class="top"><span>${cls()} sinf · ${esc(SUBJ())} · ${fS(l.d)}</span><span>Tarqatma kartochkalar</span></div>
    <div class="cards">${groups().map((g,k)=>`<div class="kc"><h5>${k+1}-guruh</h5><div class="mem">${esc(g.map(s=>short(s.nm)).join(", "))}</div><div class="mem"><b>Mavzu:</b> ${esc(l.t)}</div>
      <ol>${(T.length>5?(()=>{const by=lv=>T.filter(t=>t.lv===lv),A=by("A"),B=by("B"),C=by("C"),pk=(a,j)=>a.length?a[j%a.length]:null;return [...new Set([pk(A,k),pk(A,k+1),pk(B,k),pk(B,k+1),pk(C,k)].filter(Boolean))];})():T).map(t=>`<li><span>${t.lv}</span>${fx(t.q)}<div class="wl"></div><div class="wl"></div></li>`).join("")}</ol></div>`).join("")}</div>
    <div class="ft"><span>${cls()} ${esc(SUBJ())} · Tarqatma · ${fS(l.d)}</span><span>${o.mat&&P().mat.some(b=>b.show)?3:2}</span></div></div>`;
}
function paperTab(){
  const o=st.paper,c=(k,v,t)=>`<button class="chip${o[k]===v?" on":""}" data-a="po" data-k="${k}" data-v="${v}">${t}</button>`,b=(k,t)=>`<button class="chip${o[k]?" on":""}" data-a="pb" data-k="${k}">${o[k]?I("check-lg"):""}${t}</button>`;
  const C=st.cover,bat=o.fmt==="bat";
  return `<div class="card"><div class="ptb"><span class="lbl">Shakl</span><div class="chips">${c("fmt","bat","Batafsil (muqova bilan)")}${c("fmt","full","Jadval (1 bet)")}${c("fmt","short","Qisqa (1 bet)")}</div></div>
    ${bat?`<div class="ptb"><span class="lbl">Uslub</span><div class="chips">${ISHV.STY.map(([k,t])=>c("vs",k,`${k} · ${t}`)).join("")}</div><span class="small muted vdesc">${ISHV.STY.find(x=>x[0]===o.vs)?.[2]||""}</span></div>`:""}
    <div class="ptb"><span class="lbl">Shrift</span><div class="chips">${c("ff","auto",`Uslubga mos <small>${ISHV.setOf(bat?o.vs:"A","auto")[1]}</small>`)}${ISHV.FSETS.map(r=>`<button class="chip vff${o.ff===r[0]?" on":""}" data-a="po" data-k="ff" data-v="${r[0]}" style="font-family:${r[2]==="Times"?"'BV Serif','Times New Roman',serif":r[2]==="Arial"?"'BV Sans',Arial,sans-serif":"inherit"}">${r[1]} <small>${r[2]===r[3]?ISHV.fname(r[2]):`${ISHV.fname(r[2])} + ${r[3]}`}</small></button>`).join("")}</div><span class="small muted vdesc">${(r=>`Sarlavha: ${ISHV.fname(r[2])} · matn: ${ISHV.fname(r[3])}. ${r[4]}. Ekran, chop etish va PDF'da bir xil.`)(ISHV.setOf(bat?o.vs:"A",o.ff))}</span></div>
    <div class="ptb"><span class="lbl">Varaqda</span><div class="chips">${bat?b("cover","Muqova")+b("ask","So'raladiganlar")+b("tasks","Topshiriqlar")+b("cards","Tarqatma kartochkalar")+b("rag","Rag'bat kartochkalari")+b("sig","Imzo"):b("school","Maktab nomi")+b("ask","So'raladiganlar")+b("mat","Qo'llanma beti")+b("tasks","Topshiriqlar")+b("cards","Tarqatma kartochkalar")+b("tick","«Dars o'tildi» belgisi")+b("sig","Imzo")}</div></div>
    ${bat&&o.cover?`<div class="ptb"><span class="lbl">Muqova</span><input class="inp" style="width:130px" data-f="cv" data-k="fan" value="${esc(C.fan)}" placeholder="Fan" aria-label="Fan nomi"><input class="inp" style="width:130px" data-f="cv" data-k="vil" value="${esc(C.vil)}" placeholder="Viloyat" aria-label="Viloyat"><input class="inp" style="width:120px" data-f="cv" data-k="tum" value="${esc(C.tum)}" placeholder="Tuman" aria-label="Tuman"><input class="inp" style="width:70px" data-f="cv" data-k="mak" value="${esc(C.mak)}" placeholder="Maktab №" aria-label="Maktab raqami"><input class="inp" style="width:200px" data-f="cv" data-k="fio" value="${esc(C.fio)}" placeholder="O'qituvchi F.I.Sh." aria-label="O'qituvchi familiyasi, ismi"><button class="chip${C.ochiq?" on":""}" data-a="ochiq">${C.ochiq?I("check-lg"):""}Ochiq dars</button></div>`:""}
    <div class="ptb"><span class="lbl">Bezak</span><div class="chips">${bat?"":c("frame","none","Ramkasiz")+c("frame","line","Ramka")+c("frame","naqsh","Naqshli ramka")+b("wm","Formula fon")}${b("quote","Hikmatli so'z")}</div></div></div>
    <div class="row"><span class="pages" id="is-pgs">${I("file-earmark-text")} 1 bet</span><span class="sp"></span><button class="btn" data-a="exp">${I("download")} Eksport</button></div>
    <div class="pw" id="is-pw"><div class="pstack" id="is-ps">${paperHtml()}</div></div>`;
}
function draw(){
  const app=document.getElementById("ishp");if(!app)return;
  app.className="ish"+(st.dev==="tel"?" tel":"");
  const p=P();
  if(!L.length){app.innerHTML=noLessons()+'<div id="is-ov"></div>';drawOv();return;}
  app.innerHTML=`<main class="ismain">${header()}
    <div class="cols"><aside class="lst">${listHtml()}</aside>
      <div style="display:flex;flex-direction:column;gap:12px;min-width:0">
        ${p?`<div class="tabs"><button class="${st.tab==="edit"?"on":""}" data-a="tab" data-v="edit">${I("pencil")} Tahrirlash</button><button class="${st.tab==="paper"?"on":""}" data-a="tab" data-v="paper">${I("eye")} Varaq</button></div>`:""}
        ${p&&st.tab==="edit"?hero()+statusBar():""}
        ${st.tab==="paper"&&p?paperTab():editor()}
      </div></div></main><div id="is-ov"></div>`;
  app.querySelectorAll(".tl-only").forEach(e=>e.hidden=st.dev==="tel");
  fitPaper();drawOv();later();
  if(st.tab==="paper"&&p&&!ISHV.ready(vsNow(),st.paper.ff))vFonts().then(()=>{const ps=document.getElementById("is-ps");if(ps&&st.tab==="paper"){ps.innerHTML=paperHtml();fitPaper();}},e=>console.warn("Ishlanma shrifti:",e));
}
// tanlangan shrift to'plami uchun PDF bilan bir xil shriftlar (BV Serif/BV Sans) ulanadi; ulangach varaq qayta o'lchanadi
const vsNow=()=>st.paper.fmt==="bat"?st.paper.vs:"A";
const vFonts=()=>ISHV.loadFonts(vsNow(),st.paper.ff);
function fitPaper(){
  const pw=document.getElementById("is-pw"),a=document.getElementById("is-a4"),ps=document.getElementById("is-ps");if(!pw||!a)return;
  a.querySelectorAll(".brk").forEach(e=>e.remove());
  const o2=st.paper,s=Math.min(1,pw.clientWidth/794),h=a.offsetHeight,n=Math.max(1,Math.ceil((h-2)/1123)),extra=ps.children.length-1;
  ps.style.transform=`scale(${s})`;pw.style.height=ps.offsetHeight*s+"px";
  for(let k=1;k<n;k++){const b=document.createElement("div");b.className="brk";b.style.top=1123*k+"px";b.innerHTML=`<span>${k+1}-bet</span>`;a.appendChild(b);}
  const pn=document.getElementById("is-pgn");if(pn)pn.textContent=n>1?`1–${n}`:"1/1";
  const pg=document.getElementById("is-pgs");
  if(o2.fmt==="bat"&&st.pc){pg.className="pages";const k=[o2.cover?"muqova":"",`ishlanma ${st.pc.body} bet`,o2.cards&&P().tasks.some(t=>t.q.trim())?"kartochkalar":"",o2.rag?"rag'bat":""].filter(Boolean).join(" + ");pg.innerHTML=`${I("file-earmark-text")} ${st.pc.N} bet: ${k} · A4`;return;}pg.className="pages"+(n>1?" w":"");pg.innerHTML=n>1?`${I("exclamation-triangle")} ${n} bet — «Qisqa» shakl 1 betga sig'adi`:`${I("check-lg")} Ishlanma 1 bet${extra?` + ${extra} bet (${[o2.mat&&P().mat.some(b=>b.show)?"qo'llanma":"",o2.cards?"kartochkalar":""].filter(Boolean).join(", ")})`:""} · A4`;
}

/* ── oynalar ── */
function drawOv(){
  const ov=document.getElementById("is-ov"),g=st.dlg;
  let h="";
  if(g==="exp"){const l=L[st.cur];h=`<div class="ov" data-a="close"><div class="sheet" role="dialog" aria-label="Eksport"><div class="sh2"><h3>Eksport</h3><button class="ib sm" data-a="close" aria-label="Yopish">${I("x-lg")}</button></div><div class="sbd">
    <div class="small muted">${cls()} ${esc(SUBJ())} · Dars ishlanmasi · ${fS(l.d)}</div>
    ${[["printer","Chop etish","A4, varaqdagi ko'rinishda","var(--text)"],["file-earmark-word","Word (.doc)","Tahrirlash uchun, maktab shakliga moslash mumkin","#2b6cd4"],["filetype-pdf","PDF","Saqlash yoki yuborish uchun","#d64545"],["telegram","Telegram","PDF'ni «Telegram'ga zaxira» botingizga yuborish","#229ed9"]].map(([i,t,s,c],k)=>`<button class="opt" data-a="ex" data-v="${["print","word","pdf","tg"][k]}"><span class="oi" style="color:${c}">${I(i)}</span><span><b>${t}</b><small>${s}</small></span>${I("chevron-right","muted")}</button>`).join("")}
    <div class="lbl" style="margin-top:4px">Bir nechta dars</div>
    <button class="opt" data-a="exwk" ${weekIdx().length?"":"disabled"}><span class="oi">${I("files")}</span><span><b>Shu haftaning ishlanmalari (PDF)</b><small>${weekIdx().length} ta tayyorlangan ishlanma · bitta PDF faylda</small></span>${I("chevron-right","muted")}</button>
      </div></div></div>`;}
  if(g==="copy"){const l=L[st.cur];h=`<div class="ov" data-a="close"><div class="sheet" role="dialog" aria-label="Nusxa"><div class="sh2"><h3>Nusxa olish / berish</h3><button class="ib sm" data-a="close" aria-label="Yopish">${I("x-lg")}</button></div><div class="sbd">
${copyOpts(l)}
    <div class="hint">${I("info-circle")}<span>Nusxa olinganda sana, sinf, uy vazifasi va so'raladigan o'quvchilar shu darsnikiga almashadi.</span></div></div></div></div>`;}
  if(g==="tpl"){h=`<div class="ov" data-a="close"><div class="sheet" role="dialog" aria-label="Shablon"><div class="sh2"><h3>Shablon</h3><button class="ib sm" data-a="close" aria-label="Yopish">${I("x-lg")}</button></div><div class="sbd">
    <button class="opt" data-a="tplsave"><span class="oi">${I("bookmark-star")}</span><span><b>Shu darsni shablon qilish</b><small>«${esc(P().type)}» turidagi keyingi darslar shu bosqich, metod va maqsadlar bilan to'ldiriladi</small></span>${I("chevron-right","muted")}</button>
    <button class="opt" data-a="tplreset" ${tplOf(P().type)?"":"disabled"}><span class="oi">${I("arrow-repeat")}</span><span><b>Standart shablon</b><small>${tplOf(P().type)?`Saqlangan «${esc(P().type)}» shabloni o'chiriladi, ilovadagi tayyor andoza ishlatiladi`:"Hozir ilovadagi tayyor andoza ishlatilmoqda"}</small></span>${I("chevron-right","muted")}</button>
  </div></div></div>`;}
  if(g==="list"){h=`<div class="ov" data-a="close"><div class="sheet" role="dialog" aria-label="Darslar"><div class="sh2"><h3>Darslar</h3><button class="ib sm" data-a="close" aria-label="Yopish">${I("x-lg")}</button></div><div class="sbd" style="padding:0"><div class="lst" style="position:static;border:0;box-shadow:none;max-height:none">${listHtml()}</div></div></div></div>`;}
  if(g==="auto"){h=`<div class="ov" data-a="close"><div class="sheet" role="dialog" aria-label="Qaytadan to'ldirish"><div class="sh2"><h3>Qaytadan to'ldirish</h3><button class="ib sm" data-a="close" aria-label="Yopish">${I("x-lg")}</button></div><div class="sbd">
    <p style="margin:0">Maqsad, metod va bosqichlar «${esc(P().type)}» turi bo'yicha qayta yoziladi. Siz yozgan matnlar o'chadi.</p><div class="row" style="align-items:center"><span class="lbl">Batafsillik</span><div class="chips">${[["qisqa","Qisqa"],["orta","O'rta"],["bat","Batafsil"]].map(([k,t])=>`<button class="chip${st.gen===k?" on":""}" data-a="gen" data-v="${k}">${t}</button>`).join("")}</div></div><div class="small muted">${{qisqa:"Har bosqichga 1 qator — tez ko'rib chiqish uchun.",orta:"Har bosqichda 2–4 band, asosiy savollar.",bat:"Har bosqich daqiqalarga bo'lingan, namuna nutq, savollar javobi bilan, 8 ta A/B/C topshiriq (javoblari bilan), qo'shimcha yechilgan misollar, «Ha–Yo'q» bayonotlari, nazorat ishida 2 variant."}[st.gen]}</div>
    <div class="row"><span class="sp"></span><button class="btn" data-a="close">Bekor qilish</button><button class="btn pri" data-a="doauto">${I("magic")} To'ldirish</button></div></div></div></div>`;}
  if(g==="bulk"){const free=(a,b)=>L.map((l,i)=>[l,i]).filter(([l,i])=>l.d>=a&&l.d<=b&&!st.plans[i]);const w=free(wkFrom(1),wkTo(1)),w2=free(wkFrom(1),wkTo(2)),q=free(TODAY,qEnd());
    h=`<div class="ov" data-a="close"><div class="sheet" role="dialog" aria-label="To'ldirish"><div class="sh2"><h3>Bir nechta darsni to'ldirish</h3><button class="ib sm" data-a="close" aria-label="Yopish">${I("x-lg")}</button></div><div class="sbd">
    <div class="small muted">Faqat ishlanmasi yo'q darslar «Qoralama» bo'lib to'ldiriladi. Tayyor ishlanmalarga tegilmaydi.</div>
    ${[["w","Keyingi hafta",w],["w2","Keyingi 2 hafta",w2],["q","Chorak oxirigacha",q]].map(([k,t,a])=>`<button class="opt" data-a="dobulk" data-v="${k}" ${a.length?"":"disabled"}><span class="oi">${I("magic")}</span><span><b>${t}</b><small>${a.length?`${a.length} ta dars: ${a.slice(0,3).map(([l])=>fL(l.d).split(",")[0]).join(", ")}${a.length>3?"…":""}`:"Hammasi to'ldirilgan"}</small></span>${I("chevron-right","muted")}</button>`).join("")}
    <div class="hint">${I("bookmark-star")}<span>Saqlangan shabloningiz bo'lsa, to'ldirish o'sha bo'yicha bo'ladi.</span></div></div></div></div>`;}
  if(g==="fig"){h=`<div class="ov" data-a="close"><div class="sheet" role="dialog" aria-label="Chizma"><div class="sh2"><h3>Chizma qo'shish</h3><button class="ib sm" data-a="close" aria-label="Yopish">${I("x-lg")}</button></div><div class="sbd">
    <div class="pick">${Object.entries(FIGS).map(([k,t])=>`<button data-a="dofig" data-v="${k}"><div class="fig">${figSvg(k)}</div>${t}</button>`).join("")}</div>
    <div class="hint">${I("image")}<span>Doskadagi yoki daftardagi chizmani rasmga olib «Rasm» tugmasi bilan qo'shish ham mumkin.</span></div></div></div></div>`;}
  if(g==="ai"){const l=L[st.cur],p=P(),pr=aiPrompt(l,p),A=st.ai,r=A.res;
    h=`<div class="ov" data-a="close"><div class="sheet" role="dialog" aria-label="SI bilan to'ldirish" style="width:min(640px,100%)"><div class="sh2"><h3>${I("stars")} SI bilan to'ldirish · bepul</h3><button class="ib sm" data-a="close" aria-label="Yopish">${I("x-lg")}</button></div><div class="sbd">
    <div class="stp"><i class="n">1</i>So'rovni nusxalang va SI ilovasiga qo'ying</div>
    <div class="prm" id="is-prm">${esc(pr)}</div>
    <div class="row"><button class="btn sm pri" data-a="aicopy">${I("copy")} Nusxalash</button><div class="lnk3"><a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT ${I("box-arrow-up-right")}</a><a href="https://claude.ai/" target="_blank" rel="noopener">Claude ${I("box-arrow-up-right")}</a><a href="https://gemini.google.com/" target="_blank" rel="noopener">Gemini ${I("box-arrow-up-right")}</a></div></div>
    <div class="stp"><i class="n">2</i>SI javobini shu yerga qo'ying</div>
    <textarea id="is-aitx" rows="6" data-f="ai" placeholder="QO'LLANMA: …&#10;FORMULA: …">${esc(A.txt)}</textarea>
    <div class="row"><span class="sp"></span><button class="btn sm pri" data-a="aiparse">${I("magic")} Bo'limlarga ajratish</button></div>
    ${r?`<div class="stp"><i class="n">3</i>Tekshiring va qo'shing</div>
    <div class="prs">${[["Qo'llanma",r.g?1:0],["Formula",r.f.length],["Yechim qadami",r.ex.length],["Eslatma",r.n?1:0],["Topshiriq",r.tasks.length],["Uy vazifasi",Object.keys(r.hw).length],["Natija",r.res.length],["Namuna matn",r.nm?1:0],["Savol",r.q.length],["Ha–Yo'q",r.hy.length],["Xulosa",r.xul?1:0]].map(([t,n])=>`<span class="${n?"":"w"}">${n?I("check-lg"):I("exclamation-triangle")} ${t}: ${n}</span>`).join("")}</div>
    ${r.f.length?`<div class="fx">${r.f.map(fx).join("<br>")}</div>`:""}
    ${r.tasks.length?`<div class="small muted">Topshiriqlar: ${r.tasks.map(t=>`<b>${t.lv}</b> ${fx(t.q)}${t.a?" → "+fx(t.a):""}`).join(" · ")}</div>`:""}
    <div class="hint v">${I("info-circle")}<span>SI matematikada ba'zan xato qiladi. Qo'shilgan bo'limlarda «SI yozdi · tekshiring» belgisi turadi, tekshirgach uni bosasiz.</span></div>
    <div class="row"><label class="row small" style="gap:6px"><input type="checkbox" id="is-aiRep" ${A.rep?"checked":""} data-f="airep"> Eski materialni almashtirish</label><span class="sp"></span><button class="btn pri" data-a="aiapply">${I("plus-lg")} Ishlanmaga qo'shish</button></div>`:A.err?`<div class="nbx">${I("exclamation-triangle")}<span>${A.err}</span></div>`:""}
    </div></div></div>`;}
  ov.innerHTML=h;drawLive();
  if(st.toast){ov.insertAdjacentHTML("beforeend",`<div class="toast">${st.toast}</div>`);}
}
let tt;function tst(m,undo){if(!document.getElementById("is-ov"))return;st.toast=m+(undo?`<button data-a="undo">Bekor qilish</button>`:"");drawOv();clearTimeout(tt);tt=setTimeout(()=>{st.toast=null;st.undo=null;drawOv();},undo?6000:2200);}

/* ── darsda rejimi ── */
const liveMat=MB=>MB.map(b=>b.k==="f"?`<div class="fx">${fF(b.v)}</div>`:b.k==="fig"?`<div class="fig">${figSvg(b.v)}</div><div class="cap">${fx(b.cap)}</div>`:b.k==="img"?`<img class="imgp" src="${b.v}" alt="">`:b.k==="ex"?`<ol class="exs">${b.v.split("\n").filter(x=>x.trim()).map(x=>`<li>${fx(x)}</li>`).join("")}</ol>`:"").join("");
let lt;
function liveGame(p,s,v,l){
  const g=s.gm,k=v.gi||0,nav=(n)=>`<div class="ctl"><button class="btn" data-a="gprev" ${k?"":"disabled"}>${I("chevron-left")}</button><button class="btn pri" data-a="grev">${I(v.rv?"eye-slash":"eye")} ${v.rv?"Yashirish":"Javobni ko'rsatish"}</button><button class="btn" data-a="gnext" ${k<n-1?"":"disabled"}>${I("chevron-right")}</button></div>`;
  if(g==="hayoq"){const H=p.game.hy.filter(x=>x.b.trim());if(!H.length)return "";const x=H[Math.min(k,H.length-1)];
    return `<div class="lgame"><span class="gk">Bayonot ${k+1} / ${H.length}</span><div class="gq">${fx(x.b)}</div>${v.rv?`<span class="gans ${x.a==="Ha"?"ha":"yoq"}">${x.a}</span>`:`<span class="ghid">«Ha» yoki «Yo'q» kartochkasini ko'taring</span>`}${nav(H.length)}</div>`;}
  if(g==="besh"){const B=p.game.bb,x=B[Math.min(k,B.length-1)];
    return `<div class="lgame"><span class="gk">${x.f} · ${k+1} / ${B.length}</span><div class="gq">${x.t}: ${fx(x.q)}</div>${v.rv&&x.a?`<span class="gans nt">${fx(x.a)}</span>`:""}${nav(B.length)}</div>`;}
  if(g==="klaster")return `<div class="lgame" style="width:100%"><div class="a4" style="all:unset;width:100%;display:block"><div class="klw" style="width:100%">${klSvg(l.t,p.game.kl.slice(0,v.rv?99:Math.max(0,k)))}</div></div><div class="ctl"><button class="btn" data-a="gprev" ${k?"":"disabled"}>${I("dash-lg")}</button><button class="btn pri" data-a="grev">${I(v.rv?"eye-slash":"eye")} ${v.rv?"Yashirish":"Hammasini ko'rsatish"}</button><button class="btn" data-a="gnext">${I("plus-lg")} Tarmoq</button></div></div>`;
  return `<div class="lgame">${p.game.sk.slice(0,v.rv?5:k+1).map((x,j)=>`<div class="gq" style="font-size:${j===0||j===4?22:18}px">${fx(x)}</div>`).join("")}<div class="ctl"><button class="btn" data-a="gprev" ${k?"":"disabled"}>${I("dash-lg")}</button><button class="btn pri" data-a="grev">${I(v.rv?"eye-slash":"eye")} ${v.rv?"Yashirish":"Hammasini ko'rsatish"}</button><button class="btn" data-a="gnext" ${k<4?"":"disabled"}>${I("plus-lg")} Qator</button></div></div>`;
}
function liveTick(){const v=st.live;if(!v||!v.run)return;v.left--;drawLive();}
function drawLive(){
  let el=document.getElementById("is-live");const v=st.live;
  if(!v){if(el)el.remove();clearInterval(lt);return;}
  if(!el){el=document.createElement("div");el.id="is-live";el.className="live";document.getElementById("ishp").appendChild(el);}
  const l=L[st.cur],p=P(),s=p.st[v.j],stud=students(),over=v.left<0,a=Math.abs(v.left),mm=`${over?"−":""}${String(Math.floor(a/60)).padStart(2,"0")}:${String(a%60).padStart(2,"0")}`;
  const rest=p.st.slice(v.j+1).reduce((x,y)=>x+y.m,0)*60+Math.max(0,v.left);
  const showT=/Mustahkamlash|Amaliy|Misollar|Mustaqil/.test(s.n)&&p.tasks.some(t=>t.q.trim());
  const showA=/Uy vazifasini|Savol|Baholash/.test(s.n);
  const MB=p.mat.filter(b=>b.k!=="g"&&b.k!=="n"),showM=/bayon|takrorlash|Savol|Natijalar/i.test(s.n)&&MB.length;
  if(v.big==="g"&&s.gm){el.innerHTML=`<div class="lvh"><button class="ib sm" data-a="bigg" aria-label="Orqaga">${I("x-lg")}</button><div class="t"><b>${GMN[s.gm]}</b><small>${esc(l.t)}</small></div><span class="clock" style="font-size:22px">${mm}</span></div>
    <div class="bigm" style="padding:24px;display:flex;flex-direction:column;gap:18px;align-items:center;padding-top:48px;zoom:${st.dev==="tel"?1:1.5}">${liveGame(p,s,v,l)}</div>`;return;}
  if(v.big){el.innerHTML=`<div class="lvh"><button class="ib sm" data-a="big" aria-label="Orqaga">${I("x-lg")}</button><div class="t"><b>${esc(l.t)}</b><small>Proyektor yoki televizorga ulang — shu ekran ko'rsatiladi</small></div><span class="clock" style="font-size:22px">${mm}</span></div>
    <div class="bigm" style="padding:24px;display:flex;flex-direction:column;gap:18px;align-items:center;zoom:${st.dev==="tel"?1:1.6}">${liveMat(MB)}</div>`;return;}
  el.innerHTML=`<div class="lvh"><button class="ib sm" data-a="liveend" aria-label="Yopish">${I("x-lg")}</button><div class="t"><b>${esc(l.t)}</b><small>${cls()} · ${fL(l.d)} · ${v.j+1}/${p.st.length}-bosqich · qoldi ${Math.ceil(rest/60)} daq</small></div><button class="btn sm pri" data-a="livefin">${I("check-lg")} Tugatish</button></div>
  <div class="lvb"><div class="now">
    <div class="card"><div class="row"><span class="stg"><span class="dot" style="background:var(${SC[v.j%7]});width:26px;height:26px;border-radius:8px;display:grid;place-items:center;color:#fff;font-weight:800">${v.j+1}</span></span><h3 style="margin:0;font-size:20px">${esc(s.n)}</h3><span class="sp"></span><span class="muted small">${s.m} daqiqa</span></div>
      <div class="clock${over?" over":""}" aria-live="off">${mm}</div>
      <div class="sbar"><i style="width:${Math.min(100,(1-v.left/(s.m*60))*100)}%"></i></div>
      ${over?`<div class="lwarn">${I("exclamation-triangle")} Bosqich vaqti tugadi — keyingisiga o'ting</div>`:""}
      ${s.mq?`<div class="small"><b>Maqsad:</b> ${fx(s.mq)}</div>`:""}
      <div class="fld"><span class="lbl">O'qituvchi</span>${lines(s.t).length?`<ul class="lbul">${lines(s.t).map(x=>`<li>${fx(x)}</li>`).join("")}</ul>`:"—"}</div>
      <div class="fld"><span class="lbl">O'quvchilar</span>${lines(s.s).length?`<ul class="lbul muted">${lines(s.s).map(x=>`<li>${fx(x)}</li>`).join("")}</ul>`:"—"}</div>
      ${s.nm.trim()?`<div class="fld"><span class="lbl">Aytiladigan so'z</span><div class="lnm">“${fx(s.nm)}”</div></div>`:""}
      ${lines(s.q).length?`<div class="fld"><span class="lbl">Savollar</span><ol class="lbul">${lines(s.q).map(x=>`<li>${fx(x)}</li>`).join("")}</ol></div>`:""}
      <div class="ctl"><button class="btn" data-a="lprev" ${v.j?"":"disabled"}>${I("chevron-left")} Oldingi</button><button class="btn pri" data-a="lrun">${I(v.run?"pause-fill":"play-fill")} ${v.run?"Pauza":"Davom etish"}</button><button class="btn" data-a="lnext" ${v.j<p.st.length-1?"":"disabled"}>Keyingi ${I("chevron-right")}</button></div></div>
    ${s.gm?`<div class="card"><div class="sec-h"><span class="ic">${I("controller")}</span><h3>${GMN[s.gm]}</h3><span class="sp"></span><button class="btn sm pri" data-a="bigg">${I("arrows-fullscreen")} Ekranga</button></div>${liveGame(p,s,v,l)}</div>`:""}
    ${showM?`<div class="card"><div class="sec-h"><span class="ic">${I("book")}</span><h3>Doskaga</h3><span class="sp"></span><button class="btn sm pri" data-a="big">${I("arrows-fullscreen")} Ekranga</button></div>${liveMat(MB)}</div>`:""}
    ${showT?`<div class="card"><div class="sec-h"><span class="ic">${I("list-ol")}</span><h3>Topshiriqlar</h3></div>${p.tasks.filter(t=>t.q.trim()).map(t=>`<div class="row"><span class="lv ${t.lv}">${t.lv}</span><b class="sp">${fx(t.q)}</b><span class="muted small">${fx(t.a)}</span></div>`).join("")}</div>`:""}
  </div><div class="now">
    <div class="card"><div class="sec-h"><span class="ic">${I("person-check")}</span><h3>So'raladiganlar</h3><span class="sp"></span><span class="small muted">${Object.keys(v.gr).length}/${p.ask.length} baholandi</span></div><div class="small muted">«Tugatish»da baholar jurnalga ${esc(fL(l.d).split(",")[0])} kuniga yoziladi.</div>
      ${showA?"":`<div class="small muted">«Uy vazifasini tekshirish» va «Baholash» bosqichlarida kerak bo'ladi.</div>`}
      ${p.ask.map(i=>`<div class="lask"><span><b>${esc(stud[i].nm)}</b><small>${stud[i].g} ta baho shu chorakda</small></span><span class="gr">${[6,7,8,9,10].map(g=>`<button class="${v.gr[i]===g?"on":""}" data-a="lgr" data-v="${i}:${g}" aria-label="${g} baho">${g}</button>`).join("")}</span></div>`).join("")}</div>
    <div class="card"><div class="lsteps">${p.st.map((x,j)=>`<button class="lstep${j===v.j?" on":""}${j<v.j?" done":""}" data-a="lgo" data-v="${j}"><span class="dot" style="background:var(${SC[j%7]})">${j+1}</span><span>${esc(x.n)}</span><span class="muted small">${x.m} daq</span></button>`).join("")}</div></div>
  </div></div>`;
}

/* ── KaTeX: sahifa birinchi ochilganda yuklanadi (vendor/katex) ── */
let kxP=null;
function kx(){
  if(typeof katex!=="undefined")return Promise.resolve();
  if(!kxP)kxP=new Promise((ok,no)=>{
    if(!document.getElementById("ish-kx-css")){const l=document.createElement("link");l.id="ish-kx-css";l.rel="stylesheet";l.href="vendor/katex/katex.min.css";document.head.append(l);}
    const s=document.createElement("script");s.src="vendor/katex/katex.min.js";
    s.onload=()=>ok();s.onerror=()=>{kxP=null;s.remove();no(new Error("Formula kutubxonasini yuklab bo'lmadi"));};document.head.append(s);});
  return kxP;
}

/* ── sahifa ── */
function page(m){
  const c=D.classes[S.ci];if(!c){S.jpage="j";return;}
  persist();
  TODAY=todayIso();
  if(st.c!==c||st.ci!==S.ci){st.c=c;st.ci=S.ci;st.q=0;st.cur=-1;st.live=null;st.dlg=null;st.undo=null;st.showG=false;}
  if(!st.q||!qRange(st.q)){const q=typeof viewQuarter==="function"?viewQuarter(TODAY):quarterOf(TODAY);st.q=q&&qRange(q)?q:0;}
  load();cfg();
  m.innerHTML=`<div id="ishp" class="ish"></div>`;
  const r=document.getElementById("ishp");st.dev=devOf(r);
  draw();
  if(typeof katex==="undefined")kx().then(()=>{if(onPage())draw();}).catch(e=>console.warn("KaTeX:",e));
}
function load(){
  const c=st.c,key=st.cur>=0&&L[st.cur]?L[st.cur].key:null;
  L=lessonsOf(c,st.q);st.plans={};
  L.forEach((l,i)=>{const o=c.ish&&c.ish[l.key];if(o)st.plans[i]=hyd(o);});
  st.cur=key?L.findIndex(l=>l.key===key):-1;if(st.cur<0)st.cur=nextIdx();if(st.cur<0)st.cur=L.length-1;
}
function open(ci){if(ci!==undefined)S.ci=ci;S.page="journal";S.jpage="ish";render();window.scrollTo(0,0);}

/* ── qo'shimcha amallar ── */
function extra(a,v,b,e){
  switch(a){
    case "back":persist();st.live=null;drawLive();S.jpage="j";render();window.scrollTo(0,0);return true;
    case "ktr":persist();KTR.open(S.ci);return true;
    case "qq":persist();st.q=+v;st.cur=-1;st.dlg=null;load();draw();return true;
    case "ex":expDo(v,b);return true;
    case "exwk":if(b.disabled)return true;expWeek(b);return true;
    case "tplsave":{const p=P(),t=Object.assign({},(D.web.ish||{}).tpl);t[p.type]={st:p.st.map(x=>({n:x.n,m:x.m,mq:x.mq,gm:x.gm})),met:[...p.met],jih:[...p.jih],shakl:[...p.shakl],mezon:p.mezon.map(x=>[...x]),tex:p.tex};
      D.web.ish=Object.assign({},D.web.ish,{tpl:t});save();st.dlg=null;draw();tst(`Shablon saqlandi: «${esc(p.type)}» darslari endi shu tartibda to'ldiriladi`);return true;}
    case "tplreset":{if(b.disabled)return true;const p=P(),t=Object.assign({},(D.web.ish||{}).tpl);delete t[p.type];D.web.ish=Object.assign({},D.web.ish,{tpl:t});save();st.dlg=null;draw();tst("Standart shablonga qaytarildi");return true;}
    case "addmet":{const p=P();if(!p)return true;ask(v==="met"?"Metod qo'shish":"Jihoz qo'shish",v==="met"?"Metod nomi (masalan: «Charxpalak»)":"Jihoz nomi","").then(nm=>{if(nm&&nm.trim()&&P()===p){p[v].add(nm.trim());draw();}});return true;}
  }
  return false;
}

/* ── nusxa: boshqa sinflar bilan ── */
const topicText=l=>l.h>1?`${l.t} (${l.k}/${l.h})`:l.t;
function others(){return D.classes.map((c,ci)=>({c,ci})).filter(x=>x.c!==st.c&&!(typeof isGrp==="function"&&isGrp(x.c)));}
function findIn(c2,l){   // boshqa sinfda shu mavzuning shu darsi
  for(const q of [...new Set([st.q,1,2,3,4,0])]){if(q&&!qRange(q))continue;const x=lessonsOf(c2,q).find(y=>y.t===l.t&&y.k===l.k);if(x)return x;}
  return null;
}
function copyOpts(l){
  const O=others().map(x=>({...x,les:findIn(x.c,l)})).filter(x=>x.les);
  const from=O.filter(x=>x.c.ish&&x.c.ish[x.les.key]),to=O;
  if(!O.length)return `<div class="hint">${I("info-circle")}<span>Boshqa sinflarda «${esc(l.t)}» mavzusi topilmadi. Mavzu nomi KTR'da bir xil yozilgan bo'lsa, shu yerda chiqadi.</span></div>`;
  return from.map(x=>`<button class="opt" data-a="docopy" data-v="from:${x.ci}"><span class="oi">${I("copy")}</span><span><b>${esc(x.c.name)} sinfidan olish</b><small>«${esc(l.t)}» · ${esc(x.c.name)}'da ${esc(fL(x.les.d).split(",")[0])} kuni tayyorlangan</small></span>${I("chevron-right","muted")}</button>`).join("")
    +(P()?to.map(x=>`<button class="opt" data-a="docopy" data-v="to:${x.ci}"><span class="oi">${I("box-arrow-up-right")}</span><span><b>${esc(x.c.name)} sinfiga berish</b><small>${x.c.ish&&x.c.ish[x.les.key]?"U yerdagi ishlanma shu bilan almashadi":"Shu mavzu u yerda ham bor"} · ${esc(fL(x.les.d).split(",")[0])}</small></span>${I("chevron-right","muted")}</button>`).join(""):"");
}
function doCopy(v){
  const [k,ci]=v.split(":"),c2=D.classes[+ci],l=L[st.cur];if(!c2)return;
  const les=findIn(c2,l);if(!les){tst("Mavzu topilmadi");return;}
  if(k==="from"){const o=c2.ish&&c2.ish[les.key];if(!o)return;st.undo=snap();const p=hyd(o);p.ask=null;p.ready=false;p.note="";st.plans[st.cur]=p;st.dlg=null;draw();tst(`${esc(c2.name)} sinfidan nusxa olindi`,true);return;}
  const p=P();if(!p)return;const o=ser(p);o.ask=null;o.note="";(c2.ish=c2.ish||{})[les.key]=o;save();st.dlg=null;draw();tst(`${esc(c2.name)} sinfiga yozildi`);
}

/* ── darsda: baholar jurnalga ── */
function liveSave(gr){
  const c=st.c,l=L[st.cur],ks=Object.keys(gr);
  if(!ks.length){tst("Dars tugadi");return;}
  if(!canEdit(l.d)||(typeof ARX!=="undefined"&&ARX.dateLocked(l.d,c))){tst(`Dars tugadi. Baholar yozilmadi: ${l.d>TODAY?"dars kuni hali kelmagan":"bu kunga belgi qo'yib bo'lmaydi"} — jurnalga o'zingiz kiriting.`);return;}
  let n=0;
  batch(()=>{for(const i of ks){const s=c.students[+i];if(!s)continue;const old=(s.marks||{})[l.d]||"";if(putMark(c,+i,l.d,buildMark(gradesOf(old).concat([gr[i]]),lateOf(old)),true))n++;}});
  tst(`Dars tugadi: ${n} ta baho jurnalga yozildi`);
}

/* ── rasm: kichraytirib saqlanadi (jurnal xotirasi to'lmasin) ── */
function shrinkImg(f){
  return new Promise((ok,no)=>{const r=new FileReader();r.onerror=no;r.onload=()=>{const im=new Image();im.onerror=no;im.onload=()=>{
    const k=Math.min(1,1000/Math.max(im.width,im.height)),cv=document.createElement("canvas");cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);
    const g=cv.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,cv.width,cv.height);g.drawImage(im,0,0,cv.width,cv.height);ok(cv.toDataURL("image/jpeg",0.82));};im.src=r.result;};r.readAsDataURL(f);});
}

/* ── eksport: chop etish, Word, PDF, Telegram ── */
const fname=(l,ext)=>`Dars ishlanma ${st.c.name} ${SUBJ()} ${fS(l.d)}.${ext}`.replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ");
function docPages(i){   // i-darsning varaqlari (HTML), har biri .a4
  const k=st.cur;if(i!==undefined)st.cur=i;
  try{const p=P();if(!p)return "";if(!p.ask)p.ask=suggest();return paperHtml();}finally{st.cur=k;}
}
const wrapPg=h=>{const t=document.createElement("div");t.innerHTML=h;t.querySelectorAll(".a4,.v-pg").forEach(a=>{a.classList.add("bx-pg");a.removeAttribute("id");});t.querySelectorAll(".brk").forEach(x=>x.remove());return `<div id="ishd">${t.innerHTML}</div>`;};
async function pdfOf(idx){await kx();await vFonts().catch(e=>console.warn("Ishlanma shrifti:",e));const hs=idx.map(i=>docPages(i));return PTG.pagesPdf([wrapPg(hs.join(""))],false);}
function dl(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
async function expDo(v,btn){
  const l=L[st.cur],p=P();if(!p){tst("Avval ishlanmani to'ldiring");return;}
  st.dlg=null;drawOv();
  if(v==="print"){await kx().catch(()=>{});await vFonts().catch(()=>{});let el=document.getElementById("pdoc");if(!el){el=document.createElement("div");el.id="pdoc";document.body.append(el);}
    el.className="bx-print";el.innerHTML=wrapPg(docPages());document.body.classList.add("pdoc");
    let css=document.getElementById("pdoc-css");if(!css){css=document.createElement("style");css.id="pdoc-css";document.head.append(css);}
    css.textContent="@media print{@page{size:A4 portrait;margin:0}}";
    const old=document.title,back=()=>{document.title=old;window.removeEventListener("afterprint",back);el.className="";};
    document.title=fname(l,"pdf").replace(/\.pdf$/,"");window.addEventListener("afterprint",back);setTimeout(()=>{document.title=old;},120000);
    window.print();return;}
  if(v==="word"){dl(new Blob(["﻿",wordHtml(l,p)],{type:"application/msword"}),fname(l,"doc"));tst("Word fayli saqlandi");return;}
  if(v==="pdf"){try{tst("PDF tayyorlanmoqda…");dl(await pdfOf([st.cur]),fname(l,"pdf"));tst("PDF saqlandi");}catch(e){console.warn("Ishlanma PDF:",e);tst(`PDF tayyorlanmadi: ${esc(e.message)}`);}return;}
  if(v==="tg"){PTG.run(()=>pdfOf([st.cur]),fname(l,"pdf").replace(/\.pdf$/,""),`📝 Dars ishlanma · ${st.c.name} ${SUBJ()} · ${fS(l.d)}\n«${l.t}»`);return;}
}
async function expWeek(){
  const idx=weekIdx();if(!idx.length)return;st.dlg=null;drawOv();
  try{tst("PDF tayyorlanmoqda…");dl(await pdfOf(idx),`Dars ishlanmalar ${st.c.name} ${SUBJ()} ${fS(wkFrom(0))}–${fS(wkTo(0))}.pdf`.replace(/[\\/:*?"<>|]+/g," "));tst(`${idx.length} ta ishlanma PDF'ga saqlandi`);}
  catch(e){console.warn("Ishlanma PDF:",e);tst(`PDF tayyorlanmadi: ${esc(e.message)}`);}
}
// Word: oddiy HTML (.doc) — Word o'zi ochadi, maktab shakliga moslab tahrirlanadi; formulalar oddiy matn bo'lib yoziladi
function wordHtml(l,p){
  const t=x=>esc(tPlain(String(x??""))),li=x=>lines(x).map(y=>`<li>${t(y)}</li>`).join(""),stud=students(),ask=(p.ask||[]).map(i=>stud[i]&&short(stud[i].nm)).filter(Boolean);
  const th='style="border:1px solid #000;padding:3pt 5pt;background:#e6e6e6"',td='style="border:1px solid #000;padding:3pt 5pt;vertical-align:top"';
  let h=`<h2 style="text-align:center">Dars ishlanmasi</h2><p style="text-align:center">${esc(st.c.name)} sinf · ${esc(SUBJ())} · ${QL()}, ${l.n}-dars · ${fS(l.d)}</p>
  <table style="border-collapse:collapse;width:100%"><tr><td ${td}><b>Mavzu</b></td><td ${td}>${t(l.t)}${l.h>1?` (${l.k}-dars)`:""}</td></tr><tr><td ${td}><b>Dars turi</b></td><td ${td}>${esc(p.type)}</td></tr>
  <tr><td ${td}><b>Dars shakli</b></td><td ${td}>${esc([...p.shakl].join(", "))}</td></tr><tr><td ${td}><b>Metodlar</b></td><td ${td}>${esc([...p.met].join(", "))}</td></tr>
  <tr><td ${td}><b>Jihozlar</b></td><td ${td}>${esc([...p.jih].join(", "))}${p.tex?`; ${esc(p.tex)}`:""}</td></tr>${p.fan?`<tr><td ${td}><b>Fanlararo bog'liqlik</b></td><td ${td}>${esc(p.fan)}</td></tr>`:""}
  <tr><td ${td}><b>Kompetensiyalar</b></td><td ${td}>${esc([...p.komp].join(", "))}</td></tr></table>
  <h3>I. Darsning maqsadlari</h3><p><b>Ta'limiy:</b> ${t(p.g[0])}</p><p><b>Tarbiyaviy:</b> ${t(p.g[1])}</p><p><b>Rivojlantiruvchi:</b> ${t(p.g[2])}</p>
  <h3>II. Kutilayotgan natijalar</h3><ul>${li(p.res)}</ul>
  <h3>III. Darsning texnologik xaritasi</h3><table style="border-collapse:collapse;width:100%"><tr><th ${th}>№</th><th ${th}>Bosqich</th><th ${th}>O'qituvchi faoliyati</th><th ${th}>O'quvchi faoliyati</th><th ${th}>Vaqt</th></tr>
  ${p.st.map((s,j)=>`<tr><td ${td}>${j+1}</td><td ${td}>${esc(s.n)}</td><td ${td}>${t(f1(s.t))}</td><td ${td}>${t(f1(s.s))}</td><td ${td}>${s.m} daq</td></tr>`).join("")}</table>
  <h3>IV. Darsning borishi</h3>`;
  p.st.forEach((s,j)=>{h+=`<h4>${j+1}. ${esc(s.n)} — ${s.m} daqiqa</h4>${s.mq?`<p><i>Maqsad:</i> ${t(s.mq)}</p>`:""}${lines(s.t).length?`<p><b>O'qituvchi faoliyati:</b></p><ul>${li(s.t)}</ul>`:""}${lines(s.s).length?`<p><b>O'quvchi faoliyati:</b></p><ul>${li(s.s)}</ul>`:""}${s.nm.trim()?`<p><i>Namuna matn:</i> “${t(s.nm)}”</p>`:""}${lines(s.q).length?`<p><b>Savollar:</b></p><ol>${li(s.q)}</ol>`:""}`;
    if(/^Uy vazifasini|Savol/.test(s.n)&&ask.length)h+=`<p><b>So'raladigan o'quvchilar:</b> ${esc(ask.join(", "))}</p>`;
    if(/bayon/i.test(s.n))p.mat.filter(b=>b.show).forEach(b=>{if(b.k==="g"||b.k==="n")h+=`<p>${b.k==="n"?"<b>Eslatma:</b> ":""}${t(b.v)}</p>`;else if(b.k==="f")h+=`<p style="text-align:center;font-family:Cambria Math,Cambria,serif;font-size:14pt">${t(b.v)}</p>`;else if(b.k==="ex")h+=`<p><b>Namunaviy misol:</b></p><ol>${li(b.v)}</ol>`;});
    if(/^Mustahkamlash$|Amaliy|Misollar|Mustaqil/.test(s.n)){const T=p.tasks.filter(x=>x.q.trim());if(T.length)h+=`<p><b>Topshiriqlar:</b></p><ol>${T.map(x=>`<li>(${x.lv}) ${t(x.q)}${x.a?` — <i>javob: ${t(x.a)}</i>`:""}</li>`).join("")}</ol>`;}
    if(s.gm==="hayoq"){const H=p.game.hy.filter(x=>x.b.trim());if(H.length)h+=`<p><b>“Ha–Yo'q” o'yini:</b></p><ol>${H.map(x=>`<li>${t(x.b)} — <b>${x.a}</b></li>`).join("")}</ol>`;}
    if(/aholash/.test(s.n)&&p.mezon.length)h+=`<p><b>Baholash mezonlari:</b> ${p.mezon.map(x=>`${esc(x[0])} — ${x[1]} ball`).join("; ")}</p>`;
    if(/^Uyga vazifa/.test(s.n))h+=`<p><b>Uyga vazifa:</b> ${t(l.hw||"—")}${["A","B","C"].filter(k=>p.hwx[k]).map(k=>`; ${k}: ${t(p.hwx[k])}`).join("")}${p.hwx.ij?`; ijodiy: ${t(p.hwx.ij)}`:""}</p>`;});
  h+=`<h3>V. Dars yakuni</h3><p>${t(p.xul)}</p><p style="margin-top:24pt">O'qituvchi: ____________________ &nbsp;&nbsp;&nbsp; Tekshirdi (O'IBDO'): ____________________</p>`;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(l.t)}</title>
<style>@page{size:21cm 29.7cm;margin:2cm 1.5cm 2cm 2.5cm}body{font-family:"Times New Roman",serif;font-size:12pt}h2{font-size:16pt}h3{font-size:13pt;margin-top:12pt}h4{font-size:12pt}</style></head><body>${h}</body></html>`;
}

/* ── hodisalar ── */
document.addEventListener("click",e=>{
  if(!onPage()||!e.target.closest||!e.target.closest("#ishp"))return;
  const b=e.target.closest("[data-a]");if(!b)return;
  const a=b.dataset.a,v=b.dataset.v,p=P();
  if(a==="close"&&b.classList.contains("ov")&&e.target!==b)return;
  if(extra(a,v,b,e))return;
  switch(a){
    case "go":st.cur=+v;st.dlg=null;break;
    case "prev":st.cur=Math.max(0,st.cur-1);break;
    case "next":st.cur=Math.min(L.length-1,st.cur+1);break;
    case "flt":st.flt=v;break;
    case "tab":st.tab=v;break;
    case "list":st.dlg="list";break;
    case "exp":st.dlg="exp";break;
    case "copy":st.dlg="copy";break;
    case "tpl":st.dlg="tpl";break;
    case "close":st.dlg=null;break;
    case "auto":if(p){st.dlg="auto";break;}st.plans[st.cur]=build(st.cur);tst(`${I("magic")} To'ldirildi: ${genStat(P())}`);break;
    case "ltx":{const [jj,code]=v.split("|");const inp=document.querySelector(`[data-f="mb"][data-j="${jj}"]`);if(inp){const a0=inp.selectionStart??inp.value.length,b0=inp.selectionEnd??a0;inp.value=inp.value.slice(0,a0)+code+inp.value.slice(b0);const c=a0+(code.indexOf("{}")>=0?code.indexOf("{}")+1:code.length);inp.focus();inp.setSelectionRange(c,c);inp.dispatchEvent(new Event("input",{bubbles:true}));}return;}
    case "gen":st.gen=v;if(st.dlg){drawOv();return;}break;
    case "doauto":{const r=p.ready;st.undo=snap();st.plans[st.cur]=build(st.cur);st.plans[st.cur].ready=r;st.dlg=null;draw();tst(`Qaytadan to'ldirildi: ${genStat(P())}`,true);return;}
    case "blank":{const x=build(st.cur);x.g=["","",""];x.res="";x.met=new Set();x.jih=new Set();x.st=x.st.map(s=>({...s,t:"",s:""}));st.plans[st.cur]=x;break;}
    case "docopy":doCopy(v);return;
    case "ready":p.ready=!p.ready;break;
    case "type":p.type=v;break;
    case "komp":case "met":case "jih":p[a].has(v)?p[a].delete(v):p[a].add(v);break;
    case "m-":p.st[+v].m=Math.max(1,p.st[+v].m-1);break;
    case "m+":p.st[+v].m=Math.min(45,p.st[+v].m+1);break;
    case "tog":p.st[+v].open=!p.st[+v].open;break;
    case "allopen":{const o=!p.st.every(s=>s.open);p.st.forEach(s=>s.open=o);break;}
    case "up":{const j=+v;[p.st[j-1],p.st[j]]=[p.st[j],p.st[j-1]];break;}
    case "dn":{const j=+v;[p.st[j+1],p.st[j]]=[p.st[j],p.st[j+1]];break;}
    case "del":p.st.splice(+v,1);break;
    case "addst":p.st.splice(Math.max(0,p.st.length-1),0,{n:"Yangi bosqich",m:5,t:"",s:"",open:true});break;
    case "fit":{let d=sum(p)-45;const big=p.st.reduce((m,s,j)=>s.m>p.st[m].m?j:m,0);p.st[big].m=Math.max(1,p.st[big].m-d);break;}
    case "ask":{const i=+v,s=new Set(p.ask);s.has(i)?s.delete(i):s.add(i);p.ask=[...s];break;}
    case "shuf":{const stud=students(),pick=new Set(p.ask);st.alt++;const pool=stud.filter(s=>!pick.has(s.i));p.ask=pool.slice((st.alt*5)%Math.max(1,pool.length-6)).slice(0,NS()>20?6:4).map(s=>s.i);break;}
    case "po":st.paper[b.dataset.k]=v;break;
    case "pb":st.paper[b.dataset.k]=!st.paper[b.dataset.k];break;
    case "toast":tst(v);if(st.dlg&&st.dlg!=="list"&&st.dlg!=="ai")st.dlg=null;break;
    case "ai":st.ai={txt:"",res:null,rep:!p.mat.length,err:""};st.dlg="ai";break;
    case "aicopy":{const t=document.getElementById("is-prm").textContent;const ok=()=>tst("So'rov nusxalandi — SI ilovasiga qo'ying");const sel=()=>{const r=document.createRange();r.selectNodeContents(document.getElementById("is-prm"));const s2=getSelection();s2.removeAllRanges();s2.addRange(r);tst("Matn belgilandi — nusxalang");};try{navigator.clipboard.writeText(t).then(ok,sel);}catch(_){sel();}return;}
    case "aiparse":{const r=aiParse(st.ai.txt);const n=(r.g?1:0)+r.f.length+r.ex.length+r.tasks.length;if(!n){st.ai.res=null;st.ai.err="Javobdan bo'lim topilmadi. SI javobi «QO'LLANMA:», «FORMULA:» kabi belgilar bilan boshlanishi kerak — so'rovni to'liq nusxalaganingizni tekshiring.";}else{st.ai.res=r;st.ai.err="";}break;}
    case "aiapply":{const r=st.ai.res;st.undo=snap();const B=[];if(r.g)B.push({k:"g",v:r.g.trim()});r.f.forEach(f=>B.push({k:"f",v:f}));if(r.ex.length)B.push({k:"ex",v:r.ex.join("\n")});if(r.n)B.push({k:"n",v:r.n.trim()});
      const nb=B.map(b=>({...b,show:true,ai:true}));p.mat=st.ai.rep?nb:[...p.mat,...nb];if(r.tasks.length)p.tasks=r.tasks;Object.assign(p.hwx,r.hw);if(r.res.length)p.res=r.res.join("\n");if(r.nm.trim()&&p.st[0])p.st[0].nm=r.nm.trim();{const k=p.st.findIndex(x=>/^Uy vazifasini|Savol|Natijalar/.test(x.n));if(r.q.length&&k>=0)p.st[k].q=r.q.join("\n");}if(r.hy.length)p.game.hy=r.hy;if(r.xul.trim())p.xul=r.xul.trim();st.dlg=null;st.ai=null;draw();tst(`${I("stars")} Material qo'shildi — tekshirib chiqing`,true);
      setTimeout(()=>{const e=document.getElementById("is-s-mat");if(e)e.scrollIntoView({behavior:"smooth"});},50);return;}
    case "aiok":p.mat[+v].ai=p.mat[+v].ai==="ok"?true:"ok";break;
    case "shakl":p.shakl.has(v)?p.shakl.delete(v):p.shakl.add(v);break;
    case "sgm":{const [j,k]=v.split(":");p.st[+j].gm=k;break;}
    case "hya":{const x=p.game.hy[+v];x.a=x.a==="Ha"?"Yo'q":"Ha";break;}
    case "hyd":p.game.hy.splice(+v,1);break;
    case "hyadd":p.game.hy.push({b:"",a:"Ha"});break;
    case "mz-":p.mezon[+v][1]=Math.max(1,p.mezon[+v][1]-1);break;
    case "mz+":p.mezon[+v][1]=Math.min(10,p.mezon[+v][1]+1);break;
    case "mzd":p.mezon.splice(+v,1);break;
    case "mzadd":p.mezon.push(["Yangi mezon",1]);break;
    case "cvs":st.cover.cs=v;break;
    case "ochiq":st.cover.ochiq=!st.cover.ochiq;break;
    case "big":st.live.big=!st.live.big;drawLive();return;
    case "mshow":p.mat[+v].show=!p.mat[+v].show;break;
    case "mup":{const j=+v;[p.mat[j-1],p.mat[j]]=[p.mat[j],p.mat[j-1]];break;}
    case "mdel":p.mat.splice(+v,1);break;
    case "madd":{if(v==="fig"){st.dlg="fig";break;}if(v==="img"){const inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=()=>{const f=inp.files[0];if(!f)return;shrinkImg(f).then(u=>{P().mat.push({k:"img",v:u,cap:f.name.replace(/\.[^.]+$/,""),show:true});draw();tst("Rasm qo'shildi");}).catch(()=>tst("Rasmni o'qib bo'lmadi"));};inp.click();return;}
      p.mat.push({k:v,v:{g:"",f:"a^2 + b^2",ex:"",n:""}[v],show:true});break;}
    case "dofig":p.mat.push({k:"fig",v,cap:FIGS[v],show:true});st.dlg=null;break;
    case "jump":{const el=document.getElementById("is-s-"+v);if(el)el.scrollIntoView({behavior:"smooth",block:"start"});return;}
    case "bulk":st.dlg="bulk";break;
    case "dobulk":{if(b.disabled)return;const rg={w:[wkFrom(1),wkTo(1)],w2:[wkFrom(1),wkTo(2)],q:[TODAY,qEnd()]}[v];st.undo=snap();let k=0;L.forEach((l,i)=>{if(l.d>=rg[0]&&l.d<=rg[1]&&!st.plans[i]){st.plans[i]=build(i);k++;}});st.dlg=null;draw();tst(`${I("magic")} ${k} ta dars to'ldirildi (qoralama)`,true);return;}
    case "undo":if(st.undo){st.plans=st.undo;st.undo=null;st.toast=null;clearTimeout(tt);}break;
    case "lv":{const t=p.tasks[+v];t.lv={A:"B",B:"C",C:"A"}[t.lv];break;}
    case "tadd":p.tasks.push({lv:"B",q:"",a:""});break;
    case "tdel":p.tasks.splice(+v,1);break;
    case "cards":st.showG=!st.showG;break;
    case "live":st.live={j:0,left:p.st[0].m*60,run:true,gr:{}};clearInterval(lt);lt=setInterval(liveTick,1000);drawLive();return;
    case "lrun":st.live.run=!st.live.run;drawLive();return;
    case "lnext":case "lprev":case "lgo":{const j=a==="lgo"?+v:st.live.j+(a==="lnext"?1:-1);st.live.j=j;st.live.left=p.st[j].m*60;st.live.gi=0;st.live.rv=false;if(st.live.big==="g")st.live.big=false;drawLive();return;}
    case "gnext":st.live.gi=(st.live.gi||0)+1;st.live.rv=false;drawLive();return;
    case "gprev":st.live.gi=Math.max(0,(st.live.gi||0)-1);st.live.rv=false;drawLive();return;
    case "grev":st.live.rv=!st.live.rv;drawLive();return;
    case "bigg":st.live.big=st.live.big==="g"?false:"g";drawLive();return;
    case "lgr":{const [i,g]=v.split(":").map(Number);st.live.gr[i]===g?delete st.live.gr[i]:st.live.gr[i]=g;drawLive();return;}
    case "liveend":st.live=null;drawLive();return;
    case "livefin":{const gr=st.live.gr;st.live=null;drawLive();liveSave(gr);return;}
  }
  if(a==="go"&&st.dev==="tel")st.tab="edit";
  draw();
});
document.addEventListener("input",e=>{
  if(!onPage()||!e.target.closest||!e.target.closest("#ishp"))return;
  const f=e.target.dataset.f,p=P();if(!f||!p)return;later();const v=e.target.value,j=+e.target.dataset.j;
  if(/^g\d$/.test(f))p.g[+f[1]]=v;else if(f==="sn")p.st[j].n=v;else if(f==="st")p.st[j].t=v;else if(f==="ss")p.st[j].s=v;else if(f==="hw"){L[st.cur].hw=v;setHw(L[st.cur],v);}else if(f==="tq")p.tasks[j].q=v;else if(f==="mb"){p.mat[j].v=v;const pv=document.querySelector(`[data-pv="${j}"]`);if(pv)pv.innerHTML=p.mat[j].k==="f"?fF(v):v.split("\n").filter(x=>x.trim()).map(x=>`<li>${fx(x)}</li>`).join("");}else if(f==="mbc")p.mat[j].cap=v;else if(f==="hx")p.hwx[e.target.dataset.k]=v;else if(f==="ai")st.ai.txt=v;else if(f==="smq")p.st[j].mq=v;else if(f==="snm")p.st[j].nm=v;else if(f==="sq")p.st[j].q=v;else if(f==="kl")p.game.kl=v.split("\n");else if(f==="sk")p.game.sk[j]=v;else if(f==="hyb")p.game.hy[j].b=v;else if(f==="bbq")p.game.bb[j].q=v;else if(f==="bba")p.game.bb[j].a=v;else if(f==="mzm")p.mezon[j][0]=v;else if(f==="cv"){st.cover[e.target.dataset.k]=v;clearTimeout(st._cv);st._cv=setTimeout(()=>{if(st.tab==="paper"){const ps=document.getElementById("is-ps");ps.innerHTML=paperHtml();fitPaper();}},400);}else if(f==="airep")st.ai.rep=e.target.checked;else if(f==="ta")p.tasks[j].a=v;else p[f]=v;
});
addEventListener("resize",()=>{if(!onPage())return;const r=document.getElementById("ishp");if(!r)return;const d=devOf(r);if(d!==st.dev){st.dev=d;draw();}else fitPaper();});
return {page, open, state: st, build, lessonsOf, ser, hyd, docPages, wordHtml};
})();
