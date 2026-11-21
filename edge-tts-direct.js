// SAGI VOICE DIRECT TTS
// Cloudflare Worker-native Microsoft Edge Read Aloud synthesis.
// Sec-MS-GEC v2 is provided by edge-gec-v2.js (Apache-2.0 third-party module).

import { Buffer } from "node:buffer";
import { sec_ms_gec_v2 } from "./edge-gec-v2.js";

const TRUSTED_CLIENT_TOKEN="6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION="143.0.3650.75";
const CHROMIUM_MAJOR_VERSION=CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION="2-"+CHROMIUM_FULL_VERSION;

export function generateSecMsGec(unixSeconds=Date.now()/1000){
  return sec_ms_gec_v2(TRUSTED_CLIENT_TOKEN,unixSeconds)
}

function id(){return crypto.randomUUID().replaceAll("-","")}
function muid(){const a=new Uint8Array(16);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase()}
function timestamp(){return new Date().toISOString().replace(/[-:.]/g,"").slice(0,-1)}
function escapeXml(s){return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g," ").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
function fullVoice(shortName){const m=/^([a-z]{2,})-([A-Z]{2,})-(.+Neural)$/.exec(shortName);if(!m)return shortName;return `Microsoft Server Speech Text to Speech Voice (${m[1]}-${m[2]}, ${m[3]})`}
function configMessage(){return `X-Timestamp:${timestamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`}
function ssmlMessage(requestId,voice,text,rate,pitch){const ssml=`<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='${fullVoice(voice)}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp()}Z\r\nPath:ssml\r\n\r\n${ssml}`}

function wsHeaders(){
  return {
    "Upgrade":"websocket",
    "Pragma":"no-cache",
    "Cache-Control":"no-cache",
    "Sec-WebSocket-Version":"13",
    "Origin":"chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    "Accept-Encoding":"gzip, deflate, br, zstd",
    "Accept-Language":"en-US,en;q=0.9",
    "User-Agent":`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
    "Cookie":`muid=${muid()};`
  }
}
function endpointUrls(connectionId,unixSeconds){
  const gec=encodeURIComponent(generateSecMsGec(unixSeconds)),ver=encodeURIComponent(SEC_MS_GEC_VERSION);
  return [
    `https://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${ver}&ConnectionId=${connectionId}`,
    `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${ver}&ConnectionId=${connectionId}`
  ]
}
function asU8(data){
  if(data instanceof ArrayBuffer)return Promise.resolve(new Uint8Array(data));
  if(ArrayBuffer.isView(data))return Promise.resolve(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));
  if(typeof Blob!=="undefined"&&data instanceof Blob)return data.arrayBuffer().then(x=>new Uint8Array(x));
  return Promise.resolve(null)
}
function parseHeaders(text){const sep=text.indexOf("\r\n\r\n"),head=sep>=0?text.slice(0,sep):text,out={};for(const line of head.split("\r\n")){const i=line.indexOf(":");if(i>0)out[line.slice(0,i)]=line.slice(i+1).trim()}return out}
function parseAudioFrame(data){if(data.length<2)throw new Error("EDGE_TTS_FRAME_SHORT");const n=(data[0]<<8)|data[1];if(data.length<2+n)throw new Error("EDGE_TTS_FRAME_TRUNCATED");const headers=parseHeaders(new TextDecoder().decode(data.slice(2,2+n)));return{headers,body:data.slice(2+n)}}

