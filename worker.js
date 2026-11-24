// BUILD_TRIGGER: standalone-voice-v1.5-qwen3-beta
import { synthesizeEdgeDirect } from "./edge-tts-direct.js";
import { synthesizeQwen3 } from "./qwen3-tts-client.js";

// BUILD_TRIGGER: wrangler-4.165.0-2026-11-21
// SAGI VOICE EDGE RELAY
// Overseas-only relay template for Cloudflare Workers / workers.dev.
// No SAGI domestic server or custom domain is required.
const ORIGIN = "https://sagi-cloud-bridge-suny820916.onrender.com";

const VOICE_HTML = "<!doctype html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#080b0d\">\n<title>SAGI VOICE</title>\n<link rel=\"manifest\" href=\"/manifest.webmanifest?v=2\">\n<link rel=\"icon\" href=\"/icon.svg?v=2\" type=\"image/svg+xml\">\n<link rel=\"apple-touch-icon\" href=\"/icon.svg?v=2\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\">\n<meta name=\"apple-mobile-web-app-title\" content=\"SAGI VOICE\">\n<style>\n:root{color-scheme:dark;--bg:#080b0d;--card:#10130f;--line:#5d4d2d;--text:#f3f4f2;--muted:#8c846d;--gold:#d7b568;--blue:#314951}\n*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Display\",\"PingFang SC\",sans-serif}\nbody{min-height:100vh;padding:calc(18px + env(safe-area-inset-top)) 14px calc(28px + env(safe-area-inset-bottom));background:radial-gradient(circle at 50% -8%,#1c2117 0,transparent 34%),var(--bg)}\n.wrap{max-width:620px;margin:0 auto}.top{display:flex;justify-content:space-between;align-items:flex-start;margin:3px 3px 16px}.brand b{font-size:22px;letter-spacing:.6px}.brand span{display:block;color:var(--muted);font-size:9px;margin-top:4px}.badge{border:1px solid #5c5032;border-radius:99px;padding:6px 9px;font-size:8px;color:#d8c280}\n.card{border:1px solid var(--line);border-radius:19px;padding:16px;background:linear-gradient(180deg,#15130d,#0a0d0d);box-shadow:0 20px 45px rgba(0,0,0,.2)}\n.intro{font-size:10px;color:#b5a06b;line-height:1.6;margin-bottom:10px}\ntextarea{width:100%;min-height:180px;border:1px solid #4d432c;background:#070908;color:#fff;border-radius:14px;padding:14px;font-size:16px;line-height:1.65;resize:vertical;outline:none}\n.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px}.grid label{font-size:9px;color:#9b8b62}.grid select{width:100%;margin-top:5px;border:1px solid #4a402b;background:#070908;color:#fff;border-radius:12px;padding:13px 10px;font-size:13px}\n.enginebar{margin:0 0 11px;padding:10px 11px;border:1px solid #3f3a2c;border-radius:12px;background:#0a0c0b;font-size:10px;line-height:1.55}.enginebar strong{color:#d8c280}.enginebar.ok{border-color:#315943}.enginebar.warn{border-color:#70423c}.enginebar .sub{display:block;margin-top:3px;color:#8c846d}.planner{margin-top:11px;padding:10px 11px;border:1px solid #3f3a2c;border-radius:12px;background:#0a0c0b;color:#b7a671;font-size:10px;line-height:1.55}\n.actions{display:grid;grid-template-columns:1.35fr 1fr;gap:9px;margin-top:12px}.btn{border:1px solid #5b5033;background:#1a1710;color:#d8c280;border-radius:13px;padding:14px 12px;font-size:14px;font-weight:700;text-align:center;text-decoration:none}.btn.primary{font-size:16px}.btn.disabled{pointer-events:none;opacity:.4}\naudio{display:none;width:100%;height:42px;margin-top:12px}audio.show{display:block}\n.status{margin-top:11px;border-top:1px solid #403824;padding-top:11px;color:#a89563;font-size:11px;line-height:1.55;word-break:break-word}\n.meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.meta span{border:1px solid #4c402a;border-radius:99px;padding:4px 7px;font-size:8px;color:#b39a61}\n.segments{display:none;margin-top:13px}.segments.show{display:block}.segments h3{font-size:11px;color:#d5bd7a;margin:0 0 8px}.seg{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px 0;border-top:1px solid #302b20}.segtext{font-size:11px;line-height:1.55;color:#d7d7d2}.segbtn{border:1px solid #55472c;background:#13120e;color:#d8c280;border-radius:9px;padding:8px 9px;font-size:10px;font-weight:700}.segbtn:disabled{opacity:.45}\n.foot{text-align:center;color:#5f737a;font-size:9px;margin-top:16px;line-height:1.5}\n@media(max-width:430px){.grid{grid-template-columns:1fr 1fr}.actions{grid-template-columns:1fr}.btn.primary{order:-1}}\n</style>\n</head>\n<body>\n<div class=\"wrap\">\n  <div class=\"top\"><div class=\"brand\"><b>SAGI VOICE</b><span>BETA 候选版 · Qwen3-TTS · V1.5</span></div><span class=\"badge\">V1.5 BETA</span></div>\n  <section class=\"card\">\n    <div class=\"intro\">Qwen3-TTS 生成式足球解说 · 局部重生成 · 时长匹配 · 情绪曲线</div>\n    <div class=\"enginebar\" id=\"enginebar\"><strong>正在检测发声引擎…</strong><span class=\"sub\">只有 Qwen3 主路由成功才算高表现力模式。</span></div>\n    <textarea id=\"text\" placeholder=\"粘贴完整文案。系统会自动按句拆分，识别绝杀、进球、晋级、热爱等足球关键词。\"></textarea>\n    <div class=\"grid\">\n      <label>声音<select id=\"mode\"><option value=\"ai_male\" selected>AI专业男声</option><option value=\"ai_female\">AI专业女声</option></select></label>\n      <label>解说模式<select id=\"style\"><option value=\"football_auto\" selected>智能足球导演 · 推荐</option><option value=\"football_pro\">职业足球解说</option><option value=\"football_passion\">激情攻防 · 高能推进</option><option value=\"football_goal\">绝杀高燃</option><option value=\"football_warm\">温情足球</option><option value=\"football_emotional\">感人故事</option><option value=\"football_memory\">纪录片回忆</option><option value=\"natural\">自然解说</option></select></label>\n      <label>引擎质量<select id=\"quality\"><option value=\"fast\">免费 · Edge 双声线</option><option value=\"pro\" selected>Qwen Pro · 推荐</option><option value=\"cinema\">Qwen Cinema · 高表现力</option></select></label>\n      <label>手动语速<select id=\"speed\"><option value=\"0.94\">沉稳 0.94×</option><option value=\"1\" selected>自然 1.00×</option><option value=\"1.08\">短视频 1.08×</option><option value=\"1.16\">快速 1.16×</option></select></label>\n      <label>目标时长<select id=\"target\"><option value=\"0\">不限制</option><option value=\"15\">15 秒</option><option value=\"20\" selected>20 秒</option><option value=\"30\">30 秒</option><option value=\"45\">45 秒</option><option value=\"60\">60 秒</option></select></label>\n      <label>情绪曲线<select id=\"curve\"><option value=\"steady\">稳定专业</option><option value=\"build\" selected>蓄力 → 爆发</option><option value=\"wave\">起伏推进</option><option value=\"documentary\">纪录片起伏</option><option value=\"burst_close\">开场强 → 收束</option></select></label>\n      <label>情绪强度<select id=\"intensity\"><option value=\"45\">克制 45</option><option value=\"65\" selected>专业 65</option><option value=\"85\">高燃 85</option><option value=\"100\">极限 100</option></select></label>\n    </div>\n    <div class=\"planner\" id=\"planner\">输入文案后，这里会显示预计时长与自动匹配语速。</div>\n    <div class=\"actions\">\n      <button class=\"btn primary\" id=\"generate\">生成完整配音</button>\n      <a class=\"btn disabled\" id=\"download\" download=\"SAGI_VOICE.wav\">下载 WAV</a>\n    </div>\n    <audio id=\"audio\" controls playsinline></audio>\n    <div class=\"status\" id=\"status\">等待文案。</div>\n    <div class=\"meta\" id=\"meta\"></div>\n    <div class=\"segments\" id=\"segments\"><h3>局部重生成</h3><div id=\"segmentList\"></div></div>\n  </section>\n  <div class=\"foot\">SAGI SPORTS · Qwen3-TTS PRIMARY · Edge Neural FALLBACK</div>\n</div>\n<script>\nconst $=id=>document.getElementById(id);\nlet objectUrl='',segmentSources=[],segmentTexts=[],currentCfg=null,lastMeta={},runRoutes=[],runFallback=false;\nconst VOICE_STORE='sagi_voice_direct_standalone_v2';\nconst sleep=ms=>new Promise(r=>setTimeout(r,ms));\nfunction status(t){$('status').textContent=t}\nfunction clamp(n,min,max){return Math.max(min,Math.min(max,n))}\nfunction saveVoiceDraft(){try{localStorage.setItem(VOICE_STORE,JSON.stringify({text:$('text').value,mode:$('mode').value,style:$('style').value,quality:$('quality').value,speed:$('speed').value,target:$('target').value,curve:$('curve').value,intensity:$('intensity').value}))}catch(e){}}\nfunction loadVoiceDraft(){try{const d=JSON.parse(localStorage.getItem(VOICE_STORE)||'{}');if(typeof d.text==='string')$('text').value=d.text;for(const k of ['mode','style','quality','speed','target','curve','intensity'])if(d[k]&&$(k))$(k).value=d[k]}catch(e){}}\nasync function fetchWith429Retry(url,init={},attempts=4){\n  let last=null;\n  for(let i=0;i<attempts;i++){\n    last=await fetch(url,init);\n    if(last.status!==429)return last;\n    const retryAfter=Number(last.headers.get('Retry-After')||0);\n    const delay=retryAfter>0?retryAfter*1000:700*Math.pow(2,i);\n    status('云端繁忙 · 自动重试 '+(i+1)+'/'+attempts+'…');\n    await sleep(Math.min(delay,8000))\n  }\n  return last\n}\nfunction splitPerformanceText(text){\n  const raw=String(text||'').trim();if(!raw)return[];\n  let rows=raw.split(/(?<=[。！？!?；;\\n])/).map(x=>x.trim()).filter(Boolean);\n  if(!rows.length)rows=[raw];\n  const MAX=8;\n  while(rows.length>MAX){\n    let best=0,min=Infinity;\n    for(let i=0;i<rows.length-1;i++){const n=rows[i].length+rows[i+1].length;if(n<min){min=n;best=i}}\n    rows.splice(best,2,rows[best]+rows[best+1])\n  }\n  return rows\n}\nfunction estimateNaturalDuration(text){\n  const s=String(text||'');\n  const han=(s.match(/[\\u3400-\\u9fff]/g)||[]).length;\n  const words=(s.match(/[A-Za-z0-9]+/g)||[]).length;\n  const stops=(s.match(/[。！？!?；;]/g)||[]).length;\n  const commas=(s.match(/[，,、：:]/g)||[]).length;\n  return Math.max(1,han/4.65+words/2.8+stops*.25+commas*.10)\n}\nfunction getCfg(text){\n  const target=Number($('target').value)||0,manual=Number($('speed').value)||1,natural=estimateNaturalDuration(text);\n  const speed=target?clamp(natural/target,.82,1.25):manual;\n  return{mode:$('mode').value,style:$('style').value,quality:$('quality').value,speed,target,curve:$('curve').value,intensity:Number($('intensity').value)||65,commentary:$('style').value==='football_auto',natural}\n}\nfunction updatePlanner(){\n  const text=$('text').value.trim();if(!text){$('planner').textContent='输入文案后，这里会显示预计时长与自动匹配语速。';return}\n  const cfg=getCfg(text),parts=splitPerformanceText(text);\n  const targetText=cfg.target?('目标 '+cfg.target+' 秒 · 自动语速 '+cfg.speed.toFixed(2)+'×'):('预计 '+cfg.natural.toFixed(1)+' 秒 · 手动语速 '+cfg.speed.toFixed(2)+'×');\n  $('planner').textContent=targetText+' · '+parts.length+' 个可独立重生成片段 · 情绪曲线已启用';\n}\nfunction monoResampled(buf,targetRate=24000){\n  const len=buf.length,mono=new Float32Array(len);\n  for(let c=0;c<buf.numberOfChannels;c++){const ch=buf.getChannelData(c);for(let i=0;i<len;i++)mono[i]+=ch[i]/buf.numberOfChannels}\n  if(buf.sampleRate===targetRate)return mono;\n  const outLen=Math.max(1,Math.round(len*targetRate/buf.sampleRate)),out=new Float32Array(outLen);\n  for(let i=0;i<outLen;i++){const pos=i*buf.sampleRate/targetRate,a=Math.floor(pos),b=Math.min(len-1,a+1),t=pos-a;out[i]=mono[a]*(1-t)+mono[b]*t}\n  return out\n}\nfunction wavFromFloatSegments(parts,rate=24000){\n  let frames=0;for(const p of parts)frames+=p.length;\n  const out=new ArrayBuffer(44+frames*2),v=new DataView(out),str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};\n  str(0,'RIFF');v.setUint32(4,36+frames*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*2,true);\n  let o=44;for(const part of parts)for(let i=0;i<part.length;i++){const x=Math.max(-1,Math.min(1,part[i]));v.setInt16(o,x<0?x*0x8000:x*0x7fff,true);o+=2}\n  return{blob:new Blob([out],{type:'audio/wav'}),duration:frames/rate}\n}\nasync function buildComposite(){\n  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('当前浏览器不支持音频拼接');\n  const ctx=new AC(),parts=[];\n  try{\n    for(const blob of segmentSources){const ab=await blob.arrayBuffer();const decoded=await ctx.decodeAudioData(ab.slice(0));parts.push(monoResampled(decoded,24000))}\n  }finally{try{await ctx.close()}catch(e){}}\n  return wavFromFloatSegments(parts,24000)\n}\nasync function synthSegment(text,index,count,cfg){\n  const payload={text,mode:cfg.mode,voice_id:'',speed:cfg.speed,style:cfg.style,quality:cfg.quality,commentary_mode:cfg.commentary,intensity:cfg.intensity,emotion_curve:cfg.curve,segment_index:index,segment_count:count};\n  const r=await fetchWith429Retry('/api/voice-router',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},4);\n  if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||('配音 HTTP '+r.status))}\n  const blob=await r.blob();if(blob.size<600)throw new Error('配音返回为空');\n  return{blob,provider:r.headers.get('X-SAGI-Voice-Provider')||'SAGI VOICE',route:r.headers.get('X-SAGI-Voice-Route')||'unknown',fallback:r.headers.get('X-SAGI-Voice-Fallback')==='1',model:r.headers.get('X-SAGI-Voice-Model')||'',tempo:r.headers.get('X-SAGI-Tempo')||'',style:r.headers.get('X-SAGI-Performance-Style')||cfg.style}\n}\nasync function rebuildOutput(){\n  const wav=await buildComposite();\n  if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(wav.blob);\n  $('audio').src=objectUrl;$('audio').classList.add('show');$('download').href=objectUrl;$('download').classList.remove('disabled');\n  lastMeta.duration=wav.duration;lastMeta.size=wav.blob.size;\n  const routeLabel=runFallback?'⚠ Edge 回退':(runRoutes.length&&runRoutes.every(x=>x==='qwen3-tts')?'✓ Qwen3 真实主路由':String(lastMeta.route||'direct'));\n  $('meta').innerHTML='<span>'+wav.duration.toFixed(2)+' 秒</span><span>WAV</span><span>'+Math.round(wav.blob.size/1024)+' KB</span><span>'+segmentTexts.length+' 段</span><span>'+String(lastMeta.provider||'SAGI VOICE')+'</span><span>'+routeLabel+'</span>';\n  return wav\n}\nfunction renderSegments(){\n  const box=$('segments'),list=$('segmentList');list.innerHTML='';\n  segmentTexts.forEach((t,i)=>{\n    const row=document.createElement('div');row.className='seg';\n    const tx=document.createElement('div');tx.className='segtext';tx.textContent=(i+1)+'. '+t;\n    const btn=document.createElement('button');btn.className='segbtn';btn.textContent='重生成此句';\n    btn.onclick=()=>regenerateSegment(i,btn);\n    row.appendChild(tx);row.appendChild(btn);list.appendChild(row)\n  });\n  box.classList.toggle('show',segmentTexts.length>0)\n}\nasync function regenerateSegment(i,btn){\n  if(!currentCfg||!segmentTexts[i])return;\n  btn.disabled=true;const old=btn.textContent;btn.textContent='生成中…';\n  try{\n    status('局部重生成 '+(i+1)+'/'+segmentTexts.length+' · 其他片段保持不变…');\n    const r=await synthSegment(segmentTexts[i],i,segmentTexts.length,currentCfg);\n    segmentSources[i]=r.blob;lastMeta.provider=r.provider;lastMeta.route=r.route;lastMeta.model=r.model;lastMeta.tempo=r.tempo;runRoutes[i]=r.route;runFallback=(currentCfg.quality!=='fast'&&runRoutes.some(x=>x&&x!=='qwen3-tts'))||r.fallback;\n    const wav=await rebuildOutput();\n    status('局部重生成完成 · 已重新拼接完整 WAV · '+wav.duration.toFixed(1)+' 秒。');\n    $('audio').play().catch(()=>{})\n  }catch(e){status('局部重生成失败：'+(e.message||e))}\n  finally{btn.disabled=false;btn.textContent=old}\n}\nasync function renderAll(cfg,allowCorrection=true){\n  segmentSources=[];lastMeta={};runRoutes=[];runFallback=false;\n  for(let i=0;i<segmentTexts.length;i++){\n    status('生成 '+(i+1)+'/'+segmentTexts.length+' · 足球导演正在处理情绪与重音…');\n    const r=await synthSegment(segmentTexts[i],i,segmentTexts.length,cfg);\n    segmentSources.push(r.blob);lastMeta.provider=r.provider;lastMeta.route=r.route;lastMeta.model=r.model;lastMeta.tempo=r.tempo;runRoutes.push(r.route);if(r.fallback||(cfg.quality!=='fast'&&r.route!=='qwen3-tts'))runFallback=true\n  }\n  let wav=await rebuildOutput();\n  if(allowCorrection&&cfg.target){\n    const diff=Math.abs(wav.duration-cfg.target),ratio=wav.duration/cfg.target;\n    const corrected=clamp(cfg.speed*ratio,.82,1.25);\n    if(diff>1.5&&Math.abs(corrected-cfg.speed)>.025){\n      status('时长校准 · '+wav.duration.toFixed(1)+' 秒 → '+cfg.target+' 秒目标…');\n      cfg.speed=corrected;currentCfg={...cfg};\n      return renderAll(cfg,false)\n    }\n  }\n  return wav\n}\nasync function refreshEngineStatus(){\n  const box=$('enginebar');\n  try{\n    const r=await fetch('/api/engine-status',{cache:'no-store'});\n    const d=await r.json();\n    if(d.qwen_configured){\n      box.className='enginebar ok';\n      box.innerHTML='<strong>✓ Qwen3 1.7B 已连接</strong><span class=\"sub\">主引擎：Qwen3-TTS · 异常时才回退 Edge。</span>';\n    }else{\n      box.className='enginebar warn';\n      box.innerHTML='<strong>⚠ Qwen3 服务尚未连接</strong><span class=\"sub\">当前生成可能回退 Edge；这种结果不算 V1.5 高表现力验收。</span>';\n    }\n  }catch(e){\n    box.className='enginebar warn';\n    box.innerHTML='<strong>⚠ 无法确认 Qwen3 状态</strong><span class=\"sub\">建议暂不把本次结果当作 Qwen3 验收。</span>';\n  }\n}\n$('generate').onclick=async()=>{\n  const text=$('text').value.trim();if(!text){status('请先粘贴文案。');return}\n  const btn=$('generate');btn.disabled=true;btn.textContent='正在生成…';\n  try{\n    segmentTexts=splitPerformanceText(text);currentCfg=getCfg(text);\n    renderSegments();saveVoiceDraft();\n    const wav=await renderAll({...currentCfg},true);\n    const engineText=currentCfg.quality==='fast'?'本次使用 Edge 免费声线':runFallback?'⚠ 本次有 Edge 回退，不作为 Qwen3 验收结果':'✓ 本次全部由 Qwen3 生成';\n    const targetText=currentCfg.target?(' · 目标 '+currentCfg.target+' 秒，实际 '+wav.duration.toFixed(2)+' 秒'):(' · 实际 '+wav.duration.toFixed(2)+' 秒');\n    status(engineText+targetText+' · '+(currentCfg.commentary?'智能足球导演':'指定风格')+' · 可局部重生成。');\n    $('audio').play().catch(()=>{})\n  }catch(e){segmentSources=[];status('配音生成失败：'+(e.message||e))}\n  finally{btn.disabled=false;btn.textContent='生成完整配音'}\n};\n$('text').addEventListener('input',()=>{saveVoiceDraft();updatePlanner()});\n['mode','style','quality','speed','target','curve','intensity'].forEach(k=>$(k).addEventListener('change',()=>{saveVoiceDraft();updatePlanner()}));\nloadVoiceDraft();updatePlanner();refreshEngineStatus();\nif('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/voice-sw.js?v=2').catch(()=>{}));\n</script>\n</body></html>";

