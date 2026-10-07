const KEY="nara-mvp-v1";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,"0");
const localISO=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmtDate=s=>new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric"}).format(new Date(s+"T12:00:00"));
const state=load();

function fresh(){
  return {messages:[{id:uid(),role:"assistant",text:"Ceritakan apa yang perlu dicatat. Contoh: “makan 25 ribu”, “besok jam 10 meeting”, atau “bulan ini olahraga 3 kali seminggu”.",at:new Date().toISOString()}],transactions:[],reminders:[],notes:[],habits:[],goals:[]};
}
function load(){try{return {...fresh(),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return fresh()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderAll()}
function msg(role,text,result=""){state.messages.push({id:uid(),role,text,result,at:new Date().toISOString()})}

function parseAmount(t){
  const s=t.toLowerCase().replace(/rp\.?\s?/g,"").replace(/(\d)\.(?=\d{3}\b)/g,"$1").replace(/(\d),(?=\d{3}\b)/g,"$1");
  const m=s.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)\b/i)||s.match(/(?:sebesar|senilai|pengeluaran|pemasukan|bayar|beli|makan|bensin|transfer|dapat|terima)\D{0,16}(\d[\d.]*)/i);
  if(!m)return null;
  let n=Number(String(m[1]).replace(/\./g,"").replace(",","."));
  const unit=(m[2]||"").toLowerCase();
  if(unit==="juta"||unit==="jt")n*=1e6;
  if(["ribu","rb","k"].includes(unit))n*=1e3;
  return Number.isFinite(n)?Math.round(n):null;
}
function parseTime(t){
  const m=t.toLowerCase().match(/(?:jam|pukul)\s*(\d{1,2})(?:[.:](\d{2}))?/);
  if(!m)return "";
  return `${pad(Math.min(23,+m[1]))}:${pad(+m[2]||0)}`;
}
function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return localISO(d)}
function parseDate(t){
  const s=t.toLowerCase();
  if(/\bhari ini\b|\btadi\b|\bbarusan\b/.test(s))return localISO();
  if(/\blusa\b/.test(s))return addDays(2);
  if(/\bbesok\b/.test(s))return addDays(1);
  const iso=s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/); if(iso)return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  const dm=s.match(/\btanggal\s+(\d{1,2})(?:\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember))?/);
  if(dm){
    const names=["januari","februari","maret","april","mei","juni","juli","agustus","september","oktober","november","desember"],n=new Date(),day=+dm[1];
    let month=dm[2]?names.indexOf(dm[2]):n.getMonth(),year=n.getFullYear();
    const candidate=new Date(year,month,day);
    if(!dm[2]&&candidate<new Date(n.getFullYear(),n.getMonth(),n.getDate())){month++;if(month>11){month=0;year++}}
    return `${year}-${pad(month+1)}-${pad(day)}`;
  }
  return localISO();
}
function categoryFor(t){
  const s=t.toLowerCase();
  if(/bensin|parkir|tol|ojek|grab|gojek|transport/.test(s))return"Transport";
  if(/makan|minum|kopi|sarapan|lunch|dinner|warung/.test(s))return"Food";
  if(/internet|listrik|air|pulsa|tagihan|bill|hosting/.test(s))return"Bills";
  if(/anak|sekolah|spp/.test(s))return"Family";
  if(/kabel|alat|project|proyek|client|klien|freelance|desain/.test(s))return"Work";
  if(/belanja|beli/.test(s))return"Shopping";
  return"Other";
}
function cleanTitle(t){
  return t.replace(/\b(hari ini|tadi|barusan|besok|lusa|pengeluaran|pemasukan|sebesar|senilai|catat(?:kan)?|ingatkan(?: saya)?|tolong|aku|saya|bayar|tanggal)\b/gi," ")
    .replace(/\b(?:rp\.?\s?)?\d[\d.,]*\s*(?:juta|jt|ribu|rb|k)?\b/gi," ")
    .replace(/\b(?:jam|pukul)\s*\d{1,2}(?:[.:]\d{2})?\b/gi," ")
    .replace(/\s+/g," ").replace(/^[:\-\s]+|[:\-\s]+$/g,"").trim();
}
function splitClauses(text){
  return text
    .replace(/\s+dan\s+(?=(?:besok|lusa|hari ini|tadi|catat|ingatkan|meeting|rapat|bayar|terima|dapat)\b)/gi,", ")
    .replace(/\s+dan\s+(?=[^,;.!?]{0,36}\b\d+(?:[.,]\d+)?\s*(?:juta|jt|ribu|rb|k)\b)/gi,", ")
    .split(/[;\n]+|[.!?]\s+|,\s+(?=\S)/).map(x=>x.trim()).filter(Boolean);
}
function financeType(t){
  const s=t.toLowerCase();
  if(/(?:client|klien|customer|pelanggan).{0,24}(?:bayar|transfer)|(?:bayaran|pembayaran)\s+dari/.test(s))return"income";
  if(/pemasukan|pendapatan|income|terima|ditransfer|transfer masuk|dapat pembayaran|gajian|fee masuk/.test(s))return"income";
  if(/pengeluaran|expense|keluar|bayar|beli|makan|bensin|belanja|parkir|kopi/.test(s))return"expense";
  if(/\bfee\b|\bhonor\b/.test(s))return"income";
  return null;
}
function reminderIntent(t){return /meeting|rapat|jadwal|deadline|ingatkan|janji|jemput|berangkat|telepon|hubungi|kirim|bayar.+(?:besok|tanggal)|besok|lusa/.test(t.toLowerCase())}
function noteIntent(t){return /catat|note|ide|gagasan|jangan lupa bahwa/.test(t.toLowerCase())}
function habitIntent(t){return /rutin|habit|kebiasaan|kali seminggu|setiap hari|olahraga|sholat|salat|belajar hal baru|belajar\s+\d+\s*menit/.test(t.toLowerCase())}

