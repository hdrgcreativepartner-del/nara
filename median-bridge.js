/* NARA Median.co + OneSignal bridge v6.2.5 */
(function(){
  const STORE_KEY="nara-median-external-id";
  const statusCallbacks=[];
  let openHandler=null;

  const bridgePresent=()=>typeof window!=="undefined"&&window.median&&window.median.onesignal;
  const nativeHint=()=>/MedianAndroid|MedianIOS|median/i.test((navigator&&navigator.userAgent)||"");
  const isMedian=()=>nativeHint()||bridgePresent();

  function id(){
    let v="";
    try{v=localStorage.getItem(STORE_KEY)||""}catch{}
    if(!v){
      v="nara_"+(crypto&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36));
      try{localStorage.setItem(STORE_KEY,v)}catch{}
    }
    return v;
  }
  function normalizeInfo(data){return data&&typeof data==="object"?data:{}}
  function emit(info){statusCallbacks.forEach(fn=>{try{fn(normalizeInfo(info))}catch{}})}
  function waitForBridge(timeout=6000){
    return new Promise(resolve=>{
      if(bridgePresent())return resolve(true);
      const started=Date.now(),timer=setInterval(()=>{
        if(bridgePresent()){clearInterval(timer);resolve(true)}
        else if(Date.now()-started>=timeout){clearInterval(timer);resolve(false)}
      },120);
    })
  }
  window.median_onesignal_info=function(data){emit(data)};
  window.median_onesignal_push_opened=function(data){try{if(openHandler)openHandler(data||{})}catch{}};

  async function getInfo(){
    if(!(await waitForBridge()))return{};
    try{
      if(window.median.onesignal.info){
        const result=window.median.onesignal.info();
        if(result&&typeof result.then==="function")return normalizeInfo(await result);
      }
      if(window.median.onesignal.onesignalInfo){
        const result=window.median.onesignal.onesignalInfo();
        if(result&&typeof result.then==="function")return normalizeInfo(await result);
      }
      if(window.median.onesignal.info){
        window.median.onesignal.info({callback:"median_onesignal_info"});
        await new Promise(r=>setTimeout(r,350));
      }
    }catch{}
    return{};
  }

  async function init(opts={}){
    if(typeof opts.onStatus==="function")statusCallbacks.push(opts.onStatus);
    if(typeof opts.onOpen==="function")openHandler=opts.onOpen;
    if(!(await waitForBridge()))return{ok:false,message:"bridge-not-ready"};
    const externalId=String(opts.externalId||id()).slice(0,128);
    try{
      if(window.median.onesignal.login){
        const loginResult=window.median.onesignal.login(externalId);
        if(loginResult&&typeof loginResult.then==="function")await loginResult;
      }
      if(window.median.onesignal.enableForegroundNotifications)window.median.onesignal.enableForegroundNotifications(true);
      const info=await getInfo();emit(info);
      return{ok:true,info};
    }catch(e){return{ok:false,message:e&&e.message||"bridge-error"}}
  }

  async function requestPushPermission(){
    if(!(await waitForBridge()))return{ok:false,message:"bridge-not-ready"};
    try{
      if(!window.median.onesignal.register)return{ok:false,message:"onesignal-plugin-missing"};
      const result=window.median.onesignal.register();
      if(result&&typeof result.then==="function")await result;
      await new Promise(r=>setTimeout(r,500));
      const info=await getInfo();emit(info);
      const opted=!!(info.subscription&&info.subscription.optedIn);
      return{ok:opted||Object.keys(info).length>0,info,message:opted?"":"permission-not-confirmed"};
    }catch(e){return{ok:false,message:e&&e.message||"permission-error"}}
  }

  async function syncReminder(reminder){
    if(!(await waitForBridge()))return{ok:false,message:"bridge-not-ready"};
    const endpoint=window.NARA_PUSH_ENDPOINT||(()=>{try{return localStorage.getItem("nara-push-endpoint")||""}catch{return""}})();
    if(!endpoint)return{ok:false,message:"backend-not-configured"};
    const info=await getInfo();
    const payload={
      externalId:info.externalId||id(),
      oneSignalId:info.oneSignalId||"",
      subscriptionId:info.subscription&&info.subscription.id||"",
      reminder:{
        id:reminder.id,title:reminder.title,date:reminder.date,time:reminder.time,
        leadMinutes:Number(reminder.leadMinutes||30),
        targetUrl:location.origin+location.pathname+"#today",
        agendaId:reminder.id
      }
    };
    const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(!res.ok)throw new Error("push-sync-"+res.status);
    return{ok:true};
  }

  window.NaraMedian={isAvailable:isMedian,waitForBridge,init,requestPushPermission,getInfo,syncReminder,getAnonymousExternalId:id};
})();