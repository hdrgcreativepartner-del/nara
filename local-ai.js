/* NARA local inference controller. No conversation requests leave the device. */
(function(root){
  class LocalAI {
    constructor(makeWorker){this.makeWorker=makeWorker||(()=>new Worker('./local-ai-worker.mjs?v=6.5.1',{type:'module'}));this.worker=null;this.pending=new Map();this.seq=0;this.generation=0;this.status='off';this.model='';this.loading=null;this.busy=false;this.listeners=[];this.watchdog=null}
    onStatus(fn){this.listeners.push(fn);fn({status:this.status,text:'AI lokal belum dimuat.'})}
    notify(status,text,progress){this.status=status;this.listeners.forEach(fn=>fn({status,text,progress}))}
    async supported(){if(!root.navigator?.gpu)return false;let timer;try{return !!(await Promise.race([root.navigator.gpu.requestAdapter(),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),8000)})]))}catch{return false}finally{clearTimeout(timer)}}
    stop(reason='AI lokal dinonaktifkan. Catatan tetap aman.'){
      this.generation++;clearTimeout(this.watchdog);this.watchdog=null;this.worker?.terminate();this.worker=null;this.loading=null;this.busy=false;
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
      this.notify('loading','Memeriksa kemampuan perangkat…');
      const supported=model==='qwen-wasm'?typeof root.WebAssembly==='object':await this.supported();if(generation!==this.generation)throw new Error('Dibatalkan');
      if(!supported){this.notify('unsupported','Mode ini tidak didukung perangkat. Pilih Kompatibel (tanpa WebGPU), atau perbarui Android System WebView/Chrome.');throw new Error('WebGPU tidak tersedia')}
      this.model=model;this.notify('loading','Menghubungkan mesin AI…');
      const arm=()=>{clearTimeout(this.watchdog);this.watchdog=setTimeout(()=>this.stop('Pemuatan berhenti karena tidak ada kemajuan selama 3 menit. Periksa koneksi, lalu coba kembali dengan mode Kompatibel.'),180000)};
      try{this.worker=this.makeWorker()}catch(e){this.stop('Mesin AI tidak dapat dibuka oleh aplikasi ini. Perbarui Android System WebView/Chrome.');throw e}arm();
      this.worker.onmessage=({data})=>{
        if(generation!==this.generation)return;
        if(data.type==='progress'){arm();this.notify('loading',String(data.text||'Memuat model…'),data.progress);return}
        const p=this.pending.get(data.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(data.id);
        data.error?p.reject(new Error(data.error)):p.resolve(data.result);
      };
      this.worker.onerror=()=>this.stop('AI lokal tidak dapat berjalan. Periksa koneksi, memori, atau kompatibilitas browser.');
      try{await this.request('init',{model},15*60*1000);clearTimeout(this.watchdog);this.watchdog=null;if(generation!==this.generation)throw new Error('Dibatalkan');this.notify('ready','AI lokal siap. Percakapan diproses di perangkat.',1)}
      catch(e){if(generation===this.generation)this.stop(e.message||'Model gagal dimuat. Catatan tetap tersedia; kamu bisa mencoba lagi.');throw e}
    }
    async generate(messages){
      if(this.status!=='ready'||this.busy)throw new Error('AI lokal belum siap');const generation=this.generation;this.busy=true;
      try{return await this.request('generate',{messages},this.model==='qwen-wasm'?180000:90000)}catch(e){if(generation===this.generation)this.stop('AI lokal berhenti. Muat ulang model untuk mencoba lagi.');throw e}finally{this.busy=false}
    }
  }
  root.NaraLocalAI=new LocalAI();root.NaraLocalAIClass=LocalAI;
})(globalThis);