function habitSpec(t){
  const s=t.toLowerCase(); let target=1,period="daily";
  const m=s.match(/(\d+)\s*kali\s*seminggu/); if(m){target=+m[1];period="weekly"}
  if(/setiap hari|rutin sholat|rutin salat|belajar.+(?:sehari|setiap hari)/.test(s)){target=1;period="daily"}
  let name=cleanTitle(t).replace(/\b(bulan ini|target|harus|ingin|mau|rutin|setiap hari|\d+ kali seminggu)\b/gi," ").replace(/\s+/g," ").trim();
  if(/sholat|salat/.test(s))name="Sholat";
  else if(/olahraga|workout|gym/.test(s))name="Olahraga";
  else if(/belajar/.test(s)&&name.length>36)name="Belajar hal baru";
  return {name:name||"Habit baru",target,period};
}
function addHabit(spec,monthly=false){
  const existing=state.habits.find(h=>h.name.toLowerCase()===spec.name.toLowerCase());
  if(!existing)state.habits.push({id:uid(),...spec,createdAt:localISO(),doneDates:[]});
  if(monthly&&!state.goals.some(g=>g.title.toLowerCase()===spec.name.toLowerCase())){
    state.goals.push({id:uid(),title:spec.name,target:spec.period==="weekly"?spec.target*4:30,progress:0,kind:"habit",habitName:spec.name,month:localISO().slice(0,7)});
  }
}
function markHabitFromText(t){
  const s=t.toLowerCase();
  if(!/sudah|selesai|done|beres/.test(s))return null;
  const h=state.habits.find(x=>s.includes(x.name.toLowerCase()));
  if(!h)return null;
  if(!h.doneDates.includes(localISO()))h.doneDates.push(localISO());
  return h;
}
function markPaidBillFromText(t){
  const s=t.toLowerCase();
  if(!/(?:sudah|udah).{0,10}(?:dibayar|bayar|lunas)|(?:dibayar|lunas).{0,10}(?:sudah|udah)/.test(s))return null;
  const bills=state.reminders.filter(r=>!r.done&&r.kind==="bill");
  const bill=bills.find(r=>r.title.toLowerCase().split(/\s+/).some(w=>w.length>3&&s.includes(w)));
  if(!bill)return null;
  bill.done=true;
  state.transactions.push({id:uid(),type:"expense",amount:bill.amount,category:bill.category||"Bills",title:bill.title,date:localISO(),createdAt:new Date().toISOString()});
  return bill;
}
function process(text){
  const monthly=/bulan ini|target bulan/.test(text.toLowerCase());
  const paidBill=markPaidBillFromText(text);
  if(paidBill)return [`✓ Tagihan “${paidBill.title}” ditandai lunas dan ${rupiah(paidBill.amount)} dicatat sebagai pengeluaran.`];
  const completed=markHabitFromText(text);
  if(completed)return [`✓ Habit “${completed.name}” ditandai selesai hari ini.`];

  const results=[];
  for(const clause of splitClauses(text)){
    const ft=financeType(clause),amount=ft?parseAmount(clause):null;
    if(ft&&amount){
      const category=categoryFor(clause),date=parseDate(clause),title=cleanTitle(clause)||category;
      const futureBill=ft==="expense"&&/(bayar|tagihan)/i.test(clause)&&/(besok|lusa|tanggal)/i.test(clause)&&date!==localISO();
      if(futureBill){
        state.reminders.push({id:uid(),title:title||"Tagihan",date,time:parseTime(clause),done:false,kind:"bill",amount,category});
        results.push(`✓ Tagihan “${title||"Tagihan"}” ${rupiah(amount)} · jatuh tempo ${fmtDate(date)}`);
        continue;
      }
      state.transactions.push({id:uid(),type:ft,amount,category,title,date,createdAt:new Date().toISOString()});
      results.push(`✓ ${ft==="income"?"Pemasukan":"Pengeluaran"} ${rupiah(amount)} · ${category}`);
      continue;
    }
    if(habitIntent(clause)){
      const spec=habitSpec(clause);addHabit(spec,monthly);
      results.push(`✓ Habit “${spec.name}” · ${spec.period==="weekly"?spec.target+"×/minggu":"harian"}`);
      continue;
    }
    if(reminderIntent(clause)){
      const date=parseDate(clause),time=parseTime(clause),title=cleanTitle(clause)||"Reminder";
      state.reminders.push({id:uid(),title,date,time,done:false});
      results.push(`✓ Reminder “${title}” · ${fmtDate(date)}${time?" "+time:""}`);
      continue;
    }
    if(noteIntent(clause)){
      const body=clause.replace(/^.*?(?:catat(?:kan)?|note|ide)\s*:?\s*/i,"").trim()||clause;
      state.notes.push({id:uid(),title:body.slice(0,48),body,date:localISO(),createdAt:new Date().toISOString()});
      results.push(`✓ Note disimpan: “${body.slice(0,42)}${body.length>42?"…":""}”`);
      continue;
    }
    if(monthly&&clause.length>2){
      const title=cleanTitle(clause).replace(/\b(bulan ini|target|ingin|mau|harus)\b/gi," ").trim();
      if(title){state.goals.push({id:uid(),title,target:1,progress:0,kind:"manual",month:localISO().slice(0,7)});results.push(`✓ Target bulan ini: “${title}”`);continue}
    }
    state.notes.push({id:uid(),title:clause.slice(0,48),body:clause,date:localISO(),createdAt:new Date().toISOString()});
    results.push("✓ Disimpan sebagai note.");
  }
  return results;
}

