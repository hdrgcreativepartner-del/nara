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
  vm.runInContext(`state.transactions.length=0;state.reminders.length=0;state.notes.length=0;state.habits.length=0;state.goals.length=0;state.pending=null;state.lastCreated=null;`,context);
}
function run(input){return vm.runInContext(`smartResponse(${JSON.stringify(input)})`,context)}
function get(expr){return vm.runInContext(expr,context)}

reset();
run("Hari ini pengeluaran 100 ribu untuk bensin");
assert.equal(get("state.transactions.length"),1);
assert.equal(get("state.transactions[0].amount"),100000);
assert.equal(get("state.transactions[0].type"),"expense");
assert.equal(get("state.transactions[0].category"),"Transport");

reset();
run("Besok jam 10 meeting dengan Pak Budi");
assert.equal(get("state.reminders.length"),1);
assert.equal(get("state.reminders[0].time"),"10:00");

reset();
run("Catat ide: belajar NovaLCT lebih dalam");
assert.equal(get("state.notes.length"),1);
assert.match(get("state.notes[0].body"),/NovaLCT/i);

reset();
run("Bulan ini rutin sholat, olahraga 3 kali seminggu, belajar hal baru");
assert.equal(get("state.habits.length"),3);
assert.equal(get("state.goals.length"),3);
assert.equal(get("state.habits.find(h=>h.name==='Olahraga').target"),3);

reset();
run("Hari ini bensin 50 ribu, besok jam 9 meeting dengan Budi, catat ide: fitur auto mapping");
assert.equal(get("state.transactions.length"),1);
assert.equal(get("state.reminders.length"),1);
assert.equal(get("state.notes.length"),1);

reset();
run("Bensin 50 ribu dan makan 35 ribu");
assert.equal(get("state.transactions.length"),2);
assert.equal(get("state.transactions[0].amount"),50000);
assert.equal(get("state.transactions[1].amount"),35000);

reset();
run("Tadi terima pembayaran 2 juta. Besok jam 3 kirim revisinya.");
assert.equal(get("state.transactions.length"),1);
assert.equal(get("state.transactions[0].type"),"income");
assert.equal(get("state.reminders.length"),1);
assert.equal(get("state.reminders[0].time"),"03:00");

reset();
run("Hari ini pengeluaran 100 ribu untuk bensin dan makan");
assert.equal(get("state.transactions.length"),1);
assert.equal(get("state.transactions[0].amount"),100000);

reset();
run("Besok jam 10 meeting dengan Pak Budi");
vm.runInContext("renderToday()",context);
assert.match(elements.get("#todayAgenda").innerHTML,/Pak Budi/i);
assert.match(elements.get("#todayAgenda").innerHTML,/reminder-done/);

reset();
run("Besok bayar internet 350 ribu");
assert.equal(get("state.transactions.length"),0);
assert.equal(get("state.reminders.length"),1);
assert.equal(get("state.reminders[0].kind"),"bill");
assert.equal(get("state.reminders[0].amount"),350000);
run("Internet sudah dibayar");
assert.equal(get("state.reminders[0].done"),true);
assert.equal(get("state.transactions.length"),1);
assert.equal(get("state.transactions[0].amount"),350000);

reset();
run("Client bayar 2 juta untuk desain");
assert.equal(get("state.transactions.length"),1);
assert.equal(get("state.transactions[0].type"),"income");
assert.equal(get("state.transactions[0].amount"),2000000);

reset();
run("besok aku");
assert.equal(get("state.reminders.length"),0);

reset();
run("Ingatkan aku besok sore harus ke Jember, review buku dummy 18.00 WIB kemudian pukul 20.00 aku loading LED");
assert.ok(get("state.reminders.length")>=2);
assert.ok(get("state.reminders.every(r=>r.date===state.reminders[0].date)"));
assert.ok(get("state.reminders.some(r=>r.time==='18:00')"));
assert.ok(get("state.reminders.some(r=>r.time==='20:00')"));

reset();
let q=run("hari ini aku sore ke jember");
assert.equal(get("state.reminders.length"),0);
assert.equal(get("state.pending.kind"),"reminder-time");
assert.match(q.text,/Jam berapa/i);
run("16:00");
assert.equal(get("state.pending"),null);
assert.equal(get("state.reminders.length"),1);
assert.equal(get("state.reminders[0].time"),"16:00");
assert.match(get("state.reminders[0].title"),/Jember/i);
assert.equal(get("state.reminders[0].leadMinutes"),30);

reset();
run("catat aku nemuin mas nursalim untuk review buku dummy");
assert.equal(get("state.notes.length"),1);
assert.match(get("state.notes[0].body"),/Temui Mas Nursalim/i);

reset();
run("besok jam 10 rapat dengan tim");
assert.equal(get("state.reminders[0].date"),get("addDays(1)"));
run("salah maksudnya hari ini");
assert.equal(get("state.reminders[0].date"),get("localISO()"));

console.log("NARA smoke tests passed: finance, contextual clarification, paraphrase, correction, reminders, notes, habits/goals and agenda.");

reset();
let rTime=run("ingatkan aku rapat jam 9 malam");
assert.equal(get("state.reminders.length"),0);
assert.equal(get("state.pending.kind"),"agenda-date");
run("Hari ini");
assert.equal(get("state.reminders.length"),1);
assert.equal(get("state.reminders[0].time"),"21:00");

reset();
run("ingatkan aku hari ini berangkat jam 7 pagi");
assert.equal(get("state.reminders[0].time"),"07:00");

reset();
run("ingatkan aku hari ini makan siang jam 1 siang");
assert.equal(get("state.reminders[0].time"),"13:00");

reset();
run("ingatkan aku hari ini meeting setengah 9 malam");
assert.equal(get("state.reminders[0].time"),"20:30");

reset();
run("ingatkan aku hari ini telepon klien 9 malam");
assert.equal(get("state.reminders[0].time"),"21:00");

reset();
run("ingatkan aku hari ini rapat jam sembilan malam");
assert.equal(get("state.reminders[0].time"),"21:00");

reset();
const unknown=run("aku lagi bingung hari ini");
assert.equal(get("state.notes.length"),0);
assert.equal(get("state.reminders.length"),0);
assert.equal(get("state.pending.kind"),"intent-choice");
assert.match(unknown.text,/belum yakin/i);
run("Tidak perlu disimpan");
assert.equal(get("state.pending"),null);

reset();
run("aku harus meeting dengan Andi");
assert.equal(get("state.reminders.length"),0);
assert.equal(get("state.pending.kind"),"agenda-date");

reset();
let tg=run("Target bulan ini, menyelesaikan Portofolio HDRG Creative Partner");
assert.equal(get("state.goals.length"),1);
assert.match(get("state.goals[0].title"),/Portofolio HDRG Creative Partner/i);
assert.equal(get("state.goals[0].period"),"monthly");
assert.equal(get("state.notes.length"),0);
assert.equal(get("state.reminders.length"),0);