async function openSocket(url){
  const r=await fetch(url,{headers:wsHeaders()});
  if(r.status!==101||!r.webSocket){const e=new Error("EDGE_TTS_WS_"+r.status);e.status=r.status;e.serverDate=r.headers.get("Date")||"";throw e}
  return r.webSocket
}
async function synthesizeOnce(text,voice,rate,pitch,unixSeconds){
  const conn=id(),urls=endpointUrls(conn,unixSeconds);let last;
  for(const url of urls){
    try{
      const socket=await openSocket(url);
      return await new Promise((resolve,reject)=>{
        const chunks=[];let settled=false,timer;
        const cleanup=()=>{clearTimeout(timer);socket.removeEventListener("message",onMessage);socket.removeEventListener("close",onClose);socket.removeEventListener("error",onError)};
        const fail=e=>{if(settled)return;settled=true;cleanup();try{socket.close()}catch{}reject(e instanceof Error?e:new Error(String(e)))};
        const finish=()=>{if(settled)return;settled=true;cleanup();try{socket.close()}catch{};if(!chunks.length)return reject(new Error("EDGE_TTS_NO_AUDIO"));resolve(Buffer.concat(chunks))};
        const onMessage=async ev=>{try{
          if(typeof ev.data==="string"){const h=parseHeaders(ev.data);if(h.Path==="turn.end")return finish();if(["response","turn.start","audio.metadata"].includes(h.Path))return;return}
          const u=await asU8(ev.data);if(!u)return;const p=parseAudioFrame(u);if(p.headers.Path!=="audio")return;if(p.body.length)chunks.push(Buffer.from(p.body))
        }catch(e){fail(e)}};
        const onClose=()=>{if(!settled)chunks.length?finish():fail(new Error("EDGE_TTS_CLOSED"))};
        const onError=()=>fail(new Error("EDGE_TTS_SOCKET_ERROR"));
        socket.addEventListener("message",onMessage);socket.addEventListener("close",onClose);socket.addEventListener("error",onError);
        socket.accept();socket.send(configMessage());socket.send(ssmlMessage(id(),voice,text,rate,pitch));
        timer=setTimeout(()=>fail(new Error("EDGE_TTS_TIMEOUT")),30000)
      })
    }catch(e){last=e}
  }
  throw last||new Error("EDGE_TTS_UNAVAILABLE")
}

function stylePlan(style,speed){
  const s=String(style||"natural"),x=Math.max(.82,Math.min(1.25,Number(speed)||1));let bias=1,pitch=0;
  if(s==="football_passion"){bias=1.04;pitch=2}
  else if(s==="football_goal"){bias=1.07;pitch=3}
  else if(s==="football_warm"){bias=.97;pitch=-1}
  else if(s==="football_emotional"){bias=.94;pitch=-2}
  else if(s==="football_memory"){bias=.96;pitch=-2}
  const pct=Math.round((Math.max(.78,Math.min(1.30,x*bias))-1)*100);
  return{rate:(pct>=0?"+":"")+pct+"%",pitch:(pitch>=0?"+":"")+pitch+"Hz"}
}
function splitText(text,max=1200){
  const s=String(text||"").trim();if(!s)return[];
  const rows=s.split(/(?<=[。！？!?；;\n])/).map(x=>x.trim()).filter(Boolean),out=[];let cur="";
  for(const row of rows){if((cur+row).length>max&&cur){out.push(cur);cur=row}else cur+=row}if(cur)out.push(cur);return out
}
export async function synthesizeEdgeDirect({text,mode="ai_male",speed=1,style="natural"}){
  const chunks=splitText(text);if(!chunks.length)throw new Error("TEXT_REQUIRED");if(String(text).length>6000)throw new Error("TEXT_TOO_LONG");
  const voice=mode==="ai_female"?"zh-CN-XiaoxiaoNeural":"zh-CN-YunjianNeural",plan=stylePlan(style,speed),audio=[];
  for(const chunk of chunks){
    let buf,err;
    for(let attempt=0;attempt<2;attempt++){
      try{buf=await synthesizeOnce(chunk,voice,plan.rate,plan.pitch,Date.now()/1000);break}catch(e){err=e;if(attempt===0)await new Promise(r=>setTimeout(r,250))}
    }
    if(!buf)throw err||new Error("EDGE_TTS_FAILED");audio.push(buf)
  }
  const joined=Buffer.concat(audio);
  return{audio:joined,voice,model:"edge-neural-direct-v2",provider:"Microsoft Edge Neural Direct",segments:chunks.length}
}
