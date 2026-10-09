import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const elements=new Map();
function el(key){
  if(!elements.has(key))elements.set(key,{
    value:"",textContent:"",innerHTML:"",scrollTop:0,scrollHeight:0,style:{},
    classList:{toggle(){},add(){},remove(){}},
    addEventListener(){},focus(){},showModal(){},close(){},reset(){},
    closest(){return null}
  });
  return elements.get(key);
}
const document={
  querySelector:s=>el(s),
  querySelectorAll:()=>[],
  addEventListener(){}
};
const localStorage={data:{},getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=v}};
const window={scrollTo(){},addEventListener(){}};
const context=vm.createContext({
  console,document,localStorage,window,navigator:{},Intl,Date,Math,Number,String,Array,Object,JSON,RegExp,
  setTimeout:(fn)=>fn(),requestAnimationFrame:(fn)=>fn(),alert(){},
});
context.globalThis=context;

const code=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
vm.runInContext(code,context,{filename:"app.js"});

function reset(){
  vm.runInContext(`state.transactions.length=0;state.liabilities.length=0;state.receivables.length=0;state.reminders.length=0;state.notes.length=0;state.habits.length=0;state.goals.length=0;state.pending=null;state.lastCreated=null;state.conversation=null;`,context);
}
function run(input){return vm.runInContext(`smartResponse(${JSON.stringify(input)})`,context)}
function get(expr){return vm.runInContext(expr,context)}

reset();
run('Aku tadi bayar komisi');
assert.equal(get('state.transactions.length'),0);
assert.equal(get('state.pending.kind'),'finance-amount');
run('50rb');
assert.equal(get('state.transactions.length'),1);
assert.equal(get('state.transactions[0].amount'),50000);
run('eh ralat 75rb');
assert.equal(get('state.transactions.length'),1);
assert.equal(get('state.transactions[0].amount'),75000);
run('itu pemasukan');
assert.equal(get('state.transactions[0].type'),'income');
run('yang tadi kemarin');
assert.equal(get('state.transactions[0].date'),get('addDays(-1)'));
run('bayar bensin 20rb di toko itu');
assert.equal(get('state.transactions.length'),2,'New complete transaction must start a fresh context');
assert.equal(get('state.transactions[0].amount'),75000);

reset();
run('Terima pembayaran proyek branding');run('1500000');
assert.equal(get('state.transactions[0].type'),'income');
assert.equal(get('state.transactions[0].amount'),1500000);

reset();
run('aku hutang ke Ibu');run('lima puluh ribu');run('Pinjaman masuk kas');
assert.equal(get('state.liabilities[0].amount'),50000);
assert.equal(get('cashBalance()'),50000);

reset();
run('ingatkan rapat dengan tim');run('Senin jam 9 pagi');
assert.equal(get('state.reminders.length'),1,'Date and time in one reply must complete the draft');
assert.equal(get('state.reminders[0].time'),'09:00');
run('tempatnya di kantor');
assert.equal(get('state.reminders[0].location'),'kantor');
run('pindah ke besok jam 3 sore');
assert.equal(get('state.reminders.length'),1);
assert.equal(get('state.reminders[0].date'),get('addDays(1)'));
assert.equal(get('state.reminders[0].time'),'15:00');

reset();
run('Besok sore rapat');run('jam 9 malam');
assert.equal(get('state.reminders[0].time'),'21:00','The explicit daypart in a followup must override the draft');

reset();
run('Catat ide: buat portofolio baru');run('tambahkan: tampilkan video event');
assert.equal(get('state.notes.length'),1);
assert.match(get('state.notes[0].body'),/Tampilkan video event/);
run('Catat ide: pakai konsep itu untuk logo');
assert.equal(get('state.notes.length'),2);

reset();
run('Target bulan ini buat website');run('tambahkan langkah beli domain');
assert.equal(get('state.goals.length'),1);
assert.equal(get('state.goals[0].steps[0].title'),'Beli domain');

