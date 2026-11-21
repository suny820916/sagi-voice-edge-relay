// BUILD_TRIGGER: standalone-voice-cors-r31
import { synthesizeEdgeDirect } from "./edge-tts-direct.js";

// BUILD_TRIGGER: wrangler-4.165.0-2026-11-21
// SAGI VOICE EDGE RELAY
// Overseas-only relay template for Cloudflare Workers / workers.dev.
// No SAGI domestic server or custom domain is required.
const ORIGIN = "https://sagi-cloud-bridge-suny820916.onrender.com";

const VOICE_HTML = "<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#080b0d\">\n<title>SAGI VOICE DIRECT</title>\n<style>\n:root{color-scheme:dark;--bg:#080b0d;--card:#10130f;--line:#5d4d2d;--text:#f3f4f2;--muted:#8c846d;--gold:#d7b568;--blue:#314951}\n*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Display\",\"PingFang SC\",sans-serif}\nbody{min-height:100vh;padding:calc(18px + env(safe-area-inset-top)) 14px calc(28px + env(safe-area-inset-bottom));background:radial-gradient(circle at 50% -8%,#1c2117 0,transparent 34%),var(--bg)}\n.wrap{max-width:620px;margin:0 auto}.top{display:flex;justify-content:space-between;align-items:flex-start;margin:3px 3px 16px}.brand b{font-size:22px;letter-spacing:.6px}.brand span{display:block;color:var(--muted);font-size:9px;margin-top:4px}.badge{border:1px solid #5c5032;border-radius:99px;padding:6px 9px;font-size:8px;color:#d8c280}\n.card{border:1px solid var(--line);border-radius:19px;padding:16px;background:linear-gradient(180deg,#15130d,#0a0d0d);box-shadow:0 20px 45px rgba(0,0,0,.2)}\n.intro{font-size:9px;color:#9b8b62;line-height:1.55;margin-bottom:10px}\ntextarea{width:100%;min-height:190px;border:1px solid #4d432c;background:#070908;color:#fff;border-radius:14px;padding:14px;font-size:16px;line-height:1.65;resize:vertical;outline:none}\n.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px}.grid label{font-size:9px;color:#9b8b62}.grid select{width:100%;margin-top:5px;border:1px solid #4a402b;background:#070908;color:#fff;border-radius:12px;padding:13px 10px;font-size:13px}\n.actions{display:grid;grid-template-columns:1.35fr 1fr;gap:9px;margin-top:12px}.btn{border:1px solid #5b5033;background:#1a1710;color:#d8c280;border-radius:13px;padding:14px 12px;font-size:14px;font-weight:700;text-align:center;text-decoration:none}.btn.primary{font-size:16px}.btn.disabled{pointer-events:none;opacity:.4}\naudio{display:none;width:100%;height:42px;margin-top:12px}audio.show{display:block}\n.status{margin-top:11px;border-top:1px solid #403824;padding-top:11px;color:#a89563;font-size:11px;line-height:1.55;word-break:break-word}\n.meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.meta span{border:1px solid #4c402a;border-radius:99px;padding:4px 7px;font-size:8px;color:#b39a61}\n.foot{text-align:center;color:#5f737a;font-size:9px;margin-top:16px;line-height:1.5}\n@media(max-width:430px){.grid{grid-template-columns:1fr 1fr}.actions{grid-template-columns:1fr}.btn.primary{order:-1}}\n</style>\n</head>\n<body>\n<div class=\"wrap\">\n  <div class=\"top\"><div class=\"brand\"><b>SAGI VOICE DIRECT</b><span>OVERSEAS DIRECT · EDGE DIRECT · R3</span></div><span class=\"badge\">V1.2</span></div>\n  <section class=\"card\">\n    <div class=\"intro\">独立海外链路 · 页面与配音 API 同域 · 不使用国内服务器 / 国内域名</div>\n    <textarea id=\"text\" placeholder=\"粘贴完整文案。\"></textarea>\n    <div class=\"grid\">\n      <label>声音<select id=\"mode\"><option value=\"ai_male\" selected>AI专业男声</option><option value=\"ai_female\">AI专业女声</option></select></label>\n      <label>风格<select id=\"style\"><option value=\"football_pro\">职业足球解说</option><option value=\"football_passion\" selected>激情攻防 · 高能推进</option><option value=\"football_goal\">绝杀高燃</option><option value=\"football_warm\">温情足球</option><option value=\"football_emotional\">感人故事</option><option value=\"football_memory\">纪录片回忆</option><option value=\"natural\">自然解说</option></select></label>\n      <label>质量<select id=\"quality\"><option value=\"fast\">极速 · 稳定</option><option value=\"pro\">专业 · 体育解说</option><option value=\"cinema\" selected>电影级 · 高表现力</option></select></label>\n      <label>语速<select id=\"speed\"><option value=\"0.94\">沉稳 0.94×</option><option value=\"1\">自然 1.00×</option><option value=\"1.08\" selected>短视频 1.08×</option><option value=\"1.16\">快速 1.16×</option></select></label>\n    </div>\n    <div class=\"actions\">\n      <button class=\"btn primary\" id=\"generate\">生成独立配音</button>\n      <a class=\"btn disabled\" id=\"download\" download=\"SAGI_VOICE.wav\">下载 WAV</a>\n    </div>\n    <audio id=\"audio\" controls playsinline></audio>\n    <div class=\"status\" id=\"status\">等待文案。</div>\n    <div class=\"meta\" id=\"meta\"></div>\n  </section>\n  <div class=\"foot\">SAGI SPORTS · VOICE DIRECT · workers.dev → Microsoft Edge Neural</div>\n</div>\n<script>\nconst $=id=>document.getElementById(id);\nlet token='',objectUrl='';\nfunction status(t){$('status').textContent=t}\nconst sleep=ms=>new Promise(r=>setTimeout(r,ms));\nasync function fetchWith429Retry(url,init={},attempts=4){\n  let last=null;\n  for(let i=0;i<attempts;i++){\n    last=await fetch(url,init);\n    if(last.status!==429)return last;\n    const retryAfter=Number(last.headers.get('Retry-After')||0);\n    const delay=retryAfter>0?retryAfter*1000:700*Math.pow(2,i);\n    status('云端繁忙 · 自动重试 '+(i+1)+'/'+attempts+'…');\n    await sleep(Math.min(delay,8000))\n  }\n  return last\n}\nasync function ensureToken(){\n  if(token)return true;\n  const a=await fetchWith429Retry('/api/activate',{\n    method:'POST',\n    headers:{'Content-Type':'application/json'},\n    body:'{}'\n  },4);\n  const d=await a.json().catch(()=>({}));\n  if(!a.ok||!d.token)throw new Error(d.error||('激活失败 HTTP '+a.status));\n  token=d.token;\n  return true\n}\nfunction wavFromAudioBuffer(buf){\n  const channels=buf.numberOfChannels,frames=buf.length,rate=buf.sampleRate;\n  const mono=new Float32Array(frames);\n  for(let c=0;c<channels;c++){const ch=buf.getChannelData(c);for(let i=0;i<frames;i++)mono[i]+=ch[i]/channels}\n  const out=new ArrayBuffer(44+frames*2),v=new DataView(out);\n  const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};\n  str(0,'RIFF');v.setUint32(4,36+frames*2,true);str(8,'WAVE');str(12,'fmt ');\n  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);\n  v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*2,true);\n  let o=44;for(let i=0;i<frames;i++){const x=Math.max(-1,Math.min(1,mono[i]));v.setInt16(o,x<0?x*0x8000:x*0x7fff,true);o+=2}\n  return new Blob([out],{type:'audio/wav'})\n}\nasync function toWav(blob){\n  const AC=window.AudioContext||window.webkitAudioContext;\n  if(!AC)throw new Error('当前浏览器不支持 WAV 转换');\n  const ctx=new AC();\n  try{\n    const ab=await blob.arrayBuffer();\n    const decoded=await ctx.decodeAudioData(ab.slice(0));\n    return {blob:wavFromAudioBuffer(decoded),duration:decoded.duration}\n  }finally{try{await ctx.close()}catch(e){}}\n}\n$('generate').onclick=async()=>{\n  const text=$('text').value.trim();if(!text){status('请先粘贴文案。');return}\n  const btn=$('generate');btn.disabled=true;btn.textContent='正在生成…';\n  try{\n    const payload={text,mode:$('mode').value,voice_id:'',speed:Number($('speed').value)||1,style:$('style').value,quality:$('quality').value};\n    status('① Microsoft Edge Neural 直连生成…');\n    let r=await fetch('/api/direct-tts',{\n      method:'POST',\n      headers:{'Content-Type':'application/json'},\n      body:JSON.stringify(payload)\n    });\n    if(!r.ok){\n      const directErr=await r.json().catch(()=>({}));\n      status('直连暂不可用 · 自动切换 Render 备用线…');\n      await ensureToken();\n      r=await fetchWith429Retry('/api/voice/preview',{\n        method:'POST',\n        headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},\n        body:JSON.stringify(payload)\n      },4);\n      if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||directErr.error||('配音 HTTP '+r.status))}\n    }\n    const source=await r.blob();if(source.size<1000)throw new Error('配音返回为空');\n    status('③ 正在转换 WAV…');\n    const wav=await toWav(source);\n    if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(wav.blob);\n    $('audio').src=objectUrl;$('audio').classList.add('show');\n    $('download').href=objectUrl;$('download').classList.remove('disabled');\n    const provider=r.headers.get('X-SAGI-Voice-Provider')||'SAGI VOICE';\n    const model=r.headers.get('X-SAGI-Voice-Model')||'';\n    $('meta').innerHTML='<span>'+wav.duration.toFixed(1)+' 秒</span><span>WAV</span><span>'+Math.round(wav.blob.size/1024)+' KB</span><span>'+provider+'</span>'+(model?'<span>'+model+'</span>':'');\n    status('完成 · '+provider+' · 可以试听或下载 WAV。');\n    $('audio').play().catch(()=>{})\n  }catch(e){status('配音生成失败：'+(e.message||e))}\n  finally{btn.disabled=false;btn.textContent='生成独立配音'}\n};\n</script>\n</body></html>";

