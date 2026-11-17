
/* ===== 雲端紀錄設定 =====
   把 Google Apps Script 部署成「網頁應用程式」後得到的網址貼在這裡（結尾是 /exec）。
   留空時為預覽模式：紀錄只顯示在畫面上，不會送出。 */
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxHa2P7WK6E9RrIxbrq_mYD2oZbZ1l59xbueBlimHS7C_l1_-NqL8qLxIkHMufFpEnMEQ/exec";

/* ===== 登入（學號、姓名） ===== */
const LOGIN = {sid:"", name:""};
try{ LOGIN.sid = localStorage.getItem("thermo_sid")||""; LOGIN.name = localStorage.getItem("thermo_name")||""; }catch(e){}
const SESSION = Math.random().toString(36).slice(2,8);
let PREVIEW_LAST = null;

function sendRecord(rec, useBeacon){
  rec = Object.assign({sid:LOGIN.sid, name:LOGIN.name, unit:UNIT, event:"", itemId:"", type:"", result:"",
    stuckStep:"", hints:"", minutes:"", rating:"", feedback:"", session:SESSION}, rec);
  PREVIEW_LAST = rec;
  if(!SHEET_URL) return Promise.resolve("preview");
  const body = JSON.stringify(rec);
  try{
    if(useBeacon && navigator.sendBeacon){ navigator.sendBeacon(SHEET_URL, new Blob([body],{type:"text/plain"})); return Promise.resolve("ok"); }
  }catch(e){}
  return fetch(SHEET_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body}).then(()=>"ok");
}

/* ===== 遊戲（game.js）用的作答歷史 ===== */
const UNIT_NO = String(UNIT).split(" ")[0];
const UNIT_NAMES={"0":"單元 0 認識主角與數學","1":"單元 1 第一定律","2":"單元 2 第二定律與熵","3":"單元 3 熵的統計詮釋","4":"單元 4 熱力勢與平衡判據","5":"單元 5 熱力學關係式","6":"單元 6 熱容量與第三定律","7":"單元 7 單成分相平衡"};
let HIST={};
function loadHist(){ try{ HIST=JSON.parse(localStorage.getItem("thermo-hist-"+(LOGIN.sid||""))||"{}")||{}; }catch(e){ HIST={}; } }
function saveHist(){ try{ localStorage.setItem("thermo-hist-"+(LOGIN.sid||""),JSON.stringify(HIST)); }catch(e){} }
loadHist();
function weakZone(){
  const t={};
  for(const k in HIST){ const u=k.split("-")[0]; t[u]=t[u]||{ok:0,n:0}; t[u].n++; if(HIST[k].ok) t[u].ok++; }
  let best=null;
  for(const u in t){ const f=t[u].ok/t[u].n; if(t[u].ok<t[u].n && (!best||f<best.f)) best={f,key:"u"+u,label:UNIT_NAMES[u]||("單元 "+u)}; }
  return best?{key:best.key,label:best.label}:null;
}
function gameAnswer(key, ok, opts){
  opts=opts||{};
  const h=HIST[key]||{tries:0,ok:false}; const prevTries=h.tries, wasOk=h.ok;
  h.tries++; if(ok) h.ok=true; HIST[key]=h; saveHist();
  if(!window.GAME||!LOGIN.sid) return;
  if(ok && !wasOk){
    GAME.answer({id:key, ok:true, first:prevTries===0, practice:!!opts.practice, wasWrong:prevTries>0,
      kind:opts.kind||"auto", nohint:!!opts.nohint, zone:{key:"u"+UNIT_NO, label:UNIT_NAMES[UNIT_NO]||UNIT}});
    GAME.setWeak(weakZone());
  } else if(!ok && !wasOk && opts.kind!=="open") GAME.wrong({id:key});
}
let lastAct=Date.now();
["click","keydown","scroll","touchstart"].forEach(ev=>addEventListener(ev,()=>{lastAct=Date.now()},{passive:true}));
setInterval(()=>{ if(window.GAME && LOGIN.sid && document.visibilityState==="visible" && Date.now()-lastAct<120000) GAME.time(5); },5000);

