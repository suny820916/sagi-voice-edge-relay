// SAGI VOICE QWEN3-TTS CLIENT
// Optional primary engine. Configure Worker secrets/vars:
// QWEN3_TTS_URL=https://<gpu-service>  (or a full .../v1/tts endpoint)
// QWEN3_TTS_TOKEN=<optional bearer token>
// If unavailable, worker.js falls back to Edge Neural automatically.

const GOAL_WORDS=/绝杀|进球|破门|球进了|点球|扳平|反超|冠军|夺冠|晋级|出线|淘汰|制胜|最后一击|最后一分钟|读秒|历史|奇迹/;
const ATTACK_WORDS=/反击|冲刺|突破|传中|射门|头球|抢断|压迫|推进|转换|单刀|禁区|门前|攻势|机会|加速|逼抢/;
const WARM_WORDS=/热爱|坚持|梦想|孩子|陪伴|家乡|普通人|平凡|记住|记录|青春|岁月|故事/;

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function sceneStyle(text,style,commentary){
  const requested=String(style||"natural");
  if(!commentary||requested!=="football_auto")return requested;
  const s=String(text||"");
  if(GOAL_WORDS.test(s))return "football_goal";
  if(ATTACK_WORDS.test(s))return "football_passion";
  if(WARM_WORDS.test(s))return "football_warm";
  return "football_pro";
}
function curveInstruction(curve,position){
  const p=clamp(Number(position)||0,0,1);
  if(curve==="build"){
    if(p<.34)return "处在整段解说的蓄力阶段：克制、紧张、不要提前爆发，句尾留一点悬念。";
    if(p<.72)return "处在整段解说的推进阶段：逐渐加快，明显增加紧张感和推进感，但保留最后的爆发空间。";
    return "处在整段解说的高潮阶段：允许明显爆发；关键短句要短促、有冲击力，高潮之后自然收住。";
  }
  if(curve==="burst_close"){
    return p<.45?"开场就保持较强推进和现场感。":"逐渐收束，放慢一点，降低音量，用有重量的语气结束。";
  }
  if(curve==="wave")return "情绪有明显起伏：信息句克制，机会句抬升，关键动作句短促，不要从头到尾同一强度。";
  if(curve==="documentary")return "纪录片式起伏：叙事沉稳，重要词加重，结尾留余韵，不要播音腔。";
  return "保持职业现场解说的自然起伏，不要机械匀速。";
}
function styleInstruction(style){
  if(style==="football_goal")return "你是中国职业足球现场直播解说员。当前是决定比赛的进球/绝杀瞬间。先快速蓄力，关键动作短句连续抬升；说到“球进了”“绝杀”“进球”这类词时瞬间爆发，音量、速度、力度都明显达到峰值，但不能尖叫失真。高潮之后把声音压下来，留下重量和余韵。";
  if(style==="football_passion")return "你是中国职业足球现场直播解说员。当前是快速攻防阶段。节奏紧、推进感强，动作词要有冲击力，机会出现时明显抬升；不要每句话都一样激动，必须有层次。";
  if(style==="football_warm")return "你是成熟的足球纪录片旁白。声音温暖、真诚、略慢，重要词轻微加重，避免广告腔和机械播音腔。";
  if(style==="football_emotional")return "你在讲一个真实足球故事。克制但有情感，允许轻微停顿和呼吸感，情绪从叙事内部自然产生，不要煽情朗诵。";
  if(style==="football_memory")return "你是高质量体育纪录片旁白。低沉、稳、松弛，有回忆感和时间感，结尾要有余韵。";
  if(style==="football_pro")return "你是中国职业足球现场直播解说员。信息清楚、沉稳、可信，保持现场感；该快时快、该停时停，不要新闻播音腔。";
  return "自然中文男声表达，避免机械朗读，使用真实口语韵律。";
}
function speakerFor(mode,env){
  if(mode==="ai_female")return String(env?.QWEN3_TTS_FEMALE_SPEAKER||"Serena");
  return String(env?.QWEN3_TTS_MALE_SPEAKER||"Uncle_Fu");
}
function buildInstruction(payload){
  const count=Math.max(1,Number(payload.segment_count)||1);
  const idx=clamp(Number(payload.segment_index)||0,0,count-1);
  const pos=count<=1?.5:idx/(count-1);
  const style=sceneStyle(payload.text,payload.style,Boolean(payload.commentary_mode));
  const intensity=clamp(Number(payload.intensity)||65,0,100);
  const speed=clamp(Number(payload.speed)||1,.7,1.42);
  const intensityText=intensity>=90?"情绪强度很高，高潮必须听得出明显变化。":intensity>=75?"情绪强度偏高，关键句要有明显反差。":intensity<=50?"整体克制，不要过度表演。":"保持专业自然的情绪强度。";
  const speedText=speed>1.12?"整体语速偏快，但关键动作词仍要咬清。":speed<.92?"整体语速偏慢，允许更多停顿。":"整体使用自然职业解说语速。";
  return {
    style,
    instruct:[styleInstruction(style),curveInstruction(String(payload.emotion_curve||"steady"),pos),intensityText,speedText,"必须准确朗读原文，不得增字、漏字或改写。"].join("")
  };
}
export async function synthesizeQwen3(payload,env){
  const base=String(env?.QWEN3_TTS_URL||"").trim().replace(/\/$/,"");
  if(!base)throw new Error("QWEN3_TTS_NOT_CONFIGURED");
  const endpoint=/\/v1\/tts$/i.test(base)?base:base+"/v1/tts";
  const {style,instruct}=buildInstruction(payload);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),Number(env?.QWEN3_TTS_TIMEOUT_MS||45000));
  let r;
  try{
    const headers={"Content-Type":"application/json","Accept":"audio/wav"};
    const token=String(env?.QWEN3_TTS_TOKEN||"").trim();
    if(token)headers.Authorization="Bearer "+token;
    r=await fetch(endpoint,{
      method:"POST",headers,signal:controller.signal,
      body:JSON.stringify({
        text:String(payload.text||""),
        language:"Chinese",
        speaker:speakerFor(payload.mode,env),
        instruct,
        style,
        speed:Number(payload.speed||1),
        intensity:Number(payload.intensity||65),
        segment_index:Number(payload.segment_index||0),
        segment_count:Number(payload.segment_count||1)
      })
    });
  }catch(e){
    if(e?.name==="AbortError")throw new Error("QWEN3_TTS_TIMEOUT");
    throw new Error("QWEN3_TTS_NETWORK_"+String(e?.message||e).slice(0,120));
  }finally{clearTimeout(timeout)}
  if(!r.ok){
    const detail=(await r.text().catch(()=>"")).slice(0,180);
    throw new Error("QWEN3_TTS_HTTP_"+r.status+(detail?"_"+detail:""));
  }
  const type=String(r.headers.get("content-type")||"");
  if(!/audio\/(wav|x-wav|wave|mpeg|mp3|octet-stream)/i.test(type))throw new Error("QWEN3_TTS_BAD_CONTENT_TYPE_"+type);
  const audio=new Uint8Array(await r.arrayBuffer());
  if(audio.byteLength<800)throw new Error("QWEN3_TTS_EMPTY_AUDIO");
  return {
    audio,
    contentType:type.includes("mpeg")?"audio/mpeg":"audio/wav",
    provider:"Qwen3-TTS",
    model:r.headers.get("X-Qwen-Model")||"Qwen3-TTS-12Hz-1.7B-CustomVoice",
    quality:"qwen3-generative",
    route:"qwen3-tts",
    fallback:false,
    performance_style:style,
    speaker:r.headers.get("X-Qwen-Speaker")||speakerFor(payload.mode,env),
    tempo:r.headers.get("X-SAGI-Tempo")||"",
    instruct
  };
}