const ALLOWED_CLIENT_ORIGINS = new Set([
  "https://suny820916.github.io",
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

let renderTokenCache="";
let renderTokenCachedAt=0;
async function serverFetchRetry(url,init={},attempts=3){
  let last=null;
  for(let i=0;i<attempts;i++){
    last=await fetch(url,init);
    if(last.status!==429 && last.status<500)return last;
    await new Promise(r=>setTimeout(r,350*Math.pow(2,i)));
  }
  return last
}
async function getRenderVoiceToken(){
  if(renderTokenCache && Date.now()-renderTokenCachedAt<6*60*60*1000)return renderTokenCache;
  const r=await serverFetchRetry(ORIGIN+"/api/activate",{
    method:"POST",
    headers:{"Content-Type":"application/json","Origin":"https://suny820916.github.io","X-SAGI-Edge-Relay":"1"},
    body:"{}"
  },3);
  if(!r||!r.ok)throw new Error("RENDER_ACTIVATE_"+(r?.status||"NO_RESPONSE"));
  const d=await r.json().catch(()=>({}));
  if(!d.token)throw new Error("RENDER_ACTIVATE_NO_TOKEN");
  renderTokenCache=String(d.token);
  renderTokenCachedAt=Date.now();
  return renderTokenCache
}
async function renderVoiceFallback(payload){
  let token=await getRenderVoiceToken();
  const make=()=>serverFetchRetry(ORIGIN+"/api/voice/preview",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+token,
      "Origin":"https://suny820916.github.io",
      "X-SAGI-Edge-Relay":"1"
    },
    body:JSON.stringify(payload)
  },2);
  let r=await make();
  if(r?.status===401){
    renderTokenCache="";renderTokenCachedAt=0;
    token=await getRenderVoiceToken();
    r=await make()
  }
  if(!r||!r.ok){
    let detail="";
    try{detail=(await r.text()).slice(0,220)}catch{}
    throw new Error("RENDER_VOICE_"+(r?.status||"NO_RESPONSE")+(detail?":"+detail:""))
  }
  return r
}
function routerAudioResponse(audio,meta,origin){
  const contentType=String(meta.contentType||"audio/mpeg");
  const ext=contentType.includes("wav")?"wav":"mp3";
  return new Response(audio,{
    status:200,
    headers:{
      "Content-Type":contentType,
      "Cache-Control":"no-store",
      "Content-Disposition":"inline; filename=sagi-voice."+ext,
      "X-SAGI-Voice-Complete":"1",
      "X-SAGI-Voice-Coverage":"100",
      "X-SAGI-Voice-Segments":String(meta.segments||1),
      "X-SAGI-Voice-Provider":meta.provider||"Microsoft Edge Neural Direct",
      "X-SAGI-Voice-Model":meta.model||"edge-neural-direct-v2",
      "X-SAGI-Voice-Quality":meta.quality||"edge-direct",
      "X-SAGI-Voice-Route":meta.route||"edge-direct",
      "X-SAGI-Voice-Fallback":meta.fallback?"1":"0",
      "X-SAGI-Voice-Router":"1",
      "X-SAGI-Performance-Style":meta.performance_style||"",
      "X-SAGI-Performance-Rate":meta.rate||"",
      "X-SAGI-Performance-Pitch":meta.pitch||"",
      "X-SAGI-Tempo":meta.tempo||"",
      "X-SAGI-Raw-Duration":meta.raw_duration||"",
      "X-SAGI-Target-Duration":meta.target_duration||"",
      "X-SAGI-Final-Duration":meta.final_duration||"",
      ...cors(origin)
    }
  })
}