reset();
run('bayar bensin 20rb');run('beli makan 30rb');
const summary=run('berapa pengeluaran hari ini?');
assert.match(summary.text,/50.000/);
assert.equal(get('state.transactions.length'),2,'Queries must not create new records');
run('bukan bayar komisi 50rb');run('belum beli laptop 5 juta');run('kalau beli laptop 5 juta gimana?');
assert.equal(get('state.transactions.length'),2,'Negated or hypothetical transactions must not be recorded');

reset();
run('ingatkan rapat');run('bayar bensin 20rb');
assert.equal(get('state.transactions.length'),1,'New topic must escape an incomplete reminder');
assert.equal(get('state.pending'),null);

reset();
run('500rb untuk proyek');run('Pemasukan');
assert.equal(get('state.transactions[0].type'),'income');
run('50rb buat sesuatu');run('Batal');
assert.equal(get('state.pending'),null);
assert.equal(get('state.transactions.length'),1,'Cancel must preserve saved records');

reset();
run('catat ide: desain logo');run('catat ide: buat video');run('lihat catatan');
const ambiguous=run('ubah judulnya jadi konsep baru');
assert.equal(ambiguous.actions.length,2,'An ambiguous edit must offer explicit record selection');
assert.match(get('state.notes[0].title'),/Desain logo/i);
run(ambiguous.actions[0]);run('ganti judul jadi konsep baru');
assert.equal(get('state.notes[0].title'),'Konsep baru');
assert.match(get('state.notes[1].title'),/Buat video/i);

reset();
run('bayar bensin 20rb');
vm.runInContext('state.conversation.at-=31*60*1000',context);
run('ralat 50rb');
assert.equal(get('state.transactions[0].amount'),20000,'Expired context must never silently edit an old record');

reset();
run('Assalamualaikum Nara');run('matur nuwun');
assert.equal(get('state.pending'),null);
for(const [phrase,amount] of [['bayar komisi lima puluh ribu',50000],['terima satu juta',1000000],['beli alat dua ratus lima puluh ribu',250000],['tuku bensin seket ewu',50000],['terima 1.5jt',1500000],['terima 1,5 juta',1500000],['terima setengah juta',500000]]){
 reset();run(phrase);assert.equal(get('state.transactions[0].amount'),amount,phrase);
}
reset();run('Aku beli beras');run('di pasar');run('Rp50.000');assert.equal(get('state.transactions[0].amount'),50000);assert.match(get('state.transactions[0].title'),/pasar/);
reset();run('ingatkan rapat');run('dengan Pak Budi');run('besok');run('besoknya lusa');run('jam 8 pagi');assert.match(get('state.reminders[0].title'),/Budi/);assert.equal(get('state.reminders[0].date'),get('addDays(2)'));
reset();run('bayar bensin 20rb');run('itu 25rb untuk bensin');assert.equal(get('state.transactions.length'),1);assert.equal(get('state.transactions[0].amount'),25000);run('beli kabel salah warna 50rb');assert.equal(get('state.transactions.length'),2);
reset();run('aku mau beli laptop 5 juta');assert.equal(get('state.transactions.length'),0);run('Jadikan target');assert.equal(get('state.goals.length'),1);run('aku batal beli laptop 5 juta');assert.equal(get('state.transactions.length'),0);
reset();run('catat ide: desain logo');run('bayar bensin 20rb');run('ubah judul catatan desain logo jadi identitas brand');assert.equal(get('state.notes[0].title'),'Identitas brand');assert.equal(get('state.transactions[0].amount'),20000);
reset();const queuedTimers=[];context.setTimeout=fn=>queuedTimers.push(fn);vm.runInContext("voiceSession=true;sendText('bayar komisi');voiceSession=false;sendText('50rb');sendText('ralat 75rb')",context);while(queuedTimers.length)queuedTimers.shift()();assert.equal(get('state.transactions.length'),1);assert.equal(get('state.transactions[0].amount'),75000);
console.log('NARA contextual conversations passed: followups, corrections, language, summaries, topic changes, ambiguous references and stale context.');

