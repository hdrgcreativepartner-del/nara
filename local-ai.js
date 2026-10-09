/* NARA local inference controller. No conversation requests leave the device. */
(function(root){
  class LocalAI {
    constructor(makeWorker){this.makeWorker=makeWorker||(()=>new Worker('./local-ai-worker.mjs?v=6.5.0',{type:'module'}));this.worker=null;this.pending=new Map();this.seq=0;this.generation=0;this.status='off';this.model='';this.loading=null;this.busy=false;this.listeners=[]}
    onStatus(fn){this.listeners.push(fn);fn({status:this.status,text:'AI lokal belum dimuat.'})}
    notify(status,text,progress){this.status=status;this.listeners.forEach(fn=>fn({status,text,progress}))}
    async supported(){if(!root.navigator?.gpu)return false;try{return !!(await root.navigator.gpu.requestAdapter())}catch{return false}}
    stop(reason='AI lokal dinonaktifkan. Catatan tetap aman.'){
      this.generation++;this.worker?.terminate();this.worker=null;this.loading=null;this.busy=false;
      for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(reason))}this.pending.clear();this.notify('off',reason);
    }
    request(type,payload,timeout){
      return new Promise((resolve,reject)=>{
        const id=++this.seq;
        const timer=setTimeout(()=>{this.stop('AI lokal melewati batas waktu. Coba muat ulang atau gunakan mode pencatatan biasa.');},timeout);
        this.pending.set(id,{resolve,reject,timer});
        try{this.worker.postMessage({id,type,...payload})}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e)}
      });
    }
    async load(model){
      if(this.status==='ready'&&this.model===model)return;
      if(this.loading)return this.loading;
      this.stop();const generation=this.generation,promise=this.start(model,generation);this.loading=promise;try{await promise}finally{if(this.loading===promise)this.loading=null}
    }
    async start(model,generation){
      const supported=await this.supported();if(generation!==this.generation)throw new Error('Dibatalkan');
      if(!supported){this.notify('unsupported','Perangkat/browser ini belum mendukung AI lokal WebGPU. Pencatatan NARA tetap tersedia.');throw new Error('WebGPU tidak tersedia')}
      this.model=model;this.notify('loading','Mengunduh atau memuat model. Unduhan awal dapat memakan beberapa menit.',0);
      this.worker=this.makeWorker();
      this.worker.onmessage=({data})=>{
        if(data.type==='progress'){this.notify('loading',String(data.text||'Memuat model…'),data.progress);return}
        const p=this.pending.get(data.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(data.id);
        data.error?p.reject(new Error(data.error)):p.resolve(data.result);
      };
      this.worker.onerror=()=>this.stop('AI lokal tidak dapat berjalan. Periksa koneksi, memori, atau kompatibilitas browser.');
      try{await this.request('init',{model},15*60*1000);if(generation!==this.generation)throw new Error('Dibatalkan');this.notify('ready','AI lokal siap. Percakapan diproses di perangkat.',1)}
      catch(e){if(generation===this.generation)this.stop('Model gagal dimuat. Catatan tetap tersedia; kamu bisa mencoba lagi.');throw e}
    }
    async generate(messages){
      if(this.status!=='ready'||this.busy)throw new Error('AI lokal belum siap');const generation=this.generation;this.busy=true;
      try{return await this.request('generate',{messages},90000)}catch(e){if(generation===this.generation)this.stop('AI lokal berhenti. Muat ulang model untuk mencoba lagi.');throw e}finally{this.busy=false}
    }
  }
  root.NaraLocalAI=new LocalAI();root.NaraLocalAIClass=LocalAI;
})(globalThis);
