/* NARA Median.co + OneSignal bridge
 * Frontend-safe: contains no REST API key.
 * Scheduled background reminders require a server endpoint configured as
 * window.NARA_PUSH_ENDPOINT that securely calls OneSignal REST API.
 */
(function(){
  const STORE_KEY="nara-median-external-id";
  const isMedian=()=>/MedianAndroid|MedianIOS|median/i.test(navigator.userAgent||"")&&typeof window.median!=="undefined";
  const statusCallbacks=[];
  let openHandler=null;

  function id(){
    let v=localStorage.getItem(STORE_KEY);
    if(!v){v="nara_"+(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36));localStorage.setItem(STORE_KEY,v)}
    return v;
  }
  function normalizeInfo(data){return data&&typeof data==="object"?data:{}}
  window.median_onesignal_info=function(data){
    const info=normalizeInfo(data);
    statusCallbacks.forEach(fn=>{try{fn(info)}catch{}});
  };
  window.median_onesignal_push_opened=function(data){
    try{if(openHandler)openHandler(data||{})}catch{}
  };

  async function getInfo(){
    if(!isMedian())return{};
    try{
      if(window.median.onesignal.onesignalInfo)return normalizeInfo(await window.median.onesignal.onesignalInfo());
      if(window.median.onesignal.info){
        const result=window.median.onesignal.info({callback:"median_onesignal_info"});
        if(result&&typeof result.then==="function")return normalizeInfo(await result);
      }
    }catch{}
    return{};
  }

  async function init(opts={}){
    if(!isMedian())return{ok:false,message:"not-median"};
    if(typeof opts.onStatus==="function")statusCallbacks.push(opts.onStatus);
    if(typeof opts.onOpen==="function")openHandler=opts.onOpen;
    const externalId=String(opts.externalId||id()).slice(0,128);
    try{
      if(window.median.onesignal&&window.median.onesignal.login)await window.median.onesignal.login(externalId);
      if(window.median.onesignal&&window.median.onesignal.enableForegroundNotifications)window.median.onesignal.enableForegroundNotifications(true);
      const info=await getInfo();statusCallbacks.forEach(fn=>{try{fn(info)}catch{}});
      return{ok:true,info};
    }catch(e){return{ok:false,message:e&&e.message||"bridge-error"}}
  }

  async function requestPushPermission(){
    if(!isMedian())return{ok:false,message:"not-median"};
    try{
      if(!window.median.onesignal||!window.median.onesignal.register)return{ok:false,message:"onesignal-plugin-missing"};
      const result=window.median.onesignal.register();
      if(result&&typeof result.then==="function")await result;
      const info=await getInfo();
      statusCallbacks.forEach(fn=>{try{fn(info)}catch{}});
      return{ok:true,info};
    }catch(e){return{ok:false,message:e&&e.message||"permission-error"}}
  }

  async function syncReminder(reminder){
    if(!isMedian())return{ok:false,message:"not-median"};
    const endpoint=window.NARA_PUSH_ENDPOINT||localStorage.getItem("nara-push-endpoint")||"";
    if(!endpoint)return{ok:false,message:"backend-not-configured"};
    const info=await getInfo();
    const payload={
      externalId:info.externalId||id(),
      oneSignalId:info.oneSignalId||"",
      subscriptionId:info.subscription&&info.subscription.id||"",
      reminder:{
        id:reminder.id,title:reminder.title,date:reminder.date,time:reminder.time,
        leadMinutes:Number(reminder.leadMinutes||30),
        targetUrl:location.origin+location.pathname+"#today"
      }
    };
    const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(!res.ok)throw new Error("push-sync-"+res.status);
    return{ok:true};
  }

  window.NaraMedian={isAvailable:isMedian,init,requestPushPermission,getInfo,syncReminder,getAnonymousExternalId:id};
})();