// Explicit notes preserve their entire body and never create financial side effects.
reset();
const noteInput='Tolong catat, untuk membuat web aplikasi seperti median.co yang bisa merubah web ke apk android, dan web ke exe software windows';
const noteReply=run(noteInput);
assert.equal(get('state.notes.length'),1);
assert.equal(get('state.notes[0].sourceText'),noteInput);
assert.match(get('state.notes[0].body'),/median\.co.*apk android, dan web ke exe software windows/i);
assert.doesNotMatch(noteReply.text,/belum yakin/);
assert.equal(get('state.pending'),null);
reset();
run('Catat: video untuk proyek, biaya beli laptop 15 juta. Besok rapat jam 10.');
assert.equal(get('state.notes.length'),1);
assert.match(get('state.notes[0].body'),/^Video untuk proyek, biaya beli laptop 15 juta\. Besok rapat jam 10\./);
assert.equal(get('state.transactions.length'),0);
assert.equal(get('state.reminders.length'),0);
reset();
run('Jadikan catatan');
assert.equal(get('state.notes.length'),0);
assert.equal(get('state.pending.kind'),'note-content');
run('Kalau beli laptop, jangan bayar dahulu.\nBandingkan video ulasan.');
assert.equal(get('state.notes.length'),1);
assert.match(get('state.notes[0].body'),/dahulu\.\nBandingkan video/);
reset();
run('Aku berencana beli laptop');
run('Jadikan catatan');
assert.equal(get('state.notes.length'),1);
assert.match(get('state.notes[0].body'),/laptop/);
console.log('Explicit note regression checks passed');

reset();
run('Tolong simpan ini sebagai catatan: video aplikasi, Android dan Windows.');
assert.match(get('state.notes[0].body'),/^Video aplikasi, Android dan Windows\./);
run('tambahkan dukungan offline');
assert.equal(get('state.notes.length'),1);
assert.match(get('state.notes[0].body'),/Dukungan offline/);
reset();
run('Buatkan catatan tentang proyek web, biaya beli server 50rb.');
assert.equal(get('state.notes.length'),1);
assert.equal(get('state.transactions.length'),0);
vm.runInContext('state.pending={kind:"intent-choice",source:"Topik lain"}',context);
vm.runInContext('smartResponse("Jadikan catatan","Ide asli dari pesan sebelumnya")',context);
assert.match(get('state.notes[1].body'),/Asli dari pesan sebelumnya/i);
console.log('Note aliases, continued context and source-bound actions passed');

for(const input of ['Beli rokok, biskuit, korek 38 rb','Aku beli rokok, biskuit, dan korek seharga 38 rb']){
  reset();const reply=run(input);
  assert.equal(get('state.transactions.length'),1);
  assert.equal(get('state.transactions[0].type'),'expense');
  assert.equal(get('state.transactions[0].amount'),38000);
  assert.match(get('state.transactions[0].title'),/rokok.*biskuit.*korek/i);
  assert.doesNotMatch(reply.text,/belum yakin/);
}
reset();run('Beli rokok dan korek 38rb, bayar bensin 20rb');
assert.equal(get('state.transactions.length'),2);
assert.equal(get('state.transactions[0].amount'),38000);
assert.equal(get('state.transactions[1].amount'),20000);
console.log('Shopping lists with one total and independent transactions passed');

