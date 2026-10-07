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
let recognition=null,voiceSession=false,voiceFinal="",voiceDraft="",voiceSubmitRequested=false;

function fresh(){
  return {profile:{name:""},settings:{reminderLead:30,agendaRange:"today"},pending:null,lastCreated:null,messages:[{id:uid(),role:"assistant",text:"Hai. Cerita saja seperti biasa. Misalnya: “makan 25 ribu”, “besok jam 10 rapat”, atau “bulan ini olahraga 3 kali seminggu”.",at:new Date().toISOString()}],transactions:[],liabilities:[],receivables:[],reminders:[],notes:[],habits:[],goals:[]};
}
function load(){try{const base=fresh(),saved=JSON.parse(localStorage.getItem(KEY)||"{}")||{};return {...base,...saved,profile:{...base.profile,...(saved.profile||{})},settings:{...base.settings,...(saved.settings||{})},liabilities:Array.isArray(saved.liabilities)?saved.liabilities:[],receivables:Array.isArray(saved.receivables)?saved.receivables:[]}}catch{return fresh()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderAll()}
function msg(role,text,result="",actions=[]){state.messages.push({id:uid(),role,text,result,actions:Array.isArray(actions)?actions:[],at:new Date().toISOString()})}
function firstName(){return ((state.profile&&state.profile.name)||"").trim().split(/\s+/)[0]||""}
function greeting(){const h=new Date().getHours();return h<11?"Selamat pagi":h<15?"Selamat siang":h<19?"Selamat sore":"Selamat malam"}

function parseAmount(t){
  let s=timeWordToNumber(t).replace(/rp\.?\s?/g,"").replace(/(\d)\.(?=\d{3}\b)/g,"$1").replace(/(\d),(?=\d{3}\b)/g,"$1");
  s=s
    .replace(/\b(?:(?:jam|pukul)\s+)?setengah\s+\d{1,2}\s*(?:pagi|siang|sore|malam)?\b/g," ")
    .replace(/\b(?:jam|pukul)\s*\d{1,2}(?:[.:]\d{2})?\s*(?:wib|wita|wit)?\s*(?:pagi|siang|sore|malam)?\b/g," ")
    .replace(/\b\d{1,2}[.:]\d{2}\s*(?:wib|wita|wit)?\s*(?:pagi|siang|sore|malam)?\b/g," ");
  const m=s.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)\b/i)||s.match(/(?:sebesar|senilai|pengeluaran|pemasukan|bayar|beli|makan|bensin|transfer|dapat|terima)\D{0,16}(\d[\d.]*)/i);
  if(!m)return null;
  let n=Number(String(m[1]).replace(/\./g,"").replace(",","."));
  const unit=(m[2]||"").toLowerCase();
  if(unit==="juta"||unit==="jt")n*=1e6;
  if(["ribu","rb","k"].includes(unit))n*=1e3;
  return Number.isFinite(n)?Math.round(n):null;
}
function timeWordToNumber(s){
  const words={satu:1,dua:2,tiga:3,empat:4,lima:5,enam:6,tujuh:7,delapan:8,sembilan:9,sepuluh:10,sebelas:11,"dua belas":12};
  let out=String(s||"").toLowerCase();
  Object.entries(words).sort((a,b)=>b[0].length-a[0].length).forEach(([w,n])=>{out=out.replace(new RegExp("\\b"+w+"\\b","g"),String(n))});
  return out;
}
function normalizeClock(hour,minute,part){
  let h=Number(hour),m=Number(minute||0);part=part||"";
  if(part==="malam"){
    if(h===12)h=0;else if(h<12)h+=12;
  }else if(part==="sore"){
    if(h<12)h+=12;
  }else if(part==="siang"){
    if(h>=1&&h<=6)h+=12;
  }else if(part==="pagi"){
    if(h===12)h=0;
  }
  return `${pad(Math.max(0,Math.min(23,h)))}:${pad(Math.max(0,Math.min(59,m)))}`;
}
function parseTime(t){
  let s=timeWordToNumber(t);
  const part=(s.match(/\b(pagi|siang|sore|malam)\b/)||[])[1]||"";
  let m=s.match(/(?:(?:jam|pukul)\s+)?setengah\s+(\d{1,2})/);
  if(m){
    let target=Number(m[1]),hour=(target+23)%24;
    return normalizeClock(hour,30,part);
  }
  m=s.match(/(?:jam|pukul)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(?:wib|wita|wit)?\s*(pagi|siang|sore|malam)?/);
  if(m)return normalizeClock(m[1],m[2]||0,m[3]||part);
  m=s.match(/\b(\d{1,2})[.:](\d{2})\s*(?:wib|wita|wit)?\s*(pagi|siang|sore|malam)?\b/);
  if(m)return normalizeClock(m[1],m[2],m[3]||part);
  m=s.match(/\b(\d{1,2})\s*(pagi|siang|sore|malam)\b/);
  if(m)return normalizeClock(m[1],0,m[2]);
  return "";
}
function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return localISO(d)}
function nextWeekdayDate(name,forceNext=false){
  const days={minggu:0,senin:1,selasa:2,rabu:3,kamis:4,jumat:5,"jum'at":5,sabtu:6},target=days[name],now=new Date(),today=now.getDay();
  let delta=(target-today+7)%7;
  if(delta===0||forceNext&&delta===0)delta=7;
  const d=new Date(now);d.setDate(now.getDate()+delta);return localISO(d);
}
function parseDate(t){
  const s=t.toLowerCase();
  if(/\bhari ini\b|\btadi\b|\bbarusan\b/.test(s))return localISO();
  if(/\blusa\b/.test(s))return addDays(2);
  if(/\bbesok\b/.test(s))return addDays(1);
  const weekAhead=s.match(/\b(?:minggu|pekan)\s+depan(?:\s+hari)?\s+(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)\b/);
  if(weekAhead){const names={minggu:0,senin:1,selasa:2,rabu:3,kamis:4,jumat:5,"jum'at":5,sabtu:6},now=new Date(),today=now.getDay(),target=names[weekAhead[1]],toThis=(target-today+7)%7||7,delta=toThis+7;const d=new Date(now);d.setDate(now.getDate()+delta);return localISO(d)}
  const wd=s.match(/\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)(?:\s+depan)?\b/);
  if(wd)return nextWeekdayDate(wd[1],/\sdepan\b/.test(wd[0]));
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
    .replace(/\b(?:jam|pukul)\s*(?:setengah\s+)?(?:\d{1,2}|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)(?:[.:]\d{2})?\s*(?:wib|wita|wit)?\s*(?:pagi|siang|sore|malam)?\b/gi," ")
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
function debtIntent(t){
  const s=String(t).toLowerCase();
  if(/\b(piutang|meminjamkan|pinjemin|pinjamin)\b/.test(s))return"receivable";
  if(/\b(berhutang|berutang|hutang|utang|pinjam uang|pinjem uang)\b/.test(s))return"liability";
  return null;
}
function counterpartyFromText(t){
  const m=String(t).match(/(?:dari|ke|kepada|sama)\s+([A-Za-z][A-Za-z .'-]{1,28})/i);
  return m?sentenceCase(m[1].trim().replace(/\b(sebesar|senilai|rp|ribu|rb|juta|jt)\b.*$/i,"").trim()):"";
}
function accountingCashImpact(t){return typeof t.cashImpact==="number"?t.cashImpact:(t.type==="income"?t.amount:t.type==="expense"?-t.amount:0)}
function cashBalance(filter=()=>true){return state.transactions.filter(filter).reduce((a,t)=>a+accountingCashImpact(t),0)}
function openLiabilityTotal(){return state.liabilities.filter(x=>!x.done).reduce((a,x)=>a+(x.remaining??x.amount),0)}
function openReceivableTotal(){return state.receivables.filter(x=>!x.done).reduce((a,x)=>a+(x.remaining??x.amount),0)}
function createLiability(source,amount,kind="cash-loan"){
  const creditor=counterpartyFromText(source),title=creditor?`Hutang kepada ${creditor}`:"Hutang",id=uid();
  const debt={id,title,creditor,amount,remaining:amount,kind,date:parseDate(source),done:false,sourceText:source,createdAt:new Date().toISOString()};
  state.liabilities.push(debt);
  if(kind==="cash-loan")state.transactions.push({id:uid(),type:"financing_in",amount,title:`Pinjaman diterima${creditor?" dari "+creditor:""}`,category:"Debt",date:debt.date,cashImpact:amount,createdAt:new Date().toISOString(),linkedDebtId:id});
  if(kind==="credit-purchase")state.transactions.push({id:uid(),type:"expense",amount,title:smartFinanceTitle(source,"Pembelian secara hutang"),category:categoryFor(source),date:debt.date,cashImpact:0,createdAt:new Date().toISOString(),linkedDebtId:id});
  return debt;
}
function createReceivable(source,amount){
  const debtor=counterpartyFromText(source),title=debtor?`Piutang kepada ${debtor}`:"Piutang",id=uid(),date=parseDate(source);
  const item={id,title,debtor,amount,remaining:amount,date,done:false,sourceText:source,createdAt:new Date().toISOString()};
  state.receivables.push(item);
  state.transactions.push({id:uid(),type:"financing_out",amount,title:`Uang dipinjamkan${debtor?" kepada "+debtor:""}`,category:"Receivable",date,cashImpact:-amount,createdAt:new Date().toISOString(),linkedReceivableId:id});
  return item;
}
function payLiabilityFromText(text){
  const s=String(text).toLowerCase();if(!/\b(bayar|melunasi|lunas)\b.*\b(hutang|utang)\b|\b(hutang|utang)\b.*\b(bayar|lunas)\b/.test(s))return null;
  const amount=parseAmount(text),open=state.liabilities.filter(x=>!x.done);if(!open.length)return null;
  const creditor=counterpartyFromText(text).toLowerCase(),item=(creditor&&open.find(x=>(x.creditor||"").toLowerCase().includes(creditor)))||open[0];
  const paid=Math.min(amount||item.remaining||item.amount,item.remaining||item.amount);item.remaining=Math.max(0,(item.remaining??item.amount)-paid);if(item.remaining===0){item.done=true;item.paidAt=new Date().toISOString()}
  state.transactions.push({id:uid(),type:"debt_payment",amount:paid,title:`Pembayaran ${item.title}`,category:"Debt",date:localISO(),cashImpact:-paid,createdAt:new Date().toISOString(),linkedDebtId:item.id});
  return {item,paid};
}
function receiveReceivableFromText(text){
  const s=String(text).toLowerCase();if(!/\b(bayar|dibayar|mengembalikan|balikin|lunas)\b/.test(s)||!state.receivables.some(x=>!x.done))return null;
  const debtor=counterpartyFromText(text).toLowerCase(),open=state.receivables.filter(x=>!x.done),item=(debtor&&open.find(x=>(x.debtor||"").toLowerCase().includes(debtor)))||null;
  if(!item)return null;
  const amount=parseAmount(text),received=Math.min(amount||item.remaining||item.amount,item.remaining||item.amount);item.remaining=Math.max(0,(item.remaining??item.amount)-received);if(item.remaining===0){item.done=true;item.paidAt=new Date().toISOString()}
  state.transactions.push({id:uid(),type:"receivable_payment",amount:received,title:`Pembayaran ${item.title}`,category:"Receivable",date:localISO(),cashImpact:received,createdAt:new Date().toISOString(),linkedReceivableId:item.id});
  return {item,received};
}
function smartFinanceTitle(text,fallback="Transaksi"){
  let s=String(text).replace(/\b(aku|saya|tadi|hari ini|sebesar|senilai|rp)\b/gi," ").replace(/\b\d+(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt)?\b/gi," ").replace(/\s+/g," ").trim();
  return sentenceCase(s||fallback);
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
    .replace(/\b(hari ini|besok|lusa|nanti|senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)(?:\s+depan)?\b/gi," ").replace(/\b(pagi|siang|sore|malam)\b/gi," ")
    .replace(/\b(?:(?:jam|pukul)\s+)?setengah\s+(?:\d{1,2}|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s*(?:pagi|siang|sore|malam)?\b/gi," ")
    .replace(/\b(?:jam|pukul)\s*(?:\d{1,2}|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)(?:[.:]\d{2})?\s*(?:wib|wita|wit)?\s*(?:pagi|siang|sore|malam)?\b/gi," ")
    .replace(/\b\d{1,2}(?:[.:]\d{2})?\s*(?:pagi|siang|sore|malam)\b/gi," ")
    .replace(/\s+/g," ").replace(/^[,.:;\-\s]+|[,.:;\-\s]+$/g,"").trim();
  s=s.replace(/^(kemudian|terus|habis itu|lalu)\s+/i,"").replace(/\bnemuin\b/gi,"temui").replace(/\bnemui\b/gi,"temui").replace(/\bketemu\b/gi,"bertemu dengan").replace(/\bphoto\b/gi,"Foto");
  if(/^ke\s+/i.test(s))s="Pergi "+s;
  s=s.replace(/\bke\s+([a-z])/g,(m,c)=>"ke "+c.toUpperCase()).replace(/\bmas\s+([a-z])/g,(m,c)=>"Mas "+c.toUpperCase());
  s=s.replace(/\buntuk\s+(?=review|membahas|meeting|rapat|foto|loading|pemasangan)/gi,"untuk ");
  return sentenceCase(naturalizeText(s)||"Agenda");
}
function naturalizeText(text){
  return String(text||"")
    .replace(/\baku tuh\b|\bsaya tuh\b/gi,"")
    .replace(/\baku pengen\b|\baku pingin\b|\bsaya pengen\b|\bpengen\b|\bpingin\b/gi,"ingin")
    .replace(/\bselesaiin\b/gi,"selesaikan")
    .replace(/\bbikin\b/gi,"buat")
    .replace(/\bngurus\b/gi,"mengurus")
    .replace(/\bnggak\b|\bgak\b|\bga\b/gi,"tidak")
    .replace(/\bnemuin\b|\bnemui\b/gi,"temui")
    .replace(/\bketemuan\b/gi,"bertemu")
    .replace(/\bphoto\b/gi,"foto")
    .replace(/\s+/g," ").trim();
}
function paraphraseNote(text){
  let s=naturalizeText(text).trim()
    .replace(/^.*?(?:tolong\s+)?(?:catat(?:kan)?|note|ide)\s*:?[\s-]*/i,"")
    .replace(/\bjangan lupa bahwa\b/gi,"")
    .replace(/\baku\s+(?:harus|mau|akan|ingin)\b/gi,"")
    .replace(/\bsaya\s+(?:harus|mau|akan|ingin)\b/gi,"")
    .replace(/\bnemuin\b/gi,"temui").replace(/\bnemui\b/gi,"temui")
    .replace(/\bketemu(?:an)?\s+(?:sama|dengan)?\s*/gi,"bertemu dengan ")
    .replace(/\s+/g," ").trim();
  s=s.replace(/^(kemudian|terus|habis itu|lalu)\s+/i,"").replace(/\bmas\s+([a-z])/g,(m,c)=>"Mas "+c.toUpperCase()).replace(/\bpak\s+([a-z])/g,(m,c)=>"Pak "+c.toUpperCase()).replace(/\bphoto\b/gi,"Foto");
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
  const raw=String(text||"").trim(),low=raw.toLowerCase();

  if(p.kind==="debt-kind"){
    if(/pinjaman masuk kas|masuk kas|terima uang/.test(low)){const d=createLiability(p.source,p.amount,"cash-loan");state.pending=null;return{text:`Siap. ${d.title} ${rupiah(d.amount)} dicatat sebagai kewajiban. Kas bertambah, tetapi tidak dihitung sebagai pendapatan.`,actions:[]}}
    if(/hutang pembelian|beli|pembelian/.test(low)){const d=createLiability(p.source,p.amount,"credit-purchase");state.pending=null;return{text:`Siap. ${d.title} ${rupiah(d.amount)} dicatat sebagai kewajiban dan pembelian dicatat sebagai beban tanpa mengurangi kas saat ini.`,actions:[]}}
    return{text:"Pilih jenis hutangnya dulu ya.",actions:["Pinjaman masuk kas","Hutang pembelian"]}
  }

  if(p.kind==="intent-choice"){
    if(/jadikan catatan|catatan|note/.test(low)){const source=p.source;state.pending=null;return saveExplicitNote(source)}
    if(/buat agenda|agenda|jadwal|ingatkan/.test(low)){const source=p.source;state.pending=null;return beginAgendaClarification(source)||{text:"Kapan agendanya?",actions:agendaDateChoices()}}
    if(/jadikan target|buat target|target/.test(low)){const source=p.source;state.pending=null;const g=addTargetFromText("Target bulan ini "+source);return{text:`Oke, aku jadikan target bulan ini: “${g.title}”.`,actions:[]}}
    if(/tidak perlu|ga perlu|gak perlu|nggak perlu|jangan simpan/.test(low)){state.pending=null;return{text:"Oke, tidak aku simpan.",actions:[]}}
    return{text:"Pilih salah satu ya: catatan, agenda, target, atau tidak perlu disimpan.",actions:["Jadikan catatan","Buat agenda","Jadikan target","Tidak perlu disimpan"]}
  }

  if(p.kind==="agenda-date"){
    let date="";
    if(/hari ini/.test(low))date=localISO();
    else if(/besok/.test(low))date=addDays(1);
    else if(/lusa/.test(low))date=addDays(2);
    else if(/pilih tanggal lain/.test(low)){return{text:"Ketik tanggalnya, misalnya “tanggal 12 Oktober”.",actions:[]}}
    else if(/tanggal\s+\d+|20\d{2}-\d{1,2}-\d{1,2}/.test(low))date=parseDate(raw);
    if(!date)return{text:"Kapan agendanya?",actions:agendaDateChoices()};
    if(p.time){
      const id=uid();state.reminders.push({id,title:p.title,date,time:normalizeTimeForDaypart(p.time,p.daypart),done:false,leadMinutes:p.leadMinutes,notified:false,sourceText:p.source});
      state.lastCreated={type:"reminder",ids:[id],at:Date.now()};state.pending=null;
      return{text:`Siap. “${p.title}” aku jadwalkan ${prettyDate(date)} pukul ${normalizeTimeForDaypart(p.time,p.daypart)}, dan kuingatkan ${p.leadMinutes} menit sebelumnya.`,actions:[]}
    }
    state.pending={kind:"reminder-time",title:p.title,date,daypart:p.daypart,source:p.source,leadMinutes:p.leadMinutes};
    return{text:`${prettyDate(date)} pukul berapa?`,actions:timeChoices(p.daypart)}
  }

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
  else if(hasDateContext(text)){const d=parseDate(text);rows.forEach(r=>{r.date=d;r.notified=false});changed.push("tanggal menjadi "+prettyDate(d))}
  const tm=parseTime(text);if(tm){rows.forEach(r=>{r.time=normalizeTimeForDaypart(tm,daypartOf(text));r.notified=false});changed.push("jam diperbarui")}
  if(!changed.length)return{text:"Boleh, bagian mana yang perlu dikoreksi—tanggal, jam, atau keterangannya?",actions:["Hari ini","Besok","Ubah jam"]};
  return{text:`Oke, aku koreksi agenda terakhir: ${changed.join(" dan ")}.`,actions:[]}
}
function explicitTargetIntent(t){return /\b(target|sasaran|tujuan|goal)\b/i.test(t)}
function inferredTargetIntent(t){
  const s=String(t).toLowerCase();
  const period=/\b(bulan ini|minggu ini|pekan ini|tahun ini)\b/.test(s);
  const outcome=/\b(menyelesaikan|selesaikan|selesaiin|menuntaskan|mencapai|membuat|membangun|belajar|menabung|mengumpulkan|menurunkan|menaikkan)\b/.test(s);
  const desire=/\b(ingin|pengen|pingin|mau|harus|berencana)\b/.test(s);
  return period&&outcome&&(desire||/\b(menyelesaikan|menuntaskan|mencapai)\b/.test(s));
}
function targetPeriod(t){const s=String(t).toLowerCase();if(/minggu ini|pekan ini/.test(s))return"weekly";return"monthly"}
function targetTitle(t){
  let s=String(t)
    .replace(/\b(target|sasaran|tujuan|goal)\b/gi," ")
    .replace(/\b(di\s*)?bulan ini|\bdibulan ini|\bminggu ini|\bpekan ini/gi," ")
    .replace(/\baku punya\b|\bsaya punya\b|\baku ingin\b|\bsaya ingin\b|\baku mau\b|\bsaya mau\b/gi," ")
    .replace(/\buntuk\s+(?=menyelesaikan|membuat|mengerjakan|belajar|mencapai)/gi," ")
    .replace(/^[,.:;\-\s]+|[,.:;\-\s]+$/g," ").replace(/\s+/g," ").trim();
  return sentenceCase(s||"Target baru");
}
function defaultTargetSteps(){return []}
function addTargetFromText(t){
  const period=targetPeriod(t),title=targetTitle(t),month=localISO().slice(0,7),id=uid();
  const goal={id,title,target:0,progress:0,kind:"manual",period,month,completed:false,steps:[],createdAt:new Date().toISOString(),sourceText:t};
  state.goals.push(goal);state.lastCreated={type:"target",ids:[id],at:Date.now()};return goal;
}
function explicitNoteIntent(t){return /\b(catat|catatkan|note|jadikan catatan|simpan catatan|ide|gagasan|jangan lupa bahwa)\b/i.test(t)}
function explicitAgendaIntent(t){return /\b(ingatkan|pengingat|reminder|jadwal|agenda|deadline|janji)\b/i.test(t)}
function activityIntent(t){return /\b(ke|pergi|berangkat|temui|nemui|nemuin|ketemu|bertemu|meeting|rapat|review|loading|pasang|pemasangan|acara|jemput|antar|kirim|bayar|ambil|datang|kerja|kontrol|periksa)\b/i.test(t)}
function hasDateContext(t){return /\b(hari ini|besok|lusa|nanti|tanggal\s+\d+|(?:minggu|pekan)\s+depan(?:\s+hari)?\s+(?:senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)|senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)(?:\s+depan)?\b/i.test(t)}
function hasTimeContext(t){return !!parseTime(t)||/\b(pagi|siang|sore|malam|habis magrib|setelah magrib|sehabis magrib)\b/i.test(t)}
function classifyIntent(text){
  const debt=debtIntent(text),rawAmount=parseAmount(text),ft=financeType(text),amount=ft?rawAmount:null;
  if(debt&&rawAmount)return{type:debt,confidence:.99,amount:rawAmount};
  if(ft&&amount)return{type:"finance",confidence:.98};
  if(explicitTargetIntent(text))return{type:"target",confidence:.98};
  if(inferredTargetIntent(text))return{type:"target",confidence:.88};
  if(habitIntent(text))return{type:"habit",confidence:.92};
  if(explicitNoteIntent(text))return{type:"note",confidence:.95};
  if(explicitAgendaIntent(text)||activityIntent(text)&&(hasDateContext(text)||hasTimeContext(text)))return{type:"agenda",confidence:.9};
  if(activityIntent(text))return{type:"agenda-incomplete",confidence:.72};
  return{type:"unknown",confidence:.3};
}
function agendaDateChoices(){return["Hari ini","Besok","Lusa","Pilih tanggal lain"]}
function beginAgendaClarification(text){
  const dateKnown=hasDateContext(text),time=parseTime(text),part=daypartOf(text),title=smartTitle(text);
  if(!dateKnown){
    state.pending={kind:"agenda-date",title,source:text,time,daypart:part,leadMinutes:state.settings.reminderLead||30};
    return{text:`“${title}” mau dijadwalkan kapan?`,actions:agendaDateChoices()};
  }
  const date=parseDate(text);
  if(!time){
    state.pending={kind:"reminder-time",title,date,daypart:part,source:text,leadMinutes:state.settings.reminderLead||30};
    return{text:`${prettyDate(date)} kamu punya agenda “${title}”. Jam berapa? Aku akan mengingatkan ${state.pending.leadMinutes} menit sebelumnya.`,actions:timeChoices(part)};
  }
  return null;
}
function saveExplicitNote(source){
  const body=paraphraseNote(source),title=body.replace(/[.!?]$/,"").slice(0,56),id=uid();
  state.notes.push({id,title,body,sourceText:source,date:localISO(),createdAt:new Date().toISOString()});
  state.lastCreated={type:"note",ids:[id],at:Date.now()};
  return{text:`Oke, aku rapikan dan simpan sebagai catatan: “${body}”`,actions:[]};
}
function unknownIntentPrompt(text){
  state.pending={kind:"intent-choice",source:text};
  return{text:"Aku belum yakin kamu ingin aku melakukan apa dengan kalimat itu. Mau aku jadikan catatan, agenda, target, atau tidak perlu disimpan?",actions:["Jadikan catatan","Buat agenda","Jadikan target","Tidak perlu disimpan"]};
}

function smartResponse(text){
  const pending=resolvePending(text);if(pending)return pending;
  const corrected=correctRecent(text);if(corrected)return corrected;
  const debtPaid=payLiabilityFromText(text);
  if(debtPaid)return{text:`Pembayaran hutang ${rupiah(debtPaid.paid)} sudah dicatat. Sisa hutang: ${rupiah(debtPaid.item.remaining||0)}.`,actions:[]};
  const receivablePaid=receiveReceivableFromText(text);
  if(receivablePaid)return{text:`Pembayaran piutang ${rupiah(receivablePaid.received)} sudah masuk kas. Sisa piutang: ${rupiah(receivablePaid.item.remaining||0)}.`,actions:[]};
  const paidBill=markPaidBillFromText(text);
  if(paidBill)return{text:`Sip, tagihan “${paidBill.title}” sudah lunas. ${rupiah(paidBill.amount)} juga sudah masuk ke pengeluaran.`,actions:[]};
  const completedHabit=markHabitFromText(text);
  if(completedHabit)return{text:`Bagus, “${completedHabit.name}” sudah aku tandai selesai untuk hari ini.`,actions:[]};
  const intent=classifyIntent(text);
  if(intent.type==="liability"){
    state.pending={kind:"debt-kind",source:text,amount:intent.amount};
    return{text:`Aku tangkap kamu berhutang ${rupiah(intent.amount)}. Ini uang pinjaman yang masuk ke kas, atau hutang karena membeli sesuatu?`,actions:["Pinjaman masuk kas","Hutang pembelian"]};
  }
  if(intent.type==="receivable"){const r=createReceivable(text,intent.amount);return{text:`Siap. ${r.title} sebesar ${rupiah(r.amount)} dicatat sebagai piutang/aset, bukan pengeluaran.`,actions:[]}}
  if(intent.type==="unknown")return unknownIntentPrompt(text);
  if(intent.type==="target"){const g=addTargetFromText(text);return{text:`Siap. Aku jadikan target ${g.period==="weekly"?"minggu ini":"bulan ini"}: “${g.title}”.`,actions:[]}}
  if(intent.type==="agenda-incomplete"){
    const q=beginAgendaClarification(text);if(q)return q;
  }
  if(intent.type==="agenda"){
    const q=beginAgendaClarification(text);if(q)return q;
  }
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
    if(explicitTargetIntent(clause)){const g=addTargetFromText(clause);results.push(`Target ${g.period==="weekly"?"minggu":"bulan"} ini ditambahkan: “${g.title}”.`);continue;}
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
    results.push("Aku belum yakin ini perlu disimpan. Coba beri konteks sedikit lagi ya.");
  }
  return results;
}

function speak(text){if(!voiceSession)return;const clean=text.replace(/✓/g,"").replace(/Rp\s?/g,"rupiah ");try{if(window.NaraAndroid&&window.NaraAndroid.speak){window.NaraAndroid.speak(clean);return}}catch{}if("speechSynthesis"in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(clean);u.lang="id-ID";u.rate=.98;speechSynthesis.speak(u)}}
function syncChatSafeArea(){
  const composer=$("#chatForm"),nav=$(".bottomnav"),stream=$("#conversationScroll");
  if(!stream)return;
  const composerH=composer&&typeof composer.getBoundingClientRect==="function"?composer.getBoundingClientRect().height:64;
  const navH=typeof innerWidth!=="undefined"&&innerWidth<980&&nav&&typeof nav.getBoundingClientRect==="function"?nav.getBoundingClientRect().height:0;
  const safe=Math.ceil(composerH+navH+44);
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
function txTotals(filter=()=>true){return state.transactions.filter(filter).reduce((a,t)=>{if(t.type==="income")a.income+=t.amount;if(t.type==="expense")a.expense+=t.amount;return a},{income:0,expense:0})}
function startOfWeekISO(d=new Date()){
  const x=new Date(d),dow=(x.getDay()+6)%7;x.setDate(x.getDate()-dow);return localISO(x)
}
function endOfWeekISO(d=new Date()){
  const x=new Date(d),dow=(x.getDay()+6)%7;x.setDate(x.getDate()-dow+6);return localISO(x)
}
function agendaInRange(r,range,today=localISO()){
  if(range==="today")return r.date===today;
  if(range==="week")return r.date>=startOfWeekISO()&&r.date<=endOfWeekISO();
  if(range==="month")return r.date.startsWith(today.slice(0,7));
  return true;
}
function agendaSort(a,b){
  if(Number(a.done)!==Number(b.done))return Number(a.done)-Number(b.done);
  const ad=(a.date||"9999-99-99")+" "+(a.time||"99:99"),bd=(b.date||"9999-99-99")+" "+(b.time||"99:99");
  return ad.localeCompare(bd);
}
function agendaDateLabel(date,today=localISO()){
  if(date===today)return"Hari ini";
  if(date===addDays(1))return"Besok";
  return new Intl.DateTimeFormat("id-ID",{weekday:"short",day:"numeric",month:"short"}).format(new Date(date+"T12:00:00"));
}
function renderToday(){
  const today=localISO(),range=state.settings.agendaRange||"today",allAgenda=[...state.reminders].sort(agendaSort),agenda=allAgenda.filter(r=>agendaInRange(r,range,today)),todayActive=allAgenda.filter(r=>!r.done&&r.date===today).sort(agendaSort),habits=state.habits;
  $("#agendaCount").textContent=agenda.length+" agenda";$("#habitCount").textContent=habits.length;
  $("#focusText").textContent=(todayActive[0]&&todayActive[0].title)||(habits.length?"Jaga konsistensi kebiasaan hari ini.":"Belum ada agenda hari ini.");
  const d=new Date();$("#dateBadge").innerHTML=`<b>${d.getDate()}</b><br>${new Intl.DateTimeFormat("id-ID",{month:"short"}).format(d)}`;
  document.querySelectorAll("[data-agenda-range]").forEach(b=>{const active=b.dataset.agendaRange===range;b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active))});
  $("#todayAgenda").classList.toggle("empty",!agenda.length);
  const emptyLabel=range==="today"?"Belum ada agenda hari ini.":range==="week"?"Belum ada agenda minggu ini.":"Belum ada agenda bulan ini.";
  $("#todayAgenda").innerHTML=agenda.length?agenda.map(r=>{
    const dateLabel=agendaDateLabel(r.date,today),timeLabel=r.time||"—";
    return `<div class="row agenda-row ${r.done?"done":""}" data-agenda-id="${r.id}">
      <button class="agenda-check reminder-done ${r.done?"done":""}" data-id="${r.id}" aria-label="${r.done?"Buka kembali agenda":"Tandai agenda selesai"}"><svg><use href="#ico-check-circle"/></svg></button>
      <div class="agenda-time-block"><b>${esc(timeLabel)}</b><span>${esc(dateLabel)}</span></div>
      <div class="rowmain agenda-copy"><strong>${esc(r.title)}</strong><span>${r.done?`Selesai${r.completedAt?" · "+new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"}).format(new Date(r.completedAt)):""}`:`Pengingat ${r.leadMinutes||state.settings.reminderLead||30} menit sebelumnya`}</span></div>
      <button class="agenda-menu-trigger" data-id="${r.id}" aria-label="Opsi agenda"><svg><use href="#ico-more"/></svg></button>
    </div>`
  }).join(""):emptyLabel;
  $("#todayHabits").classList.toggle("empty",!habits.length);
  $("#todayHabits").innerHTML=habits.length?habits.map(h=>{const done=h.doneDates.includes(today);return `<div class="row habit-row"><button class="agenda-check habit-toggle ${done?"done":""}" data-id="${h.id}" aria-label="${done?"Buka kembali kebiasaan":"Tandai kebiasaan selesai"}"><svg><use href="#ico-check-circle"/></svg></button><div class="rowmain"><strong>${esc(h.name)}</strong><span>${h.period==="weekly"?h.target+"× per minggu":"Setiap hari"}</span></div><span class="habit-status ${done?"done":""}">${done?"Selesai":""}</span></div>`}).join(""):"Belum ada kebiasaan yang kamu pantau.";
  const total=txTotals(t=>t.date===today);$("#todayIncome").textContent=rupiah(total.income);$("#todayExpense").textContent=rupiah(total.expense);$("#todayNet").textContent=rupiah(total.income-total.expense);
}

function row(icon,title,sub,value,klass=""){return `<div class="row"><div class="rowicon">${icon}</div><div class="rowmain"><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>${value?`<div class="rowvalue ${klass}">${esc(value)}</div>`:""}</div>`}
function renderFinance(){
  const total=txTotals(),month=localISO().slice(0,7),mt=txTotals(t=>t.date.startsWith(month));
  $("#balanceTotal").textContent=rupiah(cashBalance());$("#monthIncome").textContent=rupiah(mt.income);$("#monthExpense").textContent=rupiah(mt.expense);$("#sideBalance").textContent=rupiah(cashBalance());
  const recent=[...state.transactions].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).slice(0,12);
  $("#transactionList").classList.toggle("empty",!recent.length);$("#transactionList").innerHTML=recent.length?recent.map(t=>`<div class="row"><div class="rowicon">${t.type==="income"?"+":"−"}</div><div class="rowmain"><strong>${esc(t.title)}</strong><span>${esc(categoryLabel(t.category))} · ${fmtDate(t.date)}</span></div><div class="rowvalue ${accountingCashImpact(t)>0?"good":accountingCashImpact(t)<0?"bad":""}">${accountingCashImpact(t)>0?"+":accountingCashImpact(t)<0?"−":"•"} ${rupiah(t.amount)}</div><div class="row-actions"><button class="edit-action edit-tx" data-id="${t.id}" aria-label="Edit transaksi"><svg><use href="#ico-edit"/></svg></button><button class="rowaction delete-tx" data-id="${t.id}" aria-label="Hapus transaksi">×</button></div></div>`).join(""):"Belum ada transaksi.";
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
  const debts=state.liabilities.filter(x=>!x.done),receivables=state.receivables.filter(x=>!x.done);
  $("#liabilityTotal").textContent=rupiah(openLiabilityTotal());$("#liabilityCount").textContent=debts.length+" hutang";
  $("#receivableTotal").textContent=rupiah(openReceivableTotal());$("#receivableCount").textContent=receivables.length+" piutang";
  $("#liabilityList").classList.toggle("empty",!debts.length);$("#liabilityList").innerHTML=debts.length?debts.slice(0,4).map(x=>`<div><span>${esc(x.title)}</span><b>${rupiah(x.remaining??x.amount)}</b></div>`).join(""):"Belum ada hutang aktif.";
  $("#receivableList").classList.toggle("empty",!receivables.length);$("#receivableList").innerHTML=receivables.length?receivables.slice(0,4).map(x=>`<div><span>${esc(x.title)}</span><b>${rupiah(x.remaining??x.amount)}</b></div>`).join(""):"Belum ada piutang aktif.";
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
  if(Array.isArray(g.steps)&&g.steps.length){const done=g.steps.filter(s=>s.done).length;return Math.round(done/g.steps.length*100)}
  return g.completed?100:0;
}
function renderGoals(){
  const month=localISO().slice(0,7),goals=state.goals.filter(g=>g.month===month);$("#goalMonth").textContent=new Intl.DateTimeFormat("id-ID",{month:"long"}).format(new Date());
  $("#goalsList").classList.toggle("empty",!goals.length);$("#goalsList").innerHTML=goals.length?goals.map(g=>{if(!Array.isArray(g.steps))g.steps=[];const p=g.completed?100:goalProgress(g),collapsed=!!g.collapsed,steps=g.steps.map((s,i)=>`<div class="target-step-row ${s.done?"done":""}"><button class="target-step-check" data-goal="${g.id}" data-step="${s.id}" aria-label="Tandai langkah"><span>${s.done?"✓":i+1}</span></button><div class="target-step-copy">${esc(s.title)}</div><button class="target-step-delete" data-goal="${g.id}" data-step-delete="${s.id}" aria-label="Hapus langkah">×</button></div>`).join("");return `<div class="goal target-card ${g.completed?"done":""} ${collapsed?"collapsed":""}"><div class="target-card-head"><button class="target-collapse" data-target-collapse="${g.id}" aria-label="${collapsed?"Buka target":"Minimize target"}"><svg><use href="${collapsed?"#ico-expand":"#ico-collapse"}"/></svg></button><div class="target-main"><div class="goaltop"><strong>${esc(g.title)}</strong><span>${p}%</span></div><small>${g.period==="weekly"?"Minggu ini":"Bulan ini"} · ${g.steps.length} langkah</small></div><button class="edit-action edit-target" data-id="${g.id}" aria-label="Edit target"><svg><use href="#ico-edit"/></svg></button><button class="rowaction delete-target" data-id="${g.id}" aria-label="Hapus target">×</button></div><div class="target-detail" ${collapsed?"hidden":""}><div class="progress"><i style="width:${p}%"></i></div><div class="target-steps">${steps||'<div class="target-empty-steps">Belum ada langkah. Tambahkan sesuai kebutuhanmu.</div>'}</div><form class="target-add-step" data-goal-form="${g.id}"><input data-goal-input="${g.id}" placeholder="Tambah langkah…"><button type="submit">+ Tambah</button></form><button class="target-done-button ${g.completed?"done":""}" data-target-done="${g.id}">${g.completed?"Selesai ✓":"Done"}</button></div></div>`}).join(""):"Belum ada target bulan ini.";
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
  if($("#backupHabitCount"))$("#backupHabitCount").textContent=state.habits.length;if($("#backupDebtCount"))$("#backupDebtCount").textContent=state.liabilities.length+state.receivables.length;
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
  const t=$("#quickType").value,finance=["expense","income"].includes(t),rem=t==="reminder",habit=t==="habit",target=t==="target";
  $("#amountWrap").classList.toggle("hidden",!finance);$("#dateWrap").classList.toggle("hidden",!(finance||rem));$("#timeWrap").classList.toggle("hidden",!rem);$("#reminderLeadWrap").classList.toggle("hidden",!rem);$("#targetPeriodWrap").classList.toggle("hidden",!target);$("#freqWrap").classList.toggle("hidden",!habit);
}
function quickSubmit(e){
  e.preventDefault();const type=$("#quickType").value,title=$("#quickTitle").value.trim();if(!title)return;
  if(["expense","income"].includes(type)){const amount=Number($("#quickAmount").value.replace(/\D/g,""));if(!amount)return alert("Masukkan nominal.");state.transactions.push({id:uid(),type,amount,category:categoryFor(title),title,date:$("#quickDate").value||localISO(),createdAt:new Date().toISOString()})}
  if(type==="reminder")state.reminders.push({id:uid(),title,date:$("#quickDate").value||localISO(),time:$("#quickTime").value,done:false,leadMinutes:Number($("#quickReminderLead").value)||state.settings.reminderLead||30,notified:false});
  if(type==="note")state.notes.push({id:uid(),title:title.slice(0,48),body:title,date:localISO(),createdAt:new Date().toISOString()});
  if(type==="target")state.goals.push({id:uid(),title:targetTitle(title),target:0,progress:0,kind:"manual",period:$("#quickTargetPeriod").value||"monthly",month:localISO().slice(0,7),completed:false,steps:[],createdAt:new Date().toISOString()});
  if(type==="habit"){const f=$("#quickFrequency").value,spec={name:title,period:f==="daily"?"daily":"weekly",target:f==="3-week"?3:1};addHabit(spec,true)}
  $("#quickForm").reset();$("#quickDate").value=localISO();$("#quickDialog").close();save();
}



let editContext=null,lastReminderCheck=0,agendaSheetId=null,confirmAction=null;
function askConfirm(title,message,okLabel="OK",action=null){
  confirmAction=action;$("#confirmTitle").textContent=title;$("#confirmMessage").textContent=message;$("#confirmOk").textContent=okLabel;$("#confirmDialog").showModal();
}
function closeConfirm(){confirmAction=null;if($("#confirmDialog").open)$("#confirmDialog").close()}

function openAgendaSheet(id){
  const r=state.reminders.find(x=>x.id===id);if(!r)return;
  agendaSheetId=id;$("#agendaSheetTitle").textContent=r.title;
  const doneBtn=document.querySelector('[data-sheet-action="done"]');
  if(doneBtn){
    const label=doneBtn.querySelector("span"),hint=doneBtn.querySelector("small");
    if(label)label.textContent=r.done?"Buka kembali":"Tandai selesai";
    if(hint)hint.textContent=r.done?"Kembalikan agenda ke status aktif":"Tandai agenda ini sebagai selesai";
  }
  if($("#agendaSheet").open)$("#agendaSheet").close();
  $("#agendaSheet").showModal();
}
function closeAgendaSheet(){agendaSheetId=null;if($("#agendaSheet").open)$("#agendaSheet").close()}
function runAgendaSheetAction(action){
  const id=agendaSheetId,r=state.reminders.find(x=>x.id===id);if(!r)return closeAgendaSheet();
  if(action==="edit"){closeAgendaSheet();openEditor("reminder",id);return}
  if(action==="done"){r.done=!r.done;r.completedAt=r.done?new Date().toISOString():null;closeAgendaSheet();save();return}
  if(action==="delete"){closeAgendaSheet();askConfirm("Hapus agenda?","Agenda ini akan dihapus permanen.","Hapus",()=>{state.reminders=state.reminders.filter(x=>x.id!==id);save()})}
}

function openEditor(kind,id){
  if($("#agendaSheet")&&$("#agendaSheet").open)$("#agendaSheet").close();
  if($("#confirmDialog")&&$("#confirmDialog").open)$("#confirmDialog").close();
  let item=null;
  if(kind==="note")item=state.notes.find(x=>x.id===id);
  if(kind==="tx")item=state.transactions.find(x=>x.id===id);
  if(kind==="reminder")item=state.reminders.find(x=>x.id===id);
  if(kind==="habit")item=state.habits.find(x=>x.id===id);
  if(kind==="target")item=state.goals.find(x=>x.id===id);
  if(!item)return;editContext={kind,id};
  $("#editKind").value=kind;$("#editId").value=id;$("#editTitle").value=item.title||item.name||"";$("#editBody").value=item.body||"";
  $("#editAmount").value=item.amount||"";$("#editDate").value=item.date||localISO();$("#editTime").value=item.time||"";$("#editLead").value=String(item.leadMinutes||state.settings.reminderLead||30);if($("#editTargetPeriod"))$("#editTargetPeriod").value=item.period||"monthly";
  $("#editBodyWrap").classList.toggle("hidden",kind!=="note");$("#editAmountWrap").classList.toggle("hidden",kind!=="tx");$("#editDateWrap").classList.toggle("hidden",!["tx","reminder"].includes(kind));$("#editTimeWrap").classList.toggle("hidden",kind!=="reminder");$("#editLeadWrap").classList.toggle("hidden",kind!=="reminder");$("#editTargetPeriodWrap").classList.toggle("hidden",kind!=="target");
  $("#editHeading").textContent={note:"Edit catatan",tx:"Edit transaksi",reminder:"Edit pengingat",habit:"Edit kebiasaan",target:"Edit target"}[kind];$("#editDialog").showModal();
}
function saveEditor(e){e.preventDefault();if(!editContext)return;const {kind,id}=editContext,title=$("#editTitle").value.trim();if(!title)return;
  if(kind==="note"){const x=state.notes.find(x=>x.id===id);if(x){x.title=title;x.body=$("#editBody").value.trim()||title}}
  if(kind==="tx"){const x=state.transactions.find(x=>x.id===id);if(x){x.title=title;x.amount=Number($("#editAmount").value.replace(/\D/g,""))||x.amount;x.date=$("#editDate").value||x.date;x.category=categoryFor(title)}}
  if(kind==="reminder"){const x=state.reminders.find(x=>x.id===id);if(x){x.title=title;x.date=$("#editDate").value||x.date;x.time=$("#editTime").value;x.leadMinutes=Number($("#editLead").value)||30;x.notified=false}}
  if(kind==="habit"){const x=state.habits.find(x=>x.id===id);if(x){const old=x.name;x.name=title;state.goals.filter(g=>g.habitName===old).forEach(g=>{g.habitName=title;g.title=title})}}
  if(kind==="target"){const x=state.goals.find(x=>x.id===id);if(x){x.title=targetTitle(title);x.period=$("#editTargetPeriod").value||x.period}}
  $("#editDialog").close();editContext=null;save();
}
function restoreBackupFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result),data=parsed.data||parsed;if(!data||!Array.isArray(data.notes)||!Array.isArray(data.transactions))throw new Error("Format tidak cocok");askConfirm("Pulihkan backup?","Data NARA saat ini akan diganti dengan isi file backup.","Pulihkan",()=>{localStorage.setItem(KEY,JSON.stringify(data));location.reload()})}catch(e){alert("File backup tidak valid.")}};reader.readAsText(file)}
function resetAllData(){askConfirm("Reset semua data?","Catatan, transaksi, agenda, target, hutang/piutang, dan kebiasaan di perangkat ini akan dihapus.","Reset",()=>{localStorage.removeItem(KEY);location.reload()})}
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

function setVoiceUI(active,transcript="",mode="listening"){
  const panel=$("#voiceMode"),text=transcript||"Silakan bicara…";
  if(panel)panel.hidden=!active;
  if($("#micButton"))$("#micButton").classList.toggle("active",active);
  if($("#listeningPanel"))$("#listeningPanel").hidden=true;
  if($("#voiceStatus")){$("#voiceStatus").classList.toggle("listening",active);$("#voiceStatus span").textContent=active?"Mendengarkan…":"Suara siap"}
  if($("#voiceModeTranscript"))$("#voiceModeTranscript").textContent=text;
  if($("#voiceTranscript"))$("#voiceTranscript").textContent=text;
  if($("#voiceModeState"))$("#voiceModeState").textContent=mode==="review"?"UCAPAN TERTANGKAP":"MENDENGARKAN";
  if($("#voiceModeHint"))$("#voiceModeHint").textContent=mode==="review"?"Periksa sebentar. Tekan Selesai untuk memproses ucapan ini.":"Bicara seperti biasa. NARA akan memahami dulu sebelum mencatat.";
  if($("#voiceDone"))$("#voiceDone").textContent=mode==="review"?"Proses":"Selesai";
  if(panel)panel.classList.toggle("review",mode==="review");
}
function showVoiceReview(text){
  voiceDraft=String(text||"").trim();
  voiceSession=!!voiceDraft;
  if(voiceDraft)setVoiceUI(true,voiceDraft,"review");
  else{voiceSession=false;setVoiceUI(false)}
}
function webSpeechStart(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return false;
  if(!recognition){
    recognition=new SR();recognition.lang="id-ID";recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;
    recognition.onresult=e=>{
      let interim="";
      for(let i=e.resultIndex;i<e.results.length;i++){const txt=e.results[i][0].transcript;if(e.results[i].isFinal)voiceFinal+=txt;else interim+=txt}
      const shown=(voiceFinal||interim).trim();voiceDraft=shown;
      setVoiceUI(true,shown||"Silakan bicara…","listening");
      $("#chatInput").value=shown;
    };
    recognition.onerror=e=>{
      voiceSubmitRequested=false;voiceSession=false;
      const msgText=e.error==="not-allowed"?"Izin mikrofon diperlukan.":"Suara belum bisa ditangkap. Coba lagi.";
      voiceDraft="";setVoiceUI(true,msgText,"review");
      if($("#voiceModeHint"))$("#voiceModeHint").textContent=e.error==="not-allowed"?"Aktifkan izin mikrofon untuk memakai input suara.":"Pastikan mikrofon aktif dan coba bicara lebih dekat.";
    };
    recognition.onend=()=>{
      const txt=(voiceFinal||voiceDraft).trim();voiceFinal="";
      if(voiceSubmitRequested){voiceSubmitRequested=false;if(txt){setVoiceUI(false);voiceSession=true;sendText(txt);$("#chatInput").value="";voiceDraft=""}else setVoiceUI(false)}
      else if(txt)showVoiceReview(txt);else{voiceSession=false;setVoiceUI(false)}
    };
  }
  try{voiceFinal="";voiceDraft="";voiceSubmitRequested=false;voiceSession=true;recognition.start();setVoiceUI(true,"Silakan bicara…","listening");return true}catch{return false}
}
function startVoice(){
  try{if(window.NaraAndroid&&window.NaraAndroid.startVoiceInput){voiceSession=true;voiceDraft="";setVoiceUI(true,"Silakan bicara…","listening");window.NaraAndroid.startVoiceInput();return}}catch{}
  if(!webSpeechStart()){setVoiceUI(false);voiceSession=false;msg("assistant","Maaf, fitur suara belum didukung di browser ini. Kamu tetap bisa mengetik seperti biasa.");save()}
}
function cancelVoice(){
  voiceSubmitRequested=false;voiceDraft="";voiceFinal="";voiceSession=false;
  try{if(recognition)recognition.abort()}catch{}
  setVoiceUI(false);$("#chatInput").value="";
}
function submitVoice(){
  const txt=(voiceFinal||voiceDraft||$("#chatInput").value||"").trim();
  if(recognition){
    try{voiceSubmitRequested=true;recognition.stop();return}catch{}
  }
  if(txt){setVoiceUI(false);voiceSession=true;sendText(txt);$("#chatInput").value="";voiceDraft=""}
  else cancelVoice();
}
window.NaraVoiceResult=function(text){const txt=String(text||"").trim();if(txt){$("#chatInput").value=txt;showVoiceReview(txt)}else cancelVoice()};
window.NaraVoiceError=function(message){voiceSession=false;voiceDraft="";setVoiceUI(true,message||"Maaf, fitur suara sedang tidak tersedia.","review");if($("#voiceModeHint"))$("#voiceModeHint").textContent="Coba lagi atau gunakan input teks."};

function boot(){
  window.__NARA_BOOTED__=true;
  const splash=$("#splash");
  setTimeout(()=>{
    if(splash){splash.classList.add("hide");splash.style.pointerEvents="none"}
    setTimeout(()=>{if(splash&&splash.parentNode)splash.parentNode.removeChild(splash)},450)
  },850)
}

document.addEventListener("click",e=>{
  const trigger=e.target.closest(".agenda-menu-trigger");
  if(trigger){e.stopPropagation();openAgendaSheet(trigger.dataset.id);return}
  const sheetAction=e.target.closest("[data-sheet-action]");
  if(sheetAction){runAgendaSheetAction(sheetAction.dataset.sheetAction);return}
  const rangeBtn=e.target.closest("[data-agenda-range]");if(rangeBtn){state.settings.agendaRange=rangeBtn.dataset.agendaRange;save();return}
  const nav=e.target.closest("[data-page]");if(nav)go(nav.dataset.page);const en=e.target.closest(".edit-note");if(en)openEditor("note",en.dataset.id);const et=e.target.closest(".edit-tx");if(et)openEditor("tx",et.dataset.id);const er=e.target.closest(".edit-reminder");if(er)openEditor("reminder",er.dataset.id);const eh=e.target.closest(".edit-habit");if(eh)openEditor("habit",eh.dataset.id);const eg=e.target.closest(".edit-target");if(eg)openEditor("target",eg.dataset.id);
  const chip=e.target.closest("[data-prompt]");if(chip){$("#chatInput").value=chip.dataset.prompt;$("#chatInput").focus()}const choice=e.target.closest("[data-chat-choice]");if(choice)sendText(choice.dataset.chatChoice);
  const act=e.target.closest("[data-action]");if(act){const map={quick:"expense",transaction:"expense",note:"note",target:"target",habit:"habit"};openQuick(map[act.dataset.action])}
  const ht=e.target.closest(".habit-toggle");if(ht){const h=state.habits.find(x=>x.id===ht.dataset.id),d=localISO();if(h){h.doneDates=h.doneDates.includes(d)?h.doneDates.filter(x=>x!==d):[...h.doneDates,d];save()}}
  const done=e.target.closest(".reminder-done");if(done){const r=state.reminders.find(x=>x.id===done.dataset.id);if(r){r.done=!r.done;r.completedAt=r.done?new Date().toISOString():null;save()}}
  const delTx=e.target.closest(".delete-tx");if(delTx){state.transactions=state.transactions.filter(x=>x.id!==delTx.dataset.id);save()}
  const delNote=e.target.closest(".delete-note");if(delNote){state.notes=state.notes.filter(x=>x.id!==delNote.dataset.id);save()}
  const targetCollapse=e.target.closest("[data-target-collapse]");if(targetCollapse){const g=state.goals.find(x=>x.id===targetCollapse.dataset.targetCollapse);if(g){g.collapsed=!g.collapsed;save()}}
  const targetStep=e.target.closest(".target-step-check");if(targetStep){const g=state.goals.find(x=>x.id===targetStep.dataset.goal),s=g&&g.steps&&g.steps.find(x=>x.id===targetStep.dataset.step);if(s){s.done=!s.done;g.completed=g.steps.length>0&&g.steps.every(x=>x.done);g.progress=goalProgress(g);save()}}
  const targetStepDelete=e.target.closest("[data-step-delete]");if(targetStepDelete){const g=state.goals.find(x=>x.id===targetStepDelete.dataset.goal);if(g){g.steps=(g.steps||[]).filter(x=>x.id!==targetStepDelete.dataset.stepDelete);g.completed=g.steps.length>0&&g.steps.every(x=>x.done);g.progress=goalProgress(g);save()}}
  const targetDone=e.target.closest("[data-target-done]");if(targetDone){const g=state.goals.find(x=>x.id===targetDone.dataset.targetDone);if(g){g.completed=!g.completed;if(Array.isArray(g.steps))g.steps.forEach(s=>s.done=g.completed);g.progress=g.completed?100:0;save()}}
  const delTarget=e.target.closest(".delete-target");if(delTarget){const id=delTarget.dataset.id;askConfirm("Hapus target?","Target dan semua langkah di dalamnya akan dihapus.","Hapus",()=>{state.goals=state.goals.filter(x=>x.id!==id);save()})}
  const delHabit=e.target.closest(".delete-habit");if(delHabit){const h=state.habits.find(x=>x.id===delHabit.dataset.id);if(h){state.habits=state.habits.filter(x=>x.id!==h.id);state.goals=state.goals.filter(g=>g.habitName!==h.name);save()}}
  const dot=e.target.closest(".daydot");if(dot){const h=state.habits.find(x=>x.id===dot.dataset.habit),d=dot.dataset.date;if(h){h.doneDates=h.doneDates.includes(d)?h.doneDates.filter(x=>x!==d):[...h.doneDates,d];save()}}
});
document.addEventListener("submit",e=>{const f=e.target.closest("[data-goal-form]");if(!f)return;e.preventDefault();const id=f.dataset.goalForm,g=state.goals.find(x=>x.id===id),input=f.querySelector("[data-goal-input]"),title=(input&&input.value||"").trim();if(g&&title){g.steps=g.steps||[];g.steps.push({id:uid(),title:sentenceCase(naturalizeText(title)),done:false});g.completed=false;g.progress=goalProgress(g);save()}})
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const i=$("#chatInput");voiceSession=false;sendText(i.value);i.value="";i.style.height="auto"});
$("#chatInput").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,112)+"px";syncChatSafeArea();scrollChatToBottom(false)});
$("#chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#chatForm").requestSubmit()}});
$("#quickAdd").addEventListener("click",()=>openQuick());
$("#closeDialog").addEventListener("click",()=>$("#quickDialog").close());
$("#quickType").addEventListener("change",syncQuick);$("#quickForm").addEventListener("submit",quickSubmit);$("#noteSearch").addEventListener("input",renderNotes);$("#micButton").addEventListener("click",startVoice);$("#tryVoice").addEventListener("click",startVoice);$("#voiceStatus").addEventListener("click",startVoice);$("#stopVoice").addEventListener("click",stopVoice);$("#accountNameForm").addEventListener("submit",e=>{e.preventDefault();updateAccountName($("#accountName").value)});
$("#downloadBackup").addEventListener("click",downloadBackup);$("#restoreBackup").addEventListener("change",e=>restoreBackupFile(e.target.files[0]));$("#resetNara").addEventListener("click",resetAllData);$("#defaultReminderLead").addEventListener("change",e=>{state.settings.reminderLead=Number(e.target.value)||30;save()});$("#enableNotifications").addEventListener("click",requestNotifications);$("#editForm").addEventListener("submit",saveEditor);$("#closeEditDialog").addEventListener("click",()=>$("#editDialog").close());$("#confirmCancel").addEventListener("click",closeConfirm);$("#confirmOk").addEventListener("click",()=>{const fn=confirmAction;closeConfirm();if(typeof fn==="function")fn()});$("#confirmDialog").addEventListener("click",e=>{if(e.target===$("#confirmDialog"))closeConfirm()});$("#closeAgendaSheet").addEventListener("click",closeAgendaSheet);$("#agendaSheet").addEventListener("click",e=>{if(e.target===$("#agendaSheet"))closeAgendaSheet()});$("#closeVoiceMode").addEventListener("click",cancelVoice);$("#voiceCancel").addEventListener("click",cancelVoice);$("#voiceDone").addEventListener("click",submitVoice);$("#dismissReminderToast").addEventListener("click",()=>$("#reminderToast").hidden=true);
$("#profilePromptForm").addEventListener("submit",e=>{e.preventDefault();const n=$("#profilePromptName").value.trim();if(n)updateAccountName(n)});
$("#profilePromptSkip").addEventListener("click",()=>{$("#profilePromptForm").hidden=true});
const dn=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long"}).format(new Date());$("#dateLabel").textContent=dn;
$("#quickDate").value=localISO();renderAll();
window.addEventListener("load",()=>{
  if("serviceWorker"in navigator)navigator.serviceWorker.getRegistrations().then(list=>list.forEach(reg=>reg.unregister())).catch(()=>{});
  if("caches"in window)caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))).catch(()=>{});
});