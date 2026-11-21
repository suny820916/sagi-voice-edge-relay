// SAGI VOICE DIRECT TTS
// Sec-MS-GEC v2 implementation adapted from Apache-2.0 code in
// https://github.com/nirholas/three.ws (Copyright 2026 nirholas)
// Protocol behavior cross-checked against rany2/edge-tts 7.3.1.
//
// This module runs Microsoft Edge Read Aloud TTS inside Cloudflare Workers,
// so the browser does not need Render activation or a cross-origin audio fetch.

import { Buffer } from "node:buffer";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION = "2-" + CHROMIUM_FULL_VERSION;
const WIN_EPOCH = 11644473600;

const SHA256_INITIAL=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const SHA256_STATE=[0xfd9fbea2,0x91243ce7,0xbe499094,0xcd2e1e0a,0x6c006f49,0x04bd35ab,0xfeb0a7e4,0x03effbd2];
const SHA256_SCHEDULE=[0xeb24bf9e,0x1558691f,0xa0c09ee2,0x0cfa32ba,0xa622ee8c,0xd1dd9491,0xc0dd25a0,0xf9e70ab6,0xf0c31573,0x7058ce4e,0x7188e606,0x00e5ab33,0xd258b060,0x72766564];
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bc5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const K_BLOCK=K.slice();K_BLOCK[14]=0xc9dc06a7;
const SIGMA0_ADJUSTMENT=0x059c0b80, SIGMA1_ADJUSTMENT=0x000b92c0;
const CS64_COEFFICIENTS=[[0xe82e91b1,0xb32700d0],[0x44de24c6,0x88dff51d],[0x3beb65bc,0x29514038],[0xc89c5933,0xb328cbdf],[0x8d1ec211,0xd405b4d5],[0x314ef5d5,0x26e55f3c],[0xe92491b1,0x607801c6],[0xf0a5b9d5,0x82b2c1fb],[0x06064cf3,0xfa51a3da],[0xda79fa60,0x207cc464],[0xbed20560,0x3c3c74f3],[0x89f9c9f8,0xd2d14b61],[0x35fa38c6,0xbb04a2c1],[0xcb49e3c6,0xc5626167]];
const CS64_FACTOR=0x82893933,CS64_ADJUSTMENT0=0xf2f90b1a,CS64_ADJUSTMENT1=0x0b1a0000;

const mul=(a,b)=>Math.imul(a,b)>>>0;
const add=(...xs)=>xs.reduce((s,x)=>(s+x)>>>0,0);
const ror=(x,n)=>((x>>>n)|(x<<(32-n)))>>>0;
const rol16=x=>((x<<16)|(x>>>16))>>>0;
const sigma0=x=>(ror(x,7)^ror(x,18)^(x>>>3))>>>0;
const sigma1=x=>(ror(x,17)^ror(x,19)^(x>>>10))>>>0;

