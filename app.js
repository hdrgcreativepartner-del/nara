const KEY="nara-mvp-v1";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,"0");
const localISO=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmtDate=s=>new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric"}).format(new Date(s+"T12:00:00"));
const state=load();
const NARA_ENV={isMedian:/median|MedianIOS|MedianAndroid/i.test((navigator&&navigator.userAgent)||"")};
if(typeof document!=="undefined"&&document.documentElement&&document.documentElement.classList)document.documentElement.classList.toggle("median-app",NARA_ENV.isMedian);
let recognition=null,voiceSession=false,voiceFinal="";

function fresh(){
  return {profile:{name:""},settings:{reminderLead:30},pending:null,lastCreated:null,messages:[{id:uid(),role:"assistant",text:"Hai. Cerita saja seperti biasa. Misalnya: “makan 25 ribu”, “besok jam 10 rapat”, atau “bulan ini olahraga 3 kali seminggu”.",at:new Date().toISOString()}],transactions:[],reminders:[],notes:[],habits:[],goals:[]};
}
function load(){try{const base=fresh(),saved=JSON.parse(localStorage.getItem(KEY)||"{}")||{};return {...base,...saved,profile:{...base.profile,...(saved.profile||{})},settings:{...base.settings,...(saved.settings||{})}}}catch{return fresh()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderAll()}
function msg(role,text,result="",actions=[]){state.messages.push({id:uid(),role,text,result,actions:Array.isArray(actions)?actions:[],at:new Date().toISOString()})}
function firstName(){return ((state.profile&&state.profile.name)||"").trim().split(/\s+/)[0]||""}
function greeting(){const h=new Date().getHours();return h<11?"Selamat pagi":h<15?"Selamat siang":h<19?"Selamat sore":"Selamat malam"}

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
  const s=t.toLowerCase();
  let m=s.match(/(?:jam|pukul)\s*(\d{1,2})(?:[.:](\d{2}))?/);
  if(!m)m=s.match(/\b(\d{1,2})[.:](\d{2})\s*(?:wib|wita|wit)?\b/);
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
function categoryLabel(c){return ({Transport:"Transportasi",Food:"Makan & minum",Bills:"Tagihan",Family:"Keluarga",Work:"Pekerjaan",Shopping:"Belanja",Other:"Lainnya"})[c]||c}
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
    .replace(/\s+(?:kemudian|lalu)\s+(?=(?:pukul|jam|\d{1,2}[.:]\d{2}))/gi,", ")
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
function reminderIntent(t){
  const s=t.toLowerCase();
  if(/ingatkan|pengingat|reminder|jadwal|deadline|janji/.test(s))return true;
  return looksLikeSchedule(t);
}
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
function sentenceCase(s){s=String(s||"").trim();return s?s.charAt(0).toUpperCase()+s.slice(1):s}
function daypartOf(t){const m=String(t).toLowerCase().match(/\b(pagi|siang|sore|malam)\b/);return m?m[1]:""}
function prettyDate(date){if(date===localISO())return"Hari ini";if(date===addDays(1))return"Besok";if(date===addDays(2))return"Lusa";return fmtDate(date)}
function timeChoices(part){
  const map={pagi:["07:00","08:00","09:00"],siang:["12:00","13:00","14:00"],sore:["15:00","16:00","17:00"],malam:["19:00","20:00","21:00"]};
  return [...(map[part]||["09:00","13:00","16:00","19:00"]),"Pilih jam lain"];
}
function normalizeTimeForDaypart(time,part){
  if(!time)return"";
  let [h,m]=time.split(":").map(Number);
  if((part==="sore"||part==="malam")&&h>0&&h<12)h+=12;
  if(part==="siang"&&h>0&&h<7)h+=12;
  return `${pad(Math.min(23,h))}:${pad(m||0)}`;
}
function smartTitle(text){
  let s=String(text||"").trim()
    .replace(/\b(tolong|nara|aku|saya|harus|mau|akan|ingin|ingatkan|catat(?:kan)?|note|reminder)\b/gi," ")
    .replace(/\b(hari ini|besok|lusa|nanti|pagi|siang|sore|malam)\b/gi," ")
    .replace(/\b(?:jam|pukul)\s*\d{1,2}(?:[.:]\d{2})?\s*(?:wib|wita|wit)?\b/gi," ")
    .replace(/\b\d{1,2}[.:]\d{2}\s*(?:wib|wita|wit)?\b/gi," ")
    .replace(/\s+/g," ").replace(/^[,.:;\-\s]+|[,.:;\-\s]+$/g,"").trim();
  s=s.replace(/\bnemuin\b/gi,"temui").replace(/\bnemui\b/gi,"temui").replace(/\bketemu\b/gi,"bertemu dengan");
  if(/^ke\s+/i.test(s))s="Pergi "+s;
  s=s.replace(/\bke\s+([a-z])/g,(m,c)=>"ke "+c.toUpperCase()).replace(/\bmas\s+([a-z])/g,(m,c)=>"Mas "+c.toUpperCase());
  return sentenceCase(s||"Agenda");
}
function paraphraseNote(text){
  let s=String(text||"").trim()
    .replace(/^.*?(?:tolong\s+)?(?:catat(?:kan)?|note|ide)\s*:?[\s-]*/i,"")
    .replace(/\bjangan lupa bahwa\b/gi,"")
    .replace(/\baku\s+(?:harus|mau|akan|ingin)\b/gi,"")
    .replace(/\bsaya\s+(?:harus|mau|akan|ingin)\b/gi,"")
    .replace(/\bnemuin\b/gi,"temui").replace(/\bnemui\b/gi,"temui")
    .replace(/\bketemu(?:an)?\s+(?:sama|dengan)?\s*/gi,"bertemu dengan ")
    .replace(/\s+/g," ").trim();
  s=s.replace(/\bmas\s+([a-z])/g,(m,c)=>"Mas "+c.toUpperCase()).replace(/\bpak\s+([a-z])/g,(m,c)=>"Pak "+c.toUpperCase());
  s=sentenceCase(s||text);
  if(s&&!/[.!?]$/.test(s))s+=".";
  return s;
}
function looksLikeSchedule(text){
  const s=String(text).toLowerCase(),temporal=/\b(hari ini|besok|lusa|nanti|pagi|siang|sore|malam|tanggal\s+\d+)\b/.test(s)||!!parseTime(text);
  const activity=/\b(ke|pergi|berangkat|temui|nemui|nemuin|ketemu|meeting|rapat|review|loading|pasang|pemasangan|acara|jemput|antar|kirim|bayar|ambil|datang|kerja)\b/.test(s);
  return temporal&&activity;
}
function clarificationFor(text){
  if(!looksLikeSchedule(text)||parseTime(text))return null;
  if(financeType(text)&&parseAmount(text))return null;
  const part=daypartOf(text),date=parseDate(text),title=smartTitle(text);
  state.pending={kind:"reminder-time",title,date,daypart:part,source:text,leadMinutes:state.settings.reminderLead||30};
  return {text:`${prettyDate(date)} kamu punya agenda “${title}”. Jam berapa? Aku akan mengingatkan ${state.pending.leadMinutes} menit sebelumnya.`,actions:timeChoices(part)};
}
function resolvePending(text){
  const p=state.pending;if(!p)return null;
  const raw=String(text||"").trim();
  if(p.kind==="reminder-time"){
    if(/pilih jam lain/i.test(raw)){p.custom=true;return{text:"Boleh. Ketik jamnya, misalnya 18.30 atau pukul 7 malam.",actions:[]}}
    let time=parseTime(raw);
    if(!time&&/^\d{1,2}:\d{2}$/.test(raw))time=raw;
    if(!time&&/^\d{1,2}$/.test(raw))time=`${pad(+raw)}:00`;
    if(!time)return{text:"Aku belum menangkap jamnya. Pilih salah satu atau ketik misalnya 16.30.",actions:timeChoices(p.daypart)};
    time=normalizeTimeForDaypart(time,p.daypart);
    const id=uid();state.reminders.push({id,title:p.title,date:p.date,time,done:false,leadMinutes:p.leadMinutes,notified:false,sourceText:p.source});
    state.lastCreated={type:"reminder",ids:[id],at:Date.now()};state.pending=null;
    return{text:`Siap. “${p.title}” aku jadwalkan ${prettyDate(p.date)} pukul ${time}, dan kuingatkan ${p.leadMinutes} menit sebelumnya.`,actions:[]}
  }
  return null;
}
function correctRecent(text){
  const s=String(text).toLowerCase();
  if(!/\b(salah|maksudnya|seharusnya|koreksi|ralat)\b/.test(s)||!state.lastCreated||state.lastCreated.type!=="reminder")return null;
  const rows=state.reminders.filter(r=>state.lastCreated.ids.includes(r.id));if(!rows.length)return null;
  let changed=[];
  if(/\bhari ini\b/.test(s)){rows.forEach(r=>{r.date=localISO();r.notified=false});changed.push("tanggal menjadi hari ini")}
  else if(/\bbesok\b/.test(s)){rows.forEach(r=>{r.date=addDays(1);r.notified=false});changed.push("tanggal menjadi besok")}
  else if(/\blusa\b/.test(s)){rows.forEach(r=>{r.date=addDays(2);r.notified=false});changed.push("tanggal menjadi lusa")}
  const tm=parseTime(text);if(tm){rows.forEach(r=>{r.time=normalizeTimeForDaypart(tm,daypartOf(text));r.notified=false});changed.push("jam diperbarui")}
  if(!changed.length)return{text:"Boleh, bagian mana yang perlu dikoreksi—tanggal, jam, atau keterangannya?",actions:["Hari ini","Besok","Ubah jam"]};
  return{text:`Oke, aku koreksi agenda terakhir: ${changed.join(" dan ")}.`,actions:[]}
}
function smartResponse(text){
  const pending=resolvePending(text);if(pending)return pending;
  const corrected=correctRecent(text);if(corrected)return corrected;
  const clarification=clarificationFor(text);if(clarification)return clarification;
  const beforeReminderIds=new Set(state.reminders.map(r=>r.id)),beforeNoteIds=new Set(state.notes.map(n=>n.id));
  const lines=process(text);
  const newReminders=state.reminders.filter(r=>!beforeReminderIds.has(r.id));
  const newNotes=state.notes.filter(n=>!beforeNoteIds.has(n.id));
  if(newReminders.length)state.lastCreated={type:"reminder",ids:newReminders.map(r=>r.id),at:Date.now()};
  else if(newNotes.length)state.lastCreated={type:"note",ids:newNotes.map(n=>n.id),at:Date.now()};
  return{text:lines.join("\n"),actions:[]}
}

function process(text){
  const monthly=/bulan ini|target bulan/.test(text.toLowerCase());
  const paidBill=markPaidBillFromText(text);
  if(paidBill)return [`Sip, tagihan “${paidBill.title}” sudah lunas. ${rupiah(paidBill.amount)} juga sudah masuk ke pengeluaran.`];
  const completed=markHabitFromText(text);
  if(completed)return [`Bagus, “${completed.name}” sudah aku tandai selesai untuk hari ini.`];

  const results=[],contextDate=parseDate(text),hasFutureContext=/\b(besok|lusa|tanggal\s+\d+)\b/i.test(text);
  for(const clause of splitClauses(text)){
    const lower=clause.toLowerCase();
    if(/\b(besok|lusa|nanti)\b/.test(lower)&&!reminderIntent(clause)&&clause.trim().split(/\s+/).length<6){
      results.push("Besok kamu ingin aku ingatkan tentang apa? Tambahkan kegiatannya ya.");continue;
    }
    const ft=financeType(clause),amount=ft?parseAmount(clause):null;
    if(ft&&amount){
      const category=categoryFor(clause),date=parseDate(clause),title=cleanTitle(clause)||category;
      const futureBill=ft==="expense"&&/(bayar|tagihan)/i.test(clause)&&/(besok|lusa|tanggal)/i.test(clause)&&date!==localISO();
      if(futureBill){
        state.reminders.push({id:uid(),title:title||"Tagihan",date,time:parseTime(clause),done:false,kind:"bill",amount,category,leadMinutes:state.settings.reminderLead||30,notified:false});
        results.push(`Siap, tagihan “${title||"Tagihan"}” sebesar ${rupiah(amount)} aku ingatkan untuk ${fmtDate(date)}.`);
        continue;
      }
      state.transactions.push({id:uid(),type:ft,amount,category,title,date,createdAt:new Date().toISOString()});
      results.push(`Sudah, ${ft==="income"?"pemasukan":"pengeluaran"} ${rupiah(amount)} untuk ${categoryLabel(category)} aku catat.`);
      continue;
    }
    if(habitIntent(clause)){
      const spec=habitSpec(clause);addHabit(spec,monthly);
      results.push(`Oke, kebiasaan “${spec.name}” sudah masuk. ${spec.period==="weekly"?`Targetnya ${spec.target}× seminggu.`:"Kita pantau setiap hari."}`);
      continue;
    }
    if(reminderIntent(clause)){
      const ownDate=/\b(hari ini|tadi|barusan|besok|lusa|tanggal\s+\d+|20\d{2}-\d{1,2}-\d{1,2})\b/i.test(clause),date=!ownDate&&hasFutureContext?contextDate:parseDate(clause),time=parseTime(clause),title=smartTitle(clause);
      state.reminders.push({id:uid(),title,date,time,done:false,leadMinutes:state.settings.reminderLead||30,notified:false,sourceText:clause});
      results.push(`Siap, aku ingatkan “${title}” pada ${fmtDate(date)}${time?" pukul "+time:""}.`);
      continue;
    }
    if(noteIntent(clause)){
      const body=paraphraseNote(clause),title=body.replace(/[.!?]$/,"").slice(0,56);
      state.notes.push({id:uid(),title,body,sourceText:clause,date:localISO(),createdAt:new Date().toISOString()});
      results.push(`Sudah kurapikan dan kusimpan: “${body.slice(0,58)}${body.length>58?"…":""}”`);
      continue;
    }
    if(monthly&&clause.length>2){
      const title=cleanTitle(clause).replace(/\b(bulan ini|target|ingin|mau|harus)\b/gi," ").trim();
      if(title){state.goals.push({id:uid(),title,target:1,progress:0,kind:"manual",month:localISO().slice(0,7)});results.push(`✓ Target bulan ini: “${title}”`);continue}
    }
    state.notes.push({id:uid(),title:clause.slice(0,48),body:clause,date:localISO(),createdAt:new Date().toISOString()});
    results.push("Sudah, aku simpan sebagai catatan.");
  }
  return results;
}

function speak(text){if(!voiceSession)return;const clean=text.replace(/✓/g,"").replace(/Rp\s?/g,"rupiah ");try{if(window.NaraAndroid&&window.NaraAndroid.speak){window.NaraAndroid.speak(clean);return}}catch{}if("speechSynthesis"in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(clean);u.lang="id-ID";u.rate=.98;speechSynthesis.speak(u)}}
function syncChatSafeArea(){
  const composer=$("#chatForm"),nav=$(".bottomnav"),stream=$("#conversationScroll");
  if(!stream)return;
  const composerH=composer&&typeof composer.getBoundingClientRect==="function"?composer.getBoundingClientRect().height:64;
  const navH=typeof innerWidth!=="undefined"&&innerWidth<980&&nav&&typeof nav.getBoundingClientRect==="function"?nav.getBoundingClientRect().height:0;
  const safe=Math.ceil(composerH+navH+28);
  if(stream.style&&typeof stream.style.setProperty==="function")stream.style.setProperty("--chat-safe-bottom",safe+"px");
}
function scrollChatToBottom(smooth=false){
  const s=$("#conversationScroll");if(!s)return;
  syncChatSafeArea();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(typeof s.scrollTo==="function")s.scrollTo({top:s.scrollHeight,behavior:smooth?"smooth":"auto"});else s.scrollTop=s.scrollHeight;
  }));
}
function sendText(text){
  const t=text.trim();if(!t)return;
  msg("user",t);renderChat(true);scrollChatToBottom(true);
  setTimeout(()=>{const response=smartResponse(t),reply=response.text||"Coba ceritakan sedikit lebih lengkap ya.";msg("assistant",reply,"",response.actions||[]);save();speak(reply);renderChat(false);scrollChatToBottom(true)},voiceSession?420:180);
}
function renderChat(showTyping=false){
  const s=$("#chatStream");s.innerHTML=state.messages.map(m=>`<div class="bubble ${m.role}">${esc(m.text).replace(/\n/g,"<br>")}${m.result?`<span class="result">${esc(m.result)}</span>`:""}${m.actions&&m.actions.length?`<div class="chat-actions">${m.actions.map(a=>`<button type="button" data-chat-choice="${esc(a)}">${esc(a)}</button>`).join("")}</div>`:""}</div>`).join("")+(showTyping?`<div class="bubble assistant"><span class="typing"><i></i><i></i><i></i></span></div>`:"");
  syncChatSafeArea();
}
function txTotals(filter=()=>true){return state.transactions.filter(filter).reduce((a,t)=>{a[t.type]+=t.amount;return a},{income:0,expense:0})}
function renderToday(){
  const today=localISO(),agenda=[...state.reminders].filter(r=>!r.done).sort((a,b)=>(a.date+(a.time||"99:99")).localeCompare(b.date+(b.time||"99:99"))).slice(0,8),habits=state.habits;
  $("#agendaCount").textContent=agenda.length;$("#habitCount").textContent=habits.length;
  $("#focusText").textContent=(agenda[0]&&agenda[0].title)||(habits.length?"Jaga konsistensi habit hari ini.":"Belum ada agenda mendesak.");
  const d=new Date();$("#dateBadge").innerHTML=`<b>${d.getDate()}</b><br>${new Intl.DateTimeFormat("id-ID",{month:"short"}).format(d)}`;
  $("#todayAgenda").classList.toggle("empty",!agenda.length);
  $("#todayAgenda").innerHTML=agenda.length?agenda.map(r=>`<div class="row"><button class="rowicon reminder-done" data-id="${r.id}" aria-label="Tandai reminder selesai">○</button><div class="rowmain"><strong>${esc(r.title)}</strong><span>${r.time||"Tanpa jam"} · ${r.date===today?"Hari ini":fmtDate(r.date)}${r.amount?" · "+rupiah(r.amount):""} · ${r.leadMinutes||state.settings.reminderLead||30} mnt sebelumnya</span></div><button class="edit-action edit-reminder" data-id="${r.id}" aria-label="Edit pengingat"><svg><use href="#ico-edit"/></svg></button></div>`).join(""):"Belum ada agenda mendatang.";
  $("#todayHabits").classList.toggle("empty",!habits.length);
  $("#todayHabits").innerHTML=habits.length?habits.map(h=>{const done=h.doneDates.includes(today);return `<div class="row"><button class="rowicon habit-toggle" data-id="${h.id}" aria-label="Tandai kebiasaan">${done?"✓":"○"}</button><div class="rowmain"><strong>${esc(h.name)}</strong><span>${h.period==="weekly"?h.target+"× per minggu":"Setiap hari"}</span></div><span class="rowvalue">${done?"Selesai":""}</span></div>`}).join(""):"Belum ada kebiasaan yang kamu pantau.";
  const total=txTotals(t=>t.date===today);$("#todayIncome").textContent=rupiah(total.income);$("#todayExpense").textContent=rupiah(total.expense);$("#todayNet").textContent=rupiah(total.income-total.expense);
}
function row(icon,title,sub,value,klass=""){return `<div class="row"><div class="rowicon">${icon}</div><div class="rowmain"><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>${value?`<div class="rowvalue ${klass}">${esc(value)}</div>`:""}</div>`}
function renderFinance(){
  const total=txTotals(),month=localISO().slice(0,7),mt=txTotals(t=>t.date.startsWith(month));
  $("#balanceTotal").textContent=rupiah(total.income-total.expense);$("#monthIncome").textContent=rupiah(mt.income);$("#monthExpense").textContent=rupiah(mt.expense);$("#sideBalance").textContent=rupiah(total.income-total.expense);
  const recent=[...state.transactions].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).slice(0,12);
  $("#transactionList").classList.toggle("empty",!recent.length);$("#transactionList").innerHTML=recent.length?recent.map(t=>`<div class="row"><div class="rowicon">${t.type==="income"?"+":"−"}</div><div class="rowmain"><strong>${esc(t.title)}</strong><span>${esc(categoryLabel(t.category))} · ${fmtDate(t.date)}</span></div><div class="rowvalue ${t.type==="income"?"good":"bad"}">${t.type==="income"?"+":"−"} ${rupiah(t.amount)}</div><div class="row-actions"><button class="edit-action edit-tx" data-id="${t.id}" aria-label="Edit transaksi"><svg><use href="#ico-edit"/></svg></button><button class="rowaction delete-tx" data-id="${t.id}" aria-label="Hapus transaksi">×</button></div></div>`).join(""):"Belum ada transaksi.";
  const cats={};state.transactions.filter(t=>t.type==="expense"&&t.date.startsWith(month)).forEach(t=>cats[t.category]=(cats[t.category]||0)+t.amount);
  const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...entries.map(x=>x[1])),sum=entries.reduce((a,x)=>a+x[1],0);
  $("#categoryBreakdown").classList.toggle("empty",!entries.length);$("#categoryBreakdown").innerHTML=entries.length?entries.map(([k,v])=>`<div class="cat"><span>${esc(categoryLabel(k))}</span><b>${rupiah(v)}</b><div class="bar"><i style="width:${Math.round(v/max*100)}%"></i></div></div>`).join(""):"Belum ada data.";
  const palette=["#2563eb","#5b82eb","#8aa9f4","#b1c6f8","#d1ddfb","#9aa9c6"];
  let acc=0,segments=entries.slice(0,6).map(([k,v],i)=>{const from=sum?acc/sum*100:0;acc+=v;const to=sum?acc/sum*100:0;return `${palette[i]} ${from}% ${to}%`});
  $("#spendingDonut").style.background=segments.length?`conic-gradient(${segments.join(",")})`:"#e7ebf2";
  $("#donutTotal").textContent=rupiah(sum);
  $("#donutLegend").innerHTML=entries.length?entries.slice(0,6).map(([k,v],i)=>`<div class="donut-item"><i style="background:${palette[i]}"></i><span>${esc(categoryLabel(k))}</span><b>${sum?Math.round(v/sum*100):0}%</b></div>`).join(""):`<div class="empty">Belum ada pengeluaran.</div>`;
  const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const iso=localISO(d),tt=txTotals(t=>t.date===iso);days.push({d,iso,...tt})}
  const peak=Math.max(1,...days.flatMap(x=>[x.income,x.expense]));$("#cashflowTrend").textContent=rupiah(days.reduce((a,x)=>a+x.income-x.expense,0));
  $("#cashflowChart").innerHTML=days.map(x=>`<div class="cash-day"><div class="cash-bars"><i class="cash-bar income" style="height:${Math.max(2,x.income/peak*100)}%"></i><i class="cash-bar expense" style="height:${Math.max(2,x.expense/peak*100)}%"></i></div><small>${new Intl.DateTimeFormat("id-ID",{weekday:"short"}).format(x.d).slice(0,3)}</small></div>`).join("");
}
function renderNotes(){
  const q=(($("#noteSearch")&&$("#noteSearch").value)||"").toLowerCase(),notes=[...state.notes].filter(n=>(n.title+" "+n.body).toLowerCase().includes(q)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $("#notesGrid").innerHTML=notes.length?notes.map(n=>`<article class="note"><div class="note-actions"><button class="edit-action edit-note" data-id="${n.id}" aria-label="Edit catatan"><svg><use href="#ico-edit"/></svg></button><button class="cardaction delete-note" data-id="${n.id}" aria-label="Hapus catatan">×</button></div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notemeta">${fmtDate(n.date)}</div></article>`).join(""):`<div class="empty">Belum ada note.</div>`;
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
    return `<div class="habit"><div class="habithead"><strong>${esc(h.name)}</strong><span><small>${count}/${target}</small><button class="edit-action edit-habit" data-id="${h.id}" aria-label="Edit kebiasaan"><svg><use href="#ico-edit"/></svg></button><button class="rowaction delete-habit" data-id="${h.id}" aria-label="Hapus kebiasaan">×</button></span></div><div class="weekdots">${dots}</div></div>`
  }).join(""):"Tambahkan kebiasaan lewat obrolan atau tombol + Kebiasaan.";
}
function renderSummary(){
  $("#sideTasks").textContent=state.reminders.filter(r=>!r.done).length;$("#sideHabits").textContent=state.habits.length;$("#sideNotes").textContent=state.notes.length;
}
function renderProfile(){
  const full=(state.profile&&state.profile.name)||"",name=firstName(),initial=(name[0]||"N").toUpperCase();
  if($("#profileName"))$("#profileName").textContent=full||"Kamu";
  if($("#profileAvatar"))$("#profileAvatar").textContent=initial;
  if($("#welcomeTitle"))$("#welcomeTitle").textContent=name?`${greeting()}, ${name}.`:"Hai. Ada yang ingin kamu ceritakan?";
  if($("#todayHeading"))$("#todayHeading").textContent=name?`Hari ini, ${name}`:"Hari ini";
  if($("#profilePromptForm"))$("#profilePromptForm").hidden=!!full;
  if($("#profilePromptName")&&!full)$("#profilePromptName").value="";
}
function renderAccount(){
  const name=(state.profile&&state.profile.name)||"Kamu",initial=(name.trim()[0]||"N").toUpperCase();
  if($("#accountDisplayName"))$("#accountDisplayName").textContent=name;
  if($("#accountAvatar"))$("#accountAvatar").textContent=initial;
  if($("#accountName"))$("#accountName").value=name==="Kamu"?"":name;
  if($("#topAvatar"))$("#topAvatar").textContent=initial;
  if($("#backupTxCount"))$("#backupTxCount").textContent=state.transactions.length;
  if($("#backupNoteCount"))$("#backupNoteCount").textContent=state.notes.length;
  if($("#backupReminderCount"))$("#backupReminderCount").textContent=state.reminders.length;
  if($("#backupHabitCount"))$("#backupHabitCount").textContent=state.habits.length;
}
function renderAll(){renderChat();renderToday();renderFinance();renderNotes();renderGoals();renderSummary();renderProfile();renderAccount();renderSettings()}

