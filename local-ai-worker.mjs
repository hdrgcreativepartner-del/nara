// Runtime/model assets are downloaded; messages are processed only in this worker.
const RUNTIME='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/lib/index.js';
const CPU_RUNTIME='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const MODELS=new Set(['Qwen2.5-0.5B-Instruct-q4f32_1-MLC','Qwen2.5-1.5B-Instruct-q4f32_1-MLC']);
let engine,pipe,mode;
const progress=(text,value)=>self.postMessage({type:'progress',text,progress:value});
self.onmessage=async({data})=>{
  const {id,type}=data;
  try{
    if(type==='init'){
      mode=data.model==='qwen-wasm'?'cpu':'gpu';
      if(mode==='cpu'){
        progress('1/3 · Memuat mesin AI kompatibel…');
        const {pipeline,env}=await import(CPU_RUNTIME);
        env.allowLocalModels=false;
        // Single thread avoids SharedArrayBuffer/COOP requirements in embedded WebViews.
        env.backends.onnx.wasm.numThreads=1;
        env.backends.onnx.wasm.proxy=false;
        progress('2/3 · Menyiapkan unduhan Qwen 0.5B. Tetap buka aplikasi ini.');
        pipe=await pipeline('text-generation','onnx-community/Qwen2.5-0.5B-Instruct',{
          device:'wasm',dtype:'q4',progress_callback:p=>{
            if(p.status==='progress')progress('2/3 · '+String(p.file||'Model')+' · '+Math.round(p.progress||0)+'%'+(p.total?' ('+Math.round(p.loaded/1048576)+' / '+Math.round(p.total/1048576)+' MB)':''),(p.progress||0)/100);
            else if(p.status==='done')progress('3/3 · Menyiapkan model di memori. Ini dapat memakan beberapa menit.');
            else if(p.status==='initiate')progress('2/3 · Mengambil '+String(p.file||'berkas model')+'…');
          }
        });
      }else{
        if(!MODELS.has(data.model))throw new Error('Model tidak dikenal');
        if(!self.navigator?.gpu||!await self.navigator.gpu.requestAdapter())throw new Error('GPU_UNAVAILABLE');
        progress('1/3 · Memuat mesin AI GPU…');
        const {CreateMLCEngine}=await import(RUNTIME);
        progress('2/3 · Memuat model GPU…');
        engine=await CreateMLCEngine(data.model,{initProgressCallback:p=>progress(p.text,p.progress)},{context_window_size:4096});
      }
      self.postMessage({id,result:true});
    }else if(type==='generate'){
      let text;
      if(mode==='cpu'&&pipe){
        const output=await pipe(data.messages,{max_new_tokens:192,do_sample:false,return_full_text:false});
        const generated=output[0]?.generated_text;
        text=typeof generated==='string'?generated:generated?.at(-1)?.content;
      }else if(engine){
        const reply=await engine.chat.completions.create({messages:data.messages,max_tokens:420,temperature:0.2,response_format:{type:'json_object'}});
        text=reply.choices?.[0]?.message?.content;
      }
      if(typeof text!=='string')throw new Error('Respons kosong');
      self.postMessage({id,result:text});
    }
  }catch(error){
    const message=String(error?.message||'');
    const reason=message.includes('GPU_UNAVAILABLE')?'GPU di aplikasi ini tidak tersedia. Pilih mode Kompatibel (tanpa WebGPU).':/fetch|network|download|HTTP|import/i.test(message)?'Unduhan tidak berhasil. Periksa koneksi dan akses aplikasi ke penyedia model; lalu coba lagi.':/memory|alloc|out of|buffer|quota/i.test(message)?'Memori atau penyimpanan tidak cukup. Tutup aplikasi lain lalu coba mode Kompatibel.':'Mesin AI gagal dijalankan. Coba mode Kompatibel dan perbarui Android System WebView/Chrome.';
    self.postMessage({id,error:type==='init'?reason:'AI belum dapat menjawab. Coba kalimat lebih singkat; data tidak diubah.'});
  }
};