function showGate(){
  document.body.style.overflow="hidden";
  const ov = el("div",{class:"gate"});
  ov.innerHTML = `<div class="gate-box">
    <div class="kicker">材料熱力學練習簿</div>
    <h2 style="border:0;padding:0;margin:4px 0 6px">單元 ${UNIT}</h2>
    <p class="stats" style="margin:0 0 14px">請輸入學號與姓名後開始練習。你的作答紀錄會送給授課老師。</p>
    <label>學號<input id="g-sid" type="text" autocomplete="off" value="${LOGIN.sid.replace(/"/g,"")}"></label>
    <label>姓名<input id="g-name" type="text" autocomplete="off" value="${LOGIN.name.replace(/"/g,"")}"></label>
    <div class="gate-err"></div>
    <button class="primary" id="g-go" style="width:100%;padding:8px">開始練習</button></div>`;
  document.body.appendChild(ov);
  const go=()=>{
    const sid=ov.querySelector("#g-sid").value.trim(), name=ov.querySelector("#g-name").value.trim();
    const err=ov.querySelector(".gate-err");
    if(!/^[A-Za-z0-9]{4,12}$/.test(sid)){ err.textContent="請輸入正確的學號（英文字母或數字，4–12 碼）。"; return; }
    if(!name){ err.textContent="請輸入姓名。"; return; }
    LOGIN.sid=sid; LOGIN.name=name;
    try{ localStorage.setItem("thermo_sid",sid); localStorage.setItem("thermo_name",name); sessionStorage.setItem("thermo_in_"+UNIT,"1"); }catch(e){}
    ov.remove(); document.body.style.overflow="";
    renderUserBar();
    loadHist();
    if(window.GAME){ GAME.refreshUser(); GAME.setWeak(weakZone()); }
    sendRecord({event:"進入單元"});
  };
  ov.querySelector("#g-go").onclick=go;
  ov.querySelectorAll("input").forEach(i=>i.addEventListener("keydown",e=>{ if(e.key==="Enter") go(); }));
  setTimeout(()=>ov.querySelector(LOGIN.sid?"#g-go":"#g-sid").focus(),50);
}
function renderUserBar(){
  const bar=document.getElementById("userbar"); if(!bar) return;
  bar.innerHTML = `目前使用者：<b>${LOGIN.sid}</b>　${LOGIN.name}　<button id="relogin">更換使用者</button>
    <span class="stats">${SHEET_URL?"作答紀錄會自動儲存":"（預覽模式：紀錄不會送出）"}</span>`;
  document.getElementById("relogin").onclick=()=>{ LOGIN.sid=""; LOGIN.name=""; try{localStorage.removeItem("thermo_sid");localStorage.removeItem("thermo_name");}catch(e){} showGate(); };
}
let entered=false; try{ entered = sessionStorage.getItem("thermo_in_"+UNIT)==="1"; }catch(e){}
if(LOGIN.sid && LOGIN.name && entered){ renderUserBar(); } else { showGate(); }

/* ===== 每個項目的紀錄狀態 ===== */
const state = {};
function st(id){ return state[id] ||= {start:null, hints:0, stuck:0, revealed:0, correct:0, total:0, done:false}; }