const ALLOWED_CLIENT_ORIGINS = new Set([
  "https://suny820916.github.io",
  "https://sagisports.cn",
  "https://www.sagisports.cn",
  "https://sagi-voice-edge-relay.sg3544225.workers.dev"
]);

function cors(origin) {
  const allow = ALLOWED_CLIENT_ORIGINS.has(origin) ? origin : "https://suny820916.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

const directTtsRate = new Map();
function directTtsAllowed(request){
  const ip=request.headers.get("CF-Connecting-IP")||"unknown";
  const now=Date.now(),cut=now-60000,rows=(directTtsRate.get(ip)||[]).filter(x=>x>=cut);
  if(rows.length>=20){directTtsRate.set(ip,rows);return false}
  rows.push(now);directTtsRate.set(ip,rows);return true
}
function directJson(data,status=200,origin=""){
  return new Response(JSON.stringify(data),{status,headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-SAGI-Direct-TTS":"1",
    ...cors(origin)
  }})
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/voice")) {
      return new Response(VOICE_HTML, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-SAGI-Voice-Direct": "1"
        }
      });
    }

    if (url.pathname === "/api/direct-tts") {
      if (request.method !== "POST") return directJson({ok:false,error:"METHOD_NOT_ALLOWED"},405,origin);
      if (!directTtsAllowed(request)) return directJson({ok:false,error:"DIRECT_TTS_RATE_LIMIT"},429,origin);
      try {
        const body=await request.json();
        const text=String(body?.text||"").trim();
        if(!text)return directJson({ok:false,error:"Text required"},400,origin);
        if(text.length>6000)return directJson({ok:false,error:"Text too long"},413,origin);
        const result=await synthesizeEdgeDirect({
          text,
          mode:String(body?.mode||"ai_male"),
          speed:Number(body?.speed||1),
          style:String(body?.style||"natural")
        });
        return new Response(result.audio,{
          status:200,
          headers:{
            "Content-Type":"audio/mpeg",
            "Cache-Control":"no-store",
            "Content-Disposition":"inline; filename=sagi-voice-direct.mp3",
            "X-SAGI-Voice-Complete":"1",
            "X-SAGI-Voice-Coverage":"100",
            "X-SAGI-Voice-Segments":String(result.segments||1),
            "X-SAGI-Voice-Provider":result.provider,
            "X-SAGI-Voice-Model":result.model,
            "X-SAGI-Voice-Quality":"edge-direct",
            "X-SAGI-Direct-TTS":"1",
            ...cors(origin)
          }
        });
      } catch (err) {
        return directJson({ok:false,error:"EDGE_DIRECT_TTS_FAILED",detail:String(err?.message||err).slice(0,300)},502,origin);
      }
    }

    // Limit relay surface to SAGI Cloud endpoints only.
    if (!(url.pathname === "/health" || url.pathname.startsWith("/api/"))) {
      return new Response("Not found", { status: 404, headers: cors(origin) });
    }

    const upstream = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cf-connecting-ip");
    headers.delete("x-forwarded-for");
    headers.set("X-SAGI-Edge-Relay", "1");
    headers.set("Origin", "https://suny820916.github.io");

    headers.delete("content-length");
    const init = {
      method: request.method,
      headers,
      redirect: "follow"
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      // Buffer small/medium API bodies before forwarding. This avoids
      // Safari/Workers ReadableStream forwarding failures that surface as
      // a generic "Load failed" in iOS fetch().
      init.body = await request.arrayBuffer();
    }

    let response;
    try {
      response = await fetch(upstream, init);
    } catch (err) {
      const h = new Headers(cors(origin));
      h.set("Content-Type", "application/json; charset=utf-8");
      h.set("X-SAGI-Relay", "workers.dev");
      return new Response(JSON.stringify({
        ok: false,
        error: "SAGI_EDGE_UPSTREAM_FAILED",
        detail: String(err && err.message ? err.message : err)
      }), { status: 502, headers: h });
    }
    const outHeaders = new Headers(response.headers);
    // Safari-safe streaming: upstream Content-Length can differ after Cloudflare
    // normalizes/compresses the streamed audio body. Never forward stale transport
    // metadata or Safari may abort fetch() with "Load failed".
    for (const h of [
      "content-length",
      "content-encoding",
      "transfer-encoding",
      "connection",
      "keep-alive"
    ]) outHeaders.delete(h);
    for (const [k,v] of Object.entries(cors(origin))) outHeaders.set(k,v);
    outHeaders.set("Cache-Control", "no-store");
    outHeaders.set("X-SAGI-Relay", "workers.dev");
    outHeaders.set("X-SAGI-Safari-Safe", "1");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders
    });
  }
};