const VOICE_MANIFEST = JSON.stringify({
  name:"SAGI VOICE",
  short_name:"SAGI VOICE",
  description:"SAGI SPORTS 独立 AI 配音工作台",
  start_url:"/",
  scope:"/",
  display:"standalone",
  background_color:"#080b0d",
  theme_color:"#080b0d",
  orientation:"portrait-primary",
  icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any maskable"}]
});
const VOICE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="#080b0d"/>
<rect x="42" y="42" width="428" height="428" rx="92" fill="#11130f" stroke="#60502e" stroke-width="8"/>
<path d="M150 372L256 112L354 372" fill="none" stroke="#d7b568" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M205 286H302" stroke="#d7b568" stroke-width="32" stroke-linecap="round"/>
<circle cx="366" cy="150" r="34" fill="#e23e35"/>
</svg>`;
const VOICE_SW = `
const CACHE='sagi-voice-standalone-v3';
const SHELL=['/','/manifest.webmanifest','/icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('sagi-voice-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put('/',x));return r}).catch(()=>caches.match('/')));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request)));
});
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (request.method === "GET" && (url.pathname === "/manifest.webmanifest" || url.pathname === "/voice-manifest.json")) {
      return new Response(VOICE_MANIFEST,{status:200,headers:{"Content-Type":"application/manifest+json; charset=utf-8","Cache-Control":"no-cache"}});
    }
    if (request.method === "GET" && (url.pathname === "/icon.svg" || url.pathname === "/voice-icon.svg")) {
      return new Response(VOICE_ICON,{status:200,headers:{"Content-Type":"image/svg+xml; charset=utf-8","Cache-Control":"public, max-age=86400"}});
    }
    if (request.method === "GET" && url.pathname === "/voice-sw.js") {
      return new Response(VOICE_SW,{status:200,headers:{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-cache","Service-Worker-Allowed":"/"}});
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/voice" || url.pathname === "/voice/")) {
      return new Response(VOICE_HTML, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-SAGI-Voice-Direct": "1"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/api/engine-status") {
      return directJson({
        ok:true,
        primary:"qwen3-tts",
        qwen_configured:Boolean(String(env?.QWEN3_TTS_URL||"").trim()),
        fallback:"edge-neural",
        stable_main_untouched:true
      },200,origin);
    }

    if (url.pathname === "/api/voice-router") {
      if (request.method !== "POST") return directJson({ok:false,error:"METHOD_NOT_ALLOWED"},405,origin);
      if (!directTtsAllowed(request)) return directJson({ok:false,error:"VOICE_ROUTER_RATE_LIMIT"},429,origin);
      let body={};
      try{body=await request.json()}catch{return directJson({ok:false,error:"INVALID_JSON"},400,origin)}
      const text=String(body?.text||"").trim();
      if(!text)return directJson({ok:false,error:"Text required"},400,origin);
      if(text.length>6000)return directJson({ok:false,error:"Text too long"},413,origin);
      const payload={
        text,
        mode:String(body?.mode||"ai_male"),
        voice_id:String(body?.voice_id||""),
        speed:Number(body?.speed||1),
        target_duration:Number(body?.target_duration||0)>0?Number(body.target_duration):null,
        style:String(body?.style||"natural"),
        quality:String(body?.quality||"pro"),
        commentary_mode:Boolean(body?.commentary_mode),
        intensity:Math.max(0,Math.min(100,Number(body?.intensity||60))),
        emotion_curve:String(body?.emotion_curve||"steady"),
        segment_index:Math.max(0,Number(body?.segment_index||0)),
        segment_count:Math.max(1,Math.min(8,Number(body?.segment_count||1)))
      };
      let qwenError="",edgeError="";
      if(payload.quality!=="fast"){
        try{
          const result=await synthesizeQwen3(payload,env);
          return routerAudioResponse(result.audio,{
            provider:result.provider,
            model:result.model,
            quality:result.quality,
            segments:1,
            route:result.route,
            fallback:false,
            performance_style:result.performance_style,
            tempo:result.tempo,
            raw_duration:result.raw_duration,
            target_duration:result.target_duration,
            final_duration:result.final_duration,
            contentType:result.contentType
          },origin)
        }catch(err){
          qwenError=String(err?.message||err).slice(0,180)
        }
      }
      try{
        const result=await synthesizeEdgeDirect(payload);
        return routerAudioResponse(result.audio,{
          provider:result.provider,
          model:result.model,
          quality:"edge-direct",
          segments:result.segments,
          route:"edge-direct",
          fallback:payload.quality!=="fast",
          performance_style:result.performance_style,
          rate:result.rate,
          pitch:result.pitch,
          contentType:"audio/mpeg"
        },origin)
      }catch(err){
        edgeError=String(err?.message||err).slice(0,180)
      }
      if(payload.mode==="ai_female")return directJson({ok:false,error:"FEMALE_EDGE_UNAVAILABLE",detail:edgeError},502,origin);
      try{
        const fallback=await renderVoiceFallback(payload);
        const headers=new Headers(fallback.headers);
        for(const h of ["content-length","content-encoding","transfer-encoding","connection","keep-alive"])headers.delete(h);
        for(const [k,v] of Object.entries(cors(origin)))headers.set(k,v);
        headers.set("Cache-Control","no-store");
        headers.set("X-SAGI-Voice-Route","render-fallback");
        headers.set("X-SAGI-Voice-Fallback","1");
        headers.set("X-SAGI-Voice-Router","1");
        headers.set("X-SAGI-Qwen-Error",qwenError||"");
        headers.set("X-SAGI-Edge-Error",edgeError||"edge-direct-failed");
        return new Response(fallback.body,{status:200,headers})
      }catch(err){
        return directJson({
          ok:false,
          error:"VOICE_ROUTER_EXHAUSTED",
          qwen:qwenError||"not-attempted",
          edge:edgeError||"edge-direct-failed",
          fallback:String(err?.message||err).slice(0,220)
        },502,origin)
      }
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
          style:String(body?.style||"natural"),
          commentary_mode:Boolean(body?.commentary_mode),
          intensity:Math.max(0,Math.min(100,Number(body?.intensity||60))),
          emotion_curve:String(body?.emotion_curve||"steady"),
          segment_index:Math.max(0,Number(body?.segment_index||0)),
          segment_count:Math.max(1,Math.min(8,Number(body?.segment_count||1)))
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
            "X-SAGI-Voice-Name":result.voice,
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