function go(page){
  $$(".page").forEach(x=>x.classList.toggle("active",x.id===`page-${page}`));$$(".navbtn[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  const pageNames={chat:"NARA",today:"Hari ini",finance:"Keuangan",notes:"Catatan",goals:"Target",account:"Akun"};$("#pageTitle").textContent=pageNames[page]||"NARA";
  const main=$(".main");if(main&&innerWidth>=980)main.scrollTo({top:0,behavior:"smooth"});else window.scrollTo({top:0,behavior:"smooth"});
}
function openQuick(type){
  if(type)$("#quickType").value=type;
  $("#quickDate").value=localISO();syncQuick();$("#quickDialog").showModal();setTimeout(()=>$("#quickTitle").focus(),60);
}
function syncQuick(){
  const t=$("#quickType").value,finance=["expense","income"].includes(t),rem=t==="reminder",habit=t==="habit";
  $("#amountWrap").classList.toggle("hidden",!finance);$("#dateWrap").classList.toggle("hidden",!(finance||rem));$("#timeWrap").classList.toggle("hidden",!rem);$("#reminderLeadWrap").classList.toggle("hidden",!rem);$("#freqWrap").classList.toggle("hidden",!habit);
}
function quickSubmit(e){
  e.preventDefault();const type=$("#quickType").value,title=$("#quickTitle").value.trim();if(!title)return;
  if(["expense","income"].includes(type)){const amount=Number($("#quickAmount").value.replace(/\D/g,""));if(!amount)return alert("Masukkan nominal.");state.transactions.push({id:uid(),type,amount,category:categoryFor(title),title,date:$("#quickDate").value||localISO(),createdAt:new Date().toISOString()})}
  if(type==="reminder")state.reminders.push({id:uid(),title,date:$("#quickDate").value||localISO(),time:$("#quickTime").value,done:false,leadMinutes:Number($("#quickReminderLead").value)||state.settings.reminderLead||30,notified:false});
  if(type==="note")state.notes.push({id:uid(),title:title.slice(0,48),body:title,date:localISO(),createdAt:new Date().toISOString()});
  if(type==="habit"){const f=$("#quickFrequency").value,spec={name:title,period:f==="daily"?"daily":"weekly",target:f==="3-week"?3:1};addHabit(spec,true)}
  $("#quickForm").reset();$("#quickDate").value=localISO();$("#quickDialog").close();save();
}



let editContext=null,lastReminderCheck=0;
function openEditor(kind,id){
  let item=null;
  if(kind==="note")item=state.notes.find(x=>x.id===id);
  if(kind==="tx")item=state.transactions.find(x=>x.id===id);
  if(kind==="reminder")item=state.reminders.find(x=>x.id===id);
  if(kind==="habit")item=state.habits.find(x=>x.id===id);
  if(!item)return;editContext={kind,id};
  $("#editKind").value=kind;$("#editId").value=id;$("#editTitle").value=item.title||item.name||"";$("#editBody").value=item.body||"";
  $("#editAmount").value=item.amount||"";$("#editDate").value=item.date||localISO();$("#editTime").value=item.time||"";$("#editLead").value=String(item.leadMinutes||state.settings.reminderLead||30);
  $("#editBodyWrap").classList.toggle("hidden",kind!=="note");$("#editAmountWrap").classList.toggle("hidden",kind!=="tx");$("#editDateWrap").classList.toggle("hidden",!["tx","reminder"].includes(kind));$("#editTimeWrap").classList.toggle("hidden",kind!=="reminder");$("#editLeadWrap").classList.toggle("hidden",kind!=="reminder");
  $("#editHeading").textContent={note:"Edit catatan",tx:"Edit transaksi",reminder:"Edit pengingat",habit:"Edit kebiasaan"}[kind];$("#editDialog").showModal();
}
function saveEditor(e){e.preventDefault();if(!editContext)return;const {kind,id}=editContext,title=$("#editTitle").value.trim();if(!title)return;
  if(kind==="note"){const x=state.notes.find(x=>x.id===id);if(x){x.title=title;x.body=$("#editBody").value.trim()||title}}
  if(kind==="tx"){const x=state.transactions.find(x=>x.id===id);if(x){x.title=title;x.amount=Number($("#editAmount").value.replace(/\D/g,""))||x.amount;x.date=$("#editDate").value||x.date;x.category=categoryFor(title)}}
  if(kind==="reminder"){const x=state.reminders.find(x=>x.id===id);if(x){x.title=title;x.date=$("#editDate").value||x.date;x.time=$("#editTime").value;x.leadMinutes=Number($("#editLead").value)||30;x.notified=false}}
  if(kind==="habit"){const x=state.habits.find(x=>x.id===id);if(x){const old=x.name;x.name=title;state.goals.filter(g=>g.habitName===old).forEach(g=>{g.habitName=title;g.title=title})}}
  $("#editDialog").close();editContext=null;save();
}
function restoreBackupFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result),data=parsed.data||parsed;if(!data||!Array.isArray(data.notes)||!Array.isArray(data.transactions))throw new Error("Format tidak cocok");if(!confirm("Pulihkan backup ini? Data NARA saat ini akan diganti."))return;localStorage.setItem(KEY,JSON.stringify(data));location.reload()}catch(e){alert("File backup tidak valid.")}};reader.readAsText(file)}
function resetAllData(){if(!confirm("Reset semua data NARA di perangkat ini?"))return;if(!confirm("Yakin? Catatan, transaksi, pengingat, dan target akan dihapus."))return;localStorage.removeItem(KEY);location.reload()}
function showReminder(r,minutes){$("#reminderToastTitle").textContent=r.title;$("#reminderToastTime").textContent=minutes<=1?"Agenda segera dimulai":`${minutes} menit lagi · ${r.time||""}`;$("#reminderToast").hidden=false;
  if("Notification"in window&&Notification.permission==="granted"){try{new Notification("NARA · Pengingat",{body:`${r.title} — ${minutes} menit lagi`})}catch(e){}}
}
function checkReminders(){
  const now=Date.now();if(now-lastReminderCheck<30000)return;lastReminderCheck=now;
  state.reminders.filter(r=>!r.done&&r.date&&r.time&&!r.notified).forEach(r=>{const when=new Date(`${r.date}T${r.time}:00`).getTime(),lead=(r.leadMinutes||state.settings.reminderLead||30),diff=Math.ceil((when-now)/60000);if(diff<=lead&&diff>=0){r.notified=true;showReminder(r,diff);try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}});
}
function requestNotifications(){if(!("Notification"in window)){$("#notificationStatus").textContent="Browser ini belum mendukung notifikasi.";return}Notification.requestPermission().then(p=>{$("#notificationStatus").textContent=p==="granted"?"Notifikasi browser sudah aktif.":"Izin notifikasi belum diberikan.";})}
function renderSettings(){if($("#defaultReminderLead"))$("#defaultReminderLead").value=String(state.settings.reminderLead||30)}

