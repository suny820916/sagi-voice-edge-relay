const QWEN="https://qwen-qwen3-tts.hf.space";
const EDGE="https://sagi-voice-edge-relay.sg3544225.workers.dev";
async function checked(fetcher,url,init,signal){
  const r=await fetcher(url,{...init,signal,cache:"no-store"});
  if(!r.ok) throw new Error("HTTP "+r.status);
  return r;
}
export function parseGradioResult(s){
  for(const block of s.replace(/\r\n/g,"\n").split(/\n\n/)){
    const event=block.match(/^event:\s*([^\n]+)/m)?.[1]?.trim();
    if(event==="error")throw new Error("公开引擎任务失败");
    if(event!=="complete")continue;
    const data=block.split("\n").filter(x=>x.startsWith("data:")).map(x=>x.slice(5).trimStart()).join("\n");
    const value=JSON.parse(data);
    if(Array.isArray(value)&&typeof value[0]?.url==="string")return value[0].url;
  }
  throw new Error("未收到完整音频");
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
    {id:"Edge TTS",allowed:true,timeoutMs:45000,generate:async(req,signal)=>{
      const r=await checked(fetcher,EDGE+"/api/direct-tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:req.text,mode:"ai_male",style:req.style||"natural",speed:1})},signal);
      return {audio:await r.blob(),durationMode:"自然时长"};
    }}
  ];
}
export async function validateBrowserAudio(blob){
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AC)throw new Error("浏览器不支持音频验证");
  const ctx=new AC();
  try{
    const audio=await ctx.decodeAudioData(await blob.arrayBuffer());
    if(!Number.isFinite(audio.duration)||audio.duration<0.2)throw new Error("音频时长异常");
    let peak=0;
    for(let c=0;c<audio.numberOfChannels;c++){
      const samples=audio.getChannelData(c);
      for(let i=0;i<samples.length;i++)peak=Math.max(peak,Math.abs(samples[i]));
    }
    if(!Number.isFinite(peak)||peak<0.0001)throw new Error("音频静音或无效");
    return audio.duration;
  }finally{await ctx.close().catch(()=>{});}
}