function el(tag, attrs={}, html=""){ const e=document.createElement(tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(html) e.innerHTML=html; return e; }

function mcBlock(id, q, opts, ans, ex, countKey){
  const box = el("div",{class:"check"});
  box.innerHTML = `<div class="lbl">${countKey}</div><div class="q">${q}</div>`;
  const name = id+"-"+Math.random().toString(36).slice(2,7);
  const optsDiv = el("div",{class:"opts"});
  opts.forEach((o,i)=>{ optsDiv.innerHTML += `<label><input type="radio" name="${name}" value="${i}"> ${o}</label>`; });
  box.appendChild(optsDiv);
  const b = el("button",{},"檢查"); const fb = el("div",{class:"fb"});
  let counted=false;
  b.onclick=()=>{
    const sel = box.querySelector("input:checked"); if(!sel){ fb.className="fb bad"; fb.textContent="請先選一個答案。"; return; }
    const s=st(id); if(!s.start) s.start=Date.now();
    const ok = +sel.value===ans;
    if(!counted){ s.total++; if(ok) s.correct++; counted=true; }
    sendRecord({event:"作答", itemId:id, type:itemType(id), result:(countKey+"："+(ok?"對":"錯"))});
    gameAnswer(id+"|"+countKey, ok, {practice:id.includes("-P"), nohint:(s.hints===0&&s.revealed===0)});
    fb.className = "fb "+(ok?"ok":"bad");
    fb.innerHTML = (ok?"答對了。":"再想想。")+(ok?" "+ex:"");
    typeset(fb);
  };
  box.appendChild(el("div",{class:"btns"})).appendChild(b); box.appendChild(fb);
  return box;
}

function recordBlock(id, kind){
  KINDS[id]=kind;
  const box = el("div",{class:"record"});
  const nm = "r-"+id;
  box.innerHTML = `<div class="lbl">自評與送出紀錄</div>
    <div class="stats">理解程度（1 = 完全不懂，5 = 可以自己推出來）</div>
    <div class="scale">${[1,2,3,4,5].map(n=>`<label><input type="radio" name="${nm}" value="${n}">${n}</label>`).join("")}</div>
    <textarea placeholder="哪裡卡住？哪裡不清楚？（選填）"></textarea>
    <div class="btns"><button class="primary">送出紀錄</button></div>
    <div class="status"></div><div class="preview-note"></div>`;
  box.querySelector("button").onclick=()=>submitRecord(id, kind, box);
  return box;
}

function itemType(id){ return id.endsWith("-W")?"暖身測驗":(id.includes("-D")?"推導練習":"習題"); }
function summarize(id, kind){
  const s=st(id);
  const minutes = s.start ? Math.max(1, Math.round((Date.now()-s.start)/60000)) : 0;
  let result;
  if(kind==="derive") result = `答對 ${s.correct}/${s.total}；顯示步驟 ${s.revealed}`;
  else if(kind==="self") result = s.done ? "自評：做對" : (s.selfWrong ? "自評：做錯" : "未作答");
  else result = s.total ? (s.correct ? "答對（嘗試 "+s.total+" 次）" : "未答對（嘗試 "+s.total+" 次）") : "未作答";
  return {itemId:id, type:itemType(id), result, stuckStep: kind==="derive" ? String(s.stuck) : "", hints:String(s.hints), minutes:String(minutes)};
}
function submitRecord(id, kind, box){
  const s=st(id), status=box.querySelector(".status"), note=box.querySelector(".preview-note");
  const rating = box.querySelector(`input[name="r-${id}"]:checked`);
  if(!LOGIN.sid){ showGate(); return; }
  if(!rating){ status.textContent="請選擇理解程度。"; return; }
  const rec = Object.assign(summarize(id,kind), {event:"完成自評", rating:rating.value, feedback:box.querySelector("textarea").value.trim()});
  s.submitted = true;
  if(window.GAME){ GAME.self(id); if(rec.feedback) GAME.rate(id); }
  status.textContent="儲存中…";
  sendRecord(rec).then(r=>{
    if(r==="preview"){
      status.textContent="已記錄（預覽模式）。";
      note.style.display="block";
      note.innerHTML="尚未連結 Google Sheet，這筆紀錄只顯示、沒有送出：<pre class='rec'>"+JSON.stringify(PREVIEW_LAST,null,1)+"</pre>";
    } else status.textContent="已儲存，謝謝！可以修改後再送一次。";
  }).catch(()=>{ status.textContent="儲存失敗，請確認網路後再按一次。"; });
}
/* 離開頁面時：有動過但沒送自評的項目，自動補送一筆「未完成」 */
const KINDS = {};
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="hidden") return;
  for(const id in state){
    const s=state[id];
    if(s.start && !s.submitted && !s.flushed){ s.flushed=true; sendRecord(Object.assign(summarize(id,KINDS[id]||"derive"),{event:"離開（未自評）"}), true); }
  }
});

