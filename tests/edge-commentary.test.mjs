import assert from 'node:assert/strict';
import test from 'node:test';
import {synthesizeEdgeDirect} from '../edge-tts-direct.js';
import {makeProviders} from '../free-provider-adapters.mjs';
import {generateFree} from '../free-engine-router.mjs';

test('both voices send stable Edge SSML with buildup, peak and release', async t => {
  const turns = [];
  t.mock.method(globalThis, 'fetch', async () => {
    const socket = new EventTarget();
    socket.accept = socket.close = () => {};
    socket.send = message => {
      if (!message.includes('Path:ssml')) return;
      turns.push(message);
      const header = Buffer.from('Path:audio\r\n');
      const frame = Buffer.concat([Buffer.from([0, header.length]), header, Buffer.alloc(160)]);
      setImmediate(() => {
        socket.dispatchEvent(new MessageEvent('message', {data:frame}));
        setImmediate(() => socket.dispatchEvent(new MessageEvent('message', {data:'Path:turn.end'})));
      });
    };
    return {status:101,webSocket:socket};
  });
  const levels = [];
  for (const [mode,name] of [['ai_male','YunjianNeural'],['ai_female','XiaoxiaoNeural']]) {
    turns.length = 0;
    const result = await synthesizeEdgeDirect({
      text:'比分二比一。险些进球！突然启动。球进了！这就是足球。',
      mode,style:'football_auto',commentary_mode:true,intensity:68,emotion_curve:'build'
    });
    assert.equal(result.segments,5);
    assert.equal(result.voice,'zh-CN-'+name);
    const prosody = turns.map(turn => {
      assert.ok(turn.includes(name));
      const [,pitch,rate,volume] = turn.match(/pitch='([+-]\d+)Hz' rate='([+-]\d+)%' volume='([+-]\d+)%'/);
      return [Number(pitch),Number(rate),Number(volume)];
    });
    const volumes = prosody.map(p => p[2]);
    assert.ok(volumes[0] < volumes[2]);
    assert.ok(volumes[1] < volumes[3]);
    assert.ok(volumes[3] >= volumes[2]+5);
    assert.ok(volumes[4] <= 0);
    levels.push(prosody);
  }
  assert.notDeepEqual(levels[0][3],levels[1][3]);
});

test('female request reaches Edge and cannot fall back to unverified demo voice', async () => {
  const modes = [];
  const edge = makeProviders(async (_, init) => {
    const body = JSON.parse(init.body);
    modes.push(body.mode);
    assert.equal(body.commentary_mode,true);
    return new Response(new Uint8Array(256), {headers:{'Content-Type':'audio/mpeg'}});
  }).at(-1);
  const demo = {id:'demo',publicDemo:true,allowed:true,generate:async()=>assert.fail('demo called')};
  await generateFree({text:'进球了！',mode:'ai_female'},[demo,edge],{allowPublicDemo:true});
  await generateFree({text:'进球了！'},[edge]);
  assert.deepEqual(modes,['ai_female','ai_male']);
});