function expandSchedule(w,first=16){for(let i=first;i<64;i++)w[i]=add(sigma1(w[i-2]),w[i-7],sigma0(w[i-15]),w[i-16])}
function rounds(state,w,firstRound=0){
  const k=firstRound===14?K_BLOCK:K;let[a,b,c,d,e,f,g,h]=state;
  for(let i=firstRound;i<64;i++){
    const s1=(ror(e,6)^ror(e,11)^ror(e,25))>>>0,ch=(g^(e&(f^g)))>>>0,t1=add(h,s1,ch,k[i],w[i]);
    const s0=(ror(a,2)^ror(a,13)^ror(a,22))>>>0,maj=((a&b)|(c&(a|b)))>>>0,t2=add(s0,maj);
    h=g;g=f;f=e;e=add(d,t1);d=c;c=b;b=a;a=add(t1,t2)
  }
  return[a,b,c,d,e,f,g,h]
}
function sha256Init(data){
  const w=new Array(14).fill(0);w.push(data.readUIntBE(0,3));w.push(data.readUInt32BE(3));
  for(let i=16;i<30;i++){let v=SHA256_SCHEDULE[i-16];if(i-2>=14)v+=i===16?(sigma1(w[i-2])^SIGMA1_ADJUSTMENT)>>>0:sigma1(w[i-2]);if(i-7>=14)v+=w[i-7];if(i-15>=14)v+=i===29?(sigma0(w[i-15])^SIGMA0_ADJUSTMENT)>>>0:sigma0(w[i-15]);w.push(v>>>0)}
  w.push(add(sigma1(w[28]),w[23],sigma0(w[15]),w[14],0xc9dc06a7,-K[14]));expandSchedule(w,31);
  return rounds(SHA256_STATE,w,14).map((x,i)=>add(x,SHA256_INITIAL[i]))
}
function sha256Digest(data){
  const length=57+data.length,padLen=(((55-length)%64)+64)%64,tail=data.subarray(7);
  const padded=Buffer.concat([tail,Buffer.from([0x80]),Buffer.alloc(padLen),Buffer.alloc(8)]);
  padded.writeBigUInt64BE(BigInt(length)*8n,padded.length-8);let state=sha256Init(data.subarray(0,7));
  for(let off=0;off<padded.length;off+=64){const w=[];for(let i=0;i<16;i++)w.push(padded.readUInt32BE(off+i*4));expandSchedule(w);state=rounds(state,w).map((x,i)=>add(x,state[i]))}
  const out=Buffer.alloc(32);state.forEach((x,i)=>out.writeUInt32BE(x,i*4));return out
}
function wordsLe4Even(data){const padded=Buffer.concat([data,Buffer.alloc((4-(data.length%4))%4)]),words=[];for(let i=0;i<padded.length;i+=4)words.push(padded.readUInt32LE(i));if(words.length%2)words.push(0);return words}
function cs64Digest(data,digest){
  const keyA=(digest.readUInt32LE(0)|1)>>>0,keyB=(digest.readUInt32LE(4)|1)>>>0,factors=[mul(keyA,CS64_FACTOR),mul(keyB,CS64_FACTOR)];
  const terms=CS64_COEFFICIENTS.map(([coef],i)=>mul(coef,factors[i%2])),offsets=CS64_COEFFICIENTS.map(([,off])=>off);
  wordsLe4Even(Buffer.concat([Buffer.from([0]),data])).forEach((word,i)=>{let term=mul(word,i%2===0?keyA:keyB),offset=mul(rol16(word),i%2===0?0xef0569fb:0xc31713db);if(i===0){term=add(term,mul(CS64_ADJUSTMENT0,factors[0]));offset=add(offset,CS64_ADJUSTMENT1)}terms.push(term);offsets.push(offset)});
  let swapAcc=0,swapLast=0,state=0,acc=0;
  for(let i=0;i<terms.length;i+=2){const x=terms[i],y=terms[i+1];let t=rol16(add(offsets[i],x)),q=mul(t,0x76f50f34);swapAcc=add(swapAcc,mul(rol16(q),0xc3efea97),q);t=rol16(add(offsets[i+1],y));q=mul(t,0x1881ce3c);swapLast=add(mul(rol16(q),0x35bd1ec9),q);swapAcc=add(swapAcc,swapLast);state=add(mul(state,keyA),x);state=mul(rol16(state),0xcf98b111);state=mul(rol16(state),0x87085b9f);state=mul(rol16(state),0x12ceb96d);state=mul(rol16(state),0x257e1d83);acc=add(acc,state);t=add(mul(state,keyB),y);t=mul(rol16(t),0xa27416f5);t=mul(rol16(t),0xd38396ff);state=mul(rol16(mul(rol16(t),0x7c932b89)),0xbfa49f69);acc=add(acc,state)}
  return[(swapLast^state)>>>0,(swapAcc^acc)>>>0]
}

export function generateSecMsGec(unixSeconds=Date.now()/1000){
  let secs=Math.floor(unixSeconds)+WIN_EPOCH;secs-=secs%300;
  const data=Buffer.from(`${secs}0000000${TRUSTED_CLIENT_TOKEN}`,"ascii"),digest=sha256Digest(data),[a,b]=cs64Digest(data,digest),cs64=Buffer.alloc(8);
  cs64.writeUInt32LE(a,0);cs64.writeUInt32LE(b,4);
  return `${cs64.toString("hex").toUpperCase()}-${digest.toString("hex").toUpperCase()}`
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
    `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${ver}&ConnectionId=${connectionId}`,
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${ver}&ConnectionId=${connectionId}`
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
  else if(s==="football_pro"){bias=1;pitch=0}
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