reset();
vm.runInContext('createLiability("Pinjam uang dari Ibu 35rb",35000);createLiability("Pinjam uang dari Ibu 65rb",65000);createLiability("Pinjam uang dari Budi 20rb",20000)',context);
const paidReply=run('Bayar hutang ke ibu 100rb');
assert.equal(get('state.liabilities[0].remaining'),0);
assert.equal(get('state.liabilities[1].remaining'),0);
assert.equal(get('state.liabilities[2].remaining'),20000);
assert.equal(get('state.transactions.filter(t=>t.type==="debt_payment").reduce((s,t)=>s+t.amount,0)'),100000);
assert.match(paidReply.text,/100\.000.*2 hutang/);
assert.match(paidReply.text,/Sisa seluruh hutang kepada Ibu: Rp\s*0/);
run('Bayar hutang ke Ayah 10rb');
assert.equal(get('state.liabilities[2].remaining'),20000);
reset();
vm.runInContext('createLiability("Pinjam uang dari Ibu",35000);createLiability("Pinjam uang dari Ibu",65000)',context);
run('Bayar hutang ke Ibu 50rb');
assert.equal(get('openLiabilityTotal()'),50000);
assert.equal(get('cashBalance()'),50000);
assert.match(run('Bayar hutang ke Ibu 100rb').text,/kelebihannya belum dicatat/);
assert.equal(get('cashBalance()'),50000);
reset();
vm.runInContext('createLiability("Pinjam uang dari Ibu",35000);createLiability("Pinjam uang dari Budi",65000)',context);
assert.match(run('Bayar hutang 50rb').text,/kepada siapa/);
assert.equal(get('openLiabilityTotal()'),100000);
console.log('Multi-debt payments, partial allocation, excess and creditor ambiguity passed');

reset();
run('hutang A 5rb');run('hutang A 19rb');run('bayar hutang ke A 5rb');
assert.equal(get('openLiabilityTotal()'),19000);
assert.equal(get('cashBalance()'),-5000,'Opening debt must not invent cash income');
assert.match(run('coba cek lagi').text,/19\.000/);
get('deleteLedgerTransaction(state.transactions.find(t=>t.type==="debt_payment").id)');
assert.equal(get('openLiabilityTotal()'),24000);
assert.equal(get('cashBalance()'),0);
assert.equal(get('updateLedgerTransaction(state.transactions[0].id,{amount:10000})'),null);
assert.equal(get('openLiabilityTotal()'),29000);
run('bayar hutang ke A 7rb');
assert.equal(get('openLiabilityTotal()'),22000);
run('ralat 8rb');
assert.equal(get('openLiabilityTotal()'),21000);
assert.equal(get('cashBalance()'),-8000);
const beforeExcess=get('JSON.stringify(state.transactions)');
assert.match(run('bayar hutang ke A 100rb').text,/Pembayaran belum dicatat/);
assert.equal(get('JSON.stringify(state.transactions)'),beforeExcess);
assert.match(get('updateLedgerTransaction(state.transactions[0].id,{amount:1000})'),/melebihi/);
assert.equal(get('openLiabilityTotal()'),21000);
get('deleteLedgerTransaction(state.transactions[0].id)');
assert.equal(get('openLiabilityTotal()'),19000);
assert.equal(get('cashBalance()'),0);
assert.equal(get('state.transactions.length'),1);
get('deleteLedgerTransaction(state.transactions[0].id)');
assert.equal(get('openLiabilityTotal()'),0);
assert.equal(get('state.liabilities.length'),0);

reset();run('hutang A 5rb, hutang A 19rb, bayar hutang ke A 5rb');
assert.equal(get('openLiabilityTotal()'),19000);
assert.equal(get('state.liabilities.length'),2);
reset();run('hutang A 5rb');run('ralat 8rb');
assert.equal(get('openLiabilityTotal()'),8000);
reset();run('aku nyilih duwit nang Ibu limang ewu');run('Pinjaman masuk kas');
assert.equal(get('openLiabilityTotal()'),5000);
run('aku mbayar utang nang Ibu rong ewu');
assert.equal(get('openLiabilityTotal()'),3000);
run('coba cek maneh');assert.equal(get('openLiabilityTotal()'),3000);
reset();run('aku ora utang nang Ibu limang ewu');
assert.equal(get('state.liabilities.length'),0);
run('hutang A 5rb besok');assert.equal(get('state.liabilities.length'),0);
reset();run('Aku beli rokok, biskuit, dan korek seharga 38 rb');
assert.doesNotMatch(get('state.transactions[0].title'),/seharga/);

