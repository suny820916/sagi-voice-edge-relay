import {boundedSpeed,estimateDuration} from './football-director.mjs';

export async function renderDirector(plan, synthesize, {signal,target=0,profile,onProgress,calibrate=true}={}) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  const ctx = new AC();
  const profileSpeed = profile?.speed || 1;
  const speedFor = (item, rate) => boundedSpeed(item.speed * rate * profileSpeed);
  async function render(rate) {
    const parts = [];
    for (const [index, item] of plan.entries()) {
      signal?.throwIfAborted();
      onProgress?.(index + 1, plan.length);
      const settings = {
        ...item,
        speed: speedFor(item,rate),
        intensity: Math.min(100, Math.max(0, item.intensity + (profile ? profile.intensity - 68 : 0))),
      };
      const result = await synthesize(settings);
      const pcm = await ctx.decodeAudioData(await result.audio.arrayBuffer());
      signal?.throwIfAborted();
      parts.push({item,settings,pcm,engine:result.engine});
    }
    return parts;
  }
  const length = parts => parts.reduce((sum,{item,pcm}) =>
    sum + pcm.length + Math.round(item.pauseBefore * ctx.sampleRate/1000)
    + Math.round(item.pauseAfter * ctx.sampleRate/1000),0);
  try {
    const rate = target ? boundedSpeed(estimateDuration(plan)/target) : 1;
    let parts = await render(rate);
    const measured = length(parts) / ctx.sampleRate;
    let calibration = 'not-needed';
    if (target && Math.abs(measured-target)>1) calibration = 'out-of-range';
    if (calibrate && calibration==='out-of-range') {
      const speech = parts.reduce((sum,{pcm})=>sum+pcm.length/ctx.sampleRate,0);
      const pauses = measured-speech;
      const predict = candidate => pauses + parts.reduce((seconds,{item,settings,pcm}) =>
        seconds+(pcm.length/ctx.sampleRate)*settings.speed/speedFor(item,candidate),0);
      let low=.82, high=1.2;
      for(let step=0;step<20;step++){
        const mid=(low+high)/2;
        if(predict(mid)>target)low=mid;
        else high=mid;
      }
      const corrected=(low+high)/2;
      const gain=Math.abs(measured-target)-Math.abs(predict(corrected)-target);
      if(gain>.25) {
        try {
          const alternative = await render(corrected);
          if (Math.abs(length(alternative)/ctx.sampleRate-target)<Math.abs(measured-target)) {
            parts=alternative;
            calibration='improved';
          } else calibration='first-take';
        } catch (error) {
          if (signal?.aborted) throw error;
          calibration='retry-failed';
        }
      }
    }
    const frames = length(parts);
    const buffer = new ArrayBuffer(44 + frames * 2);
    const wav = new DataView(buffer);
    const tag = (offset,value) => [...value].forEach((char,i)=>wav.setUint8(offset+i,char.charCodeAt(0)));
    tag(0,'RIFF'); wav.setUint32(4,buffer.byteLength-8,true);
    tag(8,'WAVE'); tag(12,'fmt '); wav.setUint32(16,16,true);
    wav.setUint16(20,1,true); wav.setUint16(22,1,true);
    wav.setUint32(24,ctx.sampleRate,true); wav.setUint32(28,ctx.sampleRate*2,true);
    wav.setUint16(32,2,true); wav.setUint16(34,16,true);
    tag(36,'data'); wav.setUint32(40,frames*2,true);
    let offset=44;
    for (const {item,pcm} of parts) {
      offset+=Math.round(item.pauseBefore*ctx.sampleRate/1000)*2;
      const channels=Array.from({length:pcm.numberOfChannels},(_,i)=>pcm.getChannelData(i));
      const gain=item.emphasis?1.12:1;
      for(let i=0;i<pcm.length;i++){
        const sample=Math.max(-1,Math.min(1,channels.reduce((sum,channel)=>sum+channel[i],0)*gain/channels.length));
        wav.setInt16(offset,Math.round(sample*(sample<0?32768:32767)),true);
        offset+=2;
      }
      offset+=Math.round(item.pauseAfter*ctx.sampleRate/1000)*2;
    }
    return {audio:new Blob([buffer],{type:'audio/wav'}),durationSeconds:frames/ctx.sampleRate,
      engine:parts[0].engine,parts,calibration};
  } finally {
    await ctx.close().catch(()=>{});
  }
}
