// Pinned runtime; downloaded only when the user enables local AI.
const RUNTIME='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/lib/index.js';
const MODELS=new Set(['Qwen2.5-0.5B-Instruct-q4f32_1-MLC','Qwen2.5-1.5B-Instruct-q4f32_1-MLC']);
let engine;
self.onmessage=async({data})=>{
  const {id,type}=data;
  try{
    if(type==='init'){
      if(!MODELS.has(data.model))throw new Error('Model tidak dikenal');
      const {CreateMLCEngine}=await import(RUNTIME);
      engine=await CreateMLCEngine(data.model,{initProgressCallback:p=>self.postMessage({type:'progress',progress:p.progress,text:p.text})},{context_window_size:4096});
      self.postMessage({id,result:true});
    }else if(type==='generate'){
      if(!engine)throw new Error('Model belum dimuat');
      const reply=await engine.chat.completions.create({messages:data.messages,max_tokens:420,temperature:0.2,response_format:{type:'json_object'}});
      const text=reply.choices?.[0]?.message?.content;if(typeof text!=='string')throw new Error('Respons kosong');
      self.postMessage({id,result:text});
    }
  }catch{self.postMessage({id,error:'Model tidak dapat memproses permintaan. Coba ulangi dengan kalimat lebih singkat.'})}
};