reset();
get('state.liabilities.push({id:"old",title:"Hutang lama",amount:10000,remaining:7000,done:false})');
get('reconcileLedger()');get('reconcileLedger()');
assert.equal(get('state.transactions.length'),1,'Migration must be idempotent');
assert.equal(get('openLiabilityTotal()'),7000);
get('deleteLedgerTransaction(state.transactions[0].id)');
assert.equal(get('openLiabilityTotal()'),0);
reset();get('createReceivable("Piutang ke Ani",20000)');
run('Ani bayar dari Ani 5rb');
assert.equal(get('openReceivableTotal()'),15000);
get('deleteLedgerTransaction(state.transactions.find(t=>t.type==="receivable_payment").id)');
assert.equal(get('openReceivableTotal()'),20000);
get('save()');get('Object.assign(state,load())');
assert.equal(get('openReceivableTotal()'),20000,'Reload preserves ledger');
console.log('Ledger reconciliation, CRUD, reload, migration, A debts, Jawa and excess validation passed');

// Screenshot regression: stale card says 65k although both payments exist.
reset();get('createLiability("Pinjam uang dari Ibu",35000);createLiability("Pinjam uang dari Ibu",65000)');
run('bayar hutang ke Ibu 100rb');
get('state.liabilities[1].remaining=65000;state.liabilities[1].done=false');
get('renderFinance()');
assert.match(el('#liabilityTotal').textContent,/Rp\s*0/);
assert.equal(get('state.liabilities.filter(x=>!x.done).length'),0);
assert.match(run('coba cek lagi').text,/pokok hutang Rp\s*100\.000, pembayaran Rp\s*100\.000, sisa Rp\s*0/);

reset();
assert.equal(get('validateAIProposal({kind:"delete",title:"semua"})'),null);
assert.equal(get('validateAIProposal({kind:"expense",title:"Kopi",amount:-1})'),null);
assert.equal(get('validateAIProposal({kind:"expense",title:"Kopi",amount:1.5})'),null);
assert.equal(get('validateAIProposal({kind:"reminder",title:"Rapat",date:"2026-02-31",time:"08:00"})'),null);
assert.throws(()=>get('parseLocalAIReply("not-json","source")'));
get('state.messages.push({id:"draft",role:"assistant",text:"Usulan",aiProposal:{id:"p",kind:"expense",title:"Kopi",amount:12000,source:"kopi"}})');
assert.equal(get('state.transactions.length'),0,'Model output must not save');
assert.equal(get('commitAIProposal("draft",{kind:"expense",title:"Kopi",amount:12000})'),null);
assert.equal(get('state.transactions.length'),1);
assert.match(get('commitAIProposal("draft",{kind:"expense",title:"Kopi",amount:12000})'),/sudah disimpan/);
assert.equal(get('state.transactions.length'),1,'Double confirmation must not duplicate');
reset();run('hutang A 5rb');get('save()');
get('state.messages.push({id:"paydraft",role:"assistant",text:"Usulan",aiProposal:{id:"p",source:"bayar"}})');
assert.match(get('commitAIProposal("paydraft",{kind:"debt_payment",title:"Bayar A",party:"A",amount:6000})'),/belum dicatat/);
assert.equal(get('openLiabilityTotal()'),5000);
assert.equal(get('commitAIProposal("paydraft",{kind:"debt_payment",title:"Bayar A",party:"A",amount:2000})'),null);
assert.equal(get('openLiabilityTotal()'),3000);
// Storage failure rolls back the entire latest mutation, including success messages.
get('save()');const durableTransactions=get('JSON.stringify(state.transactions)');
const originalSet=localStorage.setItem;localStorage.setItem=()=>{throw Error('QuotaExceededError')};
run('beli laptop 8 juta');assert.equal(get('save()'),false);
assert.equal(get('JSON.stringify(state.transactions)'),durableTransactions);
assert.match(get('state.messages.at(-1).text'),/belum disimpan/);
localStorage.setItem=originalSet;
console.log('Screenshot stale-card repair, untrusted AI drafts, confirmation, duplicate guard and storage rollback passed.');