function downloadBackup(){
  const payload={app:"NARA",version:"5.0",exportedAt:new Date().toISOString(),data:state};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="NARA-backup-"+localISO()+".json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  if($("#accountSaveStatus"))$("#accountSaveStatus").textContent="Backup berhasil disiapkan.";
}
function updateAccountName(name){
  const clean=String(name||"").trim();if(!clean)return;
  state.profile={...(state.profile||{}),name:clean};
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
  renderAll();
  if($("#accountSaveStatus")){$("#accountSaveStatus").textContent="Nama sudah diperbarui.";setTimeout(()=>{$("#accountSaveStatus").textContent="Perubahan tersimpan di perangkat ini."},1800)}
}

function setVoiceUI(active,transcript=""){if($("#voiceMode"))$("#voiceMode").hidden=!active;if($("#voiceModeTranscript")&&transcript)$("#voiceModeTranscript").textContent=transcript;if($("#micButton"))$("#micButton").classList.toggle("active",active);if($("#listeningPanel"))$("#listeningPanel").hidden=!active;if($("#voiceStatus")){$("#voiceStatus").classList.toggle("listening",active);$("#voiceStatus span").textContent=active?"Mendengarkan…":"Suara siap"}if(transcript&&$("#voiceTranscript"))$("#voiceTranscript").textContent=transcript}
function webSpeechStart(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return false;if(!recognition){recognition=new SR();recognition.lang="id-ID";recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;recognition.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const txt=e.results[i][0].transcript;if(e.results[i].isFinal)voiceFinal+=txt;else interim+=txt}const shown=(voiceFinal||interim).trim();setVoiceUI(true,shown||"Silakan bicara…");$("#chatInput").value=shown};recognition.onerror=e=>{setVoiceUI(false);voiceSession=false;if($("#voiceTranscript"))$("#voiceTranscript").textContent=e.error==="not-allowed"?"Izin mikrofon diperlukan.":"Fitur suara tidak tersedia."};recognition.onend=()=>{setVoiceUI(false);const txt=voiceFinal.trim();voiceFinal="";if(txt){voiceSession=true;sendText(txt);$("#chatInput").value=""}else voiceSession=false}}try{voiceFinal="";voiceSession=true;recognition.start();setVoiceUI(true);return true}catch{return false}}
function startVoice(){try{if(window.NaraAndroid&&window.NaraAndroid.startVoiceInput){voiceSession=true;setVoiceUI(true);window.NaraAndroid.startVoiceInput();return}}catch{}if(!webSpeechStart()){setVoiceUI(false);voiceSession=false;msg("assistant","Maaf, fitur suara belum didukung di browser ini. Kamu tetap bisa mengetik seperti biasa.");save()}}
function stopVoice(){try{if(recognition)recognition.stop()}catch{}setVoiceUI(false)}
window.NaraVoiceResult=function(text){setVoiceUI(false);if(text){voiceSession=true;sendText(String(text));$("#chatInput").value=""}else voiceSession=false};
window.NaraVoiceError=function(message){setVoiceUI(false);voiceSession=false;msg("assistant",message||"Maaf, fitur suara sedang tidak tersedia.");save()};
function boot(){
  window.__NARA_BOOTED__=true;
  const splash=$("#splash");
  setTimeout(()=>{
    if(splash){splash.classList.add("hide");splash.style.pointerEvents="none"}
    setTimeout(()=>{if(splash&&splash.parentNode)splash.parentNode.removeChild(splash)},450)
  },850)
}

