const QWEN="https://qwen-qwen3-tts.hf.space";
const INDEX="https://indexteam-indextts-2-5-demo.hf.space";
const EDGE="https://sagi-voice-edge-relay.sg3544225.workers.dev";
async function checked(fetcher,url,init,signal){
  const r=await fetcher(url,{...init,signal,cache:"no-store"});
  if(!r.ok) throw new Error("HTTP "+r.status);
  return r;
}
export function parseGradioData(s){
  for(const block of s.replace(/\r\n/g,"\n").split(/\n\n/)){
    const event=block.match(/^event:\s*([^\n]+)/m)?.[1]?.trim();
    if(event==="error")throw new Error("公开引擎任务失败");
    if(event!=="complete")continue;
    const data=block.split("\n").filter(x=>x.startsWith("data:")).map(x=>x.slice(5).trimStart()).join("\n");
    const value=JSON.parse(data);
    if(Array.isArray(value))return value;
  }
  throw new Error("未收到完整音频");
}
export function parseGradioResult(s){
  const data=parseGradioData(s);
  const file=data[0]?.value??data[0];
  if(typeof file?.url!=="string")throw new Error("音频地址缺失");
  return file.url;
}
async function gradioCall(fetcher,origin,name,data,signal){
  const endpoint=origin+"/gradio_api/call/"+name;
  const r=await checked(fetcher,endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data})},signal);
  const {event_id}=await r.json();
  if(typeof event_id!=="string"||!event_id)throw new Error("任务编号缺失");
  const stream=await checked(fetcher,endpoint+"/"+encodeURIComponent(event_id),{headers:{Accept:"text/event-stream"}},signal);
  return parseGradioData(await stream.text());
}
export function makeProviders(fetcher=fetch){
  return [
    {id:"Qwen 1.7B",allowed:true,publicDemo:true,timeoutMs:60000,generate:async(req,signal)=>{
      const endpoint=QWEN+"/gradio_api/call/generate_custom_voice";
      const r=await checked(fetcher,endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:[req.text,"Chinese",req.speaker||"Uncle_fu",req.instruction||"专业足球解说，准确朗读原文。","1.7B"]})},signal);
      const {event_id}=await r.json();
      if(!event_id||typeof event_id!=="string")throw new Error("任务编号缺失");
      const stream=await checked(fetcher,endpoint+"/"+encodeURIComponent(event_id),{headers:{Accept:"text/event-stream"}},signal);
      const url=new URL(parseGradioResult(await stream.text()),QWEN);
      if(url.origin!==QWEN)throw new Error("不受信任的音频地址");
      const media=await checked(fetcher,url.href,{},signal);
      return {audio:await media.blob(),durationMode:"自然时长"};
    }},
    {id:"IndexTTS 2.5",allowed:true,publicDemo:true,timeoutMs:60000,generate:async(req,signal)=>{
      const ex=await gradioCall(fetcher,INDEX,"on_example_click",[0],signal);
      const ref=ex[0]?.value??ex[0];
      if(!ref||typeof ref.path!=="string")throw new Error("示例音色不可用");
      const file={path:ref.path,meta:{_type:"gradio.FileData"}};
      const vectors=req.style==="football_goal"?[0.7,0,0,0,0,0,0.3,0]:req.style==="football_warm"?[0.15,0,0.15,0,0,0.15,0,0.55]:[0.2,0,0,0,0,0,0,0.8];
      const data=await gradioCall(fetcher,INDEX,"gen_single",["Use emotion vectors",file,req.text,"ZH",file,0.65,...vectors,"",false,120,1,true,0.8,30,0.8,0,3,10,1500],signal);
      const out=data[0]?.value??data[0];
      const url=new URL(out?.url||"",INDEX);
      if(!out?.url||url.origin!==INDEX)throw new Error("不受信任的音频地址");
      const media=await checked(fetcher,url.href,{},signal);
      return {audio:await media.blob(),durationMode:"自然时长"};
    }},
    {id:"Edge TTS",allowed:true,timeoutMs:45000,generate:async(req,signal)=>{
      const r=await checked(fetcher,EDGE+"/api/direct-tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:req.text,mode:req.mode==="ai_female"?"ai_female":"ai_male",style:req.style||"football_auto",commentary_mode:(req.style||"football_auto")==="football_auto",intensity:req.profile?.intensity??68,emotion_curve:"build",segment_index:0,segment_count:1,speed:req.profile?.speed??1})},signal);
      return {audio:await r.blob(),durationMode:"自然时长"};
    }}
  ];
}
export async function validateBrowserAudio(blob, signal){
  const checkCancelled=()=>{if(signal?.aborted)throw new Error("已取消音频验证");};
  checkCancelled();
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AC)throw new Error("浏览器不支持音频验证");
  const ctx=new AC();
  try{
    const bytes=await blob.arrayBuffer();
    checkCancelled();
    // decodeAudioData cannot be interrupted on every browser; discard its result after cancellation.
    const audio=await ctx.decodeAudioData(bytes);
    checkCancelled();
    if(!Number.isFinite(audio.duration)||audio.duration<0.2)throw new Error("音频时长异常");
    let peak=0;
    for(let c=0;c<audio.numberOfChannels;c++){
      const samples=audio.getChannelData(c);
      for(let i=0;i<samples.length;i++){
        if((i&65535)===0)checkCancelled();
        peak=Math.max(peak,Math.abs(samples[i]));
      }
    }
    checkCancelled();
    if(!Number.isFinite(peak)||peak<0.0001)throw new Error("音频静音或无效");
    return audio.duration;
  }finally{await ctx.close().catch(()=>{});}
}
