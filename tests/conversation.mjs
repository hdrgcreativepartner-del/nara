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