const mathNames={m1:"M1 一點點的變化",m2:"M2 導數",m3:"M3 偏微分",m4:"M4 全微分",m5:"M5 微分規則",m6:"M6 積分",m7:"M7 ln",m8:"M8 恰當微分",m9:"M9 循環關係",m10:"M10 單位"};


/* ===== 暖身小測驗（頁面有 warmup 時） ===== */
function buildQuiz(containerId, itemId, title, list){
  const box = document.getElementById(containerId); if(!box||!list) return;
  const det = el("details",{class:"item",id:itemId});
  det.innerHTML = `<summary><span>${title}</span><span class="tag">暖身</span></summary>`;
  det.addEventListener("toggle",()=>{ if(det.open){ const s=st(itemId); if(!s.start) s.start=Date.now(); }});
  const body = el("div",{class:"body"});
  list.forEach((c,i)=> body.appendChild(mcBlock(itemId,c.q,c.opts,c.ans,c.ex,"第 "+(i+1)+" 題")));
  body.appendChild(recordBlock(itemId,"derive"));
  det.appendChild(body); box.appendChild(det);
}
if(typeof warmup!=="undefined") buildQuiz("mathquiz", warmup.id, warmup.title, warmup.items);

/* ===== 建立推導練習 ===== */
const dWrap = document.getElementById("derivations");
if(typeof derivations!=="undefined") derivations.forEach((d,di)=>{
  const det = el("details",{class:"item",id:d.id});
  det.innerHTML = `<summary><span>${d.id.split("-")[1]}　${d.title}</span><span class="tag">推導</span></summary>`;
  det.addEventListener("toggle",()=>{ if(det.open){ const s=st(d.id); if(!s.start) s.start=Date.now(); }});
  const body = el("div",{class:"body"});
  body.innerHTML = `<div class="goal"><span class="lbl">目標</span>${d.goal}</div><div class="from"><span class="lbl">起點</span>${d.from}</div><div class="mlinks">用到的數學：${(d.math||[]).map(m=>`<a href="unit00.html#${m}">${mathNames[m]}</a>`).join("")}</div>`;
  d.steps.forEach((sp,si)=>{
    const step = el("div",{class:"step"});
    step.innerHTML = (sp.w?`<div class="why"><span class="wl">這一步在做什麼</span>${sp.w}</div>`:"")+`<div class="q"><span class="n">${si+1}</span>${sp.q}</div>`;
    const btns = el("div",{class:"btns"});
    const hb = el("button",{},"提示"), ab = el("button",{},"顯示這一步");
    const hint = el("div",{class:"hint"},"<b>提示：</b>"+sp.hint), ans = el("div",{class:"ans"},sp.a);
    hb.onclick=()=>{ const s=st(d.id); if(!hint.classList.contains("shown")){ s.hints++; if(!s.stuck) s.stuck=si+1; } hint.classList.add("shown"); };
    ab.onclick=()=>{ const s=st(d.id); if(!ans.classList.contains("shown")){ s.revealed++; if(!s.stuck) s.stuck=si+1; } ans.classList.add("shown"); step.classList.add("done"); };
    btns.append(hb,ab); step.append(btns,hint,ans); body.appendChild(step);
  });
  body.appendChild(el("div",{class:"meaning"},`<span class="lbl">物理意義　</span>${d.meaning}`));
  d.checks.forEach((c,ci)=> body.appendChild(mcBlock(d.id,c.q,c.opts,c.ans,c.ex,"檢查點 "+(ci+1))));
  body.appendChild(recordBlock(d.id,"derive"));
  det.appendChild(body); dWrap.appendChild(det);
});

