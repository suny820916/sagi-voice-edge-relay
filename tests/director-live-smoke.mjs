import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const relay = 'https://sagi-voice-edge-relay.sg3544225.workers.dev/api/direct-tts';
const lines = ['比分一比一。','主队险些进球。','左脚低射！','球进了！','这是属于中国队的进球。'];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const requests = [];
  await page.route(relay, async route => {
    const headers={'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    const request=route.request().postDataJSON();
    requests.push(request);
    const response=await fetch(relay,{
      method:'POST',
      headers:{'content-type':'application/json','origin':'https://suny820916.github.io'},
      body:JSON.stringify(request),
      signal:AbortSignal.timeout(25_000),
    });
    await route.fulfill({status:response.status,headers:{...headers,'content-type':response.headers.get('content-type')||'application/octet-stream'},body:Buffer.from(await response.arrayBuffer())});
  });
  await page.goto('http://127.0.0.1:8765/');
  await page.locator('#text').fill(lines.join(''));
  const results=[];
  for(const mode of ['ai_male','ai_female']){
    const start=requests.length;
    await page.locator('#mode').selectOption(mode);
    await page.locator('#generate').click();
    await page.waitForFunction(()=>!document.querySelector('#generate').disabled,{},{timeout:120_000});
    assert.deepEqual(requests.slice(start).map(r=>r.text),lines);
    assert.ok(requests.slice(start).every(r=>r.mode===mode));
    assert.ok(await page.locator('#save').isEnabled());
    const pcm=await page.locator('#audio').evaluate(async player=>{
      const audio=await (await fetch(player.src)).arrayBuffer();
      const wav=new DataView(audio), rate=wav.getUint32(24,true);
      const count=wav.getUint32(40,true)/2;
      let peak=0;
      for(let i=0;i<count;i++)peak=Math.max(peak,Math.abs(wav.getInt16(44+i*2,true)));
      const digest=await crypto.subtle.digest('SHA-256',audio);
      return {duration:count/rate,peak,hash:Array.from(new Uint8Array(digest)).join(',')};
    });
    assert.ok(pcm.duration>3&&pcm.duration<40);
    assert.ok(pcm.peak>100);
    results.push(pcm);
    console.log(mode, 'live segmented Edge WAV', pcm.duration.toFixed(2), 'seconds', 'peak', pcm.peak);
  }
  assert.notEqual(results[0].hash,results[1].hash);
} finally {
  await browser.close();
}
