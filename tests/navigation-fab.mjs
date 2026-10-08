import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const elements=new Map();
const timers=[];
function element(id){
  const classes=new Set();
  const listeners=new Map();
  return {id,dataset:{},hidden:false,style:{},value:'',textContent:'',innerHTML:'',
    classList:{toggle(c,on){on?classes.add(c):classes.delete(c)},add(c){classes.add(c)},remove(c){classes.delete(c)},contains(c){return classes.has(c)}},
    addEventListener(name,fn){listeners.set(name,fn)},emit(name,e={}){listeners.get(name)?.(e)},
    setAttribute(){},focus(){},showModal(){},close(){},reset(){},scrollTo(){},closest(){return null},
    getBoundingClientRect(){return {left:318,right:374,top:650,bottom:706,width:56,height:56}},
    setPointerCapture(){},releasePointerCapture(){}
  };
}
const document={querySelector(s){if(!elements.has(s))elements.set(s,element(s));return elements.get(s)},querySelectorAll(){return []},addEventListener(){}};
const context=vm.createContext({document,window:{innerWidth:390,innerHeight:800,scrollTo(){},addEventListener(){}},innerWidth:390,navigator:{},localStorage:{getItem(){return null},setItem(){}},setTimeout(fn){timers.push(fn)},requestAnimationFrame(){},console,alert(){}});
vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),context);
const names=['chat','today','finance','notes','goals','account'];
const pages=names.map(name=>element('page-'+name));
pages[0].classList.add('active');
const navs=names.flatMap(page=>[0,1].map(()=>Object.assign(element('nav'),{dataset:{page}})));
const body={appendChild(fab){fab.parentElement=this}};
document.body=body;
const fabs=names.slice(1,5).map(page=>{
  const fab=element(page+'Fab');fab.dataset.action=page==='notes'?'note':page==='goals'?'target':'expense';
  fab.parentElement=pages[names.indexOf(page)];fab.closest=()=>pages[names.indexOf(page)];return fab;
});
document.querySelectorAll=s=>s==='.page'?pages:s==='.navbtn[data-page]'?navs:s==='.page-fab'?fabs:s==='body > .page-fab'?fabs.filter(f=>f.parentElement===body):[];
const query=document.querySelector.bind(document);
document.querySelector=s=>s==='.page.active'?pages.find(p=>p.classList.contains('active')):query(s);
vm.runInContext('initPageFabs()',context);
assert.ok(fabs.every(f=>f.parentElement===body&&f.hidden),'FABs must be portaled and hidden in chat');
for(const page of [...names,...names.toReversed()]){
  vm.runInContext(`go('${page}')`,context);
  assert.deepEqual(pages.filter(p=>p.classList.contains('active')).map(p=>p.id),['page-'+page]);
  assert.equal(navs.filter(n=>n.classList.contains('active')).length,2);
  assert.deepEqual(fabs.filter(f=>!f.hidden).map(f=>f.dataset.pageOwner),['chat','account'].includes(page)?[]:[page]);
}
vm.runInContext("go('finance')",context);
const fab=fabs[1];
const pointer={button:0,pointerId:1,clientX:340,clientY:680,preventDefault(){}};
fab.emit('pointerdown',pointer);
fab.emit('pointermove',{...pointer,clientX:180,clientY:380});
assert.match(fab.style.transform,/translate3d\(-160px,-300px,0\)/);
assert.ok(fab.classList.contains('dragging'));
fab.emit('pointerup',pointer);
assert.equal(fab.style.transform,'translate3d(0,0,0) scale(1)');
assert.ok(fab.classList.contains('returning'));
let suppressed=false;
fab.emit('click',{preventDefault(){suppressed=true},stopImmediatePropagation(){}});
assert.ok(suppressed,'Dragging must not open an add dialog');
fab.emit('pointerdown',pointer);fab.emit('pointermove',{...pointer,clientX:120,clientY:400});fab.emit('pointercancel',pointer);
assert.equal(fab.style.transform,'translate3d(0,0,0) scale(1)');
fab.emit('pointerdown',pointer);fab.emit('lostpointercapture');
assert.equal(fab.style.transform,'translate3d(0,0,0) scale(1)');
suppressed=false;fab.emit('pointerdown',pointer);fab.emit('pointerup',pointer);fab.emit('click',{preventDefault(){suppressed=true},stopImmediatePropagation(){}});
assert.equal(suppressed,false,'A tap must still open the add dialog');
fab.emit('pointerdown',pointer);fab.emit('pointermove',{...pointer,clientX:120,clientY:400});vm.runInContext("go('notes');go('finance')",context);assert.equal(fab.style.transform,'');assert.equal(fab.classList.contains('dragging'),false,'Changing pages during drag must reset the hidden button');
console.log('NARA navigation and FAB behavior passed: all pages, visibility, drag, snap-back, cancellation and tap.');
