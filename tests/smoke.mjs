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
  vm.runInContext(`state.transactions.length=0;state.reminders.length=0;state.notes.length=0;state.habits.length=0;state.goals.length=0;`,context);
}
function run(input){return vm.runInContext(`process(${JSON.stringify(input)})`,context)}
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

console.log("NARA smoke tests passed: finance, reminder, notes, habits/goals, mixed chat.");