/* ===== 建立習題 ===== */
const pWrap = document.getElementById("problemList");
if(typeof problems!=="undefined") problems.forEach(p=>{
  const det = el("details",{class:"item",id:p.id});
  const tag = {self:"證明",mc:"選擇",num:"計算"}[p.kind];
  det.innerHTML = `<summary><span>${p.id.split("-")[1]}　${p.title}</span><span class="tag">${tag}</span></summary>`;
  det.addEventListener("toggle",()=>{ if(det.open){ const s=st(p.id); if(!s.start) s.start=Date.now(); }});
  const body = el("div",{class:"body"});
  body.appendChild(el("p",{},p.text));
  const s0 = st(p.id);
  if(p.kind==="mc"){
    body.appendChild(mcBlock(p.id,"請選擇答案",p.opts,p.ans,"","作答"));
  } else if(p.kind==="num"){
    const row = el("div",{class:"numrow"});
    row.innerHTML = `<input type="number" step="any" placeholder="你的答案"><span>${p.unit}</span>`;
    const b = el("button",{},"檢查"); row.appendChild(b);
    const fb = el("div",{class:"fb"});
    b.onclick=()=>{
      const v = parseFloat(row.querySelector("input").value);
      if(isNaN(v)){ fb.className="fb bad"; fb.textContent="請輸入數字。"; return; }
      const s=st(p.id); if(!s.start) s.start=Date.now();
      const ok = Math.abs(v-p.answer) <= Math.abs(p.answer)*p.tol;
      s.total++; if(ok) s.correct=1;
      sendRecord({event:"作答", itemId:p.id, type:"習題", result:"輸入 "+v+"："+(ok?"對":"錯")});
      gameAnswer(p.id, ok, {practice:true, nohint:s.hints===0});
      fb.className="fb "+(ok?"ok":"bad");
      fb.textContent = ok ? "答對了！可以展開詳解對照。" : (Math.sign(v)!==Math.sign(p.answer) ? "正負號不對，再檢查一次。" : "數值不對，檢查單位換算與代入的數字。");
    };
    body.append(row,fb);
  } else {
    const row = el("div",{class:"btns"});
    const ok=el("button",{},"我做對了"), bad=el("button",{},"我做錯了／沒做出來");
    const fb = el("div",{class:"fb"});
    ok.onclick=()=>{ s0.done=true; s0.selfWrong=false; if(!s0.start) s0.start=Date.now(); fb.className="fb ok"; fb.textContent="很好！"; sendRecord({event:"作答", itemId:p.id, type:"習題", result:"自評：做對"}); gameAnswer(p.id, true, {practice:true, kind:"open"}); };
    bad.onclick=()=>{ s0.done=false; s0.selfWrong=true; if(!s0.start) s0.start=Date.now(); fb.className="fb bad"; fb.textContent="對照詳解，找出卡住的地方，寫在下面的回饋裡。"; sendRecord({event:"作答", itemId:p.id, type:"習題", result:"自評：做錯"}); };
    body.appendChild(el("div",{class:"stats"},"先在紙上寫出證明，對照詳解後自評："));
    row.append(ok,bad); body.append(row,fb);
  }
  const btns = el("div",{class:"btns"}); btns.style.marginTop="10px";
  const hb=el("button",{},"提示"), sb=el("button",{},"詳解");
  const hint=el("div",{class:"hint"},"<b>提示：</b>"+p.hint), sol=el("div",{class:"ans"},"<b>詳解：</b><br>"+p.sol);
  hb.onclick=()=>{ if(!hint.classList.contains("shown")) s0.hints++; hint.classList.add("shown"); };
  sb.onclick=()=>{ sol.classList.add("shown"); };
  btns.append(hb,sb); body.append(btns,hint,sol);
  body.appendChild(recordBlock(p.id,p.kind));
  det.appendChild(body); pWrap.appendChild(det);
});

function typeset(node){ if(window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([node]).catch(()=>{}); }
window.MathJax = { tex:{inlineMath:[["\\(","\\)"]]}, svg:{fontCache:"global"} };

/* ===== 啟動遊戲 ===== */
if(window.GAME){
  GAME.onLoginRequest = showGate;
  GAME.onGuide = z => { const n=(z.key||"").replace(/^u/,""); if(n!==UNIT_NO) location.href="unit"+n.padStart(2,"0")+".html"; else document.getElementById(n==="0"?"mathquiz":"derive").scrollIntoView({behavior:"smooth"}); };
  GAME.retroCount = () => Object.values(HIST).filter(h=>h.ok).length;
  GAME.init({mount:document.getElementById("userbar"), weak:weakZone()});
}
