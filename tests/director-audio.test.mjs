import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDirector} from '../free-mobile/director-audio.mjs';

const text='中国队在最后时刻发起进攻并完成了一次漂亮的绝杀'.repeat(2);
const plan=[
 {text,speed:1,intensity:50,pauseBefore:0,pauseAfter:1000,emphasis:false},
 {text,speed:1,intensity:90,pauseBefore:0,pauseAfter:1000,emphasis:true},
];

test('measured calibration accounts for pauses and keeps the complete first take on retry failure', async t=>{
 const original=globalThis.AudioContext;
 t.after(()=>{if(original)globalThis.AudioContext=original;else delete globalThis.AudioContext;});
 globalThis.AudioContext=class{
  sampleRate=100;
  async decodeAudioData(buffer){
   const {frames,sample}=JSON.parse(new TextDecoder().decode(buffer));
   const pcm=new Float32Array(frames).fill(sample);
   return {length:frames,numberOfChannels:1,getChannelData:()=>pcm};
  }
  async close(){}
 };
 let calls=0;
 const synthesize=async entry=>{
  calls++;
  return {engine:'test',audio:new Blob([JSON.stringify({
   frames:Math.round(1050/entry.speed),sample:entry.emphasis?.4:.2,
  })])};
 };
 const result=await renderDirector(plan,synthesize,{target:20});
 assert.equal(result.calibration,'improved');
 assert.equal(calls,4);
 assert.ok(Math.abs(result.durationSeconds-20)<1,result.durationSeconds);
 const view=new DataView(await result.audio.arrayBuffer());
 const firstFrames=result.parts[0].pcm.length;
 assert.ok(view.getInt16(44,true)>0);
 assert.equal(view.getInt16(44+firstFrames*2,true),0);
 assert.ok(view.getInt16(44+(firstFrames+100)*2,true)>view.getInt16(44,true));
 calls=0;
 const fallback=await renderDirector(plan,entry=>calls>=2?Promise.reject(new Error('relay unavailable')):synthesize(entry),{target:20});
 assert.equal(fallback.calibration,'retry-failed');
 assert.equal(fallback.parts.length,2);
 assert.ok(fallback.durationSeconds>21);
});