function sendText(text){
  const t=text.trim();if(!t)return;
  msg("user",t);
  const results=process(t);
  msg("assistant",results.join("\n"),results.length>1?`${results.length} data diproses`:"");
  save();
  requestAnimationFrame(()=>{const s=$("#chatStream");s.scrollTop=s.scrollHeight});
}

function renderChat(){
  const s=$("#chatStream");s.innerHTML=state.messages.map(m=>`<div class="bubble ${m.role}">${esc(m.text).replace(/\n/g,"<br>")}${m.result?`<span class="result">${esc(m.result)}</span>`:""}</div>`).join("");
}
function txTotals(filter=()=>true){return state.transactions.filter(filter).reduce((a,t)=>{a[t.type]+=t.amount;return a},{income:0,expense:0})}
function renderToday(){
  const today=localISO(),agenda=[...state.reminders].filter(r=>!r.done).sort((a,b)=>(a.date+(a.time||"99:99")).localeCompare(b.date+(b.time||"99:99"))).slice(0,8),habits=state.habits;
  $("#agendaCount").textContent=agenda.length;$("#habitCount").textContent=habits.length;
  $("#focusText").textContent=agenda[0]?.title||(habits.length?"Jaga konsistensi habit hari ini.":"Belum ada agenda mendesak.");
  const d=new Date();$("#dateBadge").innerHTML=`<b>${d.getDate()}</b><br>${new Intl.DateTimeFormat("id-ID",{month:"short"}).format(d)}`;
  $("#todayAgenda").classList.toggle("empty",!agenda.length);
  $("#todayAgenda").innerHTML=agenda.length?agenda.map(r=>`<div class="row"><button class="rowicon reminder-done" data-id="${r.id}" aria-label="Tandai reminder selesai">○</button><div class="rowmain"><strong>${esc(r.title)}</strong><span>${r.time||"Tanpa jam"} · ${r.date===today?"Hari ini":fmtDate(r.date)}${r.amount?" · "+rupiah(r.amount):""}</span></div></div>`).join(""):"Belum ada agenda mendatang.";
  $("#todayHabits").classList.toggle("empty",!habits.length);
  $("#todayHabits").innerHTML=habits.length?habits.map(h=>{const done=h.doneDates.includes(today);return `<div class="row"><button class="rowicon habit-toggle" data-id="${h.id}" aria-label="Tandai habit">${done?"✓":"○"}</button><div class="rowmain"><strong>${esc(h.name)}</strong><span>${h.period==="weekly"?h.target+"× per minggu":"Setiap hari"}</span></div><span class="rowvalue">${done?"Done":""}</span></div>`}).join(""):"Belum ada habit aktif.";
  const total=txTotals(t=>t.date===today);$("#todayIncome").textContent=rupiah(total.income);$("#todayExpense").textContent=rupiah(total.expense);$("#todayNet").textContent=rupiah(total.income-total.expense);
}
function row(icon,title,sub,value,klass=""){return `<div class="row"><div class="rowicon">${icon}</div><div class="rowmain"><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>${value?`<div class="rowvalue ${klass}">${esc(value)}</div>`:""}</div>`}
function renderFinance(){
  const total=txTotals(),month=localISO().slice(0,7),mt=txTotals(t=>t.date.startsWith(month));
  $("#balanceTotal").textContent=rupiah(total.income-total.expense);$("#monthIncome").textContent=rupiah(mt.income);$("#monthExpense").textContent=rupiah(mt.expense);$("#sideBalance").textContent=rupiah(total.income-total.expense);
  const recent=[...state.transactions].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,12);
  $("#transactionList").classList.toggle("empty",!recent.length);$("#transactionList").innerHTML=recent.length?recent.map(t=>`<div class="row"><div class="rowicon">${t.type==="income"?"+":"−"}</div><div class="rowmain"><strong>${esc(t.title)}</strong><span>${esc(t.category)} · ${fmtDate(t.date)}</span></div><div class="rowvalue ${t.type==="income"?"good":"bad"}">${t.type==="income"?"+":"−"} ${rupiah(t.amount)}</div><button class="rowaction delete-tx" data-id="${t.id}" aria-label="Hapus transaksi">×</button></div>`).join(""):"Belum ada transaksi.";
  const cats={};state.transactions.filter(t=>t.type==="expense"&&t.date.startsWith(month)).forEach(t=>cats[t.category]=(cats[t.category]||0)+t.amount);
  const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...entries.map(x=>x[1]));
  $("#categoryBreakdown").classList.toggle("empty",!entries.length);$("#categoryBreakdown").innerHTML=entries.length?entries.map(([k,v])=>`<div class="cat"><span>${esc(k)}</span><b>${rupiah(v)}</b><div class="bar"><i style="width:${Math.round(v/max*100)}%"></i></div></div>`).join(""):"Belum ada data.";
}
function renderNotes(){
  const q=($("#noteSearch")?.value||"").toLowerCase(),notes=[...state.notes].filter(n=>(n.title+" "+n.body).toLowerCase().includes(q)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $("#notesGrid").innerHTML=notes.length?notes.map(n=>`<article class="note"><button class="cardaction delete-note" data-id="${n.id}" aria-label="Hapus note">×</button><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notemeta">${fmtDate(n.date)}</div></article>`).join(""):`<div class="empty">Belum ada note.</div>`;
}
function weeklyDone(h){
  const d=new Date(),day=(d.getDay()+6)%7,monday=new Date(d);monday.setDate(d.getDate()-day);monday.setHours(0,0,0,0);
  return h.doneDates.filter(x=>new Date(x+"T12:00:00")>=monday).length;
}
function goalProgress(g){
  if(g.kind==="habit"){
    const h=state.habits.find(x=>x.name===g.habitName);if(!h)return 0;
    const days=h.doneDates.filter(x=>x.startsWith(g.month)).length;
    return Math.min(100,Math.round(days/Math.max(1,g.target)*100));
  }
  return g.progress||0;
}
function renderGoals(){
  const month=localISO().slice(0,7),goals=state.goals.filter(g=>g.month===month);$("#goalMonth").textContent=new Intl.DateTimeFormat("id-ID",{month:"long"}).format(new Date());
  $("#goalsList").classList.toggle("empty",!goals.length);$("#goalsList").innerHTML=goals.length?goals.map(g=>{const p=goalProgress(g);return `<div class="goal"><div class="goaltop"><strong>${esc(g.title)}</strong><span>${p}%</span></div><div class="progress"><i style="width:${p}%"></i></div></div>`}).join(""):"Belum ada target bulan ini.";
  const days=["S","S","R","K","J","S","M"];$("#habitWeek").textContent="Minggu ini";
  $("#habitTracker").classList.toggle("empty",!state.habits.length);
  $("#habitTracker").innerHTML=state.habits.length?state.habits.map(h=>{
    const d=new Date(),dow=(d.getDay()+6)%7,monday=new Date(d);monday.setDate(d.getDate()-dow);
    const dots=days.map((x,i)=>{const dd=new Date(monday);dd.setDate(monday.getDate()+i);const date=localISO(dd),done=h.doneDates.includes(date);return `<button class="daydot ${done?"done":""}" data-habit="${h.id}" data-date="${date}">${x}</button>`}).join("");
    const count=weeklyDone(h),target=h.period==="weekly"?h.target:7;
    return `<div class="habit"><div class="habithead"><strong>${esc(h.name)}</strong><span><small>${count}/${target}</small><button class="rowaction delete-habit" data-id="${h.id}" aria-label="Hapus habit">×</button></span></div><div class="weekdots">${dots}</div></div>`
  }).join(""):"Tambahkan habit lewat chat atau tombol + Habit.";
}
function renderSummary(){
  $("#sideTasks").textContent=state.reminders.filter(r=>!r.done).length;$("#sideHabits").textContent=state.habits.length;$("#sideNotes").textContent=state.notes.length;
}
function renderAll(){renderChat();renderToday();renderFinance();renderNotes();renderGoals();renderSummary()}

function go(page){
  $$(".page").forEach(x=>x.classList.toggle("active",x.id===`page-${page}`));$$(".navbtn[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  $("#pageTitle").textContent=page==="chat"?"NARA":page[0].toUpperCase()+page.slice(1);
  window.scrollTo({top:0,behavior:"smooth"});
}
function openQuick(type){
  if(type)$("#quickType").value=type;
  $("#quickDate").value=localISO();syncQuick();$("#quickDialog").showModal();setTimeout(()=>$("#quickTitle").focus(),60);
}
function syncQuick(){
  const t=$("#quickType").value,finance=["expense","income"].includes(t),rem=t==="reminder",habit=t==="habit";
  $("#amountWrap").classList.toggle("hidden",!finance);$("#dateWrap").classList.toggle("hidden",!(finance||rem));$("#timeWrap").classList.toggle("hidden",!rem);$("#freqWrap").classList.toggle("hidden",!habit);
}
function quickSubmit(e){
  e.preventDefault();const type=$("#quickType").value,title=$("#quickTitle").value.trim();if(!title)return;
  if(["expense","income"].includes(type)){const amount=Number($("#quickAmount").value.replace(/\D/g,""));if(!amount)return alert("Masukkan nominal.");state.transactions.push({id:uid(),type,amount,category:categoryFor(title),title,date:$("#quickDate").value||localISO(),createdAt:new Date().toISOString()})}
  if(type==="reminder")state.reminders.push({id:uid(),title,date:$("#quickDate").value||localISO(),time:$("#quickTime").value,done:false});
  if(type==="note")state.notes.push({id:uid(),title:title.slice(0,48),body:title,date:localISO(),createdAt:new Date().toISOString()});
  if(type==="habit"){const f=$("#quickFrequency").value,spec={name:title,period:f==="daily"?"daily":"weekly",target:f==="3-week"?3:1};addHabit(spec,true)}
  $("#quickForm").reset();$("#quickDate").value=localISO();$("#quickDialog").close();save();
}

document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-page]");if(nav)go(nav.dataset.page);
  const chip=e.target.closest("[data-prompt]");if(chip){$("#chatInput").value=chip.dataset.prompt;$("#chatInput").focus()}
  const act=e.target.closest("[data-action]");if(act){const map={quick:"expense",transaction:"expense",note:"note",habit:"habit"};openQuick(map[act.dataset.action])}
  const ht=e.target.closest(".habit-toggle");if(ht){const h=state.habits.find(x=>x.id===ht.dataset.id),d=localISO();if(h){h.doneDates=h.doneDates.includes(d)?h.doneDates.filter(x=>x!==d):[...h.doneDates,d];save()}}
  const done=e.target.closest(".reminder-done");if(done){const r=state.reminders.find(x=>x.id===done.dataset.id);if(r){r.done=true;save()}}
  const delTx=e.target.closest(".delete-tx");if(delTx){state.transactions=state.transactions.filter(x=>x.id!==delTx.dataset.id);save()}
  const delNote=e.target.closest(".delete-note");if(delNote){state.notes=state.notes.filter(x=>x.id!==delNote.dataset.id);save()}
  const delHabit=e.target.closest(".delete-habit");if(delHabit){const h=state.habits.find(x=>x.id===delHabit.dataset.id);if(h){state.habits=state.habits.filter(x=>x.id!==h.id);state.goals=state.goals.filter(g=>g.habitName!==h.name);save()}}
  const dot=e.target.closest(".daydot");if(dot){const h=state.habits.find(x=>x.id===dot.dataset.habit),d=dot.dataset.date;if(h){h.doneDates=h.doneDates.includes(d)?h.doneDates.filter(x=>x!==d):[...h.doneDates,d];save()}}
});
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const i=$("#chatInput");sendText(i.value);i.value="";i.style.height="auto"});
$("#chatInput").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,112)+"px"});
$("#chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#chatForm").requestSubmit()}});
$("#quickAdd").addEventListener("click",()=>openQuick());
$("#closeDialog").addEventListener("click",()=>$("#quickDialog").close());
$("#quickType").addEventListener("change",syncQuick);$("#quickForm").addEventListener("submit",quickSubmit);$("#noteSearch").addEventListener("input",renderNotes);
const dn=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long"}).format(new Date());$("#dateLabel").textContent=dn;
$("#quickDate").value=localISO();renderAll();
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));