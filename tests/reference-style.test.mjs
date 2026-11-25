import test from 'node:test';
import assert from 'node:assert/strict';
import {learnReference,mergeReference,referenceDistance} from '../free-mobile/reference-style.mjs';
import {makeProviders} from '../free-provider-adapters.mjs';

test('learned reference accumulates and reaches Edge without the source recording', async () => {
  const samples = new Float32Array(8000 * 3);
  samples.fill(.04, 0, 12000);
  samples.fill(.12, 16000, 24000);
  const style = learnReference(samples, 8000, '这是足球解说测试比赛进入最后时刻');
  assert.ok(style.pauseRatio > .15);
  assert.ok(style.intensity > 50);
  const profile = mergeReference(mergeReference(null, style), {...style, speed:.9});
  assert.equal(profile.count, 2);
  assert.equal(profile.speed, (style.speed + .9) / 2);
  assert.throws(() => learnReference(new Float32Array(samples.length), 8000, '这是一段测试'), /录音/);
  const edge = makeProviders(async (_, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.mode, 'ai_female');
    assert.equal(body.speed, profile.speed);
    assert.equal(body.intensity, profile.intensity);
    assert.equal(body.text, '球进了！');
    assert.equal(body.profile, undefined);
    return new Response(new Uint8Array(256), {headers:{'Content-Type':'audio/mpeg'}});
  }).at(-1);
  await edge.generate({text:'球进了！',mode:'ai_female',profile});
});

test('automatic comparison prefers the closer acoustic profile', () => {
  const target = {speed:1, intensity:70, pauseRatio:.15};
  const learned = {speed:.99, intensity:72, pauseRatio:.17};
  const baseline = {speed:.9, intensity:55, pauseRatio:.3};
  assert.ok(referenceDistance(learned,target) < referenceDistance(baseline,target));
});
