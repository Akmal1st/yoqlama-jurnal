/* Dars ishlanma — yangi varaq dizayni (maket «Ishlanma varag'i» v2, Akmal tasdiqladi 2026-11-14).
   3 uslub, har birining o'z muqovasi: A «Umumiy» (hisobotlar bilan bir xil), B «Rasmiy» (maktab namunasi, Times, jadval),
   C «Rangli» (ochiq dars). Shrift to'plami — Bo'sh varaqdagi bilan bir xil (Zamonaviy/Rasmiy/Hujjat/Oddiy/Aralash) yoki «Uslubga mos».
   ishlanma.js (ISH) chaqiradi: ISHV.pages(X) — X ichida ishlanma, dars, sozlama va yordamchi funksiyalar.
   Uslub: ishlanma-varaq.css (sinflar v- bilan boshlanadi: ishlanma.css dagi eski varaq qoidalari tegmaydi). */
const ISHV = (() => {
"use strict";

const SCOL=["#0d8a87","#2f80c9","#6d5bd0","#e5a53a","#1f9d55","#d9534f","#8a9aa8"],SSOFT=["#e3f4f3","#e3eefa","#efecfd","#fdf1e1","#e1f5e9","#fbe7e6","#eef1f4"];
const STY=[["A","Umumiy","Hisobotlar bilan bir xil: yashil chiziq, qalin ramkali jadvallar. Har kungi ishlanma uchun."],["B","Rasmiy","Maktab namunasi: oq-qora, «Tasdiqlayman», darsning borishi — 5 ustunli jadval. Tekshiruv va papka uchun."],["C","Rangli","Ochiq dars va ko'rgazma uchun: rangli bosqich kartalari, rangli javoblar."]];
// shrift to'plamlari — Bo'sh varaqdagi bilan bir xil: [kalit, nom, sarlavha, matn, izoh]
const FSETS=[["zam","Zamonaviy","Manrope","Manrope","Ekrandagi dastur bilan bir xil, toza va zamonaviy"],["ras","Rasmiy","Times","Times","Hujjat va ma'lumotnomalardagidek, an'anaviy"],["huj","Hujjat","Times","Arial","Rasmiy sarlavha, o'qilishi oson matn"],["odd","Oddiy","Arial","Arial","Neytral, nusxa ko'chirganda ham tiniq"],["ara","Aralash","Manrope","Arial","Qalin zamonaviy sarlavha, ixcham matn"]];
const FAUTO={A:"zam",B:"ras",C:"zam"};
const FFAM={Manrope:"'Manrope',Arial,sans-serif",Times:"'BV Serif','Liberation Serif','Times New Roman',serif",Arial:"'BV Sans','Liberation Sans',Arial,sans-serif"};
const fname=f=>f==="Times"?"Times New Roman":f;
const setOf=(vs,ff)=>FSETS.find(x=>x[0]===(!ff||ff==="auto"?FAUTO[vs]||"zam":ff))||FSETS[0];
// tanlangan to'plam: sahifa ildiziga data-ff va --vfh/--vfb («Uslubga mos» — uslubning o'z shrifti, hech narsa qo'shilmaydi)
const fattr=(vs,ff)=>{if(!ff||ff==="auto")return "";const r=setOf(vs,ff);return ` data-ff="1" style="--vfh:${FFAM[r[2]]};--vfb:${FFAM[r[3]]}"`;};

/* «BV Serif» / «BV Sans» — PDF bilan bir xil Liberation shriftlari (vendor/pdf-shrift): ekran = chop etish = PDF */
const FREG={},FK={Times:[["BV Serif","sR","400","normal"],["BV Serif","sB","700","normal"],["BV Serif","sI","400","italic"],["BV Serif","sBI","700","italic"]],Arial:[["BV Sans","aR","400","normal"],["BV Sans","aB","700","normal"]]};
// formulalar, chizmalar va eski «Rasmiy» varaqlar har doim BV Serif bilan (ekran = PDF), shuning uchun u doim ulanadi
const need=(vs,ff)=>{const r=setOf(vs,ff),f=new Set([r[2],r[3],"Times"]);return [...f].filter(x=>FK[x]);};
const ready=(vs,ff)=>need(vs,ff).every(f=>FREG[f]===true);
function loadFonts(vs,ff){
  if(typeof PTG==="undefined"||!PTG.fontData||typeof FontFace==="undefined")return Promise.resolve();
  return Promise.all(need(vs,ff).map(f=>FREG[f]===true?null:FREG[f]instanceof Promise?FREG[f]:(FREG[f]=Promise.all(FK[f].map(([fam,k,w,s])=>PTG.fontData(k).then(b64=>{
    const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    const fc=new FontFace(fam,u.buffer,{weight:w,style:s});document.fonts.add(fc);return fc.load();}))).then(()=>{FREG[f]=true;},e=>{delete FREG[f];throw e;}))));
}

/* ── yordamchilar ── */
let X=null;   // joriy chaqiruv: {l,p,o,cv,ask,T,MB,…, esc,fx,fF,figSvg,klSvg,I,lines,fS,fL}
const e=s=>X.esc(s),f=s=>X.fx(s),ln=s=>X.lines(s);
const times=p=>{let a=0;return p.st.map(s=>{const r=[a,a+s.m];a+=s.m;return r;});};
const qa=x=>{const i=x.indexOf(" → ");return i<0?f(x):`${f(x.slice(0,i))} <span class="v-an">→ ${f(x.slice(i+3))}</span>`;};
const isT=n=>/^Mustahkamlash$|Amaliy|Misollar|Mustaqil/.test(n);
const isB=n=>/bayon/i.test(n);
const isAsk=n=>/^Uy vazifasini|Savol/.test(n);
const isMz=n=>/aholash/.test(n);
const isHw=n=>/^Uyga vazifa/.test(n);
const GN={hayoq:"«Ha–Yo'q»",besh:"«Besh barmoq»",klaster:"«Klaster»",sinkveyn:"«Sinkveyn»"};
const mzTot=p=>p.mezon.reduce((a,x)=>a+(+x[1]||0),0);
const mzScale=p=>mzTot(p)===10?" · 9–10 a'lo, 7–8 yaxshi, 5–6 qoniqarli":"";
const figH=(b,w)=>b.k==="img"?`<img class="imgp" src="${b.v}" alt="" style="max-width:${w}px">`:X.figSvg(b.v).replace(/width="(\d+)"/,(m,x)=>`width="${Math.min(+x,w)}"`);
// har bo'lim (topshiriq, material, uyga vazifa, mezon, so'raladiganlar) o'z bosqichiga tushadi; mos bosqich bo'lmasa — oxirida alohida
function slots(p){
  const has=t=>p.st.some(s=>t(s.n));
  return {T:has(isT),B:has(isB),A:has(isAsk),M:has(isMz),H:has(isHw)};
}

/* ── A · Umumiy ── */
function chA(){const {l,p,o,cv}=X,tm=times(p),out=[],sl=slots(p),tot=X.sum(p);
  out.push(`<div class="v-hdr"><div><div class="v-eb">${cv.ochiq?"Ochiq dars · ":""}Dars ishlanmasi · ${e(p.type)} darsi</div><div class="v-ttl">${e(l.t)}${l.h>1?` <small>(${l.k}-dars)</small>`:""}</div></div>
    <div class="v-who">${cv.fio?`<b>${e(cv.fio)}</b><br>`:""}${cv.school?`${e(cv.school)}<br>`:""}${cv.place?e(cv.place):""}</div></div>
    <div class="v-cells">${[["Sinf",X.cls],["Fan",X.sub],["Sana",X.fS(l.d)],["Chorak",X.ql],["Dars",`${l.n}-dars`],["Vaqt",`${tot} daqiqa`]].map(([a,b])=>`<div><small>${a}</small><b>${e(b)}</b></div>`).join("")}</div>
    <div class="v-kv"><b>Dars shakli</b><span>${e([...p.shakl].join(", ")||"—")}</span><b>Metodlar</b><span>${e([...p.met].join(", ")||"—")}</span><b>Jihozlar</b><span>${e([...p.jih,p.tex].filter(Boolean).join(", ")||"—")}</span>${p.fan?`<b>Fanlararo</b><span>${e(p.fan)}</span>`:""}<b>Kompetensiyalar</b><span>${e([...p.komp].join(", ")||"—")}</span></div>`);
  out.push(`\u0001<div class="v-sec"><i>1</i><b>Darsning maqsadlari</b></div>`);
  out.push(`<div class="v-g3">${[["Ta'limiy",0],["Tarbiyaviy",1],["Rivojlantiruvchi",2]].map(([a,k])=>`<div><small>${a}</small>${f(p.g[k])}</div>`).join("")}</div>`);
  if(ln(p.res).length){out.push(`\u0001<div class="v-sec"><i>2</i><b>Kutilayotgan natijalar</b></div>`);
    out.push(`<ul class="v-chk">${ln(p.res).map(x=>`<li>${f(x)}</li>`).join("")}</ul>`);}
  out.push(`\u0001<div class="v-sec"><i>3</i><b>Texnologik xarita</b></div>`);
  out.push(`<div class="v-bar">${p.st.map((s,j)=>`<span style="flex:${Math.max(s.m,1)};background:${SSOFT[j%7]}">${s.m>=5?`${s.m}′`:""}</span>`).join("")}</div>
    <table class="v-t"><tr><th>№</th><th>Bosqich</th><th>Faoliyat</th><th>Usul</th><th style="text-align:right">Vaqt</th></tr>${p.st.map((s,j)=>`<tr><td class="v-n" style="color:${SCOL[j%7]}">${j+1}</td><td><b>${e(s.n)}</b></td><td>${f(ln(s.t)[0]||"")}</td><td>${s.gm?GN[s.gm]:isB(s.n)?e([...p.met].slice(0,2).join(", ")||"—"):"—"}</td><td class="v-m">${tm[j][0]}–${tm[j][1]}′</td></tr>`).join("")}<tr class="v-tot"><td></td><td colspan="3">Jami</td><td class="v-m">${tot} daq</td></tr></table>`);
  out.push(`\u0001<div class="v-sec"><i>4</i><b>Darsning borishi</b></div>`);
  const ext=[];
  p.st.forEach((s,j)=>{const c=SCOL[j%7];
    out.push(`<div class="v-stg" style="--c:${c}"><div class="v-sh"><span class="v-no">${j+1}</span><b>${e(s.n)}</b><span class="v-tm">${tm[j][0]}–${tm[j][1]} daq · ${s.m}′</span></div>${s.mq?`<div class="v-mq">${f(s.mq)}</div>`:""}
      <div class="v-two"><div><h6>O'qituvchi</h6><ul>${ln(s.t).map(x=>`<li>${f(x)}</li>`).join("")}</ul></div><div><h6>O'quvchi</h6><ul>${ln(s.s).map(x=>`<li>${f(x)}</li>`).join("")}</ul></div></div></div>`);
    const ex=[];
    if(s.nm.trim())ex.push(`<div class="v-say"><b>Namuna matn</b>“${f(s.nm)}”</div>`);
    if(ln(s.q).length)ex.push(`<div class="v-qs"><h6>Savollar</h6><ol>${ln(s.q).map(x=>`<li>${qa(x)}</li>`).join("")}</ol></div>`);
    if(isAsk(s.n))askA(ex);
    if(isB(s.n))matA(ex);
    if(isT(s.n))tasksA(ex);
    gameX(s,ex);
    if(isMz(s.n))mzA(ex);
    if(isHw(s.n))hwA(ex);
    ex.forEach(h=>out.push(`<div class="v-stg" style="--c:${c};margin-top:0">${h}</div>`));
  });
  // mos bosqichi yo'q bo'limlar yo'qolmaydi
  if(!sl.A)askA(ext);if(!sl.B)matA(ext);if(!sl.T)tasksA(ext);if(!sl.M)mzA(ext);if(!sl.H)hwA(ext);
  if(ext.length){out.push(`\u0001<div class="v-sec"><i>+</i><b>Qo'shimcha</b></div>`);ext.forEach(h=>out.push(h));}
  out.push(`\u0001<div class="v-sec"><i>5</i><b>Dars yakuni</b></div>`);
  out.push(`<p style="margin-top:6px">${f(p.xul)}</p>${o.quote?`<div class="v-qt">«${e(X.quote)}»</div>`:""}${o.sig?`<div class="v-sig"><div>O'qituvchi</div><div>O'IBDO'</div><div>Direktor</div></div>`:""}`);
  return out;}
function askA(ex){if(X.o.ask&&X.ask.length)ex.push(`<div class="v-ask"><b>So'raladi:</b> ${e(X.ask.join(", "))}</div>`);}
function matA(ex){X.MB.forEach(b=>{if(b.k==="g")ex.push(`<p class="v-mq" style="color:#1a1f24;margin-top:6px">${f(b.v)}</p>`);else if(b.k==="f")ex.push(`<div class="v-fx">${X.fF(b.v)}</div>`);else if(b.k==="fig"||b.k==="img")ex.push(`<div class="v-mt"><div class="fig">${figH(b,240)}</div><div class="v-ex">${b.cap?`<b>Chizma:</b> ${f(b.cap)}`:""}</div></div>`);else if(b.k==="ex")ex.push(`<div class="v-qs"><h6>Namunaviy yechim</h6>${ln(b.v).map((x,k)=>k?`<div style="padding-left:14px">${f(x)}</div>`:`<div><b>${f(x)}</b></div>`).join("")}</div>`);else if(b.k==="n")ex.push(`<div class="v-nb"><b>Eslatma:</b> ${f(b.v)}</div>`);});}
function tasksA(ex){if(X.o.tasks&&X.T.length)ex.push(`<div class="v-qs"><h6>Topshiriqlar · A — oson, B — o'rta, C — qiyin</h6></div><div class="v-tk">${X.T.map(t=>`<span><em class="v-lv ${t.lv}">${t.lv}</em>${f(t.q)}${t.a?`<i>${f(t.a)}</i>`:""}</span>`).join("")}</div>`);}
function mzA(ex){const p=X.p;if(p.mezon.length)ex.push(`<table class="v-t"><tr><th>Baholash mezoni</th><th style="text-align:right">Ball</th></tr>${p.mezon.map(x=>`<tr><td>${e(x[0])}</td><td class="v-m">${x[1]}</td></tr>`).join("")}<tr class="v-tot"><td>Jami${mzScale(p)}</td><td class="v-m">${mzTot(p)}</td></tr></table>`);}
function hwA(ex){const {l,p}=X;ex.push(`<div class="v-hw"><div><small>Darslik</small><b>${f(l.hw||"—")}</b></div>${["A","B","C"].map(k=>`<div><small>${k} · ${{A:"oson",B:"o'rta",C:"qiyin"}[k]}</small>${f(p.hwx[k]||"—")}</div>`).join("")}</div>${p.hwx.ij?`<div class="v-mq" style="margin-top:4px"><b>Ijodiy:</b> ${f(p.hwx.ij)}</div>`:""}`);}
function gameX(s,ex){const p=X.p;
  if(s.gm==="hayoq"){const H=p.game.hy.filter(x=>x.b.trim());if(H.length)ex.push(`<div class="v-gm"><h6>«Ha–Yo'q» o'yini — bayonot ekranda chiqadi, o'quvchilar kartochka ko'taradi</h6><div class="v-hy">${H.map((x,k)=>`<span>${k+1}. ${f(x.b)}<em class="${x.a==="Ha"?"h":"y"}">${x.a}</em></span>`).join("")}</div></div>`);}
  if(s.gm==="klaster"&&p.game.kl.some(x=>x.trim()))ex.push(`<div class="v-gm"><h6>«Klaster» — markazda mavzu, atrofida tushunchalar</h6><div class="v-klw">${X.klSvg(X.l.t,p.game.kl)}</div></div>`);
  if(s.gm==="besh"&&p.game.bb.length)ex.push(`<div class="v-gm"><h6>«Besh barmoq» — har barmoqqa bitta savol</h6>${p.game.bb.map(x=>`<div><b>${e(x.f)}</b> (${e(x.t)}): ${f(x.q)}${x.a?` <span class="v-an">→ ${f(x.a)}</span>`:""}</div>`).join("")}</div>`);
  if(s.gm==="sinkveyn"&&p.game.sk.some(x=>String(x||"").trim()))ex.push(`<div class="v-gm"><h6>«Sinkveyn» — 5 qatorli she'r (namuna)</h6>${p.game.sk.map(x=>`<div style="text-align:center">${f(x)}</div>`).join("")}</div>`);}

/* ── B · Rasmiy ── */
function chB(){const {l,p,o,cv}=X,tm=times(p),out=[],sl=slots(p),tot=X.sum(p);
  out.push(`<div class="v-ap"><div><b>«TASDIQLAYMAN»</b><br>O'quv ishlari bo'yicha direktor o'rinbosari<br>____________________<br>«____» ____________ ${X.dd(l.d).getFullYear()}-y.</div></div>
    <h2>${cv.ochiq?"OCHIQ DARS ISHLANMASI":"DARS ISHLANMASI"}</h2>${cv.school?`<div class="v-sub">${e(cv.school)}</div>`:""}
    <table class="v-inf" style="margin-top:8px">${[["Fan",X.sub],["Sinf",X.cls],["Sana",`${X.fS(l.d)} (${X.ql}, ${l.n}-dars)`],["Mavzu",`«${l.t}»${l.h>1?` (${l.k}-dars)`:""}`],["Dars turi",p.type],["Davomiyligi",`${tot} daqiqa`],["Dars shakli",[...p.shakl].join(", ")],["Metodlar",[...p.met].join(", ")],["Jihozlar",[...p.jih,p.tex].filter(Boolean).join(", ")],p.fan?["Fanlararo bog'liqlik",p.fan]:null].filter(Boolean).map(([a,b])=>`<tr><td>${a}:</td><td>${e(b||"—")}</td></tr>`).join("")}</table>`);
  out.push(`\u0001<h3>I. Darsning maqsadlari</h3>`);
  out.push(`<table class="v-inf">${[["Ta'limiy",0],["Tarbiyaviy",1],["Rivojlantiruvchi",2]].map(([a,k])=>`<tr><td>${a}:</td><td>${f(p.g[k])}</td></tr>`).join("")}<tr><td>Kompetensiyalar:</td><td>${e([...p.komp].join(", ")||"—")}</td></tr></table>`);
  if(ln(p.res).length){out.push(`\u0001<h3>II. Kutilayotgan natijalar</h3>`);
    out.push(`<div>Dars yakunida o'quvchi:</div><ul class="v-gl">${ln(p.res).map(x=>`<li>${f(x)}</li>`).join("")}</ul>`);}
  out.push(`\u0001<h3>III. Darsning borishi</h3>`);
  const head=`<table class="v-rt"><tr><th style="width:34px">№</th><th style="width:118px">Bosqich, vaqt</th><th>O'qituvchi faoliyati</th><th>O'quvchi faoliyati</th><th style="width:60px">Usul</th></tr></table>`;
  out.push({h:head,head:true,glue:true});
  const row=h=>({h:`<table class="v-rt"><tr><td class="v-c1"></td><td class="v-c2"></td><td colspan="3" class="v-xx">${h}</td></tr></table>`,row:true});
  const ext=[];
  p.st.forEach((s,j)=>{
    out.push({h:`<table class="v-rt"><tr><td class="v-c1">${j+1}</td><td class="v-c2"><b>${e(s.n)}</b><br>${s.m} daq<br><span class="v-tr">(${tm[j][0]}–${tm[j][1]})</span></td><td><ul>${ln(s.t).map(x=>`<li>${f(x)}</li>`).join("")}</ul></td><td><ul>${ln(s.s).map(x=>`<li>${f(x)}</li>`).join("")}</ul></td><td class="v-c5">${s.gm?GN[s.gm].replace(/[«»]/g,""):isB(s.n)?e([...p.met].slice(0,2).join(", ")||"—"):"—"}</td></tr></table>`,row:true});
    const ex=[];
    if(s.mq)ex.push(`<i>Maqsad:</i> ${f(s.mq)}`);
    if(s.nm.trim())ex.push(`<i>Namuna matn:</i> “${f(s.nm)}”`);
    if(ln(s.q).length)ex.push(`<b>Savollar:</b> ${ln(s.q).map((x,k)=>`${k+1}) ${qa(x)}`).join("; ")}`);
    if(isAsk(s.n))askB(ex);
    if(isB(s.n))matB(ex);
    if(isT(s.n))tasksB(ex);
    gameB(s,ex);
    if(isMz(s.n))mzB(ex);
    if(isHw(s.n))hwB(ex);
    ex.forEach(h=>out.push(row(h)));
  });
  if(!sl.A)askB(ext);if(!sl.B)matB(ext);if(!sl.T)tasksB(ext);if(!sl.M)mzB(ext);if(!sl.H)hwB(ext);
  ext.forEach(h=>out.push(row(h)));
  out.push({h:`<table class="v-rt"><tr><td class="v-c1"></td><td class="v-c2"><b>Jami</b></td><td colspan="2"></td><td class="v-c5"><b>${tot} daq</b></td></tr></table>`,row:true});
  out.push(`\u0001<h3>IV. Dars yakuni</h3>`);
  out.push(`<div>${f(p.xul)}</div>${o.sig?`<div class="v-sig"><div><span>Fan o'qituvchisi:</span><span>______________ ${e(cv.fio||"")}</span></div><div><span>Tekshirdi (O'IBDO'):</span><span>______________</span></div></div>`:""}`);
  return out;}
function askB(ex){if(X.o.ask&&X.ask.length)ex.push(`<b>So'raladigan o'quvchilar:</b> ${e(X.ask.join(", "))}`);}
function matB(ex){X.MB.forEach(b=>{if(b.k==="g")ex.push(f(b.v));else if(b.k==="f")ex.push(`<div class="v-fx">${X.fF(b.v)}</div>`);else if(b.k==="ex")ex.push(`<b>Namunaviy misol:</b> ${ln(b.v).map(f).join(" ")}`);else if(b.k==="n")ex.push(`<b>Eslatma:</b> ${f(b.v)}`);else if(b.k==="fig"||b.k==="img")ex.push(`<div class="v-mt"><div class="fig">${figH(b,170)}</div><div>${f(b.cap||"")}</div></div>`);});}
function tasksB(ex){if(X.o.tasks&&X.T.length)ex.push(`<b>Topshiriqlar</b> (A — oson, B — o'rta, C — qiyin): ${X.T.map((t,k)=>`${k+1}) <b>(${t.lv})</b> ${f(t.q)}${t.a?` [${f(t.a)}]`:""}`).join("; ")}`);}
function gameB(s,ex){const p=X.p;
  if(s.gm==="hayoq"){const H=p.game.hy.filter(x=>x.b.trim());if(H.length)ex.push(`<b>«Ha–Yo'q» bayonotlari:</b> ${H.map((x,k)=>`${k+1}) ${f(x.b)} — <i>${x.a}</i>`).join("; ")}`);}
  if(s.gm==="klaster"&&p.game.kl.some(x=>x.trim()))ex.push(`<b>Klaster:</b> markazda «${e(X.l.t)}», tarmoqlar: ${p.game.kl.filter(x=>x.trim()).map(f).join("; ")}`);
  if(s.gm==="besh"&&p.game.bb.length)ex.push(`<b>«Besh barmoq»:</b> ${p.game.bb.map(x=>`${e(x.f)} — ${f(x.q)}${x.a?` [${f(x.a)}]`:""}`).join("; ")}`);
  if(s.gm==="sinkveyn"&&p.game.sk.some(x=>String(x||"").trim()))ex.push(`<b>«Sinkveyn» (namuna):</b> ${p.game.sk.filter(x=>String(x||"").trim()).map(f).join(" / ")}`);}
function mzB(ex){const p=X.p;if(p.mezon.length)ex.push(`<b>Baholash mezonlari:</b> ${p.mezon.map(x=>`${e(x[0])} — ${x[1]} ball`).join("; ")}. Jami ${mzTot(p)} ball${mzScale(p).replace(" · ","; ")}.`);}
function hwB(ex){const {l,p}=X;ex.push(`<b>Uyga vazifa:</b> ${f(l.hw||"—")}${["A","B","C"].filter(k=>p.hwx[k]).map(k=>`; ${k}: ${f(p.hwx[k])}`).join("")}${p.hwx.ij?`; ijodiy: ${f(p.hwx.ij)}`:""}`);}

/* ── C · Rangli ── */
function chC(){const {l,p,o,cv,I}=X,tm=times(p),out=[],sl=slots(p),tot=X.sum(p);
  out.push(`<div class="v-hero"><div><div class="v-eb">${e(p.type)} darsi · ${X.cls} · ${e(X.sub)}</div><h2>${e(l.t)}${l.h>1?` <span class="v-pt">(${l.k}-dars)</span>`:""}</h2><div class="v-mt2">${X.fL(l.d)} · ${X.ql}, ${l.n}-dars${cv.fio?` · ${e(cv.fio)}`:""}</div></div><div class="v-clk"><div><b>${tot}</b><small>daqiqa</small></div></div></div>
    <div class="v-pills">${[...p.met].map(x=>`<span class="v-pill">${e(x)}</span>`).join("")}${[...p.jih].map(x=>`<span class="v-pill v-t">${e(x)}</span>`).join("")}${[...p.shakl].map(x=>`<span class="v-pill v-o">${e(x)}</span>`).join("")}</div>`);
  out.push(`\u0001<div class="v-h3"><i>${I("bullseye")}</i><b>Maqsadlar</b></div>`);
  out.push(`<div class="v-gcards">${[["Ta'limiy",0,"k1"],["Tarbiyaviy",1,"k2"],["Rivojlantiruvchi",2,"k3"]].map(([a,k,c])=>`<div class="${c}"><small>${a}</small>${f(p.g[k])}</div>`).join("")}</div>`);
  if(ln(p.res).length){out.push(`\u0001<div class="v-h3"><i style="--bg:#fff1dc;color:#c27c0e">${I("star-fill")}</i><b>Dars oxirida o'quvchi</b></div>`);
    out.push(`<ul class="v-res">${ln(p.res).map(x=>`<li><span>${f(x)}</span></li>`).join("")}</ul>`);}
  out.push(`\u0001<div class="v-h3"><i style="--bg:#e3eefa;color:#2f80c9">${I("clock")}</i><b>Dars rejasi</b></div>`);
  out.push(`<div class="v-tl">${p.st.map((s,j)=>`<div style="flex:${Math.max(s.m,4)};background:${SCOL[j%7]}"><b>${s.m}′</b>${e(s.n)}</div>`).join("")}</div>`);
  const card=(j,hd,ex)=>{const v=`--c:${SCOL[j%7]};--cs:${SSOFT[j%7]}`;out.push(`<div class="v-card${ex.length?" top":""}" style="${v}">${hd}</div>`);ex.forEach((h,k)=>out.push(`<div class="v-card ${k===ex.length-1?"end":"mid"}" style="${v}"><div class="v-cb">${h}</div></div>`));};
  const ext=[];
  p.st.forEach((s,j)=>{const ex=[];
    if(s.nm.trim())ex.push(`<div class="v-say">${f(s.nm)}</div>`);
    if(ln(s.q).length)ex.push(`<div class="v-qs"><h6>${I("question-circle-fill")} Savollar</h6><ol>${ln(s.q).map(x=>`<li>${qa(x)}</li>`).join("")}</ol></div>`);
    if(isAsk(s.n))askC(ex);
    if(isB(s.n))matC(ex);
    if(isT(s.n))tasksC(ex);
    gameX(s,ex);
    if(isMz(s.n))mzC(ex);
    if(isHw(s.n))hwC(ex);
    card(j,`<div class="v-ch"><span class="v-nn">${j+1}</span><b>${e(s.n)}</b><span class="v-tm">${tm[j][0]}–${tm[j][1]}′</span></div><div class="v-cb">${s.mq?`<div class="v-mq">${f(s.mq)}</div>`:""}
      <div class="v-two"><div><h6>${I("person-video3")} O'qituvchi</h6><ul>${ln(s.t).map(x=>`<li>${f(x)}</li>`).join("")}</ul></div><div><h6>${I("people-fill")} O'quvchi</h6><ul>${ln(s.s).map(x=>`<li>${f(x)}</li>`).join("")}</ul></div></div></div>`,ex);
  });
  if(!sl.A)askC(ext);if(!sl.B)matC(ext);if(!sl.T)tasksC(ext);if(!sl.M)mzC(ext);if(!sl.H)hwC(ext);
  if(ext.length)card(6,`<div class="v-ch"><span class="v-nn">+</span><b>Qo'shimcha</b></div>`,ext);
  out.push(`\u0001<div class="v-h3"><i style="--bg:#e1f5e9;color:#1f9d55">${I("check2-circle")}</i><b>Xulosa</b></div>`);
  out.push(`<p style="margin-top:6px">${f(p.xul)}</p>${o.quote?`<div class="v-qt">«${e(X.quote)}»</div>`:""}${o.sig?`<div class="v-sig"><div>O'qituvchi</div><div>O'IBDO'</div><div>Direktor</div></div>`:""}`);
  return out;}
function askC(ex){if(X.o.ask&&X.ask.length)ex.push(`<div class="v-ask"><b>So'raladi:</b>${X.ask.map(x=>`<span>${e(x)}</span>`).join("")}</div>`);}
function matC(ex){const I=X.I;X.MB.forEach(b=>{if(b.k==="g")ex.push(`<p style="margin-top:7px">${f(b.v)}</p>`);else if(b.k==="f")ex.push(`<div class="v-fx">${X.fF(b.v)}</div>`);else if(b.k==="fig"||b.k==="img")ex.push(`<div class="v-mt"><div class="fig">${figH(b,240)}</div><div class="v-ex">${b.cap?`<b>Chizma:</b> ${f(b.cap)}`:""}</div></div>`);else if(b.k==="ex")ex.push(`<div class="v-qs v-gr"><h6>${I("pencil-fill")} Namunaviy yechim</h6>${ln(b.v).map((x,k)=>k?`<div style="padding-left:14px">${f(x)}</div>`:`<div><b>${f(x)}</b></div>`).join("")}</div>`);else if(b.k==="n")ex.push(`<div class="v-nb">${I("exclamation-triangle-fill")} ${f(b.v)}</div>`);});}
function tasksC(ex){if(X.o.tasks&&X.T.length)ex.push(`<div class="v-tk">${X.T.map(t=>`<span><em class="v-lv ${t.lv}">${t.lv}</em>${f(t.q)}${t.a?`<i>${f(t.a)}</i>`:""}</span>`).join("")}</div>`);}
function mzC(ex){const p=X.p;if(p.mezon.length)ex.push(`<div class="v-mz">${p.mezon.map(x=>`<span>${e(x[0])}</span><b>${x[1]} ball</b>`).join("")}<span><b>Jami</b>${mzScale(p)}</span><b>${mzTot(p)} ball</b></div>`);}
function hwC(ex){const {l,p,I}=X;ex.push(`<div class="v-hw"><div><small>${I("book")} Darslik</small>${f(l.hw||"—")}</div>${["A","B","C"].map(k=>`<div><small><em class="v-lv ${k}">${k}</em></small>${f(p.hwx[k]||"—")}</div>`).join("")}</div>${p.hwx.ij?`<div class="v-say v-ij">Ijodiy: ${f(p.hwx.ij)}</div>`:""}`);}

/* ── muqovalar ── */
function cover(vs){const {l,p,cv}=X,fa=fattr(vs,X.o.ff||"auto"),fan=e(cv.fan||X.sub),yr=`${cv.yr}–${cv.yr+1}`;
  if(vs==="A")return `<div${fa} class="v-pg v-sA v-cv"><div class="v-cvi"><div class="v-cvt">${cv.school?`<b>${e(cv.school)}</b>`:""}${cv.place?`<br>${e(cv.place)}`:""}</div>
    <div class="v-cvm"><div class="v-eb">${cv.ochiq?"Ochiq dars · ":""}${e(p.type)} darsi</div><h1>Dars ishlanmasi</h1><div class="v-tp">«${e(l.t)}»</div></div>
    <div><div class="v-cvg"><div><small>Sinf</small><b>${X.cls}</b></div><div><small>Fan</small><b>${fan}</b></div><div><small>Sana</small><b>${X.fS(l.d)}</b></div></div>
    <div class="v-cvt" style="margin-top:14px">Fan o'qituvchisi: <b>${cv.fio?e(cv.fio):"______________________"}</b><br>${yr} o'quv yili</div></div></div></div>`;
  if(vs==="B")return `<div${fa} class="v-pg v-sB v-cv"><div class="v-cvi"><div>${cv.place?`${e(cv.place)} MMTBga qarashli<br>`:""}${cv.school?e(cv.school):""}</div>
    <div class="v-cvh">${cv.ochiq?"OCHIQ DARS":"DARS"}<br>ISHLANMASI</div><div class="v-cvt">Fan: ${fan} · ${X.cls} sinf<br>Mavzu: «${e(l.t)}»</div>
    <div class="v-cvf">Tayyorladi: ${cv.fio?e(cv.fio):"______________________"},<br>${fan} fani o'qituvchisi</div><div class="v-cvy">${yr} o'quv yili · ${X.fS(l.d)}</div></div></div>`;
  return `<div${fa} class="v-pg v-sC v-cv"><div class="v-cvi"><div class="v-sch">${[cv.school,cv.place].filter(Boolean).map(e).join(" · ")}</div><span class="v-bdg">${cv.ochiq?"OCHIQ DARS":e(p.type).toUpperCase()+" DARSI"}</span><h1>Dars<br>ishlanmasi</h1><div class="v-tp">«${e(l.t)}»</div>
    <div class="v-cvb"><div><small>Sinf</small><b>${X.cls}</b></div><div><small>Fan</small><b>${fan}</b></div><div><small>Sana</small><b>${X.fS(l.d)}</b></div></div><div class="v-fio">Fan o'qituvchisi: <b>${cv.fio?e(cv.fio):"______________________"}</b> · ${yr} o'quv yili</div></div></div>`;}

/* ── betlarga bo'lish: har bo'lak yashirin A4 da o'lchanadi; jadval qatori yangi betga o'tsa sarlavhasi takrorlanadi ── */
function paginate(chunks,vs,ff){
  let m=document.getElementById("is-vmeas");if(!m){m=document.createElement("div");m.id="is-vmeas";m.style.cssText="position:absolute;left:-12000px;top:0;visibility:hidden;width:794px";document.body.appendChild(m);}
  const mk=()=>{m.innerHTML=`<div id="ishd"><div class="v-pg v-s${vs}"${fattr(vs,ff)}><div class="v-pin"></div><div class="v-pft"><span>x</span><span>1</span></div></div></div>`;return m.querySelector(".v-pin");};
  const cs=[];let gl="",head=null;
  chunks.forEach(c=>{if(typeof c==="string")c={h:c};if(c.head)head=c.h;
    if(c.h[0]==="\u0001"){gl+=c.h.slice(1);return;}
    if(c.glue){gl+=c.h;return;}
    cs.push({h:gl+c.h,row:c.row,head:c.row?head:null});gl="";});
  if(gl)cs.push({h:gl});
  const pages=[];let pin=mk(),cur=[];
  const fits=()=>pin.scrollHeight<=pin.clientHeight+1;
  cs.forEach(c=>{const w=`<div class="v-ck">${c.h}</div>`;pin.insertAdjacentHTML("beforeend",w);
    if(!fits()&&cur.length){pages.push(cur);cur=[];pin=mk();
      if(c.row&&c.head&&!c.h.includes(c.head)){const hw=`<div class="v-ck">${c.head}</div>`;pin.insertAdjacentHTML("beforeend",hw);cur.push(hw);}
      pin.insertAdjacentHTML("beforeend",w);}
    cur.push(w);});
  if(cur.length)pages.push(cur);m.innerHTML="";
  return pages;}

// X: {l,p,o,cv:{fio,school,place,fan,ochiq,yr},ask:[ism],T,MB,quote, cls,sub,ql,sum, esc,fx,fF,figSvg,klSvg,I,lines,fS,fL,dd}
// natija: {cover:"…"|"", pages:["<div class=v-pg …>…</div>", …]} — o.vs uslub, o.ff shrift
function pages(x){
  X=x;const vs=["A","B","C"].includes(x.o.vs)?x.o.vs:"A",ff=x.o.ff||"auto";
  try{
    const ch={A:chA,B:chB,C:chC}[vs](),body=paginate(ch,vs,ff),fa=fattr(vs,ff);
    const foot=`${x.cls} · ${e(x.sub)} · Dars ishlanmasi · ${x.fS(x.l.d)}`;
    return {cover:x.o.cover?cover(vs):"",body:body.map(c=>({html:c.join(""),vs,fa,foot}))};
  }finally{X=null;}
}
// bet raqami umumiy (muqova, kartochkalar bilan) bo'lgani uchun pastki qator oxirida qo'yiladi
function page(b,n,N,id){
  const ft=b.vs==="B"?`<div class="v-pft">${n}</div>`:b.vs==="C"?`<div class="v-pft"><span>${b.foot}</span><span class="v-dots">${Array.from({length:Math.min(N,14)},(_,k)=>`<i class="${k===n-1?"on":""}"></i>`).join("")}</span><span>${n}/${N}</span></div>`:`<div class="v-pft"><span>${b.foot}</span><span>${n}/${N}</span></div>`;
  return `<div${b.fa} class="v-pg v-s${b.vs}"${id?` id="${id}"`:""}><div class="v-pin">${b.html}</div>${ft}</div>`;
}
return {pages,page,loadFonts,ready,STY,FSETS,FAUTO,setOf,fname,fattr};
})();
