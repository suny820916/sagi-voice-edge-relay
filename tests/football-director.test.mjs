import test from 'node:test';
import assert from 'node:assert/strict';
import {planFootball,estimateDuration,boundedSpeed,groupDirectorPlan} from '../free-mobile/football-director.mjs';

const golden = [
 ['双方比分一比一。','BACKGROUND'], ['开场仅仅两分钟。','SETUP'],
 ['两队进入相持阶段。','BUILD'], ['主队快速反击。','ATTACK'],
 ['禁区里出现单刀。','PRESSURE'], ['赵松源前场高位抢断。','BREAKTHROUGH'],
 ['左脚低射！','SHOT'], ['球进了！','GOAL'], ['最后一秒完成绝杀！','DECISIVE'],
 ['比赛进入点球大战。','SETUP'], ['球队遗憾出局。','SETBACK'],
 ['中国队成功晋级！','DECISIVE'], ['这是属于中国队的世界杯进球。','EMOTIONAL'],
 ['孩子们在家乡踢球。','WARM'], ['多年以后依然记得。','MEMORY'],
 ['故事还在继续。','CLOSING'], ['险些进球！','SETBACK'],
 ['没有进球，但他们已经创造了历史。','SETBACK'],
 ['本赛季已经打进了十粒球。','BACKGROUND'], ['视频裁判正在核查进球。','BACKGROUND'],
 ['进球被取消。','SETBACK'],
];

test('golden commentary roles and parameter bounds',()=>{
 for(const [text,type] of golden){
  const [entry]=planFootball(text);
  assert.equal(entry.type,type,text);
  assert.equal(entry.text,text);
  assert.ok(entry.speed>=.82&&entry.speed<=1.2);
  assert.ok(entry.intensity>=0&&entry.intensity<=100);
  assert.equal(entry.emphasis,['GOAL','DECISIVE'].includes(type));
 }
});

test('build, confirmed goal, release and 600-character coverage',()=>{
 const text='开场仅仅两分钟。赵松源前场抢断，左脚低射，球进了！这是属于中国队的世界杯进球。';
 const plan=planFootball(text);
 assert.equal(plan.map(p=>p.text).join(''),text);
 assert.deepEqual(plan.map(p=>p.type),['SETUP','BREAKTHROUGH','SHOT','GOAL','EMOTIONAL']);
 assert.ok(plan[3].intensity>plan[2].intensity);
 assert.equal(plan[4].emotion,'recovery');
 assert.ok(plan[4].intensity<plan[3].intensity);
 const long=text.repeat(30).slice(0,600);
 assert.equal(planFootball(long).map(p=>p.text).join(''),long);
 assert.ok(estimateDuration(plan,1.1)<estimateDuration(plan,1));
 assert.equal(boundedSpeed(3),1.2);
});

test('coalescing keeps original text and isolates key events and recovery',()=>{
 const text='双方一比一。场上比分不变。球进了！双方重新开球。继续比赛。';
 const plan=planFootball(text);
 const grouped=groupDirectorPlan(plan);
 assert.equal(grouped.map(item=>item.text).join(''),text);
 assert.equal(grouped.length,4);
 assert.equal(grouped[1].type,'GOAL');
 assert.equal(grouped[2].emotion,'recovery');
 assert.equal(plan.length,5);
});

test('scorekeeping, replay and negation do not trigger a live celebration',()=>{
 for(const line of ['他们差点，球进了。','进球被判无效。','上一次他们在补时完成绝杀。','回放刚才打进的一球。']){
  const plan=planFootball(line);
  assert.equal(plan.map(item=>item.text).join(''),line);
  assert.ok(plan.every(item=>!item.emphasis),line);
 }
 assert.equal(planFootball('他们反超！')[0].type,'DECISIVE');
 assert.equal(planFootball('前锋破门。')[0].type,'GOAL');
});