document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-page]");if(nav)go(nav.dataset.page);const en=e.target.closest(".edit-note");if(en)openEditor("note",en.dataset.id);const et=e.target.closest(".edit-tx");if(et)openEditor("tx",et.dataset.id);const er=e.target.closest(".edit-reminder");if(er)openEditor("reminder",er.dataset.id);const eh=e.target.closest(".edit-habit");if(eh)openEditor("habit",eh.dataset.id);
  const chip=e.target.closest("[data-prompt]");if(chip){$("#chatInput").value=chip.dataset.prompt;$("#chatInput").focus()}const choice=e.target.closest("[data-chat-choice]");if(choice)sendText(choice.dataset.chatChoice);
  const act=e.target.closest("[data-action]");if(act){const map={quick:"expense",transaction:"expense",note:"note",habit:"habit"};openQuick(map[act.dataset.action])}
  const ht=e.target.closest(".habit-toggle");if(ht){const h=state.habits.find(x=>x.id===ht.dataset.id),d=localISO();if(h){h.doneDates=h.doneDates.includes(d)?h.doneDates.filter(x=>x!==d):[...h.doneDates,d];save()}}
  const done=e.target.closest(".reminder-done");if(done){const r=state.reminders.find(x=>x.id===done.dataset.id);if(r){r.done=true;save()}}
  const delTx=e.target.closest(".delete-tx");if(delTx){state.transactions=state.transactions.filter(x=>x.id!==delTx.dataset.id);save()}
  const delNote=e.target.closest(".delete-note");if(delNote){state.notes=state.notes.filter(x=>x.id!==delNote.dataset.id);save()}
  const delHabit=e.target.closest(".delete-habit");if(delHabit){const h=state.habits.find(x=>x.id===delHabit.dataset.id);if(h){state.habits=state.habits.filter(x=>x.id!==h.id);state.goals=state.goals.filter(g=>g.habitName!==h.name);save()}}
  const dot=e.target.closest(".daydot");if(dot){const h=state.habits.find(x=>x.id===dot.dataset.habit),d=dot.dataset.date;if(h){h.doneDates=h.doneDates.includes(d)?h.doneDates.filter(x=>x!==d):[...h.doneDates,d];save()}}
});
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const i=$("#chatInput");voiceSession=false;sendText(i.value);i.value="";i.style.height="auto"});
$("#chatInput").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,112)+"px";syncChatSafeArea();scrollChatToBottom(false)});
$("#chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#chatForm").requestSubmit()}});
$("#quickAdd").addEventListener("click",()=>openQuick());
$("#closeDialog").addEventListener("click",()=>$("#quickDialog").close());
$("#quickType").addEventListener("change",syncQuick);$("#quickForm").addEventListener("submit",quickSubmit);$("#noteSearch").addEventListener("input",renderNotes);$("#micButton").addEventListener("click",startVoice);$("#tryVoice").addEventListener("click",startVoice);$("#voiceStatus").addEventListener("click",startVoice);$("#stopVoice").addEventListener("click",stopVoice);$("#accountNameForm").addEventListener("submit",e=>{e.preventDefault();updateAccountName($("#accountName").value)});
$("#downloadBackup").addEventListener("click",downloadBackup);$("#restoreBackup").addEventListener("change",e=>restoreBackupFile(e.target.files[0]));$("#resetNara").addEventListener("click",resetAllData);$("#defaultReminderLead").addEventListener("change",e=>{state.settings.reminderLead=Number(e.target.value)||30;save()});$("#enableNotifications").addEventListener("click",requestNotifications);$("#editForm").addEventListener("submit",saveEditor);$("#closeEditDialog").addEventListener("click",()=>$("#editDialog").close());$("#closeVoiceMode").addEventListener("click",stopVoice);$("#voiceCancel").addEventListener("click",stopVoice);$("#voiceDone").addEventListener("click",stopVoice);$("#dismissReminderToast").addEventListener("click",()=>$("#reminderToast").hidden=true);
$("#profilePromptForm").addEventListener("submit",e=>{e.preventDefault();const n=$("#profilePromptName").value.trim();if(n)updateAccountName(n)});
$("#profilePromptSkip").addEventListener("click",()=>{$("#profilePromptForm").hidden=true});
const dn=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long"}).format(new Date());$("#dateLabel").textContent=dn;
$("#quickDate").value=localISO();renderAll();
window.addEventListener("load",()=>{
  if("serviceWorker"in navigator)navigator.serviceWorker.getRegistrations().then(list=>list.forEach(reg=>reg.unregister())).catch(()=>{});
  if("caches"in window)caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))).catch(()=>{});
});